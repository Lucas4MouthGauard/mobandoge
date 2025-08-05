// Enterprise Admin Panel JavaScript
class AdminPanel {
    constructor() {
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
        this.sessionTimer = null;
        this.isAuthenticated = false;
        this.credentials = {
            username: 'admin',
            password: 'fuddoge2025'
        };
        
        this.initializeElements();
        this.setupEventListeners();
        this.checkAuthentication();
    }

    initializeElements() {
        // Login elements
        this.loginScreen = document.getElementById('login-screen');
        this.loginForm = document.getElementById('login-form');
        this.loginError = document.getElementById('login-error');
        this.adminDashboard = document.getElementById('admin-dashboard');

        // Dashboard elements
        this.sessionTimerEl = document.getElementById('session-timer');
        this.logoutBtn = document.getElementById('logout-btn');

        // Tab elements
        this.navTabs = document.querySelectorAll('.nav-tab');
        this.tabContents = document.querySelectorAll('.tab-content');

        // Logo upload elements
        this.logoInput = document.getElementById('logo-input');
        this.logoUploadArea = document.getElementById('logo-upload-area');
        this.uploadLogoBtn = document.getElementById('upload-logo-btn');
        this.currentLogo = document.getElementById('current-logo');

        // Text content elements
        this.heroTitle = document.getElementById('hero-title');
        this.heroSubtitle = document.getElementById('hero-subtitle');
        this.originTitle = document.getElementById('origin-title');
        this.originContent = document.getElementById('origin-content');
        this.moonTitle = document.getElementById('moon-title');
        this.moonContent = document.getElementById('moon-content');

        // Buttons
        this.saveContentBtn = document.getElementById('save-content-btn');
        this.refreshPreviewBtn = document.getElementById('refresh-preview-btn');
        this.clearLogsBtn = document.getElementById('clear-logs-btn');

        // Preview and logs
        this.previewFrame = document.getElementById('preview-frame');
        this.logsContent = document.getElementById('logs-content');
    }

    setupEventListeners() {
        // Login
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));

        // Dashboard
        this.logoutBtn.addEventListener('click', () => this.handleLogout());

        // Tab navigation
        this.navTabs.forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Logo upload
        this.logoUploadArea.addEventListener('click', () => this.logoInput.click());
        this.logoInput.addEventListener('change', (e) => this.handleLogoUpload(e));
        this.uploadLogoBtn.addEventListener('click', () => this.uploadLogo());

        // Drag and drop for logo
        this.logoUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.logoUploadArea.classList.add('dragover');
        });

        this.logoUploadArea.addEventListener('dragleave', () => {
            this.logoUploadArea.classList.remove('dragover');
        });

        this.logoUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.logoUploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.logoInput.files = files;
                this.handleLogoUpload({ target: { files } });
            }
        });

        // Content management
        this.saveContentBtn.addEventListener('click', () => this.saveTextContent());
        this.refreshPreviewBtn.addEventListener('click', () => this.refreshPreview());
        this.clearLogsBtn.addEventListener('click', () => this.clearLogs());

        // Session management
        document.addEventListener('mousemove', () => this.resetSessionTimer());
        document.addEventListener('keypress', () => this.resetSessionTimer());
    }

    checkAuthentication() {
        const session = sessionStorage.getItem('admin_session');
        if (session) {
            const sessionData = JSON.parse(session);
            const now = Date.now();
            
            if (now - sessionData.timestamp < this.sessionTimeout) {
                this.authenticate(sessionData.username);
            } else {
                this.logout();
            }
        }
    }

    handleLogin(event) {
        event.preventDefault();
        
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (username === this.credentials.username && password === this.credentials.password) {
            this.authenticate(username);
            this.addLog('SUCCESS', `User ${username} logged in successfully`);
        } else {
            this.showLoginError('Invalid credentials. Please try again.');
            this.addLog('ERROR', `Failed login attempt for user: ${username}`);
        }
    }

    authenticate(username) {
        this.isAuthenticated = true;
        this.loginScreen.style.display = 'none';
        this.adminDashboard.style.display = 'block';
        
        // Save session
        sessionStorage.setItem('admin_session', JSON.stringify({
            username: username,
            timestamp: Date.now()
        }));

        this.startSessionTimer();
        this.loadCurrentContent();
        this.addLog('INFO', `Session started for user: ${username}`);
    }

    handleLogout() {
        this.logout();
        this.addLog('INFO', 'User logged out');
    }

    logout() {
        this.isAuthenticated = false;
        this.loginScreen.style.display = 'flex';
        this.adminDashboard.style.display = 'none';
        
        // Clear session
        sessionStorage.removeItem('admin_session');
        
        // Clear form
        this.loginForm.reset();
        this.loginError.style.display = 'none';
        
        // Stop session timer
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
    }

    showLoginError(message) {
        this.loginError.textContent = message;
        this.loginError.style.display = 'block';
        
        setTimeout(() => {
            this.loginError.style.display = 'none';
        }, 3000);
    }

    startSessionTimer() {
        let timeLeft = this.sessionTimeout;
        
        this.sessionTimer = setInterval(() => {
            timeLeft -= 1000;
            const minutes = Math.floor(timeLeft / 60000);
            const seconds = Math.floor((timeLeft % 60000) / 1000);
            
            this.sessionTimerEl.textContent = `Session: ${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            if (timeLeft <= 0) {
                this.logout();
                this.addLog('WARNING', 'Session expired');
            }
        }, 1000);
    }

    resetSessionTimer() {
        if (this.isAuthenticated && this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.startSessionTimer();
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        this.navTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabName) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        this.tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            }
        });

        this.addLog('INFO', `Switched to ${tabName} tab`);
    }

    loadCurrentContent() {
        // Load current text content from the main page
        fetch('index.html')
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Extract current content
                const heroTitleEl = doc.querySelector('.hero-title');
                const heroSubtitleEl = doc.querySelector('.hero-subtitle');
                const originTitleEl = doc.querySelector('#origin .story-content h2');
                const originContentEl = doc.querySelector('#origin .story-content p');
                const moonTitleEl = doc.querySelector('#moon .story-content h2');
                const moonContentEl = doc.querySelector('#moon .story-content p');

                if (heroTitleEl) this.heroTitle.value = heroTitleEl.textContent;
                if (heroSubtitleEl) this.heroSubtitle.value = heroSubtitleEl.textContent;
                if (originTitleEl) this.originTitle.value = originTitleEl.textContent;
                if (originContentEl) this.originContent.value = originContentEl.textContent;
                if (moonTitleEl) this.moonTitle.value = moonTitleEl.textContent;
                if (moonContentEl) this.moonContent.value = moonContentEl.textContent;
            })
            .catch(error => {
                console.error('Error loading current content:', error);
                this.showStatus('Error loading current content', 'error');
                this.addLog('ERROR', 'Failed to load current content');
            });
    }

    handleLogoUpload(event) {
        const file = event.target.files[0];
        if (file) {
            if (this.validateImageFile(file)) {
                this.previewLogo(file);
                this.uploadLogoBtn.disabled = false;
                this.showStatus('Logo selected successfully', 'success');
                this.addLog('INFO', `Logo file selected: ${file.name}`);
            } else {
                this.showStatus('Please select a valid image file (PNG, JPG, JPEG, GIF)', 'error');
                this.addLog('ERROR', `Invalid file type selected: ${file.name}`);
            }
        }
    }

    validateImageFile(file) {
        const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
        const maxSize = 5 * 1024 * 1024; // 5MB

        if (!validTypes.includes(file.type)) {
            return false;
        }

        if (file.size > maxSize) {
            return false;
        }

        return true;
    }

    previewLogo(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.currentLogo.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    async uploadLogo() {
        const file = this.logoInput.files[0];
        if (!file) {
            this.showStatus('Please select a logo file first', 'error');
            return;
        }

        this.uploadLogoBtn.disabled = true;
        this.uploadLogoBtn.textContent = 'Uploading...';

        try {
            // In a real application, you would upload to a server
            await this.simulateLogoUpload(file);
            
            this.showStatus('Logo uploaded successfully!', 'success');
            this.addLog('SUCCESS', `Logo uploaded: ${file.name}`);
            this.refreshPreview();
        } catch (error) {
            this.showStatus('Error uploading logo: ' + error.message, 'error');
            this.addLog('ERROR', `Logo upload failed: ${error.message}`);
        } finally {
            this.uploadLogoBtn.disabled = false;
            this.uploadLogoBtn.textContent = 'Upload Logo';
        }
    }

    async simulateLogoUpload(file) {
        // Simulate server upload delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // In a real application, you would:
        // 1. Upload the file to your server
        // 2. Replace the existing logo file
        // 3. Update the main page to use the new logo
        
        console.log('Logo would be uploaded to server:', file.name);
    }

    async saveTextContent() {
        this.saveContentBtn.disabled = true;
        this.saveContentBtn.textContent = 'Saving...';

        try {
            const content = {
                heroTitle: this.heroTitle.value,
                heroSubtitle: this.heroSubtitle.value,
                originTitle: this.originTitle.value,
                originContent: this.originContent.value,
                moonTitle: this.moonTitle.value,
                moonContent: this.moonContent.value
            };

            // In a real application, you would save to a server
            await this.simulateSaveContent(content);
            
            this.showStatus('Text content saved successfully!', 'success');
            this.addLog('SUCCESS', 'Text content updated');
            this.refreshPreview();
        } catch (error) {
            this.showStatus('Error saving content: ' + error.message, 'error');
            this.addLog('ERROR', `Content save failed: ${error.message}`);
        } finally {
            this.saveContentBtn.disabled = false;
            this.saveContentBtn.textContent = 'Save Content';
        }
    }

    async simulateSaveContent(content) {
        // Simulate server save delay
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // In a real application, you would:
        // 1. Send the content to your server
        // 2. Update the main page with new content
        // 3. Optionally save to a database
        
        console.log('Content would be saved to server:', content);
        
        // For demo purposes, update the preview iframe
        this.updatePreviewContent(content);
    }

    updatePreviewContent(content) {
        // Update the preview iframe with new content
        const iframe = this.previewFrame;
        if (iframe.contentDocument) {
            const doc = iframe.contentDocument;
            
            // Update hero section
            const heroTitle = doc.querySelector('.hero-title');
            const heroSubtitle = doc.querySelector('.hero-subtitle');
            if (heroTitle) heroTitle.textContent = content.heroTitle;
            if (heroSubtitle) heroSubtitle.textContent = content.heroSubtitle;
            
            // Update story sections
            const originTitle = doc.querySelector('#origin .story-content h2');
            const originContent = doc.querySelector('#origin .story-content p');
            const moonTitle = doc.querySelector('#moon .story-content h2');
            const moonContent = doc.querySelector('#moon .story-content p');
            
            if (originTitle) originTitle.textContent = content.originTitle;
            if (originContent) originContent.textContent = content.originContent;
            if (moonTitle) moonTitle.textContent = content.moonTitle;
            if (moonContent) moonContent.textContent = content.moonContent;
        }
    }

    refreshPreview() {
        // Refresh the preview iframe
        this.previewFrame.src = this.previewFrame.src;
        this.showStatus('Preview refreshed', 'info');
        this.addLog('INFO', 'Preview refreshed');
    }

    clearLogs() {
        this.logsContent.innerHTML = '';
        this.showStatus('Logs cleared', 'info');
        this.addLog('INFO', 'Logs cleared by user');
    }

    addLog(level, message) {
        const timestamp = new Date().toISOString().replace('T', ' ').substr(0, 19);
        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `
            <span class="log-time">[${timestamp}]</span>
            <span class="log-level ${level.toLowerCase()}">${level}</span>
            <span class="log-message">${message}</span>
        `;
        
        this.logsContent.insertBefore(logEntry, this.logsContent.firstChild);
        
        // Keep only last 50 log entries
        const entries = this.logsContent.querySelectorAll('.log-entry');
        if (entries.length > 50) {
            entries[entries.length - 1].remove();
        }
    }

    showStatus(message, type = 'info') {
        const statusEl = document.getElementById('status-message');
        statusEl.textContent = message;
        statusEl.className = `status-message ${type} show`;
        
        setTimeout(() => {
            statusEl.classList.remove('show');
        }, 3000);
    }
}

// Initialize admin panel when page loads
document.addEventListener('DOMContentLoaded', () => {
    new AdminPanel();
});
