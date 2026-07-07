import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { EVENTS } from '../utils/Constants.js';
import { eventBus } from '../utils/EventBus.js';

// DecalManager: manages decal creation, selection, deletion, and gizmo
class DecalManager {
  constructor(engine, sceneManager) {
    this.engine = engine;
    this.sceneManager = sceneManager;

    this._decalsContainer = new THREE.Group();
    this._decalsContainer.name = 'DecalsContainer';
    this.engine.scene.add(this._decalsContainer);

    this._decals = [];           // Array of { mesh, decalData }
    this._selectedDecal = null;
    this._decalSprites = [];     // Sprite icons for each decal

    this._raycaster = new THREE.Raycaster();

    // Gizmo
    this._gizmo = null;
    this._activeGizmoMode = null;

    // Decals visibility
    this._spritesVisible = true;

    this._bindEvents();
  }

  _bindEvents() {
    eventBus.on(EVENTS.DECAL_DROP, (data) => {
      this.createDecal(data);
    });

    eventBus.on(EVENTS.DECAL_EYE_TOGGLED, () => {
      this.toggleSpriteVisibility();
    });
  }

  createDecal(data) {
    const { decalData, hitPoint, hitNormal, hitMesh } = data;
    if (!decalData || !hitPoint || !hitNormal || !hitMesh) return;

    // Create decal material
    const material = new THREE.MeshPhongMaterial({
      map: decalData.texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4
    });

    // Calculate decal size based on hit mesh bounds
    const bbox = new THREE.Box3().setFromObject(hitMesh);
    const size = bbox.getSize(new THREE.Vector3());
    const decalSize = new THREE.Vector3(
      Math.max(0.1, size.x * 0.2),
      Math.max(0.1, size.z * 0.2),
      Math.max(0.01, size.y * 0.02)
    );

    // Create DecalGeometry
    const position = new THREE.Vector3();
    const orientation = new THREE.Euler();
    const orientationMatrix = new THREE.Matrix4();
    const lookAtTarget = hitPoint.clone().add(hitNormal);
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      hitNormal
    );

    const decalGeometry = new DecalGeometry(
      hitMesh,
      hitPoint,
      quaternion,
      decalSize
    );

    const decalMesh = new THREE.Mesh(decalGeometry, material);
    decalMesh.name = `Decal_${this._decals.length}`;

    this._decalsContainer.add(decalMesh);

    const decalEntry = {
      mesh: decalMesh,
      decalData: decalData,
      hitPoint: hitPoint.clone(),
      hitNormal: hitNormal.clone(),
      size: decalSize.clone(),
      quaternion: quaternion.clone()
    };

    this._decals.push(decalEntry);

    // Create sprite icon
    this._createSpriteIcon(decalEntry);

    // Auto-select the new decal
    this.selectDecal(decalEntry);

    eventBus.emit(EVENTS.DECAL_CREATED, decalEntry);
    this.engine.markDirty();
  }

  _createSpriteIcon(decalEntry) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Draw diamond shape
    ctx.fillStyle = '#4fc3f7';
    ctx.beginPath();
    ctx.moveTo(16, 2);
    ctx.lineTo(30, 16);
    ctx.lineTo(16, 30);
    ctx.lineTo(2, 16);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(decalEntry.hitPoint).add(
      decalEntry.hitNormal.clone().multiplyScalar(0.05)
    );
    sprite.scale.set(0.2, 0.2, 1);
    sprite.name = `Sprite_${decalEntry.mesh.name}`;

    this._decalsContainer.add(sprite);
    decalEntry.sprite = sprite;
    this._decalSprites.push(sprite);
  }

  selectDecal(decalEntry) {
    // Deselect previous
    if (this._selectedDecal) {
      this._highlightSprite(this._selectedDecal.sprite, false);
    }

    this._selectedDecal = decalEntry;

    if (decalEntry) {
      this._highlightSprite(decalEntry.sprite, true);
      eventBus.emit(EVENTS.DECAL_SELECTED, decalEntry);
    } else {
      eventBus.emit(EVENTS.DECAL_DESELECTED);
    }

    this.engine.markDirty();
  }

  _highlightSprite(sprite, highlight) {
    if (!sprite) return;
    if (highlight) {
      sprite.material.color.set(0xffff00);
      sprite.scale.set(0.25, 0.25, 1);
    } else {
      sprite.material.color.set(0xffffff);
      sprite.scale.set(0.2, 0.2, 1);
    }
  }

  deleteSelectedDecal() {
    if (!this._selectedDecal) return;

    const decal = this._selectedDecal;
    const index = this._decals.indexOf(decal);

    if (index !== -1) {
      this._decals.splice(index, 1);

      // Remove mesh
      this._decalsContainer.remove(decal.mesh);
      decal.mesh.geometry.dispose();
      decal.mesh.material.dispose();

      // Remove sprite
      if (decal.sprite) {
        this._decalsContainer.remove(decal.sprite);
        decal.sprite.material.map.dispose();
        decal.sprite.material.dispose();
        const spriteIndex = this._decalSprites.indexOf(decal.sprite);
        if (spriteIndex !== -1) {
          this._decalSprites.splice(spriteIndex, 1);
        }
      }

      eventBus.emit(EVENTS.DECAL_DELETED, decal);
      this.selectDecal(null);
      this.engine.markDirty();
    }
  }

  moveSelectedDecal(offset) {
    if (!this._selectedDecal) return;

    const decal = this._selectedDecal;
    decal.mesh.position.add(offset);
    decal.hitPoint.add(offset);

    if (decal.sprite) {
      decal.sprite.position.copy(decal.hitPoint).add(
        decal.hitNormal.clone().multiplyScalar(0.05)
      );
    }

    eventBus.emit(EVENTS.DECAL_TRANSFORMED, decal);
    this.engine.markDirty();
  }

  rotateSelectedDecal(angle) {
    if (!this._selectedDecal) return;

    const decal = this._selectedDecal;
    const axis = decal.hitNormal;
    decal.mesh.rotateOnWorldAxis(axis, angle);
    decal.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));

    eventBus.emit(EVENTS.DECAL_TRANSFORMED, decal);
    this.engine.markDirty();
  }

  scaleSelectedDecal(factor) {
    if (!this._selectedDecal) return;

    const decal = this._selectedDecal;
    const newScale = decal.mesh.scale.clone().multiplyScalar(factor);
    newScale.clampScalar(0.1, 10);
    decal.mesh.scale.copy(newScale);

    eventBus.emit(EVENTS.DECAL_TRANSFORMED, decal);
    this.engine.markDirty();
  }

  raycastDecalSprites(ndc, camera) {
    if (!this._spritesVisible) return null;

    this._raycaster.setFromCamera(ndc, camera);
    const hits = this._raycaster.intersectObjects(this._decalSprites, false);

    if (hits.length > 0) {
      // Find the decal entry for this sprite
      const hitSprite = hits[0].object;
      for (const decal of this._decals) {
        if (decal.sprite === hitSprite) {
          return decal;
        }
      }
    }

    return null;
  }

  toggleSpriteVisibility() {
    this._spritesVisible = !this._spritesVisible;
    for (const sprite of this._decalSprites) {
      sprite.visible = this._spritesVisible;
    }
    this.engine.markDirty();
  }

  getSelectedDecal() {
    return this._selectedDecal;
  }

  getDecals() {
    return this._decals;
  }

  getDecalsContainer() {
    return this._decalsContainer;
  }

  // Remove all decals before export
  getAllDecalMeshes() {
    return this._decals.map(d => d.mesh);
  }

  destroy() {
    for (const decal of this._decals) {
      this._decalsContainer.remove(decal.mesh);
      decal.mesh.geometry.dispose();
      decal.mesh.material.dispose();
      if (decal.sprite) {
        this._decalsContainer.remove(decal.sprite);
        decal.sprite.material.dispose();
      }
    }
    this._decals = [];
    this._decalSprites = [];
    this.engine.scene.remove(this._decalsContainer);
    this._selectedDecal = null;
  }
}

export default DecalManager;
