import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { CONFIG } from './config.js';
import { DiscRing, createGlassMaterial } from './ring.js';
import { createStudioEnvironment } from './studio-env.js';
import { CameraRig } from './camera-rig.js';
import { DiscScatter } from './explode.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const params = new URLSearchParams(location.search);

// ?quality=low for weak GPUs: 1x pixel ratio, no MSAA
if (params.get('quality') === 'low') {
  CONFIG.render.maxPixelRatio = 1;
  CONFIG.render.msaa = 0;
}
const canvas = document.getElementById('webgl');
const hint = document.getElementById('hint');
const hintText = hint.querySelector('span');

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
} catch (err) {
  document.body.insertAdjacentHTML('beforeend', '<p class="fallback">WebGL is not available on this device.</p>');
  throw err;
}
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.NeutralToneMapping; // keeps the violet/cyan hues true, rolls off highlights softly
renderer.toneMappingExposure = CONFIG.render.exposure;

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.environment = createStudioEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);

const material = createGlassMaterial(CONFIG.material, CONFIG.ring);
const ring = new DiscRing(CONFIG, material);

// Group nesting: mouse tilt > fixed tilt > slow wobble > ring
const mousePivot = new THREE.Group();
const tiltGroup = new THREE.Group();
const wobbleGroup = new THREE.Group();
scene.add(mousePivot);
mousePivot.add(tiltGroup);
tiltGroup.add(wobbleGroup);
wobbleGroup.add(ring.group);

function applyTilt() {
  tiltGroup.rotation.set(CONFIG.tilt.x, CONFIG.tilt.y, CONFIG.tilt.z);
}
applyTilt();

// ---------------------------------------------------------------------------
// Post processing: render (MSAA, HDR) -> bloom -> tone mapping + sRGB
// ---------------------------------------------------------------------------
const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: CONFIG.render.msaa });
const composer = new EffectComposer(renderer, rt);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), CONFIG.bloom.strength, CONFIG.bloom.radius, CONFIG.bloom.threshold);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Camera, explode controller, mouse
// ---------------------------------------------------------------------------
const rig = new CameraRig(camera, CONFIG.camera);
const scatter = new DiscScatter(ring, camera, CONFIG.explode);

const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
if (!reducedMotion) {
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { mouse.tx = 0; mouse.ty = 0; });
}

// ---------------------------------------------------------------------------
// Click / tap anywhere: explode or reassemble (Space / Enter do the same from the keyboard)
// ---------------------------------------------------------------------------
function updateHint() {
  hintText.textContent = scatter.state === 'exploded' ? 'Click to reassemble' : 'Click anywhere';
}
canvas.addEventListener('click', (e) => {
  const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
  const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
  scatter.toggle(ndcX, ndcY, animTime);
  updateHint();
});
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' && e.code !== 'Enter') return;
  if (e.target.closest?.('.lil-gui')) return;
  e.preventDefault();
  scatter.toggle(0, 0, animTime);
  updateHint();
});
updateHint();

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  composer.setPixelRatio(dpr);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  rig.setAspect(camera.aspect);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document); // no time jump after switching tabs
const motionScale = reducedMotion ? 0.15 : 1;
let animTime = 0;

renderer.setAnimationLoop((now) => {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  animTime += dt * motionScale;

  // camera first (explode bounds are measured from it), then the discs
  rig.update(dt, scatter.isAssembled);
  scatter.update(dt * (reducedMotion ? 0.5 : 1), animTime);

  // slow breathing of the whole ring
  const { wobble, wobbleSpeed } = CONFIG.motion;
  const wt = animTime * wobbleSpeed * Math.PI * 2;
  wobbleGroup.rotation.set(Math.sin(wt) * wobble, Math.cos(wt * 0.8) * wobble * 0.8, 0);

  // mouse tilt (damped)
  const mk = 1 - Math.exp(-CONFIG.mouse.smoothing * dt);
  mouse.x += (mouse.tx - mouse.x) * mk;
  mouse.y += (mouse.ty - mouse.y) * mk;
  mousePivot.rotation.set(mouse.y * CONFIG.mouse.strength, mouse.x * CONFIG.mouse.strength, 0);

  composer.render();
});

// ---------------------------------------------------------------------------
// Optional live tuning panel: add ?debug to the URL
// ---------------------------------------------------------------------------
if (params.has('debug')) {
  import('./debug.js').then(({ createDebugPanel }) =>
    createDebugPanel({ CONFIG, ring, material, bloom, renderer, applyTilt, scatter })
  );
}
