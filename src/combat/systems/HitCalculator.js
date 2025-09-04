/**
 * Hit Calculator System for Tactica Arena
 * 
 * Handles all attack resolution including:
 * - Physical attack hit calculation using hidden d20 mechanics
 * - Spell attack resolution with magical defenses
 * - Advantage/disadvantage system from positioning and effects
 * - Critical hit detection and threat range calculation
 * - Situational modifiers (cover, height, status effects)
 * 
 * This system bridges the hidden d20 engine with the visible combat interface,
 * providing hit chances and resolution without exposing internal mechanics.
 */

import { D20Engine, AttackCalculator, DefenseCalculator, CriticalSystem } from '../hidden/D20Engine.js';
import { DeterministicRNG } from '../core/DeterministicRNG.js';
import { COMBAT, TERRAIN, HIDDEN_STATS } from '../constants/GameConstants.js';

/**
 * Situational modifier calculator for attacks
 */
export class SituationalModifiers {
  /**
   * Calculate all situational modifiers for an attack
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit  
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Attack options
   * @returns {Object} Situational modifiers
   */
  static calculate(attacker, defender, combatState, options = {}) {
    const modifiers = {
      attackerAdvantage: false,
      attackerDisadvantage: false,
      defenderAdvantage: false,
      defenderDisadvantage: false,
      coverBonus: 0,
      heightBonus: 0,
      flanking: false,
      backstab: false,
      statusEffects: []
    };

    // Calculate positional advantages
    this.calculatePositionalModifiers(attacker, defender, combatState, modifiers);
    
    // Calculate terrain effects
    this.calculateTerrainModifiers(attacker, defender, combatState, modifiers);
    
    // Calculate status effect modifiers
    this.calculateStatusModifiers(attacker, defender, modifiers);
    
    // Calculate facing and flanking
    this.calculateFacingModifiers(attacker, defender, modifiers);

    return modifiers;
  }

  /**
   * Calculate positional advantages (height, range)
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {CombatState} combatState - Combat state
   * @param {Object} modifiers - Modifiers object to update
   * @private
   */
  static calculatePositionalModifiers(attacker, defender, combatState, modifiers) {
    const attackerTerrain = combatState.getTerrainAt(attacker.position.x, attacker.position.y);
    const defenderTerrain = combatState.getTerrainAt(defender.position.x, defender.position.y);
    
    if (attackerTerrain && defenderTerrain) {
      const heightDiff = attackerTerrain.height - defenderTerrain.height;
      
      // Height advantage for attacks
      if (heightDiff > 0) {
        modifiers.attackerAdvantage = true;
        modifiers.heightBonus = heightDiff * TERRAIN.HEIGHT.RANGED_ATTACK_BONUS;
      } else if (heightDiff < 0) {
        modifiers.attackerDisadvantage = true;
      }
    }
  }

  /**
   * Calculate terrain-based modifiers
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {CombatState} combatState - Combat state
   * @param {Object} modifiers - Modifiers object to update
   * @private
   */
  static calculateTerrainModifiers(attacker, defender, combatState, modifiers) {
    const defenderTerrain = combatState.getTerrainAt(defender.position.x, defender.position.y);
    
    if (defenderTerrain) {
      // Cover from terrain
      if (defenderTerrain.providesCover()) {
        modifiers.coverBonus = defenderTerrain.coverValue;
        if (defenderTerrain.coverValue >= 0.5) {
          modifiers.attackerDisadvantage = true;
        }
      }

      // Dense terrain penalties for ranged attacks
      if (defenderTerrain.type === 'FOREST' && this.isRangedAttack(attacker, defender)) {
        modifiers.attackerDisadvantage = true;
      }
    }
  }

  /**
   * Calculate status effect modifiers
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {Object} modifiers - Modifiers object to update
   * @private
   */
  static calculateStatusModifiers(attacker, defender, modifiers) {
    // Check attacker status effects
    for (const effect of attacker.statusEffects) {
      switch (effect.name.toLowerCase()) {
        case 'blessed':
        case 'inspired':
          modifiers.attackerAdvantage = true;
          break;
        case 'cursed':
        case 'weakened':
        case 'blinded':
          modifiers.attackerDisadvantage = true;
          break;
      }
      modifiers.statusEffects.push({
        source: 'attacker',
        effect: effect.name,
        type: effect.type
      });
    }

    // Check defender status effects
    for (const effect of defender.statusEffects) {
      switch (effect.name.toLowerCase()) {
        case 'marked':
        case 'exposed':
          modifiers.attackerAdvantage = true;
          break;
        case 'dodging':
        case 'shielded':
          modifiers.attackerDisadvantage = true;
          break;
        case 'stunned':
        case 'paralyzed':
          modifiers.attackerAdvantage = true;
          break;
      }
      modifiers.statusEffects.push({
        source: 'defender',
        effect: effect.name,
        type: effect.type
      });
    }
  }

  /**
   * Calculate facing and flanking modifiers
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {Object} modifiers - Modifiers object to update
   * @private
   */
  static calculateFacingModifiers(attacker, defender, modifiers) {
    const angle = this.calculateAttackAngle(attacker.position, defender.position, defender.facing);
    
    // Backstab bonus (attack from behind)
    if (angle >= 135 && angle <= 225) {
      modifiers.backstab = true;
      modifiers.attackerAdvantage = true;
    }
    
    // Flanking bonus (attack from side)
    if ((angle >= 45 && angle <= 135) || (angle >= 225 && angle <= 315)) {
      modifiers.flanking = true;
    }
  }

  /**
   * Calculate attack angle relative to defender facing
   * @param {Object} attackerPos - Attacker position {x, y}
   * @param {Object} defenderPos - Defender position {x, y}  
   * @param {string} defenderFacing - Defender facing direction
   * @returns {number} Attack angle in degrees
   * @private
   */
  static calculateAttackAngle(attackerPos, defenderPos, defenderFacing) {
    const dx = attackerPos.x - defenderPos.x;
    const dy = attackerPos.y - defenderPos.y;
    
    let angle = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angle < 0) angle += 360;
    
    // Adjust based on defender facing
    const facingAdjustment = {
      'north': 0,
      'east': 90, 
      'south': 180,
      'west': 270
    };
    
    angle = (angle + (facingAdjustment[defenderFacing] || 0)) % 360;
    return angle;
  }

  /**
   * Check if attack is ranged based on distance and weapon type
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @returns {boolean} True if ranged attack
   * @private
   */
  static isRangedAttack(attacker, defender) {
    const distance = this.calculateDistance(attacker.position, defender.position);
    const attackerStats = attacker.getCurrentStats();
    
    // If beyond melee range (1 tile), it's ranged
    if (distance > 1) return true;
    
    // Check for ranged weapon classes
    const rangedClasses = ['ARCHER', 'MAGE'];
    return rangedClasses.includes(attacker.class);
  }

  /**
   * Calculate distance between two positions
   * @param {Object} pos1 - First position {x, y}
   * @param {Object} pos2 - Second position {x, y}
   * @returns {number} Distance in tiles
   * @private
   */
  static calculateDistance(pos1, pos2) {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy); // Chebyshev distance (8-directional movement)
  }
}

/**
 * Main Hit Calculator class
 */
export class HitCalculator {
  /**
   * Create hit calculator with d20 engine
   * @param {D20Engine} d20Engine - D20 engine instance
   */
  constructor(d20Engine = null) {
    this.d20Engine = d20Engine || new D20Engine();
  }

  /**
   * Calculate hit chance for an attack (preview)
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Attack options
   * @returns {Object} Hit chance information
   */
  calculateHitChance(attacker, defender, combatState, options = {}) {
    try {
      // Get hidden unit data for calculations
      const attackerData = attacker.getHiddenData();
      const defenderData = defender.getHiddenData();
      
      // Calculate situational modifiers
      const situational = SituationalModifiers.calculate(attacker, defender, combatState, options);
      
      // Determine advantage/disadvantage
      let rollType = 'normal';
      if (situational.attackerAdvantage && !situational.attackerDisadvantage) {
        rollType = 'advantage';
      } else if (situational.attackerDisadvantage && !situational.attackerAdvantage) {
        rollType = 'disadvantage';
      }

      // Calculate attack bonus and defense value
      const isRanged = options.isRanged || SituationalModifiers.isRangedAttack(attacker, defender);
      const isSpell = options.isSpell || attacker.class === 'MAGE' || attacker.class === 'CLERIC';

      let attackBonus, defenseValue;
      
      if (isSpell) {
        attackBonus = AttackCalculator.calculateSpellAttack(
          attackerData.abilities,
          attackerData.level,
          options.primaryAbility || 'INT',
          attackerData.equipment
        );
        defenseValue = DefenseCalculator.calculateMagicalDV(
          defenderData.abilities,
          defenderData.equipment,
          { 
            buffs: situational.coverBonus * 0.5, // Partial cover vs spells
            ...situational
          }
        );
      } else {
        attackBonus = AttackCalculator.calculatePhysicalAttack(
          attackerData.abilities,
          attackerData.level,
          isRanged,
          attackerData.equipment
        );
        defenseValue = DefenseCalculator.calculatePhysicalDV(
          defenderData.abilities,
          defenderData.equipment,
          {
            cover: situational.coverBonus * 5, // Cover bonus to DV
            height: situational.heightBonus * -2, // Height disadvantage  
            ...situational
          }
        );
      }

      // Calculate hit chances for different roll results
      const hitChances = this.calculateHitProbabilities(attackBonus, defenseValue, rollType);
      
      // Calculate critical hit chances
      const criticalInfo = this.calculateCriticalChances(attackerData, rollType);

      return {
        baseHitChance: hitChances.normal,
        effectiveHitChance: hitChances.effective,
        criticalChance: criticalInfo.chance,
        rollType,
        attackBonus,
        defenseValue,
        requiredRoll: Math.max(1, defenseValue - attackBonus),
        situationalModifiers: {
          advantage: situational.attackerAdvantage,
          disadvantage: situational.attackerDisadvantage,
          cover: situational.coverBonus > 0,
          height: situational.heightBonus !== 0,
          flanking: situational.flanking,
          backstab: situational.backstab,
          statusEffects: situational.statusEffects
        }
      };
    } catch (error) {
      throw new Error(`Hit chance calculation failed: ${error.message}`);
    }
  }

  /**
   * Resolve an attack using deterministic RNG
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {CombatState} combatState - Current combat state
   * @param {DeterministicRNG} rng - RNG instance
   * @param {Object} options - Attack options
   * @returns {Object} Attack resolution result
   */
  resolveAttack(attacker, defender, combatState, rng, options = {}) {
    try {
      // Get hidden unit data for calculations
      const attackerData = attacker.getHiddenData();
      const defenderData = defender.getHiddenData();
      
      // Calculate situational modifiers
      const situational = SituationalModifiers.calculate(attacker, defender, combatState, options);
      
      // Determine roll type
      let rollType = 'normal';
      if (situational.attackerAdvantage && !situational.attackerDisadvantage) {
        rollType = 'advantage';
      } else if (situational.attackerDisadvantage && !situational.attackerAdvantage) {
        rollType = 'disadvantage';
      }

      // Make the attack roll
      const attackRoll = rng.rollD20WithCondition(rollType);
      
      // Resolve the attack based on type
      const isSpell = options.isSpell || attacker.class === 'MAGE' || attacker.class === 'CLERIC';
      let result;
      
      if (isSpell) {
        result = this.d20Engine.resolveSpellAttack(
          { 
            ...attackerData, 
            id: attacker.id,
            equipment: attackerData.equipment,
            visibleStats: attackerData.visibleStats
          },
          { 
            ...defenderData, 
            id: defender.id,
            equipment: defenderData.equipment,
            situational: {
              buffs: situational.coverBonus * 0.5,
              ...situational
            }
          },
          attackRoll,
          { primaryAbility: options.primaryAbility || 'INT' }
        );
      } else {
        result = this.d20Engine.resolvePhysicalAttack(
          { 
            ...attackerData, 
            id: attacker.id,
            equipment: attackerData.equipment,
            visibleStats: attackerData.visibleStats
          },
          { 
            ...defenderData, 
            id: defender.id,
            equipment: defenderData.equipment,
            situational: {
              cover: situational.coverBonus * 5,
              height: situational.heightBonus * -2,
              ...situational
            }
          },
          attackRoll,
          { 
            isRanged: options.isRanged || SituationalModifiers.isRangedAttack(attacker, defender)
          }
        );
      }

      // Add situational context to result
      result.situationalModifiers = situational;
      result.rollType = rollType;
      result.attackType = isSpell ? 'spell' : 'physical';
      result.distance = SituationalModifiers.calculateDistance(attacker.position, defender.position);

      return result;
    } catch (error) {
      throw new Error(`Attack resolution failed: ${error.message}`);
    }
  }

  /**
   * Calculate hit probabilities for different roll types
   * @param {number} attackBonus - Attack bonus
   * @param {number} defenseValue - Defense value
   * @param {string} rollType - 'normal', 'advantage', 'disadvantage'
   * @returns {Object} Hit probabilities
   * @private
   */
  calculateHitProbabilities(attackBonus, defenseValue, rollType) {
    const requiredRoll = Math.max(1, defenseValue - attackBonus);
    const maxRoll = HIDDEN_STATS.DICE.D20_MAX;
    
    // Basic probability (normal roll)
    let normalChance = Math.max(0, (maxRoll - requiredRoll + 1) / maxRoll);
    
    let effectiveChance = normalChance;
    
    if (rollType === 'advantage') {
      // With advantage: probability of at least one success in two rolls
      const failChance = 1 - normalChance;
      effectiveChance = 1 - (failChance * failChance);
    } else if (rollType === 'disadvantage') {
      // With disadvantage: probability of success on both rolls
      effectiveChance = normalChance * normalChance;
    }

    return {
      normal: normalChance,
      effective: effectiveChance,
      requiredRoll
    };
  }

  /**
   * Calculate critical hit probabilities
   * @param {Object} attackerData - Hidden attacker data
   * @param {string} rollType - Roll type
   * @returns {Object} Critical hit information
   * @private
   */
  calculateCriticalChances(attackerData, rollType) {
    const threatRange = CriticalSystem.calculateThreatRange(
      attackerData.abilities,
      attackerData.visibleStats,
      attackerData.equipment
    );
    
    const critRolls = HIDDEN_STATS.DICE.D20_MAX - threatRange.minThreat + 1;
    const normalCritChance = critRolls / HIDDEN_STATS.DICE.D20_MAX;
    
    let effectiveCritChance = normalCritChance;
    
    if (rollType === 'advantage') {
      // With advantage: higher chance of rolling high
      const nonCritChance = 1 - normalCritChance;
      effectiveCritChance = 1 - (nonCritChance * nonCritChance);
    } else if (rollType === 'disadvantage') {
      // With disadvantage: lower chance of rolling high
      effectiveCritChance = normalCritChance * normalCritChance;
    }

    return {
      chance: effectiveCritChance,
      normalChance: normalCritChance,
      threatRange: `${threatRange.minThreat}-${threatRange.maxThreat}`,
      minThreat: threatRange.minThreat
    };
  }

  /**
   * Batch calculate hit chances for multiple potential targets
   * @param {Unit} attacker - Attacking unit
   * @param {Array} targets - Array of potential target units
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Attack options
   * @returns {Array} Array of hit chance results for each target
   */
  calculateMultipleHitChances(attacker, targets, combatState, options = {}) {
    return targets.map(target => ({
      targetId: target.id,
      ...this.calculateHitChance(attacker, target, combatState, options)
    }));
  }

  /**
   * Check if target is within attack range
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} target - Target unit
   * @param {Object} options - Attack options
   * @returns {boolean} True if target is in range
   */
  isInRange(attacker, target, options = {}) {
    const distance = SituationalModifiers.calculateDistance(attacker.position, target.position);
    const attackerStats = attacker.getCurrentStats();
    
    const range = options.range || attackerStats.RNG || 1;
    return distance <= range;
  }

  /**
   * Check line of sight between attacker and target
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} target - Target unit
   * @param {CombatState} combatState - Current combat state
   * @returns {boolean} True if LOS is clear
   */
  hasLineOfSight(attacker, target, combatState) {
    // Simple LOS check - can be enhanced with more sophisticated algorithms
    const start = attacker.position;
    const end = target.position;
    
    // Use Bresenham's line algorithm to check tiles between
    const tiles = this.getLineOfSightTiles(start, end);
    
    for (const tile of tiles) {
      const terrain = combatState.getTerrainAt(tile.x, tile.y);
      if (terrain && terrain.blocksLOS()) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get tiles along line of sight using Bresenham's algorithm
   * @param {Object} start - Start position {x, y}
   * @param {Object} end - End position {x, y}
   * @returns {Array} Array of tile positions
   * @private
   */
  getLineOfSightTiles(start, end) {
    const tiles = [];
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    const sx = start.x < end.x ? 1 : -1;
    const sy = start.y < end.y ? 1 : -1;
    let err = dx - dy;
    
    let x = start.x;
    let y = start.y;
    
    while (x !== end.x || y !== end.y) {
      tiles.push({ x, y });
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    
    return tiles;
  }
}

export default HitCalculator;