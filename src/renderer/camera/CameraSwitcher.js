import OrbitCamera from './OrbitCamera.js';
import FreeCamera from './FreeCamera.js';
import { CAMERA_MODES, EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// CameraSwitcher: toggles between Orbit and Free cameras with Tab key
class CameraSwitcher {
  constructor(engine) {
    this.engine = engine;
    this._currentMode = CAMERA_MODES.ORBIT;
    this._cameras = {};
    this._lastPositions = {};

    this._init();
  }

  _init() {
    const size = this.engine.getRenderTargetSize();
    const aspect = size.width / Math.max(size.height, 1);

    this._cameras[CAMERA_MODES.ORBIT] = new OrbitCamera(60, aspect, 0.01, 1000);
    this._cameras[CAMERA_MODES.FREE] = new FreeCamera(60, aspect, 0.01, 1000);

    this.engine.setCamera(this._cameras[this._currentMode]);
  }

  update(inputManager, canvas, delta) {
    const activeCamera = this._cameras[this._currentMode];

    if (inputManager.wasKeyPressed('tab')) {
      this.toggle();
      return; // Skip update for this frame to avoid stale input
    }

    if (this._currentMode === CAMERA_MODES.ORBIT) {
      activeCamera.update(inputManager, canvas);
    } else if (this._currentMode === CAMERA_MODES.FREE) {
      activeCamera.update(inputManager, canvas, delta);
    }

    this.engine.markDirty();
  }

  toggle() {
    // Save current camera state
    const currentCam = this._cameras[this._currentMode];
    this._lastPositions[this._currentMode] = {
      position: currentCam.position.clone(),
      quaternion: currentCam.quaternion.clone(),
      target: currentCam._target ? currentCam._target.clone() : null
    };

    // Switch modes
    this._currentMode = this._currentMode === CAMERA_MODES.ORBIT ? CAMERA_MODES.FREE : CAMERA_MODES.ORBIT;

    // Restore new camera state if available
    const newCam = this._cameras[this._currentMode];
    const lastState = this._lastPositions[this._currentMode];
    if (lastState && lastState.position) {
      newCam.position.copy(lastState.position);
      newCam.quaternion.copy(lastState.quaternion);
      newCam.lookAt(new THREE.Vector3(0, 0, -1).applyQuaternion(newCam.quaternion).add(newCam.position));
    }

    this.engine.setCamera(newCam);
    this.engine.markDirty();

    eventBus.emit(EVENTS.CAMERA_MODE_CHANGED, this._currentMode);

    // Update camera indicator
    const indicator = document.getElementById('camera-indicator');
    if (indicator) {
      indicator.textContent = this._currentMode === CAMERA_MODES.ORBIT ? 'Orbit Camera' : 'Free Camera';
    }
  }

  getCamera() {
    return this._cameras[this._currentMode];
  }

  getMode() {
    return this._currentMode;
  }

  focusOn(box) {
    for (const mode of Object.values(CAMERA_MODES)) {
      this._cameras[mode].focusOn(box);
    }
    this.engine.markDirty();
  }

  destroy() {
    // Cleanup if needed
  }
}

export default CameraSwitcher;
