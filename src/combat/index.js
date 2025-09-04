/**
 * Tactica Arena Combat System - Public API Entry Point
 * 
 * This is the ONLY file that should be imported by client code. It exports
 * only the public-facing classes and functions, ensuring complete separation
 * between the hidden d20 mechanics and the visible game interface.
 * 
 * CRITICAL: The hidden d20 engine, ability scores, and internal calculations
 * are NEVER exposed through this API. All methods return only visible stats
 * and game-appropriate terminology.
 * 
 * Public API includes:
 * - Unit creation and management (visible stats only)
 * - Combat state management
 * - Combat preview and calculation API
 * - Action point system
 * - Initiative system (results only, not d20 calculations)
 * - Game constants (visible values only)
 * 
 * Version: 1.0
 * Architecture: Dual-layer (hidden d20 + visible stats)
 */

// Public Models (safe for client use)
export { Unit, StatusEffect, Equipment } from './models/Unit.js';
export { CombatState, CombatAction, TerrainTile } from './models/CombatState.js';

// Public API Layer (the main interface for clients)
export { CombatPreview, CombatPreviewResult } from './api/CombatPreview.js';

// Public Systems (client-safe interfaces only)
export { ActionPointSystem, Action, ActionQueue } from './systems/ActionPointSystem.js';
export { InitiativeSystem, InitiativeEntry } from './systems/InitiativeSystem.js';

// Public Constants (visible stats and game values only)
export { 
  ACTION_POINTS,
  VISIBLE_STATS,
  PROGRESSION,
  TERRAIN,
  EQUIPMENT,
  ARMY,
  CLASSES,
  FACTIONS,
  VALIDATION
} from './constants/GameConstants.js';

// Damage system exports (public interface only)
export { DAMAGE_TYPES } from './systems/DamageCalculator.js';

// Utility exports
export { DeterministicRNG, createRNG, createTimestampRNG, createStringRNG } from './core/DeterministicRNG.js';

/**
 * Combat System Factory Class
 * 
 * Provides a high-level interface for creating and managing combat instances.
 * This is the recommended way to initialize the combat system.
 */
export class CombatSystem {
  /**
   * Create a new combat system instance
   * @param {Object} config - System configuration
   */
  constructor(config = {}) {
    this.config = {
      enableLogging: config.enableLogging || false,
      enableDetailedPreviews: config.enableDetailedPreviews !== false,
      maxConcurrentMatches: config.maxConcurrentMatches || 100,
      turnTimeoutMs: config.turnTimeoutMs || 120000, // 2 minutes
      ...config
    };
    
    // Initialize subsystems
    this.preview = new (require('./api/CombatPreview.js').CombatPreview)({
      enableDetailedPreviews: this.config.enableDetailedPreviews
    });
    
    this.actionPoints = new (require('./systems/ActionPointSystem.js').ActionPointSystem)({
      logActions: this.config.enableLogging
    });
    
    this.initiative = new (require('./systems/InitiativeSystem.js').InitiativeSystem)({
      logInitiative: this.config.enableLogging
    });
    
    this.matches = new Map();
  }

  /**
   * Create a new combat match
   * @param {Object} matchConfig - Match configuration
   * @returns {CombatState} New combat state
   */
  createMatch(matchConfig = {}) {
    const combatState = new (require('./models/CombatState.js').CombatState)({
      matchId: matchConfig.matchId || `match_${Date.now()}`,
      seed: matchConfig.seed || Date.now(),
      players: matchConfig.players || [],
      mapWidth: matchConfig.mapWidth || 24,
      mapHeight: matchConfig.mapHeight || 24,
      terrainData: matchConfig.terrainData,
      units: matchConfig.units,
      victoryConditions: matchConfig.victoryConditions
    });

    this.matches.set(combatState.matchId, combatState);
    
    // Initialize all units in the action point system
    for (const unit of combatState.units.values()) {
      this.actionPoints.initializeUnit(unit);
    }

    return combatState;
  }

  /**
   * Get existing combat match
   * @param {string} matchId - Match ID
   * @returns {CombatState|null} Combat state or null if not found
   */
  getMatch(matchId) {
    return this.matches.get(matchId) || null;
  }

  /**
   * Remove combat match from system
   * @param {string} matchId - Match ID
   * @returns {boolean} True if match was removed
   */
  removeMatch(matchId) {
    return this.matches.delete(matchId);
  }

  /**
   * Create a unit with specified configuration
   * @param {Object} unitConfig - Unit configuration
   * @returns {Unit} New unit instance
   */
  createUnit(unitConfig) {
    return new (require('./models/Unit.js').Unit)(unitConfig);
  }

  /**
   * Preview an attack between two units
   * @param {string} matchId - Match ID
   * @param {string} attackerId - Attacker unit ID
   * @param {string} targetId - Target unit ID
   * @param {Object} options - Attack options
   * @returns {CombatPreviewResult} Attack preview result
   */
  previewAttack(matchId, attackerId, targetId, options = {}) {
    const match = this.getMatch(matchId);
    if (!match) {
      return new (require('./api/CombatPreview.js').CombatPreviewResult)({
        success: false,
        errors: ['Match not found']
      });
    }

    const attacker = match.getUnit(attackerId);
    const target = match.getUnit(targetId);

    if (!attacker || !target) {
      return new (require('./api/CombatPreview.js').CombatPreviewResult)({
        success: false,
        errors: ['Unit not found']
      });
    }

    return this.preview.previewAttack(attacker, target, match, options);
  }

  /**
   * Preview movement for a unit
   * @param {string} matchId - Match ID
   * @param {string} unitId - Unit ID
   * @param {Object} targetPosition - Target position {x, y}
   * @param {Object} options - Movement options
   * @returns {CombatPreviewResult} Movement preview result
   */
  previewMovement(matchId, unitId, targetPosition, options = {}) {
    const match = this.getMatch(matchId);
    if (!match) {
      return new (require('./api/CombatPreview.js').CombatPreviewResult)({
        success: false,
        errors: ['Match not found']
      });
    }

    const unit = match.getUnit(unitId);
    if (!unit) {
      return new (require('./api/CombatPreview.js').CombatPreviewResult)({
        success: false,
        errors: ['Unit not found']
      });
    }

    return this.preview.previewMovement(unit, targetPosition, match, options);
  }

  /**
   * Calculate initiative order for a match
   * @param {string} matchId - Match ID
   * @param {number} seed - RNG seed for deterministic results
   * @returns {Array} Initiative order array
   */
  calculateInitiative(matchId, seed) {
    const match = this.getMatch(matchId);
    if (!match) return [];

    const rng = new (require('./core/DeterministicRNG.js').DeterministicRNG)(seed);
    const units = Array.from(match.units.values());
    
    return this.initiative.calculateInitiativeOrder(units, rng, {
      getPlayerForUnit: (unitId) => {
        const unit = match.getUnit(unitId);
        return match.players.find(p => p.units && p.units.includes(unitId))?.id || 'unknown';
      }
    });
  }

  /**
   * Get unit status for display
   * @param {string} matchId - Match ID
   * @param {string} unitId - Unit ID
   * @returns {CombatPreviewResult} Unit status result
   */
  getUnitStatus(matchId, unitId) {
    const match = this.getMatch(matchId);
    if (!match) {
      return new (require('./api/CombatPreview.js').CombatPreviewResult)({
        success: false,
        errors: ['Match not found']
      });
    }

    const unit = match.getUnit(unitId);
    if (!unit) {
      return new (require('./api/CombatPreview.js').CombatPreviewResult)({
        success: false,
        errors: ['Unit not found']
      });
    }

    return this.preview.getUnitStatus(unit);
  }

  /**
   * Get match status summary
   * @param {string} matchId - Match ID
   * @returns {Object} Match status
   */
  getMatchStatus(matchId) {
    const match = this.getMatch(matchId);
    if (!match) {
      return { found: false, error: 'Match not found' };
    }

    return {
      found: true,
      matchId: match.matchId,
      phase: match.phase,
      turn: match.turn,
      winner: match.winner,
      unitsCount: match.units.size,
      publicState: match.getPublicState()
    };
  }

  /**
   * Get system statistics
   * @returns {Object} System statistics
   */
  getSystemStats() {
    return {
      activeMatches: this.matches.size,
      config: { ...this.config },
      version: '1.0.0',
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Clean up expired matches and resources
   * @param {number} maxAge - Maximum age in milliseconds
   * @returns {number} Number of matches cleaned up
   */
  cleanup(maxAge = 3600000) { // Default 1 hour
    let cleaned = 0;
    const now = Date.now();
    
    for (const [matchId, match] of this.matches) {
      if (match.phase === 'COMPLETED' && 
          (now - match.lastActionTime) > maxAge) {
        this.matches.delete(matchId);
        cleaned++;
      }
    }

    return cleaned;
  }
}

/**
 * Create a default combat system instance
 * @param {Object} config - System configuration
 * @returns {CombatSystem} Combat system instance
 */
export function createCombatSystem(config = {}) {
  return new CombatSystem(config);
}

/**
 * Version information
 */
export const VERSION = {
  major: 1,
  minor: 0,
  patch: 0,
  string: '1.0.0',
  architecture: 'dual-layer-d20',
  buildDate: new Date().toISOString()
};

/**
 * API Information for integration
 */
export const API_INFO = {
  name: 'Tactica Arena Combat System',
  version: VERSION.string,
  description: 'Dual-layer tactical combat system with hidden d20 mechanics',
  publicInterface: true,
  hiddenMechanics: false, // This API never exposes hidden mechanics
  supportedFeatures: [
    'unit-management',
    'combat-preview',
    'initiative-system',
    'action-points',
    'status-effects',
    'terrain-system',
    'deterministic-rng',
    'replay-support'
  ],
  compatibility: {
    client: 'web-browser',
    server: 'node-js',
    multiplayer: true,
    deterministic: true
  }
};

// Default export for convenience
export default CombatSystem;