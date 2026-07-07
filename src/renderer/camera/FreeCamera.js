import * as THREE from 'three';

// FreeCamera: WASD horizontal, Q/E vertical, right-click drag to look, wheel zoom
class FreeCamera extends THREE.PerspectiveCamera {
  constructor(fov, aspect, near, far) {
    super(fov, aspect, near, far);

    this._euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this._direction = new THREE.Vector3();
    this._right = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);

    // Default position
    this.position.set(0, 2, 5);
    this.lookAt(0, 0, 0);

    // Sensitivity
    this.moveSpeed = 5;
    this.lookSpeed = 0.002;
    this.zoomSpeed = 0.1;

    this._isLooking = false;
  }

  update(inputManager, canvas, delta) {
    const dt = Math.min(delta || 0.016, 0.1);

    // Right-click look
    if (inputManager.rightDrag) {
      const mouseDelta = inputManager.getMouseDelta();
      this._euler.setFromQuaternion(this.quaternion);
      this._euler.y -= mouseDelta.x * this.lookSpeed;
      this._euler.x -= mouseDelta.y * this.lookSpeed;
      this._euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this._euler.x));
      this.quaternion.setFromEuler(this._euler);
    }

    // Movement direction
    this._direction.set(0, 0, -1).applyQuaternion(this.quaternion);
    this._right.set(1, 0, 0).applyQuaternion(this.quaternion);

    // WASD movement
    const speed = this.moveSpeed * dt;
    if (inputManager.isKeyDown('w')) {
      this.position.addScaledVector(this._direction, speed);
    }
    if (inputManager.isKeyDown('s')) {
      this.position.addScaledVector(this._direction, -speed);
    }
    if (inputManager.isKeyDown('a')) {
      this.position.addScaledVector(this._right, -speed);
    }
    if (inputManager.isKeyDown('d')) {
      this.position.addScaledVector(this._right, speed);
    }
    if (inputManager.isKeyDown('q')) {
      this.position.y -= speed;
    }
    if (inputManager.isKeyDown('e')) {
      this.position.y += speed;
    }

    // Wheel zoom
    const wheel = inputManager.getWheel();
    if (wheel !== 0) {
      this.position.addScaledVector(this._direction, wheel * this.zoomSpeed * 0.1);
    }
  }

  focusOn(box) {
    const center = new THREE.Vector3();
    box.getCenter(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);

    this.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 2);
    this.lookAt(center);
  }
}

export default FreeCamera;
