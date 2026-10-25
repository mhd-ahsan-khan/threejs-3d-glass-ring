/**
 * Every tunable value lives here.
 * Open the page with ?debug at the end of the URL to tweak them live,
 * then press "Copy config" in the panel and paste the result back into this file.
 */
export const CONFIG = {
  ring: {
    count: 28,            // number of discs
    radius: 1.0,          // radius of the circular path the discs sit on
    discRadius: 0.52,     // keep below ring.radius so the centre hole stays open
    thickness: 0.01,      // edge thickness (thin, so each blade tapers to a point)
    bulge: 0.065,         // how much each face domes outward; centre thickness = thickness + 2 * bulge
    bulgePower: 1,        // 1 = true lens (pointed blade from the front), 2 = flatter face
    segments: 128,        // roundness of each disc (stays smooth when zoomed in)
  },

  // Orientation of the whole ring in radians (0, 0, 0 = ring faces the camera straight on)
  tilt: { x: 0, y: 0, z: 0 },

  // Optional disc lean around its own radial axis.
  // amount = 0: every disc is exactly radial and edge-on to the camera (perfect sunburst).
  // (For the angled spiral look use: amount 0.85, waves 1, offset -0.8, speed 0.015,
  //  plus tilt x -0.22, y 0.18 and bulge 0.02 / bulgePower 2 / thickness 0.034)
  twist: {
    amount: 0,
    waves: 0,
    offset: 0,
    speed: 0,
  },

  motion: {
    flowSpeed: 0.022,     // ring revolutions per second (discs travel along the path)
    wobble: 0,            // slow breathing tilt of the whole ring (0 keeps a perfect front view)
    wobbleSpeed: 0.22,
  },

  material: {
    color: '#7f70ff',
    metalness: 0.82,
    roughness: 0.15,
    iridescence: 0.4,
    iridescenceIOR: 1.35,
    iridescenceThickness: [180, 520],
    clearcoat: 1.0,
    clearcoatRoughness: 0.06,
    envIntensity: 1.15,
    innerShade: 0.35,     // brightness near the centre hole (1 = no darkening), adds depth
  },

  bloom: { strength: 0.32, radius: 0.5, threshold: 0.95 },

  render: {
    exposure: 1.0,
    maxPixelRatio: 2,     // 2 = sharp on retina screens; lower to 1.5 for weaker GPUs
    msaa: 4,              // anti-aliasing samples (0 to turn off)
  },

  mouse: {
    strength: 0,          // max tilt toward the cursor (radians), 0 = locked front view
    smoothing: 3,
  },

  // Fixed camera (no scroll zoom). Change `position` to change the viewing angle.
  camera: {
    position: [0, 0, 5.7],
    target: [0, 0, 0],
    fov: 35,

    // Camera circles around the ring automatically. It eases to a stop while the
    // discs are exploded and starts again once the ring is whole.
    orbit: {
      enabled: true,
      speed: 0.04,        // revolutions per second (0.04 = one full circle every 25 s)
      direction: 1,       // 1 = counterclockwise seen from above, -1 = clockwise
      bob: 0.25,          // up / down swing in radians (0 = stay level)
      bobSpeed: 0.03,     // up / down cycles per second
      easing: 3,          // how quickly the orbit pauses / resumes
    },
  },

  // Click anywhere: discs burst away from the click point and float in zero gravity,
  // bouncing off the screen edges. Click again: they fly back into the ring.
  explode: {
    speedMin: 2.0,        // launch speed range (world units per second)
    speedMax: 4.0,
    clickBoost: 0.8,      // extra launch speed for discs closest to the click
    spread: 0.45,         // random direction spread (0 = straight away from the click)
    depthKick: 0.35,      // how much discs also fly toward / away from the camera
    cruiseSpeed: 0.35,    // discs slow down to this drifting speed and keep floating
    drag: 1.3,            // how fast the burst speed bleeds off
    wander: 0.5,          // gentle random floating push
    bounce: 0.85,         // speed kept after hitting a screen edge (1 = no loss)
    edgePadding: 0.05,    // extra gap kept from the screen edge
    depthRange: 1.6,      // how far discs may drift toward / away from the camera
    spinMin: 1.5,         // tumble speed range on launch (radians per second)
    spinMax: 5.0,
    spinCruise: 0.5,      // lazy tumble speed while floating
    returnDuration: 1.5,  // seconds for a disc to fly back into its slot
    returnStagger: 0.45,  // random start delay spread, so they don't all move at once
  },
};
