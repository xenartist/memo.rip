const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs').promises;
const winston = require('winston');
const DbChecker = require('./db-checker');
const { fetchRPC, setRpcEndpoints } = require('./utils');

const app = express();
const args = process.argv.slice(2);
const port = args[0] || process.env.PORT || 3000;
const TOTAL_SUPPLY = 66975795738;
// database
let db;
// let currentRpcIndex = 0;
// let rpcEndpoints = [];

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ level, message, timestamp }) => {
            const msg = typeof message === 'object' ? 
                JSON.stringify(message) : 
                message;
            return `${timestamp} [${level}]: ${msg}`;
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.Console()
    ]
});

async function loadRpcConfig() {
    try {
        const configPath = path.join(__dirname, 'config/rpc.json');
        const configData = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configData);
        setRpcEndpoints(config.endpoints);
        logger.info(`RPC endpoints loaded: ${config.endpoints}`);
    } catch (error) {
        logger.error(`Failed to load RPC config: ${error}`);
    }
}

// load rpc config
loadRpcConfig();

// reload rpc config every 5 minutes
setInterval(loadRpcConfig, 300000);

// initialize database
initializeDatabase();

// Serve static files
app.use(express.static('public'));
app.use('/api/solana-rpc', express.raw({ type: 'application/json' }));

app.get('/api/test-solana', async (req, res) => {
    try {
        const data = await fetchRPC({
            jsonrpc: "2.0",
            id: 1,
            method: "getVersion",
            params: []
        });
        res.json(data);
    } catch (error) {
        logger.error(`Test RPC Error: ${error}`);
        res.status(500).json({ 
            error: 'Test RPC request failed',
            message: error.message 
        });
    }
});

// RPC proxy route
app.post('/api/solana-rpc', async (req, res) => {
    try {
        logger.info(`Received RPC request: ${req.body.toString()}`);
        // check if it's a getTransaction request
        if (JSON.parse(req.body.toString()).method === 'getSignatureStatuses') {
            logger.info(`getSignatureStatuses request received`);
            const bodyData = JSON.parse(req.body.toString());
            const signature = bodyData.params[0][0];  // Get first signature from array
            
            // 1. Save signature to database immediately
            try {
                await db.run(`
                    INSERT INTO burns (signature)
                    VALUES (?)
                    ON CONFLICT(signature) DO NOTHING
                `, [signature]);
            } catch (err) {
                logger.error(`Failed to save initial signature: ${err}`);
            }

            // 2. Get signature status with retries
            let retries = 3;
            while (retries > 0) {
                const statusData = await fetchRPC(bodyData);
                
                if (statusData.result?.value?.[0]?.confirmationStatus === 'confirmed' ||
                    statusData.result?.value?.[0]?.confirmationStatus === 'finalized') {
                    
                    // Trigger background processing without awaiting
                    processTransactionDetails(signature, db).catch(err => {
                        logger.error(`Background processing failed: ${err}`);
                    });
                    
                    return res.json(statusData);
                }
                
                retries--;
                if (retries > 0) {
                    logger.info(`Waiting 30 seconds before retry ${3-retries}/3`);
                    await new Promise(resolve => setTimeout(resolve, 30000));
                }
            }

            // Delete unconfirmed signature from database
            try {
                await db.run('DELETE FROM burns WHERE signature = ?', [signature]);
                logger.info(`Deleted unconfirmed signature from database: ${signature}`);
            } catch (err) {
                logger.error(`Failed to delete unconfirmed signature: ${err}`);
            }
            
            // If we get here, transaction was not confirmed after all retries
            return res.status(400).json({
                error: 'Transaction confirmation timeout',
                message: 'Transaction was not confirmed within the expected timeframe'
            });
        } else {
            // other RPC requests
            const data = await fetchRPC(req.body);
            res.json(data);
        }
    } catch (error) {
        logger.error(`RPC proxy error: ${error}`);
        res.status(500).json({ error: error.message });
    }
});

// Route to get burn data
app.get('/api/burns', async (req, res) => {
    try {
        const totalBurn = Math.floor((await memoCache.getTotalBurn(db) || 0) / 1_000_000);
        const burnPercentage = (totalBurn / TOTAL_SUPPLY) * 100;
        res.json({"totalBurn": totalBurn, "burnPercentage": burnPercentage});
    } catch (error) {
        logger.error(`Failed to fetch burn stats: ${error}`);
        res.status(500).json({ error: 'Failed to fetch data' });
    }
});

app.get('/api/top-burns', async (req, res) => {
    try {
        const topBurns = await memoCache.getTopAmount(db);
        res.json(topBurns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/latest-burns', async (req, res) => {
    try {
        const latestBurns = await memoCache.getLatest(db);
        res.json(latestBurns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Route to get top total burns
app.get('/api/top-total-burns', async (req, res) => {
    try {
        const topTotalBurns = await memoCache.getTopTotalBurns(db);
        // Format the response
        const formattedBurns = topTotalBurns.map((burner, index) => ({
            rank: index + 1,
            address: burner.burner,
            totalAmount: Math.floor(burner.total_amount / 1_000_000), // Convert to whole numbers
            burnCount: burner.burn_count
        }));
        res.json(formattedBurns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

class MemoCache {
    constructor() {
        this.topAmountCache = []; // top 10 burns
        this.latestCache = [];  // latest 10 burns
        this.topTotalBurnsCache = []; // top 69 burns
        this.totalBurnCache = 0; // total burn amount
        this.lastUpdateTime = 0;     
        this.CACHE_DURATION = 5 * 60 * 1000;  // cache duration 5 minutes
    }

    async updateCache(db) {
        try {
            // get top 10 burns
            const topAmount = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT signature, burner, amount, memo, token, timestamp, created_at
                    FROM burns 
                    WHERE memo_checked = 'Y'
                    AND amount > 0
                    ORDER BY amount DESC 
                    LIMIT 10
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });
            
            // get latest 10 burns
            const latest = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT signature, burner, amount, memo, token, timestamp, created_at
                    FROM burns 
                    WHERE memo_checked = 'Y'
                    AND amount > 0
                    ORDER BY timestamp DESC 
                    LIMIT 10
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            // get total burn amount
            const totalBurn = await new Promise((resolve, reject) => {
                db.get("SELECT SUM(amount) as amount FROM burns", [], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            })

            // get top 69 burners by total amount
            const topTotalBurns = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT burner, 
                           SUM(amount) as total_amount,
                           COUNT(*) as burn_count
                    FROM burns 
                    WHERE memo_checked = 'Y'
                    GROUP BY burner
                    HAVING SUM(amount) >= 420
                    ORDER BY total_amount DESC 
                    LIMIT 69
                `, (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows);
                });
            });

            this.topAmountCache = topAmount;
            this.latestCache = latest;
            this.topTotalBurnsCache = topTotalBurns;
            this.totalBurnCache = totalBurn.amount;
            this.lastUpdateTime = Date.now();
            
            console.log('Cache updated:', {
                topAmount: topAmount.length,
                latest: latest.length,
                totalBurn: totalBurn.amount,
                topTotalBurns: topTotalBurns.length,
                time: new Date().toISOString()
            });
        } catch (error) {
            console.error('Cache update failed:', error);
            throw error;
        }
    }

    needsUpdate() {
        return Date.now() - this.lastUpdateTime > this.CACHE_DURATION;
    }

    async getTopAmount(db) {
        if (this.needsUpdate()) {
            await this.updateCache(db);
        }
        return this.topAmountCache;
    }

    async getLatest(db) {
        if (this.needsUpdate()) {
            await this.updateCache(db);
        }
        return this.latestCache;
    }

    async getTotalBurn(db) {
        if (this.needsUpdate()) {
            await this.updateCache(db);
        }
        return this.totalBurnCache;
    }

    async getTopTotalBurns(db) {
        if (this.needsUpdate()) {
            await this.updateCache(db);
        }
        return this.topTotalBurnsCache;
    }

    async invalidateCache(db) {
        await this.updateCache(db);
    }
}

const memoCache = new MemoCache();

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        db = new sqlite3.Database('./data/burns.db', async (err) => {
            if (err) {
                console.error('Database initialization failed:', err);
                reject(err);
                return;
            }
            
            console.log('Connected to SQLite database');
            
            try {
                // ensure table exists
                await new Promise((resolve, reject) => {
                    db.run(`CREATE TABLE IF NOT EXISTS burns (
                        signature TEXT PRIMARY KEY,
                        burner TEXT,
                        amount DECIMAL(20,9),
                        memo TEXT,
                        token TEXT,
                        timestamp DATETIME,
                        memo_checked CHAR(1),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )`, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });

                // Initialize DbChecker and start periodic checking
                const dbChecker = new DbChecker(db);

                // process unchecked transactions when server starts
                try {
                    await dbChecker.processUncheckedTransactions(10);
                } catch (error) {
                    logger.error('Initial unchecked transactions processing failed:', error);
                }

                // process unchecked transactions every 10 minutes after server starts
                setInterval(async () => {
                    try {
                        await dbChecker.processUncheckedTransactions(10);
                    } catch (error) {
                        logger.error('Failed to process unchecked transactions:', error);
                    }
                }, 10 * 60 * 1000); // every 10 minutes

                // initialize cache
                await memoCache.updateCache(db);
                
                console.log('Database and cache initialized');
                resolve();
            } catch (error) {
                console.error('Table/Cache initialization failed:', error);
                reject(error);
            }
        });
    });
}

// Separate async function for background processing
async function processTransactionDetails(signature, db) {
    let retries = 3;
    
    while (retries > 0) {
        try {
            console.log(`Attempting to fetch transaction data (${4-retries}/3)`);
            const transactionData = await fetchRPC({
                jsonrpc: "2.0",
                id: 1,
                method: "getTransaction",
                params: [signature, { 
                    "encoding": "jsonParsed", 
                    "maxSupportedTransactionVersion": 0, 
                    "commitment": "finalized" 
                }]
            });
            console.log('Transaction data received:', {
                status: transactionData.result ? 'success' : 'no result',
                error: transactionData.error,
                timestamp: new Date().toISOString()
            });

            if (!transactionData.result) {
                console.log('No result received, waiting 10 seconds before next attempt...');
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }

            if (transactionData.result) {
                const burnData = parseBurnTransactionData(transactionData.result);

                await db.run(`
                    INSERT INTO burns (signature, burner, amount, memo, token, timestamp, memo_checked)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(signature) DO UPDATE SET
                        burner = excluded.burner,
                        amount = excluded.amount,
                        memo = excluded.memo,
                        token = excluded.token,
                        timestamp = excluded.timestamp,
                        memo_checked = excluded.memo_checked
                `, [
                    burnData.signature,
                    burnData.burner,
                    burnData.amount,
                    burnData.memo,
                    burnData.token,
                    burnData.timestamp,
                    'Y'
                ]);
                console.log('Successfully updated database with burn data');

                await memoCache.invalidateCache(db);
                console.log('Cache invalidated successfully');
                break;
            }
        } catch (error) {
            retries--;
            if (retries === 0) {
                console.error('Failed to process transaction details:', error);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
}

function isValidBurnTransaction(transaction) {
    return true;
}

function parseBurnTransactionData(transaction) {
    try {
        console.log('Starting to parse transaction data...');

        //Find the burn instruction
        const burnInstruction = transaction.transaction.message.instructions.find(
            instruction => instruction.parsed?.type === 'burn' || instruction.parsed?.type === 'burnChecked'
        );

        if (!burnInstruction) {
            throw new Error('No burn instruction found in transaction');
        }

        // Parse burn data
        const burnAmount = burnInstruction.parsed.info.amount;
        const burner = burnInstruction.parsed.info.authority;
        const token = burnInstruction.parsed.info.mint;
        const timestamp = transaction.blockTime;
        const signature = transaction.transaction.signatures[0];

        // Find the memo instruction
        const memoInstruction = transaction.transaction.message.instructions.find(
            instruction => instruction.program === 'spl-memo'
        );

        if (!memoInstruction) {
            throw new Error('No memo instruction found in transaction');
        }

        // Parse memo data
        const memo = memoInstruction.parsed;

        return {
            signature: signature,
            amount: burnAmount,
            burner: burner,
            memo: memo,
            token: token,
            timestamp: timestamp,
        };
    } catch (error) {
        console.error('Error parsing transaction data:', error);
        throw error;
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});