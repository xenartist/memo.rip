const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Database paths
const rewardsDbPath = path.join(__dirname, 'data', 'rewards.db');
const burnsDbPath = path.join(__dirname, 'data', 'backup', 'burns.db');

// Check if database directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
    console.log('Created data directory');
}

// Initialize rewards database
const db = new sqlite3.Database(rewardsDbPath, (err) => {
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

    db.exec(createTableSQL, async (err) => {
        if (err) {
            console.error('Error creating rewards table:', err);
            process.exit(1);
        }
        console.log('Rewards database initialized successfully');

        // Get top burners from burns.db
        try {
            const topBurners = await getTopBurners();
            console.log('Found top burners:', topBurners.length);
            console.log('Top burners:', topBurners);
        } catch (error) {
            console.error('Error getting top burners:', error);
        }
        
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

// Function to get top burners from burns.db
function getTopBurners() {
    return new Promise((resolve, reject) => {
        const burnsDb = new sqlite3.Database(burnsDbPath, (err) => {
            if (err) {
                reject(new Error(`Error connecting to burns database: ${err.message}`));
                return;
            }

            const query = `
                SELECT burner, 
                       SUM(amount) as total_amount,
                       COUNT(*) as burn_count
                FROM burns 
                WHERE memo_checked = 'Y'
                GROUP BY burner
                HAVING SUM(amount) >= 420
                ORDER BY total_amount DESC 
                LIMIT 69
            `;

            burnsDb.all(query, [], (err, rows) => {
                if (err) {
                    burnsDb.close();
                    reject(new Error(`Error querying burns database: ${err.message}`));
                    return;
                }

                burnsDb.close(() => {
                    console.log('Burns database connection closed');
                });

                resolve(rows);
            });
        });
    });
}