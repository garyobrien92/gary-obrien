import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'

// ── Procedural grass texture ───────────────────────────────────────────────────
function makeGrassTexture(size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = '#3d7020'
  ctx.fillRect(0, 0, size, size)

  const colors = ['#3a6b1a', '#4a8c22', '#3d7a1c', '#2f5a15', '#468019', '#52961f', '#345e18']
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const len = 4 + Math.random() * 10
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.0
    ctx.strokeStyle = colors[Math.floor(Math.random() * colors.length)]
    ctx.lineWidth = 0.4 + Math.random() * 0.7
    ctx.globalAlpha = 0.6 + Math.random() * 0.4
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return new THREE.CanvasTexture(canvas)
}

function makeGrassMaterial(): THREE.MeshStandardMaterial {
  const tex = makeGrassTexture()
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(150, 150)  // ~8m per tile on 1200-unit ground
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })
}

export interface Zone {
  name: string
  position: THREE.Vector3
  triggerRadius: number
  data?: Record<string, string>
}

// ── Core layout anchors — 1 unit = 1 metre, origin = Pro Shop entrance ────────
export const CLUBHOUSE_POSITION  = new THREE.Vector3(  0, 0,    0)   // Pro Shop
export const PUTTING_GREEN_CENTER = new THREE.Vector3(-45, 0,    8)   // kidney green SW of pro shop
export const ENTRY_GATE_POSITION  = new THREE.Vector3(120, 0,  -40)   // entry arch from Raby Rd

// ── Lakeside Golf Club Camden — definitive hole coords (Apr 2026) ─────────────
// 1 unit = 1 metre. Directions match satellite + GPS data.
export const HOLES = [
  {
    id: 1,
    company: 'Over-C',
    role: 'Senior Fullstack Engineer & Web Developer',
    years: 'Jan 2018 – Dec 2023',
    description: 'Led frontend and backend development across hub microservices and web dashboards. Built with NestJS, MongoDB, Kafka, Vue.js, React, and AWS.',
    par: 4,
    yards: 400,
    // E → W: elevated tee near entry road, green far west
    teePosition:   new THREE.Vector3(  60,  3.5,  -95),
    greenPosition: new THREE.Vector3(-280, -1.5,  -90),
  },
  {
    id: 2,
    company: 'Viva Leisure',
    role: 'Full Stack Developer',
    years: 'Jan 2024 – Jun 2024',
    description: 'Full stack development with a focus on cloud infrastructure. Worked with Terraform, MongoDB, AWS ECS and ECR.',
    par: 4,
    yards: 352,
    // SSW → NNE: green corrected east +52m (was inside H3 fairway)
    teePosition:   new THREE.Vector3(-191, -1.5, -147),
    greenPosition: new THREE.Vector3( -68,  4.0, -445),
  },
  {
    id: 3,
    company: 'Hapana',
    role: 'Senior Fullstack Developer',
    years: 'Jul 2024 – Present',
    description: 'Tech Lead for the Integrations Squad. Built Stripe and Zapier integrations, a feature flagging system with pricing tiers, door access control systems, and infrastructure on Google Cloud with Terraform.',
    par: 3,
    yards: 162,
    // NE → SW: two GPS-confirmed ponds flank the fairway
    teePosition:   new THREE.Vector3(-100,  5.0, -490),
    greenPosition: new THREE.Vector3(-250,  0.5, -350),
  },
]

// ── Shared material palette (used across phases 1–7) ─────────────────────────
/* eslint-disable @typescript-eslint/no-unused-vars */
// @ts-ignore
const fairway    = () => new THREE.MeshStandardMaterial({ color: 0x4a8c22, roughness: 0.90, metalness: 0 })
// @ts-ignore
const green      = () => new THREE.MeshStandardMaterial({ color: 0x2dba52, roughness: 0.75, metalness: 0 })
// @ts-ignore
const fringe     = () => new THREE.MeshStandardMaterial({ color: 0x3ca840, roughness: 0.85, metalness: 0 })
// @ts-ignore
const sand       = () => new THREE.MeshStandardMaterial({ color: 0xe8d5a0, roughness: 1.0,  metalness: 0 })
// @ts-ignore
const path       = () => new THREE.MeshStandardMaterial({ color: 0xbcac90, roughness: 0.90, metalness: 0 })
// @ts-ignore
const wood       = () => new THREE.MeshStandardMaterial({ color: 0x8B6440, roughness: 0.85, metalness: 0 })
// @ts-ignore
const cream      = () => new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.75, metalness: 0.02 })
// @ts-ignore
const darkGreen  = () => new THREE.MeshStandardMaterial({ color: 0x1a4a10, roughness: 0.80, metalness: 0 })
// @ts-ignore
const stone      = () => new THREE.MeshStandardMaterial({ color: 0x9a9080, roughness: 0.90, metalness: 0.05 })
// @ts-ignore
const roofMat    = () => new THREE.MeshStandardMaterial({ color: 0x2c4a1a, roughness: 0.85, metalness: 0 })
// @ts-ignore
const whitePaint = () => new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.50, metalness: 0.05 })
// @ts-ignore
const flagRed    = () => new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.7,  metalness: 0, side: THREE.DoubleSide })
// @ts-ignore
const water      = () => new THREE.MeshStandardMaterial({ color: 0x1a6ea8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })
/* eslint-enable @typescript-eslint/no-unused-vars */

// ── Module-level terrain height — usable without a World instance ─────────────
// Phase 6 will add fairway corridors, tee mounds, green domes, and
// Rileys Creek depression using distToSeg helpers. For now: ambient only.
export function terrainHeightAt(x: number, z: number): number {
  const gauss = (cx: number, cz: number, r: number, h: number) => {
    const d2 = (x - cx) ** 2 + (z - cz) ** 2
    return h * Math.exp(-d2 / (2 * r * r))
  }

  // Small ambient undulation everywhere
  let h = 0.08 * Math.sin(x * 0.14 + 0.5) * Math.cos(z * 0.16 + 1.1)
        + 0.05 * Math.sin(x * 0.28 - 0.7) * Math.cos(z * 0.24 + 0.3)

  // Rolling hills — gentler inside course bounds, bigger outside
  // Course footprint: x ∈ [-420, 150], z ∈ [-510, 30]
  const inBounds = x > -440 && x < 170 && z > -530 && z < 50
  const s = inBounds ? 0.4 : 1.8
  h += s        * Math.sin(x * 0.010 + 0.4) * Math.cos(z * 0.011 + 0.7)
    + s * 0.55 * Math.sin(x * 0.020 - 0.8) * Math.cos(z * 0.022 + 0.3)
    + s * 0.30 * Math.sin(x * 0.038 + 1.8) * Math.sin(z * 0.034 - 0.5)

  // ── Flatten pro shop & putting green area ─────────────────────────────────
  const flat = Math.min(1,
    gauss(CLUBHOUSE_POSITION.x,   CLUBHOUSE_POSITION.z,   18, 1.5) +
    gauss(PUTTING_GREEN_CENTER.x, PUTTING_GREEN_CENTER.z, 16, 1.5)
  )
  h *= 1 - flat * 0.92

  // ── Putting green: gentle slope undulation ────────────────────────────────
  const pgDist = Math.sqrt((x - PUTTING_GREEN_CENTER.x) ** 2 + (z - PUTTING_GREEN_CENTER.z) ** 2)
  const pgInf  = Math.max(0, 1 - pgDist / 14)
  h += pgInf * (
    0.10 * Math.sin((x + 45) * 0.38) * Math.cos((z - 8) * 0.32) +
    0.05 * (z - PUTTING_GREEN_CENTER.z) / 10
  )

  // ── H1 tee mound (+3.5m) and green depression (−1.5m) ────────────────────
  h += gauss(  60, -95,  20, 3.5)   // H1 tee elevated area
  h -= gauss(-280, -90,  18, 1.5)   // H1 green slightly sunken

  return h
}

export class World {
  zones: Zone[] = []
  puttingGreenCenter = PUTTING_GREEN_CENTER.clone()
  puttingGreenHolePositions: THREE.Vector3[] = []
  // @ts-ignore — used in Phase 1+ for physics colliders
  private physicsWorld!: RAPIER.World

  constructor(scene: THREE.Scene, physicsWorld: RAPIER.World, sunDirection: THREE.Vector3) {
    this.physicsWorld = physicsWorld
    this.addGround(scene, physicsWorld)
    this.addSunLight(scene, sunDirection)
    this.addProShop(scene)
    this.addPuttingGreen(scene)
    this.addEntryGate(scene)
    this.addCourseSignage(scene)
    this.addCartPath(scene, 1)   // Phase 1 segment: entry gate → pro shop → putting green
    // Phase 2 — addMapSign(scene)
    // Phase 3 — addHole1(scene) + addCartPath(scene, 3)
    // Phase 4 — addHole2(scene) + addCartPath(scene, 4)
    // Phase 5 — addHole3(scene) + addCartPath(scene, 5)
  }

  // ── Height function ─────────────────────────────────────────────────────────
  terrainHeight(x: number, z: number): number {
    return terrainHeightAt(x, z)
  }

  // ── Ground ─────────────────────────────────────────────────────────────────
  private addGround(scene: THREE.Scene, physicsWorld: RAPIER.World) {
    const SIZE = 1200  // covers full course footprint (x:-420→150, z:-510→30)
    const SEGS = 128   // 128×128 ≈ 9.4m per segment

    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGS, SEGS)
    geo.rotateX(-Math.PI / 2)  // lay flat; after this: getX=worldX, getZ=worldZ

    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, this.terrainHeight(pos.getX(i), pos.getZ(i)))
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()

    const groundMesh = new THREE.Mesh(geo, makeGrassMaterial())
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    // Build trimesh collider from the same displaced geometry
    const verts  = new Float32Array(pos.array)
    const idxs   = new Uint32Array(geo.index!.array)
    const groundBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    physicsWorld.createCollider(
      RAPIER.ColliderDesc.trimesh(verts, idxs),
      groundBody
    )
  }

  // ── Directional sun ─────────────────────────────────────────────────────────
  private addSunLight(scene: THREE.Scene, sunDir: THREE.Vector3) {
    scene.add(new THREE.HemisphereLight(0xb0d4f0, 0x3a6b1a, 0.6))

    const sun = new THREE.DirectionalLight(0xfff5d0, 2.5)
    sun.position.copy(sunDir).multiplyScalar(100)
    sun.castShadow = true
    sun.shadow.mapSize.width = 4096
    sun.shadow.mapSize.height = 4096
    sun.shadow.camera.near = 0.5
    sun.shadow.camera.far = 1200
    sun.shadow.camera.left  = -600
    sun.shadow.camera.right =  600
    sun.shadow.camera.top   =  600
    sun.shadow.camera.bottom = -600
    sun.shadow.bias = -0.0003
    scene.add(sun)
  }


  // ── Phase 1 — Pro Shop ────────────────────────────────────────────────────────
  // Timber pavilion at origin (0,0,0). Entrance faces south (+Z) toward putting green.
  // Layout: main hall 16×10m, veranda 16×4m on south face, hip roof, flag pole west side.
  private addProShop(scene: THREE.Scene) {
    const g = new THREE.Group()
    const baseY = this.terrainHeight(CLUBHOUSE_POSITION.x, CLUBHOUSE_POSITION.z)
    g.position.set(CLUBHOUSE_POSITION.x, baseY, CLUBHOUSE_POSITION.z)
    scene.add(g)

    // ── Raised concrete pad ───────────────────────────────────────────────────
    const pad = new THREE.Mesh(new THREE.BoxGeometry(22, 0.35, 16), stone())
    pad.position.set(0, 0.175, 1)
    pad.receiveShadow = true
    g.add(pad)

    // Retaining wall (south edge of pad, visible from course side)
    const retaining = new THREE.Mesh(new THREE.BoxGeometry(22, 0.6, 0.35), stone())
    retaining.position.set(0, -0.15, 9.18)
    retaining.castShadow = true
    retaining.receiveShadow = true
    g.add(retaining)

    // ── Main building body (timber weatherboard, cream) ───────────────────────
    const body = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 10), cream())
    body.position.set(0, 2.35, -1)
    body.castShadow = true
    body.receiveShadow = true
    g.add(body)

    // Timber batten trim at top of walls
    const trim = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.2, 10.4), wood())
    trim.position.set(0, 4.45, -1)
    g.add(trim)

    // ── Hip roof ──────────────────────────────────────────────────────────────
    const roofMesh = new THREE.Mesh(new THREE.BoxGeometry(18, 0.25, 12.5), roofMat())
    roofMesh.position.set(0, 4.7, -1)
    roofMesh.castShadow = true
    g.add(roofMesh)

    // Ridge cap
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(12, 0.4, 0.4), darkGreen())
    ridge.position.set(0, 4.95, -1)
    g.add(ridge)

    // ── South face — windows ──────────────────────────────────────────────────
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88c8f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.55 })
    const frameMat2 = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.7 })
    ;[-5.5, -2.8, 2.8, 5.5].forEach(x => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 0.1), glassMat)
      win.position.set(x, 2.5, 4.06)
      g.add(win)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.8, 0.06), frameMat2)
      frame.position.set(x, 2.5, 4.03)
      g.add(frame)
    })

    // ── South face — central door ─────────────────────────────────────────────
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 0.12), wood())
    door.position.set(0, 1.65, 4.07)
    g.add(door)

    // ── Veranda (south face) ──────────────────────────────────────────────────
    const verandaFloor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.18, 4), stone())
    verandaFloor.position.set(0, 0.44, 6)
    verandaFloor.receiveShadow = true
    g.add(verandaFloor)

    ;[-6.5, -3.25, 0, 3.25, 6.5].forEach(x => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), wood())
      post.position.set(x, 1.95, 7.5)
      post.castShadow = true
      g.add(post)
    })

    // Veranda roof (slopes from wall down to posts)
    const verandaRoof = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.15, 4.8), roofMat())
    verandaRoof.position.set(0, 3.6, 6.4)
    verandaRoof.castShadow = true
    g.add(verandaRoof)

    // ── "PRO SHOP" canvas sign ────────────────────────────────────────────────
    const signCanvas = document.createElement('canvas')
    signCanvas.width = 512; signCanvas.height = 128
    const sCtx = signCanvas.getContext('2d')!
    sCtx.fillStyle = '#1a4a10'
    sCtx.fillRect(0, 0, 512, 128)
    sCtx.strokeStyle = '#8a6820'
    sCtx.lineWidth = 5
    sCtx.strokeRect(4, 4, 504, 120)
    sCtx.fillStyle = '#f0c832'
    sCtx.font = 'bold 62px Georgia'
    sCtx.textAlign = 'center'
    sCtx.textBaseline = 'middle'
    sCtx.fillText('PRO SHOP', 256, 64)
    const signTex = new THREE.CanvasTexture(signCanvas)
    const signBoard = new THREE.Mesh(
      new THREE.BoxGeometry(5.5, 1.0, 0.12),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.55, side: THREE.DoubleSide })
    )
    signBoard.position.set(0, 4.1, 4.15)
    g.add(signBoard)

    // ── Flag pole (west side) ─────────────────────────────────────────────────
    const poleMat2 = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.4, metalness: 0.6 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.055, 8.5, 10), poleMat2)
    pole.position.set(-10, 4.25, 0)
    pole.castShadow = true
    g.add(pole)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), flagRed())
    flag.position.set(-9.25, 7.8, 0)
    g.add(flag)

    // ── Physics collider (main building volume) ───────────────────────────────
    const shopBody = this.physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    this.physicsWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(8, 2.5, 5).setTranslation(
        CLUBHOUSE_POSITION.x,
        baseY + 2.5,
        CLUBHOUSE_POSITION.z - 1
      ),
      shopBody
    )

    this.zones.push({
      name: 'pro_shop',
      position: new THREE.Vector3(CLUBHOUSE_POSITION.x, baseY, CLUBHOUSE_POSITION.z),
      triggerRadius: 15,
      data: { title: 'Pro Shop', subtitle: 'Lakeside Golf Club' }
    })
  }

  // ── Phase 1 — Putting Green ────────────────────────────────────────────────────
  // Kidney-shaped practice green at (-45, 0, 8). 3 holes, cups, flags, sign post.
  // puttingGreenHolePositions is populated here for Experience.ts (putting mini-game).
  private addPuttingGreen(scene: THREE.Scene) {
    const cx = this.puttingGreenCenter.x   // -45
    const cz = this.puttingGreenCenter.z   //   8
    const cy = this.terrainHeight(cx, cz)

    // ── Fringe (slightly larger kidney) ──────────────────────────────────────
    const fringeShape = new THREE.Shape()
    fringeShape.moveTo( 13,   1)
    fringeShape.bezierCurveTo( 15,  -5,  11, -12,   3, -12)
    fringeShape.bezierCurveTo( -4, -12, -13,  -8, -14,   0)
    fringeShape.bezierCurveTo(-14,   5, -10,  12,  -3,  13)
    fringeShape.bezierCurveTo(  3,  13,  11,  10,  13,   1)
    const fMesh = new THREE.Mesh(new THREE.ShapeGeometry(fringeShape, 32), fringe())
    fMesh.rotation.x = -Math.PI / 2
    fMesh.position.set(cx, cy + 0.008, cz)
    fMesh.receiveShadow = true
    scene.add(fMesh)

    // ── Green surface (kidney) with gentle undulation ─────────────────────────
    const pgShape = new THREE.Shape()
    pgShape.moveTo( 11,   1)
    pgShape.bezierCurveTo( 12,  -4,   9, -10,   2, -10)
    pgShape.bezierCurveTo( -3, -10, -11,  -6, -12,   0)
    pgShape.bezierCurveTo(-12,   4,  -8,  10,  -2,  11)
    pgShape.bezierCurveTo(  3,  11,  10,   8,  11,   1)
    const greenMesh = new THREE.Mesh(this.makeUndulatedGreenGeo(pgShape, 0.14), green())
    greenMesh.rotation.x = -Math.PI / 2
    greenMesh.position.set(cx, cy + 0.02, cz)
    greenMesh.receiveShadow = true
    scene.add(greenMesh)

    // ── 3 hole positions spread across the kidney ─────────────────────────────
    const flagColors = [0xcc2222, 0x2244cc, 0xddaa00]
    this.puttingGreenHolePositions = [
      new THREE.Vector3(cx - 5,   this.terrainHeight(cx - 5,   cz + 4),   cz + 4),
      new THREE.Vector3(cx + 5,   this.terrainHeight(cx + 5,   cz - 3),   cz - 3),
      new THREE.Vector3(cx + 1,   this.terrainHeight(cx + 1,   cz + 8),   cz + 8),
    ]
    this.puttingGreenHolePositions.forEach((pos, i) => {
      this.addCupAndFlag(scene, pos, flagColors[i], 0.12)
    })

    // ── Directional sign post (east side, facing east toward pro shop) ────────
    this.addSignPost(scene, new THREE.Vector3(cx + 14, cy, cz), darkGreen())

    this.zones.push({
      name: 'putting_green',
      position: this.puttingGreenCenter.clone(),
      triggerRadius: 16
    })
  }

  // ── Phase 1 — Entry Gate ──────────────────────────────────────────────────────
  // Two stone pillars + arch beam marking the course entrance from Raby Road.
  private addEntryGate(scene: THREE.Scene) {
    const gx = ENTRY_GATE_POSITION.x   //  120
    const gz = ENTRY_GATE_POSITION.z   //  -40
    const gy = this.terrainHeight(gx, gz)

    const pillarMat = stone()
    const archMat   = darkGreen()

    // Two pillars
    ;[-5, 5].forEach(xOff => {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.5, 1.2), pillarMat)
      pillar.position.set(gx + xOff, gy + 2.25, gz)
      pillar.castShadow = true
      scene.add(pillar)

      // Capping stone
      const cap = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), pillarMat)
      cap.position.set(gx + xOff, gy + 4.7, gz)
      scene.add(cap)
    })

    // Arch beam spanning the two pillars
    const beam = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 0.6), archMat)
    beam.position.set(gx, gy + 4.5, gz)
    beam.castShadow = true
    scene.add(beam)

    // "LAKESIDE GOLF CLUB" canvas sign on the beam
    const signCanvas = document.createElement('canvas')
    signCanvas.width = 512; signCanvas.height = 96
    const sCtx = signCanvas.getContext('2d')!
    sCtx.fillStyle = '#1a4a10'
    sCtx.fillRect(0, 0, 512, 96)
    sCtx.fillStyle = '#f0c832'
    sCtx.font = 'bold 36px Georgia'
    sCtx.textAlign = 'center'
    sCtx.textBaseline = 'middle'
    sCtx.fillText('LAKESIDE GOLF CLUB', 256, 48)
    const tex = new THREE.CanvasTexture(signCanvas)
    const gateSign = new THREE.Mesh(
      new THREE.BoxGeometry(9.5, 0.9, 0.1),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })
    )
    gateSign.position.set(gx, gy + 4.5, gz - 0.35)
    scene.add(gateSign)
  }

  // ── Cart path — grows with each phase ────────────────────────────────────────
  // phase 1: entry gate → pro shop → putting green
  // phase 3: + putting green → H1 tee → H1 green (south side)
  // phase 4: + H1 green → H2 tee → H2 green
  // phase 5: + H2 green → H3 tee → H3 green → return to pro shop
  private addCartPath(scene: THREE.Scene, upToPhase: number) {
    const W = 3.5
    const pathMat = path()

    const segments: Array<[number, number][]> = [
      // Phase 1 — entry area to pro shop and putting green
      [
        [ENTRY_GATE_POSITION.x,       ENTRY_GATE_POSITION.z],
        [55,  -20],
        [20,   -5],
        [CLUBHOUSE_POSITION.x + 2,    CLUBHOUSE_POSITION.z - 5],
        [CLUBHOUSE_POSITION.x,        CLUBHOUSE_POSITION.z + 2],
        [PUTTING_GREEN_CENTER.x + 14, PUTTING_GREEN_CENTER.z],
        [PUTTING_GREEN_CENTER.x,      PUTTING_GREEN_CENTER.z],
      ],
      // Phase 3 — putting green to H1
      [
        [PUTTING_GREEN_CENTER.x,           PUTTING_GREEN_CENTER.z],
        [PUTTING_GREEN_CENTER.x - 10,      PUTTING_GREEN_CENTER.z - 8],
        [HOLES[0].teePosition.x + 10,      HOLES[0].teePosition.z + 4],
        [HOLES[0].teePosition.x,           HOLES[0].teePosition.z],
        [-60,  HOLES[0].teePosition.z - 4],
        [-180, HOLES[0].teePosition.z - 5],
        [HOLES[0].greenPosition.x + 20,    HOLES[0].greenPosition.z - 2],
        [HOLES[0].greenPosition.x,         HOLES[0].greenPosition.z],
      ],
      // Phase 4 — H1 green to H2
      [
        [HOLES[0].greenPosition.x,         HOLES[0].greenPosition.z],
        [HOLES[1].teePosition.x - 20,      HOLES[1].teePosition.z + 10],
        [HOLES[1].teePosition.x,           HOLES[1].teePosition.z],
        [HOLES[1].greenPosition.x + 20,    HOLES[1].greenPosition.z - 5],
        [HOLES[1].greenPosition.x,         HOLES[1].greenPosition.z],
      ],
      // Phase 5 — H2 green to H3 and return
      [
        [HOLES[1].greenPosition.x,         HOLES[1].greenPosition.z],
        [HOLES[2].teePosition.x + 20,      HOLES[2].teePosition.z + 10],
        [HOLES[2].teePosition.x,           HOLES[2].teePosition.z],
        [HOLES[2].greenPosition.x + 15,    HOLES[2].greenPosition.z + 5],
        [HOLES[2].greenPosition.x,         HOLES[2].greenPosition.z],
        [HOLES[2].greenPosition.x + 30,    HOLES[2].greenPosition.z + 30],
        [CLUBHOUSE_POSITION.x - 10,        CLUBHOUSE_POSITION.z - 10],
        [CLUBHOUSE_POSITION.x,             CLUBHOUSE_POSITION.z],
      ],
    ]

    // Render segments up to and including the requested phase
    const phaseIndices: Record<number, number> = { 1: 0, 3: 1, 4: 2, 5: 3 }
    const maxIdx = phaseIndices[upToPhase] ?? 0
    for (let si = 0; si <= maxIdx; si++) {
      const pts = segments[si]
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, z1] = pts[i]
        const [x2, z2] = pts[i + 1]
        const dx = x2 - x1, dz = z2 - z1
        const len = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(W, len + 0.5), pathMat)
        seg.rotation.x = -Math.PI / 2
        seg.rotation.z = -angle
        seg.position.set((x1 + x2) / 2, 0.003, (z1 + z2) / 2)
        seg.receiveShadow = true
        scene.add(seg)
        const pad = new THREE.Mesh(new THREE.CircleGeometry(W * 0.6, 10), pathMat)
        pad.rotation.x = -Math.PI / 2
        pad.position.set(x1, 0.004, z1)
        scene.add(pad)
      }
    }
  }

  // ── Phase 1 — Course signage ─────────────────────────────────────────────────
  // Directional totems at key junctions, like a real golf course.
  private addCourseSignage(scene: THREE.Scene) {
    // 1. Right of the cart's approach path — north side of pro shop entrance.
    //    Cart spawns at (20, 10) facing NW, this sign is on their right.
    this.addDirectionalTotem(scene, 12, -2, [
      { label: 'PRO SHOP',      arrow: '↙' },
      { label: 'PUTTING GREEN', arrow: '←' },
      { label: 'HOLE 1',        arrow: '↑' },
    ])

    // 2. East side of putting green — visible as you pass the pro shop heading west.
    this.addDirectionalTotem(scene, -30, 5, [
      { label: 'PRO SHOP',      arrow: '→' },
      { label: 'HOLE 1',        arrow: '↑' },
    ])
  }

  // ── Phase 1 — Directional sign totems ────────────────────────────────────────
  // Signs placed at key junctions like a real golf course.
  // items: array of { label, arrow } where arrow is '←'|'→'|'↑'|'↗'|'↖'|'↘'|'↙'
  private addDirectionalTotem(scene: THREE.Scene, x: number, z: number, items: { label: string; arrow: string }[]) {
    const y = this.terrainHeight(x, z)
    const postH = 2.2 + items.length * 0.55

    // Wooden post
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.09, postH, 8),
      new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.9 })
    )
    post.position.set(x, y + postH / 2, z)
    post.castShadow = true
    scene.add(post)

    // One arrow board per item, stacked from bottom to top
    items.forEach((item, i) => {
      const boardW = 2.8
      const boardH = 0.45
      const boardY = y + 1.8 + i * 0.55

      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 48
      const ctx = canvas.getContext('2d')!

      // Board background — alternate dark green / cream
      ctx.fillStyle = i % 2 === 0 ? '#1a4a10' : '#f4ede0'
      ctx.fillRect(0, 0, 256, 48)
      ctx.strokeStyle = '#8a6820'
      ctx.lineWidth = 2
      ctx.strokeRect(1, 1, 254, 46)

      // Arrow + label
      const textColor = i % 2 === 0 ? '#f0c832' : '#1a4a10'
      ctx.fillStyle = textColor
      ctx.font = 'bold 26px Arial'
      ctx.textBaseline = 'middle'

      const arrowRight = item.arrow.includes('→') || item.arrow.includes('↗') || item.arrow.includes('↘')
      if (arrowRight) {
        // Arrow on right side
        ctx.textAlign = 'left'
        ctx.fillText(item.label, 10, 24)
        ctx.font = 'bold 28px Arial'
        ctx.textAlign = 'right'
        ctx.fillText(item.arrow, 246, 24)
      } else {
        // Arrow on left side
        ctx.textAlign = 'left'
        ctx.fillText(item.arrow, 8, 24)
        ctx.font = 'bold 26px Arial'
        ctx.fillText(item.label, 42, 24)
      }

      const tex = new THREE.CanvasTexture(canvas)
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(boardW, boardH, 0.08),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide })
      )
      board.position.set(x, boardY, z)
      board.castShadow = true
      scene.add(board)
    })
  }

  // ── Reusable helpers ─────────────────────────────────────────────────────────

  // @ts-ignore — used in Phase 3–5
  private addBunker(scene: THREE.Scene, pos: THREE.Vector3, rx: number, rz: number) {
    const bunker = new THREE.Mesh(new THREE.CircleGeometry(1, 28), sand())
    bunker.rotation.x = -Math.PI / 2
    bunker.scale.set(rx, 1, rz)
    bunker.position.copy(pos).setY(0.006)
    bunker.receiveShadow = true
    scene.add(bunker)
  }

  // @ts-ignore — used in Phase 3–5
  private addTeeBox(scene: THREE.Scene, teePos: THREE.Vector3, driveAngleY = 0, yBase = 0) {
    const g = new THREE.Group()
    g.position.set(teePos.x, yBase, teePos.z)
    g.rotation.y = driveAngleY
    scene.add(g)

    // Rectangular tee platform — wide across, shallow in drive direction
    const platform = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 5), fairway())
    platform.position.y = 0.075
    platform.receiveShadow = true
    platform.castShadow = true
    g.add(platform)

    // Fringe trim around edge
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.08, 5.6), fringe())
    trim.position.y = 0.01
    trim.receiveShadow = true
    g.add(trim)

    // Three sets of tee markers: black (championship/back), blue (men's/middle), red (forward/front)
    // local Z: negative = front (toward fairway), positive = back
    const markerSets = [
      { color: 0x111111, z:  1.4 },  // black – championship tees (back)
      { color: 0x1144cc, z:  0.0 },  // blue  – men's tees (middle)
      { color: 0xcc2222, z: -1.4 },  // red   – forward tees (front)
    ]

    markerSets.forEach(({ color, z }) => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 })
      ;[-2.6, 2.6].forEach(x => {
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.22, 12), mat)
        body.position.set(x, 0.23, z)
        g.add(body)
        const dome = new THREE.Mesh(
          new THREE.SphereGeometry(0.16, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2),
          mat
        )
        dome.position.set(x, 0.34, z)
        g.add(dome)
      })
    })
  }

  // @ts-ignore — used in Phase 1+
  private addCupAndFlag(scene: THREE.Scene, pos: THREE.Vector3, flagColor: number, holeR = 0.054) {
    // holeR: 0.054 = regulation 4.25in; 0.12 = enlarged for putting green
    const CUP_DEPTH = holeR * 2.5

    // ── Dark collar ring (makes hole visible in green surface) ────────────────
    const collarMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 })
    const collar = new THREE.Mesh(new THREE.RingGeometry(holeR, holeR * 1.4, 24), collarMat)
    collar.rotation.x = -Math.PI / 2
    collar.position.copy(pos).setY(pos.y + 0.006)
    scene.add(collar)

    // ── Dark opening disc ─────────────────────────────────────────────────────
    const openingMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1 })
    const opening = new THREE.Mesh(new THREE.CircleGeometry(holeR, 24), openingMat)
    opening.rotation.x = -Math.PI / 2
    opening.position.copy(pos).setY(pos.y + 0.007)
    scene.add(opening)

    // ── White cup liner (3D cylinder into the ground) ─────────────────────────
    const linerMat = new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.5, side: THREE.BackSide })
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(holeR, holeR, CUP_DEPTH, 24, 1, true), linerMat)
    liner.position.copy(pos).setY(pos.y - CUP_DEPTH / 2)
    scene.add(liner)

    // ── Cup bottom ────────────────────────────────────────────────────────────
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(holeR, 24), openingMat)
    bottom.rotation.x = Math.PI / 2
    bottom.position.copy(pos).setY(pos.y - CUP_DEPTH + 0.002)
    scene.add(bottom)

    // ── Flagstick ─────────────────────────────────────────────────────────────
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.55, roughness: 0.35 })
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 2.5, 8), pinMat)
    pin.position.copy(pos).setY(pos.y + 1.25)
    pin.castShadow = true
    scene.add(pin)

    // ── Flag ──────────────────────────────────────────────────────────────────
    const flagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.48),
      new THREE.MeshStandardMaterial({ color: flagColor, roughness: 0.6, side: THREE.DoubleSide })
    )
    flagMesh.position.set(pos.x + 0.38, pos.y + 2.3, pos.z)
    scene.add(flagMesh)
  }

  // @ts-ignore — used in Phase 1+
  private addSignPost(scene: THREE.Scene, position: THREE.Vector3, boardMat: THREE.MeshStandardMaterial) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), wood())
    post.position.copy(position)
    post.position.y = 1.1
    post.castShadow = true
    scene.add(post)

    const board = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 0.12), boardMat)
    board.position.copy(position)
    board.position.y = 2.3
    board.castShadow = true
    scene.add(board)
  }

  // @ts-ignore — used in Phase 3+
  private addYardageSign(
    scene: THREE.Scene,
    signPos: THREE.Vector3,
    faceAngleY: number,
    id: number,
    par: number,
    yards: number,
    company: string,
    role: string,
    years: string
  ) {
    const g = new THREE.Group()
    g.position.copy(signPos)
    g.rotation.y = faceAngleY
    scene.add(g)

    // Two wooden posts
    ;[-1.5, 1.5].forEach(x => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.8, 8), wood())
      post.position.set(x, 1.4, 0)
      post.castShadow = true
      g.add(post)
    })

    // ── Canvas texture ─────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 430
    const ctx = canvas.getContext('2d')!

    // Background
    ctx.fillStyle = '#1a4a10'
    ctx.fillRect(0, 0, 512, 430)

    // Outer border
    ctx.strokeStyle = '#8a6820'
    ctx.lineWidth = 6
    ctx.strokeRect(3, 3, 506, 424)

    // Gold header band
    ctx.fillStyle = '#c8a400'
    ctx.fillRect(6, 6, 500, 74)

    // Hole number
    ctx.fillStyle = '#1a1a1a'
    ctx.font = 'bold 52px Georgia'
    ctx.textAlign = 'center'
    ctx.fillText(`HOLE ${id}`, 256, 62)

    // Par & yards
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px Arial'
    ctx.fillText(`Par ${par}   ·   ${yards} yds`, 256, 120)

    // Divider
    ctx.strokeStyle = '#c8a400'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(30, 138)
    ctx.lineTo(482, 138)
    ctx.stroke()

    // Company name
    ctx.fillStyle = '#f0c832'
    ctx.font = 'bold 27px Arial'
    ctx.fillText(company, 256, 178)

    // Role (wrap if needed)
    ctx.fillStyle = '#eeeeee'
    ctx.font = '20px Arial'
    const roleLines = this.wrapCanvasText(ctx, role, 460)
    roleLines.forEach((line, i) => ctx.fillText(line, 256, 215 + i * 26))

    // Years
    ctx.fillStyle = '#aaaaaa'
    ctx.font = '19px Arial'
    ctx.fillText(years, 256, 290)

    // Second divider
    ctx.strokeStyle = '#3a6b1a'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(30, 308)
    ctx.lineTo(482, 308)
    ctx.stroke()

    // Tee markers legend
    const legendItems = [
      { color: '#111111', label: 'Black', cx: 90 },
      { color: '#1144cc', label: 'Blue',  cx: 256 },
      { color: '#cc2222', label: 'Red',   cx: 422 },
    ]
    legendItems.forEach(({ color, label, cx }) => {
      ctx.beginPath()
      ctx.arc(cx - 22, 348, 10, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.fillStyle = '#cccccc'
      ctx.font = '17px Arial'
      ctx.textAlign = 'left'
      ctx.fillText(label, cx - 8, 353)
    })
    ctx.textAlign = 'center'

    // Tee legend label
    ctx.fillStyle = '#888888'
    ctx.font = '14px Arial'
    ctx.fillText('Tee Markers', 256, 400)

    const texture = new THREE.CanvasTexture(canvas)
    const signMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, side: THREE.DoubleSide })

    const board = new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.0, 0.14), signMat)
    board.position.set(0, 3.15, 0)
    board.castShadow = true
    g.add(board)
  }

  private wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let current = ''
    for (const word of words) {
      const test = current ? `${current} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current)
        current = word
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
    return lines
  }

  // @ts-ignore — used in Phase 1+
  private makeUndulatedGreenGeo(shape: THREE.Shape, amplitude = 0.14): THREE.BufferGeometry {
    const geo = new THREE.ShapeGeometry(shape, 32)
    const pos = geo.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = amplitude * (
        Math.sin(x * 0.55 + 0.8) * Math.cos(y * 0.65 + 0.3) * 0.55 +
        Math.sin(x * 0.28 - 0.9) * Math.sin(y * 0.45 + 1.1) * 0.45
      )
      pos.setZ(i, z)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
    return geo
  }
}
