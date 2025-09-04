/**
 * GameUI - User Interface Management
 * 
 * Manages all UI elements including:
 * - Unit information panels
 * - Combat previews
 * - Team status displays
 * - Message log
 * - Action buttons
 */

export class GameUI {
    constructor() {
        this.initialized = false;
        
        // DOM references
        this.elements = {
            // Unit info panel
            selectedUnitInfo: null,
            unitName: null,
            unitClass: null,
            unitLevel: null,
            healthFill: null,
            healthText: null,
            apDots: null,
            apText: null,
            statElements: {},
            
            // Action buttons
            moveBtn: null,
            attackBtn: null,
            waitBtn: null,
            
            // Combat preview
            combatPreview: null,
            hitChance: null,
            damageRange: null,
            critChance: null,
            confirmAttackBtn: null,
            cancelAttackBtn: null,
            
            // Top bar
            currentPlayerName: null,
            turnNumber: null,
            endTurnBtn: null,
            
            // Team status
            teamAUnits: null,
            teamBUnits: null,
            
            // Message log
            messageLog: null
        };
        
        // Callbacks
        this.onEndTurn = null;
        this.onActionButtonClicked = null;
        
        // Current state
        this.currentUnit = null;
        this.currentPlayer = null;
        this.turnNumber = 1;
        
        // Bind methods
        this.handleActionButton = this.handleActionButton.bind(this);
        this.handleEndTurn = this.handleEndTurn.bind(this);
        this.handleConfirmAttack = this.handleConfirmAttack.bind(this);
        this.handleCancelAttack = this.handleCancelAttack.bind(this);
    }

    init() {
        console.log('Initializing Game UI...');
        
        // Get DOM references
        this.initializeElements();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI state
        this.hideUnitInfo();
        this.hideCombatPreview();
        
        this.initialized = true;
        console.log('Game UI initialized');
    }

    initializeElements() {
        this.elements.selectedUnitInfo = document.getElementById('selected-unit-info');
        this.elements.unitName = document.getElementById('unit-name');
        this.elements.unitClass = document.getElementById('unit-class');
        this.elements.unitLevel = document.getElementById('unit-level');
        this.elements.healthFill = document.getElementById('health-fill');
        this.elements.healthText = document.getElementById('health-text');
        this.elements.apDots = document.getElementById('ap-dots');
        this.elements.apText = document.getElementById('ap-text');
        
        // Stat elements
        this.elements.statElements = {
            atk: document.getElementById('stat-atk'),
            def: document.getElementById('stat-def'),
            mag: document.getElementById('stat-mag'),
            res: document.getElementById('stat-res'),
            agl: document.getElementById('stat-agl'),
            mov: document.getElementById('stat-mov')
        };
        
        // Action buttons
        this.elements.moveBtn = document.getElementById('move-btn');
        this.elements.attackBtn = document.getElementById('attack-btn');
        this.elements.waitBtn = document.getElementById('wait-btn');
        
        // Combat preview
        this.elements.combatPreview = document.getElementById('combat-preview');
        this.elements.hitChance = document.getElementById('hit-chance');
        this.elements.damageRange = document.getElementById('damage-range');
        this.elements.critChance = document.getElementById('crit-chance');
        this.elements.confirmAttackBtn = document.getElementById('confirm-attack-btn');
        this.elements.cancelAttackBtn = document.getElementById('cancel-attack-btn');
        
        // Top bar
        this.elements.currentPlayerName = document.getElementById('current-player-name');
        this.elements.turnNumber = document.getElementById('turn-number');
        this.elements.endTurnBtn = document.getElementById('end-turn-btn');
        
        // Team status
        this.elements.teamAUnits = document.getElementById('team-a-units');
        this.elements.teamBUnits = document.getElementById('team-b-units');
        
        // Message log
        this.elements.messageLog = document.getElementById('message-log');
    }

    setupEventListeners() {
        // Action buttons
        if (this.elements.moveBtn) {
            this.elements.moveBtn.addEventListener('click', () => this.handleActionButton('MOVE'));
        }
        if (this.elements.attackBtn) {
            this.elements.attackBtn.addEventListener('click', () => this.handleActionButton('ATTACK'));
        }
        if (this.elements.waitBtn) {
            this.elements.waitBtn.addEventListener('click', () => this.handleActionButton('WAIT'));
        }
        
        // End turn button
        if (this.elements.endTurnBtn) {
            this.elements.endTurnBtn.addEventListener('click', this.handleEndTurn);
        }
        
        // Combat preview buttons
        if (this.elements.confirmAttackBtn) {
            this.elements.confirmAttackBtn.addEventListener('click', this.handleConfirmAttack);
        }
        if (this.elements.cancelAttackBtn) {
            this.elements.cancelAttackBtn.addEventListener('click', this.handleCancelAttack);
        }
    }

    // Unit information display
    showUnitInfo(unit3D) {
        if (!this.initialized || !unit3D) return;
        
        this.currentUnit = unit3D;
        const unitData = unit3D.unitData;
        
        // Update unit basic info
        if (this.elements.unitName) {
            this.elements.unitName.textContent = unitData.name;
        }
        if (this.elements.unitClass) {
            this.elements.unitClass.textContent = unitData.class;
        }
        if (this.elements.unitLevel) {
            this.elements.unitLevel.textContent = unitData.level;
        }
        
        // Update health bar
        this.updateHealthBar(unitData);
        
        // Update action points
        this.updateActionPoints(unitData);
        
        // Update stats
        this.updateStats(unitData.stats);
        
        // Update action buttons
        this.updateActionButtons(unitData);
        
        // Show the panel
        if (this.elements.selectedUnitInfo) {
            this.elements.selectedUnitInfo.classList.remove('hidden');
        }
    }

    hideUnitInfo() {
        this.currentUnit = null;
        if (this.elements.selectedUnitInfo) {
            this.elements.selectedUnitInfo.classList.add('hidden');
        }
    }

    updateHealthBar(unitData) {
        if (!this.elements.healthFill || !this.elements.healthText) return;
        
        const healthPercent = (unitData.currentHP / unitData.stats.HP) * 100;
        
        // Update fill
        this.elements.healthFill.style.width = `${healthPercent}%`;
        
        // Update text
        this.elements.healthText.textContent = `${unitData.currentHP}/${unitData.stats.HP}`;
        
        // Update color based on health level
        this.elements.healthFill.classList.remove('low', 'critical');
        if (healthPercent < 25) {
            this.elements.healthFill.classList.add('critical');
        } else if (healthPercent < 50) {
            this.elements.healthFill.classList.add('low');
        }
    }

    updateActionPoints(unitData) {
        if (!this.elements.apDots || !this.elements.apText) return;
        
        // Update text
        this.elements.apText.textContent = `${unitData.currentAP}/3`;
        
        // Update dots
        const dots = this.elements.apDots.querySelectorAll('.ap-dot');
        dots.forEach((dot, index) => {
            if (index < unitData.currentAP) {
                dot.classList.add('active');
            } else {
                dot.classList.remove('active');
            }
        });
    }

    updateStats(stats) {
        for (const [statName, element] of Object.entries(this.elements.statElements)) {
            if (element && stats[statName.toUpperCase()]) {
                element.textContent = stats[statName.toUpperCase()];
            }
        }
    }

    updateActionButtons(unitData) {
        const canMove = unitData.currentAP >= 1 && !unitData.isIncapacitated;
        const canAttack = unitData.currentAP >= 1 && !unitData.isIncapacitated;
        const canWait = !unitData.isIncapacitated;
        
        if (this.elements.moveBtn) {
            this.elements.moveBtn.disabled = !canMove;
        }
        if (this.elements.attackBtn) {
            this.elements.attackBtn.disabled = !canAttack;
        }
        if (this.elements.waitBtn) {
            this.elements.waitBtn.disabled = !canWait;
        }
    }

    // Combat preview
    showCombatPreview(attacker, target) {
        if (!this.initialized || !attacker || !target) return;
        
        // Calculate preview data (simplified)
        const hitChance = this.calculateHitChance(attacker, target);
        const damageRange = this.calculateDamageRange(attacker, target);
        const critChance = this.calculateCritChance(attacker);
        
        // Update preview elements
        if (this.elements.hitChance) {
            this.elements.hitChance.textContent = `${Math.round(hitChance * 100)}%`;
        }
        if (this.elements.damageRange) {
            this.elements.damageRange.textContent = `${damageRange.min}-${damageRange.max}`;
        }
        if (this.elements.critChance) {
            this.elements.critChance.textContent = `${Math.round(critChance * 100)}%`;
        }
        
        // Show preview panel
        if (this.elements.combatPreview) {
            this.elements.combatPreview.classList.remove('hidden');
        }
    }

    hideCombatPreview() {
        if (this.elements.combatPreview) {
            this.elements.combatPreview.classList.add('hidden');
        }
    }

    calculateHitChance(attacker, target) {
        // Simplified hit chance calculation
        const baseHit = 0.75;
        const attackerAGL = attacker.unitData.stats.AGL || 15;
        const targetAGL = target.unitData.stats.AGL || 15;
        
        const aglDiff = (attackerAGL - targetAGL) * 0.02;
        return Math.max(0.1, Math.min(0.95, baseHit + aglDiff));
    }

    calculateDamageRange(attacker, target) {
        // Simplified damage calculation
        const baseATK = attacker.unitData.stats.ATK || 25;
        const targetDEF = target.unitData.stats.DEF || 15;
        
        const damage = Math.max(1, baseATK - targetDEF);
        return {
            min: Math.max(1, Math.floor(damage * 0.8)),
            max: Math.floor(damage * 1.2)
        };
    }

    calculateCritChance(attacker) {
        // Simplified critical chance
        const baseCrit = 0.05;
        const luck = (attacker.unitData.stats.LCK || 8) * 0.005;
        return Math.min(0.25, baseCrit + luck);
    }

    // Turn management
    updateCurrentPlayer(player, turnNum) {
        this.currentPlayer = player;
        this.turnNumber = turnNum;
        
        if (this.elements.currentPlayerName) {
            this.elements.currentPlayerName.textContent = player.name;
        }
        if (this.elements.turnNumber) {
            this.elements.turnNumber.textContent = turnNum;
        }
    }

    // Team status
    setupTeams(players, units) {
        if (!this.initialized) return;
        
        // Clear existing team displays
        if (this.elements.teamAUnits) {
            this.elements.teamAUnits.innerHTML = '';
        }
        if (this.elements.teamBUnits) {
            this.elements.teamBUnits.innerHTML = '';
        }
        
        // Group units by player
        const teamAUnits = units.filter(unit => unit.unitData.playerId === 1);
        const teamBUnits = units.filter(unit => unit.unitData.playerId === 2);
        
        // Create team unit displays
        this.createTeamDisplay(this.elements.teamAUnits, teamAUnits);
        this.createTeamDisplay(this.elements.teamBUnits, teamBUnits);
    }

    createTeamDisplay(container, units) {
        if (!container) return;
        
        units.forEach(unit3D => {
            const unitElement = document.createElement('div');
            unitElement.className = 'team-unit';
            unitElement.dataset.unitId = unit3D.unitData.id;
            
            unitElement.innerHTML = `
                <span class="unit-name">${unit3D.unitData.name}</span>
                <div class="unit-mini-health">
                    <div class="unit-mini-health-fill"></div>
                </div>
            `;
            
            container.appendChild(unitElement);
            
            // Update health display
            this.updateTeamUnitHealth(unit3D);
        });
    }

    updateTeamUnitHealth(unit3D) {
        const unitElement = document.querySelector(`[data-unit-id="${unit3D.unitData.id}"]`);
        if (!unitElement) return;
        
        const healthFill = unitElement.querySelector('.unit-mini-health-fill');
        if (!healthFill) return;
        
        const healthPercent = (unit3D.unitData.currentHP / unit3D.unitData.stats.HP) * 100;
        healthFill.style.width = `${healthPercent}%`;
        
        // Update color
        healthFill.classList.remove('low');
        if (healthPercent < 50) {
            healthFill.classList.add('low');
        }
        
        // Mark as incapacitated
        if (unit3D.unitData.currentHP <= 0) {
            unitElement.classList.add('incapacitated');
        }
        
        // Mark as selected
        if (this.currentUnit === unit3D) {
            unitElement.classList.add('selected');
        } else {
            unitElement.classList.remove('selected');
        }
    }

    // Message log
    addMessage(message, type = 'info') {
        if (!this.elements.messageLog) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        this.elements.messageLog.appendChild(messageElement);
        
        // Scroll to bottom
        this.elements.messageLog.scrollTop = this.elements.messageLog.scrollHeight;
        
        // Limit number of messages
        const messages = this.elements.messageLog.children;
        if (messages.length > 50) {
            this.elements.messageLog.removeChild(messages[0]);
        }
    }

    clearMessages() {
        if (this.elements.messageLog) {
            this.elements.messageLog.innerHTML = '';
        }
    }

    // Event handlers
    handleActionButton(action) {
        if (this.onActionButtonClicked) {
            this.onActionButtonClicked(action);
        }
    }

    handleEndTurn() {
        if (this.onEndTurn) {
            this.onEndTurn();
        }
    }

    handleConfirmAttack() {
        this.hideCombatPreview();
        // The actual attack should be handled by the input controller
    }

    handleCancelAttack() {
        this.hideCombatPreview();
        if (this.onActionButtonClicked) {
            this.onActionButtonClicked('CANCEL_ATTACK');
        }
    }

    // Update methods
    updateUnitDisplay(unit3D) {
        // Update unit info if it's currently selected
        if (this.currentUnit === unit3D) {
            this.showUnitInfo(unit3D);
        }
        
        // Update team status
        this.updateTeamUnitHealth(unit3D);
    }

    // State management
    reset() {
        this.currentUnit = null;
        this.currentPlayer = null;
        this.turnNumber = 1;
        
        this.hideUnitInfo();
        this.hideCombatPreview();
        this.clearMessages();
        
        // Clear team displays
        if (this.elements.teamAUnits) {
            this.elements.teamAUnits.innerHTML = '';
        }
        if (this.elements.teamBUnits) {
            this.elements.teamBUnits.innerHTML = '';
        }
    }

    // Utility methods
    enable() {
        // Enable UI interactions
        const buttons = document.querySelectorAll('.action-btn, .end-turn-btn, .confirm-btn, .cancel-btn');
        buttons.forEach(btn => {
            btn.disabled = false;
        });
    }

    disable() {
        // Disable UI interactions
        const buttons = document.querySelectorAll('.action-btn, .end-turn-btn, .confirm-btn, .cancel-btn');
        buttons.forEach(btn => {
            btn.disabled = true;
        });
    }

    // Cleanup
    destroy() {
        if (this.elements.moveBtn) {
            this.elements.moveBtn.removeEventListener('click', this.handleActionButton);
        }
        if (this.elements.attackBtn) {
            this.elements.attackBtn.removeEventListener('click', this.handleActionButton);
        }
        if (this.elements.waitBtn) {
            this.elements.waitBtn.removeEventListener('click', this.handleActionButton);
        }
        if (this.elements.endTurnBtn) {
            this.elements.endTurnBtn.removeEventListener('click', this.handleEndTurn);
        }
        if (this.elements.confirmAttackBtn) {
            this.elements.confirmAttackBtn.removeEventListener('click', this.handleConfirmAttack);
        }
        if (this.elements.cancelAttackBtn) {
            this.elements.cancelAttackBtn.removeEventListener('click', this.handleCancelAttack);
        }
        
        this.initialized = false;
        console.log('Game UI destroyed');
    }
}