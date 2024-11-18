export class Leaderboard {
    constructor() {
        this.shuffledImages = [];
        this.currentIndex = 0;

        this.ALLOWED_MIME_TYPES = [
            'image/jpg',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ];

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

    isValidImageUrl(url) {
        try {
            const urlObj = new URL(url);
            
            // 1. only https
            if (urlObj.protocol !== 'https:') {
                return false;
            }

            // 2. check file extension
            const pathname = urlObj.pathname.toLowerCase();
            if (pathname.includes('.')) {
                const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                if (!validExtensions.some(ext => pathname.endsWith(ext))) {
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
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

                    const imageUrl = parsedMemo.image || '';
                    memoData = {
                        title: this.sanitizeText(parsedMemo.title) || memoData.title,
                        image: this.isValidImageUrl(imageUrl) ? imageUrl : '',
                        content: this.sanitizeText(parsedMemo.content) || memoData.content,
                        author: this.sanitizeText(parsedMemo.author) || memoData.author
                    };
                }
            }
        } catch (error) {
            console.warn('Failed to parse memo:', error);
        }

        const content = `
            ${isTopBurn ? '<div class="memorial-pin-shadow"></div>' : ''}
            <img src="${this.encodeHTML(memoData.image || getRandomDefaultImage())}" 
                 alt="${this.encodeHTML(memoData.title)}"
                 onerror="this.onerror=null; this.src=getRandomDefaultImage();"
                 loading="lazy"
                 crossorigin="anonymous"
                 referrerpolicy="no-referrer">
            <div class="memorial-content">
                ${isTopBurn ? `<div class="memorial-rank">#${rank}</div>` : ''}
                <div class="memorial-title">${this.encodeHTML(memoData.title)}</div>
                <div class="memorial-text">${this.encodeHTML(memoData.content)}</div>
                <div class="memorial-author">- ${this.encodeHTML(memoData.author)}</div>
                <div class="memorial-amount">🔥 Burned <span class="text-red-600 font-bold">${this.formatAmount(amount)}</span> solXEN</div>
                <div class="memorial-time">${this.formatTimestamp(timestamp)}</div>
            </div>
        `;

        div.insertAdjacentHTML('beforeend', content);
        return div;
    }

    // encode HTML to prevent XSS
    encodeHTML(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // limit text length
    sanitizeText(text) {
        if (typeof text !== 'string') return '';
        return text.slice(0, 500); // limit length
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