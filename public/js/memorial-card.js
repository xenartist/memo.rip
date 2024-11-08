export class MemorialCard {
    constructor() {
        this.initializeUI();
    }

    async initializeUI() {
        const memorialData = {
            "title":"Bitcoin $76,000 after US Election 2024",
            "image":"https://i.imgur.com/SEW4Agl.png",
            "content":"No one can stop it.",
            "author":"solXEN",
            "amount": "Burned 100 solXEN"
        }

        const container = document.getElementById('memorial-card');
        
        const card = document.createElement('div');
        card.className = 'memorial-card';
        
        card.innerHTML = `
            <img src="${memorialData.image}" alt="${memorialData.title}">
            <div class="memorial-content">
                <div class="memorial-title">${memorialData.title}</div>
                <div class="memorial-text">${memorialData.content}</div>
                <div class="memorial-author">- ${memorialData.author}</div>
                <div class="memorial-amount">${memorialData.amount}</div>
            </div>
        `;

        container.appendChild(card);
    }
}