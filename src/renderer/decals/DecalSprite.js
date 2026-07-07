import * as THREE from 'three';

// DecalSprite: 2D Sprite icon shown in viewport for each decal
class DecalSprite {
  static createIcon(decalData, hitPoint, hitNormal) {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Diamond shape indicator
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
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      color: 0x4fc3f7
    });

    const sprite = new THREE.Sprite(material);
    sprite.position.copy(hitPoint).add(
      hitNormal.clone().multiplyScalar(0.05)
    );
    sprite.scale.set(0.2, 0.2, 1);

    return sprite;
  }

  static highlight(sprite, highlight) {
    if (!sprite) return;
    if (highlight) {
      sprite.material.color.set(0xffff00);
      sprite.scale.set(0.25, 0.25, 1);
    } else {
      sprite.material.color.set(0xffffff);
      sprite.scale.set(0.2, 0.2, 1);
    }
  }
}

export default DecalSprite;
