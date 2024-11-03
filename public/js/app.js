import { WalletManager } from './wallet.js';
import { BurnStats } from './stats.js';
import { BurnDialog } from './burn-dialog.js';

document.addEventListener('DOMContentLoaded', () => {
    const stats = new BurnStats();
    const wallet = new WalletManager();
    const burnDialog = new BurnDialog();

    stats.fetchStats();
    setInterval(() => stats.fetchStats(), 60000);
});