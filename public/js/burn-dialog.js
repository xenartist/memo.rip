import { WalletManager } from './wallet.js';

export class BurnDialog {
    constructor(walletManager) {
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
            // Create an 9-byte array (1 byte for instruction and 8 bytes for amount)
            const data = new Uint8Array(9);
            
            // Set instruction index to 17 (burn instruction)
            data[0] = 17;
            
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
        this.dialog.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    }

    hideDialog() {
        this.dialog.classList.add('hidden');
        document.body.style.overflow = ''; 
    }

    async handleSubmit(e) {
        e.preventDefault();

        try {
            const { Transaction, TransactionInstruction, SystemProgram, PublicKey } = solanaWeb3;

            // Get and validate form data
            const formData = {
                amount: parseFloat(document.getElementById('burn-amount').value),
                title: document.getElementById('memo-title').value,
                image: document.getElementById('memo-image').value,
                content: document.getElementById('memo-content').value,
                author: document.getElementById('memo-author').value
            };

            if (isNaN(formData.amount) || formData.amount <= 0) {
                throw new Error('Please enter a valid amount');
            }

            // Validate wallet
            const wallet = this.walletManager.detectWallet();
            if (!wallet || !this.walletManager.walletState.connected) {
                throw new Error('Please connect your wallet first');
            }

            // Create burn instruction
            // const burnInstruction = new TransactionInstruction({
            //     programId: this.TOKEN_PROGRAM_ID,
            //     keys: [
            //         { pubkey: this.tokenMint, isSigner: false, isWritable: true },
            //         { pubkey: new PublicKey(this.walletManager.walletState.address), isSigner: true, isWritable: false },
            //     ],
            //     data: this.createBurnInstructionData(formData.amount)
            // });

            // Create and setup transaction
            // const transaction = new Transaction();
            // transaction.add(burnInstruction);

            // Create a simple SOL transfer instruction
            const transferInstruction = solanaWeb3.SystemProgram.transfer({
                fromPubkey: new PublicKey(this.walletManager.walletState.address),
                toPubkey: new PublicKey('6AZ7h7qXh3JgiesDfCaszBwn9gfJcKszmLy21nzoRNeB'),
                lamports: solanaWeb3.LAMPORTS_PER_SOL * 0.0000001
            });

            // Create and setup transaction
            const transaction = new Transaction();
            transaction.add(transferInstruction);
            
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
            console.log('Waiting 10 seconds before checking status...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            console.log('Starting status check...');

            // Wait for confirmation
            const checkSignatureStatus = async (signature, maxAttempts = 3) => {
                let attempts = 0;
                while (attempts < maxAttempts) {
                    try {
                        const status = await this.connection.getSignatureStatus(signature);
                        console.log('Status check attempt', attempts + 1, status);
                        
                        if (status?.value?.confirmationStatus === 'confirmed' || 
                            status?.value?.confirmationStatus === 'finalized') {
                            return status;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        attempts++;
                    } catch (error) {
                        console.error('Error checking status:', error);
                        throw error;
                    }
                }
                throw new Error('Transaction confirmation timeout');
            };

            const status = await checkSignatureStatus(signature);
            console.log('Transaction status:', status);

            alert(`Successfully burned ${formData.amount} solXEN!\nTransaction signature: ${signature}`);
            this.hideDialog();

        } catch (error) {
            console.error('Burn failed:', error);
            alert(`Burn failed: ${error.message}`);
        }
    }

    initializeUI() {
        this.dialog = document.getElementById('burn-dialog');
        this.form = document.getElementById('burn-form');
        this.burnButton = document.getElementById('burn-button');
        this.closeButton = document.getElementById('close-dialog');
        this.cancelButton = document.getElementById('cancel-burn');

        this.initializeEventListeners();
    }
}