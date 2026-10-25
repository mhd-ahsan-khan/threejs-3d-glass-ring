import * as THREE from 'three';

/**
 * A hidden "photo studio" that the discs reflect. It is never drawn on screen
 * (the background stays black); it is baked once into an environment map with PMREM.
 *
 * - A gradient dome gives the soft colour shift across the faces
 *   (cyan low, indigo in the middle, violet / pink high on the right).
 * - Bright softbox panels give the crisp highlight lines on the rounded rims.
 *
 * Panel colours are multiplied above 1.0 so they act as HDR light sources.
 */
export function createStudioEnvironment(renderer) {
  const studio = new THREE.Scene();
  const disposables = [];

  // ---------- Gradient dome ----------
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      cLow: { value: new THREE.Color('#12c4ff').multiplyScalar(1.1) },
      cMid: { value: new THREE.Color('#2614d6').multiplyScalar(0.3) },
      cHigh: { value: new THREE.Color('#5b2cff').multiplyScalar(0.75) },
      cPink: { value: new THREE.Color('#ff5fd8').multiplyScalar(0.9) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 cLow, cMid, cHigh, cPink;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 col = mix(cMid, cLow, smoothstep(0.05, -0.75, y));
        col = mix(col, cHigh, smoothstep(0.0, 0.8, y));
        // pink glow from the upper right
        float pink = smoothstep(0.35, 1.0, dot(d, normalize(vec3(0.8, 0.55, 0.25))));
        col += cPink * pink;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const domeGeo = new THREE.SphereGeometry(30, 64, 32);
  studio.add(new THREE.Mesh(domeGeo, domeMat));
  disposables.push(domeGeo, domeMat);

  // ---------- Softbox panels ----------
  const panelGeo = new THREE.PlaneGeometry(1, 1);
  disposables.push(panelGeo);

  const panel = (hex, intensity, w, h, pos, lookAt = [0, 0, 0]) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    disposables.push(mat);
    const mesh = new THREE.Mesh(panelGeo, mat);
    mesh.scale.set(w, h, 1);
    mesh.position.set(...pos);
    mesh.lookAt(...lookAt);
    studio.add(mesh);
  };

  // key light: wide lavender-white strip above, slightly toward the viewer
  panel('#f2efff', 7.0, 14, 2.4, [0, 9, 4]);
  // cyan fill from lower left front
  panel('#3fe2ff', 5.5, 8, 7, [-6, -7, 5]);
  // pink accent upper right
  panel('#ff7ae2', 4.5, 5, 8, [8, 5, 3]);
  // violet rim from behind (lights the edges facing away)
  panel('#7a4cff', 3.5, 16, 4, [0, 1, -10]);
  // thin blue strip on the left for an extra rim line
  panel('#5a7bff', 3.0, 1.2, 10, [-9, 2, 0]);
  // small hot spot front right for sparkle on rims
  panel('#ffffff', 9.0, 1.5, 1.5, [5, 2, 8]);
  // thin white strip low right: second rim line on the lower discs
  panel('#dff6ff', 6.0, 10, 0.8, [3, -8, 3]);

  // ---------- Bake ----------
  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromScene(studio, 0.035);
  pmrem.dispose();
  disposables.forEach((d) => d.dispose());

  return target.texture;
}
