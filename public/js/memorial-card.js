export class MemorialCard {
    constructor() {
        this.initializeUI();
    }

    async initializeUI() {
        const memorialData = {
            "title":"US 2024 Election - 2 days left",
            "image":"https://i.imgur.com/ajfDSQJ.png",
            "content":"Close Race Between Trump and Harris",
            "author":"test_dude",
            "amount": "Burned 89.77 solXEN"
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