export class BurnDialog {
    constructor() {
        this.dialog = document.getElementById('burn-dialog');
        this.form = document.getElementById('burn-form');
        this.burnButton = document.getElementById('burn-button');
        this.closeButton = document.getElementById('close-dialog');
        this.cancelButton = document.getElementById('cancel-burn');

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.burnButton.addEventListener('click', () => this.showDialog());

        this.closeButton.addEventListener('click', () => this.hideDialog());
        this.cancelButton.addEventListener('click', () => this.hideDialog());
        this.dialog.addEventListener('click', (e) => {
            if (e.target === this.dialog) {
                this.hideDialog();
            }
        });

        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    showDialog() {
        this.dialog.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; 
    }

    hideDialog() {
        this.dialog.classList.add('hidden');
        document.body.style.overflow = ''; 
    }

    async handleSubmit(e) {
        e.preventDefault();

        const formData = {
            title: document.getElementById('memo-title').value,
            image: document.getElementById('memo-image').value,
            content: document.getElementById('memo-content').value,
            author: document.getElementById('memo-author').value
        };

        console.log('Form submitted with data:', formData);
        // TODO: burn logic

        this.hideDialog();
    }
}