// decal-math: calculates projection matrices and gizmo alignment for decals
import * as THREE from 'three';

self.onmessage = function(e) {
  const { operation, data } = e.data;

  try {
    switch (operation) {
      case 'calculateDecalTransform': {
        const { hitPoint, hitNormal, decalSize } = data;

        const position = new THREE.Vector3().fromArray(hitPoint);
        const normal = new THREE.Vector3().fromArray(hitNormal);
        const size = new THREE.Vector3().fromArray(decalSize);

        // Calculate quaternion from normal
        const quat = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          normal
        );

        self.postMessage({
          position: position.toArray(),
          quaternion: quat.toArray(),
          size: size.toArray()
        });
        break;
      }

      case 'calculateGizmoOrientation': {
        const { normal } = data;
        const n = new THREE.Vector3().fromArray(normal);

        // Ensure the gizmo doesn't flip on angled surfaces
        const quat = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);

        // If normal is nearly parallel to up, use a different reference
        if (Math.abs(n.dot(up)) > 0.999) {
          quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        } else {
          // Create a stable orientation
          const right = new THREE.Vector3().crossVectors(up, n).normalize();
          const localUp = new THREE.Vector3().crossVectors(n, right).normalize();

          const matrix = new THREE.Matrix4();
          matrix.makeBasis(right, localUp, n);
          quat.setFromRotationMatrix(matrix);
        }

        self.postMessage({
          quaternion: quat.toArray()
        });
        break;
      }

      case 'projectToScreen': {
        const { worldPosition, modelViewMatrix, projectionMatrix, viewport } = data;

        const pos = new THREE.Vector3().fromArray(worldPosition);
        const mv = new THREE.Matrix4().fromArray(modelViewMatrix);
        const proj = new THREE.Matrix4().fromArray(projectionMatrix);

        const projected = pos.clone().applyMatrix4(mv).applyMatrix4(proj);

        // Normalize to viewport coordinates
        const screenX = (projected.x / projected.w + 1) * 0.5 * viewport[2] + viewport[0];
        const screenY = (-projected.y / projected.w + 1) * 0.5 * viewport[3] + viewport[1];

        self.postMessage({
          screenX,
          screenY,
          ndcX: projected.x / projected.w,
          ndcY: projected.y / projected.w
        });
        break;
      }

      default: {
        self.postMessage({ error: `Unknown operation: ${operation}` });
      }
    }
  } catch (err) {
    self.postMessage({ error: err.message });
  }
};
