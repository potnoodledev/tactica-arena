/**
 * Terrain3D - 3D Terrain System for Tactical Battlefield
 * 
 * Creates procedurally generated terrain with different tile types that affect
 * gameplay according to the Tactica Arena rules (plains, forest, mountain, etc.).
 */

import * as THREE from 'three';

export class Terrain3D {
    constructor(mapWidth = 18, mapHeight = 18, tileSize = 2) {
        this.mapWidth = mapWidth;
        this.mapHeight = mapHeight;
        this.tileSize = tileSize;
        
        this.group = new THREE.Group();
        this.terrainData = [];
        this.meshes = [];
        
        // Terrain type definitions from game constants
        this.terrainTypes = {
            PLAINS: { 
                name: 'Plains', 
                color: 0x4a7c59, 
                height: 0,
                moveCost: 1,
                evasion: 0,
                cover: 0
            },
            FOREST: { 
                name: 'Forest', 
                color: 0x2d5a3d, 
                height: 0.2,
                moveCost: 2,
                evasion: 0.1,
                cover: 0.5
            },
            MOUNTAIN: { 
                name: 'Mountain', 
                color: 0x6b6b6b, 
                height: 1.0,
                moveCost: 3,
                evasion: 0,
                cover: 0.5
            },
            WATER: { 
                name: 'Water', 
                color: 0x1e3a8a, 
                height: -0.2,
                moveCost: Infinity,
                evasion: 0,
                cover: 0
            },
            ROAD: { 
                name: 'Road', 
                color: 0x8b7355, 
                height: 0.05,
                moveCost: 0.5,
                evasion: 0,
                cover: 0
            },
            RUINS: { 
                name: 'Ruins', 
                color: 0x545454, 
                height: 0.3,
                moveCost: 2,
                evasion: 0.05,
                cover: 1.0
            }
        };
        
        // Materials for different terrain types
        this.materials = {};
        
        // Decoration objects (trees, rocks, etc.)
        this.decorations = [];
    }

    async init() {
        console.log(`Initializing Terrain3D: ${this.mapWidth}x${this.mapHeight}`);
        
        // Create materials for each terrain type
        this.createMaterials();
        
        // Generate terrain data
        this.generateTerrain();
        
        // Create terrain meshes
        this.createTerrainMeshes();
        
        // Add decorations
        this.addDecorations();
        
        // Add grid overlay for tactical visualization
        this.createGridOverlay();
        
        console.log('Terrain3D initialized');
    }

    createMaterials() {
        for (const [type, config] of Object.entries(this.terrainTypes)) {
            this.materials[type] = new THREE.MeshLambertMaterial({
                color: config.color,
                transparent: type === 'WATER',
                opacity: type === 'WATER' ? 0.8 : 1.0
            });
            
            // Add special properties for certain terrain types
            if (type === 'WATER') {
                // Make water slightly reflective
                this.materials[type].shininess = 100;
            } else if (type === 'MOUNTAIN') {
                // Make mountains more rough
                this.materials[type].roughness = 0.8;
            }
        }
        
        // Grid line material
        this.materials.GRID = new THREE.LineBasicMaterial({
            color: 0x444444,
            transparent: true,
            opacity: 0.3
        });
    }

    generateTerrain() {
        console.log('Generating terrain...');
        
        // Initialize terrain data array
        this.terrainData = [];
        for (let x = 0; x < this.mapWidth; x++) {
            this.terrainData[x] = [];
            for (let y = 0; y < this.mapHeight; y++) {
                this.terrainData[x][y] = this.generateTileType(x, y);
            }
        }
        
        // Post-process terrain to ensure playable layout
        this.postProcessTerrain();
        
        console.log('Terrain generation complete');
    }

    generateTileType(x, y) {
        // Use Perlin noise-like generation (simplified)
        const centerX = this.mapWidth / 2;
        const centerY = this.mapHeight / 2;
        const distanceFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
        const maxDistance = Math.sqrt(centerX ** 2 + centerY ** 2);
        const normalizedDistance = distanceFromCenter / maxDistance;
        
        // Create some pseudo-random variation
        const noise = this.simpleNoise(x * 0.1, y * 0.1);
        const noise2 = this.simpleNoise(x * 0.05, y * 0.05);
        
        let terrainType = 'PLAINS'; // Default
        
        // Generate terrain based on noise and position
        if (noise > 0.6 && normalizedDistance > 0.3) {
            terrainType = 'FOREST';
        } else if (noise < -0.5 && normalizedDistance > 0.4) {
            terrainType = 'MOUNTAIN';
        } else if (noise2 > 0.7 && normalizedDistance > 0.5) {
            terrainType = 'WATER';
        } else if (Math.abs(noise) < 0.2 && normalizedDistance < 0.6) {
            terrainType = 'ROAD';
        } else if (noise < -0.3 && normalizedDistance > 0.6 && Math.random() > 0.8) {
            terrainType = 'RUINS';
        }
        
        return {
            type: terrainType,
            x: x,
            y: y,
            height: this.terrainTypes[terrainType].height,
            properties: { ...this.terrainTypes[terrainType] }
        };
    }

    simpleNoise(x, y) {
        // Very simple pseudo-noise function
        const seed = x * 12.9898 + y * 78.233;
        return (Math.sin(seed * 43758.5453) % 1) * 2 - 1;
    }

    postProcessTerrain() {
        // Ensure starting areas are clear plains
        const clearRadius = 2;
        
        // Clear Player 1 starting area (left side)
        for (let x = 0; x < clearRadius + 1; x++) {
            for (let y = this.mapHeight / 2 - clearRadius; y <= this.mapHeight / 2 + clearRadius; y++) {
                if (y >= 0 && y < this.mapHeight) {
                    this.terrainData[x][y].type = 'PLAINS';
                    this.terrainData[x][y].height = 0;
                    this.terrainData[x][y].properties = { ...this.terrainTypes.PLAINS };
                }
            }
        }
        
        // Clear Player 2 starting area (right side)
        for (let x = this.mapWidth - clearRadius - 1; x < this.mapWidth; x++) {
            for (let y = this.mapHeight / 2 - clearRadius; y <= this.mapHeight / 2 + clearRadius; y++) {
                if (y >= 0 && y < this.mapHeight) {
                    this.terrainData[x][y].type = 'PLAINS';
                    this.terrainData[x][y].height = 0;
                    this.terrainData[x][y].properties = { ...this.terrainTypes.PLAINS };
                }
            }
        }
        
        // Remove isolated water tiles (ensure connectivity)
        this.removeIsolatedWater();
        
        // Add some strategic roads connecting important areas
        this.addStrategicRoads();
    }

    removeIsolatedWater() {
        // Convert isolated water tiles to plains
        for (let x = 1; x < this.mapWidth - 1; x++) {
            for (let y = 1; y < this.mapHeight - 1; y++) {
                if (this.terrainData[x][y].type === 'WATER') {
                    let waterNeighbors = 0;
                    
                    // Check adjacent tiles
                    for (let dx = -1; dx <= 1; dx++) {
                        for (let dy = -1; dy <= 1; dy++) {
                            if (dx === 0 && dy === 0) continue;
                            if (this.terrainData[x + dx][y + dy].type === 'WATER') {
                                waterNeighbors++;
                            }
                        }
                    }
                    
                    // If no water neighbors, convert to plains
                    if (waterNeighbors === 0) {
                        this.terrainData[x][y].type = 'PLAINS';
                        this.terrainData[x][y].height = 0;
                        this.terrainData[x][y].properties = { ...this.terrainTypes.PLAINS };
                    }
                }
            }
        }
    }

    addStrategicRoads() {
        // Add a horizontal road across the middle
        const middleY = Math.floor(this.mapHeight / 2);
        for (let x = Math.floor(this.mapWidth * 0.2); x < Math.floor(this.mapWidth * 0.8); x++) {
            if (this.terrainData[x][middleY].type === 'PLAINS') {
                this.terrainData[x][middleY].type = 'ROAD';
                this.terrainData[x][middleY].height = this.terrainTypes.ROAD.height;
                this.terrainData[x][middleY].properties = { ...this.terrainTypes.ROAD };
            }
        }
    }

    createTerrainMeshes() {
        console.log('Creating terrain meshes...');
        
        // Group tiles by type for efficient rendering
        const tileGroups = {};
        
        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                const tile = this.terrainData[x][y];
                
                if (!tileGroups[tile.type]) {
                    tileGroups[tile.type] = [];
                }
                
                tileGroups[tile.type].push({
                    x: x * this.tileSize,
                    y: tile.height,
                    z: y * this.tileSize,
                    gridX: x,
                    gridY: y
                });
            }
        }
        
        // Create instanced meshes for each terrain type
        for (const [terrainType, positions] of Object.entries(tileGroups)) {
            this.createInstancedTerrain(terrainType, positions);
        }
        
        console.log('Terrain meshes created');
    }

    createInstancedTerrain(terrainType, positions) {
        const geometry = new THREE.BoxGeometry(this.tileSize * 0.98, 0.2, this.tileSize * 0.98);
        const material = this.materials[terrainType];
        
        // Create instanced mesh for performance
        const instancedMesh = new THREE.InstancedMesh(geometry, material, positions.length);
        instancedMesh.receiveShadow = true;
        
        const matrix = new THREE.Matrix4();
        
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            
            // Adjust height based on terrain type
            let height = pos.y;
            if (terrainType === 'MOUNTAIN') {
                height += Math.random() * 0.3; // Varying mountain heights
            } else if (terrainType === 'FOREST') {
                height += Math.random() * 0.1; // Slight forest variation
            }
            
            matrix.makeTranslation(pos.x, height, pos.z);
            
            // Add slight scale variation
            const scale = 0.95 + Math.random() * 0.1;
            matrix.scale(new THREE.Vector3(scale, 1 + height * 2, scale));
            
            instancedMesh.setMatrixAt(i, matrix);
        }
        
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        this.group.add(instancedMesh);
        this.meshes.push(instancedMesh);
        
        // Store terrain type on mesh for interaction
        instancedMesh.userData.terrainType = terrainType;
    }

    addDecorations() {
        console.log('Adding terrain decorations...');
        
        for (let x = 0; x < this.mapWidth; x++) {
            for (let y = 0; y < this.mapHeight; y++) {
                const tile = this.terrainData[x][y];
                
                // Add decorations based on terrain type
                if (Math.random() < 0.3) { // 30% chance
                    this.addDecoration(tile, x * this.tileSize, y * this.tileSize);
                }
            }
        }
        
        console.log('Decorations added');
    }

    addDecoration(tile, worldX, worldZ) {
        let decoration = null;
        
        switch (tile.type) {
            case 'FOREST':
                decoration = this.createTree(worldX, worldZ, tile.height);
                break;
            case 'MOUNTAIN':
                decoration = this.createRock(worldX, worldZ, tile.height);
                break;
            case 'RUINS':
                decoration = this.createRuinPillar(worldX, worldZ, tile.height);
                break;
            case 'PLAINS':
                if (Math.random() < 0.1) { // Sparse grass clumps
                    decoration = this.createGrassClump(worldX, worldZ, tile.height);
                }
                break;
        }
        
        if (decoration) {
            this.group.add(decoration);
            this.decorations.push(decoration);
        }
    }

    createTree(x, z, baseHeight) {
        const group = new THREE.Group();
        
        // Tree trunk
        const trunkGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.8);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x4a4a3a });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(0, 0.4, 0);
        trunk.castShadow = true;
        group.add(trunk);
        
        // Tree foliage
        const foliageGeometry = new THREE.SphereGeometry(0.4, 8, 8);
        const foliageMaterial = new THREE.MeshLambertMaterial({ color: 0x2d5a3d });
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.set(0, 0.9, 0);
        foliage.scale.set(1, 0.8, 1);
        foliage.castShadow = true;
        group.add(foliage);
        
        group.position.set(x, baseHeight, z);
        return group;
    }

    createRock(x, z, baseHeight) {
        const geometry = new THREE.DodecahedronGeometry(0.2 + Math.random() * 0.2);
        const material = new THREE.MeshLambertMaterial({ color: 0x808080 });
        const rock = new THREE.Mesh(geometry, material);
        
        rock.position.set(
            x + (Math.random() - 0.5) * this.tileSize * 0.5,
            baseHeight + 0.1,
            z + (Math.random() - 0.5) * this.tileSize * 0.5
        );
        
        rock.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );
        
        rock.castShadow = true;
        return rock;
    }

    createRuinPillar(x, z, baseHeight) {
        const geometry = new THREE.CylinderGeometry(0.15, 0.2, 0.6 + Math.random() * 0.4);
        const material = new THREE.MeshLambertMaterial({ color: 0x666666 });
        const pillar = new THREE.Mesh(geometry, material);
        
        pillar.position.set(x, baseHeight + 0.3, z);
        pillar.rotation.z = (Math.random() - 0.5) * 0.3; // Slight tilt
        pillar.castShadow = true;
        
        return pillar;
    }

    createGrassClump(x, z, baseHeight) {
        const group = new THREE.Group();
        
        for (let i = 0; i < 5 + Math.random() * 5; i++) {
            const blade = new THREE.Mesh(
                new THREE.PlaneGeometry(0.05, 0.2),
                new THREE.MeshLambertMaterial({ 
                    color: 0x4a7c59, 
                    transparent: true, 
                    opacity: 0.8,
                    side: THREE.DoubleSide 
                })
            );
            
            blade.position.set(
                (Math.random() - 0.5) * 0.3,
                0.1,
                (Math.random() - 0.5) * 0.3
            );
            
            blade.rotation.y = Math.random() * Math.PI * 2;
            group.add(blade);
        }
        
        group.position.set(x, baseHeight, z);
        return group;
    }

    createGridOverlay() {
        const gridMaterial = this.materials.GRID;
        const points = [];
        
        // Horizontal lines
        for (let y = 0; y <= this.mapHeight; y++) {
            points.push(new THREE.Vector3(0, 0.01, y * this.tileSize));
            points.push(new THREE.Vector3(this.mapWidth * this.tileSize, 0.01, y * this.tileSize));
        }
        
        // Vertical lines
        for (let x = 0; x <= this.mapWidth; x++) {
            points.push(new THREE.Vector3(x * this.tileSize, 0.01, 0));
            points.push(new THREE.Vector3(x * this.tileSize, 0.01, this.mapHeight * this.tileSize));
        }
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const gridLines = new THREE.LineSegments(geometry, gridMaterial);
        
        this.group.add(gridLines);
        this.gridOverlay = gridLines;
    }

    // Public interface methods
    getTerrainAt(gridX, gridY) {
        if (gridX < 0 || gridX >= this.mapWidth || gridY < 0 || gridY >= this.mapHeight) {
            return null;
        }
        
        return this.terrainData[gridX][gridY];
    }

    getMovementCost(gridX, gridY) {
        const terrain = this.getTerrainAt(gridX, gridY);
        return terrain ? terrain.properties.moveCost : Infinity;
    }

    getCoverValue(gridX, gridY) {
        const terrain = this.getTerrainAt(gridX, gridY);
        return terrain ? terrain.properties.cover : 0;
    }

    getEvasionBonus(gridX, gridY) {
        const terrain = this.getTerrainAt(gridX, gridY);
        return terrain ? terrain.properties.evasion : 0;
    }

    getHeightAt(gridX, gridY) {
        const terrain = this.getTerrainAt(gridX, gridY);
        return terrain ? terrain.height : 0;
    }

    isPassable(gridX, gridY) {
        const terrain = this.getTerrainAt(gridX, gridY);
        return terrain ? terrain.properties.moveCost !== Infinity : false;
    }

    // Regeneration for different map sizes
    async regenerate(newWidth, newHeight, newTileSize) {
        console.log(`Regenerating terrain: ${newWidth}x${newHeight}`);
        
        // Clean up existing terrain
        this.cleanup();
        
        // Update dimensions
        this.mapWidth = newWidth;
        this.mapHeight = newHeight;
        this.tileSize = newTileSize;
        
        // Regenerate everything
        await this.init();
    }

    // Cleanup and disposal
    cleanup() {
        // Remove all meshes
        this.meshes.forEach(mesh => {
            this.group.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        this.meshes = [];
        
        // Remove decorations
        this.decorations.forEach(decoration => {
            this.group.remove(decoration);
            if (decoration.geometry) {
                decoration.geometry.dispose();
                decoration.material.dispose();
            } else if (decoration.children) {
                // Group with children
                decoration.children.forEach(child => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                });
            }
        });
        this.decorations = [];
        
        // Remove grid overlay
        if (this.gridOverlay) {
            this.group.remove(this.gridOverlay);
            this.gridOverlay.geometry.dispose();
            this.gridOverlay = null;
        }
        
        // Clear terrain data
        this.terrainData = [];
    }

    destroy() {
        this.cleanup();
        
        // Dispose materials
        Object.values(this.materials).forEach(material => {
            material.dispose();
        });
        
        console.log('Terrain3D destroyed');
    }
}