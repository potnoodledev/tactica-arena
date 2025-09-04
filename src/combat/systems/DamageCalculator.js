/**
 * Damage Calculator System for Tactica Arena
 * 
 * Handles all damage calculation including:
 * - Base damage calculation from weapon/spell formulas
 * - Critical hit damage multiplication (doubles dice, not modifiers)
 * - Damage mitigation from DEF/RES stats
 * - Elemental damage types and resistances
 * - Status effect damage modifications
 * - Environmental damage sources
 * 
 * The system uses hidden d20 mechanics for damage dice while exposing
 * only the final damage values to the client interface.
 */

import { CriticalSystem } from '../hidden/D20Engine.js';
import { DeterministicRNG } from '../core/DeterministicRNG.js';
import { COMBAT, VISIBLE_STATS, CLASSES } from '../constants/GameConstants.js';

/**
 * Damage type definitions and relationships
 */
export const DAMAGE_TYPES = {
  // Physical damage types
  PHYSICAL: 'physical',
  SLASHING: 'slashing',
  PIERCING: 'piercing',
  BLUDGEONING: 'bludgeoning',
  
  // Magical damage types
  MAGICAL: 'magical',
  FIRE: 'fire',
  ICE: 'ice',
  LIGHTNING: 'lightning',
  EARTH: 'earth',
  WIND: 'wind',
  DARK: 'dark',
  HOLY: 'holy',
  
  // Special damage types
  TRUE: 'true', // Ignores all mitigation
  POISON: 'poison',
  PSYCHIC: 'psychic'
};

/**
 * Weapon damage formulas and dice configurations
 */
export const WEAPON_DAMAGE = {
  // Melee weapons
  SWORD: { dice: 2, sides: 6, modifier: 'STR', type: DAMAGE_TYPES.SLASHING },
  DAGGER: { dice: 1, sides: 4, modifier: 'DEX', type: DAMAGE_TYPES.PIERCING },
  MACE: { dice: 1, sides: 8, modifier: 'STR', type: DAMAGE_TYPES.BLUDGEONING },
  SPEAR: { dice: 1, sides: 6, modifier: 'STR', type: DAMAGE_TYPES.PIERCING },
  HALBERD: { dice: 1, sides: 10, modifier: 'STR', type: DAMAGE_TYPES.SLASHING },
  
  // Ranged weapons
  BOW: { dice: 1, sides: 8, modifier: 'DEX', type: DAMAGE_TYPES.PIERCING },
  CROSSBOW: { dice: 1, sides: 10, modifier: 'DEX', type: DAMAGE_TYPES.PIERCING },
  
  // Magical implements
  STAFF: { dice: 1, sides: 6, modifier: 'INT', type: DAMAGE_TYPES.MAGICAL },
  TOME: { dice: 1, sides: 4, modifier: 'INT', type: DAMAGE_TYPES.MAGICAL },
  
  // Dual wield (special handling)
  DUAL_WIELD: { dice: 1, sides: 6, modifier: 'DEX', type: DAMAGE_TYPES.SLASHING }
};

/**
 * Spell damage formulas
 */
export const SPELL_DAMAGE = {
  // Basic offensive spells
  MAGIC_MISSILE: { dice: 3, sides: 4, modifier: 'INT', type: DAMAGE_TYPES.MAGICAL },
  FIREBALL: { dice: 6, sides: 6, modifier: 'INT', type: DAMAGE_TYPES.FIRE },
  ICE_SHARD: { dice: 4, sides: 6, modifier: 'INT', type: DAMAGE_TYPES.ICE },
  LIGHTNING_BOLT: { dice: 5, sides: 6, modifier: 'INT', type: DAMAGE_TYPES.LIGHTNING },
  
  // Cleric spells
  HOLY_LIGHT: { dice: 4, sides: 6, modifier: 'WIS', type: DAMAGE_TYPES.HOLY },
  DIVINE_WRATH: { dice: 3, sides: 8, modifier: 'WIS', type: DAMAGE_TYPES.HOLY },
  
  // Status damage over time
  POISON_CLOUD: { dice: 2, sides: 4, modifier: 'INT', type: DAMAGE_TYPES.POISON },
  BURNING: { dice: 1, sides: 6, modifier: null, type: DAMAGE_TYPES.FIRE }
};

/**
 * Damage mitigation and resistance calculator
 */
export class DamageResistance {
  /**
   * Calculate damage mitigation based on defense type and resistances
   * @param {Unit} defender - Defending unit
   * @param {string} damageType - Type of damage
   * @param {number} baseDamage - Base damage before mitigation
   * @returns {Object} Mitigation calculation result
   */
  static calculateMitigation(defender, damageType, baseDamage) {
    const stats = defender.getCurrentStats();
    let mitigation = 0;
    let resistancePercent = 0;
    
    // Base mitigation from DEF/RES
    if (this.isPhysicalDamage(damageType)) {
      mitigation = this.calculatePhysicalMitigation(stats.DEF, baseDamage);
    } else if (this.isMagicalDamage(damageType)) {
      mitigation = this.calculateMagicalMitigation(stats.RES, baseDamage);
    }
    
    // Elemental resistances from equipment and status effects
    resistancePercent = this.calculateElementalResistance(defender, damageType);
    
    // Apply mitigation
    const afterMitigation = Math.max(1, baseDamage - mitigation);
    const afterResistance = Math.max(1, Math.floor(afterMitigation * (1 - resistancePercent)));
    
    return {
      originalDamage: baseDamage,
      baseMitigation: mitigation,
      resistancePercent,
      finalDamage: afterResistance,
      damageReduced: baseDamage - afterResistance
    };
  }

  /**
   * Check if damage type is physical
   * @param {string} damageType - Damage type
   * @returns {boolean} True if physical damage
   */
  static isPhysicalDamage(damageType) {
    return [
      DAMAGE_TYPES.PHYSICAL,
      DAMAGE_TYPES.SLASHING,
      DAMAGE_TYPES.PIERCING,
      DAMAGE_TYPES.BLUDGEONING
    ].includes(damageType);
  }

  /**
   * Check if damage type is magical
   * @param {string} damageType - Damage type
   * @returns {boolean} True if magical damage
   */
  static isMagicalDamage(damageType) {
    return [
      DAMAGE_TYPES.MAGICAL,
      DAMAGE_TYPES.FIRE,
      DAMAGE_TYPES.ICE,
      DAMAGE_TYPES.LIGHTNING,
      DAMAGE_TYPES.EARTH,
      DAMAGE_TYPES.WIND,
      DAMAGE_TYPES.DARK,
      DAMAGE_TYPES.HOLY
    ].includes(damageType);
  }

  /**
   * Calculate physical damage mitigation
   * @param {number} defenseValue - DEF stat value
   * @param {number} baseDamage - Base damage
   * @returns {number} Damage reduction amount
   */
  static calculatePhysicalMitigation(defenseValue, baseDamage) {
    // Formula: 2% damage reduction per DEF point, capped at 90%
    const reductionPercent = Math.min(0.9, defenseValue * 0.02);
    return Math.floor(baseDamage * reductionPercent);
  }

  /**
   * Calculate magical damage mitigation
   * @param {number} resistanceValue - RES stat value
   * @param {number} baseDamage - Base damage
   * @returns {number} Damage reduction amount
   */
  static calculateMagicalMitigation(resistanceValue, baseDamage) {
    // Formula: 2% damage reduction per RES point, capped at 90%
    const reductionPercent = Math.min(0.9, resistanceValue * 0.02);
    return Math.floor(baseDamage * reductionPercent);
  }

  /**
   * Calculate elemental resistance from equipment and effects
   * @param {Unit} defender - Defending unit
   * @param {string} damageType - Damage type
   * @returns {number} Resistance percentage (0.0 to 1.0)
   */
  static calculateElementalResistance(defender, damageType) {
    let resistance = 0;
    
    // Check equipment resistances
    for (const item of defender.equipment.values()) {
      const itemResistances = item.specialEffects.filter(effect => 
        effect.type === 'resistance' && effect.damageType === damageType
      );
      for (const resist of itemResistances) {
        resistance += resist.value || 0;
      }
    }
    
    // Check status effect resistances/vulnerabilities
    for (const effect of defender.statusEffects) {
      if (effect.effects.resistance && effect.effects.resistance[damageType]) {
        resistance += effect.effects.resistance[damageType];
      }
    }
    
    // Cap resistance at 95% (always take at least 5% damage)
    return Math.max(-1.0, Math.min(0.95, resistance));
  }
}

/**
 * Main Damage Calculator class
 */
export class DamageCalculator {
  /**
   * Create damage calculator
   * @param {Object} config - Calculator configuration
   */
  constructor(config = {}) {
    this.enableCriticalHits = config.enableCriticalHits !== false;
    this.enableElementalEffects = config.enableElementalEffects !== false;
    this.logCalculations = config.logCalculations || false;
    this.calculationLog = [];
  }

  /**
   * Log calculation for debugging
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
   * Calculate base weapon damage
   * @param {Unit} attacker - Attacking unit
   * @param {string} weaponType - Weapon type
   * @param {DeterministicRNG} rng - RNG instance
   * @param {boolean} isCritical - Whether this is a critical hit
   * @returns {Object} Damage calculation result
   */
  calculateWeaponDamage(attacker, weaponType, rng, isCritical = false) {
    const weaponData = WEAPON_DAMAGE[weaponType.toUpperCase()];
    if (!weaponData) {
      throw new Error(`Unknown weapon type: ${weaponType}`);
    }

    const attackerData = attacker.getHiddenData();
    const stats = attacker.getCurrentStats();
    
    // Roll damage dice
    let diceDamage = 0;
    const diceRolls = [];
    
    const diceCount = isCritical ? weaponData.dice * 2 : weaponData.dice;
    for (let i = 0; i < diceCount; i++) {
      const roll = rng.randInt(1, weaponData.sides);
      diceDamage += roll;
      diceRolls.push(roll);
    }

    // Add ability modifier (not doubled on crit)
    let abilityDamage = 0;
    if (weaponData.modifier) {
      const modifier = attackerData.abilities.getModifier(weaponData.modifier);
      abilityDamage = Math.max(0, modifier);
    }

    // Add weapon enhancement bonuses
    let enhancementBonus = 0;
    for (const item of attacker.equipment.values()) {
      if (item.type === 'weapon') {
        enhancementBonus += item.statModifiers.ATK || 0;
      }
    }

    const totalDamage = diceDamage + abilityDamage + enhancementBonus;

    const result = {
      type: weaponData.type,
      diceDamage,
      diceRolls,
      abilityDamage,
      enhancementBonus,
      totalDamage: Math.max(1, totalDamage),
      isCritical,
      weaponType
    };

    this.log('weapon_damage', result);
    return result;
  }

  /**
   * Calculate spell damage
   * @param {Unit} caster - Casting unit
   * @param {string} spellType - Spell type
   * @param {DeterministicRNG} rng - RNG instance
   * @param {boolean} isCritical - Whether this is a critical hit
   * @param {number} spellLevel - Spell level for scaling
   * @returns {Object} Damage calculation result
   */
  calculateSpellDamage(caster, spellType, rng, isCritical = false, spellLevel = 1) {
    const spellData = SPELL_DAMAGE[spellType.toUpperCase()];
    if (!spellData) {
      throw new Error(`Unknown spell type: ${spellType}`);
    }

    const casterData = caster.getHiddenData();
    
    // Roll damage dice (scale with spell level)
    let diceDamage = 0;
    const diceRolls = [];
    
    const baseDice = spellData.dice + Math.floor(spellLevel / 2);
    const diceCount = isCritical ? baseDice * 2 : baseDice;
    
    for (let i = 0; i < diceCount; i++) {
      const roll = rng.randInt(1, spellData.sides);
      diceDamage += roll;
      diceRolls.push(roll);
    }

    // Add ability modifier (not doubled on crit)
    let abilityDamage = 0;
    if (spellData.modifier) {
      const modifier = casterData.abilities.getModifier(spellData.modifier);
      abilityDamage = Math.max(0, modifier);
    }

    // Add magical focus bonuses
    let focusBonus = 0;
    for (const item of caster.equipment.values()) {
      if (item.type === 'weapon' && (item.name.includes('staff') || item.name.includes('tome'))) {
        focusBonus += item.statModifiers.MAG || 0;
      }
    }

    // Spell level scaling bonus
    const levelBonus = Math.floor(spellLevel * 1.5);

    const totalDamage = diceDamage + abilityDamage + focusBonus + levelBonus;

    const result = {
      type: spellData.type,
      diceDamage,
      diceRolls,
      abilityDamage,
      focusBonus,
      levelBonus,
      spellLevel,
      totalDamage: Math.max(1, totalDamage),
      isCritical,
      spellType
    };

    this.log('spell_damage', result);
    return result;
  }

  /**
   * Calculate final damage after all modifiers and mitigation
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {Object} baseDamageResult - Base damage calculation result
   * @param {Object} options - Additional options
   * @returns {Object} Final damage result
   */
  calculateFinalDamage(attacker, defender, baseDamageResult, options = {}) {
    let damage = baseDamageResult.totalDamage;
    const damageType = baseDamageResult.type;
    
    // Apply status effect damage modifiers
    damage = this.applyStatusDamageModifiers(attacker, defender, damage, damageType);
    
    // Apply situational damage modifiers
    damage = this.applySituationalModifiers(attacker, defender, damage, options);
    
    // Apply damage mitigation (unless true damage)
    let mitigationResult = { originalDamage: damage, finalDamage: damage };
    if (damageType !== DAMAGE_TYPES.TRUE) {
      mitigationResult = DamageResistance.calculateMitigation(defender, damageType, damage);
    }

    const result = {
      baseDamage: baseDamageResult,
      beforeMitigation: damage,
      afterMitigation: mitigationResult.finalDamage,
      mitigation: mitigationResult,
      damageType,
      totalDamageReduced: damage - mitigationResult.finalDamage,
      isCritical: baseDamageResult.isCritical
    };

    this.log('final_damage', result);
    return result;
  }

  /**
   * Apply status effect damage modifiers
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {number} damage - Base damage
   * @param {string} damageType - Damage type
   * @returns {number} Modified damage
   * @private
   */
  applyStatusDamageModifiers(attacker, defender, damage, damageType) {
    let modifiedDamage = damage;
    
    // Attacker buffs/debuffs
    for (const effect of attacker.statusEffects) {
      if (effect.effects.damageBonus) {
        const bonus = effect.effects.damageBonus[damageType] || effect.effects.damageBonus.all || 0;
        modifiedDamage += bonus * effect.intensity;
      }
      if (effect.effects.damageMultiplier) {
        const multiplier = effect.effects.damageMultiplier[damageType] || effect.effects.damageMultiplier.all || 1;
        modifiedDamage = Math.floor(modifiedDamage * multiplier);
      }
    }
    
    // Defender vulnerabilities/protections
    for (const effect of defender.statusEffects) {
      if (effect.effects.damageVulnerability) {
        const vulnerability = effect.effects.damageVulnerability[damageType] || 0;
        modifiedDamage = Math.floor(modifiedDamage * (1 + vulnerability));
      }
      if (effect.effects.damageReduction) {
        const reduction = effect.effects.damageReduction[damageType] || effect.effects.damageReduction.all || 0;
        modifiedDamage = Math.max(1, modifiedDamage - reduction);
      }
    }

    return Math.max(1, modifiedDamage);
  }

  /**
   * Apply situational damage modifiers
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {number} damage - Base damage
   * @param {Object} options - Situational options
   * @returns {number} Modified damage
   * @private
   */
  applySituationalModifiers(attacker, defender, damage, options) {
    let modifiedDamage = damage;
    
    // Backstab damage bonus
    if (options.backstab) {
      modifiedDamage = Math.floor(modifiedDamage * 1.5); // 50% bonus
    }
    
    // Flanking damage bonus
    if (options.flanking && !options.backstab) {
      modifiedDamage = Math.floor(modifiedDamage * 1.25); // 25% bonus
    }
    
    // Height advantage
    if (options.heightAdvantage > 0) {
      const bonus = 1 + (options.heightAdvantage * 0.1); // 10% per height level
      modifiedDamage = Math.floor(modifiedDamage * bonus);
    }
    
    // Class-specific bonuses
    const classBonus = this.getClassDamageBonus(attacker, defender, options);
    modifiedDamage = Math.floor(modifiedDamage * classBonus);

    return Math.max(1, modifiedDamage);
  }

  /**
   * Get class-specific damage bonuses
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {Object} options - Attack options
   * @returns {number} Damage multiplier
   * @private
   */
  getClassDamageBonus(attacker, defender, options) {
    let multiplier = 1.0;
    
    switch (attacker.class) {
      case 'ROGUE':
        // Rogues get bonus damage when attacking from behind or when target is debuffed
        if (options.backstab) multiplier *= 1.5;
        if (defender.statusEffects.some(e => e.type === 'debuff')) multiplier *= 1.2;
        break;
        
      case 'ARCHER':
        // Archers get bonus damage at longer ranges
        if (options.distance > 3) multiplier *= 1.3;
        break;
        
      case 'SWORDSMAN':
        // Swordsmen get bonus damage in melee against single targets
        if (options.distance <= 1) multiplier *= 1.2;
        break;
        
      case 'MAGE':
        // Mages get bonus damage against targets with low RES
        if (defender.getCurrentStats().RES < 20) multiplier *= 1.25;
        break;
    }
    
    return multiplier;
  }

  /**
   * Calculate damage over time effect
   * @param {Unit} target - Target unit
   * @param {Object} effectData - DOT effect data
   * @param {DeterministicRNG} rng - RNG instance
   * @returns {Object} DOT damage result
   */
  calculateDOTDamage(target, effectData, rng) {
    let damage = 0;
    const diceRolls = [];
    
    // Roll damage dice for DOT
    if (effectData.dice && effectData.sides) {
      for (let i = 0; i < effectData.dice; i++) {
        const roll = rng.randInt(1, effectData.sides);
        damage += roll;
        diceRolls.push(roll);
      }
    } else {
      damage = effectData.flatDamage || 0;
    }
    
    // Apply intensity multiplier
    damage *= effectData.intensity || 1;
    
    // Apply DOT-specific mitigation (usually reduced)
    const mitigationResult = DamageResistance.calculateMitigation(
      target, 
      effectData.damageType, 
      Math.floor(damage * 0.5) // DOTs bypass some mitigation
    );

    return {
      baseDamage: damage,
      diceRolls,
      finalDamage: mitigationResult.finalDamage,
      damageType: effectData.damageType,
      mitigation: mitigationResult,
      effectName: effectData.name
    };
  }

  /**
   * Calculate area of effect damage distribution
   * @param {Unit} caster - Casting unit
   * @param {Array} targets - Array of target units
   * @param {Object} spellData - Spell configuration
   * @param {DeterministicRNG} rng - RNG instance
   * @param {boolean} isCritical - Whether spell critically hit
   * @returns {Array} Array of damage results for each target
   */
  calculateAOEDamage(caster, targets, spellData, rng, isCritical = false) {
    const results = [];
    
    for (const target of targets) {
      // Each target gets their own damage roll for fairness
      const baseDamage = this.calculateSpellDamage(
        caster, 
        spellData.type, 
        rng, 
        isCritical, 
        spellData.level || 1
      );
      
      const finalDamage = this.calculateFinalDamage(caster, target, baseDamage, spellData.options);
      
      results.push({
        targetId: target.id,
        targetName: target.name,
        ...finalDamage
      });
    }
    
    return results;
  }

  /**
   * Calculate damage preview (estimated range)
   * @param {Unit} attacker - Attacking unit
   * @param {Unit} defender - Defending unit
   * @param {Object} attackData - Attack configuration
   * @returns {Object} Damage preview information
   */
  calculateDamagePreview(attacker, defender, attackData) {
    const weaponData = attackData.isSpell ? 
      SPELL_DAMAGE[attackData.type?.toUpperCase()] : 
      WEAPON_DAMAGE[attackData.type?.toUpperCase()];
      
    if (!weaponData) {
      throw new Error(`Unknown attack type: ${attackData.type}`);
    }

    const attackerData = attacker.getHiddenData();
    
    // Calculate ability modifier
    let abilityMod = 0;
    if (weaponData.modifier) {
      abilityMod = Math.max(0, attackerData.abilities.getModifier(weaponData.modifier));
    }
    
    // Calculate enhancement bonuses
    let enhancementBonus = 0;
    const statType = attackData.isSpell ? 'MAG' : 'ATK';
    for (const item of attacker.equipment.values()) {
      enhancementBonus += item.statModifiers[statType] || 0;
    }

    // Calculate base damage range
    const minDice = weaponData.dice;
    const maxDice = weaponData.dice * weaponData.sides;
    const staticDamage = abilityMod + enhancementBonus;
    
    const baseDamageMin = Math.max(1, minDice + staticDamage);
    const baseDamageMax = Math.max(1, maxDice + staticDamage);
    
    // Calculate critical damage range
    const critDamageMin = Math.max(1, (minDice * 2) + staticDamage);
    const critDamageMax = Math.max(1, (maxDice * 2) + staticDamage);
    
    // Estimate mitigation
    let estimatedMitigation = 0;
    const defenderStats = defender.getCurrentStats();
    
    if (DamageResistance.isPhysicalDamage(weaponData.type)) {
      estimatedMitigation = Math.floor(baseDamageMax * Math.min(0.9, defenderStats.DEF * 0.02));
    } else if (DamageResistance.isMagicalDamage(weaponData.type)) {
      estimatedMitigation = Math.floor(baseDamageMax * Math.min(0.9, defenderStats.RES * 0.02));
    }

    return {
      damageType: weaponData.type,
      baseDamageRange: {
        min: baseDamageMin,
        max: baseDamageMax,
        average: Math.floor((baseDamageMin + baseDamageMax) / 2)
      },
      criticalDamageRange: {
        min: critDamageMin,
        max: critDamageMax,
        average: Math.floor((critDamageMin + critDamageMax) / 2)
      },
      estimatedFinalRange: {
        min: Math.max(1, baseDamageMin - estimatedMitigation),
        max: Math.max(1, baseDamageMax - estimatedMitigation),
        criticalMin: Math.max(1, critDamageMin - estimatedMitigation),
        criticalMax: Math.max(1, critDamageMax - estimatedMitigation)
      },
      mitigationInfo: {
        estimatedReduction: estimatedMitigation,
        defenderDEF: defenderStats.DEF,
        defenderRES: defenderStats.RES
      }
    };
  }

  /**
   * Get calculation log for debugging
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

export default DamageCalculator;