import * as THREE from 'three';

// PBRMaterial: wrapper for MeshPhysicalMaterial with specular support
// Uses MeshPhysicalMaterial to support specularIntensity/specularColor (KHR_materials_specular)
class PBRMaterial {
  static createDefault(name = 'New Material') {
    const material = new THREE.MeshPhysicalMaterial({
      name: name,
      color: new THREE.Color(0xffffff),
      roughness: 1.0,
      metalness: 0.0,
      specularIntensity: 1.0,
      specularColor: new THREE.Color(0xffffff),
      map: null,
      normalMap: null,
      roughnessMap: null,
      metalnessMap: null,
      aoMap: null,
      specularColorMap: null,
      displacementMap: null,
      displacementScale: 0,
      displacementBias: 0
    });

    // Mark as editor-created material
    material._editorMaterial = true;
    material._painted = false;

    return material;
  }

  static createFromExisting(material) {
    const newMat = new THREE.MeshPhysicalMaterial();
    newMat.copy(material);
    newMat.name = material.name;
    newMat._editorMaterial = true;
    newMat._painted = false;

    // Copy texture references
    const textureProps = [
      'map', 'normalMap', 'roughnessMap', 'metalnessMap',
      'aoMap', 'specularColorMap', 'displacementMap'
    ];

    for (const prop of textureProps) {
      if (material[prop]) {
        newMat[prop] = material[prop];
      }
    }

    return newMat;
  }
}

export default PBRMaterial;
