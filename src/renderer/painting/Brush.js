import * as THREE from 'three';

// Brush: holds brush texture data, size, opacity, rotation
class Brush {
  constructor(name, imageData) {
    this._name = name;
    this._imageData = imageData; // ImageData from Canvas 2D
    this._texture = null;
    this._size = 50;
    this._opacity = 1.0;
    this._rotation = 0;

    this._createTexture();
  }

  _createTexture() {
    this._texture = new THREE.DataTexture(
      new Uint8Array(this._imageData.data),
      this._imageData.width,
      this._imageData.height,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    this._texture.needsUpdate = true;
    this._texture.minFilter = THREE.NearestFilter;
    this._texture.magFilter = THREE.NearestFilter;
    this._texture.wrapS = THREE.ClampToEdgeWrapping;
    this._texture.wrapT = THREE.ClampToEdgeWrapping;
    this._texture.colorSpace = THREE.SRGBColorSpace;
    this._texture.flipY = true;
  }

  getName() {
    return this._name;
  }

  getTexture() {
    return this._texture;
  }

  getImageData() {
    return this._imageData;
  }

  getSize() {
    return this._size;
  }

  setSize(size) {
    this._size = Math.max(0, size);
  }

  getOpacity() {
    return this._opacity;
  }

  setOpacity(opacity) {
    this._opacity = Math.max(0, Math.min(1, Math.round(opacity * 100) / 100));
  }

  getRotation() {
    return this._rotation;
  }

  setRotation(degrees) {
    this._rotation = (degrees % 360) * (Math.PI / 180);
  }

  dispose() {
    if (this._texture) {
      this._texture.dispose();
      this._texture = null;
    }
    this._imageData = null;
  }
}

export default Brush;
