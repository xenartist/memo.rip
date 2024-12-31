const sqlite3 = require('sqlite3').verbose();
const { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const path = require('path');
const fs = require('fs');

// Load configuration
const configPath = path.join(__dirname, '..', 'config', 'distribute-reward-toptotal.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const { RPC_URL, MIN_REWARD_BALANCE, MIN_KEEP_BALANCE, MIN_REWARD_AMOUNT, DB_PATHS } = config;

// Database paths
const rewardsDbPath = path.join(__dirname, '..', DB_PATHS.REWARDS_DB);
const burnsDbPath = path.join(__dirname, '..', DB_PATHS.BURNS_DB);

// Check if database directory exists
const rewardsDir = path.dirname(rewardsDbPath);
if (!fs.existsSync(rewardsDir)) {
    fs.mkdirSync(rewardsDir, { recursive: true });
    console.log('Created rewards database directory');
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

        db.close();
    });
});

// Add SOL token address constant
const SOL_TOKEN_ADDRESS = "So11111111111111111111111111111111111111112";

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
        // Check initial balance
        const initialBalance = Math.floor(await connection.getBalance(rewardKeypair.publicKey) / LAMPORTS_PER_SOL);
        console.log(`Initial reward wallet balance: ${initialBalance} SOL`);

        if (initialBalance < MIN_REWARD_BALANCE) {
            console.log(`Insufficient balance in reward wallet. Minimum required: ${MIN_REWARD_BALANCE} SOL`);
            console.log('Will try again at next scheduled time');
            return;
        }

        // Get total distributable amount
        const distributableAmount = Math.floor(initialBalance - MIN_KEEP_BALANCE);
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

                // Get new blockhash
                const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                transaction.feePayer = rewardKeypair.publicKey;

                // Send transaction
                const signature = await connection.sendTransaction(
                    transaction,
                    [rewardKeypair]
                );

                // Wait for confirmation
                const confirmation = await connection.confirmTransaction({
                    signature,
                    blockhash,
                    lastValidBlockHeight
                }, 'confirmed');

                if (confirmation.value.err) {
                    throw new Error('Transaction failed');
                }

                // Record in database
                await recordReward(db, signature, burner.burner, rewardAmount);
                
                console.log(`Reward sent successfully. Signature: ${signature}`);
                
                // Add delay between transactions
                await new Promise(resolve => setTimeout(resolve, 10000));

            } catch (error) {
                console.error(`Error processing reward for ${burner.burner}:`, error);
                // Retry after 10 seconds on error
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            }
        }

        // Check final balance after distribution
        const finalBalance = Math.floor(await connection.getBalance(rewardKeypair.publicKey) / LAMPORTS_PER_SOL);
        console.log(`\nDistribution completed.`);
        console.log(`Final reward wallet balance: ${finalBalance} SOL`);
        console.log(`Total distributed (including transaction fee): ${initialBalance - finalBalance} SOL`);

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
            VALUES (?, ?, ?, ?)
        `;
        
        db.run(sql, [signature, burner, amount, SOL_TOKEN_ADDRESS], (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

async function getNextRunTime(scheduleTime) {
    const [hours, minutes, seconds] = scheduleTime.split(':').map(Number);
    
    const now = new Date();
    let next = new Date(now);
    
    next.setUTCHours(hours, minutes, seconds, 0);
    
    if (now >= next) {
        next.setUTCDate(next.getUTCDate() + 1);
    }
    
    return next;
}

async function startDistributionService() {
    console.log(`Starting reward distribution service.`);
    console.log(`Scheduled for ${config.SCHEDULE_UTC_TIME} UTC daily`);

    const runScheduledTask = async () => {
        try {
            const now = new Date();
            console.log(`\n${now.toISOString()} - Starting scheduled distribution`);

            // Initialize connection and load reward keypair
            const connection = new Connection(RPC_URL);
            const rewardKeypair = Keypair.fromSecretKey(
                Buffer.from(JSON.parse(fs.readFileSync(
                    path.join(process.env.HOME, '.config/solana/reward.json')
                )))
            );

            // Initialize database
            const db = new sqlite3.Database(rewardsDbPath);
            
            // Get top burners and distribute rewards
            const topBurners = await getTopBurners();
            console.log('Found top burners:', topBurners.length);
            
            if (topBurners.length > 0) {
                await distributeRewards(connection, rewardKeypair, topBurners, db);
            }

            // Close database
            db.close();
            
            // Schedule next run
            const nextRun = await getNextRunTime(config.SCHEDULE_UTC_TIME);
            const delay = nextRun.getTime() - Date.now();
            
            setTimeout(runScheduledTask, delay);
            
            console.log(`Next distribution scheduled for: ${nextRun.toISOString()}`);
        } catch (error) {
            console.error('Error in scheduled task:', error);
            // Retry after 1 hour on error
            setTimeout(runScheduledTask, 60 * 60 * 1000);
        }
    };

    // Calculate first run time
    const firstRun = await getNextRunTime(config.SCHEDULE_UTC_TIME);
    const initialDelay = firstRun.getTime() - Date.now();
    
    console.log(`First distribution scheduled for: ${firstRun.toISOString()}`);
    setTimeout(runScheduledTask, initialDelay);
}

// Start the service
startDistributionService().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
});