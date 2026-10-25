import * as THREE from 'three';
import { createDiscGeometry } from './disc-geometry.js';

const TAU = Math.PI * 2;

// scratch objects reused every frame (no garbage collection hiccups)
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler(0, 0, 0, 'ZYX');
const _scale = new THREE.Vector3(1, 1, 1);
const _m = new THREE.Matrix4();

/**
 * The ring of discs. All discs share one geometry and one material and are drawn
 * in a single draw call with InstancedMesh. The ring lies in the XY plane around
 * the shared origin (0, 0, 0); the camera looks at it down the Z axis.
 *
 * Every disc gets exactly the same transform, only rotated by its own angle theta:
 *
 *   matrix = T(position on circle) * Rz(theta) * Rx(90deg + lean)
 *
 * Read right to left (local -> world):
 *   1. Rx(90deg)  stands the disc up: its normal (local +Z) turns to point along the
 *                 circle's tangent, its local +X stays pointing outward (radial) and its
 *                 local +Y now points along world +Z, toward the camera.
 *                 => the disc's plane contains the radial line and the viewing axis,
 *                    so from the front it is seen exactly edge-on, pointing away from the centre.
 *   2. Rx(lean)   optional extra lean around that same radial axis (0 = perfect sunburst).
 *   3. Rz(theta)  rotates the whole setup to the disc's angle around the centre.
 *   4. T(...)     moves it out to radius `ring.radius` from the shared origin.
 *
 * Because 1 and 2 are both around local X, and 3 is around world Z, Euler order 'ZYX'
 * (matrix = Rz * Ry * Rx) expresses it directly with no ambiguity.
 */
export class DiscRing {
  constructor(config, material) {
    this.config = config;
    this.material = material;
    this.group = new THREE.Group();
    this.mesh = null;
    this.build();
  }

  build() {
    if (this.mesh) {
      this.group.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh.dispose();
    }
    const geo = createDiscGeometry(this.config.ring);
    this.mesh = new THREE.InstancedMesh(geo, this.material, this.config.ring.count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; // matrices change every frame, skip stale bounds
    this.group.add(this.mesh);
    this.update(0);
  }

  /**
   * Writes disc i's resting transform in the ring (local to ring.group) into `out`.
   * Used by update() and by the explode controller as the "home" slot to return to.
   */
  homeMatrix(i, time, out) {
    const { ring, twist, motion } = this.config;
    const flow = time * motion.flowSpeed;      // revolutions; every disc advances equally
    const wavePhase = time * twist.speed * TAU;

    // evenly spaced angle around the shared centre
    const theta = (i / ring.count + flow) * TAU;

    // optional lean (twist.amount = 0 keeps every disc perfectly radial)
    const lean = twist.amount * Math.sin(twist.waves * theta + twist.offset + wavePhase);

    _pos.set(Math.cos(theta) * ring.radius, Math.sin(theta) * ring.radius, 0);
    _euler.set(Math.PI / 2 + lean, 0, theta, 'ZYX');
    _quat.setFromEuler(_euler);
    return out.compose(_pos, _quat, _scale);
  }

  /** Places every disc in its ring slot. @param {number} time seconds of animation time */
  update(time) {
    for (let i = 0; i < this.config.ring.count; i++) {
      this.mesh.setMatrixAt(i, this.homeMatrix(i, time, _m));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

/** Satin iridescent glass/metal look from the reference. */
export function createGlassMaterial(m, ringConfig) {
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(m.color),
    metalness: m.metalness,
    roughness: m.roughness,
    iridescence: m.iridescence,
    iridescenceIOR: m.iridescenceIOR,
    iridescenceThicknessRange: [...m.iridescenceThickness],
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    envMapIntensity: m.envIntensity,
  });

  // Fake ambient occlusion: darken each disc toward the centre hole.
  // Local +X of the disc geometry always points away from the ring centre (see the
  // transform above), so the untransformed position.x tells us how close a pixel is to the hole.
  const shade = { value: m.innerShade };
  const discR = { value: ringConfig.discRadius };
  material.userData.innerShade = shade;
  material.userData.discRadius = discR;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uInnerShade = shade;
    shader.uniforms.uDiscRadius = discR;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vRadialX;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRadialX = position.x;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vRadialX;\nuniform float uInnerShade;\nuniform float uDiscRadius;')
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight *= mix(uInnerShade, 1.0, smoothstep(-uDiscRadius, uDiscRadius * 0.35, vRadialX));\n#include <opaque_fragment>'
      );
  };
  return material;
}
