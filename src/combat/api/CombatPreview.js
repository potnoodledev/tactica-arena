/**
 * Combat Preview API for Tactica Arena
 * 
 * Provides the public-facing interface for combat previews and calculations.
 * This is the ONLY module that should be exposed to the client, ensuring
 * complete separation between the hidden d20 mechanics and visible stats.
 * 
 * Features:
 * - Hit chance previews with visible stat explanations
 * - Damage range calculations without exposing dice rolls
 * - Action cost previews with AP management
 * - Movement and positioning validation
 * - Status effect impact predictions
 * - Clean, game-terminology interface (no d20 references)
 */

import { HitCalculator } from '../systems/HitCalculator.js';
import { DamageCalculator } from '../systems/DamageCalculator.js';
import { ActionPointSystem } from '../systems/ActionPointSystem.js';
import { DeterministicRNG } from '../core/DeterministicRNG.js';

/**
 * Combat preview result class for standardized response format
 */
export class CombatPreviewResult {
  /**
   * Create combat preview result
   * @param {Object} config - Result configuration
   */
  constructor(config) {
    this.success = config.success !== false;
    this.type = config.type || 'unknown';
    this.data = config.data || {};
    this.warnings = config.warnings || [];
    this.errors = config.errors || [];
    this.metadata = config.metadata || {};
    this.timestamp = Date.now();
  }

  /**
   * Add warning to result
   * @param {string} warning - Warning message
   */
  addWarning(warning) {
    this.warnings.push(warning);
  }

  /**
   * Add error to result
   * @param {string} error - Error message
   */
  addError(error) {
    this.errors.push(error);
    this.success = false;
  }

  /**
   * Check if result has errors
   * @returns {boolean} True if result has errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Check if result has warnings
   * @returns {boolean} True if result has warnings
   */
  hasWarnings() {
    return this.warnings.length > 0;
  }
}

/**
 * Main Combat Preview API class
 */
export class CombatPreview {
  /**
   * Create combat preview API
   * @param {Object} config - API configuration
   */
  constructor(config = {}) {
    this.hitCalculator = config.hitCalculator || new HitCalculator();
    this.damageCalculator = config.damageCalculator || new DamageCalculator();
    this.actionPointSystem = config.actionPointSystem || new ActionPointSystem();
    this.enableDetailedPreviews = config.enableDetailedPreviews !== false;
    this.maxPreviewTargets = config.maxPreviewTargets || 10;
  }

  /**
   * Preview attack hit chance and damage against target
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} target - Target unit
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Attack options
   * @returns {CombatPreviewResult} Attack preview result
   */
  previewAttack(attacker, target, combatState, options = {}) {
    const result = new CombatPreviewResult({
      type: 'attack_preview',
      metadata: {
        attackerId: attacker.id,
        targetId: target.id,
        attackType: options.attackType || 'basic'
      }
    });

    try {
      // Validate inputs
      if (!this.validateUnits(attacker, target, result)) {
        return result;
      }

      if (!this.validateRange(attacker, target, combatState, options, result)) {
        return result;
      }

      if (!this.validateLineOfSight(attacker, target, combatState, result)) {
        return result;
      }

      // Calculate hit chance
      const hitChance = this.hitCalculator.calculateHitChance(
        attacker, 
        target, 
        combatState, 
        options
      );

      // Calculate damage preview
      const damagePreview = this.damageCalculator.calculateDamagePreview(
        attacker,
        target,
        {
          type: options.weaponType || this.getDefaultWeaponType(attacker),
          isSpell: options.isSpell || false,
          level: options.spellLevel || 1
        }
      );

      // Calculate AP cost
      const apCost = this.actionPointSystem.previewActionCost(
        attacker,
        'ATTACK',
        { abilityId: options.abilityId }
      );

      result.data = {
        hitChance: {
          percentage: Math.round(hitChance.effectiveHitChance * 100),
          displayText: this.formatHitChanceText(hitChance),
          factors: this.extractHitChanceFactors(hitChance)
        },
        damage: {
          range: {
            min: damagePreview.estimatedFinalRange.min,
            max: damagePreview.estimatedFinalRange.max,
            average: Math.round((damagePreview.estimatedFinalRange.min + damagePreview.estimatedFinalRange.max) / 2)
          },
          criticalRange: {
            min: damagePreview.estimatedFinalRange.criticalMin,
            max: damagePreview.estimatedFinalRange.criticalMax,
            average: Math.round((damagePreview.estimatedFinalRange.criticalMin + damagePreview.estimatedFinalRange.criticalMax) / 2)
          },
          type: damagePreview.damageType,
          displayText: this.formatDamageText(damagePreview)
        },
        critical: {
          chance: Math.round(hitChance.criticalChance * 100),
          displayText: this.formatCriticalChanceText(hitChance)
        },
        actionPoints: {
          cost: apCost.modifiedCost,
          canAfford: apCost.canAfford,
          remainingAfter: apCost.remainingAfter,
          displayText: this.formatAPCostText(apCost)
        },
        effects: this.extractAttackEffects(attacker, target, combatState, options)
      };

      // Add warnings for situational factors
      this.addSituationalWarnings(hitChance, result);

    } catch (error) {
      result.addError(`Attack preview failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Preview area of effect attack
   * @param {Unit} caster - Casting unit
   * @param {Array} targets - Array of target units
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Spell options
   * @returns {CombatPreviewResult} AOE preview result
   */
  previewAreaAttack(caster, targets, combatState, options = {}) {
    const result = new CombatPreviewResult({
      type: 'aoe_preview',
      metadata: {
        casterId: caster.id,
        targetCount: targets.length,
        spellType: options.spellType || 'unknown'
      }
    });

    try {
      if (targets.length === 0) {
        result.addError('No targets specified for area attack');
        return result;
      }

      if (targets.length > this.maxPreviewTargets) {
        result.addWarning(`Too many targets (${targets.length}), limiting to ${this.maxPreviewTargets}`);
        targets = targets.slice(0, this.maxPreviewTargets);
      }

      // Calculate previews for each target
      const targetPreviews = [];
      let totalDamage = 0;
      let hitCount = 0;

      for (const target of targets) {
        if (!target || target.isIncapacitated) continue;

        const targetPreview = this.previewAttack(caster, target, combatState, {
          ...options,
          isSpell: true
        });

        if (targetPreview.success) {
          targetPreviews.push({
            targetId: target.id,
            targetName: target.name,
            ...targetPreview.data
          });

          totalDamage += targetPreview.data.damage.range.average;
          hitCount += targetPreview.data.hitChance.percentage / 100;
        }
      }

      // Check for friendly fire
      const friendlyFireTargets = this.checkFriendlyFire(caster, targets, options);

      result.data = {
        targets: targetPreviews,
        summary: {
          targetCount: targetPreviews.length,
          averageTotalDamage: Math.round(totalDamage),
          expectedHits: Math.round(hitCount),
          friendlyFire: friendlyFireTargets.length > 0,
          friendlyTargets: friendlyFireTargets
        },
        spellInfo: {
          type: options.spellType,
          level: options.spellLevel || 1,
          area: options.area || 'small',
          shape: options.shape || 'circle'
        }
      };

      if (friendlyFireTargets.length > 0) {
        result.addWarning(`This ability will affect ${friendlyFireTargets.length} friendly units`);
      }

    } catch (error) {
      result.addError(`Area attack preview failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Preview movement action
   * @param {Unit} unit - Unit to move
   * @param {Object} targetPosition - Target position {x, y}
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Movement options
   * @returns {CombatPreviewResult} Movement preview result
   */
  previewMovement(unit, targetPosition, combatState, options = {}) {
    const result = new CombatPreviewResult({
      type: 'movement_preview',
      metadata: {
        unitId: unit.id,
        from: { ...unit.position },
        to: { ...targetPosition }
      }
    });

    try {
      // Validate target position
      if (!this.validatePosition(targetPosition, combatState, result)) {
        return result;
      }

      // Check if position is passable
      if (!combatState.isPositionPassable(targetPosition.x, targetPosition.y)) {
        result.addError('Target position is not passable');
        return result;
      }

      // Calculate movement path and cost
      const pathInfo = this.calculateMovementPath(unit, targetPosition, combatState);
      
      // Calculate AP cost
      const apCost = this.actionPointSystem.previewActionCost(unit, 'MOVE', {
        distance: pathInfo.totalDistance,
        terrainModifier: pathInfo.averageTerrainCost
      });

      result.data = {
        path: pathInfo.path,
        distance: pathInfo.totalDistance,
        movementCost: pathInfo.totalCost,
        actionPoints: {
          cost: apCost.modifiedCost,
          canAfford: apCost.canAfford,
          remainingAfter: apCost.remainingAfter
        },
        terrainEffects: pathInfo.terrainEffects,
        opportunityAttacks: this.calculateOpportunityAttacks(unit, pathInfo.path, combatState),
        positionEffects: this.getPositionEffects(targetPosition, combatState)
      };

      // Check for movement-related warnings
      if (pathInfo.totalCost > unit.getCurrentStats().MOV) {
        result.addWarning('Movement distance exceeds unit movement range');
      }

      if (result.data.opportunityAttacks.length > 0) {
        result.addWarning(`Movement will provoke ${result.data.opportunityAttacks.length} opportunity attacks`);
      }

    } catch (error) {
      result.addError(`Movement preview failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Preview ability usage
   * @param {Unit} caster - Unit casting ability
   * @param {string} abilityId - Ability to preview
   * @param {Array|Object} targets - Target(s) for ability
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Ability options
   * @returns {CombatPreviewResult} Ability preview result
   */
  previewAbility(caster, abilityId, targets, combatState, options = {}) {
    const result = new CombatPreviewResult({
      type: 'ability_preview',
      metadata: {
        casterId: caster.id,
        abilityId,
        targetCount: Array.isArray(targets) ? targets.length : (targets ? 1 : 0)
      }
    });

    try {
      // Get ability information (this would come from ability definitions)
      const abilityInfo = this.getAbilityInfo(abilityId);
      if (!abilityInfo) {
        result.addError(`Unknown ability: ${abilityId}`);
        return result;
      }

      // Check resource costs (MP, cooldowns, etc.)
      const resourceCheck = this.checkAbilityResources(caster, abilityInfo);
      if (!resourceCheck.canUse) {
        result.addError(resourceCheck.reason);
        return result;
      }

      // Calculate AP cost
      const apCost = this.actionPointSystem.previewActionCost(caster, 'ABILITY', {
        abilityId
      });

      result.data = {
        ability: {
          name: abilityInfo.name,
          description: abilityInfo.description,
          type: abilityInfo.type,
          range: abilityInfo.range,
          area: abilityInfo.area,
          cooldown: abilityInfo.cooldown
        },
        costs: {
          actionPoints: apCost.modifiedCost,
          mana: abilityInfo.mpCost || 0,
          cooldown: abilityInfo.cooldown || 0
        },
        canUse: resourceCheck.canUse && apCost.canAfford,
        effects: []
      };

      // Preview effects based on ability type
      if (abilityInfo.type === 'damage') {
        result.data.effects.push(this.previewDamageAbility(caster, targets, abilityInfo, combatState));
      } else if (abilityInfo.type === 'healing') {
        result.data.effects.push(this.previewHealingAbility(caster, targets, abilityInfo));
      } else if (abilityInfo.type === 'buff' || abilityInfo.type === 'debuff') {
        result.data.effects.push(this.previewStatusAbility(caster, targets, abilityInfo));
      }

    } catch (error) {
      result.addError(`Ability preview failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Get comprehensive unit status for display
   * @param {Unit} unit - Unit to get status for
   * @returns {CombatPreviewResult} Unit status result
   */
  getUnitStatus(unit) {
    const result = new CombatPreviewResult({
      type: 'unit_status',
      metadata: { unitId: unit.id }
    });

    try {
      const stats = unit.getCurrentStats();
      const apStatus = this.actionPointSystem.getAPStatus(unit);

      result.data = {
        unit: {
          id: unit.id,
          name: unit.name,
          class: unit.class,
          level: unit.level,
          isLeader: unit.isLeader
        },
        health: {
          current: unit.currentHP,
          maximum: stats.HP,
          percentage: Math.round((unit.currentHP / stats.HP) * 100),
          status: this.getHealthStatus(unit.currentHP, stats.HP)
        },
        mana: {
          current: unit.currentMP,
          maximum: stats.MP,
          percentage: stats.MP > 0 ? Math.round((unit.currentMP / stats.MP) * 100) : 0
        },
        actionPoints: {
          current: unit.currentAP,
          maximum: 3,
          queued: apStatus.queuedCost,
          available: apStatus.availableAfterQueue
        },
        stats: {
          attack: stats.ATK,
          defense: stats.DEF,
          magic: stats.MAG,
          resistance: stats.RES,
          agility: stats.AGL,
          intelligence: stats.INT,
          movement: stats.MOV,
          range: stats.RNG,
          luck: stats.LCK
        },
        status: {
          isIncapacitated: unit.isIncapacitated,
          hasActed: unit.hasActedThisTurn,
          canAct: unit.canAct(),
          effects: unit.statusEffects.map(effect => ({
            name: effect.name,
            type: effect.type,
            duration: effect.duration,
            intensity: effect.intensity,
            description: effect.description
          }))
        },
        position: { ...unit.position }
      };

    } catch (error) {
      result.addError(`Unit status failed: ${error.message}`);
    }

    return result;
  }

  /**
   * Preview potential targets for an action
   * @param {Unit} unit - Acting unit
   * @param {string} actionType - Type of action ('attack', 'ability', etc.)
   * @param {CombatState} combatState - Current combat state
   * @param {Object} options - Action options
   * @returns {CombatPreviewResult} Target preview result
   */
  previewTargets(unit, actionType, combatState, options = {}) {
    const result = new CombatPreviewResult({
      type: 'target_preview',
      metadata: {
        unitId: unit.id,
        actionType
      }
    });

    try {
      const allUnits = Array.from(combatState.units.values());
      const validTargets = [];
      const stats = unit.getCurrentStats();
      const range = options.range || stats.RNG;

      for (const target of allUnits) {
        if (target.id === unit.id) continue;
        if (target.isIncapacitated && actionType !== 'heal') continue;

        const distance = this.calculateDistance(unit.position, target.position);
        if (distance > range) continue;

        const hasLOS = this.hitCalculator.hasLineOfSight(unit, target, combatState);
        if (!hasLOS && !options.ignoreLineOfSight) continue;

        const targetInfo = {
          unitId: target.id,
          unitName: target.name,
          distance,
          hasLineOfSight: hasLOS,
          isEnemy: this.isEnemyUnit(unit, target, combatState),
          isFriendly: this.isFriendlyUnit(unit, target, combatState)
        };

        // Add action-specific info
        if (actionType === 'attack') {
          const hitPreview = this.previewAttack(unit, target, combatState, options);
          targetInfo.hitChance = hitPreview.data?.hitChance?.percentage || 0;
          targetInfo.estimatedDamage = hitPreview.data?.damage?.range?.average || 0;
        } else if (actionType === 'heal') {
          targetInfo.healingNeeded = target.baseStats.HP - target.currentHP;
          targetInfo.healingEfficiency = targetInfo.healingNeeded / target.baseStats.HP;
        }

        validTargets.push(targetInfo);
      }

      result.data = {
        availableTargets: validTargets.length,
        range: range,
        targets: validTargets
      };

    } catch (error) {
      result.addError(`Target preview failed: ${error.message}`);
    }

    return result;
  }

  // Private helper methods

  /**
   * Validate units for combat actions
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} target - Target unit
   * @param {CombatPreviewResult} result - Result to add errors to
   * @returns {boolean} True if units are valid
   * @private
   */
  validateUnits(attacker, target, result) {
    if (!attacker) {
      result.addError('Attacker unit is required');
      return false;
    }
    
    if (!target) {
      result.addError('Target unit is required');
      return false;
    }

    if (attacker.isIncapacitated) {
      result.addError('Attacker is incapacitated and cannot act');
      return false;
    }

    if (target.isIncapacitated) {
      result.addWarning('Target is already incapacitated');
    }

    return true;
  }

  /**
   * Validate attack range
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} target - Target unit
   * @param {CombatState} combatState - Combat state
   * @param {Object} options - Attack options
   * @param {CombatPreviewResult} result - Result to add errors to
   * @returns {boolean} True if target is in range
   * @private
   */
  validateRange(attacker, target, combatState, options, result) {
    if (!this.hitCalculator.isInRange(attacker, target, options)) {
      result.addError('Target is out of range');
      return false;
    }
    return true;
  }

  /**
   * Validate line of sight
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} target - Target unit
   * @param {CombatState} combatState - Combat state
   * @param {CombatPreviewResult} result - Result to add errors to
   * @returns {boolean} True if LOS is clear
   * @private
   */
  validateLineOfSight(attacker, target, combatState, result) {
    if (!this.hitCalculator.hasLineOfSight(attacker, target, combatState)) {
      result.addError('Line of sight is blocked');
      return false;
    }
    return true;
  }

  /**
   * Validate position is within combat area
   * @param {Object} position - Position to validate
   * @param {CombatState} combatState - Combat state
   * @param {CombatPreviewResult} result - Result to add errors to
   * @returns {boolean} True if position is valid
   * @private
   */
  validatePosition(position, combatState, result) {
    if (!position || typeof position.x !== 'number' || typeof position.y !== 'number') {
      result.addError('Invalid position coordinates');
      return false;
    }

    if (position.x < 0 || position.x >= combatState.mapWidth ||
        position.y < 0 || position.y >= combatState.mapHeight) {
      result.addError('Position is outside combat area');
      return false;
    }

    return true;
  }

  /**
   * Format hit chance for display
   * @param {Object} hitChance - Hit chance calculation result
   * @returns {string} Formatted text
   * @private
   */
  formatHitChanceText(hitChance) {
    const percentage = Math.round(hitChance.effectiveHitChance * 100);
    if (hitChance.rollType === 'advantage') {
      return `${percentage}% (Advantage)`;
    } else if (hitChance.rollType === 'disadvantage') {
      return `${percentage}% (Disadvantage)`;
    }
    return `${percentage}%`;
  }

  /**
   * Format damage range for display
   * @param {Object} damagePreview - Damage preview result
   * @returns {string} Formatted text
   * @private
   */
  formatDamageText(damagePreview) {
    const range = damagePreview.estimatedFinalRange;
    if (range.min === range.max) {
      return `${range.min}`;
    }
    return `${range.min}-${range.max}`;
  }

  /**
   * Format critical chance for display
   * @param {Object} hitChance - Hit chance calculation result
   * @returns {string} Formatted text
   * @private
   */
  formatCriticalChanceText(hitChance) {
    const percentage = Math.round(hitChance.criticalChance * 100);
    return `${percentage}% Critical`;
  }

  /**
   * Format AP cost for display
   * @param {Object} apCost - AP cost preview result
   * @returns {string} Formatted text
   * @private
   */
  formatAPCostText(apCost) {
    return `${apCost.modifiedCost} AP${apCost.canAfford ? '' : ' (Insufficient)'}`;
  }

  /**
   * Extract hit chance factors for display
   * @param {Object} hitChance - Hit chance calculation result
   * @returns {Array} Array of factor descriptions
   * @private
   */
  extractHitChanceFactors(hitChance) {
    const factors = [];
    const mods = hitChance.situationalModifiers;

    if (mods.advantage) factors.push('High ground advantage');
    if (mods.disadvantage) factors.push('Disadvantageous position');
    if (mods.cover) factors.push('Target has cover');
    if (mods.flanking) factors.push('Flanking bonus');
    if (mods.backstab) factors.push('Backstab bonus');

    return factors;
  }

  /**
   * Get default weapon type for unit class
   * @param {Unit} unit - Unit to get weapon type for
   * @returns {string} Default weapon type
   * @private
   */
  getDefaultWeaponType(unit) {
    const classWeapons = {
      'SWORDSMAN': 'SWORD',
      'GUARDIAN': 'MACE',
      'ARCHER': 'BOW',
      'RANGER': 'SPEAR',
      'MAGE': 'STAFF',
      'CLERIC': 'MACE',
      'ROGUE': 'DAGGER',
      'SPEARMASTER': 'SPEAR'
    };
    return classWeapons[unit.class] || 'SWORD';
  }

  /**
   * Calculate distance between positions
   * @param {Object} pos1 - First position
   * @param {Object} pos2 - Second position
   * @returns {number} Distance in tiles
   * @private
   */
  calculateDistance(pos1, pos2) {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    return Math.max(dx, dy);
  }

  /**
   * Get health status description
   * @param {number} current - Current HP
   * @param {number} maximum - Maximum HP
   * @returns {string} Health status
   * @private
   */
  getHealthStatus(current, maximum) {
    const percentage = current / maximum;
    if (percentage <= 0) return 'Incapacitated';
    if (percentage < 0.25) return 'Critical';
    if (percentage < 0.5) return 'Wounded';
    if (percentage < 0.75) return 'Injured';
    return 'Healthy';
  }

  // Placeholder methods for functionality that would be implemented with full game data

  calculateMovementPath(unit, targetPosition, combatState) {
    return {
      path: [unit.position, targetPosition],
      totalDistance: this.calculateDistance(unit.position, targetPosition),
      totalCost: 1,
      averageTerrainCost: 1,
      terrainEffects: []
    };
  }

  calculateOpportunityAttacks(unit, path, combatState) {
    return []; // Would calculate based on enemy positions and ZOC
  }

  getPositionEffects(position, combatState) {
    const terrain = combatState.getTerrainAt(position.x, position.y);
    return terrain ? {
      terrain: terrain.type,
      cover: terrain.coverValue,
      height: terrain.height
    } : {};
  }

  checkFriendlyFire(caster, targets, options) {
    return targets.filter(target => this.isFriendlyUnit(caster, target, null));
  }

  isEnemyUnit(unit1, unit2, combatState) {
    // Placeholder - would check team/faction relationships
    return unit1.faction !== unit2.faction;
  }

  isFriendlyUnit(unit1, unit2, combatState) {
    // Placeholder - would check team/faction relationships
    return unit1.faction === unit2.faction;
  }

  getAbilityInfo(abilityId) {
    // Placeholder - would load from ability definitions
    return {
      name: abilityId,
      description: 'Placeholder ability',
      type: 'damage',
      range: 1,
      mpCost: 10,
      cooldown: 0
    };
  }

  checkAbilityResources(caster, abilityInfo) {
    return {
      canUse: caster.currentMP >= (abilityInfo.mpCost || 0),
      reason: caster.currentMP >= (abilityInfo.mpCost || 0) ? '' : 'Insufficient mana'
    };
  }

  previewDamageAbility(caster, targets, abilityInfo, combatState) {
    return { type: 'damage', description: 'Deals damage to target' };
  }

  previewHealingAbility(caster, targets, abilityInfo) {
    return { type: 'healing', description: 'Restores health to target' };
  }

  previewStatusAbility(caster, targets, abilityInfo) {
    return { type: 'status', description: 'Applies status effect to target' };
  }

  extractAttackEffects(attacker, target, combatState, options) {
    return [];
  }

  addSituationalWarnings(hitChance, result) {
    // Add warnings based on situational modifiers
  }
}

export default CombatPreview;