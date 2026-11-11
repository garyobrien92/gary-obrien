import * as THREE from 'three'
import { GROUND } from './courseLayout'

// ── Terrain material ──────────────────────────────────────────────────────────
// MeshStandardMaterial (so sun, shadows, fog and the HDR environment all still
// work) with the colour computed in the fragment shader from world position:
//   • layered noise breaks up the grass so nothing visibly tiles
//   • the surface map (see courseLayout.ts) picks rough / fairway / green / sand / water
//   • fairways and greens get mowing stripes; water gets a glossy rippled surface

const FRAG_HEAD = /* glsl */ `
uniform sampler2D uSurfaceMap;
uniform vec2 uMapOrigin;
uniform float uMapSize;
uniform float uTime;
uniform vec3 uRoughA, uRoughB, uDry;
uniform vec3 uFairA, uFairB;
uniform vec3 uGreenA, uGreenB;
uniform vec3 uSandA, uSandB;
uniform vec3 uWaterDeep, uWaterEdge;
uniform vec3 uSkyHorizon, uSkyZenith;
varying vec3 vTerrainPos;

float tHash(vec2 i) {
  i = mod(i, 289.0);
  return fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453);
}
float tNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), f.x),
             mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float tFbm(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int k = 0; k < 4; k++) { s += a * tNoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s / 0.9375;
}
// Mowing stripes: 0/1 bands "width" metres wide, anti-aliased and faded out
// once they get thinner than a pixel so they never shimmer in the distance.
float tStripe(float coord, float width) {
  float ph = coord / width;
  float fw = fwidth(ph);
  float tri = abs(fract(ph * 0.5) - 0.5) * 4.0 - 1.0;
  float band = smoothstep(-1.0, 1.0, tri / clamp(fw * 2.0, 0.06, 1.0));
  return mix(0.5, band, 1.0 - smoothstep(0.35, 1.0, fw));
}
`

const FRAG_COLOR = /* glsl */ `
vec2 tP = vTerrainPos.xz;
vec4 tMask = texture2D(uSurfaceMap, (tP - uMapOrigin) / uMapSize);
float tNear = 1.0 - smoothstep(12.0, 90.0, length(cameraPosition - vTerrainPos));

// Wobble the mask edges a little so mown lines look hand-cut, not vector-drawn
float tEdge = (tNoise(tP * 0.15) - 0.5) * 0.3;
float tFair  = smoothstep(0.38, 0.62, tMask.r + tEdge);
float tGreen = smoothstep(0.38, 0.62, tMask.g + tEdge * 0.4);
float tSand  = smoothstep(0.38, 0.62, tMask.b + tEdge);
float tWater = smoothstep(0.42, 0.58, tMask.a + tEdge * 0.6);

float tMacro = tFbm(tP * 0.006);                 // ~150 m colour drift
float tMeso  = tFbm(tP * 0.045 + 31.7);          // ~20 m patches
float tFine  = tNoise(tP * 1.7);                 // clumps
float tBlade = tNoise(tP * 13.0 + 7.3);          // blade-scale grain
float tDetail = ((tFine - 0.5) * 0.30 + (tBlade - 0.5) * 0.30) * tNear;

// Rough: darker, patchy, with dry straw-coloured areas
vec3 cRough = mix(uRoughA, uRoughB, smoothstep(0.25, 0.75, tMacro * 0.55 + tMeso * 0.45));
cRough = mix(cRough, uDry, smoothstep(0.60, 0.90, tMeso) * 0.22);
cRough *= 1.0 + tDetail * 1.3;

// Fairway: striped, more even
// (no stripes on green collars and tee pads — the surface map marks those
// with a faint value in the green channel, below the putting-surface threshold)
float tByGreen = smoothstep(0.08, 0.2, tMask.g);
vec3 cFair = mix(uFairA, uFairB, mix(tStripe(dot(tP, vec2(0.8, 0.6)), 7.0), 0.5, tByGreen));
cFair *= (0.93 + 0.14 * tMeso) * (1.0 + tDetail * 0.6);

// Green: fine cross-cut checker
float tChk = tStripe(tP.x + tP.y, 3.2) + tStripe(tP.x - tP.y, 3.2);
vec3 cGreen = mix(uGreenA, uGreenB, tChk * 0.5);
cGreen *= (0.97 + 0.06 * tMeso) * (1.0 + tDetail * 0.25);

vec3 cSand = mix(uSandA, uSandB, tNoise(tP * 2.5)) * (1.0 + tDetail * 0.5);
vec3 cWater = mix(uWaterEdge, uWaterDeep, smoothstep(0.55, 0.98, tMask.a));

vec3 tCol = mix(cRough, cFair, tFair);
tCol = mix(tCol, cGreen, tGreen);
tCol = mix(tCol, cSand, tSand);
tCol = mix(tCol, cWater, tWater);
diffuseColor.rgb = tCol;

// Water ripples (world-space slope), faded with distance so they never alias
vec2 tWp = tP * 0.9;
vec2 tRip = vec2(
  sin(tWp.x * 1.3 + uTime * 0.9) + sin(tWp.y * 2.1 - uTime * 0.7 + tWp.x * 0.6),
  cos(tWp.y * 1.7 + uTime * 0.8) + cos(tWp.x * 2.3 + uTime * 0.6 - tWp.y * 0.5)) * 0.025 * tNear;
`

const FRAG_ROUGHNESS = /* glsl */ `
roughnessFactor = mix(roughnessFactor, 1.0, tSand);
`

const FRAG_NORMAL = /* glsl */ `
normal = normalize(normal + (viewMatrix * vec4(tRip.x, 0.0, tRip.y, 0.0)).xyz * tWater);
`

// Water reflects a simple sky gradient instead of the HDR environment map —
// at the grazing angles you see a pond from a cart, the env map's horizon
// smears into a brown band.
const FRAG_SPECULAR = /* glsl */ `
material.specularColor *= 1.0 - tWater;
material.specularF90 *= 1.0 - tWater;
`

const FRAG_EMISSIVE = /* glsl */ `
if (tWater > 0.01) {
  vec3 tV = normalize(cameraPosition - vTerrainPos);
  vec3 tN = normalize(vec3(tRip.x, 1.0, tRip.y));
  vec3 tR = reflect(-tV, tN);
  float tFres = 0.04 + 0.96 * pow(1.0 - max(dot(tV, tN), 0.0), 5.0);
  vec3 tSky = mix(uSkyHorizon, uSkyZenith, smoothstep(0.0, 0.6, tR.y));
  totalEmissiveRadiance += tSky * tFres * tWater;
}
`

export function makeTerrainMaterial(surfaceMap: THREE.Texture) {
  const c = (hex: number) => ({ value: new THREE.Color(hex) })
  const uniforms = {
    uSurfaceMap: { value: surfaceMap },
    uMapOrigin:  { value: new THREE.Vector2(GROUND.centerX - GROUND.size / 2, GROUND.centerZ - GROUND.size / 2) },
    uMapSize:    { value: GROUND.size },
    uTime:       { value: 0 },
    uRoughA: c(0x3f6122), uRoughB: c(0x5c7f2e), uDry: c(0x8f8a4a),
    uFairA:  c(0x4a8530), uFairB:  c(0x5c9a3b),
    uGreenA: c(0x58a347), uGreenB: c(0x6ab554),
    uSandA:  c(0xe6d6a6), uSandB:  c(0xd2be88),
    uWaterDeep: c(0x1c3a3c), uWaterEdge: c(0x4d6a52),
    uSkyHorizon: c(0xcfe0ee), uSkyZenith: c(0x6f9fd0),
  }

  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92, metalness: 0 })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTerrainPos;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvTerrainPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
      .replace('#include <color_fragment>', '#include <color_fragment>\n' + FRAG_COLOR)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + FRAG_ROUGHNESS)
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + FRAG_NORMAL)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FRAG_EMISSIVE)
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n' + FRAG_SPECULAR)
  }

  return { material, uniforms }
}
