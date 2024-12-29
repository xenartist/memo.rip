const sqlite3 = require('sqlite3').verbose();
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const path = require('path');
const fs = require('fs');

// Configuration
const RPC_URL = "RPC_URL";
const MIN_REWARD_BALANCE = 5; // Minimum SOL needed in reward wallet
const MIN_KEEP_BALANCE = 1;   // Minimum SOL to keep in reward wallet
const MIN_REWARD_AMOUNT = 0.001; // Minimum reward amount per recipient

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

        // Initialize connection and load reward keypair
        const connection = new Connection(RPC_URL);
        const rewardKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(
                path.join(process.env.HOME, '.config/solana/reward.json')
            )))
        );

        // Get top burners from burns.db
        try {
            const topBurners = await getTopBurners();
            console.log('Found top burners:', topBurners.length);
            
            if (topBurners.length > 0) {
                await distributeRewards(connection, rewardKeypair, topBurners, db);
            }
            
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

// Function to distribute rewards
async function distributeRewards(connection, rewardKeypair, topBurners, db) {
    try {
        // Check reward wallet balance
        const rewardBalance = await connection.getBalance(rewardKeypair.publicKey) / LAMPORTS_PER_SOL;
        console.log(`Reward wallet balance: ${rewardBalance} SOL`);

        if (rewardBalance < MIN_REWARD_BALANCE) {
            throw new Error(`Insufficient balance in reward wallet. Minimum required: ${MIN_REWARD_BALANCE} SOL`);
        }

        // Get total distributable amount
        const distributableAmount = rewardBalance - MIN_KEEP_BALANCE;
        console.log(`Distributable amount: ${distributableAmount} SOL`);

        // Calculate total burn amount
        const totalBurnAmount = topBurners.reduce((sum, burner) => sum + burner.total_amount, 0);
        console.log(`Total burn amount: ${totalBurnAmount}`);

        // Process each burner
        for (const burner of topBurners) {
            try {
                // Calculate reward amount
                let rewardAmount = (burner.total_amount / totalBurnAmount) * distributableAmount;
                
                // Round to 3 decimal places
                rewardAmount = Math.round(rewardAmount * 1000) / 1000;
                
                // Apply minimum reward amount
                if (rewardAmount < MIN_REWARD_AMOUNT) {
                    rewardAmount = MIN_REWARD_AMOUNT;
                }

                console.log(`Processing reward for ${burner.burner}: ${rewardAmount} SOL (${burner.total_amount} burned)`);

                // Create and send transaction
                const transaction = new Transaction();
                transaction.add(
                    SystemProgram.transfer({
                        fromPubkey: rewardKeypair.publicKey,
                        toPubkey: new PublicKey(burner.burner),
                        lamports: Math.round(rewardAmount * LAMPORTS_PER_SOL)
                    })
                );

                // Get recent blockhash
                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = rewardKeypair.publicKey;

                // Send and confirm transaction
                const signature = await connection.sendTransaction(
                    transaction,
                    [rewardKeypair],
                    { preflightCommitment: 'confirmed' }
                );

                // Wait for confirmation
                const confirmation = await connection.confirmTransaction({
                    signature,
                    blockhash,
                    lastValidBlockHeight: await connection.getBlockHeight()
                });

                if (confirmation.value.err) {
                    throw new Error('Transaction failed');
                }

                // Record in database
                await recordReward(db, signature, burner.burner, rewardAmount);
                
                console.log(`Reward sent successfully. Signature: ${signature}`);
                
                // Add delay between transactions
                await new Promise(resolve => setTimeout(resolve, 60000));

            } catch (error) {
                console.error(`Error processing reward for ${burner.burner}:`, error);
                // Continue with next burner
            }
        }

    } catch (error) {
        console.error('Error in reward distribution:', error);
        throw error;
    }
}

// Function to record reward in database
function recordReward(db, signature, burner, amount) {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO rewards (signature, burner, amount, token)
            VALUES (?, ?, ?, 'SOL')
        `;
        
        db.run(sql, [signature, burner, amount], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}