import { WalletManager } from './wallet.js';

export class BurnDialog {
    constructor(walletManager, leaderboard, stats) {
        const { PublicKey, Connection } = solanaWeb3;

        this.connection = new Connection(
            window.location.origin + '/api/solana-rpc',
            'confirmed'
        );
        // solXEN token mint address
        this.tokenMint = new PublicKey('6f8deE148nynnSiWshA9vLydEbJGpDeKh5G4PRgjmzG7');
        // Token Program ID
        this.TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
        // Token decimals (assuming 6, we should fetch this from the token mint)
        this.TOKEN_DECIMALS = 6;

        this.walletManager = walletManager;
        this.leaderboard = leaderboard;
        this.stats = stats;

        this.initializeUI();
    }

    getTokenAmount(amount) {
        // Use window.BN from the global scope
        try {
            const rawAmount = amount * Math.pow(10, this.TOKEN_DECIMALS);
            return new window.BN(Math.floor(rawAmount));
        } catch (error) {
            console.error('Error in getTokenAmount:', error);
            throw new Error('Failed to convert amount');
        }
    }

    createBurnInstructionData(amount) {
        try {
            // Create a 9-byte array (1 byte for instruction, 8 bytes for amount)
            const data = new Uint8Array(9);
            
            // Set instruction index to 8 (burn instruction)
            data[0] = 8;
            
            // Convert amount to little-endian bytes and set in the array
            const tokenAmount = this.getTokenAmount(amount);
            console.log('Token amount:', tokenAmount.toString()); 
            
            const amountBytes = new Uint8Array(tokenAmount.toArray("le", 8));
            data.set(amountBytes, 1);
            
            return data;
        } catch (error) {
            console.error('Error in createBurnInstructionData:', error);
            throw new Error('Failed to create burn instruction');
        }
    }

    initializeEventListeners() {
        this.burnButton.addEventListener('click', () => this.showDialog());

        this.closeButton.addEventListener('click', () => this.hideDialog());
        this.cancelButton.addEventListener('click', () => this.hideDialog());
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.hideDialog();
            }
        });

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    showDialog() {
        if (!this.walletManager.walletState.connected) {
            alert('Please connect your wallet first');
            return;
        }
    
        this.dialog.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    }

    hideDialog() {
        this.setLoading(false);
        this.dialog.classList.add('hidden');
        document.body.style.overflow = ''; 
    }

    setLoading(isLoading) {
        const confirmBtn = document.getElementById('confirm-burn-btn');
        const loadingSpinner = document.getElementById('burn-loading');
        const cancelBtn = document.getElementById('cancel-burn');
        const closeBtn = document.getElementById('close-dialog');
        
        if (isLoading) {
            confirmBtn.disabled = true;
            cancelBtn.disabled = true;
            closeBtn.disabled = true;
            loadingSpinner.classList.remove('hidden');
            confirmBtn.querySelector('span').textContent = 'Processing...';
            
            this.dialog.classList.add('pointer-events-none');
            confirmBtn.classList.add('opacity-75');
        } else {
            confirmBtn.disabled = false;
            cancelBtn.disabled = false;
            closeBtn.disabled = false;
            loadingSpinner.classList.add('hidden');
            confirmBtn.querySelector('span').textContent = 'Confirm Burn';
            
            this.dialog.classList.remove('pointer-events-none');
            confirmBtn.classList.remove('opacity-75');
        }
    }

    async handleSubmit(e) {
        e.preventDefault();

        try {
            this.setLoading(true);

            const { Transaction, TransactionInstruction, SystemProgram, PublicKey } = solanaWeb3;

            // Get and validate form data
            const formData = {
                amount: parseFloat(document.getElementById('burn-amount').value),
                title: document.getElementById('memo-title').value,
                image: document.getElementById('memo-image').value,
                content: document.getElementById('memo-content').value,
                author: document.getElementById('memo-author').value
            };

            // Create memo content as JSON
            const memoContent = JSON.stringify({
                title: formData.title,
                image: formData.image,
                content: formData.content,
                author: formData.author
            });

            if (isNaN(formData.amount) || formData.amount <= 0) {
                throw new Error('Please enter a valid amount');
            }

            // Validate wallet
            const wallet = this.walletManager.detectWallet();
            if (!wallet || !this.walletManager.walletState.connected) {
                throw new Error('Please connect your wallet first');
            }

            const tokenAccounts = await this.connection.getTokenAccountsByOwner(
                new PublicKey(this.walletManager.walletState.address),
                {
                    mint: this.tokenMint
                }
            );

            const userTokenAccount = tokenAccounts.value[0].pubkey;
            console.log('User token account:', userTokenAccount);

            // Create burn instruction
            const burnInstruction = new TransactionInstruction({
                programId: this.TOKEN_PROGRAM_ID,
                keys: [
                    { pubkey: userTokenAccount, isSigner: false, isWritable: true },  // Token account
                    { pubkey: this.tokenMint, isSigner: false, isWritable: true },    // Token mint
                    { pubkey: new PublicKey(this.walletManager.walletState.address), isSigner: true, isWritable: false },  // Owner
                ],
                data: this.createBurnInstructionData(formData.amount)  
            });

            // Create memo instruction
            const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
            const memoInstruction = new TransactionInstruction({
                programId: MEMO_PROGRAM_ID,
                keys: [], // Memo program doesn't need any keys
                data: Buffer.from(memoContent)
            });

            console.log('Memo content:', memoContent);

            // Create and setup transaction
            const transaction = new Transaction();
            transaction.add(burnInstruction);
            transaction.add(memoInstruction);
            // Get latest blockhash
            const { blockhash } = await this.connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;
            transaction.feePayer = new PublicKey(this.walletManager.walletState.address);

            console.log('Requesting wallet approval...');
            console.log('Transaction:', transaction);
            console.log('Wallet:', wallet);

            // signAndSendTransaction
            const { signature } = await wallet.signAndSendTransaction(transaction);
            console.log('Transaction sent:', signature);

            // Wait for 10 seconds before checking status
            // console.log('Waiting 10 seconds before checking status...');
            // await new Promise(resolve => setTimeout(resolve, 5000));
            console.log('Starting status check...');

            const status = await this.connection.getSignatureStatus(signature);
            console.log('Transaction status:', status);

            if (status && !status.err) {
                alert(`Successfully burned ${formData.amount} solXEN!\nTransaction signature: ${signature}`);
                this.hideDialog();
    
                // await new Promise(resolve => setTimeout(resolve, 5000));
    
                await Promise.all([
                    this.refreshLeaderboards(),
                    this.refreshStats()
                ]);
            }

        } catch (error) {
            console.error('Burn failed:', error);
            alert(`Burn failed: ${error.message}`);
        } finally {
            this.setLoading(false);
        }
    }

    async refreshLeaderboards() {
        try {
            if (this.leaderboard) {
                const [topBurns, latestBurns] = await Promise.all([
                    this.leaderboard.fetchTopBurns(),
                    this.leaderboard.fetchLatestBurns()
                ]);
                this.leaderboard.renderTopBurns(topBurns);
                this.leaderboard.renderLatestBurns(latestBurns);
            }
        } catch (error) {
            console.error('Failed to refresh leaderboards:', error);
        }
    }

    async refreshStats() {
        try {
            if (this.stats) {
                await this.stats.fetchStats();
            }
        } catch (error) {
            console.error('Failed to refresh stats:', error);
        }
    }

    initializeUI() {
        this.dialog = document.getElementById('burn-dialog');
        this.form = document.getElementById('burn-form');
        this.burnButton = document.getElementById('burn-button');
        this.closeButton = document.getElementById('close-dialog');
        this.cancelButton = document.getElementById('cancel-burn');

        // character counter element
        this.charCounter = document.createElement('div');
        this.charCounter.className = 'text-sm text-gray-10 mt-2';
        this.form.appendChild(this.charCounter);

        this.initializeEventListeners();
        this.initializeCharCounter();
    }

    initializeCharCounter() {
        // Maximum length for memo instruction (548 bytes)
        const MAX_MEMO_LENGTH = 548;

        const BASE_JSON_LENGTH = 48;
        
        const updateCounter = () => {
            const memoContent = JSON.stringify({
                title: document.getElementById('memo-title').value,
                image: document.getElementById('memo-image').value,
                content: document.getElementById('memo-content').value,
                author: document.getElementById('memo-author').value
            });
            
            const currentLength = memoContent.length;
            const remainingChars = MAX_MEMO_LENGTH - currentLength;
            
            this.charCounter.textContent = `Characters remaining: ${remainingChars}/${MAX_MEMO_LENGTH - BASE_JSON_LENGTH}`;
            this.charCounter.style.color = remainingChars < 0 ? 'red' : 'inherit';
        };
    
        // Add input event listeners to all memo fields
        ['memo-title', 'memo-image', 'memo-content', 'memo-author'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateCounter);
        });
    
        // Initial counter update
        updateCounter();
    }
}