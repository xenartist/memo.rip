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

        // 创建钱包按钮
        const button = document.createElement('button');
        button.textContent = 'Connect Wallet';
        button.className = 'wallet-button';
        button.onclick = () => this.handleWalletClick();
        container.appendChild(button);
    }

    async handleWalletClick() {
        if (this.walletState.connected) {
            await this.disconnectWallet();
        } else {
            await this.connectWallet();
        }
    }

    async connectWallet() {
        try {
            // 检查常见的 Solana 钱包
            const wallet = this.detectWallet();
            
            if (!wallet) {
                throw new Error('No Solana wallet found. Please install Phantom or Solflare wallet.');
            }

            // 请求连接钱包
            const response = await wallet.connect();
            
            // 获取公钥
            const publicKey = response.publicKey || wallet.publicKey;
            
            if (!publicKey) {
                throw new Error('Failed to get wallet public key');
            }

            this.walletState.connected = true;
            this.walletState.address = publicKey.toString();
            
            this.updateButtonState();
            
            console.log('Wallet connected:', this.walletState.address);
            
        } catch (error) {
            console.error('Error connecting wallet:', error);
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
                console.log('Wallet disconnected');
            }
        } catch (error) {
            console.error('Error disconnecting wallet:', error);
        }
    }

    detectWallet() {
        // 检查 Phantom 钱包
        if (window.phantom?.solana?.isPhantom) {
            return window.phantom.solana;
        }
        
        // 检查 Solflare 钱包
        if (window.solflare?.isSolflare) {
            return window.solflare;
        }

        // 检查通用 Solana 钱包
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