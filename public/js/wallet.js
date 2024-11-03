const WalletComponent = () => {
    const { UnifiedWalletProvider, UnifiedWalletButton } = window.UnifiedWalletAdapter;

    return React.createElement(UnifiedWalletProvider, {
        wallets: [],
        config: {
            autoConnect: false,
            env: "mainnet-beta",
            metadata: {
                name: "solXEN Burn",
                description: "solXEN Token Burn Statistics",
                url: window.location.origin,
                iconUrls: [`${window.location.origin}/favicon.ico`],
            },
            notificationCallback: {},
            walletlistExplanation: {
                href: "https://station.jup.ag/docs/additional-topics/wallet-list",
            },
            theme: "dark",
            lang: "en",
        }
    }, React.createElement(UnifiedWalletButton));
};

export class WalletManager {
    constructor() {
        this.initWallet();
    }

    initWallet() {
        const container = document.getElementById('wallet-container');
        if (!container) {
            console.error('Wallet container not found');
            return;
        }

        const checkAndRender = () => {
            if (typeof window.UnifiedWalletAdapter !== 'undefined') {
                ReactDOM.createRoot(container).render(
                    React.createElement(WalletComponent)
                );
            } else {
                setTimeout(checkAndRender, 100);
            }
        };

        checkAndRender();
    }
}