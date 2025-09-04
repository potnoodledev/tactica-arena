/**
 * CombatIntegration - Bridge between 3D game and combat system
 * 
 * Provides integration with the Tactica Arena combat system located in src/combat/
 * Handles unit creation, combat calculations, and state synchronization.
 */

// Import the actual combat system from src/combat
import { CombatPreview } from '../../../src/combat/index.js';

export class CombatIntegration {
    constructor() {
        this.initialized = false;
        this.combatSystem = null;
        this.currentMatch = null;
        this.unitDataMap = new Map(); // Maps 3D units to combat system units
    }

    async init() {
        console.log('Initializing Combat Integration...');
        
        try {
            // Initialize the actual combat system
            this.combatSystem = new CombatPreview();
            await this.combatSystem.init();
            
            this.initialized = true;
            console.log('Combat Integration initialized with real combat system');
        } catch (error) {
            console.warn('Failed to load combat system, using simplified version:', error);
            // Fallback to simplified system
            this.combatSystem = new SimplifiedCombatSystem();
            await this.combatSystem.init();
            this.initialized = true;
        }
    }

    createMatch(gameConfig) {
        if (!this.initialized) return null;
        
        const matchConfig = {
            matchId: `hotseat_${Date.now()}`,
            seed: Date.now(),
            players: [
                {
                    id: 1,
                    name: gameConfig.player1Name,
                    units: []
                },
                {
                    id: 2,
                    name: gameConfig.player2Name,
                    units: []
                }
            ],
            mapWidth: gameConfig.mapSize === 'standard' ? 24 : 18,
            mapHeight: gameConfig.mapSize === 'standard' ? 24 : 18
        };
        
        this.currentMatch = this.combatSystem.createMatch(matchConfig);
        return this.currentMatch;
    }

    registerUnit(unit3D) {
        if (!this.currentMatch) return false;
        
        // Convert Unit3D data to combat system format
        const combatUnitData = this.convertToCombatUnit(unit3D.unitData);
        
        // Create combat system unit
        const combatUnit = this.combatSystem.createUnit(combatUnitData);
        
        // Store mapping
        this.unitDataMap.set(unit3D.unitData.id, combatUnit);
        
        return combatUnit;
    }

    convertToCombatUnit(unitData) {
        return {
            id: unitData.id,
            name: unitData.name,
            class: unitData.class,
            faction: unitData.faction,
            level: unitData.level,
            isLeader: unitData.isLeader,
            // Convert visible stats to combat system format
            hiddenAbilities: {
                STR: this.deriveHiddenStat(unitData.stats.ATK, 'STR'),
                DEX: this.deriveHiddenStat(unitData.stats.AGL, 'DEX'),
                CON: this.deriveHiddenStat(unitData.stats.HP, 'CON'),
                INT: this.deriveHiddenStat(unitData.stats.MAG, 'INT'),
                WIS: this.deriveHiddenStat(unitData.stats.RES, 'WIS'),
                CHA: this.deriveHiddenStat(unitData.stats.LCK, 'CHA')
            },
            position: unitData.position,
            facing: 'north'
        };
    }

    deriveHiddenStat(visibleStat, type) {
        // Reverse-engineer hidden stats from visible stats
        // This is a simplified approximation
        switch (type) {
            case 'STR':
                return Math.min(18, Math.max(8, Math.floor(visibleStat / 3) + 8));
            case 'DEX':
                return Math.min(18, Math.max(8, Math.floor(visibleStat / 2) + 8));
            case 'CON':
                return Math.min(18, Math.max(8, Math.floor(visibleStat / 15) + 8));
            case 'INT':
                return Math.min(18, Math.max(8, Math.floor(visibleStat / 3) + 8));
            case 'WIS':
                return Math.min(18, Math.max(8, Math.floor(visibleStat / 2) + 8));
            case 'CHA':
                return Math.min(18, Math.max(8, Math.floor(visibleStat / 2) + 8));
            default:
                return 12;
        }
    }

    previewAttack(attackerUnit3D, targetUnit3D) {
        if (!this.currentMatch || !this.initialized) return null;
        
        const attackerId = attackerUnit3D.unitData.id;
        const targetId = targetUnit3D.unitData.id;
        
        // Use simplified combat preview
        return this.combatSystem.previewAttack(attackerId, targetId);
    }

    executeAttack(attackerUnit3D, targetUnit3D) {
        if (!this.currentMatch || !this.initialized) return null;
        
        const attackerId = attackerUnit3D.unitData.id;
        const targetId = targetUnit3D.unitData.id;
        
        // Execute attack through combat system
        const result = this.combatSystem.executeAttack(attackerId, targetId);
        
        // Update 3D unit data based on combat result
        if (result.success) {
            this.synchronizeUnitData(targetUnit3D, result.targetState);
            if (result.attackerState) {
                this.synchronizeUnitData(attackerUnit3D, result.attackerState);
            }
        }
        
        return result;
    }

    previewMovement(unit3D, targetPosition) {
        if (!this.currentMatch || !this.initialized) return null;
        
        const unitId = unit3D.unitData.id;
        
        return this.combatSystem.previewMovement(unitId, targetPosition);
    }

    executeMovement(unit3D, targetPosition) {
        if (!this.currentMatch || !this.initialized) return null;
        
        const unitId = unit3D.unitData.id;
        
        const result = this.combatSystem.executeMovement(unitId, targetPosition);
        
        if (result.success) {
            this.synchronizeUnitData(unit3D, result.unitState);
        }
        
        return result;
    }

    synchronizeUnitData(unit3D, combatState) {
        // Update 3D unit with combat system state
        const updates = {
            currentHP: combatState.currentHP,
            currentMP: combatState.currentMP,
            currentAP: combatState.currentAP,
            position: combatState.position,
            statusEffects: combatState.statusEffects || [],
            isIncapacitated: combatState.isIncapacitated
        };
        
        unit3D.updateUnitData(updates);
    }

    // Terrain integration
    getTerrainEffects(gridX, gridY) {
        // This would integrate with the terrain system
        return {
            moveCost: 1,
            cover: 0,
            evasion: 0,
            height: 0
        };
    }

    // Initiative and turn order
    calculateInitiativeOrder(units) {
        if (!this.currentMatch) return [];
        
        const unitIds = units.map(unit => unit.unitData.id);
        return this.combatSystem.calculateInitiative(unitIds);
    }

    destroy() {
        this.unitDataMap.clear();
        this.currentMatch = null;
        this.initialized = false;
        console.log('Combat Integration destroyed');
    }
}

/**
 * Simplified Combat System for prototype
 * This replaces the complex d20 system with simplified calculations
 */
class SimplifiedCombatSystem {
    constructor() {
        this.matches = new Map();
        this.units = new Map();
    }

    async init() {
        // Initialize simplified combat system
        return true;
    }

    createMatch(matchConfig) {
        const match = {
            id: matchConfig.matchId,
            players: matchConfig.players,
            units: new Map(),
            turn: 1,
            phase: 'SETUP'
        };
        
        this.matches.set(matchConfig.matchId, match);
        return match;
    }

    createUnit(unitData) {
        const unit = {
            id: unitData.id,
            name: unitData.name,
            class: unitData.class,
            level: unitData.level,
            maxHP: this.calculateMaxHP(unitData),
            currentHP: 0,
            maxMP: this.calculateMaxMP(unitData),
            currentMP: 0,
            currentAP: 3,
            position: unitData.position,
            stats: this.calculateStats(unitData),
            statusEffects: [],
            isIncapacitated: false
        };
        
        unit.currentHP = unit.maxHP;
        unit.currentMP = unit.maxMP;
        
        this.units.set(unit.id, unit);
        return unit;
    }

    calculateMaxHP(unitData) {
        const baseHP = 100;
        const levelBonus = unitData.level * 8;
        const conBonus = (unitData.hiddenAbilities.CON - 10) * 15;
        return Math.max(50, baseHP + levelBonus + conBonus);
    }

    calculateMaxMP(unitData) {
        const baseMP = 50;
        const levelBonus = unitData.level * 2;
        const intBonus = (unitData.hiddenAbilities.INT - 10) * 8;
        return Math.max(20, baseMP + levelBonus + intBonus);
    }

    calculateStats(unitData) {
        return {
            ATK: Math.max(10, 25 + (unitData.hiddenAbilities.STR - 10) * 3),
            DEF: Math.max(5, 15 + (unitData.hiddenAbilities.CON - 10) * 2),
            MAG: Math.max(10, 20 + (unitData.hiddenAbilities.INT - 10) * 3),
            RES: Math.max(5, 10 + (unitData.hiddenAbilities.WIS - 10) * 2),
            AGL: Math.max(5, 15 + (unitData.hiddenAbilities.DEX - 10) * 2),
            MOV: Math.max(3, 4 + Math.floor((unitData.hiddenAbilities.DEX - 10) / 2)),
            RNG: this.getClassRange(unitData.class),
            LCK: Math.max(1, 8 + (unitData.hiddenAbilities.CHA - 10))
        };
    }

    getClassRange(className) {
        const ranges = {
            'ARCHER': 3,
            'MAGE': 3,
            'RANGER': 2,
            'SPEARMASTER': 2,
            'SWORDSMAN': 1,
            'GUARDIAN': 1,
            'CLERIC': 1,
            'ROGUE': 1
        };
        return ranges[className] || 1;
    }

    previewAttack(attackerId, targetId) {
        const attacker = this.units.get(attackerId);
        const target = this.units.get(targetId);
        
        if (!attacker || !target) {
            return { success: false, error: 'Unit not found' };
        }
        
        const hitChance = this.calculateHitChance(attacker, target);
        const damageRange = this.calculateDamageRange(attacker, target);
        
        return {
            success: true,
            hitChance: hitChance,
            damage: damageRange,
            critical: 0.05 + (attacker.stats.LCK * 0.005),
            apCost: 1
        };
    }

    calculateHitChance(attacker, target) {
        const baseHit = 0.75;
        const aglDiff = (attacker.stats.AGL - target.stats.AGL) * 0.02;
        return Math.max(0.1, Math.min(0.95, baseHit + aglDiff));
    }

    calculateDamageRange(attacker, target) {
        const baseDamage = Math.max(1, attacker.stats.ATK - target.stats.DEF);
        return {
            min: Math.max(1, Math.floor(baseDamage * 0.8)),
            max: Math.floor(baseDamage * 1.2),
            average: baseDamage
        };
    }

    executeAttack(attackerId, targetId) {
        const attacker = this.units.get(attackerId);
        const target = this.units.get(targetId);
        
        if (!attacker || !target || attacker.currentAP < 1) {
            return { success: false, error: 'Invalid attack' };
        }
        
        // Roll for hit
        const hitChance = this.calculateHitChance(attacker, target);
        const hitRoll = Math.random();
        const hit = hitRoll < hitChance;
        
        let damage = 0;
        let isCritical = false;
        
        if (hit) {
            const damageRange = this.calculateDamageRange(attacker, target);
            damage = Math.floor(Math.random() * (damageRange.max - damageRange.min + 1)) + damageRange.min;
            
            // Check for critical
            const critChance = 0.05 + (attacker.stats.LCK * 0.005);
            isCritical = Math.random() < critChance;
            if (isCritical) {
                damage = Math.floor(damage * 1.5);
            }
            
            // Apply damage
            target.currentHP = Math.max(0, target.currentHP - damage);
            if (target.currentHP <= 0) {
                target.isIncapacitated = true;
            }
        }
        
        // Consume action point
        attacker.currentAP = Math.max(0, attacker.currentAP - 1);
        
        return {
            success: true,
            hit: hit,
            damage: damage,
            isCritical: isCritical,
            targetState: { ...target },
            attackerState: { ...attacker }
        };
    }

    previewMovement(unitId, targetPosition) {
        const unit = this.units.get(unitId);
        if (!unit) {
            return { success: false, error: 'Unit not found' };
        }
        
        const distance = Math.abs(unit.position.x - targetPosition.x) + 
                        Math.abs(unit.position.y - targetPosition.y);
        
        const moveCost = Math.min(distance, unit.stats.MOV);
        const canMove = unit.currentAP >= 1 && distance <= unit.stats.MOV;
        
        return {
            success: true,
            canMove: canMove,
            distance: distance,
            apCost: 1,
            path: [unit.position, targetPosition] // Simplified path
        };
    }

    executeMovement(unitId, targetPosition) {
        const unit = this.units.get(unitId);
        if (!unit || unit.currentAP < 1) {
            return { success: false, error: 'Cannot move' };
        }
        
        const preview = this.previewMovement(unitId, targetPosition);
        if (!preview.canMove) {
            return { success: false, error: 'Invalid move' };
        }
        
        // Execute movement
        unit.position = { ...targetPosition };
        unit.currentAP = Math.max(0, unit.currentAP - 1);
        
        return {
            success: true,
            unitState: { ...unit }
        };
    }

    calculateInitiative(unitIds) {
        const initiatives = unitIds.map(id => {
            const unit = this.units.get(id);
            const baseInitiative = unit ? unit.stats.AGL : 10;
            const roll = Math.floor(Math.random() * 20) + 1;
            
            return {
                unitId: id,
                initiative: baseInitiative + roll,
                unit: unit
            };
        });
        
        // Sort by initiative (highest first)
        initiatives.sort((a, b) => b.initiative - a.initiative);
        
        return initiatives;
    }
}