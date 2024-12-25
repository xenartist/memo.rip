const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database path
const dbPath = path.join(__dirname, 'data', 'rewards.db');

// Check if database directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
    console.log('Created data directory');
}

// Create/connect to database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to rewards database:', err);
        process.exit(1);
    }
    console.log('Connected to rewards database');

    // Create table if it doesn't exist
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS rewards (
            signature TEXT PRIMARY KEY,
            burner TEXT NOT NULL,
            amount DECIMAL(20,9) NOT NULL,
            token TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `;

    db.exec(createTableSQL, (err) => {
        if (err) {
            console.error('Error creating rewards table:', err);
            process.exit(1);
        }
        console.log('Rewards database initialized successfully');
        
        // Close database connection
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
                process.exit(1);
            }
            console.log('Database connection closed');
        });
    });
});