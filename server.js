const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));
app.use('/api/solana-rpc', express.raw({ type: 'application/json' }));

// Solana RPC endpoint
const SOLANA_RPC = 'https://api.mainnet-beta.solana.com';

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
        console.log('Received request body:', req.body.toString());

        const response = await fetch(SOLANA_RPC, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: req.body
        });
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('RPC Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Route to get burn data
app.get('/api/burns', (req, res) => {
    const db = new sqlite3.Database('./data/solxen-burns.db', (err) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Failed to connect to database' });
        }
    });

    db.get("SELECT SUM(amount) as totalBurn FROM burns", [], (err, row) => {
        if (err) {
            console.error(err.message);
            return res.status(500).json({ error: 'Failed to fetch data' });
        }

        const totalBurn = Math.floor((row.totalBurn || 0) / 1_000_000);
        const totalSupply = 58294721418;
        const burnPercentage = (totalBurn / totalSupply) * 100;

        res.json({
            totalBurn,
            burnPercentage
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

process.on('SIGTERM', () => {
    db.close();
    process.exit(0);
});