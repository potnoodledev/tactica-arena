/**
 * Unit3D - 3D Visual Representation of Combat Units
 * 
 * Creates and manages the visual representation of units in the 3D battlefield.
 * Includes animations, team colors, health indicators, and class-specific visuals.
 */

import * as THREE from 'three';

export class Unit3D {
    constructor(unitData) {
        this.unitData = unitData;
        
        // 3D objects
        this.group = new THREE.Group();
        this.mesh = null;
        this.healthBar = null;
        this.classIcon = null;
        this.teamIndicator = null;
        
        // Visual state
        this.isSelected = false;
        this.isHighlighted = false;
        this.isAnimating = false;
        
        // Animation properties
        this.targetPosition = new THREE.Vector3();
        this.animationSpeed = 3.0;
        this.bobOffset = Math.random() * Math.PI * 2;
        
        // Materials
        this.materials = {
            body: null,
            team: null,
            health: null,
            healthBackground: null
        };
        
        // Team colors
        this.teamColors = {
            blue: { primary: 0x4facfe, secondary: 0x0080ff, emission: 0x0040aa },
            red: { primary: 0xff6b6b, secondary: 0xff4444, emission: 0xaa0000 }
        };
    }

    async init() {
        console.log(`Initializing Unit3D: ${this.unitData.name}`);
        
        // Create materials
        this.initializeMaterials();
        
        // Create 3D model based on class
        this.createUnitModel();
        
        // Create health bar
        this.createHealthBar();
        
        // Create team indicator
        this.createTeamIndicator();
        
        // Create class icon
        this.createClassIcon();
        
        // Set initial position
        this.targetPosition.set(0, 0, 0);
        
        console.log(`Unit3D initialized: ${this.unitData.name} (${this.unitData.class})`);
    }

    initializeMaterials() {
        const teamColor = this.teamColors[this.unitData.teamColor];
        
        // Main body material
        this.materials.body = new THREE.MeshPhongMaterial({
            color: 0x888888,
            shininess: 30,
            transparent: false
        });
        
        // Team color material
        this.materials.team = new THREE.MeshPhongMaterial({
            color: teamColor.primary,
            emissive: teamColor.emission,
            emissiveIntensity: 0.1,
            shininess: 50
        });
        
        // Health bar materials
        this.materials.health = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.9
        });
        
        this.materials.healthBackground = new THREE.MeshBasicMaterial({
            color: 0x333333,
            transparent: true,
            opacity: 0.7
        });
    }

    createUnitModel() {
        const classGeometries = this.getClassGeometry();
        
        // Create main body
        const bodyMesh = new THREE.Mesh(classGeometries.body, this.materials.body);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        bodyMesh.position.y = 0.5;
        
        // Create team-colored accent pieces
        if (classGeometries.accent) {
            const accentMesh = new THREE.Mesh(classGeometries.accent, this.materials.team);
            accentMesh.castShadow = true;
            accentMesh.position.y = 0.5;
            this.group.add(accentMesh);
        }
        
        // Add weapon/class-specific elements
        if (classGeometries.weapon) {
            const weaponMesh = new THREE.Mesh(classGeometries.weapon, this.materials.body);
            weaponMesh.castShadow = true;
            weaponMesh.position.y = 0.5;
            this.group.add(weaponMesh);
        }
        
        this.group.add(bodyMesh);
        this.mesh = bodyMesh;
        
        // Add subtle glow for selected/highlighted states
        this.createGlowEffect();
    }

    getClassGeometry() {
        const geometries = {
            body: null,
            accent: null,
            weapon: null
        };
        
        switch (this.unitData.class) {
            case 'SWORDSMAN':
                geometries.body = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
                geometries.accent = new THREE.BoxGeometry(0.15, 0.6, 0.35); // Armor chest piece
                geometries.weapon = new THREE.CylinderGeometry(0.02, 0.02, 1.0); // Sword
                break;
                
            case 'ARCHER':
                geometries.body = new THREE.CapsuleGeometry(0.25, 0.7, 8, 16);
                geometries.accent = new THREE.BoxGeometry(0.1, 0.4, 0.25); // Quiver
                geometries.weapon = new THREE.TorusGeometry(0.3, 0.02, 8, 16); // Bow
                break;
                
            case 'MAGE':
                geometries.body = new THREE.ConeGeometry(0.35, 1.0, 8);
                geometries.accent = new THREE.SphereGeometry(0.08, 8, 8); // Orb
                geometries.weapon = new THREE.CylinderGeometry(0.03, 0.03, 1.2); // Staff
                break;
                
            case 'CLERIC':
                geometries.body = new THREE.CapsuleGeometry(0.28, 0.75, 8, 16);
                geometries.accent = new THREE.TorusGeometry(0.15, 0.03, 8, 16); // Halo
                geometries.weapon = new THREE.BoxGeometry(0.3, 0.05, 0.25); // Book/Shield
                break;
                
            case 'GUARDIAN':
                geometries.body = new THREE.BoxGeometry(0.4, 0.9, 0.4); // Bulky armor
                geometries.accent = new THREE.CylinderGeometry(0.35, 0.35, 0.05); // Shield
                geometries.weapon = new THREE.CylinderGeometry(0.03, 0.03, 0.8); // Mace
                break;
                
            case 'ROGUE':
                geometries.body = new THREE.CapsuleGeometry(0.22, 0.65, 8, 16);
                geometries.accent = new THREE.BoxGeometry(0.08, 0.3, 0.15); // Cloak clasp
                geometries.weapon = new THREE.ConeGeometry(0.02, 0.3, 4); // Dagger
                break;
                
            case 'RANGER':
                geometries.body = new THREE.CapsuleGeometry(0.26, 0.72, 8, 16);
                geometries.accent = new THREE.BoxGeometry(0.12, 0.3, 0.2); // Leather vest
                geometries.weapon = new THREE.CylinderGeometry(0.02, 0.02, 1.1); // Spear
                break;
                
            case 'SPEARMASTER':
                geometries.body = new THREE.CapsuleGeometry(0.32, 0.85, 8, 16);
                geometries.accent = new THREE.BoxGeometry(0.18, 0.5, 0.3); // Armor plates
                geometries.weapon = new THREE.CylinderGeometry(0.025, 0.025, 1.4); // Halberd
                break;
                
            default:
                geometries.body = new THREE.CapsuleGeometry(0.3, 0.8, 8, 16);
                break;
        }
        
        return geometries;
    }

    createGlowEffect() {
        // Create subtle rim light effect for selection/highlight
        const glowGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 8, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: this.teamColors[this.unitData.teamColor].primary,
            transparent: true,
            opacity: 0,
            side: THREE.BackSide
        });
        
        const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
        glowMesh.position.y = 0.5;
        glowMesh.scale.setScalar(1.1);
        
        this.group.add(glowMesh);
        this.glowMesh = glowMesh;
    }

    createHealthBar() {
        const healthGroup = new THREE.Group();
        
        // Health bar background
        const bgGeometry = new THREE.PlaneGeometry(1.0, 0.1);
        const bgMesh = new THREE.Mesh(bgGeometry, this.materials.healthBackground);
        bgMesh.position.set(0, 1.8, 0);
        healthGroup.add(bgMesh);
        
        // Health bar foreground
        const healthGeometry = new THREE.PlaneGeometry(1.0, 0.08);
        const healthMesh = new THREE.Mesh(healthGeometry, this.materials.health);
        healthMesh.position.set(0, 1.8, 0.01);
        healthGroup.add(healthMesh);
        
        this.healthBar = {
            group: healthGroup,
            background: bgMesh,
            foreground: healthMesh,
            maxWidth: 1.0
        };
        
        this.group.add(healthGroup);
        this.updateHealthBar();
    }

    updateHealthBar() {
        if (!this.healthBar) return;
        
        const healthPercentage = this.unitData.currentHP / this.unitData.stats.HP;
        const width = this.healthBar.maxWidth * healthPercentage;
        
        // Update width
        this.healthBar.foreground.scale.x = healthPercentage;
        
        // Update color based on health
        let color;
        if (healthPercentage > 0.6) {
            color = 0x00ff00; // Green
        } else if (healthPercentage > 0.3) {
            color = 0xffff00; // Yellow
        } else {
            color = 0xff0000; // Red
        }
        
        this.materials.health.color.setHex(color);
        
        // Make health bar face camera (billboard effect would be better)
        this.healthBar.group.lookAt(this.healthBar.group.position.x, this.healthBar.group.position.y + 1, this.healthBar.group.position.z + 1);
    }

    createTeamIndicator() {
        // Small team-colored indicator above unit
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: this.teamColors[this.unitData.teamColor].primary,
            emissive: this.teamColors[this.unitData.teamColor].emission,
            emissiveIntensity: 0.3
        });
        
        const indicator = new THREE.Mesh(geometry, material);
        indicator.position.set(0, 2.2, 0);
        
        this.teamIndicator = indicator;
        this.group.add(indicator);
    }

    createClassIcon() {
        // Simple geometric shape to indicate class
        let geometry;
        
        switch (this.unitData.class) {
            case 'SWORDSMAN':
                geometry = new THREE.BoxGeometry(0.05, 0.3, 0.05);
                break;
            case 'ARCHER':
                geometry = new THREE.RingGeometry(0.08, 0.12, 8);
                break;
            case 'MAGE':
                geometry = new THREE.TetrahedronGeometry(0.08);
                break;
            case 'CLERIC':
                geometry = new THREE.OctahedronGeometry(0.08);
                break;
            case 'GUARDIAN':
                geometry = new THREE.BoxGeometry(0.15, 0.15, 0.02);
                break;
            case 'ROGUE':
                geometry = new THREE.ConeGeometry(0.06, 0.15, 3);
                break;
            case 'RANGER':
                geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.2);
                break;
            case 'SPEARMASTER':
                geometry = new THREE.CylinderGeometry(0.02, 0.02, 0.25);
                break;
            default:
                geometry = new THREE.SphereGeometry(0.08);
                break;
        }
        
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        const icon = new THREE.Mesh(geometry, material);
        icon.position.set(0.5, 1.5, 0);
        
        this.classIcon = icon;
        this.group.add(icon);
    }

    // Visual state management
    setSelected(selected) {
        this.isSelected = selected;
        this.updateVisualState();
    }

    setHighlighted(highlighted) {
        this.isHighlighted = highlighted;
        this.updateVisualState();
    }

    updateVisualState() {
        if (!this.glowMesh) return;
        
        if (this.isSelected) {
            this.glowMesh.material.opacity = 0.4;
            this.glowMesh.material.color.setHex(0xffff00); // Yellow for selection
        } else if (this.isHighlighted) {
            this.glowMesh.material.opacity = 0.2;
            this.glowMesh.material.color.setHex(this.teamColors[this.unitData.teamColor].primary);
        } else {
            this.glowMesh.material.opacity = 0;
        }
    }

    // Position and animation
    setPosition(x, z, animate = false) {
        const worldPos = new THREE.Vector3(x * 2, 0, z * 2); // Convert grid to world coords
        
        if (animate && !this.isAnimating) {
            this.animateToPosition(worldPos);
        } else {
            this.group.position.copy(worldPos);
            this.targetPosition.copy(worldPos);
        }
    }

    animateToPosition(targetPos) {
        this.isAnimating = true;
        this.targetPosition.copy(targetPos);
        
        // Simple animation will be handled in update()
    }

    // Combat actions
    playAttackAnimation(targetUnit) {
        if (this.isAnimating) return;
        
        const originalPosition = this.group.position.clone();
        const direction = new THREE.Vector3().subVectors(targetUnit.group.position, this.group.position);
        direction.normalize().multiplyScalar(0.5);
        
        // Quick lunge forward and back
        const attackPos = originalPosition.clone().add(direction);
        
        this.isAnimating = true;
        
        // Simple tween-like animation
        let progress = 0;
        const animate = () => {
            progress += 0.1;
            
            if (progress <= 0.5) {
                // Move forward
                this.group.position.lerpVectors(originalPosition, attackPos, progress * 2);
            } else {
                // Move back
                this.group.position.lerpVectors(attackPos, originalPosition, (progress - 0.5) * 2);
            }
            
            if (progress >= 1) {
                this.group.position.copy(originalPosition);
                this.isAnimating = false;
                return;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    playDamageAnimation() {
        // Red flash effect
        const originalEmissive = this.materials.body.emissive.getHex();
        
        this.materials.body.emissive.setHex(0xff0000);
        this.materials.body.emissiveIntensity = 0.5;
        
        setTimeout(() => {
            this.materials.body.emissive.setHex(originalEmissive);
            this.materials.body.emissiveIntensity = 0;
        }, 200);
        
        // Update health bar
        this.updateHealthBar();
    }

    playHealAnimation() {
        // Green flash effect
        const originalEmissive = this.materials.body.emissive.getHex();
        
        this.materials.body.emissive.setHex(0x00ff00);
        this.materials.body.emissiveIntensity = 0.3;
        
        setTimeout(() => {
            this.materials.body.emissive.setHex(originalEmissive);
            this.materials.body.emissiveIntensity = 0;
        }, 300);
        
        // Update health bar
        this.updateHealthBar();
    }

    playDeathAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        // Fade out and scale down
        let progress = 0;
        const animate = () => {
            progress += 0.02;
            
            this.group.scale.setScalar(1 - progress * 0.5);
            this.group.rotation.z = progress * Math.PI;
            
            // Fade materials
            this.materials.body.opacity = 1 - progress;
            this.materials.team.opacity = 1 - progress;
            this.materials.body.transparent = true;
            this.materials.team.transparent = true;
            
            if (progress >= 1) {
                // Mark as incapacitated
                this.unitData.isIncapacitated = true;
                this.group.visible = false;
                this.isAnimating = false;
                return;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // Update and lifecycle
    update(deltaTime) {
        // Handle position animation
        if (this.isAnimating && !this.group.position.equals(this.targetPosition)) {
            this.group.position.lerp(this.targetPosition, this.animationSpeed * deltaTime * 0.001);
            
            if (this.group.position.distanceTo(this.targetPosition) < 0.01) {
                this.group.position.copy(this.targetPosition);
                this.isAnimating = false;
            }
        }
        
        // Subtle idle animation (bobbing)
        if (!this.isAnimating) {
            const time = Date.now() * 0.001 + this.bobOffset;
            this.group.position.y = Math.sin(time * 2) * 0.05;
        }
        
        // Update team indicator pulse
        if (this.teamIndicator) {
            const pulse = 0.3 + Math.sin(Date.now() * 0.003) * 0.1;
            this.teamIndicator.material.emissiveIntensity = pulse;
        }
        
        // Update class icon rotation
        if (this.classIcon) {
            this.classIcon.rotation.y += 0.01;
        }
        
        // Update health bar to face camera (simplified)
        if (this.healthBar) {
            // In a real implementation, you'd get the camera position
            // For now, just ensure it's visible
        }
    }

    // Data management
    updateUnitData(newData) {
        const oldHP = this.unitData.currentHP;
        
        Object.assign(this.unitData, newData);
        
        // Check for health changes
        if (newData.currentHP !== undefined && newData.currentHP !== oldHP) {
            if (newData.currentHP < oldHP) {
                this.playDamageAnimation();
            } else if (newData.currentHP > oldHP) {
                this.playHealAnimation();
            }
            
            // Check for death
            if (newData.currentHP <= 0 && !this.unitData.isIncapacitated) {
                this.playDeathAnimation();
            }
        }
    }

    // Cleanup
    destroy() {
        // Remove from scene (should be done by parent)
        
        // Dispose geometries and materials
        if (this.mesh) {
            this.mesh.geometry.dispose();
        }
        
        // Clean up all materials
        Object.values(this.materials).forEach(material => {
            if (material) material.dispose();
        });
        
        // Clean up health bar
        if (this.healthBar) {
            this.healthBar.background.geometry.dispose();
            this.healthBar.foreground.geometry.dispose();
        }
        
        // Clean up other components
        if (this.teamIndicator) {
            this.teamIndicator.geometry.dispose();
            this.teamIndicator.material.dispose();
        }
        
        if (this.classIcon) {
            this.classIcon.geometry.dispose();
            this.classIcon.material.dispose();
        }
        
        if (this.glowMesh) {
            this.glowMesh.geometry.dispose();
            this.glowMesh.material.dispose();
        }
        
        console.log(`Unit3D destroyed: ${this.unitData.name}`);
    }
}