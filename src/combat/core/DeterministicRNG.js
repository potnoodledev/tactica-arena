/**
 * Deterministic Random Number Generator for Tactica Arena
 * 
 * Provides seedable, deterministic random number generation for multiplayer
 * consistency and replay integrity. Uses a Linear Congruential Generator (LCG)
 * for predictable, fast random number generation.
 * 
 * Key requirements:
 * - Same seed always produces identical sequences
 * - Fast generation for real-time combat
 * - Support for advantage/disadvantage d20 rolls
 * - State serialization for replays
 * - Thread-safe operations
 */

import { HIDDEN_STATS } from '../constants/GameConstants.js';

/**
 * Deterministic Random Number Generator
 * 
 * Uses a 32-bit Linear Congruential Generator with parameters from
 * Numerical Recipes: a = 1664525, c = 1013904223, m = 2^32
 */
export class DeterministicRNG {
  /**
   * Create a new deterministic RNG instance
   * @param {number} seed - Initial seed value (will be normalized to 32-bit uint)
   */
  constructor(seed = Date.now()) {
    this.originalSeed = seed;
    this.state = this.normalizeSeed(seed);
    this.callCount = 0;
  }

  /**
   * Normalize seed to 32-bit unsigned integer
   * @param {number} seed - Raw seed value
   * @returns {number} Normalized 32-bit seed
   */
  normalizeSeed(seed) {
    // Ensure seed is a positive 32-bit integer
    return Math.abs(Math.floor(seed)) >>> 0;
  }

  /**
   * Generate next raw random number (internal method)
   * Updates internal state and returns 32-bit unsigned integer
   * @returns {number} Raw random value (0 to 2^32-1)
   * @private
   */
  nextRaw() {
    // LCG formula: (a * seed + c) mod m
    // Using 32-bit arithmetic with >>> 0 for modulo 2^32
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    this.callCount++;
    return this.state;
  }

  /**
   * Generate random float between 0 (inclusive) and 1 (exclusive)
   * @returns {number} Random float [0, 1)
   */
  random() {
    return this.nextRaw() / 0x100000000; // Divide by 2^32
  }

  /**
   * Generate random integer between min (inclusive) and max (inclusive)
   * @param {number} min - Minimum value (inclusive)
   * @param {number} max - Maximum value (inclusive)
   * @returns {number} Random integer [min, max]
   */
  randInt(min, max) {
    if (min > max) {
      throw new Error(`Invalid range: min (${min}) > max (${max})`);
    }
    const range = max - min + 1;
    return min + (this.nextRaw() % range);
  }

  /**
   * Roll a single d20
   * @returns {number} D20 result (1-20)
   */
  rollD20() {
    return this.randInt(HIDDEN_STATS.DICE.D20_MIN, HIDDEN_STATS.DICE.D20_MAX);
  }

  /**
   * Roll dice with specified sides and count
   * @param {number} count - Number of dice to roll
   * @param {number} sides - Number of sides per die
   * @returns {number} Sum of all dice rolled
   */
  roll(count, sides) {
    if (count < 1 || sides < 1) {
      throw new Error(`Invalid dice parameters: count=${count}, sides=${sides}`);
    }
    
    let total = 0;
    for (let i = 0; i < count; i++) {
      total += this.randInt(1, sides);
    }
    return total;
  }

  /**
   * Roll d20 with advantage (roll twice, take higher)
   * @returns {Object} Result object with { result, rolls, advantage: true }
   */
  rollWithAdvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    const result = Math.max(roll1, roll2);
    
    return {
      result,
      rolls: [roll1, roll2],
      advantage: true,
      disadvantage: false
    };
  }

  /**
   * Roll d20 with disadvantage (roll twice, take lower)
   * @returns {Object} Result object with { result, rolls, disadvantage: true }
   */
  rollWithDisadvantage() {
    const roll1 = this.rollD20();
    const roll2 = this.rollD20();
    const result = Math.min(roll1, roll2);
    
    return {
      result,
      rolls: [roll1, roll2],
      advantage: false,
      disadvantage: true
    };
  }

  /**
   * Roll d20 with optional advantage/disadvantage
   * @param {'normal' | 'advantage' | 'disadvantage'} type - Roll type
   * @returns {Object} Result object with roll details
   */
  rollD20WithCondition(type = 'normal') {
    switch (type) {
      case 'advantage':
        return this.rollWithAdvantage();
      case 'disadvantage':
        return this.rollWithDisadvantage();
      case 'normal':
      default:
        const result = this.rollD20();
        return {
          result,
          rolls: [result],
          advantage: false,
          disadvantage: false
        };
    }
  }

  /**
   * Perform a percentile check (roll under target percentage)
   * @param {number} targetPercent - Target percentage (0-100)
   * @returns {boolean} True if roll succeeded
   */
  percentileCheck(targetPercent) {
    if (targetPercent < 0 || targetPercent > 100) {
      throw new Error(`Invalid percentage: ${targetPercent}. Must be 0-100.`);
    }
    return this.random() * 100 < targetPercent;
  }

  /**
   * Choose random element from array
   * @param {Array} array - Array to choose from
   * @returns {*} Random element from array
   */
  choice(array) {
    if (!Array.isArray(array) || array.length === 0) {
      throw new Error('Cannot choose from empty or invalid array');
    }
    const index = this.randInt(0, array.length - 1);
    return array[index];
  }

  /**
   * Shuffle array in place using Fisher-Yates algorithm
   * @param {Array} array - Array to shuffle
   * @returns {Array} The shuffled array (modified in place)
   */
  shuffle(array) {
    if (!Array.isArray(array)) {
      throw new Error('Cannot shuffle non-array');
    }
    
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Get current RNG state for serialization
   * @returns {Object} Serializable state object
   */
  getState() {
    return {
      originalSeed: this.originalSeed,
      currentState: this.state,
      callCount: this.callCount,
      version: '1.0' // For future state migration
    };
  }

  /**
   * Restore RNG from serialized state
   * @param {Object} state - Previously serialized state
   */
  setState(state) {
    if (!state || typeof state !== 'object') {
      throw new Error('Invalid state object');
    }
    
    this.originalSeed = state.originalSeed;
    this.state = state.currentState;
    this.callCount = state.callCount || 0;
  }

  /**
   * Reset RNG to original seed
   */
  reset() {
    this.state = this.normalizeSeed(this.originalSeed);
    this.callCount = 0;
  }

  /**
   * Create a new RNG instance with different seed but same state
   * @param {number} newSeed - New seed value
   * @returns {DeterministicRNG} New RNG instance
   */
  fork(newSeed) {
    return new DeterministicRNG(newSeed);
  }

  /**
   * Generate a derived seed for creating related RNG streams
   * Useful for different systems (initiative, combat, loot) using
   * related but independent random streams
   * @param {string} purpose - Purpose identifier for the derived stream
   * @returns {number} Derived seed value
   */
  deriveSeed(purpose) {
    // Hash the purpose string to create consistent but different seeds
    let hash = 0;
    for (let i = 0; i < purpose.length; i++) {
      const char = purpose.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(this.originalSeed + hash);
  }

  /**
   * Create specialized RNG for specific combat subsystem
   * @param {string} system - System name ('initiative', 'combat', 'damage', etc.)
   * @returns {DeterministicRNG} New RNG instance for the specified system
   */
  createSubsystemRNG(system) {
    const derivedSeed = this.deriveSeed(system);
    return new DeterministicRNG(derivedSeed);
  }

  /**
   * Validate RNG reproducibility (testing/debugging utility)
   * @param {number} iterations - Number of test iterations
   * @returns {boolean} True if RNG produces identical sequences
   */
  validateReproducibility(iterations = 1000) {
    const originalState = this.getState();
    
    // Generate first sequence
    this.reset();
    const firstSequence = [];
    for (let i = 0; i < iterations; i++) {
      firstSequence.push(this.random());
    }
    
    // Generate second sequence
    this.reset();
    const secondSequence = [];
    for (let i = 0; i < iterations; i++) {
      secondSequence.push(this.random());
    }
    
    // Restore original state
    this.setState(originalState);
    
    // Compare sequences
    for (let i = 0; i < iterations; i++) {
      if (firstSequence[i] !== secondSequence[i]) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get debug information about RNG state
   * @returns {Object} Debug information
   */
  getDebugInfo() {
    return {
      originalSeed: this.originalSeed,
      currentState: this.state,
      callCount: this.callCount,
      nextPreview: this.random() // Shows next value without advancing state
    };
  }

  /**
   * String representation of RNG state
   * @returns {string} Human-readable state representation
   */
  toString() {
    return `DeterministicRNG(seed=${this.originalSeed}, state=${this.state}, calls=${this.callCount})`;
  }
}

/**
 * Factory function for creating RNG instances
 * @param {number} seed - Initial seed value
 * @returns {DeterministicRNG} New RNG instance
 */
export function createRNG(seed) {
  return new DeterministicRNG(seed);
}

/**
 * Create RNG instance from current timestamp
 * @returns {DeterministicRNG} New RNG with timestamp seed
 */
export function createTimestampRNG() {
  return new DeterministicRNG(Date.now());
}

/**
 * Create RNG instance from string (hashed to number)
 * @param {string} seedString - String to use as seed
 * @returns {DeterministicRNG} New RNG with hashed seed
 */
export function createStringRNG(seedString) {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    const char = seedString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return new DeterministicRNG(Math.abs(hash));
}

export default DeterministicRNG;