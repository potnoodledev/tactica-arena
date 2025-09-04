/**
 * Unit Data Model for Tactica Arena Combat System
 * 
 * Represents a combat unit with dual-layer architecture:
 * - Hidden backend data (d20 ability scores, internal calculations)
 * - Visible frontend data (game stats, combat state)
 * 
 * The Unit class maintains complete separation between internal d20 mechanics
 * and the player-facing stats, ensuring the d20 system remains completely
 * hidden while providing all necessary functionality.
 */

import { AbilityScores, calculateProficiency } from '../hidden/D20Engine.js';
import { 
  VISIBLE_STATS, 
  HIDDEN_STATS, 
  ACTION_POINTS, 
  CLASSES, 
  FACTIONS,
  VALIDATION 
} from '../constants/GameConstants.js';

/**
 * Status Effect class for tracking buffs, debuffs, and special conditions
 */
export class StatusEffect {
  /**
   * Create a new status effect
   * @param {Object} config - Status effect configuration
   */
  constructor(config) {
    this.id = config.id || `effect_${Date.now()}_${Math.random()}`;
    this.type = config.type; // 'buff', 'debuff', 'condition'
    this.name = config.name;
    this.description = config.description;
    this.duration = config.duration || 1;
    this.maxDuration = config.maxDuration || config.duration || 1;
    this.intensity = config.intensity || 1;
    this.maxStacks = config.maxStacks || 1;
    this.stackType = config.stackType || 'none'; // 'none', 'extend', 'intensity'
    this.source = config.source; // Unit ID that applied this effect
    this.allowsSave = config.allowsSave || false;
    this.saveType = config.saveType; // 'fortitude', 'reflex', 'will'
    this.saveDC = config.saveDC;
    this.triggersOn = config.triggersOn || 'start_turn'; // 'start_turn', 'end_turn', 'on_damage'
    this.effects = config.effects || {}; // Stat modifications
    this.appliedAt = Date.now();
  }

  /**
   * Check if effect has expired
   * @returns {boolean} True if effect should be removed
   */
  hasExpired() {
    return this.duration <= 0;
  }

  /**
   * Advance effect duration by one turn
   */
  advance() {
    this.duration = Math.max(0, this.duration - 1);
  }

  /**
   * Apply effect to unit stats (returns modifier object)
   * @returns {Object} Stat modifiers to apply
   */
  getModifiers() {
    if (this.hasExpired()) return {};
    
    const modifiers = {};
    for (const [stat, value] of Object.entries(this.effects)) {
      modifiers[stat] = (value * this.intensity) || 0;
    }
    return modifiers;
  }

  /**
   * Attempt to stack with existing effect
   * @param {StatusEffect} existingEffect - Existing effect of same type
   * @returns {boolean} True if stacking succeeded
   */
  stackWith(existingEffect) {
    if (existingEffect.name !== this.name) return false;
    
    switch (this.stackType) {
      case 'extend':
        existingEffect.duration = Math.max(existingEffect.duration, this.duration);
        return true;
      
      case 'intensity':
        if (existingEffect.intensity < existingEffect.maxStacks) {
          existingEffect.intensity = Math.min(
            existingEffect.maxStacks, 
            existingEffect.intensity + this.intensity
          );
          return true;
        }
        return false;
      
      case 'none':
      default:
        return false;
    }
  }

  /**
   * Clone status effect
   * @returns {StatusEffect} New status effect instance
   */
  clone() {
    return new StatusEffect({
      id: this.id,
      type: this.type,
      name: this.name,
      description: this.description,
      duration: this.duration,
      maxDuration: this.maxDuration,
      intensity: this.intensity,
      maxStacks: this.maxStacks,
      stackType: this.stackType,
      source: this.source,
      allowsSave: this.allowsSave,
      saveType: this.saveType,
      saveDC: this.saveDC,
      triggersOn: this.triggersOn,
      effects: { ...this.effects },
      appliedAt: this.appliedAt
    });
  }
}

/**
 * Equipment piece class for managing gear effects
 */
export class Equipment {
  /**
   * Create equipment piece
   * @param {Object} config - Equipment configuration
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type; // 'weapon', 'armor', 'accessory', 'consumable'
    this.tier = config.tier || 'common';
    this.durability = config.durability || 10;
    this.maxDurability = config.maxDurability || config.durability || 10;
    this.statModifiers = config.statModifiers || {};
    this.abilityModifiers = config.abilityModifiers || {}; // Hidden d20 ability bonuses
    this.specialEffects = config.specialEffects || [];
    this.requirements = config.requirements || {};
    this.value = config.value || 100;
  }

  /**
   * Check if equipment is broken
   * @returns {boolean} True if durability is 0
   */
  isBroken() {
    return this.durability <= 0;
  }

  /**
   * Get effective stat modifiers (0 if broken)
   * @returns {Object} Stat modifiers
   */
  getStatModifiers() {
    return this.isBroken() ? {} : { ...this.statModifiers };
  }

  /**
   * Get effective ability modifiers (0 if broken)
   * @returns {Object} Ability score modifiers
   */
  getAbilityModifiers() {
    return this.isBroken() ? {} : { ...this.abilityModifiers };
  }

  /**
   * Reduce durability (typically after combat)
   * @param {number} amount - Durability reduction
   */
  reduceDurability(amount = 1) {
    this.durability = Math.max(0, this.durability - amount);
  }

  /**
   * Repair equipment to full durability
   */
  repair() {
    this.durability = this.maxDurability;
  }
}

/**
 * Main Unit class representing a combat unit
 */
export class Unit {
  /**
   * Create a new combat unit
   * @param {Object} config - Unit configuration
   */
  constructor(config) {
    // Core identification
    this.id = config.id || `unit_${Date.now()}_${Math.random()}`;
    this.name = config.name || 'Unknown Unit';
    this.class = config.class || 'SWORDSMAN';
    this.faction = config.faction || 'HUMAN_KINGDOM';
    this.level = Math.max(1, Math.min(80, config.level || 1));
    this.isLeader = config.isLeader || false;

    // Hidden d20 ability scores (NEVER exposed to client)
    this.hiddenAbilities = new AbilityScores(config.hiddenAbilities);
    
    // Equipment system
    this.equipment = new Map();
    this.consumables = [];
    if (config.equipment) {
      this.loadEquipment(config.equipment);
    }

    // Base visible stats (derived from hidden abilities + equipment)
    this.baseStats = this.deriveVisibleStats();
    
    // Current combat state
    this.currentHP = this.baseStats.HP;
    this.currentMP = this.baseStats.MP;
    this.currentAP = ACTION_POINTS.MAX_PER_TURN;
    
    // Status effects and conditions
    this.statusEffects = [];
    this.isIncapacitated = false;
    
    // Combat positioning
    this.position = config.position || { x: 0, y: 0 };
    this.facing = config.facing || 'north';
    
    // Turn state
    this.hasActedThisTurn = false;
    this.turnOrder = 0;
    
    // Experience and progression
    this.experience = config.experience || 0;
    this.skillPoints = config.skillPoints || 0;
    this.abilities = config.abilities || [];
    
    // Validation
    this.validate();
  }

  /**
   * Derive visible stats from hidden abilities and equipment
   * This is the core conversion from d20 to visible stats
   * @returns {Object} Visible stats object
   * @private
   */
  deriveVisibleStats() {
    const proficiency = calculateProficiency(this.level);
    const modifiers = this.hiddenAbilities.getAllModifiers();
    
    // Get equipment bonuses
    const equipmentStats = this.getEquipmentStatModifiers();
    const equipmentAbilities = this.getEquipmentAbilityModifiers();
    
    // Apply ability modifiers to equipment
    const effectiveModifiers = { ...modifiers };
    for (const [ability, bonus] of Object.entries(equipmentAbilities)) {
      effectiveModifiers[ability] = (effectiveModifiers[ability] || 0) + bonus;
    }

    // Class-specific base values
    const classData = CLASSES.MODIFIERS[this.class] || CLASSES.MODIFIERS.SWORDSMAN;
    
    // Calculate derived stats
    const stats = {
      // Health: CON-based with level scaling
      HP: Math.max(VISIBLE_STATS.HP.MIN, 
        VISIBLE_STATS.HP.BASE + (effectiveModifiers.CON * 15) + (this.level * 8) + (equipmentStats.HP || 0)),
      
      // Mana: INT/WIS-based with class modifiers  
      MP: Math.max(VISIBLE_STATS.MP.MIN,
        VISIBLE_STATS.MP.BASE + (effectiveModifiers.INT * 8) + (effectiveModifiers.WIS * 4) + 
        (this.level * 2) + (equipmentStats.MP || 0)),
      
      // Attack: STR-based with proficiency
      ATK: Math.max(VISIBLE_STATS.ATK.MIN,
        VISIBLE_STATS.ATK.BASE + (effectiveModifiers.STR * 3) + proficiency + (equipmentStats.ATK || 0)),
      
      // Defense: CON-based with armor
      DEF: Math.max(VISIBLE_STATS.DEF.MIN,
        VISIBLE_STATS.DEF.BASE + (effectiveModifiers.CON * 2) + (equipmentStats.DEF || 0)),
      
      // Magic: INT-based with proficiency  
      MAG: Math.max(VISIBLE_STATS.MAG.MIN,
        VISIBLE_STATS.MAG.BASE + (effectiveModifiers.INT * 3) + proficiency + (equipmentStats.MAG || 0)),
      
      // Resistance: WIS-based with gear
      RES: Math.max(VISIBLE_STATS.RES.MIN,
        VISIBLE_STATS.RES.BASE + (effectiveModifiers.WIS * 2) + (equipmentStats.RES || 0)),
      
      // Agility: DEX-based (affects initiative and evasion)
      AGL: Math.max(VISIBLE_STATS.AGL.MIN,
        VISIBLE_STATS.AGL.BASE + (effectiveModifiers.DEX * 2) + (equipmentStats.AGL || 0)),
      
      // Intelligence: Direct from hidden INT with level bonus
      INT: Math.max(VISIBLE_STATS.INT.MIN,
        VISIBLE_STATS.INT.BASE + effectiveModifiers.INT + Math.floor(this.level / 10) + (equipmentStats.INT || 0)),
      
      // Movement: DEX/CON-based with class modifiers
      MOV: Math.max(VISIBLE_STATS.MOV.MIN,
        VISIBLE_STATS.MOV.BASE + Math.floor(effectiveModifiers.DEX / 2) + (equipmentStats.MOV || 0)),
      
      // Range: Equipment and class-based
      RNG: Math.max(VISIBLE_STATS.RNG.MIN,
        VISIBLE_STATS.RNG.BASE + (equipmentStats.RNG || 0)),
      
      // Luck: CHA-based with level bonus
      LCK: Math.max(VISIBLE_STATS.LCK.MIN,
        VISIBLE_STATS.LCK.BASE + effectiveModifiers.CHA + Math.floor(this.level / 20) + (equipmentStats.LCK || 0))
    };

    // Apply faction bonuses
    const factionData = FACTIONS.PASSIVES[this.faction];
    if (factionData) {
      if (factionData.base_agl_bonus) {
        stats.AGL += factionData.base_agl_bonus;
      }
    }

    // Clamp all stats to their valid ranges
    for (const [stat, value] of Object.entries(stats)) {
      const range = VISIBLE_STATS[stat];
      if (range) {
        stats[stat] = Math.max(range.MIN, Math.min(range.MAX, value));
      }
    }

    return stats;
  }

  /**
   * Get current effective visible stats (base + status effects)
   * @returns {Object} Current effective stats
   */
  getCurrentStats() {
    const base = { ...this.baseStats };
    
    // Apply status effect modifiers
    for (const effect of this.statusEffects) {
      const modifiers = effect.getModifiers();
      for (const [stat, modifier] of Object.entries(modifiers)) {
        if (base[stat] !== undefined) {
          base[stat] = Math.max(0, base[stat] + modifier);
        }
      }
    }
    
    return base;
  }

  /**
   * Load equipment from configuration
   * @param {Array|Object} equipmentData - Equipment data
   * @private
   */
  loadEquipment(equipmentData) {
    if (Array.isArray(equipmentData)) {
      for (const item of equipmentData) {
        this.equipItem(new Equipment(item));
      }
    } else if (equipmentData instanceof Map) {
      this.equipment = new Map(equipmentData);
    }
  }

  /**
   * Get combined stat modifiers from all equipment
   * @returns {Object} Combined stat modifiers
   * @private
   */
  getEquipmentStatModifiers() {
    const combined = {};
    for (const item of this.equipment.values()) {
      const modifiers = item.getStatModifiers();
      for (const [stat, value] of Object.entries(modifiers)) {
        combined[stat] = (combined[stat] || 0) + value;
      }
    }
    return combined;
  }

  /**
   * Get combined ability modifiers from all equipment
   * @returns {Object} Combined ability modifiers
   * @private
   */
  getEquipmentAbilityModifiers() {
    const combined = {};
    for (const item of this.equipment.values()) {
      const modifiers = item.getAbilityModifiers();
      for (const [ability, value] of Object.entries(modifiers)) {
        combined[ability] = (combined[ability] || 0) + value;
      }
    }
    return combined;
  }

  /**
   * Equip an item
   * @param {Equipment} item - Item to equip
   * @returns {boolean} True if successfully equipped
   */
  equipItem(item) {
    if (this.equipment.size >= VALIDATION.LIMITS.MAX_CONCURRENT_EFFECTS) {
      return false; // Equipment limit reached
    }
    
    this.equipment.set(item.id, item);
    this.baseStats = this.deriveVisibleStats(); // Recalculate stats
    return true;
  }

  /**
   * Unequip an item
   * @param {string} itemId - ID of item to unequip
   * @returns {Equipment|null} Unequipped item or null
   */
  unequipItem(itemId) {
    const item = this.equipment.get(itemId);
    if (item) {
      this.equipment.delete(itemId);
      this.baseStats = this.deriveVisibleStats(); // Recalculate stats
      return item;
    }
    return null;
  }

  /**
   * Apply status effect to unit
   * @param {StatusEffect} effect - Status effect to apply
   * @returns {boolean} True if effect was applied
   */
  applyStatusEffect(effect) {
    // Check for existing effect of same type
    const existingIndex = this.statusEffects.findIndex(e => e.name === effect.name);
    
    if (existingIndex >= 0) {
      const existing = this.statusEffects[existingIndex];
      if (effect.stackWith(existing)) {
        return true; // Stacked successfully
      } else {
        // Replace existing effect
        this.statusEffects[existingIndex] = effect.clone();
        return true;
      }
    }
    
    // Apply new effect
    if (this.statusEffects.length < VALIDATION.LIMITS.MAX_CONCURRENT_EFFECTS) {
      this.statusEffects.push(effect.clone());
      return true;
    }
    
    return false; // Too many effects
  }

  /**
   * Remove status effect by ID or name
   * @param {string} effectId - Effect ID or name
   * @returns {boolean} True if effect was removed
   */
  removeStatusEffect(effectId) {
    const index = this.statusEffects.findIndex(e => e.id === effectId || e.name === effectId);
    if (index >= 0) {
      this.statusEffects.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Process status effects for turn phase
   * @param {string} phase - Turn phase ('start_turn', 'end_turn')
   * @returns {Array} Array of effect results
   */
  processStatusEffects(phase) {
    const results = [];
    
    // Process effects that trigger on this phase
    for (const effect of this.statusEffects) {
      if (effect.triggersOn === phase) {
        results.push({
          effect: effect.name,
          type: effect.type,
          modifiers: effect.getModifiers(),
          intensity: effect.intensity
        });
        
        // Advance effect duration
        effect.advance();
      }
    }
    
    // Remove expired effects
    this.statusEffects = this.statusEffects.filter(effect => !effect.hasExpired());
    
    return results;
  }

  /**
   * Take damage
   * @param {number} amount - Damage amount
   * @param {string} type - Damage type ('physical', 'magical', 'true')
   * @returns {Object} Damage result
   */
  takeDamage(amount, type = 'physical') {
    if (this.isIncapacitated) {
      return { damage: 0, actualDamage: 0, overkill: 0 };
    }

    const currentStats = this.getCurrentStats();
    let mitigation = 0;
    
    // Apply damage mitigation
    switch (type) {
      case 'physical':
        mitigation = currentStats.DEF * 0.02; // 2% reduction per DEF point
        break;
      case 'magical':
        mitigation = currentStats.RES * 0.02; // 2% reduction per RES point
        break;
      case 'true':
        mitigation = 0; // True damage ignores mitigation
        break;
    }
    
    const mitigatedDamage = Math.max(1, Math.floor(amount * (1 - Math.min(0.9, mitigation))));
    const actualDamage = Math.min(this.currentHP, mitigatedDamage);
    const overkill = mitigatedDamage - actualDamage;
    
    this.currentHP = Math.max(0, this.currentHP - actualDamage);
    
    // Check for incapacitation
    if (this.currentHP <= 0) {
      this.isIncapacitated = true;
      this.currentAP = 0;
    }
    
    return {
      damage: amount,
      actualDamage,
      overkill,
      mitigation: amount - mitigatedDamage,
      remainingHP: this.currentHP,
      type
    };
  }

  /**
   * Heal unit
   * @param {number} amount - Healing amount
   * @returns {Object} Healing result
   */
  heal(amount) {
    if (this.isIncapacitated && amount <= 0) {
      return { healing: 0, actualHealing: 0, overheal: 0 };
    }
    
    const maxHP = this.getCurrentStats().HP;
    const actualHealing = Math.min(amount, maxHP - this.currentHP);
    const overheal = amount - actualHealing;
    
    this.currentHP = Math.min(maxHP, this.currentHP + actualHealing);
    
    // Revive if healed from 0 HP
    if (this.currentHP > 0) {
      this.isIncapacitated = false;
    }
    
    return {
      healing: amount,
      actualHealing,
      overheal,
      currentHP: this.currentHP
    };
  }

  /**
   * Spend action points
   * @param {number} cost - AP cost
   * @returns {boolean} True if AP was successfully spent
   */
  spendAP(cost) {
    if (this.currentAP >= cost && !this.isIncapacitated) {
      this.currentAP = Math.max(0, this.currentAP - cost);
      this.hasActedThisTurn = true;
      return true;
    }
    return false;
  }

  /**
   * Restore action points (start of turn)
   */
  restoreAP() {
    if (!this.isIncapacitated) {
      this.currentAP = ACTION_POINTS.MAX_PER_TURN;
      this.hasActedThisTurn = false;
    }
  }

  /**
   * Check if unit can perform an action
   * @param {number} apCost - Required AP cost
   * @returns {boolean} True if action is possible
   */
  canAct(apCost = 1) {
    return !this.isIncapacitated && this.currentAP >= apCost;
  }

  /**
   * Get hidden d20 data for internal calculations (NEVER expose to client)
   * @returns {Object} Hidden calculation data
   * @internal
   */
  getHiddenData() {
    return {
      abilities: this.hiddenAbilities,
      level: this.level,
      proficiency: calculateProficiency(this.level),
      equipment: this.getEquipmentAbilityModifiers(),
      visibleStats: this.getCurrentStats()
    };
  }

  /**
   * Get public unit data (safe for client consumption)
   * @returns {Object} Public unit data
   */
  getPublicData() {
    return {
      id: this.id,
      name: this.name,
      class: this.class,
      faction: this.faction,
      level: this.level,
      isLeader: this.isLeader,
      stats: this.getCurrentStats(),
      currentHP: this.currentHP,
      currentMP: this.currentMP,
      currentAP: this.currentAP,
      isIncapacitated: this.isIncapacitated,
      position: { ...this.position },
      facing: this.facing,
      statusEffects: this.statusEffects.map(effect => ({
        name: effect.name,
        type: effect.type,
        duration: effect.duration,
        intensity: effect.intensity
      })),
      hasActedThisTurn: this.hasActedThisTurn
    };
  }

  /**
   * Validate unit configuration
   * @throws {Error} If unit configuration is invalid
   * @private
   */
  validate() {
    if (!this.id || typeof this.id !== 'string') {
      throw new Error('Unit ID is required and must be a string');
    }
    
    if (!CLASSES.TYPES.includes(this.class)) {
      throw new Error(`Invalid class: ${this.class}`);
    }
    
    if (!FACTIONS.TYPES.includes(this.faction)) {
      throw new Error(`Invalid faction: ${this.faction}`);
    }
    
    if (this.level < 1 || this.level > 80) {
      throw new Error(`Invalid level: ${this.level}. Must be 1-80`);
    }
  }

  /**
   * Clone unit (deep copy)
   * @returns {Unit} New unit instance
   */
  clone() {
    return new Unit({
      id: this.id + '_clone',
      name: this.name,
      class: this.class,
      faction: this.faction,
      level: this.level,
      isLeader: this.isLeader,
      hiddenAbilities: this.hiddenAbilities.toObject(),
      equipment: Array.from(this.equipment.values()),
      position: { ...this.position },
      facing: this.facing,
      experience: this.experience,
      skillPoints: this.skillPoints,
      abilities: [...this.abilities]
    });
  }

  /**
   * Serialize unit for storage/transmission
   * @param {boolean} includeHidden - Include hidden d20 data (server-side only)
   * @returns {Object} Serialized unit data
   */
  serialize(includeHidden = false) {
    const data = {
      id: this.id,
      name: this.name,
      class: this.class,
      faction: this.faction,
      level: this.level,
      isLeader: this.isLeader,
      equipment: Array.from(this.equipment.values()).map(item => ({
        id: item.id,
        type: item.type,
        durability: item.durability
      })),
      currentHP: this.currentHP,
      currentMP: this.currentMP,
      position: this.position,
      facing: this.facing,
      statusEffects: this.statusEffects,
      experience: this.experience,
      abilities: this.abilities
    };

    // Include hidden data only for server-side serialization
    if (includeHidden) {
      data.hiddenAbilities = this.hiddenAbilities.toObject();
    }

    return data;
  }

  /**
   * String representation
   * @returns {string} Human-readable unit description
   */
  toString() {
    return `${this.name} (${this.class} L${this.level}, HP: ${this.currentHP}/${this.baseStats.HP})`;
  }
}

export default Unit;