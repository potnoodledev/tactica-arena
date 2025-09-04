# Tactica Arena - Three.js Hotseat Multiplayer Prototype

A complete Three.js-based hotseat multiplayer tactical combat game prototype that integrates with the existing Tactica Arena combat system.

## Features

### Complete 3D Battlefield
- **Tile-based grid system** (18x18 for Quick mode, 24x24 for Standard)
- **Procedurally generated terrain** with different tile types:
  - Plains (green) - Standard movement
  - Forest (dark green) - Provides cover, slows movement
  - Mountain (gray) - High ground advantage, difficult terrain
  - Water (blue) - Impassable for most units
  - Road (brown) - Fast movement
  - Ruins (dark gray) - Full cover, difficult terrain
- **Dynamic lighting** with shadows and atmospheric effects
- **Decorative elements** (trees, rocks, pillars, grass)

### Visual Unit System
- **Team-colored units** (Blue vs Red)
- **Class-specific 3D models** with distinct shapes for each unit type:
  - Swordsman (Capsule + sword)
  - Archer (Slim + bow)
  - Mage (Cone + orb)
  - Cleric (Capsule + halo)
  - Guardian (Box + shield)
  - Rogue (Small + cloak)
- **Health bars** above units with color-coded status
- **Team indicators** and class icons
- **Smooth animations** for movement, attacks, and damage

### Camera Controls
- **Right-click + drag**: Rotate camera around battlefield
- **Mouse wheel**: Zoom in/out
- **WASD keys**: Pan camera across battlefield
- **Auto-focus** on selected units
- **Smooth camera transitions**

### Combat System Integration
- **Hit chance calculations** based on unit stats
- **Damage previews** with min/max ranges
- **Critical hit system** with visual feedback
- **Action Point management** (3 AP per turn)
- **Movement range visualization**
- **Attack range indicators**

### Hotseat Multiplayer
- **Two-player turn-based gameplay**
- **Clear turn indicators** showing current player
- **Automatic turn switching** with End Turn button
- **Turn counter** and time tracking
- **Victory conditions** (elimination-based)

### User Interface
- **Unit information panel** showing:
  - Name, class, and level
  - Health bar with percentage
  - Action points display
  - Combat statistics (ATK, DEF, MAG, RES, AGL, MOV)
- **Combat preview system** showing hit chances and damage
- **Team status panels** with miniature health bars
- **Message log** tracking all game actions
- **Action buttons** for Move, Attack, and Wait
- **Responsive design** that scales to different screen sizes

### Visual Effects
- **Attack animations** with projectiles for ranged attacks
- **Hit/miss effects** with particles and screen feedback
- **Health change animations** (red flash for damage, green for healing)
- **Death animations** with fade-out effects
- **Particle systems** for various combat effects

## How to Play

### Starting a Game
1. Open `public/index.html` in a web browser
2. Configure game settings:
   - Choose map size (Quick 18x18 or Standard 24x24)
   - Enter player names
3. Click "Start Battle"

### Controls
- **Left click**: Select units, move, attack
- **Right click + drag**: Rotate camera
- **Mouse wheel**: Zoom in/out
- **WASD**: Pan camera
- **Space**: End turn
- **Escape**: Cancel current action
- **M**: Switch to move mode (when unit selected)
- **A**: Switch to attack mode (when unit selected)

### Gameplay Flow
1. **Select a unit** by clicking on it
2. **Choose an action**:
   - **Move**: Click the Move button, then click destination
   - **Attack**: Click Attack button, then click enemy target
   - **Wait**: Click Wait to end unit's turn
3. **End your turn** when done with all units
4. **Switch control** to the other player
5. **Win** by eliminating all enemy units

### Unit Classes
Each team starts with 6 units:
- **Warrior** (Leader) - Balanced melee fighter
- **Archer** - Long-range attacker
- **Mage** - Magic damage and area effects
- **Cleric** - Healer and support
- **Guardian** - Heavy armored tank
- **Rogue** - Fast, high-damage assassin

## Technical Architecture

### File Structure
```
public/
├── index.html              # Main game page
├── css/
│   └── game.css           # Complete UI styling
└── js/
    ├── game.js            # Main game controller
    ├── scenes/
    │   └── BattleScene.js # 3D battlefield management
    ├── entities/
    │   ├── Unit3D.js      # 3D unit representation
    │   └── Terrain3D.js   # Terrain system
    ├── controllers/
    │   ├── CameraController.js  # Camera controls
    │   └── InputController.js   # Input handling
    ├── ui/
    │   └── GameUI.js      # Interface management
    └── systems/
        ├── TurnManager.js         # Turn-based gameplay
        ├── CombatVisualizer.js    # Visual effects
        └── CombatIntegration.js   # Combat system bridge
```

### Key Technologies
- **Three.js r158** - 3D graphics and rendering
- **ES6 Modules** - Modern JavaScript structure
- **CSS Grid/Flexbox** - Responsive UI layout
- **WebGL** - Hardware-accelerated graphics
- **Raycasting** - Mouse picking and interaction

### Performance Features
- **Instanced rendering** for terrain tiles
- **Object pooling** for visual effects
- **LOD system** for distant objects
- **Efficient materials** with reusable shaders
- **Frame rate optimization** targeting 60 FPS

## Development Notes

This prototype demonstrates:

1. **Complete integration** between 3D visuals and tactical combat rules
2. **Scalable architecture** that can be extended with more features
3. **Responsive user interface** suitable for desktop gameplay
4. **Visual feedback systems** that make combat information clear
5. **Smooth gameplay flow** for hotseat multiplayer sessions

The prototype uses a simplified combat system that mimics the core mechanics of the full Tactica Arena d20 system while remaining accessible for rapid prototyping and testing.

## Next Steps for Full Implementation

1. **Integrate full d20 combat system** from `src/combat/`
2. **Add unit abilities and spells** with targeting systems
3. **Implement status effects** with visual indicators
4. **Add unit progression** and experience systems
5. **Create more detailed unit models** and animations
6. **Add sound effects** and audio feedback
7. **Implement save/load functionality**
8. **Add AI opponents** for single-player mode
9. **Create online multiplayer** using WebSocket connections
10. **Add more maps** and terrain variety

## 🚀 Getting Started

### Prerequisites
- Node.js (version 16 or higher)
- Modern web browser with WebGL support

### Installation & Setup

1. **Install dependencies**:
   ```bash
   cd tactica_arena
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   # or
   npm run dev
   ```

3. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

### Playing the Game

1. **Configure the battle**:
   - Enter player names for Player 1 and Player 2
   - Choose map size (Quick 18x18 or Standard 24x24)
   - Click "Start Battle"

2. **Gameplay controls**:
   - **Left-click**: Select units
   - **Left-click on highlighted tiles**: Move selected unit
   - **Left-click on enemies**: Attack when in range
   - **Right-click + drag**: Rotate camera
   - **Mouse wheel**: Zoom in/out
   - **WASD keys**: Pan camera
   - **ESC key**: Cancel current action
   - **End Turn button**: Switch to the other player

3. **Win condition**: Eliminate all enemy units

### Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support (may need WebGL enabled)
- **Mobile**: Basic support (touch controls included)

Enjoy your tactical battles! 🎮⚔️