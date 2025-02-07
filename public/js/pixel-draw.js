export class PixelDraw {
    constructor() {
        this.grid = Array(32).fill().map(() => Array(32).fill(0));
        this.initializeUI();
        this.setupEventListeners();
    }

    initializeUI() {
        const pixelGrid = document.getElementById('pixel-grid');
        
        // Create 32x32 grid
        for (let i = 0; i < 32; i++) {
            for (let j = 0; j < 32; j++) {
                const pixel = document.createElement('div');
                pixel.className = 'border border-gray-200 cursor-pointer';
                pixel.dataset.row = i;
                pixel.dataset.col = j;
                pixelGrid.appendChild(pixel);
            }
        }

        // Create container for instruction and clear button
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'flex justify-between items-center mt-2';

        // Add mouse instruction text
        const instruction = document.createElement('div');
        instruction.className = 'text-sm text-gray-500';
        instruction.textContent = '(mouse: left->draw, right->clear)';

        // Create clear button
        const clearButton = document.createElement('button');
        clearButton.id = 'clear-pixels';
        clearButton.className = 'px-3 py-1 text-sm border rounded hover:bg-gray-50';
        clearButton.textContent = 'Clear All';

        // Add elements to container
        controlsContainer.appendChild(instruction);
        controlsContainer.appendChild(clearButton);

        // Add container after pixel grid
        pixelGrid.parentNode.insertBefore(controlsContainer, pixelGrid.nextSibling);

        // Add custom CSS for pixel grid
        const style = document.createElement('style');
        style.textContent = `
            #pixel-grid { 
                display: grid;
                grid-template-columns: repeat(32, 16px);
                gap: 0;
                position: relative;
            }
            #pixel-grid > div {
                width: 16px;
                height: 16px;
            }
            #pixel-grid::after {
                content: '(mouse: left->draw, right->clear)';
                position: absolute;
                bottom: -20px;
                left: 0;
                font-size: 0.875rem;
                color: #6b7280;
            }
        `;
        document.head.appendChild(style);

        // Remove the separate instruction element since we're using CSS ::after
        controlsContainer.removeChild(instruction);
    }

    setupEventListeners() {
        const pixelGrid = document.getElementById('pixel-grid');
        const clearButton = document.getElementById('clear-pixels');
        
        // Tab switching
        document.getElementById('tab-image-url').addEventListener('click', () => this.switchTab('url'));
        document.getElementById('tab-pixel-draw').addEventListener('click', () => this.switchTab('draw'));

        // Disable context menu in pixel grid
        pixelGrid.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });

        // Left click to draw, right click to erase
        pixelGrid.addEventListener('mousedown', (e) => {
            const pixel = e.target.closest('[data-row]');
            if (!pixel) return;

            if (e.button === 0) {  // Left click
                this.setPixel(pixel, 1);
            } else if (e.button === 2) {  // Right click
                this.setPixel(pixel, 0);
            }
        });

        clearButton.addEventListener('click', () => this.clearGrid());
    }

    // New method to set pixel value directly
    setPixel(pixel, value) {
        const row = parseInt(pixel.dataset.row);
        const col = parseInt(pixel.dataset.col);
        
        this.grid[row][col] = value;
        pixel.style.backgroundColor = value ? '#000' : '';
    }

    clearGrid() {
        this.grid = Array(32).fill().map(() => Array(32).fill(0));
        const pixels = document.querySelectorAll('#pixel-grid [data-row]');
        pixels.forEach(pixel => pixel.style.backgroundColor = '');
    }

    switchTab(tab) {
        const urlTab = document.getElementById('tab-image-url');
        const drawTab = document.getElementById('tab-pixel-draw');
        const urlContent = document.getElementById('image-url-content');
        const drawContent = document.getElementById('pixel-draw-content');

        if (tab === 'url') {
            urlTab.classList.add('border-b-2', 'border-red-500');
            urlTab.classList.remove('text-gray-500');
            drawTab.classList.remove('border-b-2', 'border-red-500');
            drawTab.classList.add('text-gray-500');
            urlContent.classList.remove('hidden');
            drawContent.classList.add('hidden');
        } else {
            drawTab.classList.add('border-b-2', 'border-red-500');
            drawTab.classList.remove('text-gray-500');
            urlTab.classList.remove('border-b-2', 'border-red-500');
            urlTab.classList.add('text-gray-500');
            drawContent.classList.remove('hidden');
            urlContent.classList.add('hidden');
        }
    }

    getPixelData() {
        // Convert grid to binary strings
        const binaryStrings = this.grid.map(row => 
            row.join('')
        );

        // Convert binary strings to hex
        const hexStrings = binaryStrings.map(binary => 
            parseInt(binary, 2).toString(16).padStart(8, '0')
        );

        return hexStrings.join('');
    }
}