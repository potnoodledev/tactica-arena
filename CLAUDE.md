# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Tactica Arena is a competitive, turn-based tactics game with Web3 integration. The game features faction-flavored armies fighting on procedurally generated, tile-based maps. Key systems include NFT ownership for Units/Armies/Weapons and on-chain match event logging.

## Architecture

### Core Systems
- **Backend d20 Rules Engine**: Hidden server-side implementation using d20 mechanics (STR, DEX, CON, INT, WIS, CHA) that drives combat calculations without exposing these mechanics to the UI
- **Client-Server Architecture**: Server-authoritative simulation with deterministic RNG for security and integrity
- **Web3 Integration**: ERC-721 NFTs for Armies/Units/Weapons, ERC-1155 for Consumables/Materials, with on-chain match attestations

### Development Agents
Two specialized agents are available for development tasks:
- **combat-systems-architect**: Designs and implements modular, graphics-agnostic combat systems including damage calculations, state machines, ability systems, status effects, and combat AI
- **threejs-game-frontend**: Implements 3D visualization, camera controls, input systems, UI overlays, and browser-based frontend infrastructure for web-based games

### Important Implementation Notes
- **UI/Backend Separation**: The d20 rules engine must remain completely invisible to players - no UI strings, numbers, tips, or logs should reference d20, DCs, or saves
- **Visible Stats Only**: Players see HP, MP, ATK, DEF, MAG, RES, AGL, INT, MOV, RNG, LCK - these are derived from hidden d20 abilities
- **Target Platforms**: PC & Mac at launch using Unity or Godot (to be determined via technical spike)

## Key Game Mechanics

### Combat System
- 3 AP per turn with per-unit initiative based on AGL
- Facing, height, Zone of Control (ZoC), Line of Sight (LOS), and friendly-fire for AoE
- Critical hits extend threat range with LCK + INT modifiers
- Advantage/Disadvantage system for tactical positioning

### Army Composition Rules
- Own >12 units, deploy up to 12 per battle
- Maximum 2 units of any class per deployment
- 1 Leader per army (Leader KO causes 2-turn morale debuff)

### Progression
- Level cap: 80
- Major progression spikes at levels 10/20/40
- Class promotions at levels 20 and 40
- 3-branch skill trees with occasional forks

## Development Standards

### Security & Integrity
- Anti-cheat sanity checks with turn checksums
- Deterministic replays for match verification
- Server-authoritative simulation prevents client manipulation
- Never expose backend calculation formulas or d20 terminology

### Performance Requirements
- 60 FPS on mid-spec PCs
- Pathfinding ≤100ms p95
- 120-second reconnect window for dropped connections

### Map Standards
- Ranked maps: 24×24 (Standard) or 18×18 (Quick)
- Fog of war OFF by default (both players must agree to enable)
- Symmetric chest spawns with match-only temporary buffs

## Agent Resources

The repository includes a game design expert agent at `agents/game-design-expert.md` that provides comprehensive game design principles, frameworks, and best practices for creating engaging gameplay experiences.

## Important Directory Guidelines

### Archive Directory - DO NOT USE
The `archive/` directory contains outdated and historical documentation. **DO NOT** reference or use any code or documentation from this directory as it represents deprecated designs and implementations that are no longer valid for the current project.

## Document Structure
- `docs/game-design-document.md`: Complete v1.0 game design specification with all systems and requirements (CURRENT)
- `agents/game-design-expert.md`: Game design expertise and frameworks reference
- `archive/`: Historical/deprecated content - DO NOT USE