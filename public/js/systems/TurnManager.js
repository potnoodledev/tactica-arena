/**
 * TurnManager - Hotseat Turn Management System
 * 
 * Manages turn-based gameplay for two players including:
 * - Player turn switching
 * - Action point management
 * - Turn timers and validation
 * - Victory condition checking
 */

export class TurnManager {
    constructor() {
        this.initialized = false;
        
        // Game state
        this.players = [];
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.gamePhase = 'SETUP'; // 'SETUP', 'PLAYING', 'ENDED'
        
        // Turn data
        this.actionsThisTurn = [];
        this.turnStartTime = 0;
        this.maxTurnTime = 120000; // 2 minutes per turn
        
        // Callbacks
        this.onTurnChanged = null;
        this.onGameEnd = null;
        this.onActionExecuted = null;
        
        // Victory conditions
        this.victoryConditions = {
            elimination: true,
            turnLimit: 50
        };
    }

    init() {
        console.log('Initializing Turn Manager...');
        
        this.initialized = true;
        console.log('Turn Manager initialized');
    }

    startGame(gameConfig) {
        if (!this.initialized) return;
        
        console.log('Starting game with config:', gameConfig);
        
        // Initialize players
        this.players = [
            {
                id: 1,
                name: gameConfig.player1Name,
                teamColor: 'blue',
                isActive: true
            },
            {
                id: 2,
                name: gameConfig.player2Name,
                teamColor: 'red',
                isActive: true
            }
        ];
        
        // Reset game state
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.gamePhase = 'PLAYING';
        this.actionsThisTurn = [];
        
        // Start first turn
        this.startTurn();
    }

    startTurn() {
        if (this.gamePhase !== 'PLAYING') return;
        
        const currentPlayer = this.getCurrentPlayer();
        console.log(`Starting turn ${this.turnNumber} for ${currentPlayer.name}`);
        
        this.turnStartTime = Date.now();
        this.actionsThisTurn = [];
        
        // Restore action points for all current player's units
        // This would typically be done through the battle scene
        this.restorePlayerActionPoints(currentPlayer);
        
        // Notify observers
        if (this.onTurnChanged) {
            this.onTurnChanged(currentPlayer, this.turnNumber);
        }
    }

    endTurn() {
        if (this.gamePhase !== 'PLAYING') return;
        
        const currentPlayer = this.getCurrentPlayer();
        console.log(`Ending turn for ${currentPlayer.name}`);
        
        // Log turn summary
        const turnDuration = Date.now() - this.turnStartTime;
        console.log(`Turn ${this.turnNumber} completed in ${Math.round(turnDuration / 1000)}s with ${this.actionsThisTurn.length} actions`);
        
        // Check for victory conditions
        if (this.checkVictoryConditions()) {
            return; // Game ended
        }
        
        // Switch to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        
        // Increment turn number when we complete a full round
        if (this.currentPlayerIndex === 0) {
            this.turnNumber++;
        }
        
        // Check turn limit
        if (this.turnNumber > this.victoryConditions.turnLimit) {
            this.endGame('TURN_LIMIT', null);
            return;
        }
        
        // Start next turn
        this.startTurn();
    }

    executeAction(action) {
        if (this.gamePhase !== 'PLAYING') return false;
        
        const currentPlayer = this.getCurrentPlayer();
        
        // Validate action
        if (!this.validateAction(action, currentPlayer)) {
            console.warn('Invalid action attempted:', action);
            return false;
        }
        
        // Execute the action
        console.log(`Executing action: ${action.description}`);
        
        // Deduct action points (simplified)
        if (action.unit && action.type !== 'WAIT') {
            action.unit.unitData.currentAP = Math.max(0, action.unit.unitData.currentAP - 1);
        }
        
        // Record action
        this.actionsThisTurn.push({
            ...action,
            timestamp: Date.now(),
            playerIndex: this.currentPlayerIndex
        });
        
        // Notify observers
        if (this.onActionExecuted) {
            this.onActionExecuted(action);
        }
        
        return true;
    }

    validateAction(action, player) {
        // Basic validation
        if (!action || !action.type) return false;
        
        // Check if unit belongs to current player
        if (action.unit && action.unit.unitData.playerId !== player.id) {
            return false;
        }
        
        // Check if unit has enough action points
        if (action.unit && action.type !== 'WAIT') {
            if (action.unit.unitData.currentAP < 1) {
                return false;
            }
        }
        
        // Check if unit is incapacitated
        if (action.unit && action.unit.unitData.isIncapacitated) {
            return false;
        }
        
        return true;
    }

    restorePlayerActionPoints(player) {
        // This would be implemented by the battle scene
        // For now, we'll just log the intent
        console.log(`Restoring action points for ${player.name}`);
    }

    checkVictoryConditions() {
        if (!this.victoryConditions.elimination) return false;
        
        // Check if any player has no units left
        // This would typically check with the battle scene
        // For now, we'll use a placeholder
        
        // Get unit counts for each player (placeholder)
        const playerUnitCounts = this.getPlayerUnitCounts();
        
        for (let i = 0; i < this.players.length; i++) {
            const player = this.players[i];
            const unitCount = playerUnitCounts[player.id] || 0;
            
            if (unitCount === 0) {
                // This player has no units left
                const winner = this.players.find(p => p.id !== player.id);
                this.endGame('ELIMINATION', winner);
                return true;
            }
        }
        
        return false;
    }

    getPlayerUnitCounts() {
        // Placeholder - would get actual counts from battle scene
        return {
            1: 3, // Player 1 has 3 units
            2: 3  // Player 2 has 3 units
        };
    }

    endGame(reason, winner) {
        console.log(`Game ending: ${reason}`, winner);
        
        this.gamePhase = 'ENDED';
        
        if (this.onGameEnd) {
            this.onGameEnd(winner || this.players[0], reason);
        }
    }

    // Getters
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    getOtherPlayer() {
        const otherIndex = (this.currentPlayerIndex + 1) % this.players.length;
        return this.players[otherIndex];
    }

    getTurnTimeRemaining() {
        if (this.gamePhase !== 'PLAYING') return 0;
        
        const elapsed = Date.now() - this.turnStartTime;
        return Math.max(0, this.maxTurnTime - elapsed);
    }

    getTurnProgress() {
        if (this.gamePhase !== 'PLAYING') return 0;
        
        const elapsed = Date.now() - this.turnStartTime;
        return Math.min(1, elapsed / this.maxTurnTime);
    }

    getGameStatistics() {
        return {
            turnNumber: this.turnNumber,
            currentPlayer: this.getCurrentPlayer(),
            gamePhase: this.gamePhase,
            actionsThisTurn: this.actionsThisTurn.length,
            turnTimeRemaining: this.getTurnTimeRemaining(),
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                teamColor: p.teamColor,
                isActive: p.isActive
            }))
        };
    }

    // AI placeholder methods (for future expansion)
    isCurrentPlayerAI() {
        return false; // All players are human in hotseat mode
    }

    getAIMove() {
        // Placeholder for AI decision making
        return null;
    }

    // Turn timer management
    startTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
        }
        
        this.turnTimer = setTimeout(() => {
            console.log('Turn time expired, automatically ending turn');
            this.endTurn();
        }, this.maxTurnTime);
    }

    clearTurnTimer() {
        if (this.turnTimer) {
            clearTimeout(this.turnTimer);
            this.turnTimer = null;
        }
    }

    // Action history
    getActionHistory() {
        return [...this.actionsThisTurn];
    }

    undoLastAction() {
        // Placeholder for undo functionality
        // Would need to implement action reversal
        console.log('Undo not implemented');
        return false;
    }

    // Save/Load game state (for future expansion)
    saveGameState() {
        return {
            players: this.players,
            currentPlayerIndex: this.currentPlayerIndex,
            turnNumber: this.turnNumber,
            gamePhase: this.gamePhase,
            actionsThisTurn: this.actionsThisTurn,
            victoryConditions: this.victoryConditions
        };
    }

    loadGameState(state) {
        if (!state) return false;
        
        this.players = state.players || [];
        this.currentPlayerIndex = state.currentPlayerIndex || 0;
        this.turnNumber = state.turnNumber || 1;
        this.gamePhase = state.gamePhase || 'SETUP';
        this.actionsThisTurn = state.actionsThisTurn || [];
        this.victoryConditions = state.victoryConditions || this.victoryConditions;
        
        return true;
    }

    // Network synchronization placeholders (for future online play)
    syncTurnState() {
        // Would sync turn state with server/other clients
        return true;
    }

    validateTurnSync() {
        // Would validate turn state consistency
        return true;
    }

    // Utility methods
    reset() {
        this.clearTurnTimer();
        
        this.players = [];
        this.currentPlayerIndex = 0;
        this.turnNumber = 1;
        this.gamePhase = 'SETUP';
        this.actionsThisTurn = [];
        this.turnStartTime = 0;
        
        console.log('Turn Manager reset');
    }

    enable() {
        this.gamePhase = 'PLAYING';
    }

    disable() {
        this.clearTurnTimer();
        if (this.gamePhase === 'PLAYING') {
            this.gamePhase = 'PAUSED';
        }
    }

    // Debug methods
    logTurnState() {
        console.log('Turn State:', {
            currentPlayer: this.getCurrentPlayer()?.name,
            turnNumber: this.turnNumber,
            gamePhase: this.gamePhase,
            actionsThisTurn: this.actionsThisTurn.length,
            timeRemaining: this.getTurnTimeRemaining()
        });
    }

    forceEndTurn() {
        console.log('Forcing turn end (debug)');
        this.endTurn();
    }

    forceVictory(playerId) {
        console.log(`Forcing victory for player ${playerId} (debug)`);
        const winner = this.players.find(p => p.id === playerId);
        this.endGame('DEBUG', winner);
    }

    // Cleanup
    destroy() {
        this.clearTurnTimer();
        this.reset();
        this.initialized = false;
        console.log('Turn Manager destroyed');
    }
}