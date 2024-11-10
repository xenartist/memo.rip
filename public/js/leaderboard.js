export class Leaderboard {
    constructor() {
        this.shuffledImages = [];
        this.currentIndex = 0;

        window.getRandomDefaultImage = () => {
            const DEFAULT_IMAGES = [
                '../img/memo-rip-banana.png',
                '../img/memo-rip-carrot.png',
                '../img/memo-rip-lemon.png',
                '../img/memo-rip-logo.png',
                '../img/memo-rip-maze.png',
                '../img/memo-rip-pear.png',
                '../img/memo-rip-pomegranate.png',
                '../img/memo-rip-potato.png',
                '../img/memo-rip-starfruit.png',
                '../img/solxen-logo.png', 
            ];

            if (this.currentIndex === 0 || this.currentIndex >= this.shuffledImages.length) {
                this.shuffledImages = [...DEFAULT_IMAGES];
                // Fisher-Yates shuffle
                for (let i = this.shuffledImages.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [this.shuffledImages[i], this.shuffledImages[j]] = 
                    [this.shuffledImages[j], this.shuffledImages[i]];
                }
                this.currentIndex = 0;
            }
            
            return this.shuffledImages[this.currentIndex++];
        };
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

    isValidImageUrl(url) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
        });
    }

    createBurnNote({ rank, amount, address, timestamp, memo, isTopBurn, isLatest }) {
        const div = document.createElement('div');
        div.className = 'memorial-card';

        if (isTopBurn) {
            div.setAttribute('data-rank', rank);

            // add pin icon
            const pin = document.createElement('div');
            pin.className = 'memorial-pin';
            div.appendChild(pin);
        }

        // const DEFAULT_IMAGES = [
        //     '../img/memo-rip-logo.png',
        //     '../img/solxen-logo.png',     
        //     '../img/memo-rip-banana.png',
        //     '../img/memo-rip-carrot.png',
        //     '../img/memo-rip-lemon.png',
        //     '../img/memo-rip-maze.png',
        //     '../img/memo-rip-pear.png'  
        // ];

        // const getRandomDefaultImage = () => {
        //     const randomIndex = Math.floor(Math.random() * DEFAULT_IMAGES.length);
        //     return DEFAULT_IMAGES[randomIndex];
        // };

        let memoData = {
            title: 'Everlasting Memory',
            image: '', 
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
            ${isTopBurn ? '<div class="memorial-pin-shadow"></div>' : ''}
            <img src="${memoData.image}" 
                 alt="${memoData.title}"
                 onerror="this.onerror=null; this.src=getRandomDefaultImage();">
            <div class="memorial-content">
                ${isTopBurn ? `<div class="memorial-rank">#${rank}</div>` : ''}
                <div class="memorial-title">${memoData.title}</div>
                <div class="memorial-text">${memoData.content}</div>
                <div class="memorial-author">- ${memoData.author}</div>
                <div class="memorial-amount">Burned ${this.formatAmount(amount)} solXEN</div>
                <div class="memorial-time">${this.formatTimestamp(timestamp)}</div>
            </div>
        `;

        div.insertAdjacentHTML('beforeend', content);
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