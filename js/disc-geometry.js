import * as THREE from 'three';

/**
 * Builds one glass disc with LatheGeometry.
 *
 * We draw half of the disc's cross-section (the "profile") in 2D and spin it 360 degrees
 * around the lathe axis:
 *
 *            top face (domed by `bulge`)
 *   axis  ______________________
 *     |  |                      )   <- rounded rim (half circle, radius = thickness / 2)
 *     |  |______________________)
 *     |        bottom face
 *     +-------------------------> radius
 *
 * bulgePower controls the face curve:
 *   1 = true lens: thick in the middle, tapering to a sharp edge (pointed blades from the front)
 *   2 = flatter face that blends softly into the rim
 *
 * ORIENTATION CONTRACT (ring.js relies on this):
 *   - the disc is centred on the origin
 *   - its flat faces lie in the local XY plane
 *   - its face normal is local +Z
 *   - local +X is the in-plane direction that ring.js points away from the ring centre
 */
export function createDiscGeometry({ discRadius, thickness, bulge, bulgePower = 2, segments }) {
  const e = thickness / 2;        // rim radius (half the edge thickness)
  const flat = discRadius - e;    // where the face ends and the rim begins
  const faceSteps = 32;
  const rimSteps = 16;
  const pts = [];

  const faceY = (x) => {
    const s = x / flat;
    return e + bulge * Math.pow(1 - s * s, bulgePower);
  };

  // Profile ordered bottom -> rim -> top so LatheGeometry's normals point outward.
  for (let i = 0; i <= faceSteps; i++) {
    const x = (i / faceSteps) * flat;
    pts.push(new THREE.Vector2(x, -faceY(x)));
  }
  for (let i = 1; i < rimSteps; i++) {
    const a = -Math.PI / 2 + (i / rimSteps) * Math.PI;
    pts.push(new THREE.Vector2(flat + Math.cos(a) * e, Math.sin(a) * e));
  }
  for (let i = faceSteps; i >= 0; i--) {
    const x = (i / faceSteps) * flat;
    pts.push(new THREE.Vector2(x, faceY(x)));
  }

  // Keep the centre points a hair off the axis to avoid degenerate normals
  pts[0].x = pts[pts.length - 1].x = 1e-4;

  // LatheGeometry computes smooth, seamless normals from the profile.
  const geo = new THREE.LatheGeometry(pts, segments);

  // Lathe spins around +Y. Rotate once so the disc normal becomes local +Z
  // (rotateX(+90deg) maps +Y -> +Z). Local X is unchanged.
  geo.rotateX(Math.PI / 2);
  return geo;
}
