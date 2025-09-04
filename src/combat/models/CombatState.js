/**
 * Combat State Management for Tactica Arena
 * 
 * Manages the complete state of a combat encounter including:
 * - Turn order and initiative tracking
 * - Unit positions and states
 * - Terrain and environmental effects
 * - Action history for replay system
 * - Match progression and phases
 * 
 * Provides immutable state updates and comprehensive state validation
 * for multiplayer consistency and replay integrity.
 */

import { TERRAIN, ACTION_POINTS, ARMY, PERFORMANCE } from '../constants/GameConstants.js';
import Unit from './Unit.js';

/**
 * Combat Action class for tracking all actions taken during combat
 */
export class CombatAction {
  /**
   * Create a combat action record
   * @param {Object} config - Action configuration
   */
  constructor(config) {
    this.id = config.id || `action_${Date.now()}_${Math.random()}`;
    this.type = config.type; // 'MOVE', 'ATTACK', 'ABILITY', 'WAIT', 'END_TURN'
    this.actorId = config.actorId;
    this.targetId = config.targetId || null;
    this.targetPosition = config.targetPosition || null;
    this.abilityId = config.abilityId || null;
    this.apCost = config.apCost || 1;
    this.timestamp = config.timestamp || Date.now();
    this.turnNumber = config.turnNumber;
    this.sequenceNumber = config.sequenceNumber;
    this.results = config.results || null; // Populated after resolution
    this.metadata = config.metadata || {}; // Additional action data
  }

  /**
   * Validate action data
   * @returns {boolean} True if action is valid
   */
  isValid() {
    return !!(this.type && this.actorId && this.apCost >= 0);
  }

  /**
   * Clone action
   * @returns {CombatAction} New action instance
   */
  clone() {
    return new CombatAction({
      id: this.id,
      type: this.type,
      actorId: this.actorId,
      targetId: this.targetId,
      targetPosition: this.targetPosition ? { ...this.targetPosition } : null,
      abilityId: this.abilityId,
      apCost: this.apCost,
      timestamp: this.timestamp,
      turnNumber: this.turnNumber,
      sequenceNumber: this.sequenceNumber,
      results: this.results ? { ...this.results } : null,
      metadata: { ...this.metadata }
    });
  }
}

/**
 * Terrain Tile class for managing map terrain effects
 */
export class TerrainTile {
  /**
   * Create terrain tile
   * @param {Object} config - Tile configuration
   */
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.type = config.type || 'PLAINS';
    this.height = config.height || 0;
    this.moveCost = config.moveCost || TERRAIN.MODIFIERS.PLAINS.moveCost;
    this.evasionBonus = config.evasionBonus || TERRAIN.MODIFIERS.PLAINS.evasion;
    this.coverValue = config.coverValue || TERRAIN.MODIFIERS.PLAINS.cover;
    this.blockingLOS = config.blockingLOS || false;
    this.destructible = config.destructible || false;
    this.currentHP = config.currentHP || null;
    this.maxHP = config.maxHP || null;
    this.specialProperties = config.specialProperties || [];
  }

  /**
   * Check if tile provides cover
   * @returns {boolean} True if tile provides cover
   */
  providesCover() {
    return this.coverValue > 0 && (!this.destructible || this.currentHP > 0);
  }

  /**
   * Check if tile blocks line of sight
   * @returns {boolean} True if LOS is blocked
   */
  blocksLOS() {
    return this.blockingLOS && (!this.destructible || this.currentHP > 0);
  }

  /**
   * Get effective movement cost for unit type
   * @param {string} unitType - Unit type or movement special abilities
   * @returns {number} Movement cost for this tile
   */
  getMoveCost(unitType = 'normal') {
    // Special movement abilities (flying, amphibious, etc.)
    if (unitType === 'flying') return 1;
    if (unitType === 'amphibious' && this.type === 'WATER') return 1;
    
    return this.moveCost;
  }

  /**
   * Clone terrain tile
   * @returns {TerrainTile} New tile instance
   */
  clone() {
    return new TerrainTile({
      x: this.x,
      y: this.y,
      type: this.type,
      height: this.height,
      moveCost: this.moveCost,
      evasionBonus: this.evasionBonus,
      coverValue: this.coverValue,
      blockingLOS: this.blockingLOS,
      destructible: this.destructible,
      currentHP: this.currentHP,
      maxHP: this.maxHP,
      specialProperties: [...this.specialProperties]
    });
  }
}

/**
 * Main Combat State class
 */
export class CombatState {
  /**
   * Create new combat state
   * @param {Object} config - Combat configuration
   */
  constructor(config = {}) {
    // Match identification
    this.matchId = config.matchId || `match_${Date.now()}_${Math.random()}`;
    this.seed = config.seed || Date.now();
    this.version = config.version || '1.0';

    // Match progression
    this.phase = config.phase || 'DEPLOYMENT'; // DEPLOYMENT, COMBAT, RESOLUTION, COMPLETED
    this.turn = config.turn || 1;
    this.round = config.round || 1; // Round within turn
    this.maxTurns = config.maxTurns || 50;
    
    // Player information
    this.players = config.players || [];
    this.currentPlayerId = config.currentPlayerId || null;
    
    // Unit management
    this.units = new Map();
    this.deployedUnits = new Set(); // IDs of deployed units
    this.incapacitatedUnits = new Set(); // IDs of incapacitated units
    
    // Initiative and turn order
    this.initiativeOrder = [];
    this.currentUnitIndex = 0;
    this.unitsActedThisTurn = new Set();
    
    // Terrain and positioning  
    this.mapWidth = config.mapWidth || TERRAIN.MAP_SIZES.STANDARD.width;
    this.mapHeight = config.mapHeight || TERRAIN.MAP_SIZES.STANDARD.height;
    this.terrain = new Map(); // Position key -> TerrainTile
    this.unitPositions = new Map(); // Position key -> Unit ID
    
    // Combat tracking
    this.actionHistory = [];
    this.actionSequence = 0;
    this.lastActionTime = Date.now();
    
    // Environmental effects
    this.globalEffects = []; // Weather, time of day, etc.
    this.areaEffects = new Map(); // Position-based effects (fire, ice, etc.)
    
    // Victory conditions
    this.victoryConditions = config.victoryConditions || ['ELIMINATE_ENEMY'];
    this.winConditionsMet = false;
    this.winner = null;
    
    // Performance tracking
    this.turnTimeouts = new Map(); // Player -> timeout timestamp
    this.turnStartTime = Date.now();
    
    // State validation
    this.stateHash = this.calculateStateHash();
    this.isValid = true;
    this.lastValidation = Date.now();

    // Initialize terrain if provided
    if (config.terrainData) {
      this.initializeTerrain(config.terrainData);
    }

    // Load units if provided
    if (config.units) {
      this.loadUnits(config.units);
    }
  }

  /**
   * Initialize terrain from data
   * @param {Array} terrainData - Array of terrain tile configurations
   * @private
   */
  initializeTerrain(terrainData) {
    for (const tileData of terrainData) {
      const tile = new TerrainTile(tileData);
      const key = this.getPositionKey(tile.x, tile.y);
      this.terrain.set(key, tile);
    }
  }

  /**
   * Load units from configuration
   * @param {Array} unitConfigs - Array of unit configurations
   * @private
   */
  loadUnits(unitConfigs) {
    for (const config of unitConfigs) {
      const unit = new Unit(config);
      this.addUnit(unit);
    }
  }

  /**
   * Generate position key from coordinates
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {string} Position key
   */
  getPositionKey(x, y) {
    return `${x},${y}`;
  }

  /**
   * Parse position key into coordinates
   * @param {string} key - Position key
   * @returns {Object} {x, y} coordinates
   */
  parsePositionKey(key) {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  }

  /**
   * Add unit to combat
   * @param {Unit} unit - Unit to add
   * @returns {boolean} True if unit was added successfully
   */
  addUnit(unit) {
    if (this.units.has(unit.id)) {
      return false; // Unit already exists
    }

    this.units.set(unit.id, unit);
    
    // Set position if provided
    if (unit.position) {
      const posKey = this.getPositionKey(unit.position.x, unit.position.y);
      if (!this.unitPositions.has(posKey)) {
        this.unitPositions.set(posKey, unit.id);
      }
    }

    return true;
  }

  /**
   * Remove unit from combat
   * @param {string} unitId - Unit ID to remove
   * @returns {Unit|null} Removed unit or null
   */
  removeUnit(unitId) {
    const unit = this.units.get(unitId);
    if (!unit) return null;

    this.units.delete(unitId);
    this.deployedUnits.delete(unitId);
    this.incapacitatedUnits.delete(unitId);
    
    // Remove from position tracking
    if (unit.position) {
      const posKey = this.getPositionKey(unit.position.x, unit.position.y);
      if (this.unitPositions.get(posKey) === unitId) {
        this.unitPositions.delete(posKey);
      }
    }

    // Remove from initiative order
    this.initiativeOrder = this.initiativeOrder.filter(entry => entry.unitId !== unitId);

    return unit;
  }

  /**
   * Get unit by ID
   * @param {string} unitId - Unit ID
   * @returns {Unit|null} Unit or null if not found
   */
  getUnit(unitId) {
    return this.units.get(unitId) || null;
  }

  /**
   * Get unit at specific position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {Unit|null} Unit at position or null
   */
  getUnitAtPosition(x, y) {
    const posKey = this.getPositionKey(x, y);
    const unitId = this.unitPositions.get(posKey);
    return unitId ? this.getUnit(unitId) : null;
  }

  /**
   * Move unit to new position
   * @param {string} unitId - Unit ID
   * @param {number} x - New X coordinate
   * @param {number} y - New Y coordinate
   * @returns {boolean} True if move was successful
   */
  moveUnit(unitId, x, y) {
    const unit = this.getUnit(unitId);
    if (!unit) return false;

    // Check bounds
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return false;
    }

    const newPosKey = this.getPositionKey(x, y);
    
    // Check if position is occupied
    if (this.unitPositions.has(newPosKey)) {
      return false;
    }

    // Remove from old position
    if (unit.position) {
      const oldPosKey = this.getPositionKey(unit.position.x, unit.position.y);
      this.unitPositions.delete(oldPosKey);
    }

    // Set new position
    unit.position = { x, y };
    this.unitPositions.set(newPosKey, unitId);

    return true;
  }

  /**
   * Deploy unit to battlefield
   * @param {string} unitId - Unit ID
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} True if deployment was successful
   */
  deployUnit(unitId, x, y) {
    if (this.phase !== 'DEPLOYMENT') {
      return false;
    }

    const unit = this.getUnit(unitId);
    if (!unit || this.deployedUnits.has(unitId)) {
      return false;
    }

    if (this.moveUnit(unitId, x, y)) {
      this.deployedUnits.add(unitId);
      return true;
    }

    return false;
  }

  /**
   * Get terrain tile at position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {TerrainTile|null} Terrain tile or null
   */
  getTerrainAt(x, y) {
    const key = this.getPositionKey(x, y);
    return this.terrain.get(key) || null;
  }

  /**
   * Set terrain tile at position
   * @param {TerrainTile} tile - Terrain tile to set
   */
  setTerrainAt(tile) {
    const key = this.getPositionKey(tile.x, tile.y);
    this.terrain.set(key, tile);
  }

  /**
   * Check if position is valid and passable
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @param {string} unitType - Unit type for movement restrictions
   * @returns {boolean} True if position is passable
   */
  isPositionPassable(x, y, unitType = 'normal') {
    // Check bounds
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) {
      return false;
    }

    // Check if occupied by another unit
    if (this.getUnitAtPosition(x, y)) {
      return false;
    }

    // Check terrain
    const terrain = this.getTerrainAt(x, y);
    if (terrain) {
      const moveCost = terrain.getMoveCost(unitType);
      return moveCost < Infinity; // Infinity means impassable
    }

    return true; // Default passable if no terrain data
  }

  /**
   * Add action to history
   * @param {CombatAction} action - Action to record
   */
  recordAction(action) {
    action.turnNumber = this.turn;
    action.sequenceNumber = this.actionSequence++;
    action.timestamp = Date.now();
    
    this.actionHistory.push(action.clone());
    this.lastActionTime = action.timestamp;
  }

  /**
   * Get current unit whose turn it is
   * @returns {Unit|null} Current active unit or null
   */
  getCurrentUnit() {
    if (this.initiativeOrder.length === 0) return null;
    
    const entry = this.initiativeOrder[this.currentUnitIndex];
    return entry ? this.getUnit(entry.unitId) : null;
  }

  /**
   * Advance to next unit in initiative order
   * @returns {Unit|null} Next unit or null if turn is complete
   */
  advanceToNextUnit() {
    if (this.initiativeOrder.length === 0) return null;

    let attempts = 0;
    do {
      this.currentUnitIndex = (this.currentUnitIndex + 1) % this.initiativeOrder.length;
      attempts++;
      
      // Check if we've cycled through all units
      if (attempts >= this.initiativeOrder.length) {
        this.advanceToNextTurn();
        return null;
      }
      
      const unit = this.getCurrentUnit();
      if (unit && !unit.isIncapacitated && !this.unitsActedThisTurn.has(unit.id)) {
        return unit;
      }
    } while (attempts < this.initiativeOrder.length);

    return null;
  }

  /**
   * Advance to next turn
   */
  advanceToNextTurn() {
    this.turn++;
    this.currentUnitIndex = 0;
    this.unitsActedThisTurn.clear();
    this.turnStartTime = Date.now();
    
    // Restore AP for all units and process start-of-turn effects
    for (const unit of this.units.values()) {
      if (!unit.isIncapacitated) {
        unit.restoreAP();
        unit.processStatusEffects('start_turn');
      }
    }

    // Check for match timeout
    if (this.turn > this.maxTurns) {
      this.phase = 'RESOLUTION';
      this.determineWinner();
    }
  }

  /**
   * End current unit's turn
   * @param {string} unitId - Unit ending turn
   * @returns {boolean} True if turn was ended successfully
   */
  endUnitTurn(unitId) {
    const unit = this.getUnit(unitId);
    if (!unit) return false;

    // Mark unit as having acted
    this.unitsActedThisTurn.add(unitId);
    
    // Process end-of-turn effects
    unit.processStatusEffects('end_turn');
    
    // Record action
    this.recordAction(new CombatAction({
      type: 'END_TURN',
      actorId: unitId,
      apCost: 0
    }));

    return true;
  }

  /**
   * Check for victory conditions
   * @returns {boolean} True if victory conditions are met
   */
  checkVictoryConditions() {
    for (const condition of this.victoryConditions) {
      switch (condition) {
        case 'ELIMINATE_ENEMY':
          if (this.checkEliminationVictory()) {
            this.winConditionsMet = true;
            return true;
          }
          break;
        case 'ELIMINATE_LEADER':
          if (this.checkLeaderEliminationVictory()) {
            this.winConditionsMet = true;
            return true;
          }
          break;
      }
    }
    return false;
  }

  /**
   * Check elimination victory condition
   * @returns {boolean} True if one side has eliminated the other
   * @private
   */
  checkEliminationVictory() {
    const playerUnits = new Map();
    
    for (const unit of this.units.values()) {
      if (!this.incapacitatedUnits.has(unit.id)) {
        const playerId = this.getPlayerForUnit(unit.id);
        if (!playerUnits.has(playerId)) {
          playerUnits.set(playerId, []);
        }
        playerUnits.get(playerId).push(unit);
      }
    }

    // Check if only one player has units remaining
    const playersWithUnits = Array.from(playerUnits.keys()).filter(
      playerId => playerUnits.get(playerId).length > 0
    );

    if (playersWithUnits.length === 1) {
      this.winner = playersWithUnits[0];
      return true;
    }

    return false;
  }

  /**
   * Check leader elimination victory condition
   * @returns {boolean} True if all enemy leaders are eliminated
   * @private
   */
  checkLeaderEliminationVictory() {
    const playerLeaders = new Map();
    
    for (const unit of this.units.values()) {
      if (unit.isLeader) {
        const playerId = this.getPlayerForUnit(unit.id);
        if (!playerLeaders.has(playerId)) {
          playerLeaders.set(playerId, []);
        }
        playerLeaders.get(playerId).push(unit);
      }
    }

    // Check if only one player has living leaders
    const playersWithLivingLeaders = Array.from(playerLeaders.keys()).filter(
      playerId => playerLeaders.get(playerId).some(leader => !leader.isIncapacitated)
    );

    if (playersWithLivingLeaders.length === 1) {
      this.winner = playersWithLivingLeaders[0];
      return true;
    }

    return false;
  }

  /**
   * Get player ID for a unit
   * @param {string} unitId - Unit ID
   * @returns {string} Player ID
   * @private
   */
  getPlayerForUnit(unitId) {
    // This would be determined by army ownership in a real implementation
    // For now, return a placeholder
    return this.players.find(p => p.units && p.units.includes(unitId))?.id || 'unknown';
  }

  /**
   * Determine winner based on remaining forces
   * @private
   */
  determineWinner() {
    if (!this.checkVictoryConditions()) {
      // Determine winner by remaining forces/HP
      const playerScores = new Map();
      
      for (const unit of this.units.values()) {
        const playerId = this.getPlayerForUnit(unit.id);
        if (!playerScores.has(playerId)) {
          playerScores.set(playerId, 0);
        }
        
        if (!unit.isIncapacitated) {
          playerScores.set(playerId, playerScores.get(playerId) + unit.currentHP);
        }
      }

      // Winner is player with highest remaining HP
      let maxScore = -1;
      let winner = null;
      for (const [playerId, score] of playerScores) {
        if (score > maxScore) {
          maxScore = score;
          winner = playerId;
        }
      }
      
      this.winner = winner;
    }
    
    this.phase = 'COMPLETED';
  }

  /**
   * Calculate state hash for validation
   * @returns {string} State hash
   * @private
   */
  calculateStateHash() {
    const stateData = {
      turn: this.turn,
      phase: this.phase,
      units: Array.from(this.units.values()).map(u => u.serialize()),
      positions: Array.from(this.unitPositions.entries()),
      actionCount: this.actionHistory.length
    };
    
    return this.hashObject(stateData);
  }

  /**
   * Simple hash function for objects
   * @param {Object} obj - Object to hash
   * @returns {string} Hash string
   * @private
   */
  hashObject(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate state consistency
   * @returns {boolean} True if state is valid
   */
  validateState() {
    try {
      // Check basic consistency
      if (this.units.size === 0) return false;
      if (this.turn < 1) return false;
      if (!['DEPLOYMENT', 'COMBAT', 'RESOLUTION', 'COMPLETED'].includes(this.phase)) return false;

      // Validate unit positions
      for (const [posKey, unitId] of this.unitPositions) {
        const unit = this.getUnit(unitId);
        if (!unit) return false;
        
        const pos = this.parsePositionKey(posKey);
        if (unit.position.x !== pos.x || unit.position.y !== pos.y) return false;
      }

      // Validate initiative order
      for (const entry of this.initiativeOrder) {
        if (!this.getUnit(entry.unitId)) return false;
      }

      this.isValid = true;
      this.lastValidation = Date.now();
      return true;
    } catch (error) {
      this.isValid = false;
      return false;
    }
  }

  /**
   * Get public state data (safe for client)
   * @returns {Object} Public state data
   */
  getPublicState() {
    return {
      matchId: this.matchId,
      phase: this.phase,
      turn: this.turn,
      round: this.round,
      currentPlayerId: this.currentPlayerId,
      units: Array.from(this.units.values()).map(u => u.getPublicData()),
      terrain: Array.from(this.terrain.values()).map(t => ({
        x: t.x,
        y: t.y,
        type: t.type,
        height: t.height,
        moveCost: t.moveCost,
        evasionBonus: t.evasionBonus,
        coverValue: t.coverValue
      })),
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      currentUnit: this.getCurrentUnit()?.getPublicData() || null,
      winner: this.winner,
      winConditionsMet: this.winConditionsMet
    };
  }

  /**
   * Serialize complete state (including hidden data for server)
   * @param {boolean} includeHidden - Include hidden unit data
   * @returns {Object} Serialized state
   */
  serialize(includeHidden = false) {
    return {
      matchId: this.matchId,
      seed: this.seed,
      version: this.version,
      phase: this.phase,
      turn: this.turn,
      round: this.round,
      players: this.players,
      units: Array.from(this.units.values()).map(u => u.serialize(includeHidden)),
      terrain: Array.from(this.terrain.values()),
      mapWidth: this.mapWidth,
      mapHeight: this.mapHeight,
      initiativeOrder: this.initiativeOrder,
      actionHistory: this.actionHistory,
      victoryConditions: this.victoryConditions,
      winner: this.winner,
      stateHash: this.stateHash,
      timestamp: Date.now()
    };
  }

  /**
   * Clone state (deep copy)
   * @returns {CombatState} New combat state instance
   */
  clone() {
    const serialized = this.serialize(true);
    return CombatState.deserialize(serialized);
  }

  /**
   * Deserialize state from data
   * @param {Object} data - Serialized state data
   * @returns {CombatState} New combat state instance
   */
  static deserialize(data) {
    const state = new CombatState({
      matchId: data.matchId,
      seed: data.seed,
      version: data.version,
      phase: data.phase,
      turn: data.turn,
      players: data.players,
      mapWidth: data.mapWidth,
      mapHeight: data.mapHeight,
      victoryConditions: data.victoryConditions
    });

    // Restore units
    for (const unitData of data.units || []) {
      const unit = new Unit(unitData);
      state.addUnit(unit);
    }

    // Restore terrain
    for (const tileData of data.terrain || []) {
      const tile = new TerrainTile(tileData);
      state.setTerrainAt(tile);
    }

    // Restore other state
    state.initiativeOrder = data.initiativeOrder || [];
    state.actionHistory = data.actionHistory || [];
    state.winner = data.winner;

    return state;
  }

  /**
   * String representation
   * @returns {string} Human-readable state description
   */
  toString() {
    return `CombatState(match=${this.matchId}, phase=${this.phase}, turn=${this.turn}, units=${this.units.size})`;
  }
}

export default CombatState;