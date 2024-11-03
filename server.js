const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = 3000;

// Serve static files
app.use(express.static('public'));

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