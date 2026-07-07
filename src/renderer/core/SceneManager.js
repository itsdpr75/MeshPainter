import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { eventBus } from '../utils/EventBus.js';
import { EVENTS } from '../utils/Constants.js';

// SceneManager: handles GLB import/export via GLTFLoader/GLTFExporter
class SceneManager {
  constructor(engine) {
    this.engine = engine;
    this._loader = null;
    this._exporter = null;
    this._currentModel = null;
    this._meshes = [];
    this._materials = [];

    this._init();
  }

  _init() {
    this._loader = new GLTFLoader();

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    this._loader.setDRACOLoader(dracoLoader);

    this._exporter = new GLTFExporter();
  }

  async loadGLB(arrayBuffer) {
    return new Promise((resolve, reject) => {
      this._loader.parse(arrayBuffer, '', (gltf) => {
        try {
          this._onModelLoaded(gltf);
          resolve(gltf);
        } catch (e) {
          reject(e);
        }
      }, (error) => {
        reject(error);
      });
    });
  }

  _onModelLoaded(gltf) {
    // Remove previous model
    this.clearModel();

    // Add all scene objects
    const scene = gltf.scene;
    this.engine.scene.add(scene);
    this._currentModel = scene;

    // Collect meshes and materials
    this._meshes = [];
    this._materials = [];
    this._collectFromNode(scene);

    eventBus.emit(EVENTS.MODEL_LOADED, {
      meshes: this._meshes,
      materials: this._materials,
      scene: scene
    });

    this.engine.markDirty();
  }

  _collectFromNode(node) {
    if (node.isMesh) {
      this._meshes.push(node);

      const material = Array.isArray(node.material) ? node.material : [node.material];
      for (const mat of material) {
        if (mat && !this._materials.includes(mat)) {
          this._materials.push(mat);
        }
      }
    }

    for (const child of node.children) {
      this._collectFromNode(child);
    }
  }

  async exportGLB() {
    return new Promise((resolve, reject) => {
      this._exporter.parse(
        this._currentModel,
        (result) => resolve(result),
        (error) => reject(error),
        { binary: true, embedImages: true }
      );
    });
  }

  getMeshes() {
    return this._meshes;
  }

  getMaterials() {
    return this._materials;
  }

  getCurrentModel() {
    return this._currentModel;
  }

  clearModel() {
    if (this._currentModel) {
      // Recursively dispose geometry and materials
      this._currentModel.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) {
            child.geometry.dispose();
          }
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          for (const mat of materials) {
            if (mat && !mat._editorShared) {
              this._disposeMaterialTextures(mat);
              mat.dispose();
            }
          }
        }
      });

      this.engine.scene.remove(this._currentModel);
      this._currentModel = null;
      this._meshes = [];
      this._materials = [];
      this.engine.markDirty();
    }
  }

  _disposeMaterialTextures(material) {
    const textureProps = [
      'map', 'normalMap', 'displacementMap', 'roughnessMap',
      'metalnessMap', 'aoMap', 'specularColorMap', 'specularIntensityMap',
      'alphaMap', 'emissiveMap', 'bumpMap'
    ];

    for (const prop of textureProps) {
      if (material[prop]) {
        material[prop].dispose();
      }
    }
  }

  raycast(raycaster, meshes) {
    const targets = meshes || this._meshes;
    return raycaster.intersectObjects(targets, false);
  }

  destroy() {
    this.clearModel();
    if (this._loader && this._loader.dracoLoader) {
      this._loader.dracoLoader.dispose();
    }
    this._loader = null;
    this._exporter = null;
  }
}

export default SceneManager;
