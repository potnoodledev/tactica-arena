/**
 * CombatVisualizer - Visual Effects for Combat Actions
 * 
 * Creates and manages visual effects for combat including:
 * - Attack animations and projectiles
 * - Hit/miss effects
 * - Spell and ability effects
 * - Status effect indicators
 */

import * as THREE from 'three';

export class CombatVisualizer {
    constructor(scene) {
        this.scene = scene;
        this.initialized = false;
        
        // Active effects
        this.activeEffects = [];
        this.particleSystems = [];
        
        // Effect pools for performance
        this.effectPools = {
            projectiles: [],
            hitEffects: [],
            particles: []
        };
        
        // Materials for effects
        this.materials = {};
        
        // Animation mixer for complex animations
        this.mixer = null;
        this.clock = new THREE.Clock();
    }

    async init() {
        console.log('Initializing Combat Visualizer...');
        
        // Create reusable materials for effects
        this.createMaterials();
        
        // Initialize particle system
        this.initializeParticleSystem();
        
        this.initialized = true;
        console.log('Combat Visualizer initialized');
    }

    createMaterials() {
        // Projectile materials
        this.materials.arrow = new THREE.MeshBasicMaterial({
            color: 0x8b4513,
            transparent: true,
            opacity: 0.9
        });
        
        this.materials.fireball = new THREE.MeshBasicMaterial({
            color: 0xff4500,
            transparent: true,
            opacity: 0.8,
            emissive: 0xff2200,
            emissiveIntensity: 0.3
        });
        
        this.materials.magic = new THREE.MeshBasicMaterial({
            color: 0x4facfe,
            transparent: true,
            opacity: 0.7,
            emissive: 0x0080ff,
            emissiveIntensity: 0.2
        });
        
        // Hit effect materials
        this.materials.hit = new THREE.MeshBasicMaterial({
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.materials.miss = new THREE.MeshBasicMaterial({
            color: 0xcccccc,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        
        this.materials.critical = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.9,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3,
            side: THREE.DoubleSide
        });
        
        // Particle materials
        this.materials.spark = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.materials.smoke = new THREE.PointsMaterial({
            color: 0x666666,
            size: 0.2,
            transparent: true,
            opacity: 0.4
        });
    }

    initializeParticleSystem() {
        // Create particle geometries
        this.particleGeometries = {
            spark: new THREE.BufferGeometry(),
            smoke: new THREE.BufferGeometry()
        };
        
        // Initialize particle positions
        const sparkPositions = new Float32Array(300); // 100 particles * 3 coordinates
        const smokePositions = new Float32Array(300);
        
        this.particleGeometries.spark.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
        this.particleGeometries.smoke.setAttribute('position', new THREE.BufferAttribute(smokePositions, 3));
    }

    // Combat effect creation methods
    playAttackEffect(attacker, target, attackType = 'melee') {
        console.log(`Playing attack effect: ${attackType}`);
        
        switch (attackType) {
            case 'melee':
                return this.createMeleeEffect(attacker, target);
            case 'ranged':
                return this.createRangedEffect(attacker, target);
            case 'magic':
                return this.createMagicEffect(attacker, target);
            default:
                return this.createMeleeEffect(attacker, target);
        }
    }

    createMeleeEffect(attacker, target) {
        // Create quick flash effect at target
        const effect = this.createFlashEffect(target.group.position, this.materials.hit);
        
        // Add camera shake
        this.createCameraShake(0.5, 200);
        
        return effect;
    }

    createRangedEffect(attacker, target) {
        // Create projectile
        const projectile = this.createProjectile(
            attacker.group.position,
            target.group.position,
            'arrow'
        );
        
        // Hit effect will be triggered when projectile reaches target
        return projectile;
    }

    createMagicEffect(attacker, target) {
        // Create magic projectile
        const projectile = this.createProjectile(
            attacker.group.position,
            target.group.position,
            'fireball'
        );
        
        // Add casting effect at attacker position
        this.createParticleEffect(attacker.group.position, 'magic_cast');
        
        return projectile;
    }

    createProjectile(startPos, targetPos, type) {
        let geometry, material;
        
        switch (type) {
            case 'arrow':
                geometry = new THREE.ConeGeometry(0.05, 0.3, 6);
                material = this.materials.arrow;
                break;
            case 'fireball':
                geometry = new THREE.SphereGeometry(0.1, 8, 8);
                material = this.materials.fireball;
                break;
            case 'magic':
                geometry = new THREE.OctahedronGeometry(0.08);
                material = this.materials.magic;
                break;
            default:
                geometry = new THREE.SphereGeometry(0.05);
                material = this.materials.arrow;
                break;
        }
        
        const projectile = new THREE.Mesh(geometry, material);
        projectile.position.copy(startPos);
        projectile.position.y += 1; // Start at unit height
        
        // Calculate direction and rotation
        const direction = new THREE.Vector3().subVectors(targetPos, startPos);
        direction.y = 0; // Keep horizontal
        direction.normalize();
        
        // Point projectile in direction of travel
        projectile.lookAt(targetPos.x, projectile.position.y, targetPos.z);
        
        this.scene.add(projectile);
        
        // Animate projectile
        const effect = {
            type: 'projectile',
            mesh: projectile,
            startPos: startPos.clone(),
            targetPos: targetPos.clone(),
            progress: 0,
            speed: 8.0, // units per second
            onComplete: () => {
                // Hit effect when projectile reaches target
                this.createHitEffect(targetPos);
                this.scene.remove(projectile);
                projectile.geometry.dispose();
            }
        };
        
        this.activeEffects.push(effect);
        return effect;
    }

    createHitEffect(position, isCritical = false, isMiss = false) {
        let material = this.materials.hit;
        let scale = 1.0;
        
        if (isCritical) {
            material = this.materials.critical;
            scale = 1.5;
        } else if (isMiss) {
            material = this.materials.miss;
            scale = 0.8;
        }
        
        // Create hit flash
        const flash = this.createFlashEffect(position, material, scale);
        
        // Create particle effect
        const particleType = isCritical ? 'critical_sparks' : isMiss ? 'dust' : 'hit_sparks';
        this.createParticleEffect(position, particleType);
        
        return flash;
    }

    createFlashEffect(position, material, scale = 1.0) {
        const geometry = new THREE.PlaneGeometry(1 * scale, 1 * scale);
        const flash = new THREE.Mesh(geometry, material.clone());
        
        flash.position.copy(position);
        flash.position.y += 1;
        flash.lookAt(this.scene.camera?.position || new THREE.Vector3(0, 10, 10));
        
        this.scene.add(flash);
        
        const effect = {
            type: 'flash',
            mesh: flash,
            duration: 300,
            startTime: Date.now(),
            onComplete: () => {
                this.scene.remove(flash);
                flash.geometry.dispose();
                flash.material.dispose();
            }
        };
        
        this.activeEffects.push(effect);
        return effect;
    }

    createParticleEffect(position, type, count = 20) {
        const particles = [];
        const particleGroup = new THREE.Group();
        
        for (let i = 0; i < count; i++) {
            let particle;
            
            switch (type) {
                case 'hit_sparks':
                    particle = this.createSparkParticle();
                    break;
                case 'critical_sparks':
                    particle = this.createCriticalSparkParticle();
                    break;
                case 'magic_cast':
                    particle = this.createMagicParticle();
                    break;
                case 'dust':
                    particle = this.createDustParticle();
                    break;
                default:
                    particle = this.createSparkParticle();
                    break;
            }
            
            if (particle) {
                particle.position.copy(position);
                particle.position.y += Math.random() * 2;
                
                // Random initial velocity
                particle.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 4,
                    Math.random() * 3 + 1,
                    (Math.random() - 0.5) * 4
                );
                
                particle.life = 1.0;
                particle.decay = 0.02 + Math.random() * 0.02;
                
                particleGroup.add(particle);
                particles.push(particle);
            }
        }
        
        this.scene.add(particleGroup);
        
        const effect = {
            type: 'particles',
            group: particleGroup,
            particles: particles,
            startTime: Date.now(),
            onComplete: () => {
                this.scene.remove(particleGroup);
                particles.forEach(p => {
                    if (p.geometry) p.geometry.dispose();
                    if (p.material) p.material.dispose();
                });
            }
        };
        
        this.activeEffects.push(effect);
        return effect;
    }

    createSparkParticle() {
        const geometry = new THREE.SphereGeometry(0.02, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        
        return new THREE.Mesh(geometry, material);
    }

    createCriticalSparkParticle() {
        const geometry = new THREE.SphereGeometry(0.03, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1.0,
            emissive: 0xffaa00,
            emissiveIntensity: 0.3
        });
        
        return new THREE.Mesh(geometry, material);
    }

    createMagicParticle() {
        const geometry = new THREE.OctahedronGeometry(0.02);
        const material = new THREE.MeshBasicMaterial({
            color: 0x4facfe,
            transparent: true,
            opacity: 0.7,
            emissive: 0x0080ff,
            emissiveIntensity: 0.2
        });
        
        return new THREE.Mesh(geometry, material);
    }

    createDustParticle() {
        const geometry = new THREE.PlaneGeometry(0.1, 0.1);
        const material = new THREE.MeshBasicMaterial({
            color: 0x8b7355,
            transparent: true,
            opacity: 0.3
        });
        
        return new THREE.Mesh(geometry, material);
    }

    createCameraShake(intensity = 1.0, duration = 500) {
        // This would shake the camera - placeholder for now
        console.log(`Camera shake: intensity ${intensity}, duration ${duration}ms`);
    }

    // Healing and buff effects
    playHealEffect(target) {
        const position = target.group.position;
        
        // Green upward particles
        this.createParticleEffect(position, 'heal', 15);
        
        // Gentle green glow
        const glow = this.createFlashEffect(position, new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.4
        }));
        
        return glow;
    }

    playBuffEffect(target, buffType) {
        const position = target.group.position;
        let color = 0x4facfe;
        
        switch (buffType) {
            case 'attack':
                color = 0xff4500;
                break;
            case 'defense':
                color = 0x0080ff;
                break;
            case 'speed':
                color = 0x00ff00;
                break;
        }
        
        // Upward spiral effect
        this.createSpiralEffect(position, color);
    }

    createSpiralEffect(position, color) {
        const particleCount = 12;
        const particles = [];
        const group = new THREE.Group();
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.SphereGeometry(0.02, 4, 4);
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.8
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.userData.angle = (i / particleCount) * Math.PI * 2;
            particle.userData.height = 0;
            particle.userData.radius = 0.5;
            
            particles.push(particle);
            group.add(particle);
        }
        
        group.position.copy(position);
        this.scene.add(group);
        
        const effect = {
            type: 'spiral',
            group: group,
            particles: particles,
            startTime: Date.now(),
            duration: 2000,
            onComplete: () => {
                this.scene.remove(group);
                particles.forEach(p => {
                    p.geometry.dispose();
                    p.material.dispose();
                });
            }
        };
        
        this.activeEffects.push(effect);
        return effect;
    }

    // Area of effect visualization
    showAOEPreview(center, radius, color = 0xff6b6b) {
        const geometry = new THREE.CircleGeometry(radius, 32);
        const material = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        
        const aoeIndicator = new THREE.Mesh(geometry, material);
        aoeIndicator.position.copy(center);
        aoeIndicator.position.y = 0.1;
        aoeIndicator.rotation.x = -Math.PI / 2;
        
        this.scene.add(aoeIndicator);
        
        // Pulsing animation
        const effect = {
            type: 'aoe_preview',
            mesh: aoeIndicator,
            startTime: Date.now(),
            onComplete: () => {
                this.scene.remove(aoeIndicator);
                aoeIndicator.geometry.dispose();
                aoeIndicator.material.dispose();
            }
        };
        
        this.activeEffects.push(effect);
        return effect;
    }

    hideAOEPreview(effect) {
        if (effect && effect.mesh) {
            this.scene.remove(effect.mesh);
            effect.mesh.geometry.dispose();
            effect.mesh.material.dispose();
            
            const index = this.activeEffects.indexOf(effect);
            if (index >= 0) {
                this.activeEffects.splice(index, 1);
            }
        }
    }

    // Update method - called every frame
    update(deltaTime) {
        if (!this.initialized) return;
        
        const currentTime = Date.now();
        
        // Update active effects
        for (let i = this.activeEffects.length - 1; i >= 0; i--) {
            const effect = this.activeEffects[i];
            let shouldRemove = false;
            
            switch (effect.type) {
                case 'projectile':
                    shouldRemove = this.updateProjectile(effect, deltaTime);
                    break;
                case 'flash':
                    shouldRemove = this.updateFlash(effect, currentTime);
                    break;
                case 'particles':
                    shouldRemove = this.updateParticles(effect, deltaTime);
                    break;
                case 'spiral':
                    shouldRemove = this.updateSpiral(effect, currentTime);
                    break;
                case 'aoe_preview':
                    shouldRemove = this.updateAOEPreview(effect, currentTime);
                    break;
            }
            
            if (shouldRemove) {
                if (effect.onComplete) {
                    effect.onComplete();
                }
                this.activeEffects.splice(i, 1);
            }
        }
    }

    updateProjectile(effect, deltaTime) {
        const distance = effect.startPos.distanceTo(effect.targetPos);
        const speed = effect.speed * deltaTime * 0.001;
        
        effect.progress += speed / distance;
        
        if (effect.progress >= 1) {
            return true; // Remove effect
        }
        
        // Update position
        effect.mesh.position.lerpVectors(effect.startPos, effect.targetPos, effect.progress);
        effect.mesh.position.y += 1; // Keep at unit height
        
        return false;
    }

    updateFlash(effect, currentTime) {
        const elapsed = currentTime - effect.startTime;
        const progress = elapsed / effect.duration;
        
        if (progress >= 1) {
            return true; // Remove effect
        }
        
        // Fade out
        const opacity = 1 - progress;
        effect.mesh.material.opacity = opacity;
        
        // Scale up slightly
        const scale = 1 + progress * 0.5;
        effect.mesh.scale.setScalar(scale);
        
        return false;
    }

    updateParticles(effect, deltaTime) {
        let allDead = true;
        
        effect.particles.forEach(particle => {
            if (particle.life > 0) {
                allDead = false;
                
                // Update position
                particle.position.add(particle.velocity.clone().multiplyScalar(deltaTime * 0.001));
                
                // Apply gravity
                particle.velocity.y -= 9.8 * deltaTime * 0.001;
                
                // Update life
                particle.life -= particle.decay;
                particle.material.opacity = particle.life;
                
                // Scale down over time
                const scale = particle.life;
                particle.scale.setScalar(scale);
            }
        });
        
        return allDead;
    }

    updateSpiral(effect, currentTime) {
        const elapsed = currentTime - effect.startTime;
        const progress = elapsed / effect.duration;
        
        if (progress >= 1) {
            return true; // Remove effect
        }
        
        effect.particles.forEach((particle, index) => {
            particle.userData.height = progress * 3;
            particle.userData.angle += 0.1;
            
            const x = Math.cos(particle.userData.angle) * particle.userData.radius;
            const z = Math.sin(particle.userData.angle) * particle.userData.radius;
            
            particle.position.set(x, particle.userData.height, z);
            particle.material.opacity = 1 - progress;
        });
        
        return false;
    }

    updateAOEPreview(effect, currentTime) {
        // Pulsing animation
        const pulse = Math.sin(currentTime * 0.005) * 0.2 + 0.5;
        effect.mesh.material.opacity = 0.2 + pulse * 0.2;
        
        return false; // AOE previews are manually removed
    }

    // Cleanup
    cleanup() {
        // Remove all active effects
        this.activeEffects.forEach(effect => {
            if (effect.onComplete) {
                effect.onComplete();
            }
        });
        this.activeEffects = [];
        
        // Dispose of materials
        Object.values(this.materials).forEach(material => {
            material.dispose();
        });
        
        // Dispose of geometries
        Object.values(this.particleGeometries).forEach(geometry => {
            geometry.dispose();
        });
    }

    destroy() {
        this.cleanup();
        this.initialized = false;
        console.log('Combat Visualizer destroyed');
    }
}