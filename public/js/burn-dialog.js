import { WalletManager } from './wallet.js';
import { PixelDraw } from './pixel-draw.js';

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

        this.imagePreviewContainer = null;
        this.imagePreview = null;
        this.imagePreviewError = null;
        this.imagePreviewTimeout = null;

        this.pixelDraw = new PixelDraw();

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

        document.getElementById('confirm-burn-btn').addEventListener('click', (e) => {
            e.preventDefault();
            this.handleSubmit(e);
        });

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async showDialog() {
        if (!this.walletManager.walletState.connected) {
            alert('Please connect your wallet first');
            return;
        }

        // Show disclaimer modal first
        const agreed = await this.showDisclaimerModal();
        if (!agreed) {
            return;
        }
    
        this.dialog.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    showDisclaimerModal() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
            modal.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full mx-4 p-6">
                    <div class="space-y-4">
                        <h3 class="text-xl font-bold text-gray-900 dark:text-white text-center">IMPORTANT NOTICE</h3>
                        <div class="space-y-4 text-gray-600 dark:text-gray-300">
                            <div>
                                <h4 class="font-semibold mb-1">Content Source and Responsibility</h4>
                                <p>All content displayed on this website is sourced from decentralized on-chain data from the Solana blockchain or third-party image hyperlinks. The website itself does not store any content. If you identify infringing information, please contact us, and we will take steps to block it on the frontend.</p>
                            </div>
                            
                            <div>
                                <h4 class="font-semibold mb-1">User Privacy Protection</h4>
                                <p>Memo information created on memo.rip is public and stored in plain text on the Solana blockchain. Users are advised to protect their privacy and avoid sharing sensitive or confidential information.</p>
                            </div>
                            
                            <div>
                                <h4 class="font-semibold mb-1 text-red-500">Risk Warning</h4>
                                <p class="text-red-500">Burning solXEN carries inherent risks. Users are strongly encouraged to exercise caution and make informed decisions after thorough understanding.</p>
                            </div>
                        </div>
                        <div class="text-center text-gray-500">Time remaining: <span id="disclaimer-countdown">30</span>s</div>
                        <div class="flex justify-center gap-4">
                            <button class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700" id="disclaimer-agree">I Understand & Agree</button>
                            <button class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700" id="disclaimer-disagree">Disagree</button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            let countdown = 30;
            const countdownEl = modal.querySelector('#disclaimer-countdown');
            const timer = setInterval(() => {
                countdown--;
                countdownEl.textContent = countdown;
                if (countdown <= 0) {
                    clearInterval(timer);
                    modal.remove();
                    resolve(false);
                }
            }, 1000);

            modal.querySelector('#disclaimer-disagree').addEventListener('click', () => {
                clearInterval(timer);
                modal.remove();
                resolve(false);
            });

            modal.querySelector('#disclaimer-agree').addEventListener('click', () => {
                clearInterval(timer);
                modal.remove();
                resolve(true);
            });
        });
    }

    hideDialog() {
        this.setLoading(false);
        this.dialog.classList.add('hidden');
        document.body.style.overflow = ''; 
        this.hideImagePreview(); // reset image preview
        this.form.reset(); // reset form
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
                image: document.getElementById('image-url-content').classList.contains('hidden') 
                    ? `pixel:32x32,0x${this.pixelDraw.getPixelData()}`  // Pixel data with format info
                    : document.getElementById('memo-image').value,
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
            console.log('Waiting 10 seconds before checking status...');
            await new Promise(resolve => setTimeout(resolve, 10000));
            console.log('Starting status check...');

            const status = await this.connection.getSignatureStatus(signature, {
                searchTransactionHistory: true
            });
            console.log('Transaction status:', status);

            if (status && !status.err) {
                alert(`Successfully burned ${formData.amount} solXEN!\nTransaction signature: ${signature}`);
                this.hideDialog();
    
                await new Promise(resolve => setTimeout(resolve, 60000));
    
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
                const [topBurns, latestBurns, topTotalBurns] = await Promise.all([
                    this.leaderboard.fetchTopBurns(),
                    this.leaderboard.fetchLatestBurns(),
                    this.leaderboard.fetchTopTotalBurns()
                ]);
                this.leaderboard.renderTopBurns(topBurns);
                this.leaderboard.renderLatestBurns(latestBurns);
                this.leaderboard.renderTopTotalBurns(topTotalBurns);
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

        this.imagePreviewContainer = document.getElementById('image-preview-container');
        this.imagePreview = document.getElementById('image-preview');
        this.imagePreviewError = document.getElementById('image-preview-error');

        this.initializeEventListeners();
        this.initializeCharCounter();
        this.initializeImagePreview();
    }

    initializeCharCounter() {
        // Maximum length for memo instruction (548 bytes)
        const MAX_MEMO_LENGTH = 548;
        const BASE_JSON_LENGTH = 48;
        const PIXEL_PREFIX = "pixel:32x32,0x"; // pixel data prefix in hex string format
        const PIXEL_DATA_LENGTH = 256; // 32x32 pixel data in hex string format
        
        const updateCounter = () => {
            const isPixelDrawTab = document.getElementById('image-url-content').classList.contains('hidden');
            
            const memoContent = JSON.stringify({
                title: document.getElementById('memo-title').value,
                image: isPixelDrawTab ? 
                    PIXEL_PREFIX + "0".repeat(PIXEL_DATA_LENGTH) : // pixel data length
                    document.getElementById('memo-image').value,
                content: document.getElementById('memo-content').value,
                author: document.getElementById('memo-author').value
            });
            
            const currentLength = memoContent.length;
            const remainingChars = MAX_MEMO_LENGTH - currentLength;
            
            const charCounter = document.getElementById('char-counter');
            charCounter.textContent = `Characters remaining: ${remainingChars}/${MAX_MEMO_LENGTH - BASE_JSON_LENGTH}`;
            charCounter.style.color = remainingChars < 0 ? 'red' : 'inherit';
        };
    
        // Add input event listeners to all memo fields
        ['memo-title', 'memo-image', 'memo-content', 'memo-author'].forEach(id => {
            document.getElementById(id).addEventListener('input', updateCounter);
        });

        // Add tab switch listeners
        document.getElementById('tab-image-url').addEventListener('click', updateCounter);
        document.getElementById('tab-pixel-draw').addEventListener('click', updateCounter);
    
        // Initial counter update
        updateCounter();
    }

    initializeImagePreview() {
        const imageInput = document.getElementById('memo-image');
        
        imageInput.addEventListener('input', () => {
            // clear previous timeout
            if (this.imagePreviewTimeout) {
                clearTimeout(this.imagePreviewTimeout);
            }

            // set new timeout (preview after 500ms of user stop typing)
            this.imagePreviewTimeout = setTimeout(() => {
                const url = imageInput.value.trim();
                
                if (!url) {
                    this.hideImagePreview();
                    return;
                }

                this.previewImage(url);
            }, 500);
        });

        // image load error handling
        this.imagePreview.addEventListener('error', () => {
            this.showImageError();
        });
    }

    previewImage(url) {
        // reset preview state
        this.imagePreviewError.classList.add('hidden');
        this.imagePreviewContainer.classList.remove('hidden');
        this.imagePreview.classList.remove('hidden');

        // check URL format
        try {
            new URL(url);
        } catch {
            this.showImageError();
            return;
        }

        // set image source
        this.imagePreview.src = url;
    }

    showImageError() {
        this.imagePreview.classList.add('hidden');
        this.imagePreviewError.classList.remove('hidden');
        this.imagePreviewContainer.classList.remove('hidden');
    }

    hideImagePreview() {
        this.imagePreviewContainer.classList.add('hidden');
        this.imagePreview.classList.add('hidden');
        this.imagePreviewError.classList.add('hidden');
    }
}