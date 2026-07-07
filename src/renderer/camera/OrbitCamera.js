import * as THREE from 'three';

// OrbitCamera: right-click drag to orbit, wheel zoom
class OrbitCamera extends THREE.PerspectiveCamera {
  constructor(fov, aspect, near, far) {
    super(fov, aspect, near, far);

    this._target = new THREE.Vector3(0, 0, 0);
    this._spherical = new THREE.Spherical();

    // Default position
    this.position.set(3, 2, 5);
    this.lookAt(this._target);

    this._updateSpherical();

    // Sensitivity
    this.orbitSpeed = 0.005;
    this.zoomSpeed = 0.1;
    this.minDistance = 0.1;
    this.maxDistance = 100;

    this._isOrbiting = false;
  }

  _updateSpherical() {
    const offset = new THREE.Vector3().copy(this.position).sub(this._target);
    this._spherical.setFromVector3(offset);
  }

  setTarget(target) {
    this._target.copy(target);
  }

  update(inputManager, canvas) {
    // Right-click orbit
    if (inputManager.rightDrag) {
      const delta = inputManager.getMouseDelta();
      if (Math.abs(delta.x) > 0 || Math.abs(delta.y) > 0) {
        this._spherical.theta -= delta.x * this.orbitSpeed;
        this._spherical.phi -= delta.y * this.orbitSpeed;

        // Clamp phi to prevent flipping
        this._spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, this._spherical.phi));
      }
    }

    // Wheel zoom
    const wheel = inputManager.getWheel();
    if (wheel !== 0) {
      this._spherical.radius += wheel * this.zoomSpeed * 0.01;
      this._spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this._spherical.radius));
    }

    // Apply spherical to position
    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this.position.copy(this._target).add(offset);
    this.lookAt(this._target);
  }

  getTarget() {
    return this._target.clone();
  }

  focusOn(box) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    this._target.copy(center);

    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    this._spherical.radius = maxDim * 2;
    this._spherical.theta = Math.PI / 4;
    this._spherical.phi = Math.PI / 3;

    const offset = new THREE.Vector3().setFromSpherical(this._spherical);
    this.position.copy(this._target).add(offset);
    this.lookAt(this._target);
  }
}

export default OrbitCamera;
