import { WalletManager } from './wallet.js';
import { BurnStats } from './stats.js';
import { BurnDialog } from './burn-dialog.js';
import { MemorialCard } from './memorial-card.js';

document.addEventListener('DOMContentLoaded', () => {
    const stats = new BurnStats();
    const wallet = new WalletManager();
    const burnDialog = new BurnDialog(wallet);
    const memorialCard = new MemorialCard();
    stats.fetchStats();
    setInterval(() => stats.fetchStats(), 60000);
});