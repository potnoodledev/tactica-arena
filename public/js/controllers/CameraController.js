/**
 * CameraController - 3D Camera Control System
 * 
 * Provides smooth camera controls for the tactical view including:
 * - Orbital rotation around target
 * - Zoom in/out with limits
 * - Panning with WASD keys
 * - Smooth interpolated movements
 * - Automatic focus on selected units
 */

import * as THREE from 'three';

export class CameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Camera control state
        this.enabled = true;
        this.target = new THREE.Vector3(18, 0, 18); // Center of 18x18 map by default
        this.minDistance = 10;
        this.maxDistance = 100;
        this.minPolarAngle = 0.1; // Near top-down minimum
        this.maxPolarAngle = Math.PI * 0.45; // Prevent going below ground
        
        // Current spherical coordinates
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        
        // Movement speeds
        this.rotateSpeed = 1.0;
        this.zoomSpeed = 2.0;
        this.panSpeed = 2.0;
        this.keyboardSpeed = 5.0;
        
        // Damping (smoothing)
        this.enableDamping = true;
        this.dampingFactor = 0.1;
        
        // Auto-rotation
        this.autoRotate = false;
        this.autoRotateSpeed = 2.0;
        
        // State tracking
        this.state = {
            NONE: 0,
            ROTATE: 1,
            PAN: 2,
            ZOOM: 3
        };
        this.currentState = this.state.NONE;
        
        // Mouse state
        this.mouse = {
            start: new THREE.Vector2(),
            end: new THREE.Vector2(),
            delta: new THREE.Vector2()
        };
        
        // Touch state (for mobile support)
        this.touch = {
            start: new THREE.Vector2(),
            end: new THREE.Vector2(),
            delta: new THREE.Vector2()
        };
        
        // Keyboard state
        this.keys = {
            UP: false,
            DOWN: false,
            LEFT: false,
            RIGHT: false,
            SHIFT: false
        };
        
        // Key mappings
        this.keyMap = {
            'KeyW': 'UP',
            'KeyS': 'DOWN',
            'KeyA': 'LEFT',
            'KeyD': 'RIGHT',
            'ArrowUp': 'UP',
            'ArrowDown': 'DOWN',
            'ArrowLeft': 'LEFT',
            'ArrowRight': 'RIGHT',
            'ShiftLeft': 'SHIFT',
            'ShiftRight': 'SHIFT'
        };
        
        // Animation targets
        this.targetSphericl = new THREE.Spherical();
        this.targetPosition = new THREE.Vector3();
        this.isAnimating = false;
        
        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onMouseWheel = this.onMouseWheel.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);
        
        // Working vectors (reused for performance)
        this.panOffset = new THREE.Vector3();
        this.offset = new THREE.Vector3();
    }

    init() {
        console.log('Initializing Camera Controller...');
        
        // Set initial camera position based on current position
        this.offset.copy(this.camera.position).sub(this.target);
        this.spherical.setFromVector3(this.offset);
        this.targetSphericl.copy(this.spherical);
        
        // Add event listeners
        this.addEventListeners();
        
        console.log('Camera Controller initialized');
    }

    addEventListeners() {
        if (!this.domElement) return;
        
        // Mouse events
        this.domElement.addEventListener('contextmenu', this.onContextMenu);
        this.domElement.addEventListener('mousedown', this.onMouseDown);
        this.domElement.addEventListener('mousemove', this.onMouseMove);
        this.domElement.addEventListener('mouseup', this.onMouseUp);
        this.domElement.addEventListener('wheel', this.onMouseWheel);
        
        // Keyboard events (on document to catch all keys)
        document.addEventListener('keydown', this.onKeyDown);
        document.addEventListener('keyup', this.onKeyUp);
        
        // Touch events (for mobile support)
        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Prevent context menu
        this.domElement.style.touchAction = 'none';
    }

    removeEventListeners() {
        if (!this.domElement) return;
        
        this.domElement.removeEventListener('contextmenu', this.onContextMenu);
        this.domElement.removeEventListener('mousedown', this.onMouseDown);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.domElement.removeEventListener('mouseup', this.onMouseUp);
        this.domElement.removeEventListener('wheel', this.onMouseWheel);
        
        document.removeEventListener('keydown', this.onKeyDown);
        document.removeEventListener('keyup', this.onKeyUp);
        
        this.domElement.removeEventListener('touchstart', this.onTouchStart);
        this.domElement.removeEventListener('touchmove', this.onTouchMove);
        this.domElement.removeEventListener('touchend', this.onTouchEnd);
    }

    // Event Handlers
    onContextMenu(event) {
        event.preventDefault();
    }

    onMouseDown(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        this.mouse.start.set(event.clientX, event.clientY);
        
        if (event.button === 2 || event.ctrlKey) {
            // Right mouse button or Ctrl+Left for rotation
            this.currentState = this.state.ROTATE;
        } else if (event.button === 1 || event.shiftKey) {
            // Middle mouse button or Shift+Left for panning
            this.currentState = this.state.PAN;
        }
        
        document.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('mouseup', this.onMouseUp);
    }

    onMouseMove(event) {
        if (!this.enabled) return;
        
        this.mouse.end.set(event.clientX, event.clientY);
        this.mouse.delta.subVectors(this.mouse.end, this.mouse.start);
        
        const element = this.domElement;
        
        if (this.currentState === this.state.ROTATE) {
            // Rotate around target
            this.sphericalDelta.theta -= 2 * Math.PI * this.mouse.delta.x / element.clientHeight * this.rotateSpeed;
            this.sphericalDelta.phi -= 2 * Math.PI * this.mouse.delta.y / element.clientHeight * this.rotateSpeed;
            
        } else if (this.currentState === this.state.PAN) {
            // Pan in screen space
            this.pan(this.mouse.delta.x, this.mouse.delta.y);
        }
        
        this.mouse.start.copy(this.mouse.end);
    }

    onMouseUp(event) {
        if (!this.enabled) return;
        
        this.currentState = this.state.NONE;
        
        document.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('mouseup', this.onMouseUp);
    }

    onMouseWheel(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        // Normalize wheel delta across browsers
        let delta = 0;
        if (event.wheelDelta !== undefined) {
            delta = event.wheelDelta;
        } else if (event.detail !== undefined) {
            delta = -event.detail;
        }
        
        if (delta > 0) {
            this.zoomIn();
        } else if (delta < 0) {
            this.zoomOut();
        }
    }

    onKeyDown(event) {
        if (!this.enabled) return;
        
        const key = this.keyMap[event.code];
        if (key) {
            this.keys[key] = true;
            event.preventDefault();
        }
    }

    onKeyUp(event) {
        if (!this.enabled) return;
        
        const key = this.keyMap[event.code];
        if (key) {
            this.keys[key] = false;
            event.preventDefault();
        }
    }

    // Touch Events
    onTouchStart(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        const touch = event.touches[0];
        this.touch.start.set(touch.clientX, touch.clientY);
        
        if (event.touches.length === 1) {
            this.currentState = this.state.ROTATE;
        } else if (event.touches.length === 2) {
            this.currentState = this.state.ZOOM;
            // Store initial distance for pinch zoom
            const touch2 = event.touches[1];
            this.touchZoomDistanceStart = Math.sqrt(
                Math.pow(touch.clientX - touch2.clientX, 2) +
                Math.pow(touch.clientY - touch2.clientY, 2)
            );
        }
    }

    onTouchMove(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        const touch = event.touches[0];
        this.touch.end.set(touch.clientX, touch.clientY);
        this.touch.delta.subVectors(this.touch.end, this.touch.start);
        
        if (this.currentState === this.state.ROTATE && event.touches.length === 1) {
            this.sphericalDelta.theta -= 2 * Math.PI * this.touch.delta.x / window.innerHeight * this.rotateSpeed;
            this.sphericalDelta.phi -= 2 * Math.PI * this.touch.delta.y / window.innerHeight * this.rotateSpeed;
        } else if (this.currentState === this.state.ZOOM && event.touches.length === 2) {
            const touch2 = event.touches[1];
            const distance = Math.sqrt(
                Math.pow(touch.clientX - touch2.clientX, 2) +
                Math.pow(touch.clientY - touch2.clientY, 2)
            );
            
            if (distance > this.touchZoomDistanceStart) {
                this.zoomIn();
            } else {
                this.zoomOut();
            }
            
            this.touchZoomDistanceStart = distance;
        }
        
        this.touch.start.copy(this.touch.end);
    }

    onTouchEnd(event) {
        if (!this.enabled) return;
        
        this.currentState = this.state.NONE;
    }

    // Camera Movement Functions
    zoomIn() {
        this.spherical.radius /= Math.pow(0.95, this.zoomSpeed);
        this.spherical.radius = Math.max(this.minDistance, this.spherical.radius);
    }

    zoomOut() {
        this.spherical.radius *= Math.pow(0.95, this.zoomSpeed);
        this.spherical.radius = Math.min(this.maxDistance, this.spherical.radius);
    }

    pan(deltaX, deltaY) {
        const element = this.domElement;
        
        // Calculate pan vectors in camera space
        const offset = this.offset.copy(this.camera.position).sub(this.target);
        const targetDistance = offset.length();
        
        // Half of the fov is center to top of screen
        targetDistance *= Math.tan((this.camera.fov / 2) * Math.PI / 180.0);
        
        // Scale pan by distance
        const panX = 2 * deltaX * targetDistance / element.clientHeight;
        const panY = 2 * deltaY * targetDistance / element.clientHeight;
        
        // Calculate camera-relative directions
        const cameraMatrix = this.camera.matrix;
        const cameraRight = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0);
        const cameraUp = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 1);
        
        this.panOffset.copy(cameraRight).multiplyScalar(-panX);
        this.panOffset.addScaledVector(cameraUp, panY);
        
        this.target.add(this.panOffset);
    }

    handleKeyboardInput(deltaTime) {
        if (!this.enabled) return;
        
        const moveSpeed = this.keyboardSpeed * deltaTime * 0.001;
        const panVector = new THREE.Vector3();
        
        // Calculate camera-relative directions
        const cameraMatrix = this.camera.matrix;
        const forward = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 2).multiplyScalar(-1);
        const right = new THREE.Vector3().setFromMatrixColumn(cameraMatrix, 0);
        
        // Project onto horizontal plane
        forward.y = 0;
        forward.normalize();
        right.y = 0;
        right.normalize();
        
        // Apply keyboard input
        if (this.keys.UP) panVector.add(forward);
        if (this.keys.DOWN) panVector.sub(forward);
        if (this.keys.RIGHT) panVector.add(right);
        if (this.keys.LEFT) panVector.sub(right);
        
        if (panVector.length() > 0) {
            panVector.normalize().multiplyScalar(moveSpeed);
            this.target.add(panVector);
        }
    }

    // Focus and animation methods
    focusOnPosition(position, duration = 1000) {
        if (this.isAnimating) return;
        
        const targetPosition = position.clone();
        targetPosition.y = 0; // Keep target at ground level
        
        this.animateToTarget(targetPosition, duration);
    }

    focusOnUnit(unit3D, duration = 1000) {
        const unitPosition = unit3D.group.position.clone();
        unitPosition.y = 0;
        
        this.focusOnPosition(unitPosition, duration);
    }

    animateToTarget(newTarget, duration = 1000) {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        
        const startTarget = this.target.clone();
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Smooth easing function
            const easeProgress = this.easeInOutCubic(progress);
            
            this.target.lerpVectors(startTarget, newTarget, easeProgress);
            
            if (progress >= 1) {
                this.isAnimating = false;
                return;
            }
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
    }

    // Update method called every frame
    update(deltaTime) {
        if (!this.enabled) return;
        
        // Handle keyboard input
        this.handleKeyboardInput(deltaTime);
        
        // Apply auto-rotation
        if (this.autoRotate && this.currentState === this.state.NONE) {
            this.sphericalDelta.theta -= 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
        }
        
        // Apply spherical deltas
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        
        // Apply constraints
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));
        
        // Convert spherical to cartesian coordinates
        this.offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.target).add(this.offset);
        this.camera.lookAt(this.target);
        
        // Apply damping
        if (this.enableDamping) {
            this.sphericalDelta.theta *= (1 - this.dampingFactor);
            this.sphericalDelta.phi *= (1 - this.dampingFactor);
            
            // Stop very small movements
            if (Math.abs(this.sphericalDelta.theta) < 0.001 && Math.abs(this.sphericalDelta.phi) < 0.001) {
                this.sphericalDelta.theta = 0;
                this.sphericalDelta.phi = 0;
            }
        } else {
            this.sphericalDelta.set(0, 0, 0);
        }
    }

    // Configuration methods
    setTarget(target) {
        this.target.copy(target);
    }

    setDistance(distance) {
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, distance));
    }

    setAngle(theta, phi) {
        this.spherical.theta = theta;
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));
    }

    // Utility methods
    getDistance() {
        return this.spherical.radius;
    }

    getTarget() {
        return this.target.clone();
    }

    reset() {
        this.spherical.set(30, Math.PI / 4, 30);
        this.sphericalDelta.set(0, 0, 0);
        this.target.set(18, 0, 18);
        this.currentState = this.state.NONE;
    }

    // Enable/disable controls
    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
        this.currentState = this.state.NONE;
    }

    // Cleanup
    destroy() {
        this.removeEventListeners();
        this.enabled = false;
        console.log('Camera Controller destroyed');
    }
}