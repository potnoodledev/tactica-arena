/**
 * Tactica Arena - Main Game Entry Point
 * 
 * Initializes the Three.js-based hotseat multiplayer tactical combat game.
 * Integrates with the existing combat system for authentic gameplay mechanics.
 */

import * as THREE from 'three';
import { BattleScene } from './scenes/BattleScene.js';
import { CameraController } from './controllers/CameraController.js';
import { InputController } from './controllers/InputController.js';
import { GameUI } from './ui/GameUI.js';
import { TurnManager } from './systems/TurnManager.js';
import { CombatIntegration } from './systems/CombatIntegration.js';

class TacticaArena {
    constructor() {
        this.isInitialized = false;
        this.isGameRunning = false;
        this.lastTime = 0;
        
        // Core systems
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cameraController = null;
        this.inputController = null;
        this.gameUI = null;
        this.turnManager = null;
        this.combatIntegration = null;
        
        // Game state
        this.gameConfig = {
            mapSize: 'quick', // or 'standard'
            player1Name: 'Player 1',
            player2Name: 'Player 2'
        };
        
        this.currentState = 'loading'; // 'loading', 'start', 'playing', 'victory'
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
        this.onWindowResize = this.onWindowResize.bind(this);
        this.onStartGame = this.onStartGame.bind(this);
        this.onPlayAgain = this.onPlayAgain.bind(this);
        this.onMainMenu = this.onMainMenu.bind(this);
    }

    async init() {
        console.log('Initializing Tactica Arena...');
        
        try {
            // Initialize Three.js renderer
            await this.initializeRenderer();
            
            // Initialize game systems
            await this.initializeSystems();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start with the start screen
            this.showStartScreen();
            
            this.isInitialized = true;
            console.log('Tactica Arena initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize Tactica Arena:', error);
            this.showErrorMessage('Failed to initialize game. Please refresh the page.');
        }
    }

    async initializeRenderer() {
        const canvas = document.getElementById('game-canvas');
        if (!canvas) {
            throw new Error('Game canvas not found');
        }

        // Create WebGL renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true,
            alpha: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        
        // Enable shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Set background color
        this.renderer.setClearColor(0x0a0a1a, 1);
        
        console.log('WebGL Renderer initialized');
    }

    async initializeSystems() {
        // Initialize battle scene
        this.battleScene = new BattleScene();
        await this.battleScene.init();
        
        // Initialize camera (will be set up by scene)
        this.camera = this.battleScene.camera;
        
        // Initialize camera controller
        this.cameraController = new CameraController(this.camera, this.renderer.domElement);
        this.cameraController.init();
        
        // Initialize input controller
        this.inputController = new InputController(this.camera, this.battleScene);
        this.inputController.init();
        
        // Initialize game UI
        this.gameUI = new GameUI();
        this.gameUI.init();
        
        // Initialize turn manager
        this.turnManager = new TurnManager();
        this.turnManager.init();
        
        // Initialize combat integration
        this.combatIntegration = new CombatIntegration();
        await this.combatIntegration.init();
        
        // Connect systems
        this.connectSystems();
        
        console.log('Game systems initialized');
    }

    connectSystems() {
        // Connect input controller to battle scene
        this.inputController.onUnitSelected = (unit) => {
            this.gameUI.showUnitInfo(unit);
            this.battleScene.selectUnit(unit);
        };
        
        this.inputController.onUnitDeselected = () => {
            this.gameUI.hideUnitInfo();
            this.battleScene.clearSelection();
        };
        
        this.inputController.onMovePreview = (unit, targetPosition) => {
            this.battleScene.showMovementPreview(unit, targetPosition);
        };
        
        this.inputController.onAttackPreview = (attacker, target) => {
            this.gameUI.showCombatPreview(attacker, target);
        };
        
        this.inputController.onActionExecuted = (action) => {
            this.turnManager.executeAction(action);
            this.gameUI.addMessage(action.description, action.type);
        };
        
        // Connect turn manager to UI
        this.turnManager.onTurnChanged = (currentPlayer, turnNumber) => {
            this.gameUI.updateCurrentPlayer(currentPlayer, turnNumber);
            this.battleScene.setCurrentPlayer(currentPlayer);
            this.gameUI.addMessage(`${currentPlayer.name}'s turn begins`, 'turn');
        };
        
        this.turnManager.onGameEnd = (winner) => {
            this.showVictoryScreen(winner);
        };
        
        // Connect UI callbacks
        this.gameUI.onEndTurn = () => {
            this.turnManager.endTurn();
        };
        
        this.gameUI.onActionButtonClicked = (action) => {
            this.inputController.setActionMode(action);
        };
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', this.onWindowResize);
        
        // Start screen buttons
        const startButton = document.getElementById('start-game-btn');
        if (startButton) {
            startButton.addEventListener('click', this.onStartGame);
        }
        
        // Victory screen buttons
        const playAgainButton = document.getElementById('play-again-btn');
        if (playAgainButton) {
            playAgainButton.addEventListener('click', this.onPlayAgain);
        }
        
        const mainMenuButton = document.getElementById('main-menu-btn');
        if (mainMenuButton) {
            mainMenuButton.addEventListener('click', this.onMainMenu);
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            if (!this.isGameRunning) return;
            
            switch (event.code) {
                case 'Space':
                    event.preventDefault();
                    this.turnManager.endTurn();
                    break;
                case 'Escape':
                    event.preventDefault();
                    this.inputController.cancelCurrentAction();
                    break;
            }
        });
        
        console.log('Event listeners set up');
    }

    async onStartGame() {
        try {
            // Get game configuration from form
            this.gameConfig.mapSize = document.getElementById('map-size')?.value || 'quick';
            this.gameConfig.player1Name = document.getElementById('player1-name')?.value || 'Player 1';
            this.gameConfig.player2Name = document.getElementById('player2-name')?.value || 'Player 2';
            
            console.log('Starting new game with config:', this.gameConfig);
            
            // Show loading
            this.showLoadingScreen('Preparing battlefield...');
            
            // Create combat match
            const combatMatch = this.combatIntegration.createMatch(this.gameConfig);
            
            // Initialize battle with configuration
            await this.battleScene.setupBattle(this.gameConfig);
            
            // Register all units with combat system
            const allUnits = this.battleScene.getAllUnits();
            allUnits.forEach(unit3D => {
                this.combatIntegration.registerUnit(unit3D);
            });
            
            // Initialize turn manager with players
            this.turnManager.startGame(this.gameConfig);
            
            // Update UI with team information
            this.gameUI.setupTeams(this.turnManager.players, this.battleScene.getAllUnits());
            
            // Start the game
            this.startGame();
            
        } catch (error) {
            console.error('Failed to start game:', error);
            this.showErrorMessage('Failed to start game. Please try again.');
        }
    }

    startGame() {
        this.currentState = 'playing';
        this.isGameRunning = true;
        
        // Hide loading/start screens, show game
        this.hideLoadingScreen();
        this.hideStartScreen();
        this.showGameUI();
        
        // Start game loop
        this.gameLoop();
        
        // Add welcome message
        this.gameUI.addMessage('Battle begins! Select a unit to start.', 'turn');
        
        console.log('Game started!');
    }

    gameLoop(currentTime = 0) {
        if (!this.isGameRunning) return;
        
        const deltaTime = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        // Update systems
        if (this.battleScene) {
            this.battleScene.update(deltaTime);
        }
        
        if (this.cameraController) {
            this.cameraController.update(deltaTime);
        }
        
        if (this.inputController) {
            this.inputController.update(deltaTime);
        }
        
        // Render frame
        if (this.battleScene && this.camera) {
            this.renderer.render(this.battleScene.scene, this.camera);
        }
        
        // Continue loop
        requestAnimationFrame(this.gameLoop);
    }

    onWindowResize() {
        if (!this.renderer || !this.camera) return;
        
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Update camera
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        // Update renderer
        this.renderer.setSize(width, height);
        
        console.log(`Resized to ${width}x${height}`);
    }

    onPlayAgain() {
        this.hideVictoryScreen();
        this.showStartScreen();
        this.resetGame();
    }

    onMainMenu() {
        this.hideVictoryScreen();
        this.hideGameUI();
        this.showStartScreen();
        this.resetGame();
    }

    resetGame() {
        this.isGameRunning = false;
        this.currentState = 'start';
        
        if (this.battleScene) {
            this.battleScene.cleanup();
        }
        
        if (this.turnManager) {
            this.turnManager.reset();
        }
        
        if (this.gameUI) {
            this.gameUI.reset();
        }
        
        console.log('Game reset');
    }

    showVictoryScreen(winner) {
        this.isGameRunning = false;
        this.currentState = 'victory';
        
        const victoryScreen = document.getElementById('victory-screen');
        const victoryMessage = document.getElementById('victory-message');
        
        if (victoryScreen && victoryMessage) {
            victoryMessage.textContent = `${winner.name} wins the battle!`;
            victoryScreen.classList.remove('hidden');
        }
        
        console.log(`Game ended: ${winner.name} wins!`);
    }

    // UI State Management
    showLoadingScreen(message = 'Loading...') {
        const loadingScreen = document.getElementById('loading-screen');
        const loadingText = document.querySelector('.loading-text');
        
        if (loadingScreen) loadingScreen.classList.remove('hidden');
        if (loadingText) loadingText.textContent = message;
        
        this.hideStartScreen();
        this.hideGameUI();
        this.hideVictoryScreen();
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.classList.add('hidden');
    }

    showStartScreen() {
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.classList.remove('hidden');
        
        this.hideLoadingScreen();
        this.hideGameUI();
        this.hideVictoryScreen();
    }

    hideStartScreen() {
        const startScreen = document.getElementById('start-screen');
        if (startScreen) startScreen.classList.add('hidden');
    }

    showGameUI() {
        const gameCanvas = document.getElementById('game-canvas');
        const gameUI = document.getElementById('game-ui');
        
        if (gameCanvas) gameCanvas.classList.remove('hidden');
        if (gameUI) gameUI.classList.remove('hidden');
        
        this.hideLoadingScreen();
        this.hideStartScreen();
        this.hideVictoryScreen();
    }

    hideGameUI() {
        const gameCanvas = document.getElementById('game-canvas');
        const gameUI = document.getElementById('game-ui');
        
        if (gameCanvas) gameCanvas.classList.add('hidden');
        if (gameUI) gameUI.classList.add('hidden');
    }

    hideVictoryScreen() {
        const victoryScreen = document.getElementById('victory-screen');
        if (victoryScreen) victoryScreen.classList.add('hidden');
    }

    showErrorMessage(message) {
        alert(`Error: ${message}`);
        console.error(message);
    }

    // Cleanup
    destroy() {
        this.isGameRunning = false;
        
        // Remove event listeners
        window.removeEventListener('resize', this.onWindowResize);
        
        // Cleanup systems
        if (this.battleScene) {
            this.battleScene.destroy();
        }
        
        if (this.cameraController) {
            this.cameraController.destroy();
        }
        
        if (this.inputController) {
            this.inputController.destroy();
        }
        
        if (this.gameUI) {
            this.gameUI.destroy();
        }
        
        if (this.combatIntegration) {
            this.combatIntegration.destroy();
        }
        
        if (this.renderer) {
            this.renderer.dispose();
        }
        
        console.log('Tactica Arena destroyed');
    }
}

// Initialize game when DOM is loaded
let game = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM loaded, initializing Tactica Arena...');
    
    try {
        game = new TacticaArena();
        await game.init();
    } catch (error) {
        console.error('Failed to initialize game:', error);
        alert('Failed to load the game. Please refresh the page and try again.');
    }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (game) {
        game.destroy();
    }
});

// Export for debugging
if (typeof window !== 'undefined') {
    window.TacticaArena = TacticaArena;
    window.game = game;
}