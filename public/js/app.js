import { WalletManager } from './wallet.js';
import { BurnStats } from './stats.js';
import { Leaderboard } from './leaderboard.js';
import { BurnDialog } from './burn-dialog.js';
import { MemorialCard } from './memorial-card.js';

document.addEventListener('DOMContentLoaded', () => {
    const stats = new BurnStats();
    const wallet = new WalletManager();
    const leaderboard = new Leaderboard();
    const burnDialog = new BurnDialog(wallet, leaderboard);
    stats.fetchStats();
    setInterval(() => stats.fetchStats(), 60000);
});