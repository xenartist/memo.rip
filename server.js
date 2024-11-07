const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;
// Solana RPC endpoint
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
const TOTAL_SUPPLY = 58401288517;
// database
let db;

// initialize database
initializeDatabase();

// Serve static files
app.use(express.static('public'));
app.use('/api/solana-rpc', express.raw({ type: 'application/json' }));

app.get('/api/test-solana', async (req, res) => {
    try {
        const response = await fetch(SOLANA_RPC, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "getVersion",
                params: []
            })
        });

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Test RPC Error:', error);
        res.status(500).json({ 
            error: 'Test RPC request failed',
            message: error.message 
        });
    }
});

// RPC proxy route
app.post('/api/solana-rpc', async (req, res) => {
    try {
        console.log('Received RPC request:', req.body.toString());
        // check if it's a getTransaction request
        if (JSON.parse(req.body.toString()).method === 'getSignatureStatuses') {
            console.log('getSignatureStatuses request received');
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
                console.error('Failed to save initial signature:', err);
            }

            // 2. Forward getSignatureStatuses request to Solana
            const response = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: req.body
            });
            const statusData = await response.json();

            // 3. If confirmed/finalized, trigger background processing and return immediately
            if (statusData.result?.value?.[0]?.confirmationStatus === 'confirmed' ||
                statusData.result?.value?.[0]?.confirmationStatus === 'finalized') {

                 // Wait 15 seconds
                 await new Promise(resolve => setTimeout(resolve, 15000));
                
                // Trigger background processing without awaiting
                processTransactionDetails(signature, db).catch(err => {
                    console.error('Background processing failed:', err);
                });
            }

            // 4. Return signature status to client immediately
            return res.json(statusData);
        } else {
            // other RPC requests
            const response = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: req.body
            });
            const data = await response.json();
            res.json(data);
        }
    } catch (error) {
        console.error('RPC proxy error:', error);
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
        console.error('Failed to fetch burn stats:', error);
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

class MemoCache {
    constructor() {
        this.topAmountCache = [];    
        this.latestCache = [];       
        this.totalBurnCache = 0;
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

            this.topAmountCache = topAmount;
            this.latestCache = latest;
            this.totalBurnCache = totalBurn.amount;
            this.lastUpdateTime = Date.now();
            
            console.log('Cache updated:', {
                topAmount: topAmount.length,
                latest: latest.length,
                totalBurn: totalBurn.amount,
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
            const response = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "getTransaction",
                    params: [signature, { 
                        "encoding": "jsonParsed", 
                        "maxSupportedTransactionVersion": 0, 
                        "commitment": "finalized" 
                    }]
                })
            });
            const transactionData = await response.json();
            console.log('Transaction data received:', {
                status: transactionData.result ? 'success' : 'no result',
                error: transactionData.error,
                timestamp: new Date().toISOString()
            });

            if (!transactionData.result) {
                console.log('No result received, waiting 30 seconds before next attempt...');
                await new Promise(resolve => setTimeout(resolve, 30000));
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