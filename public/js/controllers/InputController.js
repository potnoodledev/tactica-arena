/**
 * InputController - Handles user input for unit selection, movement, and combat
 * 
 * Manages mouse and keyboard interactions for tactical gameplay including:
 * - Unit selection via clicking
 * - Movement commands and previews
 * - Attack targeting and execution
 * - Action mode switching
 */

import * as THREE from 'three';

export class InputController {
    constructor(camera, battleScene) {
        this.camera = camera;
        this.battleScene = battleScene;
        
        // Raycasting for mouse picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Input state
        this.enabled = true;
        this.currentAction = 'SELECT'; // 'SELECT', 'MOVE', 'ATTACK', 'ABILITY'
        this.selectedUnit = null;
        
        // Interaction callbacks
        this.onUnitSelected = null;
        this.onUnitDeselected = null;
        this.onMovePreview = null;
        this.onAttackPreview = null;
        this.onActionExecuted = null;
        
        // Visual feedback
        this.hoveredUnit = null;
        this.targetPosition = null;
        
        // Bind methods
        this.onClick = this.onClick.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        
        // DOM element for event listening
        this.domElement = null;
    }

    init() {
        console.log('Initializing Input Controller...');
        
        // Get canvas element for event listening
        this.domElement = document.getElementById('game-canvas');
        if (!this.domElement) {
            console.error('Game canvas not found for input controller');
            return;
        }
        
        // Add event listeners
        this.addEventListeners();
        
        console.log('Input Controller initialized');
    }

    addEventListeners() {
        if (!this.domElement) return;
        
        this.domElement.addEventListener('click', this.onClick);
        this.domElement.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('keydown', this.onKeyDown);
        
        // Prevent context menu on canvas
        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    removeEventListeners() {
        if (!this.domElement) return;
        
        this.domElement.removeEventListener('click', this.onClick);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('keydown', this.onKeyDown);
    }

    onClick(event) {
        if (!this.enabled) return;
        
        // Prevent camera controls from interfering
        if (event.button !== 0) return; // Only left mouse button
        if (event.ctrlKey || event.shiftKey) return; // Camera control modifiers
        
        event.preventDefault();
        
        // Calculate mouse position in normalized device coordinates
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Perform raycast
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Handle click based on current action mode
        switch (this.currentAction) {
            case 'SELECT':
                this.handleSelectClick();
                break;
            case 'MOVE':
                this.handleMoveClick();
                break;
            case 'ATTACK':
                this.handleAttackClick();
                break;
            case 'ABILITY':
                this.handleAbilityClick();
                break;
        }
    }

    onMouseMove(event) {
        if (!this.enabled) return;
        
        // Calculate mouse position for hover effects
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Handle hover based on current action
        this.handleMouseHover();
    }

    onKeyDown(event) {
        if (!this.enabled) return;
        
        // Handle keyboard shortcuts
        switch (event.code) {
            case 'Escape':
                this.cancelCurrentAction();
                break;
            case 'KeyM':
                if (this.selectedUnit) {
                    this.setActionMode('MOVE');
                }
                break;
            case 'KeyA':
                if (this.selectedUnit) {
                    this.setActionMode('ATTACK');
                }
                break;
            case 'Space':
                // Handled by main game controller
                break;
        }
    }

    handleSelectClick() {
        // Try to select a unit
        const intersectedUnit = this.getIntersectedUnit();
        
        if (intersectedUnit) {
            this.selectUnit(intersectedUnit);
        } else {
            // Clicked on empty space, deselect
            this.deselectUnit();
        }
    }

    handleMoveClick() {
        if (!this.selectedUnit) {
            this.setActionMode('SELECT');
            return;
        }
        
        // Get world position of click
        const worldPosition = this.getIntersectedGroundPosition();
        if (!worldPosition) return;
        
        // Convert to grid position
        const gridPosition = this.battleScene.getGridPosition(worldPosition);
        
        // Validate movement
        if (this.isValidMoveTarget(gridPosition)) {
            this.executeMoveAction(gridPosition);
        }
    }

    handleAttackClick() {
        if (!this.selectedUnit) {
            this.setActionMode('SELECT');
            return;
        }
        
        // Try to attack a unit
        const targetUnit = this.getIntersectedUnit();
        
        if (targetUnit && this.isValidAttackTarget(targetUnit)) {
            this.executeAttackAction(targetUnit);
        }
    }

    handleAbilityClick() {
        if (!this.selectedUnit) {
            this.setActionMode('SELECT');
            return;
        }
        
        // Handle ability targeting (simplified for now)
        const targetUnit = this.getIntersectedUnit();
        const worldPosition = this.getIntersectedGroundPosition();
        
        if (targetUnit) {
            this.executeAbilityAction(targetUnit);
        } else if (worldPosition) {
            const gridPosition = this.battleScene.getGridPosition(worldPosition);
            this.executeAbilityAction(null, gridPosition);
        }
    }

    handleMouseHover() {
        const intersectedUnit = this.getIntersectedUnit();
        
        // Update hovered unit
        if (this.hoveredUnit !== intersectedUnit) {
            if (this.hoveredUnit) {
                // Remove hover effect from previous unit
                this.hoveredUnit.setHighlighted(false);
            }
            
            this.hoveredUnit = intersectedUnit;
            
            if (this.hoveredUnit && this.hoveredUnit !== this.selectedUnit) {
                // Add hover effect to new unit
                this.hoveredUnit.setHighlighted(true);
            }
        }
        
        // Update cursor based on action mode and hover target
        this.updateCursor();
        
        // Show preview based on current action
        if (this.currentAction === 'MOVE' && this.selectedUnit) {
            const worldPosition = this.getIntersectedGroundPosition();
            if (worldPosition && this.onMovePreview) {
                const gridPosition = this.battleScene.getGridPosition(worldPosition);
                this.onMovePreview(this.selectedUnit, gridPosition);
            }
        } else if (this.currentAction === 'ATTACK' && this.selectedUnit && this.hoveredUnit) {
            if (this.isValidAttackTarget(this.hoveredUnit) && this.onAttackPreview) {
                this.onAttackPreview(this.selectedUnit, this.hoveredUnit);
            }
        }
    }

    getIntersectedUnit() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Get all unit meshes for intersection testing
        const unitMeshes = [];
        for (const unit3D of this.battleScene.units.values()) {
            if (unit3D.mesh && unit3D.group.visible) {
                unitMeshes.push(unit3D.mesh);
                unit3D.mesh.userData.unit3D = unit3D; // Store reference
            }
        }
        
        const intersects = this.raycaster.intersectObjects(unitMeshes);
        
        if (intersects.length > 0) {
            return intersects[0].object.userData.unit3D;
        }
        
        return null;
    }

    getIntersectedGroundPosition() {
        this.raycaster.setFromCamera(this.mouse, this.camera);
        
        // Create a large invisible plane to catch ground clicks
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersectionPoint = new THREE.Vector3();
        
        if (this.raycaster.ray.intersectPlane(groundPlane, intersectionPoint)) {
            return intersectionPoint;
        }
        
        return null;
    }

    selectUnit(unit3D) {
        // Deselect previous unit
        if (this.selectedUnit) {
            this.selectedUnit.setSelected(false);
            this.battleScene.clearSelection();
        }
        
        this.selectedUnit = unit3D;
        
        if (unit3D) {
            unit3D.setSelected(true);
            this.battleScene.selectUnit(unit3D);
            
            // Callback to update UI
            if (this.onUnitSelected) {
                this.onUnitSelected(unit3D);
            }
        }
        
        // Reset to select mode after selecting
        this.setActionMode('SELECT');
    }

    deselectUnit() {
        if (this.selectedUnit) {
            this.selectedUnit.setSelected(false);
            this.selectedUnit = null;
            this.battleScene.clearSelection();
            
            if (this.onUnitDeselected) {
                this.onUnitDeselected();
            }
        }
        
        this.setActionMode('SELECT');
    }

    setActionMode(mode) {
        this.currentAction = mode;
        
        // Clear visual overlays when changing modes
        if (mode !== 'MOVE') {
            this.battleScene.hideMovementRange();
        }
        if (mode !== 'ATTACK') {
            this.battleScene.hideAttackRange();
        }
        
        // Show appropriate overlays for new mode
        if (mode === 'MOVE' && this.selectedUnit) {
            this.battleScene.showMovementRange(this.selectedUnit);
        } else if (mode === 'ATTACK' && this.selectedUnit) {
            this.battleScene.showAttackRange(this.selectedUnit);
        }
        
        this.updateCursor();
    }

    cancelCurrentAction() {
        this.setActionMode('SELECT');
        
        // Clear any active previews
        this.battleScene.hideMovementRange();
        this.battleScene.hideAttackRange();
    }

    updateCursor() {
        if (!this.domElement) return;
        
        let cursor = 'default';
        
        switch (this.currentAction) {
            case 'SELECT':
                cursor = this.hoveredUnit ? 'pointer' : 'default';
                break;
            case 'MOVE':
                cursor = 'move';
                break;
            case 'ATTACK':
                cursor = (this.hoveredUnit && this.isValidAttackTarget(this.hoveredUnit)) ? 'crosshair' : 'not-allowed';
                break;
            case 'ABILITY':
                cursor = 'crosshair';
                break;
        }
        
        this.domElement.style.cursor = cursor;
    }

    // Validation methods
    isValidMoveTarget(gridPosition) {
        if (!this.selectedUnit) return false;
        
        // Check if position is within movement range
        const unitPos = this.selectedUnit.unitData.position;
        const distance = Math.abs(gridPosition.x - unitPos.x) + Math.abs(gridPosition.y - unitPos.y);
        const moveRange = this.selectedUnit.unitData.stats.MOV;
        
        if (distance > moveRange) return false;
        
        // Check if position is valid and passable
        if (!this.battleScene.isValidGridPosition(gridPosition.x, gridPosition.y)) return false;
        
        const terrain = this.battleScene.terrain.getTerrainAt(gridPosition.x, gridPosition.y);
        if (!terrain || !this.battleScene.terrain.isPassable(gridPosition.x, gridPosition.y)) return false;
        
        // Check if position is occupied by another unit
        const occupyingUnit = this.getUnitAtGridPosition(gridPosition);
        if (occupyingUnit && occupyingUnit !== this.selectedUnit) return false;
        
        return true;
    }

    isValidAttackTarget(targetUnit) {
        if (!this.selectedUnit || !targetUnit) return false;
        if (targetUnit === this.selectedUnit) return false;
        if (targetUnit.unitData.isIncapacitated) return false;
        
        // Check if target is enemy (different team)
        if (targetUnit.unitData.teamColor === this.selectedUnit.unitData.teamColor) return false;
        
        // Check attack range
        const attackerPos = this.selectedUnit.unitData.position;
        const targetPos = targetUnit.unitData.position;
        const distance = Math.max(
            Math.abs(attackerPos.x - targetPos.x),
            Math.abs(attackerPos.y - targetPos.y)
        );
        
        if (distance > this.selectedUnit.unitData.stats.RNG) return false;
        
        // TODO: Check line of sight
        
        return true;
    }

    getUnitAtGridPosition(gridPosition) {
        for (const unit3D of this.battleScene.units.values()) {
            const unitPos = unit3D.unitData.position;
            if (unitPos.x === gridPosition.x && unitPos.y === gridPosition.y) {
                return unit3D;
            }
        }
        return null;
    }

    // Action execution methods
    executeMoveAction(gridPosition) {
        if (!this.selectedUnit || !this.isValidMoveTarget(gridPosition)) return;
        
        // Update unit position
        this.selectedUnit.unitData.position = { x: gridPosition.x, y: gridPosition.y };
        
        // Animate unit movement
        this.selectedUnit.setPosition(gridPosition.x, gridPosition.y, true);
        
        // Execute action through callback
        if (this.onActionExecuted) {
            this.onActionExecuted({
                type: 'MOVE',
                unit: this.selectedUnit,
                target: gridPosition,
                description: `${this.selectedUnit.unitData.name} moves to (${gridPosition.x}, ${gridPosition.y})`
            });
        }
        
        // Return to select mode
        this.setActionMode('SELECT');
    }

    executeAttackAction(targetUnit) {
        if (!this.selectedUnit || !this.isValidAttackTarget(targetUnit)) return;
        
        // Play attack animation
        this.selectedUnit.playAttackAnimation(targetUnit);
        
        // Simulate damage (simplified)
        const damage = Math.floor(Math.random() * 20) + 10;
        targetUnit.unitData.currentHP = Math.max(0, targetUnit.unitData.currentHP - damage);
        
        // Update target unit
        targetUnit.updateUnitData({ currentHP: targetUnit.unitData.currentHP });
        
        // Execute action through callback
        if (this.onActionExecuted) {
            this.onActionExecuted({
                type: 'ATTACK',
                unit: this.selectedUnit,
                target: targetUnit,
                damage: damage,
                description: `${this.selectedUnit.unitData.name} attacks ${targetUnit.unitData.name} for ${damage} damage`
            });
        }
        
        // Return to select mode
        this.setActionMode('SELECT');
    }

    executeAbilityAction(target, position) {
        if (!this.selectedUnit) return;
        
        // Simplified ability execution
        let description = `${this.selectedUnit.unitData.name} uses ability`;
        
        if (target) {
            description += ` on ${target.unitData.name}`;
        } else if (position) {
            description += ` at (${position.x}, ${position.y})`;
        }
        
        if (this.onActionExecuted) {
            this.onActionExecuted({
                type: 'ABILITY',
                unit: this.selectedUnit,
                target: target,
                position: position,
                description: description
            });
        }
        
        // Return to select mode
        this.setActionMode('SELECT');
    }

    // Update method
    update(deltaTime) {
        // Handle any frame-based input processing if needed
        // For now, most input is event-driven
    }

    // Utility methods
    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    reset() {
        this.selectedUnit = null;
        this.hoveredUnit = null;
        this.currentAction = 'SELECT';
        
        if (this.domElement) {
            this.domElement.style.cursor = 'default';
        }
    }

    // Cleanup
    destroy() {
        this.removeEventListeners();
        this.enabled = false;
        console.log('Input Controller destroyed');
    }
}