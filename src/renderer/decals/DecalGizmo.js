import * as THREE from 'three';
import { DECAL_GIZMO_MODES, EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// DecalGizmo: transform controls shown when a decal is selected
class DecalGizmo {
  constructor(engine) {
    this.engine = engine;
    this._gizmoGroup = new THREE.Group();
    this._gizmoGroup.visible = false;
    this._gizmoGroup.name = 'DecalGizmo';
    this.engine.scene.add(this._gizmoGroup);

    this._mode = DECAL_GIZMO_MODES.TRANSLATE;
    this._activeTarget = null;
    this._isDragging = false;
    this._dragAxis = null;
    this._dragStart = new THREE.Vector3();
    this._dragStartMouse = new THREE.Vector2();

    this._axisColors = {
      x: 0xff4444,
      y: 0x44ff44,
      z: 0x4444ff
    };

    this._raycaster = new THREE.Raycaster();
    this._raycaster.params.Points.threshold = 0.15;
    this._raycaster.params.Line.threshold = 0.05;

    this._createGizmo();
  }

  _createGizmo() {
    const axisLength = 0.5;

    // Create three axis arrows
    const axes = ['x', 'y', 'z'];
    const directions = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 1)
    ];

    for (let i = 0; i < 3; i++) {
      const axis = axes[i];
      const dir = directions[i];
      const color = this._axisColors[axis];

      // Line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        dir.clone().multiplyScalar(axisLength)
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color, linewidth: 2, depthTest: false });
      const line = new THREE.Line(lineGeo, lineMat);
      line.name = `gizmo_line_${axis}`;
      this._gizmoGroup.add(line);

      // Cone tip
      const coneGeo = new THREE.ConeGeometry(0.04, 0.12, 8, 8);
      const coneMat = new THREE.MeshBasicMaterial({ color, depthTest: false });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.copy(dir.clone().multiplyScalar(axisLength));
      cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      cone.name = `gizmo_cone_${axis}`;
      this._gizmoGroup.add(cone);
    }

    // Center sphere
    const sphereGeo = new THREE.SphereGeometry(0.05, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.name = 'gizmo_center';
    this._gizmoGroup.add(sphere);
  }

  showFor(decalEntry) {
    this._activeTarget = decalEntry;
    if (decalEntry) {
      this._gizmoGroup.position.copy(decalEntry.hitPoint);
      this._gizmoGroup.quaternion.copy(
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          decalEntry.hitNormal
        )
      );
      this._gizmoGroup.visible = true;
    } else {
      this._gizmoGroup.visible = false;
    }
    this.engine.markDirty();
  }

  hide() {
    this._gizmoGroup.visible = false;
    this._activeTarget = null;
    this._isDragging = false;
    this.engine.markDirty();
  }

  setMode(mode) {
    this._mode = mode;
  }

  getMode() {
    return this._mode;
  }

  update(inputManager, canvas, decalManager) {
    if (!this._activeTarget || !this._gizmoGroup.visible) return;

    const ndc = inputManager.getNDC(canvas);

    // Check for gizmo interaction
    if (inputManager.wasMouseButtonPressed(0)) {
      const hit = this._raycastGizmo(ndc);
      if (hit) {
        this._startDrag(hit.axis, inputManager.getMousePosition());
        return;
      }
    }

    if (this._isDragging && inputManager.isMouseButtonDown(0)) {
      this._updateDrag(inputManager, canvas, decalManager);
      return;
    }

    if (inputManager.wasMouseButtonReleased(0) && this._isDragging) {
      this._endDrag();
    }
  }

  _raycastGizmo(ndc) {
    this._raycaster.setFromCamera(ndc, this.engine.camera);
    const hits = this._raycaster.intersectObjects(this._gizmoGroup.children, true);

    if (hits.length > 0) {
      const name = hits[0].object.name;
      if (name.includes('cone_x') || name.includes('line_x')) return { axis: 'x' };
      if (name.includes('cone_y') || name.includes('line_y')) return { axis: 'y' };
      if (name.includes('cone_z') || name.includes('line_z')) return { axis: 'z' };
      if (name === 'gizmo_center') return { axis: 'all' };
    }

    return null;
  }

  _startDrag(axis, mousePos) {
    this._isDragging = true;
    this._dragAxis = axis;
    this._dragStart.copy(this._activeTarget.mesh.position);
    this._dragStartMouse.set(mousePos.x, mousePos.y);
  }

  _updateDrag(inputManager, canvas, decalManager) {
    const mousePos = inputManager.getMousePosition();
    const dx = mousePos.x - this._dragStartMouse.x;
    const dy = mousePos.y - this._dragStartMouse.y;
    const sensitivity = 0.01;

    if (this._mode === DECAL_GIZMO_MODES.TRANSLATE) {
      const cameraRight = new THREE.Vector3();
      const cameraUp = new THREE.Vector3();
      this.engine.camera.getWorldDirection(new THREE.Vector3());
      cameraRight.copy(new THREE.Vector3(1, 0, 0)).applyQuaternion(this.engine.camera.quaternion);
      cameraUp.copy(new THREE.Vector3(0, 1, 0)).applyQuaternion(this.engine.camera.quaternion);

      const offset = new THREE.Vector3();
      offset.addScaledVector(cameraRight, dx * sensitivity);
      offset.addScaledVector(cameraUp, -dy * sensitivity);

      decalManager.moveSelectedDecal(offset);
    } else if (this._mode === DECAL_GIZMO_MODES.ROTATE) {
      decalManager.rotateSelectedDecal((dx + dy) * sensitivity * 2);
    } else if (this._mode === DECAL_GIZMO_MODES.SCALE) {
      const factor = 1 + (dx - dy) * sensitivity;
      decalManager.scaleSelectedDecal(factor);
    }

    this._dragStartMouse.set(mousePos.x, mousePos.y);
  }

  _endDrag() {
    this._isDragging = false;
    this._dragAxis = null;
  }

  destroy() {
    this.engine.scene.remove(this._gizmoGroup);
    this._gizmoGroup.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this._activeTarget = null;
  }
}

export default DecalGizmo;
