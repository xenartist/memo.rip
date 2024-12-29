import { Connection, PublicKey, Keypair, Transaction, VoteProgram } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Configuration
const VOTE_ADDRESS = "VOTE_ADDRESS";
const REWARD_ADDRESS = "REWARD_ADDRESS";
const RATIO = 0.9;  // 90% to reward address
const RPC_URL = "RPC_URL";
const MIN_BALANCE = 0.03;
const LAMPORTS_PER_SOL = 1000000000;

async function withdrawVoteRewards() {
    try {
        // Initialize connection
        const connection = new Connection(RPC_URL);

        // Load withdrawer keypair
        const withdrawerPath = path.join(os.homedir(), '.config', 'solana', 'withdrawer.json');
        const withdrawerKeypair = Keypair.fromSecretKey(
            Buffer.from(JSON.parse(fs.readFileSync(withdrawerPath, 'utf-8')))
        );

        // Convert addresses to PublicKey
        const voteAccountPubkey = new PublicKey(VOTE_ADDRESS);
        const rewardAddressPubkey = new PublicKey(REWARD_ADDRESS);

        // Get vote account balance
        const voteBalance = await connection.getBalance(voteAccountPubkey);
        const voteBalanceInSol = voteBalance / LAMPORTS_PER_SOL;

        // Calculate withdrawable balance with 3 decimal places
        //const withdrawableBalance = Number((voteBalanceInSol - MIN_BALANCE).toFixed(3));
        const withdrawableBalance = Number((0.1 - MIN_BALANCE).toFixed(3)); //DEBUGGING PURPOSES

        // Calculate amounts with 3 decimal places
        const rewardAmount = Number((withdrawableBalance * RATIO).toFixed(3));
        const remainingAmount = Number((withdrawableBalance - rewardAmount).toFixed(3));

        // Convert back to lamports
        const rewardLamports = Math.floor(rewardAmount * LAMPORTS_PER_SOL);
        const remainingLamports = Math.floor(remainingAmount * LAMPORTS_PER_SOL);

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
        const finalVoteBalance = await connection.getBalance(voteAccountPubkey) / LAMPORTS_PER_SOL;
        const finalRewardBalance = await connection.getBalance(rewardAddressPubkey) / LAMPORTS_PER_SOL;
        const finalWithdrawerBalance = await connection.getBalance(withdrawerKeypair.publicKey) / LAMPORTS_PER_SOL;

        console.log("\nFinal state:");
        console.log(`Vote account balance: ${finalVoteBalance} SOL`);
        console.log(`Reward address balance: ${finalRewardBalance} SOL`);
        console.log(`Withdrawer balance: ${finalWithdrawerBalance} SOL`);

    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
}

withdrawVoteRewards(); 