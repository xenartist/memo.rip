export class Leaderboard {
    constructor() {
        this.init();
    }

    async init() {
        try {
            const [topBurns, latestBurns] = await Promise.all([
                this.fetchTopBurns(),
                this.fetchLatestBurns()
            ]);
            this.renderTopBurns(topBurns);
            this.renderLatestBurns(latestBurns);
        } catch (error) {
            console.error('Failed to initialize leaderboards:', error);
        }
    }

    async fetchTopBurns() {
        try {
            const response = await fetch('/api/top-burns');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Top burns data:', data);
            return data;
        } catch (error) {
            console.error('Error fetching top burns:', error);
            throw error;
        }
    }

    async fetchLatestBurns() {
        try {
            const response = await fetch('/api/latest-burns');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log('Latest burns data:', data);
            return data;
        } catch (error) {
            console.error('Error fetching latest burns:', error);
            throw error;
        }
    }

    renderTopBurns(burns) {
        const container = document.getElementById('top-burns-list');
        container.innerHTML = '';
        
        burns.forEach((burn, index) => {
            const note = this.createBurnNote({
                rank: index + 1,
                amount: burn.amount/1_000_000,
                address: burn.burner,
                timestamp: burn.timestamp,
                memo: burn.memo,
                isTopBurn: true
            });
            container.appendChild(note);
        });
    }

    renderLatestBurns(burns) {
        const container = document.getElementById('latest-burns-list');
        container.innerHTML = '';
        
        burns.forEach(burn => {
            const note = this.createBurnNote({
                amount: burn.amount/1_000_000,
                address: burn.burner,
                timestamp: burn.timestamp,
                memo: burn.memo,
                isLatest: true
            });
            container.appendChild(note);
        });
    }

    createBurnNote({ rank, amount, address, timestamp, memo, isTopBurn, isLatest }) {
        const div = document.createElement('div');
        div.className = 'memorial-card';

        if (isTopBurn) {
            div.setAttribute('data-rank', rank);
        }

        const DEFAULT_IMAGE = '../img/solxen-logo.png';

        let memoData = {
            title: 'Everlasting Memory',
            image: DEFAULT_IMAGE, 
            content: 'Burned by',
            author: this.formatAddress(address)
        };

        try {
            if (memo && typeof memo === 'string') {
                const cleanMemo = memo.trim();
                if (cleanMemo.startsWith('{') && cleanMemo.endsWith('}')) {
                    const parsedMemo = JSON.parse(cleanMemo);
                    memoData = {
                        title: parsedMemo.title || memoData.title,
                        image: parsedMemo.image || memoData.image,
                        content: parsedMemo.content || memoData.content,
                        author: parsedMemo.author || memoData.author
                    };
                }
            }
        } catch (error) {
            console.warn('Failed to parse memo:', error);
        }

        const content = `
            <img src="${memoData.image}" 
                 alt="${memoData.title}"
                 onerror="this.onerror=null; this.src='${DEFAULT_IMAGE}';">
            <div class="memorial-content">
                ${isTopBurn ? `<div class="memorial-rank">#${rank}</div>` : ''}
                <div class="memorial-title">${memoData.title}</div>
                <div class="memorial-text">${memoData.content}</div>
                <div class="memorial-author">- ${memoData.author}</div>
                <div class="memorial-amount">Burned ${this.formatAmount(amount)} solXEN</div>
                <div class="memorial-time">${this.formatTimestamp(timestamp)}</div>
            </div>
        `;

        div.innerHTML = content;
        return div;
    }

    formatAmount(amount) {
        return new Intl.NumberFormat().format(amount);
    }

    formatAddress(address) {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp * 1000).toLocaleString();
    }
}