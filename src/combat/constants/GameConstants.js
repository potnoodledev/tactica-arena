/**
 * Game Constants for Tactica Arena Combat System
 * 
 * Contains all game-wide constants for the combat system including:
 * - Action Point costs and limits
 * - Stat ranges and scaling values
 * - Combat mechanics constants
 * - Level progression values
 * 
 * These constants define the core game balance and should be carefully
 * managed for multiplayer consistency.
 */

/**
 * Action Point System Constants
 */
export const ACTION_POINTS = {
  /** Maximum AP per unit per turn */
  MAX_PER_TURN: 3,
  
  /** Minimum AP required to take any action */
  MIN_FOR_ACTION: 1,
  
  /** AP costs for different action types */
  COSTS: {
    MOVE: 1,
    BASIC_ATTACK: 1,
    WAIT: 0,
    END_TURN: 0,
    DASH: 2,
    BARRAGE: 2,
    INSPIRE: 2,
    CONTROL: 2,
    TELEPORT: 2,
    TERRAIN_SHAPE: 2,
    FINISHER: 1,
    GUARD: 1,
    MARK: 1,
    CLEANSE: 1,
    HEAL: 1,
    DISENGAGE: 1,
    SCOUT_EYE: 1
  }
};

/**
 * Visible Stat Ranges
 * These are the stats players see and interact with
 */
export const VISIBLE_STATS = {
  HP: { MIN: 100, MAX: 600, BASE: 100 },
  MP: { MIN: 20, MAX: 200, BASE: 50 },
  ATK: { MIN: 10, MAX: 80, BASE: 25 },
  DEF: { MIN: 5, MAX: 60, BASE: 15 },
  MAG: { MIN: 10, MAX: 80, BASE: 20 },
  RES: { MIN: 5, MAX: 60, BASE: 10 },
  AGL: { MIN: 5, MAX: 40, BASE: 15 },
  INT: { MIN: 5, MAX: 40, BASE: 12 },
  MOV: { MIN: 3, MAX: 7, BASE: 4 },
  RNG: { MIN: 1, MAX: 6, BASE: 1 },
  LCK: { MIN: 1, MAX: 20, BASE: 8 }
};

/**
 * Hidden D20 System Constants
 * These constants are used internally and NEVER exposed to the client
 */
export const HIDDEN_STATS = {
  /** D20 ability score ranges */
  ABILITY_SCORES: {
    MIN: 3,
    MAX: 18,
    BASE: 10,
    MODIFIER_DIVISOR: 2,
    MODIFIER_OFFSET: 10
  },
  
  /** Proficiency bonus by level ranges */
  PROFICIENCY: {
    LEVEL_1_10: 2,
    LEVEL_11_20: 3,
    LEVEL_21_40: 4,
    LEVEL_41_60: 5,
    LEVEL_61_80: 6
  },
  
  /** Dice and save constants */
  DICE: {
    D20_MIN: 1,
    D20_MAX: 20,
    NATURAL_CRIT: 20,
    NATURAL_FUMBLE: 1,
    BASE_DEFENSE_VALUE: 10,
    BASE_SAVE_DC: 8
  }
};

/**
 * Level and Progression Constants
 */
export const PROGRESSION = {
  /** Maximum character level */
  MAX_LEVEL: 80,
  
  /** Key progression milestones */
  MILESTONES: {
    FIRST_PROMOTION: 20,
    SECOND_PROMOTION: 40,
    SKILL_TREE_MAJOR: [10, 20, 40]
  },
  
  /** XP multipliers */
  XP_MULTIPLIERS: {
    INT_BONUS_CAP: 0.25, // 25% max bonus from INT
    BASE_MULTIPLIER: 1.0
  }
};

/**
 * Combat Mechanics Constants
 */
export const COMBAT = {
  /** Initiative system */
  INITIATIVE: {
    BASE_ROLL: 20, // d20 for initiative
    AGL_WEIGHT: 1.0,
    LUCK_TIEBREAKER_WEIGHT: 1.0
  },
  
  /** Critical hit mechanics */
  CRITICAL: {
    BASE_THREAT_RANGE: 20, // Natural 20 always crits
    MAX_THREAT_RANGE: 18, // Can extend to 18-20
    DAMAGE_MULTIPLIER: 2.0, // Doubles dice, not modifiers
    LCK_INT_THREAT_EXTENSION: true // LCK + INT mods extend threat range
  },
  
  /** Advantage/Disadvantage */
  ADVANTAGE: {
    ROLL_COUNT: 2, // Roll 2d20, take higher/lower
    TRIGGERS: {
      BACKSTAB: 'advantage',
      HIGH_GROUND: 'advantage',
      COVER: 'disadvantage',
      BLIND: 'disadvantage'
    }
  },
  
  /** Status effects */
  STATUS_EFFECTS: {
    MAX_DURATION: 5, // Maximum turns for any status
    STACK_TYPES: {
      NONE: 'none',       // No stacking
      EXTEND: 'extend',   // New application extends duration
      INTENSITY: 'intensity' // Multiple applications increase effect
    }
  },
  
  /** Leader mechanics */
  LEADER: {
    MORALE_DEBUFF_DURATION: 2, // Turns when leader is KO'd
    MORALE_DEBUFF_ATK: 0.1, // 10% ATK reduction
    MORALE_DEBUFF_AGL: 0.1, // 10% AGL reduction
    INSPIRE_BUFF_DURATION: 1, // Turns for Inspire skill
    INSPIRE_BUFF_AGL: 0.1 // 10% AGL bonus
  }
};

/**
 * Map and Terrain Constants
 */
export const TERRAIN = {
  /** Map sizes */
  MAP_SIZES: {
    STANDARD: { width: 24, height: 24 },
    QUICK: { width: 18, height: 18 }
  },
  
  /** Terrain modifiers */
  MODIFIERS: {
    PLAINS: { moveCost: 1, evasion: 0, cover: 0, height: 0 },
    FOREST: { moveCost: 2, evasion: 0.1, cover: 0.5, height: 0 },
    MOUNTAIN: { moveCost: 3, evasion: 0, cover: 0.5, height: 1 },
    WATER: { moveCost: Infinity, evasion: 0, cover: 0, height: 0 }, // Impassable
    ROAD: { moveCost: 0.5, evasion: 0, cover: 0, height: 0 },
    RUINS: { moveCost: 2, evasion: 0.05, cover: 1.0, height: 0 }
  },
  
  /** Height advantages */
  HEIGHT: {
    RANGED_ATTACK_BONUS: 0.1, // 10% damage bonus per height level
    MELEE_DEFENSE_BONUS: 0.05 // 5% defense bonus per height level
  },
  
  /** Line of sight */
  LINE_OF_SIGHT: {
    MAX_RANGE: 12, // Maximum vision range in tiles
    FOG_DEFAULT: false // Fog of war off by default
  }
};

/**
 * Equipment and Inventory Constants
 */
export const EQUIPMENT = {
  /** Equipment slot limits */
  SLOTS: {
    TOTAL: 4,
    WEAPON_MAX: 1, // Usually 1, dual-wield exceptions exist
    ARMOR_MAX: 1,
    ACCESSORY_MAX: 2 // Remaining slots after weapon/armor
  },
  
  /** Consumable limits */
  CONSUMABLES: {
    BASE_CAPACITY: 4,
    MULE_TRAIT_BONUS: 2 // Additional capacity from mule traits
  },
  
  /** Durability system */
  DURABILITY: {
    TYPICAL_RANGE: { MIN: 6, MAX: 10 }, // Matches per item
    REPAIR_COST_MULTIPLIER: 0.1 // 10% of item value
  },
  
  /** Equipment tiers */
  TIERS: {
    COMMON: { statBonus: 5, requirements: null },
    RARE: { statBonus: 7, requirements: 'class_gate' },
    EPIC: { statBonus: 10, requirements: 'mastery_level' },
    LEGENDARY: { statBonus: 12, requirements: 'mastery_level_high' }
  }
};

/**
 * Army Composition Constants
 */
export const ARMY = {
  /** Army size limits */
  SIZE: {
    MAX_OWNED: Infinity, // No limit on owned units
    MAX_DEPLOYED: 12,
    MIN_DEPLOYED: 1,
    MAX_PER_CLASS: 2
  },
  
  /** Leader requirements */
  LEADER: {
    REQUIRED: true,
    MAX_LEADERS: 1
  }
};

/**
 * Performance and System Constants
 */
export const PERFORMANCE = {
  /** Timing targets (milliseconds) */
  TARGETS: {
    COMBAT_RESOLUTION: 100, // Max time for combat action resolution
    PREVIEW_GENERATION: 50, // Max time for hit/damage preview
    TURN_TIMEOUT: 120000 // 2 minutes per turn
  },
  
  /** Connection and networking */
  NETWORKING: {
    RECONNECT_WINDOW: 120000, // 2 minutes reconnect window
    MAX_CONCURRENT_MATCHES: 100
  }
};

/**
 * Class-specific Constants
 */
export const CLASSES = {
  /** Base class identifiers */
  TYPES: [
    'SWORDSMAN', 'GUARDIAN', 'ARCHER', 'RANGER',
    'MAGE', 'CLERIC', 'ROGUE', 'SPEARMASTER'
  ],
  
  /** Class-specific modifiers */
  MODIFIERS: {
    SWORDSMAN: { primaryStat: 'ATK', weaponTypes: ['sword', 'dual'] },
    GUARDIAN: { primaryStat: 'DEF', weaponTypes: ['shield+1h'] },
    ARCHER: { primaryStat: 'ATK', weaponTypes: ['bow', 'crossbow'] },
    RANGER: { primaryStat: 'AGL', weaponTypes: ['spear', 'sword'] },
    MAGE: { primaryStat: 'MAG', weaponTypes: ['staff', 'tome'] },
    CLERIC: { primaryStat: 'RES', weaponTypes: ['mace', 'staff'] },
    ROGUE: { primaryStat: 'AGL', weaponTypes: ['dagger', 'dual'] },
    SPEARMASTER: { primaryStat: 'ATK', weaponTypes: ['spear', 'halberd'] }
  }
};

/**
 * Error and Validation Constants
 */
export const VALIDATION = {
  /** Input validation limits */
  LIMITS: {
    ACTION_QUEUE_SIZE: 10,
    MAX_ABILITY_TARGETS: 12, // Theoretical max targets in an army
    MAX_CONCURRENT_EFFECTS: 20 // Max status effects per unit
  },
  
  /** Error codes */
  ERROR_CODES: {
    INSUFFICIENT_AP: 'INSUFFICIENT_AP',
    INVALID_TARGET: 'INVALID_TARGET',
    OUT_OF_RANGE: 'OUT_OF_RANGE',
    INVALID_ACTION: 'INVALID_ACTION',
    UNIT_INCAPACITATED: 'UNIT_INCAPACITATED'
  }
};

/**
 * Faction-specific Constants
 */
export const FACTIONS = {
  TYPES: [
    'HUMAN_KINGDOM', 'ELVEN_COURT', 'DWARVEN_CLANS',
    'UMBRAL_LEAGUE', 'TIDEMARCH'
  ],
  
  /** Faction passive bonuses */
  PASSIVES: {
    HUMAN_KINGDOM: { morale_resist: 0.05 },
    ELVEN_COURT: { base_agl_bonus: 1 },
    DWARVEN_CLANS: { durability_reduction: 0.1 },
    UMBRAL_LEAGUE: { flank_crit_bonus: 0.05 },
    TIDEMARCH: { water_movement: true }
  }
};

// Freeze all constants to prevent accidental mutation
Object.freeze(ACTION_POINTS);
Object.freeze(VISIBLE_STATS);
Object.freeze(HIDDEN_STATS);
Object.freeze(PROGRESSION);
Object.freeze(COMBAT);
Object.freeze(TERRAIN);
Object.freeze(EQUIPMENT);
Object.freeze(ARMY);
Object.freeze(PERFORMANCE);
Object.freeze(CLASSES);
Object.freeze(VALIDATION);
Object.freeze(FACTIONS);