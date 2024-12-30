import { Connection, PublicKey, Keypair, Transaction, VoteProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get config file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const configPath = path.join(__dirname, '..', 'config', 'withdraw-vote.json');

// Load configuration
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

async function withdrawVoteRewards() {
    try {
        // Initialize connection
        const connection = new Connection(config.RPC_URL);

        // Load withdrawer keypair
        const withdrawerPath = path.join(os.homedir(), '.config', 'solana', 'withdrawer.json');
        const withdrawerKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(withdrawerPath, 'utf-8')))
        );

        // Convert addresses to PublicKey
        const voteAccountPubkey = new PublicKey(config.VOTE_ADDRESS);
        const rewardAddressPubkey = new PublicKey(config.REWARD_ADDRESS);

        // Get vote account balance
        const voteBalance = await connection.getBalance(voteAccountPubkey);
        const voteBalanceInSol = voteBalance / config.LAMPORTS_PER_SOL;

        // Calculate withdrawable balance with 3 decimal places
        const withdrawableBalance = Number((voteBalanceInSol - config.MIN_BALANCE).toFixed(3));

        // Calculate amounts with 3 decimal places
        const rewardAmount = Number((withdrawableBalance * config.RATIO).toFixed(3));
        const remainingAmount = Number((withdrawableBalance - rewardAmount).toFixed(3));

        // Convert back to lamports
        const rewardLamports = Math.floor(rewardAmount * config.LAMPORTS_PER_SOL);
        const remainingLamports = Math.floor(remainingAmount * config.LAMPORTS_PER_SOL);

        // Show initial state
        console.log("Initial state:");
        console.log(`Vote account balance: ${voteBalanceInSol} SOL`);
        console.log(`Withdrawable balance: ${withdrawableBalance} SOL`);
        console.log(`Amount to reward address (90%): ${rewardAmount} SOL`);
        console.log(`Amount to withdrawer (10%): ${remainingAmount} SOL`);

        // First withdrawal: to reward address
        console.log(`\nWithdrawing ${rewardAmount} SOL to reward address...`);
        const firstTx = new Transaction().add(
            VoteProgram.withdraw({
                votePubkey: voteAccountPubkey,
                authorizedWithdrawerPubkey: withdrawerKeypair.publicKey,
                lamports: rewardLamports,
                toPubkey: rewardAddressPubkey
            })
        );

        // First withdrawal
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        firstTx.recentBlockhash = blockhash;
        firstTx.feePayer = withdrawerKeypair.publicKey;

        const firstSignature = await connection.sendTransaction(
            firstTx,
            [withdrawerKeypair]
        );

        await connection.confirmTransaction({
            signature: firstSignature,
            blockhash,
            lastValidBlockHeight
        });
        console.log("First withdrawal successful");

        // Wait for 60 seconds
        console.log("\nWaiting 60 seconds before second withdrawal...");
        await new Promise(resolve => setTimeout(resolve, 60000));

        // Second withdrawal: to withdrawer
        console.log(`\nWithdrawing ${remainingAmount} SOL to withdrawer...`);
        const secondTx = new Transaction().add(
            VoteProgram.withdraw({
                votePubkey: voteAccountPubkey,
                authorizedWithdrawerPubkey: withdrawerKeypair.publicKey,
                lamports: remainingLamports,
                toPubkey: withdrawerKeypair.publicKey
            })
        );

        const newBlockhash = await connection.getLatestBlockhash();
        secondTx.recentBlockhash = newBlockhash.blockhash;
        secondTx.feePayer = withdrawerKeypair.publicKey;

        const secondSignature = await connection.sendTransaction(
            secondTx,
            [withdrawerKeypair]
        );

        await connection.confirmTransaction({
            signature: secondSignature,
            blockhash: newBlockhash.blockhash,
            lastValidBlockHeight: newBlockhash.lastValidBlockHeight
        });
        console.log("Second withdrawal successful");

        // Show final balances
        const finalVoteBalance = await connection.getBalance(voteAccountPubkey) / config.LAMPORTS_PER_SOL;
        const finalRewardBalance = await connection.getBalance(rewardAddressPubkey) / config.LAMPORTS_PER_SOL;
        const finalWithdrawerBalance = await connection.getBalance(withdrawerKeypair.publicKey) / config.LAMPORTS_PER_SOL;

        console.log("\nFinal state:");
        console.log(`Vote account balance: ${finalVoteBalance} SOL`);
        console.log(`Reward address balance: ${finalRewardBalance} SOL`);
        console.log(`Withdrawer balance: ${finalWithdrawerBalance} SOL`);

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
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

async function startWithdrawService() {
    console.log(`Starting reward distribution service.`);
    console.log(`Scheduled for ${config.SCHEDULE_UTC_TIME} UTC daily`);

    const runScheduledTask = async () => {
        try {
            const now = new Date();
            console.log(`\n${now.toISOString()} - Starting scheduled distribution`);
            await withdrawVoteRewards();
            
            const nextRun = await getNextRunTime(config.SCHEDULE_UTC_TIME);
            const delay = nextRun.getTime() - Date.now();
            
            setTimeout(runScheduledTask, delay);
            
            console.log(`Next run scheduled for: ${nextRun.toISOString()}`);
        } catch (error) {
            console.error('Error in scheduled task:', error);
            setTimeout(runScheduledTask, 60 * 60 * 1000);
        }
    };

    const firstRun = await getNextRunTime(config.SCHEDULE_UTC_TIME);
    const initialDelay = firstRun.getTime() - Date.now();
    
    console.log(`First run scheduled for: ${firstRun.toISOString()}`);
    setTimeout(runScheduledTask, initialDelay);
}

// Start the service
startWithdrawService().catch(error => {
    console.error("Fatal error:", error);
    process.exit(1);
}); 