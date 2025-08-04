// Initialize after page load
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    startMarketDataUpdates();
    preloadDogeImages();
});

// Preload Doge images
function preloadDogeImages() {
    // Clear previous image cache
    if (window.dogeImage) {
        window.dogeImage.onload = null;
        window.dogeImage.onerror = null;
    }
    
    window.dogeImage = new Image();
    
    // Add timestamp to prevent caching
    const timestamp = new Date().getTime();
    window.dogeImage.src = `assets/images/ogdoge.png?t=${timestamp}`;
    
    window.dogeImage.onload = function() {
        console.log('✅ Doge image loaded successfully - version:', timestamp);
        // After image loads, notify all games to update
        if (window.gameManager && window.gameManager.currentGame) {
            window.gameManager.currentGame.dogeImageLoaded = true;
        }
        
        // Store image load time for update detection
        window.dogeImageLastLoad = timestamp;
    };
    
    window.dogeImage.onerror = function() {
        console.warn('⚠️ Doge image failed to load, using default graphics');
        window.dogeImage = null;
    };
}

function setupEventListeners() {
    const startBtn = document.getElementById('startBtn');
    if (startBtn) {
        startBtn.addEventListener('click', function() {
            document.querySelector('#story').scrollIntoView({ behavior: 'smooth' });
        });
    }

    const interactionBtns = document.querySelectorAll('.interaction-btn');
    interactionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            this.style.background = '#FFD700';
            this.textContent = '✅ Done!';
            setTimeout(() => {
                this.style.background = '#32CD32';
                this.textContent = this.getAttribute('data-original') || 'Click';
            }, 2000);
        });
    });



    const gameBtns = document.querySelectorAll('.game-btn');
    gameBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('🎮 Game button clicked');
            
            // Prevent duplicate clicks
            if (this.disabled) {
                console.log('⚠️ Game button disabled, ignoring click');
                return;
            }
            
            const gameCard = this.closest('.game-card');
            const canvas = gameCard.querySelector('canvas');
            
            if (!canvas) {
                console.error('❌ Canvas element not found');
                return;
            }
            
            // Determine game type based on game card
            let gameType = 'rocket';
            if (gameCard.querySelector('#meteor-canvas')) {
                gameType = 'meteor';
            } else if (gameCard.querySelector('#coin-canvas')) {
                gameType = 'coin';
            }
            
            console.log('🎯 Game type:', gameType);
            
            // Update button state
            this.textContent = 'Playing...';
            this.disabled = true;
            
            // Start new game
            console.log('🚀 Starting new game');
            gameManager.startGame(gameType, canvas);
        });
    });

    // Preset amount buttons
    const presetBtns = document.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            presetBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const amount = this.getAttribute('data-amount');
            const input = document.querySelector('.token-input input');
            if (input) {
                input.value = amount;
            }
        });
    });




    
    // Clean up game state on page unload
    window.addEventListener('beforeunload', () => {
        if (gameManager.currentGame) {
            gameManager.stopCurrentGame();
        }
    });
    

}

// Market data manager
class MarketDataManager {
    constructor() {
        this.updateInterval = 10 * 60 * 1000; // Update every 10 minutes
        this.lastUpdate = 0;
        this.cache = {
            prices: {},
            fearGreed: null
        };
        this.apis = {
            prices: [
                'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true',
                'https://api.binance.com/api/v3/ticker/24hr?symbols=["BTCUSDT","ETHUSDT","SOLUSDT"]',
                'https://api.coinbase.com/v2/prices/BTC-USD/spot,ETH-USD/spot,SOL-USD/spot'
            ],
            fearGreed: [
                'https://api.alternative.me/fng/',
                'https://fear-and-greed-api.vercel.app/api/v1/fear-greed'
            ]
        };
        this.fallbackData = {
            BTC: { price: 44000, change: 2.5 },
            ETH: { price: 2800, change: 1.8 },
            SOL: { price: 98, change: -0.5 },
            fearGreed: 65
        };
    }

    async start() {
        await this.updateMarketData();
        setInterval(() => this.updateMarketData(), this.updateInterval);
    }

    async updateMarketData() {
        try {
            console.log('🔄 Starting market data update...');
            this.showLoadingState(true);
            
            // Fetch price and fear-greed data in parallel
            const [priceData, fearGreedData] = await Promise.allSettled([
                this.fetchPriceData(),
                this.fetchFearGreedData()
            ]);

            // Process price data
            if (priceData.status === 'fulfilled' && priceData.value) {
                this.cache.prices = priceData.value;
                this.updatePriceDisplay();
            } else {
                console.warn('⚠️ Price data fetch failed, using cache or fallback data');
                this.updatePriceDisplay();
            }

            // Process fear-greed index
            if (fearGreedData.status === 'fulfilled' && fearGreedData.value !== null) {
                this.cache.fearGreed = fearGreedData.value;
                this.updateFearGreedDisplay();
            } else {
                console.warn('⚠️ Fear-greed index fetch failed, using cache or fallback data');
                this.updateFearGreedDisplay();
            }

            this.lastUpdate = Date.now();
            this.updateLastUpdateDisplay();
            this.showLoadingState(false);
            
        } catch (error) {
            console.error('❌ Market data update failed:', error);
            this.updatePriceDisplay();
            this.updateFearGreedDisplay();
            this.showLoadingState(false);
        }
    }

    async fetchPriceData() {
        for (const apiUrl of this.apis.prices) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'MobanDoge/1.0'
                    },
                    timeout: 5000
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                const prices = this.parsePriceData(data, apiUrl);
                
                if (prices && Object.keys(prices).length > 0) {
                    console.log('✅ Price data fetched successfully:', prices);
                    return prices;
                }
            } catch (error) {
                console.warn(`⚠️ API ${apiUrl} failed:`, error.message);
                continue;
            }
        }
        
        console.warn('⚠️ All price APIs failed, using fallback data');
        return this.fallbackData;
    }

    parsePriceData(data, apiUrl) {
        try {
            if (apiUrl.includes('coingecko')) {
                return {
                    BTC: {
                        price: data.bitcoin.usd,
                        change: data.bitcoin.usd_24h_change
                    },
                    ETH: {
                        price: data.ethereum.usd,
                        change: data.ethereum.usd_24h_change
                    },
                    SOL: {
                        price: data.solana.usd,
                        change: data.solana.usd_24h_change
                    }
                };
            } else if (apiUrl.includes('binance')) {
                const result = {};
                data.forEach(item => {
                    const symbol = item.symbol.replace('USDT', '');
                    result[symbol] = {
                        price: parseFloat(item.lastPrice),
                        change: parseFloat(item.priceChangePercent)
                    };
                });
                return result;
            } else if (apiUrl.includes('coinbase')) {
                const result = {};
                Object.keys(data.data).forEach(key => {
                    const symbol = key.split('-')[0];
                    result[symbol] = {
                        price: parseFloat(data.data[key].amount),
                        change: 0 // Coinbase API doesn't provide 24h change
                    };
                });
                return result;
            }
        } catch (error) {
            console.error('❌ Failed to parse price data:', error);
        }
        return null;
    }

    async fetchFearGreedData() {
        for (const apiUrl of this.apis.fearGreed) {
            try {
                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'MobanDoge/1.0'
                    },
                    timeout: 5000
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);

                const data = await response.json();
                const fearGreed = this.parseFearGreedData(data, apiUrl);
                
                if (fearGreed !== null) {
                    console.log('✅ Fear-greed index fetched successfully:', fearGreed);
                    return fearGreed;
                }
            } catch (error) {
                console.warn(`⚠️ Fear-greed API ${apiUrl} failed:`, error.message);
                continue;
            }
        }
        
        console.warn('⚠️ All fear-greed APIs failed, using fallback data');
        return this.fallbackData.fearGreed;
    }

    parseFearGreedData(data, apiUrl) {
        try {
            if (apiUrl.includes('alternative.me')) {
                return parseInt(data.data[0].value);
            } else if (apiUrl.includes('fear-and-greed-api')) {
                return parseInt(data.score);
            }
        } catch (error) {
            console.error('❌ Failed to parse fear-greed data:', error);
        }
        return null;
    }

    updatePriceDisplay() {
        const symbols = ['BTC', 'ETH', 'SOL'];
        symbols.forEach(symbol => {
            const priceElement = document.getElementById(`${symbol.toLowerCase()}-price`);
            const changeElement = priceElement?.nextElementSibling;
            
            if (priceElement && changeElement) {
                const data = this.cache.prices[symbol] || this.fallbackData[symbol];
                
                // Format price
                const formattedPrice = this.formatPrice(data.price);
                priceElement.textContent = `$${formattedPrice}`;
                
                // Format change rate
                const change = data.change || 0;
                const changeText = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
                changeElement.textContent = changeText;
                changeElement.className = `change ${change >= 0 ? 'positive' : 'negative'}`;
                
                // Add price change animation
                this.addPriceChangeAnimation(priceElement, change);
            }
        });
    }

    updateFearGreedDisplay() {
        const gaugeFill = document.getElementById('gauge-fill');
        const gaugeText = document.getElementById('gauge-text');
        
        if (gaugeFill && gaugeText) {
            const value = this.cache.fearGreed || this.fallbackData.fearGreed;
            gaugeFill.style.width = value + '%';
            
            let text, color;
            if (value < 25) {
                text = 'Extreme Fear';
                color = '#FF0000';
            } else if (value < 45) {
                text = 'Fear';
                color = '#FF4500';
            } else if (value < 55) {
                text = 'Neutral';
                color = '#FFD700';
            } else if (value < 75) {
                text = 'Greed';
                color = '#32CD32';
            } else {
                text = 'Extreme Greed';
                color = '#00FF00';
            }
            
            gaugeText.textContent = text;
            gaugeFill.style.background = color;
            
            // Add index change animation
            this.addFearGreedAnimation(gaugeFill, value);
        }
    }

    updateLastUpdateDisplay() {
        const updateElement = document.getElementById('last-update');
        if (updateElement) {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC'
            });
            updateElement.textContent = `Last Update: ${timeString} UTC`;
        }
    }

    formatPrice(price) {
        if (price >= 1000) {
            return price.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        } else {
            return price.toFixed(2);
        }
    }

    addPriceChangeAnimation(element, change) {
        if (Math.abs(change) > 1) { // Only show animation for changes over 1%
            element.style.transition = 'all 0.3s ease';
            element.style.transform = change > 0 ? 'scale(1.1)' : 'scale(0.9)';
            element.style.color = change > 0 ? '#32CD32' : '#FF4500';
            
            setTimeout(() => {
                element.style.transform = 'scale(1)';
                element.style.color = '#333';
            }, 300);
        }
    }

    addFearGreedAnimation(element, value) {
        element.style.transition = 'all 0.5s ease';
        element.style.boxShadow = `0 0 10px ${element.style.background}`;
        
        setTimeout(() => {
            element.style.boxShadow = 'none';
        }, 500);
    }

    // Manual refresh data
    async refreshData() {
        const refreshBtn = document.getElementById('refresh-data');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.textContent = 'Refreshing...';
        }
        
        await this.updateMarketData();
        
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 Refresh Data';
        }
    }

    // Show/hide loading state
    showLoadingState(loading) {
        const priceCards = document.querySelectorAll('.price-card');
        const gauge = document.querySelector('.gauge');
        
        if (loading) {
            priceCards.forEach(card => {
                card.style.opacity = '0.6';
                card.style.pointerEvents = 'none';
            });
            if (gauge) {
                gauge.style.opacity = '0.6';
            }
        } else {
            priceCards.forEach(card => {
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            });
            if (gauge) {
                gauge.style.opacity = '1';
            }
        }
    }

    // Add error handling and retry mechanism
    async retryFetch(url, maxRetries = 3) {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const response = await fetch(url, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'MobanDoge/1.0'
                    },
                    timeout: 5000
                });

                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return await response.json();
            } catch (error) {
                console.warn(`⚠️ Retry ${i + 1}/${maxRetries} failed:`, error.message);
                if (i === maxRetries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Exponential backoff
            }
        }
    }
}

// Global market data manager instance
const marketDataManager = new MarketDataManager();

// Compatibility for old function name
function startMarketDataUpdates() {
    marketDataManager.start();
}

function updateFearGreedIndex() {
    marketDataManager.updateFearGreedDisplay();
}





// Game manager
class GameManager {
    constructor() {
        this.currentGame = null;
        this.gameScores = {
            rocket: 0,
            meteor: 0,
            coin: 0
        };
        this.isGameRunning = false;
    }

    startGame(gameType, canvas) {
        console.log('🎮 Starting game:', gameType);
        
        // Make sure to stop current game
        this.stopCurrentGame();

        // Start corresponding game by type
        switch(gameType) {
            case 'rocket':
                this.currentGame = new RocketGame(canvas, this);
                break;
            case 'meteor':
                this.currentGame = new MeteorGame(canvas, this);
                break;
            case 'coin':
                this.currentGame = new CoinGame(canvas, this);
                break;
            default:
                console.error('❌ Unknown game type:', gameType);
                return;
        }

        this.isGameRunning = true;
        this.currentGame.start();
    }

    stopCurrentGame() {
        if (this.currentGame) {
            console.log('🛑 Stopping current game');
            this.currentGame.stop();
            this.currentGame = null;
            this.isGameRunning = false;
        }
    }

    endGame(gameType, score) {
        console.log('🏁 Game over:', gameType, score);
        this.gameScores[gameType] = Math.max(this.gameScores[gameType], score);
        
        // Stop current game
        this.stopCurrentGame();
        
        // Restore all game button states
        this.resetGameButtons();
        
        // Show result
        this.showGameResult(gameType, score);
    }

    resetGameButtons() {
        const gameBtns = document.querySelectorAll('.game-btn');
        gameBtns.forEach(btn => {
            btn.textContent = 'Start Game';
            btn.disabled = false;
        });
        console.log('🔄 Game button states restored');
    }
    


    showGameResult(gameType, score) {
        const gameNames = {
            rocket: 'Doge Rocket Launch',
            meteor: 'Doge Meteor Dodge',
            coin: 'Doge Coin Catcher'
        };
        
        console.log('🎮 Show game result:', gameType, score);
        
        // Create result modal
        const resultModal = document.createElement('div');
        resultModal.className = 'game-result-modal';
        resultModal.innerHTML = `
            <div class="result-content">
                <h2>🎮 ${gameNames[gameType]} Game Over!</h2>
                <div class="result-stats">
                    <div class="stat-item">
                        <span class="stat-label">🏆 Final Score</span>
                        <span class="stat-value">${score}</span>
                    </div>
                </div>
                <div class="result-message">
                    💪 Keep trying, challenge for higher scores!
                </div>
                <button class="result-btn" id="close-result-btn">OK</button>
            </div>
        `;
        
        document.body.appendChild(resultModal);
        console.log('✅ Game result modal created');
        
        // Add event listener for OK button
        const closeBtn = resultModal.querySelector('#close-result-btn');
        closeBtn.addEventListener('click', () => {
            console.log('🔘 OK button clicked');
            resultModal.remove();
            // Reset game state for user to restart
            gameManager.currentGame = null;
            console.log('✅ Game state reset');
        });
        
        // Add ESC key to close modal
        const handleEscKey = (e) => {
            if (e.key === 'Escape') {
                resultModal.remove();
                gameManager.currentGame = null;
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
        
        // Click background to close modal
        resultModal.addEventListener('click', (e) => {
            if (e.target === resultModal) {
                resultModal.remove();
                gameManager.currentGame = null;
                document.removeEventListener('keydown', handleEscKey);
            }
        });
    }
}

// Base game class
class BaseGame {
    constructor(canvas, gameManager) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameManager = gameManager;
        this.gameRunning = false;
        this.score = 0;
        this.level = 1;
        this.startTime = 0;
        this.gameDuration = 30000; // 30 seconds
        this.dogeImageLoaded = false;
        this.animationId = null;
    }

    start() {
        console.log('🎯 Game started');
        this.gameRunning = true;
        this.score = 0;
        this.level = 1;
        this.startTime = Date.now();
        this.init();
        this.gameLoop();
    }

    stop() {
        console.log('🛑 Game stopped');
        this.gameRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    init() {
        // Subclasses implement specific initialization
    }

    update() {
        // Subclasses implement specific update logic
    }

    render() {
        // Subclasses implement specific rendering logic
    }

    gameLoop() {
        if (!this.gameRunning) {
            console.log('🛑 Game loop stopped');
            return;
        }

        const currentTime = Date.now();
        const elapsedTime = currentTime - this.startTime;

        if (elapsedTime >= this.gameDuration) {
            console.log('⏰ Game time up, ending game');
            this.gameManager.endGame(this.gameType, this.score);
            return;
        }

        this.update();
        this.render();
        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    // Common rendering method
    drawBackground() {
        this.ctx.fillStyle = '#000033';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw star background
        for (let i = 0; i < 50; i++) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.8 + 0.2})`;
            this.ctx.fillRect(
                Math.random() * this.canvas.width,
                Math.random() * this.canvas.height,
                1,
                1
            );
        }
    }

    drawUI() {
        const elapsedTime = Date.now() - this.startTime;
        const remainingTime = Math.max(0, this.gameDuration - elapsedTime);
        const timePercent = remainingTime / this.gameDuration;

        // Draw score
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = 'bold 16px Arial';
        this.ctx.fillText(`Score: ${this.score}`, 10, 25);
        this.ctx.fillText(`Level: ${this.level}`, 10, 45);

        // Draw time bar
        this.ctx.fillStyle = '#333333';
        this.ctx.fillRect(10, 55, 200, 10);
        this.ctx.fillStyle = timePercent > 0.5 ? '#32CD32' : timePercent > 0.2 ? '#FFD700' : '#FF4500';
        this.ctx.fillRect(10, 55, 200 * timePercent, 10);

        // Draw remaining time
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Time: ${Math.ceil(remainingTime / 1000)}s`, 220, 65);
    }
}

// Rocket launch game
class RocketGame extends BaseGame {
    constructor(canvas, gameManager) {
        super(canvas, gameManager);
        this.gameType = 'rocket';
        this.rockets = [];
        this.targets = [];
        this.explosions = [];
        this.particles = [];
        this.lastRocketTime = 0;
        this.rocketCooldown = 500; // Rocket cooldown time
    }

    init() {
        this.rockets = [];
        this.targets = [];
        this.explosions = [];
        this.lastRocketTime = 0;

        // Set click event
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
    }

    handleClick(e) {
        const currentTime = Date.now();
        if (currentTime - this.lastRocketTime < this.rocketCooldown) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Create rocket
        this.rockets.push({
            x: this.canvas.width / 2,
            y: this.canvas.height - 20,
            targetX: x,
            targetY: y,
            speed: 5,
            angle: Math.atan2(y - (this.canvas.height - 20), x - this.canvas.width / 2)
        });

        this.lastRocketTime = currentTime;
    }

    update() {
        // Update level
        this.level = Math.floor(this.score / 100) + 1;

        // Generate targets
        if (Math.random() < 0.02 + this.level * 0.005) {
            this.targets.push({
                x: Math.random() * (this.canvas.width - 30),
                y: 0,
                width: 20 + Math.random() * 20,
                height: 20 + Math.random() * 20,
                speed: 1 + Math.random() * 2 + this.level * 0.5,
                type: Math.random() < 0.3 ? 'bonus' : 'normal'
            });
        }

        // Update rockets
        this.rockets.forEach((rocket, index) => {
            rocket.x += Math.cos(rocket.angle) * rocket.speed;
            rocket.y += Math.sin(rocket.angle) * rocket.speed;

            // Check if rocket hits target
            this.targets.forEach((target, targetIndex) => {
                if (rocket.x > target.x && rocket.x < target.x + target.width &&
                    rocket.y > target.y && rocket.y < target.y + target.height) {
                    // Hit target
                    this.explosions.push({
                        x: rocket.x,
                        y: rocket.y,
                        size: 30,
                        life: 20
                    });

                    this.rockets.splice(index, 1);
                    this.targets.splice(targetIndex, 1);

                    // Score based on target type
                    if (target.type === 'bonus') {
                        this.score += 50;
                        this.showDogeMessage('WOW! MUCH BONUS! +50', rocket.x, rocket.y);
                    } else {
                        this.score += 10 + this.level * 5;
                        this.showDogeMessage('SUCH SCORE! +' + (10 + this.level * 5), rocket.x, rocket.y);
                    }
                }
            });

            // Remove rockets out of bounds
            if (rocket.x < 0 || rocket.x > this.canvas.width || 
                rocket.y < 0 || rocket.y > this.canvas.height) {
                this.rockets.splice(index, 1);
            }
        });

        // Update targets
        this.targets.forEach((target, index) => {
            target.y += target.speed;
            if (target.y > this.canvas.height) {
                this.targets.splice(index, 1);
            }
        });

        // Update explosions
        this.explosions.forEach((explosion, index) => {
            explosion.life--;
            if (explosion.life <= 0) {
                this.explosions.splice(index, 1);
                // Create particle effect
                this.createParticleExplosion(explosion.x, explosion.y);
            }
        });

        // Update particles
        this.particles.forEach((particle, index) => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.life--;
            particle.vy += 0.1; // Gravity
            
            if (particle.life <= 0) {
                this.particles.splice(index, 1);
            }
        });
    }

    render() {
        this.drawBackground();

        // Draw targets
        this.targets.forEach(target => {
            if (target.type === 'bonus') {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.strokeStyle = '#FF4500';
                this.ctx.lineWidth = 2;
            } else {
                this.ctx.fillStyle = '#32CD32';
                this.ctx.strokeStyle = '#228B22';
                this.ctx.lineWidth = 1;
            }
            
            this.ctx.fillRect(target.x, target.y, target.width, target.height);
            this.ctx.strokeRect(target.x, target.y, target.width, target.height);
        });

        // Draw rockets (Doge rockets)
        this.rockets.forEach(rocket => {
            this.ctx.save();
            this.ctx.translate(rocket.x, rocket.y);
            this.ctx.rotate(rocket.angle);
            
            // Use ogdoge image to draw rocket
            if (window.dogeImage && window.dogeImage.complete) {
                // Draw Doge image as rocket head
                const dogeSize = 20;
                this.ctx.drawImage(window.dogeImage, -dogeSize/2, -dogeSize, dogeSize, dogeSize);
                
                // Draw rocket flame
                this.ctx.fillStyle = '#FF4500';
                this.ctx.fillRect(-3, 0, 6, 12);
                this.ctx.fillStyle = '#FF8C00';
                this.ctx.fillRect(-2, 0, 4, 10);
            } else {
                // Fallback: hand-drawn Doge rocket
                this.ctx.fillStyle = '#FFD700';
                this.ctx.fillRect(-4, -8, 8, 16);
                
                this.ctx.fillStyle = '#F4A460';
                this.ctx.beginPath();
                this.ctx.arc(0, -12, 10, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#8B4513';
                this.ctx.beginPath();
                this.ctx.ellipse(-6, -20, 4, 6, Math.PI / 4, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.ellipse(6, -20, 4, 6, -Math.PI / 4, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#000000';
                this.ctx.beginPath();
                this.ctx.arc(-3, -14, 2, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.beginPath();
                this.ctx.arc(3, -14, 2, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#FF69B4';
                this.ctx.beginPath();
                this.ctx.arc(0, -8, 1.5, 0, Math.PI * 2);
                this.ctx.fill();
                
                this.ctx.fillStyle = '#FF4500';
                this.ctx.fillRect(-3, 8, 6, 10);
            }
            
            this.ctx.restore();
        });

        // Draw explosions
        this.explosions.forEach(explosion => {
            const alpha = explosion.life / 20;
            this.ctx.fillStyle = `rgba(255, 69, 0, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(explosion.x, explosion.y, explosion.size * (1 - alpha), 0, Math.PI * 2);
            this.ctx.fill();
        });

        // Draw particles
        this.particles.forEach(particle => {
            const alpha = particle.life / 70;
            this.ctx.fillStyle = `${particle.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
            
            if (particle.type === 'doge') {
                // Use ogdoge image to draw Doge particles
                if (window.dogeImage && window.dogeImage.complete) {
                    const particleSize = 8;
                    this.ctx.globalAlpha = alpha;
                    this.ctx.drawImage(window.dogeImage, 
                        particle.x - particleSize/2, 
                        particle.y - particleSize/2, 
                        particleSize, 
                        particleSize
                    );
                    this.ctx.globalAlpha = 1;
                } else {
                    // Fallback: hand-drawn Doge particles
                    this.ctx.fillStyle = `${particle.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                    
                    // Dog head
                    this.ctx.beginPath();
                    this.ctx.arc(particle.x, particle.y, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Dog ears
                    this.ctx.beginPath();
                    this.ctx.ellipse(particle.x - 3, particle.y - 5, 2, 3, Math.PI / 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.beginPath();
                    this.ctx.ellipse(particle.x + 3, particle.y - 5, 2, 3, -Math.PI / 4, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Dog eyes
                    this.ctx.fillStyle = `#000000${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                    this.ctx.beginPath();
                    this.ctx.arc(particle.x - 1, particle.y - 1, 0.5, 0, Math.PI * 2);
                    this.ctx.fill();
                    this.ctx.beginPath();
                    this.ctx.arc(particle.x + 1, particle.y - 1, 0.5, 0, Math.PI * 2);
                    this.ctx.fill();
                    
                    // Dog nose
                    this.ctx.fillStyle = `#FF69B4${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                    this.ctx.beginPath();
                    this.ctx.arc(particle.x, particle.y + 1, 0.3, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            } else {
                // Normal particles
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }
        });

        this.drawUI();
    }

    createParticleExplosion(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 10,
                vy: (Math.random() - 0.5) * 10,
                life: 40 + Math.random() * 30,
                color: ['#FF4500', '#FFD700', '#FF8C00', '#8B4513', '#654321'][Math.floor(Math.random() * 5)],
                type: Math.random() < 0.3 ? 'doge' : 'normal'
            });
        }
    }

    showDogeMessage(text, x, y) {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.position = 'absolute';
        message.style.left = (x + this.canvas.offsetLeft) + 'px';
        message.style.top = (y + this.canvas.offsetTop) + 'px';
        message.style.color = '#FFD700';
        message.style.fontWeight = 'bold';
        message.style.fontSize = '0.8rem';
        message.style.textShadow = '1px 1px 2px #000';
        message.style.pointerEvents = 'none';
        message.style.zIndex = '1000';
        message.style.transition = 'all 1s ease-out';
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transform = 'translateY(-30px)';
            message.style.opacity = '0';
        }, 100);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 1100);
    }
}

// Meteor dodge game
class MeteorGame extends BaseGame {
    constructor(canvas, gameManager) {
        super(canvas, gameManager);
        this.gameType = 'meteor';
        this.player = {
            x: canvas.width / 2,
            y: canvas.height - 40,
            width: 30,
            height: 30,
            speed: 5
        };
        this.meteors = [];
        this.powerUps = [];
        this.keys = {};
        this.invincible = false;
        this.invincibleTime = 0;
    }

    init() {
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 40;
        this.meteors = [];
        this.powerUps = [];
        this.keys = {};
        this.invincible = false;
        this.invincibleTime = 0;

        // Set keyboard events
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    update() {
        // Update level
        this.level = Math.floor(this.score / 50) + 1;

        // Player movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.x -= this.player.speed;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.x += this.player.speed;
        }
        if (this.keys['ArrowUp'] || this.keys['KeyW']) {
            this.player.y -= this.player.speed;
        }
        if (this.keys['ArrowDown'] || this.keys['KeyS']) {
            this.player.y += this.player.speed;
        }

        // Limit player to canvas
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));
        this.player.y = Math.max(0, Math.min(this.canvas.height - this.player.height, this.player.y));

        // Generate meteors
        if (Math.random() < 0.03 + this.level * 0.01) {
            this.meteors.push({
                x: Math.random() * (this.canvas.width - 20),
                y: -20,
                width: 15 + Math.random() * 15,
                height: 15 + Math.random() * 15,
                speedX: (Math.random() - 0.5) * 2,
                speedY: 2 + Math.random() * 3 + this.level * 0.5,
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }

        // Generate power-ups
        if (Math.random() < 0.005) {
            this.powerUps.push({
                x: Math.random() * (this.canvas.width - 20),
                y: -20,
                width: 20,
                height: 20,
                speedY: 2,
                type: Math.random() < 0.5 ? 'shield' : 'slow'
            });
        }

        // Update meteors
        this.meteors.forEach((meteor, index) => {
            meteor.x += meteor.speedX;
            meteor.y += meteor.speedY;
            meteor.rotation += meteor.rotationSpeed;

            // Check collision with player
            if (!this.invincible && this.checkCollision(this.player, meteor)) {
                this.gameManager.endGame(this.gameType, this.score);
                return;
            }

            // Remove meteors out of bounds
            if (meteor.y > this.canvas.height || meteor.x < -20 || meteor.x > this.canvas.width) {
                this.meteors.splice(index, 1);
                this.score += 5;
                this.showDogeMessage('MISSED! +5', meteor.x, meteor.y);
            }
        });

        // Update power-ups
        this.powerUps.forEach((powerUp, index) => {
            powerUp.y += powerUp.speedY;

            // Check collision with player
            if (this.checkCollision(this.player, powerUp)) {
                if (powerUp.type === 'shield') {
                    this.invincible = true;
                    this.invincibleTime = Date.now() + 5000; // 5 seconds invincible
                } else if (powerUp.type === 'slow') {
                    // Slow down all meteors
                    this.meteors.forEach(meteor => {
                        meteor.speedY *= 0.5;
                    });
                }
                this.powerUps.splice(index, 1);
            }

            // Remove power-ups out of bounds
            if (powerUp.y > this.canvas.height) {
                this.powerUps.splice(index, 1);
            }
        });

        // Update invincible state
        if (this.invincible && Date.now() > this.invincibleTime) {
            this.invincible = false;
        }

        // Survival bonus
        this.score += 1;
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    render() {
        this.drawBackground();

        // Draw player (Doge ship)
        this.ctx.save();
        this.ctx.translate(this.player.x + this.player.width / 2, this.player.y + this.player.height / 2);
        
        if (this.invincible) {
            this.ctx.globalAlpha = 0.5 + Math.sin(Date.now() * 0.01) * 0.3;
        }

        // Use ogdoge image to draw ship
        if (window.dogeImage && window.dogeImage.complete) {
            // Draw Doge image as ship body
            const dogeSize = 40;
            this.ctx.drawImage(window.dogeImage, -dogeSize/2, -dogeSize/2, dogeSize, dogeSize);
            
            // Draw ship engine
            this.ctx.fillStyle = '#FF4500';
            this.ctx.fillRect(-12, dogeSize/2, 24, 10);
            this.ctx.fillStyle = '#FF8C00';
            this.ctx.fillRect(-10, dogeSize/2, 20, 8);
        } else {
            // Fallback: hand-drawn Doge ship
            this.ctx.fillStyle = '#FFD700';
            this.ctx.fillRect(-25, -15, 50, 30);
            
            this.ctx.fillStyle = '#F4A460';
            this.ctx.beginPath();
            this.ctx.arc(0, -20, 18, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#8B4513';
            this.ctx.beginPath();
            this.ctx.ellipse(-10, -35, 6, 8, Math.PI / 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.ellipse(10, -35, 6, 8, -Math.PI / 6, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(-6, -25, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(6, -25, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#FF69B4';
            this.ctx.beginPath();
            this.ctx.arc(0, -15, 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#FF4500';
            this.ctx.fillRect(-12, 15, 24, 10);
        }
        
        this.ctx.restore();

        // Draw meteors
        this.meteors.forEach(meteor => {
            this.ctx.save();
            this.ctx.translate(meteor.x + meteor.width / 2, meteor.y + meteor.height / 2);
            this.ctx.rotate(meteor.rotation);
            
            this.ctx.fillStyle = '#8B4513';
            this.ctx.fillRect(-meteor.width / 2, -meteor.height / 2, meteor.width, meteor.height);
            
            this.ctx.strokeStyle = '#654321';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(-meteor.width / 2, -meteor.height / 2, meteor.width, meteor.height);
            
            this.ctx.restore();
        });

        // Draw power-ups
        this.powerUps.forEach(powerUp => {
            if (powerUp.type === 'shield') {
                this.ctx.fillStyle = '#00CED1';
                this.ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = '12px Arial';
                this.ctx.fillText('S', powerUp.x + 5, powerUp.y + 15);
            } else {
                this.ctx.fillStyle = '#FF69B4';
                this.ctx.fillRect(powerUp.x, powerUp.y, powerUp.width, powerUp.height);
                this.ctx.fillStyle = '#FFFFFF';
                this.ctx.font = '12px Arial';
                this.ctx.fillText('T', powerUp.x + 5, powerUp.y + 15);
            }
        });

        this.drawUI();
    }

    showDogeMessage(text, x, y) {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.position = 'absolute';
        message.style.left = (x + this.canvas.offsetLeft) + 'px';
        message.style.top = (y + this.canvas.offsetTop) + 'px';
        message.style.color = '#FFD700';
        message.style.fontWeight = 'bold';
        message.style.fontSize = '0.8rem';
        message.style.textShadow = '1px 1px 2px #000';
        message.style.pointerEvents = 'none';
        message.style.zIndex = '1000';
        message.style.transition = 'all 1s ease-out';
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.style.transform = 'translateY(-30px)';
            message.style.opacity = '0';
        }, 100);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 1100);
    }
}

// Coin catch game
class CoinGame extends BaseGame {
    constructor(canvas, gameManager) {
        super(canvas, gameManager);
        this.gameType = 'coin';
        this.player = {
            x: canvas.width / 2,
            y: canvas.height - 40,
            width: 40,
            height: 40,
            speed: 4
        };
        this.coins = [];
        this.bombs = [];
        this.keys = {};
        this.combo = 0;
        this.lastCoinTime = 0;
    }

    init() {
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 40;
        this.coins = [];
        this.bombs = [];
        this.keys = {};
        this.combo = 0;
        this.lastCoinTime = 0;

        // Set keyboard events
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
    }

    update() {
        // Update level
        this.level = Math.floor(this.score / 80) + 1;

        // Player movement
        if (this.keys['ArrowLeft'] || this.keys['KeyA']) {
            this.player.x -= this.player.speed;
        }
        if (this.keys['ArrowRight'] || this.keys['KeyD']) {
            this.player.x += this.player.speed;
        }

        // Limit player to canvas
        this.player.x = Math.max(0, Math.min(this.canvas.width - this.player.width, this.player.x));

        // Generate coins
        if (Math.random() < 0.04 + this.level * 0.01) {
            this.coins.push({
                x: Math.random() * (this.canvas.width - 20),
                y: -20,
                width: 20,
                height: 20,
                speedY: 2 + Math.random() * 2 + this.level * 0.3,
                type: Math.random() < 0.2 ? 'gold' : 'silver',
                rotation: 0,
                rotationSpeed: 0.1
            });
        }

        // Generate bombs
        if (Math.random() < 0.01 + this.level * 0.005) {
            this.bombs.push({
                x: Math.random() * (this.canvas.width - 20),
                y: -20,
                width: 20,
                height: 20,
                speedY: 3 + Math.random() * 2,
                rotation: 0,
                rotationSpeed: 0.2
            });
        }

        // Update coins
        this.coins.forEach((coin, index) => {
            coin.y += coin.speedY;
            coin.rotation += coin.rotationSpeed;

            // Check collision with player
            if (this.checkCollision(this.player, coin)) {
                this.coins.splice(index, 1);
                
                // Score based on coin type
                if (coin.type === 'gold') {
                    this.score += 20;
                    this.combo += 2;
                    this.showDogeMessage('GOLD COIN! +20', coin.x, coin.y);
                } else {
                    this.score += 10;
                    this.combo += 1;
                    this.showDogeMessage('SILVER COIN! +10', coin.x, coin.y);
                }
                
                this.lastCoinTime = Date.now();
            }

            // Remove landed coins
            if (coin.y > this.canvas.height) {
                this.coins.splice(index, 1);
                this.combo = Math.max(0, this.combo - 1);
            }
        });

        // Update bombs
        this.bombs.forEach((bomb, index) => {
            bomb.y += bomb.speedY;
            bomb.rotation += bomb.rotationSpeed;

            // Check collision with player
            if (this.checkCollision(this.player, bomb)) {
                this.gameManager.endGame(this.gameType, this.score);
                return;
            }

            // Remove landed bombs
            if (bomb.y > this.canvas.height) {
                this.bombs.splice(index, 1);
            }
        });

        // Combo bonus
        if (this.combo > 0 && Date.now() - this.lastCoinTime > 2000) {
            this.combo = Math.max(0, this.combo - 1);
        }

        // Combo score bonus
        this.score += Math.floor(this.combo / 5);
    }

    checkCollision(rect1, rect2) {
        return rect1.x < rect2.x + rect2.width &&
               rect1.x + rect1.width > rect2.x &&
               rect1.y < rect2.y + rect2.height &&
               rect1.y + rect1.height > rect2.y;
    }

    render() {
        this.drawBackground();

        // Draw player (Doge basket)
        this.ctx.fillStyle = '#8B4513';
        this.ctx.fillRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.player.x, this.player.y, this.player.width, this.player.height);
        
        // Basket handle
        this.ctx.strokeStyle = '#654321';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.arc(this.player.x + this.player.width / 2, this.player.y - 5, 15, 0, Math.PI);
        this.ctx.stroke();
        
        // Use ogdoge image to draw Doge head decoration
        if (window.dogeImage && window.dogeImage.complete) {
            // Draw Doge image as head decoration
            const dogeSize = 30;
            const dogeX = this.player.x + this.player.width / 2 - dogeSize / 2;
            const dogeY = this.player.y - dogeSize - 5;
            this.ctx.drawImage(window.dogeImage, dogeX, dogeY, dogeSize, dogeSize);
        } else {
            // Fallback: hand-drawn Doge head decoration
            this.ctx.fillStyle = '#F4A460';
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + this.player.width / 2, this.player.y - 20, 15, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#8B4513';
            this.ctx.beginPath();
            this.ctx.ellipse(this.player.x + this.player.width / 2 - 10, this.player.y - 35, 5, 7, Math.PI / 6, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.ellipse(this.player.x + this.player.width / 2 + 10, this.player.y - 35, 5, 7, -Math.PI / 6, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + this.player.width / 2 - 4, this.player.y - 22, 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + this.player.width / 2 + 4, this.player.y - 22, 2, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#FF69B4';
            this.ctx.beginPath();
            this.ctx.arc(this.player.x + this.player.width / 2, this.player.y - 15, 1.5, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Draw coins
        this.coins.forEach(coin => {
            this.ctx.save();
            this.ctx.translate(coin.x + coin.width / 2, coin.y + coin.height / 2);
            this.ctx.rotate(coin.rotation);
            
            if (coin.type === 'gold') {
                this.ctx.fillStyle = '#FFD700';
                this.ctx.strokeStyle = '#FFA500';
            } else {
                this.ctx.fillStyle = '#C0C0C0';
                this.ctx.strokeStyle = '#808080';
            }
            
            this.ctx.beginPath();
            this.ctx.arc(0, 0, coin.width / 2, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();
            
            // Coin center
            this.ctx.fillStyle = '#000000';
            this.ctx.beginPath();
            this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.restore();
        });

        // Draw bombs
        this.bombs.forEach(bomb => {
            this.ctx.save();
            this.ctx.translate(bomb.x + bomb.width / 2, bomb.y + bomb.height / 2);
            this.ctx.rotate(bomb.rotation);
            
            // Bomb body
            this.ctx.fillStyle = '#000000';
            this.ctx.fillRect(-bomb.width / 2, -bomb.height / 2, bomb.width, bomb.height);
            
            // Bomb fuse
            this.ctx.strokeStyle = '#FF4500';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, -bomb.height / 2);
            this.ctx.lineTo(0, -bomb.height / 2 - 10);
            this.ctx.stroke();
            
            this.ctx.restore();
        });

        // Draw combo count
        if (this.combo > 0) {
            this.ctx.fillStyle = '#FFD700';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText(`Combo: ${this.combo}`, this.canvas.width - 100, 25);
        }

        this.drawUI();
    }
}

    // Copy to clipboard function
    window.copyToClipboard = function(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            const text = element.textContent;
            navigator.clipboard.writeText(text).then(() => {
                // Show copy success message
                const copyBtn = element.nextElementSibling;
                if (copyBtn) {
                    const originalText = copyBtn.textContent;
                    copyBtn.textContent = '✅ Copied';
                    copyBtn.style.background = '#32CD32';
                    setTimeout(() => {
                        copyBtn.textContent = originalText;
                        copyBtn.style.background = '#0066CC';
                    }, 2000);
                }
            }).catch(err => {
                console.error('Copy failed:', err);
                alert('Copy failed, please copy manually');
            });
        }
    };

// Global game manager instance
const gameManager = new GameManager();
window.gameManager = gameManager; // Expose to global scope 