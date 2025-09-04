/**
 * BattleScene - 3D Battlefield Scene Manager
 * 
 * Manages the Three.js scene with tile-based battlefield, units, and visual effects.
 * Integrates with the Tactica Arena combat system for authentic gameplay.
 */

import * as THREE from 'three';
import { Unit3D } from '../entities/Unit3D.js';
import { Terrain3D } from '../entities/Terrain3D.js';
import { CombatVisualizer } from '../systems/CombatVisualizer.js';

export class BattleScene {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.terrain = null;
        this.combatVisualizer = null;
        
        // Map configuration
        this.mapWidth = 18;
        this.mapHeight = 18;
        this.tileSize = 2;
        
        // Units and game objects
        this.units = new Map();
        this.selectedUnit = null;
        this.currentPlayer = null;
        
        // Visual feedback objects
        this.movementOverlay = null;
        this.attackRangeOverlay = null;
        this.selectionIndicator = null;
        
        // Lighting
        this.ambientLight = null;
        this.directionalLight = null;
        this.pointLights = [];
        
        // Materials (reusable)
        this.materials = {
            movementTile: null,
            attackTile: null,
            selectionRing: null
        };
        
        // Animation groups
        this.animationGroups = [];
    }

    async init() {
        console.log('Initializing Battle Scene...');
        
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0a0a1a, 50, 200);
        
        // Create camera
        this.setupCamera();
        
        // Create lighting
        this.setupLighting();
        
        // Initialize materials
        this.initializeMaterials();
        
        // Create terrain system
        this.terrain = new Terrain3D(this.mapWidth, this.mapHeight, this.tileSize);
        await this.terrain.init();
        this.scene.add(this.terrain.group);
        
        // Initialize combat visualizer
        this.combatVisualizer = new CombatVisualizer(this.scene);
        await this.combatVisualizer.init();
        
        console.log('Battle Scene initialized');
    }

    setupCamera() {
        this.camera = new THREE.PerspectiveCamera(
            45, // FOV
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // Position camera above and behind the battlefield
        this.camera.position.set(20, 25, 30);
        this.camera.lookAt(this.mapWidth, 0, this.mapHeight);
    }

    setupLighting() {
        // Ambient light for overall illumination
        this.ambientLight = new THREE.AmbientLight(0x404080, 0.4);
        this.scene.add(this.ambientLight);
        
        // Main directional light (sun)
        this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        this.directionalLight.position.set(50, 100, 50);
        this.directionalLight.castShadow = true;
        
        // Configure shadows
        this.directionalLight.shadow.mapSize.width = 2048;
        this.directionalLight.shadow.mapSize.height = 2048;
        this.directionalLight.shadow.camera.near = 0.5;
        this.directionalLight.shadow.camera.far = 200;
        this.directionalLight.shadow.camera.left = -50;
        this.directionalLight.shadow.camera.right = 50;
        this.directionalLight.shadow.camera.top = 50;
        this.directionalLight.shadow.camera.bottom = -50;
        
        this.scene.add(this.directionalLight);
        
        // Add atmospheric point lights
        this.addAtmosphericLights();
    }

    addAtmosphericLights() {
        // Blue rim lights for atmosphere
        const rimLight1 = new THREE.PointLight(0x4facfe, 0.3, 30);
        rimLight1.position.set(-10, 15, this.mapHeight / 2);
        this.scene.add(rimLight1);
        this.pointLights.push(rimLight1);
        
        const rimLight2 = new THREE.PointLight(0x00f2fe, 0.3, 30);
        rimLight2.position.set(this.mapWidth + 10, 15, this.mapHeight / 2);
        this.scene.add(rimLight2);
        this.pointLights.push(rimLight2);
        
        // Subtle animated lights
        const animatedLight = new THREE.PointLight(0x8a2be2, 0.2, 20);
        animatedLight.position.set(this.mapWidth / 2, 20, -5);
        this.scene.add(animatedLight);
        this.pointLights.push(animatedLight);
        
        // Store reference for animation
        this.animatedLight = animatedLight;
    }

    initializeMaterials() {
        // Movement range overlay material
        this.materials.movementTile = new THREE.MeshBasicMaterial({
            color: 0x4facfe,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        // Attack range overlay material
        this.materials.attackTile = new THREE.MeshBasicMaterial({
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        // Selection ring material
        this.materials.selectionRing = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
    }

    async setupBattle(gameConfig) {
        console.log('Setting up battle with config:', gameConfig);
        
        // Update map size based on config
        if (gameConfig.mapSize === 'standard') {
            this.mapWidth = 24;
            this.mapHeight = 24;
        } else {
            this.mapWidth = 18;
            this.mapHeight = 18;
        }
        
        // Regenerate terrain with new size
        await this.terrain.regenerate(this.mapWidth, this.mapHeight, this.tileSize);
        
        // Create test armies for both players
        await this.createTestArmies(gameConfig);
        
        // Position camera for the map size
        this.positionCameraForMap();
        
        console.log('Battle setup complete');
    }

    async createTestArmies(gameConfig) {
        // Clear existing units
        this.clearUnits();
        
        // Create Player 1 team (Blue - Team A)
        const player1Units = await this.createPlayerArmy(1, 'blue', gameConfig.player1Name);
        
        // Create Player 2 team (Red - Team B)  
        const player2Units = await this.createPlayerArmy(2, 'red', gameConfig.player2Name);
        
        // Position units on battlefield
        this.positionUnitsOnBattlefield(player1Units, player2Units);
        
        console.log(`Created armies: ${player1Units.length} vs ${player2Units.length} units`);
    }

    async createPlayerArmy(playerId, teamColor, playerName) {
        const units = [];
        const unitConfigs = [
            { class: 'SWORDSMAN', name: 'Warrior', isLeader: true },
            { class: 'ARCHER', name: 'Archer' },
            { class: 'MAGE', name: 'Mage' },
            { class: 'CLERIC', name: 'Cleric' },
            { class: 'GUARDIAN', name: 'Guardian' },
            { class: 'ROGUE', name: 'Rogue' }
        ];
        
        for (let i = 0; i < unitConfigs.length; i++) {
            const config = unitConfigs[i];
            const unitId = `${playerId}_unit_${i + 1}`;
            
            // Create unit data (simplified for demo)
            const unitData = {
                id: unitId,
                name: `${config.name} ${i + 1}`,
                class: config.class,
                faction: playerId === 1 ? 'HUMAN_KINGDOM' : 'ELVEN_COURT',
                level: 5,
                isLeader: config.isLeader || false,
                playerId: playerId,
                teamColor: teamColor,
                // Basic stats for demo
                stats: {
                    HP: 120,
                    MP: 50,
                    ATK: 25,
                    DEF: 15,
                    MAG: 20,
                    RES: 10,
                    AGL: 15,
                    INT: 12,
                    MOV: 4,
                    RNG: config.class === 'ARCHER' || config.class === 'MAGE' ? 3 : 1,
                    LCK: 8
                },
                currentHP: 120,
                currentMP: 50,
                currentAP: 3,
                position: { x: 0, y: 0 }
            };
            
            // Create 3D unit
            const unit3D = new Unit3D(unitData);
            await unit3D.init();
            
            this.scene.add(unit3D.group);
            this.units.set(unitId, unit3D);
            units.push(unit3D);
        }
        
        return units;
    }

    positionUnitsOnBattlefield(player1Units, player2Units) {
        // Position Player 1 units on the left side
        for (let i = 0; i < player1Units.length; i++) {
            const unit = player1Units[i];
            const row = Math.floor(i / 3);
            const col = i % 3;
            
            const x = 2 + col * 2;
            const z = this.mapHeight / 2 - 2 + row * 2;
            
            unit.setPosition(x, z);
            unit.unitData.position = { x, y: z }; // Store grid position
        }
        
        // Position Player 2 units on the right side
        for (let i = 0; i < player2Units.length; i++) {
            const unit = player2Units[i];
            const row = Math.floor(i / 3);
            const col = i % 3;
            
            const x = this.mapWidth - 4 - col * 2;
            const z = this.mapHeight / 2 - 2 + row * 2;
            
            unit.setPosition(x, z);
            unit.unitData.position = { x, y: z }; // Store grid position
        }
    }

    positionCameraForMap() {
        const centerX = this.mapWidth * this.tileSize / 2;
        const centerZ = this.mapHeight * this.tileSize / 2;
        
        // Adjust camera position based on map size
        const distance = Math.max(this.mapWidth, this.mapHeight) * 1.5;
        
        this.camera.position.set(
            centerX + distance * 0.7,
            distance * 0.8,
            centerZ + distance * 0.7
        );
        
        this.camera.lookAt(centerX, 0, centerZ);
    }

    // Unit selection and interaction
    selectUnit(unit3D) {
        // Deselect previous unit
        if (this.selectedUnit) {
            this.selectedUnit.setSelected(false);
        }
        
        this.selectedUnit = unit3D;
        if (unit3D) {
            unit3D.setSelected(true);
            this.showSelectionIndicator(unit3D);
            this.showMovementRange(unit3D);
        } else {
            this.clearSelection();
        }
    }

    clearSelection() {
        if (this.selectedUnit) {
            this.selectedUnit.setSelected(false);
            this.selectedUnit = null;
        }
        
        this.hideSelectionIndicator();
        this.hideMovementRange();
        this.hideAttackRange();
    }

    showSelectionIndicator(unit3D) {
        this.hideSelectionIndicator();
        
        const geometry = new THREE.RingGeometry(1.5, 2, 32);
        const mesh = new THREE.Mesh(geometry, this.materials.selectionRing);
        
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.copy(unit3D.group.position);
        mesh.position.y = 0.1;
        
        this.scene.add(mesh);
        this.selectionIndicator = mesh;
        
        // Animate selection ring
        const animate = () => {
            if (this.selectionIndicator) {
                this.selectionIndicator.rotation.z += 0.02;
                requestAnimationFrame(animate);
            }
        };
        animate();
    }

    hideSelectionIndicator() {
        if (this.selectionIndicator) {
            this.scene.remove(this.selectionIndicator);
            this.selectionIndicator.geometry.dispose();
            this.selectionIndicator = null;
        }
    }

    showMovementRange(unit3D) {
        this.hideMovementRange();
        
        const movementRange = unit3D.unitData.stats.MOV;
        const tiles = [];
        
        // Create movement tiles in range
        for (let x = -movementRange; x <= movementRange; x++) {
            for (let z = -movementRange; z <= movementRange; z++) {
                const distance = Math.abs(x) + Math.abs(z);
                if (distance === 0 || distance > movementRange) continue;
                
                const worldX = unit3D.group.position.x + x * this.tileSize;
                const worldZ = unit3D.group.position.z + z * this.tileSize;
                
                // Check if position is valid
                const gridX = Math.round(worldX / this.tileSize);
                const gridZ = Math.round(worldZ / this.tileSize);
                
                if (gridX >= 0 && gridX < this.mapWidth && gridZ >= 0 && gridZ < this.mapHeight) {
                    const geometry = new THREE.PlaneGeometry(this.tileSize * 0.8, this.tileSize * 0.8);
                    const mesh = new THREE.Mesh(geometry, this.materials.movementTile);
                    
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.set(worldX, 0.05, worldZ);
                    
                    this.scene.add(mesh);
                    tiles.push(mesh);
                }
            }
        }
        
        this.movementOverlay = tiles;
    }

    hideMovementRange() {
        if (this.movementOverlay) {
            this.movementOverlay.forEach(tile => {
                this.scene.remove(tile);
                tile.geometry.dispose();
            });
            this.movementOverlay = null;
        }
    }

    showAttackRange(unit3D) {
        this.hideAttackRange();
        
        const attackRange = unit3D.unitData.stats.RNG;
        const tiles = [];
        
        // Create attack range tiles
        for (let x = -attackRange; x <= attackRange; x++) {
            for (let z = -attackRange; z <= attackRange; z++) {
                const distance = Math.max(Math.abs(x), Math.abs(z));
                if (distance === 0 || distance > attackRange) continue;
                
                const worldX = unit3D.group.position.x + x * this.tileSize;
                const worldZ = unit3D.group.position.z + z * this.tileSize;
                
                // Check if position is valid
                const gridX = Math.round(worldX / this.tileSize);
                const gridZ = Math.round(worldZ / this.tileSize);
                
                if (gridX >= 0 && gridX < this.mapWidth && gridZ >= 0 && gridZ < this.mapHeight) {
                    const geometry = new THREE.PlaneGeometry(this.tileSize * 0.6, this.tileSize * 0.6);
                    const mesh = new THREE.Mesh(geometry, this.materials.attackTile);
                    
                    mesh.rotation.x = -Math.PI / 2;
                    mesh.position.set(worldX, 0.06, worldZ);
                    
                    this.scene.add(mesh);
                    tiles.push(mesh);
                }
            }
        }
        
        this.attackRangeOverlay = tiles;
    }

    hideAttackRange() {
        if (this.attackRangeOverlay) {
            this.attackRangeOverlay.forEach(tile => {
                this.scene.remove(tile);
                tile.geometry.dispose();
            });
            this.attackRangeOverlay = null;
        }
    }

    showMovementPreview(unit3D, targetPosition) {
        // This would show a path preview
        // For now, just show the movement range
        this.showMovementRange(unit3D);
    }

    // Game state management
    setCurrentPlayer(player) {
        this.currentPlayer = player;
        
        // Highlight current player's units
        this.units.forEach(unit3D => {
            const isCurrentPlayer = unit3D.unitData.playerId === player.id;
            unit3D.setHighlighted(isCurrentPlayer);
        });
    }

    getAllUnits() {
        return Array.from(this.units.values());
    }

    getUnitById(unitId) {
        return this.units.get(unitId);
    }

    getUnitsForPlayer(playerId) {
        return Array.from(this.units.values()).filter(unit => unit.unitData.playerId === playerId);
    }

    // Raycasting helpers
    getUnitAtPosition(worldPosition) {
        const threshold = this.tileSize / 2;
        
        for (const unit3D of this.units.values()) {
            const distance = unit3D.group.position.distanceTo(worldPosition);
            if (distance < threshold) {
                return unit3D;
            }
        }
        
        return null;
    }

    getGridPosition(worldPosition) {
        return {
            x: Math.round(worldPosition.x / this.tileSize),
            y: Math.round(worldPosition.z / this.tileSize)
        };
    }

    getWorldPosition(gridX, gridY) {
        return new THREE.Vector3(
            gridX * this.tileSize,
            0,
            gridY * this.tileSize
        );
    }

    isValidGridPosition(gridX, gridY) {
        return gridX >= 0 && gridX < this.mapWidth && gridY >= 0 && gridY < this.mapHeight;
    }

    // Animation and updates
    update(deltaTime) {
        // Update animated light
        if (this.animatedLight) {
            this.animatedLight.intensity = 0.2 + Math.sin(Date.now() * 0.001) * 0.1;
        }
        
        // Update units
        this.units.forEach(unit3D => {
            unit3D.update(deltaTime);
        });
        
        // Update combat visualizer
        if (this.combatVisualizer) {
            this.combatVisualizer.update(deltaTime);
        }
        
        // Update selection ring animation
        if (this.selectionIndicator) {
            this.selectionIndicator.material.opacity = 0.8 + Math.sin(Date.now() * 0.005) * 0.2;
        }
    }

    // Cleanup
    clearUnits() {
        this.units.forEach(unit3D => {
            this.scene.remove(unit3D.group);
            unit3D.destroy();
        });
        this.units.clear();
        this.selectedUnit = null;
        
        this.clearSelection();
    }

    cleanup() {
        this.clearUnits();
        
        // Clear overlays
        this.hideMovementRange();
        this.hideAttackRange();
        this.hideSelectionIndicator();
        
        // Clear terrain
        if (this.terrain) {
            this.scene.remove(this.terrain.group);
            this.terrain.destroy();
        }
        
        // Clear lights
        this.pointLights.forEach(light => {
            this.scene.remove(light);
        });
        this.pointLights = [];
        
        if (this.directionalLight) {
            this.scene.remove(this.directionalLight);
        }
        
        if (this.ambientLight) {
            this.scene.remove(this.ambientLight);
        }
    }

    destroy() {
        this.cleanup();
        
        // Dispose materials
        Object.values(this.materials).forEach(material => {
            if (material) material.dispose();
        });
        
        // Clear scene
        if (this.scene) {
            this.scene.clear();
        }
        
        console.log('Battle Scene destroyed');
    }
}