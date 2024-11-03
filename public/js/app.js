import { WalletManager } from './wallet.js';
import { BurnStats } from './stats.js';

document.addEventListener('DOMContentLoaded', () => {
    const stats = new BurnStats();
    const wallet = new WalletManager();

    stats.fetchStats();
    setInterval(() => stats.fetchStats(), 60000);
});