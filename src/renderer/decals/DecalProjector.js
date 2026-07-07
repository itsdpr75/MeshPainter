import * as THREE from 'three';
import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// DecalProjector: handles drag & drop from bottom panel to viewport for decal placement
class DecalProjector {
  constructor(engine, sceneManager, canvas) {
    this.engine = engine;
    this.sceneManager = sceneManager;
    this.canvas = canvas;
    this._raycaster = new THREE.Raycaster();
    this._activeDecalData = null;

    this._init();
  }

  _init() {
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      this._onDrop(e);
    });

    eventBus.on(EVENTS.DECAL_DRAG_START, (decalData) => {
      this._activeDecalData = decalData;
    });
  }

  _onDrop(e) {
    if (!this._activeDecalData) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._raycaster.setFromCamera(new THREE.Vector2(x, y), this.engine.camera);
    const meshes = this.sceneManager.getMeshes();
    const hits = this._raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const hit = hits[0];
      eventBus.emit(EVENTS.DECAL_DROP, {
        decalData: this._activeDecalData,
        hitPoint: hit.point,
        hitNormal: hit.face.normal.clone(),
        hitMesh: hit.object
      });
    }

    this._activeDecalData = null;
  }

  setActiveDecalData(decalData) {
    this._activeDecalData = decalData;
  }

  clearActiveDecalData() {
    this._activeDecalData = null;
  }
}

export default DecalProjector;
