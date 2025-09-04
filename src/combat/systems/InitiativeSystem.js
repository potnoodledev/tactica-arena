/**
 * Initiative System for Tactica Arena
 * 
 * Manages per-unit initiative ordering and turn sequence including:
 * - Initiative calculation using AGL + hidden DEX modifier + d20 roll
 * - Tiebreaker resolution using LCK stat
 * - Turn order management and progression
 * - Initiative modifiers from status effects and abilities
 * - Delay and ready actions support
 * 
 * The system uses hidden d20 mechanics for initiative rolls while presenting
 * only the final turn order to the client interface.
 */

import { calculateModifier } from '../hidden/D20Engine.js';
import { DeterministicRNG } from '../core/DeterministicRNG.js';
import { COMBAT, HIDDEN_STATS } from '../constants/GameConstants.js';

/**
 * Initiative entry class for tracking individual unit initiative
 */
export class InitiativeEntry {
  /**
   * Create initiative entry for a unit
   * @param {Object} config - Initiative entry configuration
   */
  constructor(config) {
    this.unitId = config.unitId;
    this.unitName = config.unitName || 'Unknown';
    this.playerId = config.playerId;
    this.baseInitiative = config.baseInitiative || 0;
    this.initiativeRoll = config.initiativeRoll || 0;
    this.totalInitiative = config.totalInitiative || 0;
    this.tiebreaker = config.tiebreaker || 0;
    this.modifiers = config.modifiers || [];
    this.hasActed = config.hasActed || false;
    this.hasDelayedAction = config.hasDelayedAction || false;
    this.delayPriority = config.delayPriority || null;
    this.isIncapacitated = config.isIncapacitated || false;
    this.turnIndex = config.turnIndex || 0;
  }

  /**
   * Add initiative modifier
   * @param {Object} modifier - Modifier object {source, value, type}
   */
  addModifier(modifier) {
    this.modifiers.push({
      source: modifier.source,
      value: modifier.value || 0,
      type: modifier.type || 'misc',
      applied: Date.now()
    });
    this.recalculateTotal();
  }

  /**
   * Remove initiative modifier by source
   * @param {string} source - Modifier source
   * @returns {boolean} True if modifier was removed
   */
  removeModifier(source) {
    const index = this.modifiers.findIndex(m => m.source === source);
    if (index >= 0) {
      this.modifiers.splice(index, 1);
      this.recalculateTotal();
      return true;
    }
    return false;
  }

  /**
   * Recalculate total initiative with modifiers
   * @private
   */
  recalculateTotal() {
    let modifierTotal = 0;
    for (const modifier of this.modifiers) {
      modifierTotal += modifier.value;
    }
    this.totalInitiative = this.baseInitiative + this.initiativeRoll + modifierTotal;
  }

  /**
   * Mark unit as having acted this turn
   */
  markAsActed() {
    this.hasActed = true;
  }

  /**
   * Reset for new turn
   */
  resetForNewTurn() {
    this.hasActed = false;
    this.hasDelayedAction = false;
    this.delayPriority = null;
  }

  /**
   * Set delayed action priority
   * @param {number} priority - Delay priority value
   */
  setDelayedAction(priority) {
    this.hasDelayedAction = true;
    this.delayPriority = priority;
  }

  /**
   * Clone initiative entry
   * @returns {InitiativeEntry} New initiative entry
   */
  clone() {
    return new InitiativeEntry({
      unitId: this.unitId,
      unitName: this.unitName,
      playerId: this.playerId,
      baseInitiative: this.baseInitiative,
      initiativeRoll: this.initiativeRoll,
      totalInitiative: this.totalInitiative,
      tiebreaker: this.tiebreaker,
      modifiers: [...this.modifiers],
      hasActed: this.hasActed,
      hasDelayedAction: this.hasDelayedAction,
      delayPriority: this.delayPriority,
      isIncapacitated: this.isIncapacitated,
      turnIndex: this.turnIndex
    });
  }
}

/**
 * Main Initiative System class
 */
export class InitiativeSystem {
  /**
   * Create initiative system
   * @param {Object} config - System configuration
   */
  constructor(config = {}) {
    this.enableDelayedActions = config.enableDelayedActions !== false;
    this.enableReadyActions = config.enableReadyActions !== false;
    this.logInitiative = config.logInitiative || false;
    this.initiativeLog = [];
    this.currentTurn = 0;
    this.currentRound = 0;
  }

  /**
   * Log initiative event for debugging
   * @param {string} type - Event type
   * @param {Object} data - Event data
   * @private
   */
  log(type, data) {
    if (this.logInitiative) {
      this.initiativeLog.push({
        timestamp: Date.now(),
        turn: this.currentTurn,
        round: this.currentRound,
        type,
        data: { ...data }
      });
    }
  }

  /**
   * Calculate initiative for a single unit
   * @param {Unit} unit - Unit to calculate initiative for
   * @param {DeterministicRNG} rng - RNG instance for initiative roll
   * @param {Object} modifiers - Additional initiative modifiers
   * @returns {InitiativeEntry} Initiative entry for the unit
   */
  calculateUnitInitiative(unit, rng, modifiers = {}) {
    const unitData = unit.getHiddenData();
    const stats = unit.getCurrentStats();
    
    // Base initiative from AGL stat
    const baseInitiative = stats.AGL;
    
    // Hidden DEX modifier bonus
    const dexModifier = unitData.abilities.getModifier('DEX');
    
    // Initiative roll (d20)
    const initiativeRoll = rng.rollD20();
    
    // Calculate tiebreaker from LCK
    const tiebreaker = stats.LCK + calculateModifier(stats.LCK);
    
    // Create initiative entry
    const entry = new InitiativeEntry({
      unitId: unit.id,
      unitName: unit.name,
      playerId: modifiers.playerId || 'unknown',
      baseInitiative: baseInitiative + dexModifier,
      initiativeRoll,
      totalInitiative: baseInitiative + dexModifier + initiativeRoll,
      tiebreaker,
      isIncapacitated: unit.isIncapacitated
    });

    // Apply status effect modifiers
    this.applyStatusEffectModifiers(unit, entry);
    
    // Apply equipment modifiers
    this.applyEquipmentModifiers(unit, entry);
    
    // Apply external modifiers
    if (modifiers.bonuses) {
      for (const bonus of modifiers.bonuses) {
        entry.addModifier(bonus);
      }
    }

    this.log('unit_initiative', {
      unitId: unit.id,
      baseInitiative: entry.baseInitiative,
      roll: entry.initiativeRoll,
      total: entry.totalInitiative,
      tiebreaker: entry.tiebreaker
    });

    return entry;
  }

  /**
   * Apply status effect modifiers to initiative
   * @param {Unit} unit - Unit with status effects
   * @param {InitiativeEntry} entry - Initiative entry to modify
   * @private
   */
  applyStatusEffectModifiers(unit, entry) {
    for (const effect of unit.statusEffects) {
      if (effect.effects.initiativeBonus) {
        entry.addModifier({
          source: `status_${effect.name}`,
          value: effect.effects.initiativeBonus * effect.intensity,
          type: 'status'
        });
      }
      
      // Special status effects
      switch (effect.name.toLowerCase()) {
        case 'haste':
        case 'quickened':
          entry.addModifier({
            source: effect.name,
            value: 10,
            type: 'status'
          });
          break;
          
        case 'slow':
        case 'sluggish':
          entry.addModifier({
            source: effect.name,
            value: -10,
            type: 'status'
          });
          break;
          
        case 'paralyzed':
        case 'stunned':
          entry.addModifier({
            source: effect.name,
            value: -20,
            type: 'status'
          });
          break;
      }
    }
  }

  /**
   * Apply equipment modifiers to initiative
   * @param {Unit} unit - Unit with equipment
   * @param {InitiativeEntry} entry - Initiative entry to modify
   * @private
   */
  applyEquipmentModifiers(unit, entry) {
    for (const item of unit.equipment.values()) {
      // Direct AGL bonuses
      if (item.statModifiers.AGL) {
        entry.addModifier({
          source: `equipment_${item.name}`,
          value: item.statModifiers.AGL,
          type: 'equipment'
        });
      }
      
      // Special equipment effects
      for (const effect of item.specialEffects) {
        if (effect.type === 'initiative') {
          entry.addModifier({
            source: `equipment_${item.name}_${effect.name}`,
            value: effect.value || 0,
            type: 'equipment'
          });
        }
      }
    }
  }

  /**
   * Calculate initiative order for all units in combat
   * @param {Array} units - Array of units to order
   * @param {DeterministicRNG} rng - RNG instance
   * @param {Object} options - Additional options
   * @returns {Array} Ordered array of InitiativeEntry objects
   */
  calculateInitiativeOrder(units, rng, options = {}) {
    if (!Array.isArray(units) || units.length === 0) {
      throw new Error('Units array is required and must not be empty');
    }

    const entries = [];
    
    // Calculate initiative for each unit
    for (const unit of units) {
      const entry = this.calculateUnitInitiative(unit, rng, {
        playerId: options.getPlayerForUnit ? options.getPlayerForUnit(unit.id) : 'unknown',
        bonuses: options.getInitiativeModifiers ? options.getInitiativeModifiers(unit.id) : []
      });
      entries.push(entry);
    }

    // Sort by initiative (highest first), then by tiebreaker (highest first)
    entries.sort((a, b) => {
      // Primary sort: total initiative (descending)
      if (a.totalInitiative !== b.totalInitiative) {
        return b.totalInitiative - a.totalInitiative;
      }
      
      // Tiebreaker: LCK-based tiebreaker (descending)
      if (a.tiebreaker !== b.tiebreaker) {
        return b.tiebreaker - a.tiebreaker;
      }
      
      // Final tiebreaker: unit ID (for deterministic results)
      return a.unitId.localeCompare(b.unitId);
    });

    // Assign turn indices
    entries.forEach((entry, index) => {
      entry.turnIndex = index;
    });

    this.log('initiative_order', {
      totalUnits: entries.length,
      order: entries.map(e => ({
        unitId: e.unitId,
        initiative: e.totalInitiative,
        tiebreaker: e.tiebreaker,
        index: e.turnIndex
      }))
    });

    return entries;
  }

  /**
   * Get next unit to act in initiative order
   * @param {Array} initiativeOrder - Current initiative order
   * @param {number} currentIndex - Current index in initiative order
   * @returns {Object} Result containing next unit info
   */
  getNextActiveUnit(initiativeOrder, currentIndex = 0) {
    if (!Array.isArray(initiativeOrder) || initiativeOrder.length === 0) {
      return { entry: null, index: -1, endOfRound: true };
    }

    let attempts = 0;
    let index = currentIndex;
    
    // Find next unit that can act
    while (attempts < initiativeOrder.length) {
      const entry = initiativeOrder[index];
      
      if (entry && !entry.hasActed && !entry.isIncapacitated) {
        return { 
          entry, 
          index, 
          endOfRound: false 
        };
      }
      
      index = (index + 1) % initiativeOrder.length;
      attempts++;
      
      // If we've cycled back to start, round is over
      if (index === 0 && attempts > 0) {
        return { 
          entry: null, 
          index: 0, 
          endOfRound: true 
        };
      }
    }

    return { entry: null, index: -1, endOfRound: true };
  }

  /**
   * Process delayed actions for units
   * @param {Array} initiativeOrder - Current initiative order
   * @returns {Array} Units ready to act with delayed actions
   */
  processDelayedActions(initiativeOrder) {
    if (!this.enableDelayedActions) return [];

    const delayedUnits = initiativeOrder
      .filter(entry => entry.hasDelayedAction && entry.delayPriority !== null)
      .sort((a, b) => b.delayPriority - a.delayPriority); // Higher priority first

    this.log('delayed_actions', {
      delayedUnits: delayedUnits.map(e => ({
        unitId: e.unitId,
        priority: e.delayPriority
      }))
    });

    return delayedUnits;
  }

  /**
   * Add a unit to initiative order (for summoned units, etc.)
   * @param {Array} initiativeOrder - Current initiative order
   * @param {Unit} unit - Unit to add
   * @param {DeterministicRNG} rng - RNG instance
   * @param {Object} options - Additional options
   * @returns {Array} Updated initiative order
   */
  addUnitToInitiative(initiativeOrder, unit, rng, options = {}) {
    const entry = this.calculateUnitInitiative(unit, rng, options);
    
    // Find insertion point based on initiative value
    let insertIndex = initiativeOrder.length;
    for (let i = 0; i < initiativeOrder.length; i++) {
      if (entry.totalInitiative > initiativeOrder[i].totalInitiative ||
          (entry.totalInitiative === initiativeOrder[i].totalInitiative && 
           entry.tiebreaker > initiativeOrder[i].tiebreaker)) {
        insertIndex = i;
        break;
      }
    }
    
    const newOrder = [...initiativeOrder];
    newOrder.splice(insertIndex, 0, entry);
    
    // Update turn indices
    newOrder.forEach((e, index) => {
      e.turnIndex = index;
    });

    this.log('add_unit', {
      unitId: unit.id,
      insertIndex,
      initiative: entry.totalInitiative
    });

    return newOrder;
  }

  /**
   * Remove a unit from initiative order (for defeated units, etc.)
   * @param {Array} initiativeOrder - Current initiative order
   * @param {string} unitId - ID of unit to remove
   * @returns {Object} Result with updated order and adjustment info
   */
  removeUnitFromInitiative(initiativeOrder, unitId) {
    const index = initiativeOrder.findIndex(entry => entry.unitId === unitId);
    if (index === -1) {
      return { order: initiativeOrder, removedIndex: -1, currentIndexAdjustment: 0 };
    }

    const newOrder = [...initiativeOrder];
    newOrder.splice(index, 1);
    
    // Update turn indices
    newOrder.forEach((e, i) => {
      e.turnIndex = i;
    });

    this.log('remove_unit', {
      unitId,
      removedIndex: index
    });

    return { 
      order: newOrder, 
      removedIndex: index,
      // If removed unit was before current position, adjust current index
      currentIndexAdjustment: index < initiativeOrder.length ? -1 : 0
    };
  }

  /**
   * Reset all units for new turn/round
   * @param {Array} initiativeOrder - Initiative order to reset
   * @returns {Array} Reset initiative order
   */
  resetForNewRound(initiativeOrder) {
    const resetOrder = initiativeOrder.map(entry => {
      const newEntry = entry.clone();
      newEntry.resetForNewTurn();
      return newEntry;
    });

    this.currentRound++;
    
    this.log('new_round', {
      round: this.currentRound,
      unitsReset: resetOrder.length
    });

    return resetOrder;
  }

  /**
   * Apply initiative modifier to specific unit
   * @param {Array} initiativeOrder - Current initiative order
   * @param {string} unitId - Target unit ID
   * @param {Object} modifier - Modifier to apply
   * @returns {Array} Updated initiative order
   */
  applyInitiativeModifier(initiativeOrder, unitId, modifier) {
    const updatedOrder = initiativeOrder.map(entry => {
      if (entry.unitId === unitId) {
        const newEntry = entry.clone();
        newEntry.addModifier(modifier);
        return newEntry;
      }
      return entry;
    });

    // Re-sort if initiative values changed significantly
    const needsResorting = updatedOrder.some(entry => 
      Math.abs(modifier.value) >= 5 // Significant modifier
    );

    if (needsResorting) {
      return this.resortInitiativeOrder(updatedOrder);
    }

    return updatedOrder;
  }

  /**
   * Re-sort initiative order (for when modifiers change order)
   * @param {Array} initiativeOrder - Order to re-sort
   * @returns {Array} Re-sorted initiative order
   * @private
   */
  resortInitiativeOrder(initiativeOrder) {
    const sorted = [...initiativeOrder].sort((a, b) => {
      if (a.totalInitiative !== b.totalInitiative) {
        return b.totalInitiative - a.totalInitiative;
      }
      if (a.tiebreaker !== b.tiebreaker) {
        return b.tiebreaker - a.tiebreaker;
      }
      return a.unitId.localeCompare(b.unitId);
    });

    // Update turn indices
    sorted.forEach((entry, index) => {
      entry.turnIndex = index;
    });

    this.log('resort_initiative', {
      newOrder: sorted.map(e => ({
        unitId: e.unitId,
        initiative: e.totalInitiative,
        index: e.turnIndex
      }))
    });

    return sorted;
  }

  /**
   * Get initiative summary for display
   * @param {Array} initiativeOrder - Initiative order to summarize
   * @returns {Object} Initiative summary data
   */
  getInitiativeSummary(initiativeOrder) {
    return {
      totalUnits: initiativeOrder.length,
      activeUnits: initiativeOrder.filter(e => !e.isIncapacitated).length,
      unitsActed: initiativeOrder.filter(e => e.hasActed).length,
      unitsWithDelayedActions: initiativeOrder.filter(e => e.hasDelayedAction).length,
      currentTurn: this.currentTurn,
      currentRound: this.currentRound,
      order: initiativeOrder.map(entry => ({
        unitId: entry.unitId,
        unitName: entry.unitName,
        initiative: entry.totalInitiative,
        hasActed: entry.hasActed,
        isIncapacitated: entry.isIncapacitated,
        hasDelayedAction: entry.hasDelayedAction,
        turnIndex: entry.turnIndex
      }))
    };
  }

  /**
   * Get initiative log for debugging
   * @returns {Array} Array of logged events
   */
  getInitiativeLog() {
    return [...this.initiativeLog];
  }

  /**
   * Clear initiative log
   */
  clearInitiativeLog() {
    this.initiativeLog = [];
  }

  /**
   * Validate initiative order consistency
   * @param {Array} initiativeOrder - Order to validate
   * @returns {boolean} True if order is valid
   */
  validateInitiativeOrder(initiativeOrder) {
    if (!Array.isArray(initiativeOrder)) return false;
    
    // Check for duplicate unit IDs
    const unitIds = new Set();
    for (const entry of initiativeOrder) {
      if (unitIds.has(entry.unitId)) return false;
      unitIds.add(entry.unitId);
    }
    
    // Check turn indices are sequential
    for (let i = 0; i < initiativeOrder.length; i++) {
      if (initiativeOrder[i].turnIndex !== i) return false;
    }
    
    // Check initiative order is properly sorted
    for (let i = 0; i < initiativeOrder.length - 1; i++) {
      const current = initiativeOrder[i];
      const next = initiativeOrder[i + 1];
      
      if (current.totalInitiative < next.totalInitiative ||
          (current.totalInitiative === next.totalInitiative && 
           current.tiebreaker < next.tiebreaker)) {
        return false;
      }
    }
    
    return true;
  }
}

export default InitiativeSystem;