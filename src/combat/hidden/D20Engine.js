/**
 * Hidden D20 Rules Engine for Tactica Arena
 * 
 * This module contains the complete d20-based rules engine that powers
 * the combat system internally. It is NEVER exposed to the client and
 * contains no player-facing terminology.
 * 
 * Key Components:
 * - Ability scores (STR, DEX, CON, INT, WIS, CHA)
 * - Modifier calculations
 * - Proficiency scaling by level
 * - Save system (Fortitude, Reflex, Will)
 * - Defense value calculations
 * - Critical hit mechanics with threat range extension
 * 
 * CRITICAL: This entire module is internal only. No methods, constants,
 * or terminology from this file should ever reach the client.
 */

import { HIDDEN_STATS, PROGRESSION, COMBAT } from '../constants/GameConstants.js';

/**
 * Calculate ability modifier from ability score
 * @param {number} abilityScore - Raw ability score (3-18+)
 * @returns {number} Ability modifier (-4 to +4+)
 */
export function calculateModifier(abilityScore) {
  return Math.floor((abilityScore - HIDDEN_STATS.ABILITY_SCORES.MODIFIER_OFFSET) / 
                   HIDDEN_STATS.ABILITY_SCORES.MODIFIER_DIVISOR);
}

/**
 * Calculate proficiency bonus based on character level
 * @param {number} level - Character level (1-80)
 * @returns {number} Proficiency bonus (+2 to +6)
 */
export function calculateProficiency(level) {
  if (level >= 61) return HIDDEN_STATS.PROFICIENCY.LEVEL_61_80;
  if (level >= 41) return HIDDEN_STATS.PROFICIENCY.LEVEL_41_60;
  if (level >= 21) return HIDDEN_STATS.PROFICIENCY.LEVEL_21_40;
  if (level >= 11) return HIDDEN_STATS.PROFICIENCY.LEVEL_11_20;
  return HIDDEN_STATS.PROFICIENCY.LEVEL_1_10;
}

/**
 * Validate ability score range
 * @param {number} score - Ability score to validate
 * @returns {number} Clamped ability score
 */
export function validateAbilityScore(score) {
  return Math.max(HIDDEN_STATS.ABILITY_SCORES.MIN, 
                  Math.min(HIDDEN_STATS.ABILITY_SCORES.MAX, score));
}

/**
 * D20 Ability Score Manager
 * Manages the six core ability scores and their derived values
 */
export class AbilityScores {
  /**
   * Create ability score set
   * @param {Object} scores - Object with STR, DEX, CON, INT, WIS, CHA
   */
  constructor(scores = {}) {
    this.STR = validateAbilityScore(scores.STR || HIDDEN_STATS.ABILITY_SCORES.BASE);
    this.DEX = validateAbilityScore(scores.DEX || HIDDEN_STATS.ABILITY_SCORES.BASE);
    this.CON = validateAbilityScore(scores.CON || HIDDEN_STATS.ABILITY_SCORES.BASE);
    this.INT = validateAbilityScore(scores.INT || HIDDEN_STATS.ABILITY_SCORES.BASE);
    this.WIS = validateAbilityScore(scores.WIS || HIDDEN_STATS.ABILITY_SCORES.BASE);
    this.CHA = validateAbilityScore(scores.CHA || HIDDEN_STATS.ABILITY_SCORES.BASE);
  }

  /**
   * Get ability modifier for specific ability
   * @param {string} ability - Ability name ('STR', 'DEX', etc.)
   * @returns {number} Ability modifier
   */
  getModifier(ability) {
    const score = this[ability.toUpperCase()];
    if (score === undefined) {
      throw new Error(`Invalid ability: ${ability}`);
    }
    return calculateModifier(score);
  }

  /**
   * Get all ability modifiers as object
   * @returns {Object} Object with all ability modifiers
   */
  getAllModifiers() {
    return {
      STR: this.getModifier('STR'),
      DEX: this.getModifier('DEX'),
      CON: this.getModifier('CON'),
      INT: this.getModifier('INT'),
      WIS: this.getModifier('WIS'),
      CHA: this.getModifier('CHA')
    };
  }

  /**
   * Set ability score with validation
   * @param {string} ability - Ability name
   * @param {number} score - New score value
   */
  setAbility(ability, score) {
    const abilityUpper = ability.toUpperCase();
    if (!['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(abilityUpper)) {
      throw new Error(`Invalid ability: ${ability}`);
    }
    this[abilityUpper] = validateAbilityScore(score);
  }

  /**
   * Apply temporary modifier to ability score
   * @param {string} ability - Ability name
   * @param {number} modifier - Temporary modifier
   * @returns {number} Modified score (doesn't change base score)
   */
  getModifiedScore(ability, modifier = 0) {
    return validateAbilityScore(this[ability.toUpperCase()] + modifier);
  }

  /**
   * Clone ability scores
   * @returns {AbilityScores} New instance with same scores
   */
  clone() {
    return new AbilityScores({
      STR: this.STR,
      DEX: this.DEX,
      CON: this.CON,
      INT: this.INT,
      WIS: this.WIS,
      CHA: this.CHA
    });
  }

  /**
   * Convert to plain object for serialization
   * @returns {Object} Plain object with ability scores
   */
  toObject() {
    return {
      STR: this.STR,
      DEX: this.DEX,
      CON: this.CON,
      INT: this.INT,
      WIS: this.WIS,
      CHA: this.CHA
    };
  }
}

/**
 * D20 Save System
 * Manages Fortitude, Reflex, and Will saves
 */
export class SaveSystem {
  /**
   * Calculate Fortitude save bonus
   * @param {AbilityScores} abilities - Ability scores
   * @param {number} level - Character level
   * @param {number} defTier - Defense tier from equipment
   * @returns {number} Fortitude save bonus
   */
  static calculateFortitude(abilities, level, defTier = 0) {
    const proficiency = calculateProficiency(level);
    const conMod = abilities.getModifier('CON');
    return proficiency + conMod + defTier;
  }

  /**
   * Calculate Reflex save bonus
   * @param {AbilityScores} abilities - Ability scores
   * @param {number} level - Character level
   * @param {number} aglMod - AGL modifier from visible stats
   * @returns {number} Reflex save bonus
   */
  static calculateReflex(abilities, level, aglMod = 0) {
    const proficiency = calculateProficiency(level);
    const dexMod = abilities.getModifier('DEX');
    // Small luck bonus for reflex saves
    const lckMod = Math.floor(abilities.getModifier('CHA') * 0.5);
    return proficiency + dexMod + aglMod + lckMod;
  }

  /**
   * Calculate Will save bonus
   * @param {AbilityScores} abilities - Ability scores
   * @param {number} level - Character level
   * @param {number} resTier - Resistance tier from equipment
   * @returns {number} Will save bonus
   */
  static calculateWill(abilities, level, resTier = 0) {
    const proficiency = calculateProficiency(level);
    const wisMod = abilities.getModifier('WIS');
    return proficiency + wisMod + resTier;
  }

  /**
   * Get all save bonuses
   * @param {AbilityScores} abilities - Ability scores
   * @param {number} level - Character level
   * @param {Object} equipment - Equipment modifiers
   * @returns {Object} All save bonuses
   */
  static getAllSaves(abilities, level, equipment = {}) {
    return {
      fortitude: this.calculateFortitude(abilities, level, equipment.defTier || 0),
      reflex: this.calculateReflex(abilities, level, equipment.aglMod || 0),
      will: this.calculateWill(abilities, level, equipment.resTier || 0)
    };
  }

  /**
   * Calculate save DC for abilities
   * @param {AbilityScores} abilities - Caster ability scores
   * @param {number} level - Caster level
   * @param {string} primaryAbility - Primary casting ability ('INT', 'WIS', 'CHA')
   * @returns {number} Save DC
   */
  static calculateSaveDC(abilities, level, primaryAbility = 'INT') {
    const proficiency = calculateProficiency(level);
    const abilityMod = abilities.getModifier(primaryAbility);
    return HIDDEN_STATS.DICE.BASE_SAVE_DC + proficiency + abilityMod;
  }
}

/**
 * D20 Defense Value Calculator
 * Calculates armor class equivalents for physical and magical defense
 */
export class DefenseCalculator {
  /**
   * Calculate physical defense value
   * @param {AbilityScores} abilities - Ability scores
   * @param {Object} equipment - Equipment bonuses
   * @param {Object} situational - Situational modifiers
   * @returns {number} Physical defense value
   */
  static calculatePhysicalDV(abilities, equipment = {}, situational = {}) {
    const baseDV = HIDDEN_STATS.DICE.BASE_DEFENSE_VALUE;
    const armorBonus = equipment.armor || 0;
    const dexMod = abilities.getModifier('DEX');
    const coverBonus = situational.cover || 0;
    const heightBonus = situational.height || 0;
    const buffs = situational.buffs || 0;
    
    return baseDV + armorBonus + dexMod + coverBonus + heightBonus + buffs;
  }

  /**
   * Calculate magical defense value
   * @param {AbilityScores} abilities - Ability scores
   * @param {Object} equipment - Equipment bonuses
   * @param {Object} situational - Situational modifiers
   * @returns {number} Magical defense value
   */
  static calculateMagicalDV(abilities, equipment = {}, situational = {}) {
    const baseDV = HIDDEN_STATS.DICE.BASE_DEFENSE_VALUE;
    const resBonus = equipment.resistance || 0;
    const wisMod = abilities.getModifier('WIS');
    const coverBonus = situational.magicalCover || 0; // Some cover might not help vs magic
    const buffs = situational.buffs || 0;
    
    return baseDV + resBonus + wisMod + coverBonus + buffs;
  }
}

/**
 * D20 Attack Calculator
 * Calculates attack bonuses for physical and magical attacks
 */
export class AttackCalculator {
  /**
   * Calculate physical attack bonus
   * @param {AbilityScores} abilities - Ability scores
   * @param {number} level - Character level
   * @param {boolean} isRanged - True for ranged attacks (use DEX instead of STR)
   * @param {Object} equipment - Equipment bonuses
   * @returns {number} Physical attack bonus
   */
  static calculatePhysicalAttack(abilities, level, isRanged = false, equipment = {}) {
    const proficiency = calculateProficiency(level);
    const abilityMod = isRanged ? abilities.getModifier('DEX') : abilities.getModifier('STR');
    const equipmentBonus = equipment.weapon || 0;
    
    return proficiency + abilityMod + equipmentBonus;
  }

  /**
   * Calculate spell attack bonus
   * @param {AbilityScores} abilities - Ability scores
   * @param {number} level - Character level
   * @param {string} primaryAbility - Primary casting ability
   * @param {Object} equipment - Equipment bonuses
   * @returns {number} Spell attack bonus
   */
  static calculateSpellAttack(abilities, level, primaryAbility = 'INT', equipment = {}) {
    const proficiency = calculateProficiency(level);
    const abilityMod = abilities.getModifier(primaryAbility);
    const equipmentBonus = equipment.focus || 0;
    
    return proficiency + abilityMod + equipmentBonus;
  }
}

/**
 * D20 Critical Hit System
 * Manages critical hit threat ranges and critical confirmations
 */
export class CriticalSystem {
  /**
   * Calculate critical hit threat range based on INT and LCK
   * @param {AbilityScores} abilities - Ability scores
   * @param {Object} visibleStats - Visible stats for LCK
   * @param {Object} equipment - Equipment critical modifiers
   * @returns {Object} Threat range info
   */
  static calculateThreatRange(abilities, visibleStats, equipment = {}) {
    const intMod = abilities.getModifier('INT');
    const lckMod = calculateModifier(visibleStats.LCK || 8); // Convert visible LCK to modifier
    const equipmentMod = equipment.criticalModifier || 0;
    
    // Base threat is 20, extend by (INT mod + LCK mod)
    const extension = Math.max(0, intMod + lckMod + equipmentMod);
    const maxExtension = HIDDEN_STATS.DICE.NATURAL_CRIT - COMBAT.CRITICAL.MAX_THREAT_RANGE;
    const actualExtension = Math.min(extension, maxExtension);
    
    const minThreat = HIDDEN_STATS.DICE.NATURAL_CRIT - actualExtension;
    
    return {
      minThreat,
      maxThreat: HIDDEN_STATS.DICE.NATURAL_CRIT,
      extension: actualExtension,
      rolls: []
    };
  }

  /**
   * Check if a d20 roll is a critical hit
   * @param {number} roll - D20 roll result
   * @param {Object} threatRange - Threat range from calculateThreatRange
   * @returns {boolean} True if critical hit
   */
  static isCriticalHit(roll, threatRange) {
    return roll >= threatRange.minThreat;
  }

  /**
   * Check if a d20 roll is a fumble (natural 1)
   * @param {number} roll - D20 roll result
   * @returns {boolean} True if fumble
   */
  static isFumble(roll) {
    return roll === HIDDEN_STATS.DICE.NATURAL_FUMBLE;
  }

  /**
   * Calculate critical damage multiplier
   * @param {Object} equipment - Equipment with critical multiplier info
   * @returns {number} Damage multiplier for critical hits
   */
  static getCriticalMultiplier(equipment = {}) {
    return equipment.criticalMultiplier || COMBAT.CRITICAL.DAMAGE_MULTIPLIER;
  }
}

/**
 * Main D20 Engine Class
 * Orchestrates all d20 calculations and provides the primary interface
 */
export class D20Engine {
  /**
   * Create a new D20 engine instance
   * @param {Object} config - Engine configuration
   */
  constructor(config = {}) {
    this.validateInputs = config.validateInputs !== false; // Default to true
    this.logCalculations = config.logCalculations || false;
    this.calculationLog = [];
  }

  /**
   * Log calculation for debugging (internal only)
   * @param {string} type - Calculation type
   * @param {Object} data - Calculation data
   * @private
   */
  log(type, data) {
    if (this.logCalculations) {
      this.calculationLog.push({
        timestamp: Date.now(),
        type,
        data: { ...data }
      });
    }
  }

  /**
   * Resolve physical attack vs target
   * @param {Object} attacker - Attacker data with abilities, level, equipment
   * @param {Object} defender - Defender data with abilities, equipment, situational
   * @param {Object} attackRoll - D20 roll result from RNG
   * @param {Object} options - Attack options (isRanged, etc.)
   * @returns {Object} Attack resolution result
   */
  resolvePhysicalAttack(attacker, defender, attackRoll, options = {}) {
    try {
      const attackBonus = AttackCalculator.calculatePhysicalAttack(
        attacker.abilities, 
        attacker.level, 
        options.isRanged,
        attacker.equipment
      );
      
      const defenseValue = DefenseCalculator.calculatePhysicalDV(
        defender.abilities,
        defender.equipment,
        defender.situational
      );

      const totalAttack = attackRoll.result + attackBonus;
      const hit = totalAttack >= defenseValue;
      
      const threatRange = CriticalSystem.calculateThreatRange(
        attacker.abilities,
        attacker.visibleStats,
        attacker.equipment
      );
      
      const critical = hit && CriticalSystem.isCriticalHit(attackRoll.result, threatRange);
      const fumble = CriticalSystem.isFumble(attackRoll.result);

      const result = {
        hit,
        critical,
        fumble,
        totalAttack,
        defenseValue,
        attackRoll: attackRoll.result,
        attackBonus,
        margin: totalAttack - defenseValue,
        threatRange
      };

      this.log('physical_attack', {
        attacker: attacker.id,
        defender: defender.id,
        result
      });

      return result;
    } catch (error) {
      throw new Error(`Physical attack resolution failed: ${error.message}`);
    }
  }

  /**
   * Resolve spell attack vs target
   * @param {Object} caster - Caster data with abilities, level, equipment
   * @param {Object} target - Target data with abilities, equipment, situational
   * @param {Object} attackRoll - D20 roll result from RNG
   * @param {Object} options - Spell options (primaryAbility, etc.)
   * @returns {Object} Spell attack resolution result
   */
  resolveSpellAttack(caster, target, attackRoll, options = {}) {
    try {
      const spellBonus = AttackCalculator.calculateSpellAttack(
        caster.abilities,
        caster.level,
        options.primaryAbility,
        caster.equipment
      );

      const defenseValue = DefenseCalculator.calculateMagicalDV(
        target.abilities,
        target.equipment,
        target.situational
      );

      const totalAttack = attackRoll.result + spellBonus;
      const hit = totalAttack >= defenseValue;
      
      const threatRange = CriticalSystem.calculateThreatRange(
        caster.abilities,
        caster.visibleStats,
        caster.equipment
      );
      
      const critical = hit && CriticalSystem.isCriticalHit(attackRoll.result, threatRange);
      const fumble = CriticalSystem.isFumble(attackRoll.result);

      const result = {
        hit,
        critical,
        fumble,
        totalAttack,
        defenseValue,
        attackRoll: attackRoll.result,
        spellBonus,
        margin: totalAttack - defenseValue,
        threatRange
      };

      this.log('spell_attack', {
        caster: caster.id,
        target: target.id,
        result
      });

      return result;
    } catch (error) {
      throw new Error(`Spell attack resolution failed: ${error.message}`);
    }
  }

  /**
   * Resolve saving throw
   * @param {Object} target - Target making the save
   * @param {Object} saveRoll - D20 roll result from RNG
   * @param {string} saveType - 'fortitude', 'reflex', or 'will'
   * @param {number} saveDC - Difficulty class for the save
   * @returns {Object} Save resolution result
   */
  resolveSavingThrow(target, saveRoll, saveType, saveDC) {
    try {
      const saveBonus = SaveSystem.getAllSaves(
        target.abilities,
        target.level,
        target.equipment
      )[saveType];

      const totalSave = saveRoll.result + saveBonus;
      const success = totalSave >= saveDC;

      const result = {
        success,
        totalSave,
        saveDC,
        saveRoll: saveRoll.result,
        saveBonus,
        saveType,
        margin: totalSave - saveDC
      };

      this.log('saving_throw', {
        target: target.id,
        result
      });

      return result;
    } catch (error) {
      throw new Error(`Saving throw resolution failed: ${error.message}`);
    }
  }

  /**
   * Get calculation log (for debugging)
   * @returns {Array} Array of logged calculations
   */
  getCalculationLog() {
    return [...this.calculationLog];
  }

  /**
   * Clear calculation log
   */
  clearCalculationLog() {
    this.calculationLog = [];
  }
}

export default D20Engine;