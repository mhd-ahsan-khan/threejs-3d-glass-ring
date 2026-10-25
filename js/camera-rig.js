import * as THREE from 'three';

/**
 * Fixed camera that can slowly orbit the ring.
 * The orbit eases to a stop while the discs are exploded (so the screen walls hold still)
 * and eases back in once the ring is whole again.
 */
export class CameraRig {
  constructor(camera, cameraConfig) {
    this.camera = camera;
    this.config = cameraConfig;
    this.fitScale = 1;          // pulls back on narrow (portrait) screens
    this.orbitTime = 0;
    this.orbitFactor = 1;       // 0 = paused, 1 = full speed
    this.orbitScale = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.15 : 1;

    this._target = new THREE.Vector3();
    this._offset = new THREE.Vector3();
    this._sph = new THREE.Spherical();
  }

  setAspect(aspect) {
    // The ring is round, so on portrait screens width is the limit
    this.fitScale = aspect < 1.15 ? 1.15 / aspect : 1;
  }

  /**
   * @param {number} dt frame delta
   * @param {boolean} orbitActive false while the discs are exploded
   */
  update(dt, orbitActive) {
    const c = this.config;
    const o = c.orbit;
    const cam = this.camera;

    this._target.fromArray(c.target);
    this._offset.fromArray(c.position).sub(this._target).multiplyScalar(this.fitScale);

    if (o.enabled) {
      // ease the orbit speed in / out instead of stopping dead
      const goal = orbitActive ? 1 : 0;
      this.orbitFactor += (goal - this.orbitFactor) * (1 - Math.exp(-o.easing * dt));
      this.orbitTime += dt * this.orbitScale * this.orbitFactor;

      const angle = this.orbitTime * o.speed * Math.PI * 2;
      const bob = Math.sin(this.orbitTime * o.bobSpeed * Math.PI * 2) * o.bob;
      this._sph.setFromVector3(this._offset);
      this._sph.theta += o.direction * angle;
      this._sph.phi = THREE.MathUtils.clamp(this._sph.phi - bob, 0.05, Math.PI - 0.05);
      this._offset.setFromSpherical(this._sph);
    }

    cam.position.copy(this._target).add(this._offset);
    cam.lookAt(this._target);
    if (cam.fov !== c.fov) {
      cam.fov = c.fov;
      cam.updateProjectionMatrix();
    }
  }
}
