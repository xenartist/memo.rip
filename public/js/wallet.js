export class WalletManager {
    constructor() {
        this.initWallet();
        this.walletState = {
            connected: false,
            address: null
        };
    }

    initWallet() {
        const container = document.getElementById('wallet-container');
        if (!container) {
            console.error('Wallet container not found');
            return;
        }

        // Create wrapper div for button and dropdown
        const wrapper = document.createElement('div');
        wrapper.className = 'wallet-wrapper relative';


        const button = document.createElement('button');
        button.textContent = 'Connect Wallet';
        button.className = 'wallet-button';
        button.addEventListener('click', (e) => this.handleWalletClick(e));
        
        // Create dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'wallet-dropdown hidden absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5';
        
        wrapper.appendChild(button);
        wrapper.appendChild(dropdown);
        container.appendChild(wrapper);

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                dropdown.classList.add('hidden');
            }
        });
    }

    async handleWalletClick(event) {
        event.stopPropagation();
        const dropdown = document.querySelector('.wallet-dropdown');
        
        dropdown.innerHTML = '';
        
        if (this.walletState.connected) {
            const logoutItem = document.createElement('div');
            logoutItem.className = 'wallet-option px-4 py-2 text-sm text-red-600 hover:bg-gray-100 cursor-pointer flex items-center';
            
            const icon = document.createElement('svg');
            icon.className = 'w-5 h-5 mr-2';
            icon.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            `;
            logoutItem.appendChild(icon);
            
            const text = document.createElement('span');
            text.textContent = 'Logout';
            logoutItem.appendChild(text);
            
            logoutItem.onclick = () => this.disconnectWallet();
            
            dropdown.appendChild(logoutItem);
        } else {
            const availableWallets = this.detectAvailableWallets();
            
            if (availableWallets.length === 0) {
                const message = document.createElement('div');
                message.className = 'px-4 py-2 text-sm text-gray-700';
                message.textContent = 'No wallets found. Please install Phantom, Solflare, or Backpack.';
                dropdown.appendChild(message);
            } else {
                availableWallets.forEach(wallet => {
                    const item = document.createElement('div');
                    item.className = 'wallet-option px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer flex items-center';
                    
                    // Add wallet icon if available
                    const icon = document.createElement('img');
                    icon.src = this.getWalletIcon(wallet.name);
                    icon.className = 'w-5 h-5 mr-2';
                    item.appendChild(icon);
                    
                    // Add wallet name
                    const name = document.createElement('span');
                    name.textContent = wallet.name;
                    item.appendChild(name);
                    
                    item.onclick = () => this.connectToWallet(wallet.instance);
                    dropdown.appendChild(item);
                });
            }
        }
        
        // Toggle dropdown visibility
        dropdown.classList.toggle('hidden');
    }

    detectAvailableWallets() {
        const wallets = [];
        
        if (window.phantom?.solana?.isPhantom) {
            wallets.push({ name: 'Phantom', instance: window.phantom.solana });
        }
        
        if (window.solflare?.isSolflare) {
            wallets.push({ name: 'Solflare', instance: window.solflare });
        }
        
        if (window.backpack?.isBackpack) {
            wallets.push({ name: 'Backpack', instance: window.backpack });
        }

        console.log('Available wallets:', wallets.map(w => w.name));
        return wallets;
    }

    getWalletIcon(walletName) {
        // Return appropriate icon URL for each wallet
        switch (walletName.toLowerCase()) {
            case 'phantom':
                return '../img/phantom-favicon.ico';
            case 'solflare':
                return 'https://solflare.com/favicon.ico';
            case 'backpack':
                return 'https://www.backpack.app/favicon.ico';
            default:
                return 'default-wallet-icon.png';
        }
    }

    async connectToWallet(wallet) {
        try {
            const response = await wallet.connect();
            const publicKey = response.publicKey || wallet.publicKey;
            
            if (!publicKey) {
                throw new Error('Failed to get wallet public key');
            }

            this.wallet = wallet; // Store the connected wallet instance
            this.walletState.connected = true;
            this.walletState.address = publicKey.toString();
            
            this.updateButtonState();
            
            // Hide dropdown after connection
            document.querySelector('.wallet-dropdown').classList.add('hidden');
            
            console.log('Connected to wallet:', {
                name: wallet.isSolflare ? 'Solflare' : wallet.isPhantom ? 'Phantom' : 'Backpack',
                address: this.walletState.address
            });
            
        } catch (error) {
            console.error('Error connecting to wallet:', error);
            alert(error.message);
        }
    }

    async disconnectWallet() {
        try {
            const wallet = this.detectWallet();
            if (wallet) {
                await wallet.disconnect();
                
                this.walletState.connected = false;
                this.walletState.address = null;
                
                this.updateButtonState();
                const dropdown = document.querySelector('.wallet-dropdown');
                dropdown.classList.add('hidden');
                
                console.log('Wallet disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
        }
    }

    detectWallet() {
        console.log('Checking wallets:', {
            phantom: window.phantom?.solana,
            solflare: window.solflare
        });
        // Phantom wallet
        if (window.phantom?.solana?.isPhantom) {
            return window.phantom.solana;
        }
        
        // Solflare wallet
        if (window.solflare?.isSolflare) {
            return window.solflare;
        }

        // Backpack wallet
        if (window.backpack?.isBackpack) {
            return window.backpack;
        }

        // general solana wallet
        if (window.solana?.isConnected) {
            return window.solana;
        }

        return null;
    }

    updateButtonState() {
        const button = document.querySelector('.wallet-button');
        if (this.walletState.connected && this.walletState.address) {
            const shortAddress = `${this.walletState.address.slice(0, 6)}...${this.walletState.address.slice(-4)}`;
            button.textContent = `Connected: ${shortAddress}`;
            button.classList.add('connected');
        } else {
            button.textContent = 'Connect Wallet';
            button.classList.remove('connected');
        }
    }
}