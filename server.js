const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;
// Solana RPC endpoint
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';
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
        // 1. check if it's a getTransaction request
        if (req.body.method === 'getTransaction') {
            // 2. forward to Solana RPC to get transaction details
            const response = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });
            const transactionData = await response.json();

            // 3. if it's a successful transaction and contains the information we care about, process the data
            if (transactionData.result && 
                isValidBurnTransaction(transactionData.result)) {  
                
                // 4. parse transaction data
                const memoData = parseMemoFromTransaction(transactionData.result);
                const burnAmount = parseBurnAmountFromTransaction(transactionData.result);
                
                // 5. insert into db
                await db.run(`
                    INSERT INTO memos (signature, title, image, content, author, amount, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    transactionData.result.transaction.signatures[0],
                    memoData.title,
                    memoData.image,
                    memoData.content,
                    memoData.author,
                    burnAmount,
                    Date.now()
                ]);

                // 6. invalidate cache
                memoCache.invalidateCache(db).catch(err => {
                    console.error('Cache update failed:', err);
                });
            }

            // 7. return the original Solana RPC response
            res.json(transactionData);
        } else {
            // other RPC requests
            const response = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
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
        const { totalBurn } = await memoCache.getTotalBurn(db);
        res.json({ totalBurn });
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

function isValidBurnTransaction(transaction) {
    // validate if it's a burn transaction we care about
    // check programID, instruction, etc.
    return true; // return true based on actual logic
}

function parseMemoFromTransaction(transaction) {
    // parse memo data from transaction
    // return parsed memo object
}

function parseBurnAmountFromTransaction(transaction) {
    // parse burn amount from transaction
    // return parsed amount
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});