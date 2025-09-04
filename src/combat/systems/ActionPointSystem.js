/**
 * Action Point System for Tactica Arena
 * 
 * Manages the 3 AP per turn economy including:
 * - AP allocation and spending validation
 * - Action cost calculation and modifiers
 * - Turn-based AP restoration
 * - Ability cost modifications from equipment and effects
 * - AP banking and overflow handling
 * - Action queuing and validation
 * 
 * This system enforces the core tactical gameplay constraint that each unit
 * gets exactly 3 AP per turn to spend on movement, attacks, and abilities.
 */

import { ACTION_POINTS, VALIDATION } from '../constants/GameConstants.js';

/**
 * Action class for representing player actions with AP costs
 */
export class Action {
  /**
   * Create a new action
   * @param {Object} config - Action configuration
   */
  constructor(config) {
    this.id = config.id || `action_${Date.now()}_${Math.random()}`;
    this.type = config.type; // 'MOVE', 'ATTACK', 'ABILITY', 'WAIT', 'END_TURN'
    this.unitId = config.unitId;
    this.abilityId = config.abilityId || null;
    this.targetId = config.targetId || null;
    this.targetPosition = config.targetPosition || null;
    this.baseCost = config.baseCost || ACTION_POINTS.COSTS[config.type] || 1;
    this.modifiedCost = config.modifiedCost || this.baseCost;
    this.metadata = config.metadata || {};
    this.validated = false;
    this.executed = false;
    this.timestamp = config.timestamp || Date.now();
  }

  /**
   * Check if action is valid
   * @returns {boolean} True if action has required data
   */
  isValid() {
    return !!(this.type && this.unitId && this.baseCost >= 0);
  }

  /**
   * Clone action
   * @returns {Action} New action instance
   */
  clone() {
    return new Action({
      id: this.id,
      type: this.type,
      unitId: this.unitId,
      abilityId: this.abilityId,
      targetId: this.targetId,
      targetPosition: this.targetPosition ? { ...this.targetPosition } : null,
      baseCost: this.baseCost,
      modifiedCost: this.modifiedCost,
      metadata: { ...this.metadata },
      timestamp: this.timestamp
    });
  }
}

/**
 * Action queue for managing multiple actions per turn
 */
export class ActionQueue {
  /**
   * Create action queue
   * @param {number} maxSize - Maximum queue size
   */
  constructor(maxSize = VALIDATION.LIMITS.ACTION_QUEUE_SIZE) {
    this.actions = [];
    this.maxSize = maxSize;
    this.totalCost = 0;
  }

  /**
   * Add action to queue
   * @param {Action} action - Action to add
   * @returns {boolean} True if action was added
   */
  addAction(action) {
    if (this.actions.length >= this.maxSize) {
      return false;
    }

    this.actions.push(action.clone());
    this.totalCost += action.modifiedCost;
    return true;
  }

  /**
   * Remove action from queue by ID
   * @param {string} actionId - Action ID to remove
   * @returns {boolean} True if action was removed
   */
  removeAction(actionId) {
    const index = this.actions.findIndex(a => a.id === actionId);
    if (index >= 0) {
      const action = this.actions.splice(index, 1)[0];
      this.totalCost -= action.modifiedCost;
      return true;
    }
    return false;
  }

  /**
   * Clear all actions from queue
   */
  clear() {
    this.actions = [];
    this.totalCost = 0;
  }

  /**
   * Get next action to execute
   * @returns {Action|null} Next action or null if queue is empty
   */
  getNext() {
    return this.actions.length > 0 ? this.actions[0] : null;
  }

  /**
   * Remove and return next action
   * @returns {Action|null} Next action or null if queue is empty
   */
  popNext() {
    if (this.actions.length > 0) {
      const action = this.actions.shift();
      this.totalCost -= action.modifiedCost;
      return action;
    }
    return null;
  }

  /**
   * Check if queue is empty
   * @returns {boolean} True if queue has no actions
   */
  isEmpty() {
    return this.actions.length === 0;
  }

  /**
   * Get queue size
   * @returns {number} Number of actions in queue
   */
  size() {
    return this.actions.length;
  }

  /**
   * Get all actions in queue
   * @returns {Array} Array of actions
   */
  getAllActions() {
    return [...this.actions];
  }
}

/**
 * Main Action Point System class
 */
export class ActionPointSystem {
  /**
   * Create action point system
   * @param {Object} config - System configuration
   */
  constructor(config = {}) {
    this.enableAPBanking = config.enableAPBanking || false; // Allow saving unused AP
    this.enableAPOverflow = config.enableAPOverflow || false; // Allow exceeding max AP
    this.maxBankedAP = config.maxBankedAP || 2; // Maximum AP that can be banked
    this.logActions = config.logActions || false;
    this.actionLog = [];
    this.actionQueues = new Map(); // Unit ID -> ActionQueue
    this.apModifiers = new Map(); // Unit ID -> Array of modifiers
  }

  /**
   * Log action event for debugging
   * @param {string} type - Event type
   * @param {Object} data - Event data
   * @private
   */
  log(type, data) {
    if (this.logActions) {
      this.actionLog.push({
        timestamp: Date.now(),
        type,
        data: { ...data }
      });
    }
  }

  /**
   * Initialize unit for AP system
   * @param {Unit} unit - Unit to initialize
   */
  initializeUnit(unit) {
    if (!this.actionQueues.has(unit.id)) {
      this.actionQueues.set(unit.id, new ActionQueue());
    }
    
    if (!this.apModifiers.has(unit.id)) {
      this.apModifiers.set(unit.id, []);
    }

    this.log('initialize_unit', {
      unitId: unit.id,
      currentAP: unit.currentAP,
      maxAP: ACTION_POINTS.MAX_PER_TURN
    });
  }

  /**
   * Calculate the modified AP cost for an action
   * @param {Unit} unit - Unit performing action
   * @param {Action} action - Action being performed
   * @returns {number} Modified AP cost
   */
  calculateActionCost(unit, action) {
    let cost = action.baseCost;
    const modifiers = this.apModifiers.get(unit.id) || [];
    
    // Apply unit-specific modifiers
    for (const modifier of modifiers) {
      if (modifier.actionType === action.type || modifier.actionType === 'ALL') {
        if (modifier.type === 'flat') {
          cost += modifier.value;
        } else if (modifier.type === 'percentage') {
          cost = Math.ceil(cost * (1 + modifier.value));
        }
      }
    }

    // Apply status effect modifiers
    cost = this.applyStatusEffectCostModifiers(unit, action, cost);
    
    // Apply equipment modifiers
    cost = this.applyEquipmentCostModifiers(unit, action, cost);
    
    // Apply ability-specific modifiers
    if (action.abilityId) {
      cost = this.applyAbilityCostModifiers(unit, action, cost);
    }

    // Ensure minimum cost
    cost = Math.max(0, cost);

    this.log('calculate_cost', {
      unitId: unit.id,
      actionType: action.type,
      baseCost: action.baseCost,
      modifiedCost: cost
    });

    return cost;
  }

  /**
   * Apply status effect cost modifiers
   * @param {Unit} unit - Unit with status effects
   * @param {Action} action - Action being performed
   * @param {number} baseCost - Base AP cost
   * @returns {number} Modified cost
   * @private
   */
  applyStatusEffectCostModifiers(unit, action, baseCost) {
    let cost = baseCost;

    for (const effect of unit.statusEffects) {
      // Check for AP cost modifiers
      if (effect.effects.apCostModifier) {
        const modifier = effect.effects.apCostModifier[action.type] || 
                        effect.effects.apCostModifier.ALL;
        if (modifier) {
          if (modifier.type === 'flat') {
            cost += modifier.value * effect.intensity;
          } else if (modifier.type === 'percentage') {
            cost = Math.ceil(cost * (1 + (modifier.value * effect.intensity)));
          }
        }
      }

      // Special status effects
      switch (effect.name.toLowerCase()) {
        case 'haste':
        case 'quickened':
          // Reduce all costs by 1 (minimum 0)
          cost = Math.max(0, cost - 1);
          break;
          
        case 'slow':
        case 'exhausted':
          // Increase all costs by 1
          cost += 1;
          break;
          
        case 'encumbered':
          // Movement costs +1 AP
          if (action.type === 'MOVE') {
            cost += 1;
          }
          break;
          
        case 'focused':
          // Ability costs -1 AP
          if (action.type === 'ABILITY') {
            cost = Math.max(0, cost - 1);
          }
          break;
      }
    }

    return cost;
  }

  /**
   * Apply equipment cost modifiers
   * @param {Unit} unit - Unit with equipment
   * @param {Action} action - Action being performed
   * @param {number} baseCost - Base AP cost
   * @returns {number} Modified cost
   * @private
   */
  applyEquipmentCostModifiers(unit, action, baseCost) {
    let cost = baseCost;

    for (const item of unit.equipment.values()) {
      for (const effect of item.specialEffects) {
        if (effect.type === 'ap_cost_reduction' && 
            (effect.actionType === action.type || effect.actionType === 'ALL')) {
          cost = Math.max(0, cost - (effect.value || 1));
        }
        
        if (effect.type === 'ap_cost_increase' && 
            (effect.actionType === action.type || effect.actionType === 'ALL')) {
          cost += effect.value || 1;
        }
      }

      // Heavy armor penalties
      if (item.type === 'armor' && item.name.toLowerCase().includes('heavy')) {
        if (action.type === 'MOVE') {
          cost += 1; // Heavy armor makes movement more expensive
        }
      }
    }

    return cost;
  }

  /**
   * Apply ability-specific cost modifiers
   * @param {Unit} unit - Unit performing ability
   * @param {Action} action - Action with ability
   * @param {number} baseCost - Base AP cost
   * @returns {number} Modified cost
   * @private
   */
  applyAbilityCostModifiers(unit, action, baseCost) {
    let cost = baseCost;

    // Class-specific ability cost modifiers
    switch (unit.class) {
      case 'ARCHER':
        // Ranged attacks cost less if standing still
        if (action.type === 'ATTACK' && !unit.hasActedThisTurn) {
          cost = Math.max(1, cost - 1);
        }
        break;
        
      case 'ROGUE':
        // Stealth abilities cost less
        if (action.abilityId && action.abilityId.toLowerCase().includes('stealth')) {
          cost = Math.max(1, cost - 1);
        }
        break;
        
      case 'MAGE':
        // Spells cost +1 AP but can be reduced by INT
        if (action.type === 'ABILITY') {
          const intMod = Math.floor(unit.getCurrentStats().INT / 10);
          cost = Math.max(1, cost - intMod);
        }
        break;
    }

    return cost;
  }

  /**
   * Check if unit can afford an action
   * @param {Unit} unit - Unit attempting action
   * @param {Action} action - Action to validate
   * @returns {Object} Validation result
   */
  canAffordAction(unit, action) {
    const cost = this.calculateActionCost(unit, action);
    const available = unit.currentAP;
    const canAfford = available >= cost;

    const result = {
      canAfford,
      cost,
      available,
      remaining: canAfford ? available - cost : available,
      deficit: canAfford ? 0 : cost - available
    };

    this.log('afford_check', {
      unitId: unit.id,
      actionType: action.type,
      ...result
    });

    return result;
  }

  /**
   * Spend AP for an action
   * @param {Unit} unit - Unit spending AP
   * @param {Action} action - Action being performed
   * @returns {boolean} True if AP was successfully spent
   */
  spendAP(unit, action) {
    const affordCheck = this.canAffordAction(unit, action);
    
    if (!affordCheck.canAfford) {
      this.log('spend_failed', {
        unitId: unit.id,
        actionType: action.type,
        reason: 'insufficient_ap',
        cost: affordCheck.cost,
        available: affordCheck.available
      });
      return false;
    }

    // Spend the AP
    const success = unit.spendAP(affordCheck.cost);
    
    if (success) {
      // Update the action with final cost
      action.modifiedCost = affordCheck.cost;
      
      this.log('spend_success', {
        unitId: unit.id,
        actionType: action.type,
        cost: affordCheck.cost,
        remainingAP: unit.currentAP
      });
    }

    return success;
  }

  /**
   * Restore AP at start of turn
   * @param {Unit} unit - Unit to restore AP for
   * @returns {Object} Restoration result
   */
  restoreAP(unit) {
    const previousAP = unit.currentAP;
    const maxAP = ACTION_POINTS.MAX_PER_TURN;
    let restoredAP = maxAP;
    
    // Apply AP restoration modifiers
    const modifiers = this.apModifiers.get(unit.id) || [];
    for (const modifier of modifiers) {
      if (modifier.type === 'ap_restoration') {
        if (modifier.operation === 'flat') {
          restoredAP += modifier.value;
        } else if (modifier.operation === 'percentage') {
          restoredAP = Math.ceil(restoredAP * (1 + modifier.value));
        }
      }
    }

    // Apply status effect modifications
    restoredAP = this.applyStatusEffectAPRestoration(unit, restoredAP);

    // Handle AP banking if enabled
    if (this.enableAPBanking && previousAP > 0) {
      const bankedAP = Math.min(previousAP, this.maxBankedAP);
      restoredAP += bankedAP;
    }

    // Apply maximum limits
    const finalAP = this.enableAPOverflow ? restoredAP : 
                   Math.min(restoredAP, maxAP + (this.enableAPBanking ? this.maxBankedAP : 0));

    unit.currentAP = finalAP;
    unit.hasActedThisTurn = false;

    // Clear action queue for new turn
    const queue = this.actionQueues.get(unit.id);
    if (queue) {
      queue.clear();
    }

    const result = {
      previousAP,
      restoredAP: finalAP,
      bankedAP: this.enableAPBanking ? Math.min(previousAP, this.maxBankedAP) : 0,
      maxAP
    };

    this.log('restore_ap', {
      unitId: unit.id,
      ...result
    });

    return result;
  }

  /**
   * Apply status effects to AP restoration
   * @param {Unit} unit - Unit with status effects
   * @param {number} baseRestoration - Base AP restoration amount
   * @returns {number} Modified restoration amount
   * @private
   */
  applyStatusEffectAPRestoration(unit, baseRestoration) {
    let restoration = baseRestoration;

    for (const effect of unit.statusEffects) {
      if (effect.effects.apRestoration) {
        if (effect.effects.apRestoration.type === 'flat') {
          restoration += effect.effects.apRestoration.value * effect.intensity;
        } else if (effect.effects.apRestoration.type === 'percentage') {
          restoration = Math.ceil(restoration * (1 + (effect.effects.apRestoration.value * effect.intensity)));
        }
      }

      // Special status effects
      switch (effect.name.toLowerCase()) {
        case 'energized':
        case 'vigorous':
          restoration += 1;
          break;
          
        case 'drained':
        case 'fatigued':
          restoration = Math.max(1, restoration - 1);
          break;
          
        case 'paralyzed':
        case 'stunned':
          restoration = 0; // No AP restoration
          break;
      }
    }

    return Math.max(0, restoration);
  }

  /**
   * Add AP modifier to unit
   * @param {string} unitId - Unit ID
   * @param {Object} modifier - AP modifier
   */
  addAPModifier(unitId, modifier) {
    if (!this.apModifiers.has(unitId)) {
      this.apModifiers.set(unitId, []);
    }

    const modifiers = this.apModifiers.get(unitId);
    modifiers.push({
      id: modifier.id || `modifier_${Date.now()}_${Math.random()}`,
      source: modifier.source,
      type: modifier.type, // 'flat', 'percentage', 'ap_restoration'
      actionType: modifier.actionType || 'ALL',
      value: modifier.value || 0,
      operation: modifier.operation || 'flat',
      duration: modifier.duration || -1, // -1 = permanent
      applied: Date.now()
    });

    this.log('add_modifier', {
      unitId,
      modifier: modifiers[modifiers.length - 1]
    });
  }

  /**
   * Remove AP modifier from unit
   * @param {string} unitId - Unit ID
   * @param {string} modifierId - Modifier ID or source
   * @returns {boolean} True if modifier was removed
   */
  removeAPModifier(unitId, modifierId) {
    const modifiers = this.apModifiers.get(unitId);
    if (!modifiers) return false;

    const index = modifiers.findIndex(m => m.id === modifierId || m.source === modifierId);
    if (index >= 0) {
      const removed = modifiers.splice(index, 1)[0];
      this.log('remove_modifier', {
        unitId,
        removedModifier: removed
      });
      return true;
    }

    return false;
  }

  /**
   * Queue action for unit
   * @param {string} unitId - Unit ID
   * @param {Action} action - Action to queue
   * @returns {boolean} True if action was queued
   */
  queueAction(unitId, action) {
    const queue = this.actionQueues.get(unitId);
    if (!queue) return false;

    const success = queue.addAction(action);
    
    if (success) {
      this.log('queue_action', {
        unitId,
        actionId: action.id,
        actionType: action.type,
        queueSize: queue.size(),
        totalCost: queue.totalCost
      });
    }

    return success;
  }

  /**
   * Get next queued action for unit
   * @param {string} unitId - Unit ID
   * @returns {Action|null} Next action or null
   */
  getNextQueuedAction(unitId) {
    const queue = this.actionQueues.get(unitId);
    return queue ? queue.getNext() : null;
  }

  /**
   * Execute next queued action for unit
   * @param {string} unitId - Unit ID
   * @returns {Action|null} Executed action or null
   */
  executeNextQueuedAction(unitId) {
    const queue = this.actionQueues.get(unitId);
    if (!queue) return null;

    const action = queue.popNext();
    if (action) {
      action.executed = true;
      this.log('execute_action', {
        unitId,
        actionId: action.id,
        actionType: action.type,
        cost: action.modifiedCost
      });
    }

    return action;
  }

  /**
   * Clear action queue for unit
   * @param {string} unitId - Unit ID
   * @returns {boolean} True if queue was cleared
   */
  clearActionQueue(unitId) {
    const queue = this.actionQueues.get(unitId);
    if (!queue) return false;

    const clearedActions = queue.size();
    queue.clear();
    
    this.log('clear_queue', {
      unitId,
      clearedActions
    });

    return true;
  }

  /**
   * Get AP status for unit
   * @param {Unit} unit - Unit to get status for
   * @returns {Object} AP status information
   */
  getAPStatus(unit) {
    const queue = this.actionQueues.get(unit.id);
    const modifiers = this.apModifiers.get(unit.id) || [];

    return {
      currentAP: unit.currentAP,
      maxAP: ACTION_POINTS.MAX_PER_TURN,
      queuedActions: queue ? queue.size() : 0,
      queuedCost: queue ? queue.totalCost : 0,
      availableAfterQueue: Math.max(0, unit.currentAP - (queue ? queue.totalCost : 0)),
      activeModifiers: modifiers.length,
      canAct: unit.canAct(ACTION_POINTS.MIN_FOR_ACTION),
      hasActedThisTurn: unit.hasActedThisTurn
    };
  }

  /**
   * Get action cost preview
   * @param {Unit} unit - Unit performing action
   * @param {string} actionType - Type of action
   * @param {Object} options - Action options
   * @returns {Object} Cost preview
   */
  previewActionCost(unit, actionType, options = {}) {
    const tempAction = new Action({
      type: actionType,
      unitId: unit.id,
      abilityId: options.abilityId,
      baseCost: options.baseCost || ACTION_POINTS.COSTS[actionType] || 1
    });

    const cost = this.calculateActionCost(unit, tempAction);
    const affordCheck = this.canAffordAction(unit, tempAction);

    return {
      actionType,
      baseCost: tempAction.baseCost,
      modifiedCost: cost,
      canAfford: affordCheck.canAfford,
      remainingAfter: affordCheck.remaining,
      modifiers: this.apModifiers.get(unit.id) || []
    };
  }

  /**
   * Process expired AP modifiers
   * @param {string} unitId - Unit ID to process
   */
  processExpiredModifiers(unitId) {
    const modifiers = this.apModifiers.get(unitId);
    if (!modifiers) return;

    const now = Date.now();
    const expired = [];
    
    for (let i = modifiers.length - 1; i >= 0; i--) {
      const modifier = modifiers[i];
      if (modifier.duration > 0 && 
          (now - modifier.applied) > (modifier.duration * 1000)) {
        expired.push(modifiers.splice(i, 1)[0]);
      }
    }

    if (expired.length > 0) {
      this.log('expired_modifiers', {
        unitId,
        expiredCount: expired.length,
        expired
      });
    }
  }

  /**
   * Get action log for debugging
   * @returns {Array} Array of logged events
   */
  getActionLog() {
    return [...this.actionLog];
  }

  /**
   * Clear action log
   */
  clearActionLog() {
    this.actionLog = [];
  }

  /**
   * Reset system for new combat
   */
  reset() {
    this.actionQueues.clear();
    this.apModifiers.clear();
    this.actionLog = [];
    
    this.log('system_reset', {
      timestamp: Date.now()
    });
  }
}

export default ActionPointSystem;