import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GROUND, Pt, WOODS, surfaceAt } from './courseLayout'

type HeightFn = (x: number, z: number) => number

// Small seeded generator so the trees land in the same places on every load
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function insidePolygon([x, z]: Pt, poly: Pt[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j]
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside
  }
  return inside
}

// ── Trees ─────────────────────────────────────────────────────────────────────
// Gum-style trees: a pale slender trunk with a clumpy canopy, drawn as two
// instanced meshes. Dense inside the WOODS outlines, sparse across the rough,
// and never on fairways, greens, sand, water, paths or the keepClear circles.
export function addTrees(
  scene: THREE.Scene,
  physicsWorld: RAPIER.World,
  surface: THREE.DataTexture,
  heightAt: HeightFn,
  keepClear: Array<[x: number, z: number, radius: number]>,
) {
  const rand = seeded(20261111)

  // Clear = rough under the trunk and for a canopy's width around it
  const clear = (x: number, z: number) => {
    for (const [ox, oz] of [[0, 0], [5, 0], [-5, 0], [0, 5], [0, -5]]) {
      const [fair, green, sand, water] = surfaceAt(surface, x + ox, z + oz)
      if (fair > 0.3 || green > 0.1 || sand > 0.1 || water > 0.3) return false
    }
    return keepClear.every(([cx, cz, r]) => Math.hypot(x - cx, z - cz) > r)
  }

  const spots: Pt[] = []
  // Jittered grid: even spacing without visible rows
  const scatter = (x0: number, x1: number, z0: number, z1: number, step: number, keep: (p: Pt) => boolean) => {
    for (let x = x0; x < x1; x += step) {
      for (let z = z0; z < z1; z += step) {
        const p: Pt = [x + (rand() - 0.5) * step * 0.85, z + (rand() - 0.5) * step * 0.85]
        if (keep(p) && clear(p[0], p[1])) spots.push(p)
      }
    }
  }
  WOODS.forEach(poly => {
    const xs = poly.map(p => p[0]), zs = poly.map(p => p[1])
    scatter(Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs), 7, p => insidePolygon(p, poly))
  })
  // Lone trees and small groups dotted through the rough
  scatter(-540, 130, -610, 100, 42, p => rand() < 0.55 && !WOODS.some(poly => insidePolygon(p, poly)))

  // Canopy: three lumpy blobs merged into one shape
  const blob = (x: number, y: number, z: number, r: number) => {
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.scale(1, 0.75, 1)
    g.translate(x, y, z)
    return g
  }
  const canopyGeo = mergeGeometries([blob(0, 0, 0, 1), blob(0.7, 0.3, 0.3, 0.7), blob(-0.6, 0.15, -0.4, 0.75)])
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 1, 6)
  trunkGeo.translate(0, 0.5, 0)

  const uTime = { value: 0 }
  const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, flatShading: true })
  canopyMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime
    // Gentle sway, strongest at the top of the canopy, out of step from tree to tree
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float tSway = sin(uTime * 1.2 + instanceMatrix[3].x * 0.31 + instanceMatrix[3].z * 0.23);
          transformed.x += tSway * 0.05 * (position.y + 1.0);
          transformed.z += tSway * 0.03 * (position.y + 1.0);
        #endif`)
  }
  const trunkMat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 })

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length)
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, spots.length)
  const body = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  const m = new THREE.Object3D()
  const color = new THREE.Color()

  spots.forEach(([x, z], i) => {
    const y = heightAt(x, z)
    const trunkH = 4.5 + rand() * 3.5
    const spread = 2.6 + rand() * 1.8

    m.position.set(x, y - 0.1, z)
    m.rotation.set(0, rand() * Math.PI * 2, 0)
    m.scale.set(1 + rand() * 0.5, trunkH, 1 + rand() * 0.5)
    m.updateMatrix()
    trunks.setMatrixAt(i, m.matrix)
    trunks.setColorAt(i, color.setHSL(0.09, 0.12, 0.5 + rand() * 0.2))   // pale gum bark

    m.position.set(x, y + trunkH + spread * 0.25, z)
    m.scale.set(spread, spread * (0.75 + rand() * 0.3), spread)
    m.updateMatrix()
    canopies.setMatrixAt(i, m.matrix)
    canopies.setColorAt(i, color.setHSL(0.25 + rand() * 0.06, 0.4 + rand() * 0.15, 0.11 + rand() * 0.07))

    // Something solid for the cart to bump into
    physicsWorld.createCollider(RAPIER.ColliderDesc.cylinder(2, 0.35).setTranslation(x, y + 2, z), body)
  })

  for (const mesh of [trunks, canopies]) {
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
  }
  canopies.onBeforeRender = () => { uTime.value = performance.now() / 1000 }
}

// ── Grass blades ──────────────────────────────────────────────────────────────
// One patch of blades that travels with the camera. Each blade has a fixed
// spot in an endlessly repeating grid, and the vertex shader wraps that grid
// around the camera — so the same blades are reused wherever you drive.
// The shader also reads the ground height and the surface map, so blades stand
// on the terrain and only grow in the rough.
const BLADES = 120000
const PATCH = 80          // metres across
const SEGS = 256          // must match the ground mesh so blades sit on it

const BLADE_VERTEX = /* glsl */ `
vHf = position.y;
vec2 tBase = mod(aOffset - uCenter, uPatch) - 0.5 * uPatch + uCenter;      // wrap round the camera
// Blades shrink to nothing over a long distance towards the patch edge, so
// they grow in gradually as you drive instead of popping up
float tFade = 1.0 - smoothstep(uPatch * 0.12, uPatch * 0.47, length(tBase - uCenter));
vec2 tUv = (tBase - uMapOrigin) / uMapSize;
vec4 tM = texture2D(uSurfaceMap, tUv);
float tCover = max(max(smoothstep(0.25, 0.5, tM.r), smoothstep(0.08, 0.18, tM.g)),
                   max(smoothstep(0.08, 0.18, tM.b), smoothstep(0.25, 0.5, tM.a)));
float tH = (0.10 + 0.20 * aRand.y) * (1.0 - tCover) * tFade;               // 0 = no blade here
float tGround = texture2D(uHeightMap, tUv * (${SEGS}.0 / ${SEGS + 1}.0) + 0.5 / ${SEGS + 1}.0).r;
float tA = aRand.x * 6.2832;
float tWind = sin(uTime * 1.7 + tBase.x * 0.35 + tBase.y * 0.27) * 0.6
            + sin(uTime * 0.6 + tBase.x * 0.06 - tBase.y * 0.04) * 0.4;
float tBend = (tWind * 0.16 + (aRand.z - 0.5) * 0.25) * vHf * vHf * tH / 0.4;
vec3 transformed = vec3(
  tBase.x + cos(tA) * position.x * 0.07 + tBend,
  tGround + vHf * tH,
  tBase.y + sin(tA) * position.x * 0.07 + tBend * 0.6);
vTone = 0.88 + 0.24 * aRand.y;
`

export function createGrass(surface: THREE.Texture, heightAt: HeightFn): THREE.Mesh {
  const minX = GROUND.centerX - GROUND.size / 2, minZ = GROUND.centerZ - GROUND.size / 2

  // Ground height as a texture, one texel per ground-mesh vertex
  const N = SEGS + 1
  const heights = new Uint16Array(N * N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      heights[j * N + i] = THREE.DataUtils.toHalfFloat(
        heightAt(minX + (i / SEGS) * GROUND.size, minZ + (j / SEGS) * GROUND.size))
    }
  }
  const heightMap = new THREE.DataTexture(heights, N, N, THREE.RedFormat, THREE.HalfFloatType)
  heightMap.magFilter = heightMap.minFilter = THREE.LinearFilter
  heightMap.needsUpdate = true

  // One blade: a tapering strip, x across (−0.5…0.5), y up (0…1)
  const geo = new THREE.InstancedBufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.5, 0, 0,  0.5, 0, 0,  -0.35, 0.4, 0,  0.35, 0.4, 0,  -0.18, 0.75, 0,  0.18, 0.75, 0,  0, 1, 0,
  ], 3))
  geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4, 4, 5, 6])
  const rand = seeded(7)
  const offsets = new Float32Array(BLADES * 2), rands = new Float32Array(BLADES * 3)
  for (let i = 0; i < BLADES; i++) {
    offsets[i * 2] = rand() * PATCH
    offsets[i * 2 + 1] = rand() * PATCH
    rands.set([rand(), rand(), rand()], i * 3)
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 2))
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rands, 3))
  geo.instanceCount = BLADES

  const uniforms = {
    uCenter: { value: new THREE.Vector2() },
    uPatch: { value: PATCH },
    uTime: { value: 0 },
    uMapOrigin: { value: new THREE.Vector2(minX, minZ) },
    uMapSize: { value: GROUND.size },
    uSurfaceMap: { value: surface },
    uHeightMap: { value: heightMap },
    // Close to the terrain shader's rough colours, so the patch edge doesn't show
    uRoot: { value: new THREE.Color(0x3a5c20) },
    uTip: { value: new THREE.Color(0x628632) },
  }

  // Standard material, so blades take the same sun, shadows and fog as the ground
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
        attribute vec2 aOffset;
        attribute vec3 aRand;
        uniform vec2 uCenter, uMapOrigin;
        uniform float uPatch, uTime, uMapSize;
        uniform sampler2D uSurfaceMap, uHeightMap;
        varying float vHf, vTone;`)
      // Blades are lit as if they were the ground (normal straight up), so they blend into it
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = vec3(0.0, 1.0, 0.0);')
      .replace('#include <begin_vertex>', BLADE_VERTEX)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRoot, uTip;\nvarying float vHf, vTone;')
      .replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb = mix(uRoot, uTip, vHf) * vTone;')
      // …on both faces: undo the flip three.js applies to back faces
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nnormal = normalize(vNormal);')
  }

  const grass = new THREE.Mesh(geo, mat)
  grass.frustumCulled = false     // the shader moves the blades, so the bounds mean nothing
  grass.receiveShadow = true
  const dir = new THREE.Vector3()
  grass.onBeforeRender = (_renderer, _scene, camera) => {
    // Centre the patch a little ahead of the camera, where the blades are actually seen
    camera.getWorldDirection(dir)
    const len = Math.hypot(dir.x, dir.z) || 1
    uniforms.uCenter.value.set(camera.position.x + (dir.x / len) * 18, camera.position.z + (dir.z / len) * 18)
    uniforms.uTime.value = performance.now() / 1000
  }
  return grass
}
