import * as THREE from 'three';

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const rand = (a, b) => a + Math.random() * (b - a);

// scratch objects (no per-frame allocations)
const _m = new THREE.Matrix4();
const _world = new THREE.Matrix4();
const _invGroup = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _dq = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const ONE = new THREE.Vector3(1, 1, 1);

/**
 * Click-to-explode controller.
 *
 * States:
 *   assembled  discs sit in their ring slots (DiscRing.update drives them)
 *   exploded   every disc floats freely in zero gravity and bounces off the screen edges
 *   returning  every disc eases back to its (still moving) ring slot
 *
 * Free discs are simulated in CAMERA (view) space. In view space the visible area at any
 * depth d is simply |x| <= d * tan(fov/2) * aspect and |y| <= d * tan(fov/2), so keeping
 * discs inside the viewport is a cheap per-axis check, and it stays correct on resize.
 * Orientation is integrated in world space. Every frame the result is converted back to
 * ring.group's local space and written into the InstancedMesh.
 */
export class DiscScatter {
  constructor(ring, camera, config) {
    this.ring = ring;
    this.camera = camera;
    this.config = config;
    this.state = 'assembled';
    this.returnClock = 0;
    this.discs = [];
    this.resize();
  }

  /** Call when disc count changes (debug panel rebuild). */
  resize() {
    const n = this.ring.config.ring.count;
    this.discs = Array.from({ length: n }, () => ({
      viewPos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      worldPos: new THREE.Vector3(),
      quat: new THREE.Quaternion(),
      spinAxis: new THREE.Vector3(0, 1, 0),
      spin: 0,
      seed: Math.random() * 100,
      startPos: new THREE.Vector3(),
      startQuat: new THREE.Quaternion(),
      delay: 0,
    }));
    this.state = 'assembled';
  }

  get isAssembled() {
    return this.state === 'assembled';
  }

  /** Click handler: explode from the clicked point, or bring the discs home. */
  toggle(ndcX, ndcY, time) {
    if (this.state === 'exploded') this.reassemble();
    else this.explode(ndcX, ndcY, time);
  }

  explode(ndcX, ndcY, time) {
    const cfg = this.config;
    const cam = this.camera;
    this._syncMatrices();

    // Where the click lands on the ring's plane, in view space
    const dist = this._ringDistance();
    const halfH = dist * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const clickPoint = _v2.set(ndcX * halfH * cam.aspect, ndcY * halfH, -dist);
    const reach = Math.max(halfH * cam.aspect, halfH) * 2;

    // Start from wherever each disc is right now (ring slot or mid-return)
    if (this.state === 'assembled') this._captureHome(time);

    for (const d of this.discs) {
      d.viewPos.copy(d.worldPos).applyMatrix4(cam.matrixWorldInverse);

      // push away from the click, with a random spread so it never looks mechanical
      const dir = _v.copy(d.viewPos).sub(clickPoint);
      dir.z = 0;
      if (dir.lengthSq() < 1e-4) dir.set(rand(-1, 1), rand(-1, 1), 0);
      const closeness = 1 - Math.min(dir.length() / reach, 1); // 1 = right under the click
      dir.normalize();
      dir.x += rand(-cfg.spread, cfg.spread);
      dir.y += rand(-cfg.spread, cfg.spread);
      dir.z = rand(-cfg.depthKick, cfg.depthKick);
      dir.normalize();

      const speed = rand(cfg.speedMin, cfg.speedMax) * (1 + cfg.clickBoost * closeness);
      d.vel.copy(dir).multiplyScalar(speed);

      // random tumble
      d.spinAxis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      d.spin = rand(cfg.spinMin, cfg.spinMax) * (Math.random() < 0.5 ? -1 : 1);
    }
    this.state = 'exploded';
  }

  reassemble() {
    const cfg = this.config;
    for (const d of this.discs) {
      d.startPos.copy(d.worldPos);
      d.startQuat.copy(d.quat);
      d.delay = Math.random() * cfg.returnStagger;
    }
    this.returnClock = 0;
    this.state = 'returning';
  }

  /**
   * @param {number} dt   frame delta (seconds)
   * @param {number} time ring animation time (so returning discs land on the moving slots)
   */
  update(dt, time) {
    if (this.state === 'assembled') {
      this.ring.update(time);
      return;
    }
    this._syncMatrices();
    if (this.state === 'exploded') this._simulate(dt);
    else this._return(dt, time);
    this._write();
  }

  // -------------------------------------------------------------------------

  _simulate(dt) {
    const cfg = this.config;
    const cam = this.camera;
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2);
    const dist = this._ringDistance();
    const margin = this.ring.config.ring.discRadius + cfg.edgePadding;
    const dNear = Math.max(dist - cfg.depthRange, cam.near + margin * 2);
    const dFar = dist + cfg.depthRange;
    const t = performance.now() / 1000;

    for (const d of this.discs) {
      const p = d.viewPos;
      const v = d.vel;

      // soft random "floating" push, different per disc
      const s = d.seed;
      v.x += Math.sin(t * 0.7 + s) * cfg.wander * dt;
      v.y += Math.sin(t * 0.9 + s * 1.7) * cfg.wander * dt;
      v.z += Math.sin(t * 0.5 + s * 2.3) * cfg.wander * 0.5 * dt;

      // drag only removes speed above the cruise speed, so discs never fully stop
      const speed = v.length();
      if (speed > 1e-5) {
        const target = cfg.cruiseSpeed + (speed - cfg.cruiseSpeed) * Math.exp(-cfg.drag * dt);
        v.multiplyScalar(target / speed);
      }

      p.addScaledVector(v, dt);

      // ---- keep inside the viewport (bounce off the frustum walls) ----
      let depth = -p.z;
      if (depth < dNear) { depth = dNear; v.z = -Math.abs(v.z) * cfg.bounce; }
      if (depth > dFar) { depth = dFar; v.z = Math.abs(v.z) * cfg.bounce; }
      p.z = -depth;

      const limY = Math.max(depth * tanHalf - margin, 0);
      const limX = Math.max(depth * tanHalf * cam.aspect - margin, 0);
      if (p.x > limX) { p.x = limX; v.x = -Math.abs(v.x) * cfg.bounce; }
      if (p.x < -limX) { p.x = -limX; v.x = Math.abs(v.x) * cfg.bounce; }
      if (p.y > limY) { p.y = limY; v.y = -Math.abs(v.y) * cfg.bounce; }
      if (p.y < -limY) { p.y = -limY; v.y = Math.abs(v.y) * cfg.bounce; }

      // tumble, slowing to a lazy cruise spin
      const sign = Math.sign(d.spin) || 1;
      const spinAbs = cfg.spinCruise + (Math.abs(d.spin) - cfg.spinCruise) * Math.exp(-cfg.drag * dt);
      d.spin = spinAbs * sign;
      _dq.setFromAxisAngle(d.spinAxis, d.spin * dt);
      d.quat.premultiply(_dq).normalize();

      d.worldPos.copy(p).applyMatrix4(cam.matrixWorld);
    }
  }

  _return(dt, time) {
    const cfg = this.config;
    this.returnClock += dt;
    this.ring.group.updateWorldMatrix(true, false);
    let done = true;

    this.discs.forEach((d, i) => {
      const k = THREE.MathUtils.clamp((this.returnClock - d.delay) / cfg.returnDuration, 0, 1);
      if (k < 1) done = false;
      const e = easeInOutCubic(k);

      // live home slot (the ring keeps flowing while discs fly back)
      _world.multiplyMatrices(this.ring.group.matrixWorld, this.ring.homeMatrix(i, time, _m));
      _world.decompose(_v, _q, _scale);

      d.worldPos.lerpVectors(d.startPos, _v, e);
      d.quat.slerpQuaternions(d.startQuat, _q, e);
    });

    if (done) this.state = 'assembled';
  }

  /** Records every disc's current ring slot as its world position / rotation. */
  _captureHome(time) {
    this.ring.group.updateWorldMatrix(true, false);
    this.discs.forEach((d, i) => {
      _world.multiplyMatrices(this.ring.group.matrixWorld, this.ring.homeMatrix(i, time, _m));
      _world.decompose(d.worldPos, d.quat, _scale);
    });
  }

  /** Converts world transforms back to ring.group space and uploads them. */
  _write() {
    _invGroup.copy(this.ring.group.matrixWorld).invert();
    const mesh = this.ring.mesh;
    this.discs.forEach((d, i) => {
      _world.compose(d.worldPos, d.quat, ONE);
      _m.multiplyMatrices(_invGroup, _world);
      mesh.setMatrixAt(i, _m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  _syncMatrices() {
    this.camera.updateMatrixWorld();
    this.ring.group.updateWorldMatrix(true, false);
  }

  /** Distance from the camera to the ring centre (the depth discs float around). */
  _ringDistance() {
    _v.setFromMatrixPosition(this.ring.group.matrixWorld);
    return this.camera.position.distanceTo(_v);
  }
}

