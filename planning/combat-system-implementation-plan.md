# Combat System Implementation Plan
# Tactica Arena v1.0

## Executive Summary

This plan outlines the implementation of a dual-layer combat system for Tactica Arena, featuring a hidden d20 rules engine on the backend with a clean, game-specific stat interface on the frontend. The system must handle complex tactical combat with per-unit initiative, 3 AP economy, terrain effects, status effects, and multiple class archetypes while maintaining deterministic behavior for multiplayer integrity.

### Key Requirements Summary
- **Hidden Layer**: d20-based mechanics (STR, DEX, CON, INT, WIS, CHA) with proficiency scaling
- **Visible Layer**: Game stats (HP, MP, ATK, DEF, MAG, RES, AGL, INT, MOV, RNG, LCK)
- **Combat Features**: 3 AP system, per-unit initiative, terrain effects, status effects, critical hits
- **Classes**: 8 base classes with promotion paths at levels 20/40
- **Deterministic**: Server-authoritative with deterministic RNG for replay integrity

## Architecture Overview

### System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                           │
├─────────────────────────────────────────────────────────────┤
│ • Visible Stats (HP, MP, ATK, DEF, MAG, RES, AGL, etc.)    │
│ • Hit/Damage Previews                                      │
│ • Combat Animations & UI                                   │
│ • Input Handling                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ API Calls
┌─────────────────────────────────────────────────────────────┐
│                   COMBAT ENGINE API                        │
├─────────────────────────────────────────────────────────────┤
│ • Action Validation                                        │
│ • Combat Previews (derived from hidden mechanics)         │
│ • State Synchronization                                   │
│ • Event Broadcasting                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Internal Calls
┌─────────────────────────────────────────────────────────────┐
│                  HIDDEN D20 ENGINE                        │
├─────────────────────────────────────────────────────────────┤
│ • d20 Ability Scores (STR, DEX, CON, INT, WIS, CHA)       │
│ • Proficiency Scaling                                     │
│ • DC Calculations                                         │
│ • Advantage/Disadvantage                                  │
│ • Save Resolution                                         │
└─────────────────────────────────────────────────────────────┘
```

### Core Module Structure

```
CombatSystem/
├── core/
│   ├── CombatEngine.js          # Main combat orchestrator
│   ├── CombatState.js           # Match state management
│   ├── ActionProcessor.js       # Action validation and execution
│   └── EventSystem.js           # Combat event handling
├── hidden/
│   ├── D20Engine.js             # Hidden d20 mechanics
│   ├── AbilityScores.js         # STR, DEX, CON, INT, WIS, CHA
│   ├── ProficiencySystem.js     # Level-based proficiency scaling
│   ├── SaveSystem.js            # Fortitude, Reflex, Will saves
│   └── AdvantageSystem.js       # Advantage/Disadvantage logic
├── visible/
│   ├── StatSystem.js            # Visible stat management
│   ├── PreviewGenerator.js      # Hit/damage preview calculation
│   └── StatDerivation.js        # Hidden -> Visible stat conversion
├── combat/
│   ├── DamageCalculator.js      # Damage formulas and mitigation
│   ├── HitResolver.js           # Attack resolution
│   ├── CriticalSystem.js        # Critical hit mechanics
│   └── InitiativeSystem.js      # Turn order management
├── entities/
│   ├── Combatant.js             # Base unit class
│   ├── Ability.js               # Skill/ability definitions
│   ├── StatusEffect.js          # Buffs, debuffs, DoTs
│   └── Equipment.js             # Gear and consumables
├── systems/
│   ├── TerrainSystem.js         # Terrain effects and movement
│   ├── CollisionSystem.js       # Hitbox and range detection
│   ├── VisionSystem.js          # Line of sight and fog
│   └── ComboSystem.js           # Action chains and reactions
├── data/
│   ├── ClassDefinitions.js      # 8 base classes + promotions
│   ├── AbilityTemplates.js      # Skill archetypes
│   ├── TerrainTypes.js          # Tile definitions
│   └── StatusEffectTypes.js     # Standard status effects
└── utils/
    ├── DeterministicRNG.js      # Seeded random number generation
    ├── GeometryUtils.js         # Spatial calculations
    └── ValidationUtils.js       # Input validation helpers
```

## Core Data Models

### Unit Model (Dual-Layer)

```javascript
// Hidden Backend Representation
class BackendCombatant {
  constructor(unitData) {
    // Hidden d20 ability scores (3-18+)
    this.abilityScores = {
      STR: 10,
      DEX: 10,
      CON: 10,
      INT: 10,
      WIS: 10,
      CHA: 10
    };
    
    // Level and proficiency
    this.level = 1;
    this.proficiency = this.calculateProficiency(this.level);
    
    // Derived visible stats (calculated from hidden scores)
    this.visibleStats = this.deriveVisibleStats();
  }
}

// Public Client Representation
class VisibleCombatant {
  constructor(backendData) {
    // Only visible stats exposed to client
    this.stats = {
      HP: 100,
      MP: 50,
      ATK: 25,
      DEF: 15,
      MAG: 20,
      RES: 10,
      AGL: 15,
      INT: 12,
      MOV: 4,
      RNG: 1,
      LCK: 8
    };
    
    // Combat state
    this.currentHP = this.stats.HP;
    this.currentMP = this.stats.MP;
    this.currentAP = 3;
    this.statusEffects = [];
  }
}
```

### Combat State Model

```javascript
class CombatState {
  constructor() {
    this.turn = 1;
    this.phase = 'DEPLOYMENT'; // DEPLOYMENT, COMBAT, RESOLUTION
    this.activeUnit = null;
    this.initiativeOrder = [];
    this.combatants = new Map();
    this.terrain = new Map();
    this.matchSeed = null; // For deterministic RNG
    this.actionHistory = [];
  }
}
```

### Action Model

```javascript
class CombatAction {
  constructor(type, actorId, targetData, abilityId = null) {
    this.type = type; // MOVE, ATTACK, ABILITY, WAIT, END_TURN
    this.actorId = actorId;
    this.targetData = targetData; // position, target ID, or area
    this.abilityId = abilityId;
    this.apCost = 1;
    this.timestamp = Date.now();
  }
}
```

## Key Algorithms and Implementation Approach

### 1. Hidden-to-Visible Stat Derivation

```javascript
class StatDerivation {
  static deriveVisibleStats(abilityScores, level, equipment) {
    const proficiency = Math.floor(level / 10) + 2; // 2-6 based on level bands
    
    return {
      ATK: this.calculateATK(abilityScores.STR, proficiency, equipment),
      DEF: this.calculateDEF(abilityScores.CON, equipment.armor),
      MAG: this.calculateMAG(abilityScores.INT, proficiency, equipment),
      RES: this.calculateRES(abilityScores.WIS, equipment),
      AGL: this.calculateAGL(abilityScores.DEX, equipment),
      // ... other stats
    };
  }
}
```

### 2. Hit Resolution (Hidden d20 Logic)

```javascript
class HitResolver {
  static resolvePhysicalAttack(attacker, defender, terrain, statusEffects) {
    // Hidden d20 calculation
    const attackRoll = this.rollD20WithAdvantage(attacker, defender, terrain);
    const attackBonus = attacker.proficiency + attacker.getModifier('STR');
    const totalAttack = attackRoll + attackBonus;
    
    // Defense Value (hidden formula)
    const defenseValue = 10 + defender.getArmorBonus() + 
                        defender.getModifier('DEX') + terrain.coverBonus;
    
    const hit = totalAttack >= defenseValue;
    const critical = attackRoll === 20 || attackRoll >= attacker.getCritThreshold();
    
    // Return only visible results
    return {
      hit,
      critical,
      damage: hit ? this.calculateDamage(attacker, critical) : 0
    };
  }
}
```

### 3. Initiative System

```javascript
class InitiativeSystem {
  static calculateInitiativeOrder(combatants, rng) {
    return combatants.map(unit => ({
      unit,
      initiative: unit.getVisibleStat('AGL') + 
                 unit.getHiddenModifier('DEX') + 
                 rng.roll(1, 20),
      tiebreaker: unit.getVisibleStat('LCK')
    }))
    .sort((a, b) => {
      if (a.initiative !== b.initiative) {
        return b.initiative - a.initiative;
      }
      return b.tiebreaker - a.tiebreaker;
    });
  }
}
```

### 4. Status Effect Processing

```javascript
class StatusEffectProcessor {
  static processStatusEffects(combatant, phase) {
    const effects = combatant.statusEffects;
    const results = [];
    
    for (const effect of effects) {
      if (effect.triggersOn === phase) {
        const result = this.processEffect(effect, combatant);
        results.push(result);
        
        // Check for save to remove effect
        if (effect.allowsSave && this.rollSave(combatant, effect)) {
          combatant.removeStatusEffect(effect.id);
        }
      }
    }
    
    return results;
  }
}
```

## Implementation Tasks Breakdown

### Phase 1: Core Foundation (Priority 1, 3-4 weeks)

#### Task 1.1: Deterministic RNG System
- **Complexity**: Medium
- **Dependencies**: None
- **Description**: Implement seeded RNG for multiplayer consistency
- **Deliverables**:
  - DeterministicRNG class with seed management
  - d20 rolling with advantage/disadvantage support
  - State serialization for replay integrity
- **Acceptance Criteria**:
  - Same seed produces identical results across runs
  - Supports advantage/disadvantage mechanics
  - Thread-safe for server environment

#### Task 1.2: Core Data Models
- **Complexity**: Medium
- **Dependencies**: None
- **Description**: Define base classes for combatants, actions, and state
- **Deliverables**:
  - Combatant class with dual-layer stats
  - CombatState management
  - Action validation framework
- **Acceptance Criteria**:
  - Clean separation between hidden and visible stats
  - Immutable state updates
  - Type safety and validation

#### Task 1.3: Hidden d20 Engine
- **Complexity**: High
- **Dependencies**: Task 1.1, 1.2
- **Description**: Implement core d20 mechanics (ability scores, modifiers, proficiency)
- **Deliverables**:
  - AbilityScores management
  - Modifier calculations
  - Proficiency scaling by level
  - Save system (Fort/Ref/Will)
- **Acceptance Criteria**:
  - Accurate d20 math implementation
  - No exposure to client layer
  - Proper modifier calculations

#### Task 1.4: Stat Derivation System
- **Complexity**: High
- **Dependencies**: Task 1.3
- **Description**: Convert hidden stats to visible stats
- **Deliverables**:
  - StatDerivation formulas
  - Equipment bonus integration
  - Level scaling calculations
- **Acceptance Criteria**:
  - Visible stats accurately reflect hidden power
  - Equipment properly affects derivations
  - No visible d20 terminology

### Phase 2: Combat Resolution (Priority 1, 4-5 weeks)

#### Task 2.1: Hit Resolution System
- **Complexity**: High
- **Dependencies**: Task 1.3, 1.4
- **Description**: Implement attack resolution with hidden d20 logic
- **Deliverables**:
  - Physical attack resolution
  - Spell attack resolution
  - Critical hit system
  - Defense value calculations
- **Acceptance Criteria**:
  - Accurate hit/miss determination
  - Critical hits work with extended threat ranges
  - Advantage/disadvantage properly applied

#### Task 2.2: Damage Calculator
- **Complexity**: Medium
- **Dependencies**: Task 2.1
- **Description**: Calculate damage with mitigation and critical multipliers
- **Deliverables**:
  - Base damage formulas
  - Damage mitigation (DEF/RES)
  - Critical damage multiplication
  - Elemental damage types
- **Acceptance Criteria**:
  - Damage scales properly with stats
  - Mitigation reduces damage appropriately
  - Critical hits double dice, not modifiers

#### Task 2.3: Initiative and Turn Management
- **Complexity**: Medium
- **Dependencies**: Task 1.2
- **Description**: Per-unit initiative with 3 AP system
- **Deliverables**:
  - Initiative calculation and ordering
  - AP management per turn
  - Turn state transitions
  - Action point validation
- **Acceptance Criteria**:
  - Initiative order deterministic with tiebreakers
  - AP properly consumed and restored
  - Turn transitions maintain state integrity

#### Task 2.4: Combat Preview System
- **Complexity**: Medium
- **Dependencies**: Task 2.1, 2.2
- **Description**: Generate hit/damage previews without exposing hidden mechanics
- **Deliverables**:
  - Hit chance preview calculation
  - Damage range estimation
  - Terrain effect previews
  - Status effect considerations
- **Acceptance Criteria**:
  - Previews match actual resolution
  - No d20 terminology exposed
  - Accounts for all modifiers

### Phase 3: Advanced Combat Systems (Priority 2, 3-4 weeks)

#### Task 3.1: Status Effect System
- **Complexity**: High
- **Dependencies**: Task 2.1
- **Description**: Implement buffs, debuffs, and special conditions
- **Deliverables**:
  - StatusEffect base class
  - Effect application and removal
  - Duration tracking
  - Save vs. effects
  - Stacking rules
- **Acceptance Criteria**:
  - Effects properly modify combat calculations
  - Saves allow resistance/removal
  - Multiple effects stack correctly
  - Cleanse abilities work

#### Task 3.2: Terrain System
- **Complexity**: High
- **Dependencies**: Task 2.1, 2.2
- **Description**: Implement terrain effects on movement and combat
- **Deliverables**:
  - Terrain type definitions
  - Movement cost calculations
  - Cover and evasion bonuses
  - Height advantage system
  - Line of sight calculations
- **Acceptance Criteria**:
  - Terrain affects movement and combat appropriately
  - Cover provides defensive bonuses
  - Height gives combat advantages
  - LOS blocking works correctly

#### Task 3.3: Ability System Architecture
- **Complexity**: High
- **Dependencies**: Task 2.1, 3.1
- **Description**: Framework for diverse combat abilities
- **Deliverables**:
  - Ability base classes
  - Targeting system (single, AoE, line, cone)
  - Resource cost management (MP, cooldowns)
  - Effect application framework
- **Acceptance Criteria**:
  - Abilities can target appropriately
  - Resource costs enforced
  - Effects integrate with status system
  - Friendly fire for AoE abilities

### Phase 4: Class and Ability Implementation (Priority 2, 4-6 weeks)

#### Task 4.1: Base Class Definitions
- **Complexity**: Medium
- **Dependencies**: Task 3.3
- **Description**: Implement 8 base classes with their characteristics
- **Deliverables**:
  - Class stat progressions
  - Equipment restrictions
  - Base ability sets
  - Promotion requirements
- **Acceptance Criteria**:
  - Classes feel distinct in gameplay
  - Stat progressions balanced
  - Equipment restrictions enforced
  - Promotions unlock at correct levels

#### Task 4.2: Core Ability Archetypes
- **Complexity**: High
- **Dependencies**: Task 3.3, 4.1
- **Description**: Implement the 12 ability archetypes from the design doc
- **Deliverables**:
  - Strike (single target)
  - Barrage (AoE with friendly fire)
  - Dash/Gap-close
  - Disengage
  - Guard/Shield
  - Control effects (stun, root, hypnotize)
  - Heal and cleanse
  - Mobility abilities
- **Acceptance Criteria**:
  - Each archetype works as specified
  - AP costs and cooldowns balanced
  - Status effects integrate properly
  - Friendly fire on AoE abilities

#### Task 4.3: Class-Specific Abilities
- **Complexity**: High
- **Dependencies**: Task 4.2
- **Description**: Implement signature abilities for each class
- **Deliverables**:
  - Swordsman: Dash + Finisher
  - Guardian: Guard + Zone of Control
  - Archer: Barrage + Mark
  - Ranger: Disengage + Trap
  - Mage: AoE spells
  - Cleric: Heal + Cleanse
  - Rogue: Backstab + Smoke
  - Spearmaster: Reach + Brace
- **Acceptance Criteria**:
  - Abilities reflect class identity
  - Balanced power levels
  - Unique tactical options

#### Task 4.4: Promotion System
- **Complexity**: Medium
- **Dependencies**: Task 4.1, 4.3
- **Description**: Class evolution at levels 20 and 40
- **Deliverables**:
  - Promotion requirements validation
  - Enhanced abilities for promoted classes
  - New ability unlocks
  - Stat bonus applications
- **Acceptance Criteria**:
  - Promotions unlock at correct levels
  - Enhanced abilities more powerful
  - Clear progression path

### Phase 5: Integration and Optimization (Priority 3, 2-3 weeks)

#### Task 5.1: Combat Engine Integration
- **Complexity**: High
- **Dependencies**: All previous tasks
- **Description**: Integrate all systems into cohesive combat engine
- **Deliverables**:
  - CombatEngine orchestrator
  - Action processing pipeline
  - Event system integration
  - State synchronization
- **Acceptance Criteria**:
  - All systems work together
  - No conflicts between systems
  - Clean event flow
  - Proper error handling

#### Task 5.2: Performance Optimization
- **Complexity**: Medium
- **Dependencies**: Task 5.1
- **Description**: Optimize for server performance requirements
- **Deliverables**:
  - Object pooling for temporary entities
  - Caching for frequently calculated values
  - Optimized collision detection
  - Memory usage optimization
- **Acceptance Criteria**:
  - Combat resolution under 100ms
  - Low memory allocation
  - No performance regressions

#### Task 5.3: API Layer Implementation
- **Complexity**: Medium
- **Dependencies**: Task 5.1
- **Description**: Create clean API for client communication
- **Deliverables**:
  - Action validation endpoints
  - Combat preview generation
  - State synchronization
  - Event broadcasting
- **Acceptance Criteria**:
  - Clean separation from internal logic
  - No hidden mechanics exposed
  - Efficient serialization
  - Proper error responses

### Phase 6: Testing and Validation (Priority 1, 3-4 weeks)

#### Task 6.1: Unit Testing
- **Complexity**: Medium
- **Dependencies**: All implementation tasks
- **Description**: Comprehensive test coverage for all systems
- **Deliverables**:
  - d20 engine tests
  - Combat resolution tests
  - Status effect tests
  - Integration tests
- **Acceptance Criteria**:
  - 90%+ code coverage
  - All edge cases covered
  - Performance benchmarks met

#### Task 6.2: Combat Scenario Testing
- **Complexity**: High
- **Dependencies**: Task 6.1
- **Description**: Test complex combat scenarios
- **Deliverables**:
  - Multi-turn combat simulations
  - Class balance testing
  - Ability interaction tests
  - Edge case validation
- **Acceptance Criteria**:
  - Combat feels balanced
  - No exploitable combinations
  - Deterministic results

#### Task 6.3: AI Integration Testing
- **Complexity**: Medium
- **Dependencies**: Task 5.1
- **Description**: Validate system works with AI opponents
- **Deliverables**:
  - AI decision making integration
  - Performance with AI calculations
  - Difficulty level validation
- **Acceptance Criteria**:
  - AI can use all systems
  - Performance targets met
  - Difficulty progression works

## Technical Considerations

### Deterministic RNG
- **Requirement**: Identical seeds must produce identical combat results
- **Implementation**: Custom PRNG with state serialization
- **Testing**: Cross-platform consistency validation

### Server Authority
- **Requirement**: All combat calculations on server
- **Implementation**: Client sends actions, server processes and returns results
- **Security**: Input validation and sanity checks

### Performance Targets
- **Combat Resolution**: < 100ms per action
- **Preview Generation**: < 50ms
- **Memory Usage**: Minimal allocation in hot paths
- **Scalability**: Support 100+ concurrent matches

### Data Integrity
- **State Management**: Immutable state updates
- **Event Sourcing**: Complete action history for replays
- **Validation**: Comprehensive input validation at all levels

### Extensibility
- **Modular Design**: Easy to add new classes and abilities
- **Configuration**: Data-driven ability and class definitions
- **Plugin Architecture**: Support for expansion content

## Risk Mitigation

### High-Risk Areas
1. **Hidden-Visible Stat Conversion**: Complex math with no room for errors
2. **Deterministic RNG**: Must work identically across all platforms
3. **Performance**: Combat resolution must be fast enough for real-time feel
4. **Balance**: Hidden mechanics may create unexpected interactions

### Mitigation Strategies
1. **Extensive Testing**: Unit tests for all mathematical conversions
2. **Reference Implementation**: Cross-validate against known d20 systems
3. **Performance Monitoring**: Continuous benchmarking during development
4. **Iterative Balancing**: Regular balance testing with simulated matches

## Success Criteria

### Functional Requirements
- [ ] All 8 classes implemented with unique abilities
- [ ] Hidden d20 system works without client exposure
- [ ] Combat previews accurate to actual resolution
- [ ] Status effects and terrain work as specified
- [ ] Deterministic combat for replay system

### Performance Requirements
- [ ] Combat resolution < 100ms average
- [ ] Preview generation < 50ms average
- [ ] Memory usage stable over long sessions
- [ ] Support for 100+ concurrent matches

### Quality Requirements
- [ ] 90%+ test coverage
- [ ] No exploitable bugs in combat system
- [ ] Clean API with no d20 terminology exposure
- [ ] Maintainable and extensible codebase

This implementation plan provides a structured approach to building the complex dual-layer combat system while maintaining clean separation between the hidden d20 mechanics and the visible game interface. The phased approach allows for iterative development and testing while managing the complexity of the system.