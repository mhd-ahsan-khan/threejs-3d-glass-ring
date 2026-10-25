import GUI from 'three/addons/libs/lil-gui.module.min.js';

/** Live tuning panel, loaded only with ?debug in the URL. */
export function createDebugPanel({ CONFIG, ring, material, bloom, renderer, applyTilt, scatter }) {
  const gui = new GUI({ title: 'Glass Disc Ring' });
  const rebuild = () => {
    material.userData.discRadius.value = CONFIG.ring.discRadius;
    ring.build();
    scatter.resize(); // disc count may have changed; ring snaps back to assembled
  };

  const fRing = gui.addFolder('Ring');
  fRing.add(CONFIG.ring, 'count', 6, 60, 1).onFinishChange(rebuild);
  fRing.add(CONFIG.ring, 'radius', 0.5, 2, 0.01);
  fRing.add(CONFIG.ring, 'discRadius', 0.2, 1.2, 0.01).onFinishChange(rebuild);
  fRing.add(CONFIG.ring, 'thickness', 0.005, 0.12, 0.001).onFinishChange(rebuild);
  fRing.add(CONFIG.ring, 'bulge', 0, 0.15, 0.001).onFinishChange(rebuild);
  fRing.add(CONFIG.ring, 'bulgePower', 1, 3, 0.1).onFinishChange(rebuild);

  const fTilt = gui.addFolder('Ring orientation');
  ['x', 'y', 'z'].forEach((k) => fTilt.add(CONFIG.tilt, k, -Math.PI, Math.PI, 0.01).onChange(applyTilt));

  const fTwist = gui.addFolder('Spiral twist');
  fTwist.add(CONFIG.twist, 'amount', 0, 1.2, 0.01);
  fTwist.add(CONFIG.twist, 'offset', -Math.PI, Math.PI, 0.01);
  fTwist.add(CONFIG.twist, 'waves', 0, 6, 1);
  fTwist.add(CONFIG.twist, 'speed', -1, 1, 0.01);

  const fMotion = gui.addFolder('Motion');
  fMotion.add(CONFIG.motion, 'flowSpeed', -0.2, 0.2, 0.001);
  fMotion.add(CONFIG.motion, 'wobble', 0, 0.3, 0.005);
  fMotion.add(CONFIG.motion, 'wobbleSpeed', 0, 1, 0.01);
  fMotion.add(CONFIG.mouse, 'strength', 0, 0.4, 0.01).name('mouse tilt');

  const m = CONFIG.material;
  const fMat = gui.addFolder('Material');
  fMat.addColor(m, 'color').onChange((v) => material.color.set(v));
  fMat.add(m, 'metalness', 0, 1, 0.01).onChange((v) => (material.metalness = v));
  fMat.add(m, 'roughness', 0, 1, 0.01).onChange((v) => (material.roughness = v));
  fMat.add(m, 'iridescence', 0, 1, 0.01).onChange((v) => (material.iridescence = v));
  fMat.add(m, 'iridescenceIOR', 1, 2.3, 0.01).onChange((v) => (material.iridescenceIOR = v));
  fMat.add(m, 'clearcoat', 0, 1, 0.01).onChange((v) => (material.clearcoat = v));
  fMat.add(m, 'clearcoatRoughness', 0, 1, 0.01).onChange((v) => (material.clearcoatRoughness = v));
  fMat.add(m, 'envIntensity', 0, 3, 0.01).onChange((v) => (material.envMapIntensity = v));
  fMat.add(m, 'innerShade', 0, 1, 0.01).onChange((v) => (material.userData.innerShade.value = v));

  const ex = CONFIG.explode;
  const fEx = gui.addFolder('Explode');
  fEx.add(ex, 'speedMin', 0, 8, 0.1);
  fEx.add(ex, 'speedMax', 0, 12, 0.1);
  fEx.add(ex, 'clickBoost', 0, 3, 0.05);
  fEx.add(ex, 'spread', 0, 1.5, 0.01);
  fEx.add(ex, 'cruiseSpeed', 0, 2, 0.01);
  fEx.add(ex, 'drag', 0.1, 5, 0.05);
  fEx.add(ex, 'wander', 0, 3, 0.05);
  fEx.add(ex, 'bounce', 0, 1, 0.01);
  fEx.add(ex, 'depthRange', 0, 3, 0.05);
  fEx.add(ex, 'spinCruise', 0, 3, 0.05);
  fEx.add(ex, 'returnDuration', 0.3, 4, 0.05);
  fEx.add(ex, 'returnStagger', 0, 2, 0.05);

  const fCam = gui.addFolder('Camera orbit');
  fCam.add(CONFIG.camera.orbit, 'enabled');
  fCam.add(CONFIG.camera.orbit, 'speed', 0, 0.3, 0.005);
  fCam.add(CONFIG.camera.orbit, 'bob', 0, 0.8, 0.01);

  const fPost = gui.addFolder('Bloom + exposure');
  fPost.add(CONFIG.bloom, 'strength', 0, 2, 0.01).onChange((v) => (bloom.strength = v));
  fPost.add(CONFIG.bloom, 'radius', 0, 1, 0.01).onChange((v) => (bloom.radius = v));
  fPost.add(CONFIG.bloom, 'threshold', 0, 2, 0.01).onChange((v) => (bloom.threshold = v));
  fPost.add(CONFIG.render, 'exposure', 0.2, 2.5, 0.01).onChange((v) => (renderer.toneMappingExposure = v));

  gui.add({
    copy() {
      const text = JSON.stringify(CONFIG, null, 2);
      navigator.clipboard?.writeText(text).catch(() => {});
      console.log(text);
    },
  }, 'copy').name('Copy config (JSON)');

  [fTilt, fMotion, fPost, fCam].forEach((f) => f.close());
}
