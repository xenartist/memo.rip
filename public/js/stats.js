export class BurnStats {
    constructor() {
        this.totalSupply = 58294721418;
    }

    async fetchStats() {
        try {
            const response = await fetch('/api/burns');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.updateUI(data);
        } catch (error) {
            console.error('Error fetching stats:', error);
            document.getElementById('total-burn').textContent = 'Error loading data';
            document.getElementById('burn-percentage').textContent = 'Error loading data';
        }
    }

    updateUI(data) {
        document.getElementById('total-burn').textContent = 
            this.formatNumber(data.totalBurn);
        document.getElementById('burn-percentage').textContent = 
            `${data.burnPercentage.toFixed(4)}%`;
    }

    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }
}