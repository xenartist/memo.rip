export class Leaderboard {
    constructor() {
        this.topTotalBurnsData = [];
        this.currentBurnIndex = 0;
        this.initializeModalHandlers();
        this.startRotation();

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

    initializeModalHandlers() {
        document.getElementById('show-all-total-burns').addEventListener('click', () => {
            document.getElementById('top-total-burns-modal').classList.remove('hidden');
        });

        document.getElementById('close-total-burns-modal').addEventListener('click', () => {
            document.getElementById('top-total-burns-modal').classList.add('hidden');
        });

        document.getElementById('top-total-burns-modal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                e.target.classList.add('hidden');
            }
        });
    }

    startRotation() {
        setInterval(() => {
            if (this.topTotalBurnsData.length > 0) {
                this.currentBurnIndex = (this.currentBurnIndex + 1) % this.topTotalBurnsData.length;
                this.updateRotatingBurn();
            }
        }, 5000);
    }

    updateRotatingBurn() {
        const burn = this.topTotalBurnsData[this.currentBurnIndex];
        const totalAmount = this.topTotalBurnsData.reduce((sum, burner) => sum + Number(burner.totalAmount), 0);
        const percentage = ((Number(burn.totalAmount) / totalAmount) * 100).toFixed(2);
        const container = document.getElementById('rotating-total-burn');
        const formattedAddress = `${burn.address.slice(0, 6)}****`;
        
        // Create new content
        const newContent = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="text-gray-500">#${burn.rank}</span>
                    <span class="font-mono">${formattedAddress}</span>
                </div>
                <div>
                    <span class="text-red-600 font-bold">${burn.totalAmount}</span>
                    <span class="text-blue-600">(${percentage}%)</span>
                </div>
            </div>
        `;

        // Create temporary container with both old and new content
        const wrapper = document.createElement('div');
        wrapper.className = 'relative h-6 overflow-hidden'; // Fixed height container
        
        // Add current content (if exists) and new content
        wrapper.innerHTML = `
            <div class="absolute w-full transition-transform duration-500 ease-in-out">
                ${container.innerHTML}
            </div>
            <div class="absolute w-full transition-transform duration-500 ease-in-out translate-y-full">
                ${newContent}
            </div>
        `;

        // Replace container content
        container.innerHTML = '';
        container.appendChild(wrapper);

        // Trigger animation after a small delay
        setTimeout(() => {
            const [oldContent, newContent] = wrapper.children;
            oldContent.style.transform = 'translateY(-100%)';
            newContent.style.transform = 'translateY(0)';
        }, 50);

        // Clean up after animation
        setTimeout(() => {
            container.innerHTML = newContent;
        }, 500);
    }

    async init() {
        try {
            const [topBurns, latestBurns, topTotalBurns, totalRewards] = await Promise.all([
                this.fetchTopBurns(),
                this.fetchLatestBurns(),
                this.fetchTopTotalBurns(),
                this.fetchTotalRewards()
            ]);
            this.topTotalBurnsData = topTotalBurns;
            this.totalRewardsAmount = totalRewards;
            this.updateRotatingBurn();
            this.renderTopBurns(topBurns);
            this.renderLatestBurns(latestBurns);
            this.renderTopTotalBurns(topTotalBurns);
            this.updateTotalRewardsDisplay();
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

    async fetchTopTotalBurns() {
        try {
            const response = await fetch('/api/top-total-burns');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error fetching top total burns:', error);
            throw error;
        }
    }

    async fetchTotalRewards() {
        try {
            const response = await fetch('/api/total-rewards');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data.totalRewards;
        } catch (error) {
            console.error('Error fetching total rewards:', error);
            return 0;
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

    renderTopTotalBurns(burners) {
        const container = document.getElementById('top-total-burns-list');
        container.innerHTML = '';

        // Add title row
        const titleRow = document.createElement('div');
        titleRow.className = 'flex items-center justify-between p-2 border-b bg-gray-100 font-semibold';
        titleRow.innerHTML = `
            <div class="flex items-center gap-3">
                <span class="text-gray-600 text-base w-12">Rank</span>
                <span class="text-gray-600 text-base">Burner</span>
            </div>
            <div class="text-right flex items-center gap-4">
                <span class="text-gray-600 text-base">Burned solXEN</span>
                <span class="text-gray-600 text-base">Donated XN (TESTING/FAKE)</span>
            </div>
        `;
        container.appendChild(titleRow);

        // Calculate total amount of top 69 burners
        const totalAmount = burners.reduce((sum, burner) => sum + Number(burner.totalAmount), 0);

        burners.forEach(burner => {
            const div = document.createElement('div');
            div.className = 'flex items-center justify-between p-2 border-b';
            
            // Format address: first 6 chars + ****
            const formattedAddress = `${burner.address.slice(0, 6)}****`;

            const percentage = ((Number(burner.totalAmount) / totalAmount) * 100).toFixed(2);
            
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <span class="text-gray-500 text-lg w-12">#${burner.rank}</span>
                    <span class="font-mono text-base">${formattedAddress}</span>
                </div>
                <div class="text-right flex items-center gap-4">
                    <span class="text-red-600 font-bold text-lg">${burner.totalAmount}</span>
                    <span class="text-gray-500 text-base">solXEN</span>
                    <span class="text-blue-600 text-base">(${percentage}%)</span>
                    ${burner.totalRewards ? `
                        <span class="text-green-600 text-base">${Number(burner.totalRewards).toFixed(3)} XN (TESTING/FAKE)</span>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(div);
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

    // Convert hex string to binary array for pixel art
    hexToBinaryArray(hexString) {
        // Remove '0x' prefix if exists
        hexString = hexString.replace('0x', '');
        
        // Create 32x32 array
        const binaryArray = Array(32).fill().map(() => Array(32).fill(0));
        
        // Process 8 pixels at a time (32 bits hex number)
        for (let i = 0; i < 32; i++) {
            const row = hexString.substr(i * 8, 8);
            const binary = parseInt(row, 16).toString(2).padStart(32, '0');
            
            // Fill 32 pixels for this row
            for (let j = 0; j < 32; j++) {
                binaryArray[i][j] = binary[j] === '1' ? 1 : 0;
            }
        }
        
        return binaryArray;
    }

    // Create canvas for pixel art display with random colors
    createPixelCanvas(pixelData) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;   // 32 pixels * 16px = 512px
        canvas.height = 512;  // 32 pixels * 16px = 512px
        canvas.style.width = '512px';
        canvas.style.height = '512px';
        canvas.style.maxWidth = '100%';
        canvas.style.imageRendering = 'pixelated';
        
        const ctx = canvas.getContext('2d');
        const binaryArray = this.hexToBinaryArray(pixelData);

        // Generate random bright color for pixels
        const randomBrightColor = () => {
            const h = Math.floor(Math.random() * 360);    // Random hue
            const s = 70 + Math.random() * 30;           // Saturation 70-100%
            const l = 60 + Math.random() * 20;           // Lightness 60-80%
            return `hsl(${h}, ${s}%, ${l}%)`;
        };

        // Generate random dark color for background
        const randomDarkColor = () => {
            const h = Math.floor(Math.random() * 360);    // Random hue
            const s = 30 + Math.random() * 30;           // Saturation 30-60%
            const l = 10 + Math.random() * 15;           // Lightness 10-25%
            return `hsl(${h}, ${s}%, ${l}%)`;
        };
        
        // Generate colors for this pixel art
        const pixelColor = randomBrightColor();
        const bgColor = randomDarkColor();
        
        // Draw pixels on canvas, each pixel as 16x16
        for (let i = 0; i < 32; i++) {
            for (let j = 0; j < 32; j++) {
                ctx.fillStyle = binaryArray[i][j] ? pixelColor : bgColor;
                ctx.fillRect(j * 16, i * 16, 16, 16);  // Scale each pixel to 16x16
            }
        }
        
        return canvas.toDataURL(); // Convert to base64 image URL
    }

    createBurnNote({ rank, amount, address, timestamp, memo, isTopBurn, isLatest }) {
        const div = document.createElement('div');
        div.className = 'memorial-card';

        if (isTopBurn) {
            div.setAttribute('data-rank', rank);
            const pin = document.createElement('div');
            pin.className = 'memorial-pin';
            div.appendChild(pin);
        }

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
                    
                    // Handle image data
                    let imageUrl = parsedMemo.image || '';
                    if (imageUrl.startsWith('pixel:')) {
                        // Parse pixel data and convert to canvas
                        const pixelData = imageUrl.split('0x')[1];
                        imageUrl = this.createPixelCanvas(pixelData);
                    }

                    memoData = {
                        title: this.sanitizeText(parsedMemo.title) || memoData.title,
                        image: imageUrl,
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

    updateTotalRewardsDisplay() {
        // update main page
        const mainTotalRewardsSpan = document.createElement('span');
        mainTotalRewardsSpan.className = 'text-green-600 text-sm ml-2';
        mainTotalRewardsSpan.textContent = `(Donations: ${Math.floor(this.totalRewardsAmount)} XN [TESTING/FAKE])`;
        
        const mainTitle = document.querySelector('.top-total-burns-title');
        if (mainTitle) {
            // check if already has rewards, if so, update, otherwise add
            const existingRewards = mainTitle.querySelector('.text-green-600');
            if (existingRewards) {
                existingRewards.textContent = mainTotalRewardsSpan.textContent;
            } else {
                mainTitle.appendChild(mainTotalRewardsSpan);
            }
        }

        // update modal title
        const modalTotalRewardsSpan = document.createElement('span');
        modalTotalRewardsSpan.className = 'text-green-600 text-sm ml-2';
        modalTotalRewardsSpan.textContent = `(Total Donations: ${Math.floor(this.totalRewardsAmount)} XN [TESTING/FAKE])`;
        
        // check if already has rewards, if so, update, otherwise add
        const modalTitle = document.querySelector('#top-total-burns-modal .modal-title');
        if (modalTitle) {
            const existingModalRewards = modalTitle.querySelector('.text-green-600');
            if (existingModalRewards) {
                existingModalRewards.textContent = modalTotalRewardsSpan.textContent;
            } else {
                modalTitle.appendChild(modalTotalRewardsSpan);
            }
        }
    }
}