const winston = require('winston');
const { fetchRPC } = require('./utils');

const RATE_LIMIT_DELAY = 30000; // 30 seconds between requests

// configure logger
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
        new winston.transports.File({ filename: 'logs/db-checker-error.log', level: 'error' }),
        new winston.transports.Console()
    ]
});

class DbChecker {
    constructor(db) {
        this.db = db;
    }

    async processUncheckedTransactions(batchSize = 10) {
        try {
            // get unchecked transactions
            const transactions = await this.getUncheckedTransactions(batchSize);
            logger.info(`Found ${transactions.length} unchecked transactions`);

            if (transactions.length === 0) {
                logger.info('No pending transactions to process');
                return;
            }

            for (const tx of transactions) {
                try {
                    logger.info(`Processing transaction: ${tx.signature}`);
                    
                    // get transaction details
                    const transactionData = await fetchRPC({
                        jsonrpc: "2.0",
                        id: 1,
                        method: "getTransaction",
                        params: [tx.signature, { 
                            "encoding": "jsonParsed", 
                            "maxSupportedTransactionVersion": 0, 
                            "commitment": "finalized" 
                        }]
                    });

                    if (!transactionData.result) {
                        logger.warn(`No transaction data found for ${tx.signature}`);
                        continue;
                    }

                    // parse transaction data
                    const burnData = this.parseBurnTransactionData(transactionData.result);
                    
                    // update database
                    await this.updateTransactionDetails(burnData);
                    logger.info(`Successfully updated transaction ${tx.signature}`);

                    // add delay to comply with rate limit
                    if (transactions.indexOf(tx) < transactions.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY));
                    }

                } catch (error) {
                    logger.error(`Error processing transaction ${tx.signature}:`, error);
                }
            }

            logger.info(`Completed processing ${transactions.length} transactions`);

        } catch (error) {
            logger.error('Error in transaction processing:', error);
            throw error;
        }
    }

    async getUncheckedTransactions(limit) {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT signature 
                FROM burns 
                WHERE memo_checked IS NULL 
                OR memo_checked = ''
                LIMIT ?
            `;
            this.db.all(sql, [limit], (err, rows) => {
                if (err) {
                    logger.error('Database query error:', err);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    parseBurnTransactionData(transaction) {
        try {
            logger.info('Parsing transaction data...');

            // find burn instruction
            const burnInstruction = transaction.transaction.message.instructions.find(
                instruction => instruction.parsed?.type === 'burn' || instruction.parsed?.type === 'burnChecked'
            );

            if (!burnInstruction) {
                throw new Error('No burn instruction found in transaction');
            }

            // parse burn data
            const burnAmount = burnInstruction.parsed.info.amount;
            const burner = burnInstruction.parsed.info.authority;
            const token = burnInstruction.parsed.info.mint;
            const timestamp = transaction.blockTime;
            const signature = transaction.transaction.signatures[0];

            // find memo instruction
            const memoInstruction = transaction.transaction.message.instructions.find(
                instruction => instruction.program === 'spl-memo'
            );

            const memo = memoInstruction ? memoInstruction.parsed : null;

            return {
                signature,
                amount: burnAmount,
                burner,
                memo,
                token,
                timestamp,
            };
        } catch (error) {
            logger.error('Error parsing transaction data:', error);
            throw error;
        }
    }

    async updateTransactionDetails(burnData) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE burns 
                SET burner = ?,
                    amount = ?,
                    memo = ?,
                    token = ?,
                    timestamp = ?,
                    memo_checked = 'Y'
                WHERE signature = ?
            `;
            
            this.db.run(sql, [
                burnData.burner,
                burnData.amount,
                burnData.memo,
                burnData.token,
                burnData.timestamp,
                burnData.signature
            ], (err) => {
                if (err) {
                    logger.error('Database update error:', err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

// export module
module.exports = DbChecker;