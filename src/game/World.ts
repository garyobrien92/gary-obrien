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
  tex.repeat.set(60, 60)
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })
}

export interface Zone {
  name: string
  position: THREE.Vector3
  triggerRadius: number
  data?: Record<string, string>
}

// ── Lakeside Golf Club Camden — Holes 1-3 layout ──────────────────────────────
// Holes run W-NW from tees on the east side of the course (near clubhouse).
// Scale: ~2.7 yards per game unit.
export const HOLES = [
  {
    id: 1,
    company: 'Over-C',
    role: 'Senior Fullstack Engineer & Web Developer',
    years: 'Jan 2018 - Dec 2023',
    description: 'Led frontend and backend development across hub microservices and web dashboards. Built with NestJS, MongoDB, Kafka, Vue.js, React, and AWS.',
    par: 4,
    yards: 355,
    // Southernmost hole — tee east of clubhouse, fairway runs W/WNW ~131 units
    teePosition:   new THREE.Vector3(  18, 0,   5),
    greenPosition: new THREE.Vector3(-115, 0, -10),
  },
  {
    id: 2,
    company: 'Viva Leisure',
    role: 'Full Stack Developer',
    years: 'Jan 2024 - Jun 2024',
    description: 'Full stack development with a focus on cloud infrastructure. Worked with Terraform, MongoDB, AWS ECS and ECR.',
    par: 5,
    yards: 512,
    // Middle hole — parallel to H1, 30 units north, ~194 units long
    teePosition:   new THREE.Vector3(  18, 0, -25),
    greenPosition: new THREE.Vector3(-175, 0, -45),
  },
  {
    id: 3,
    company: 'Hapana',
    role: 'Senior Fullstack Developer',
    years: 'Jul 2024 - Present',
    description: 'Tech Lead for the Integrations Squad. Built Stripe and Zapier integrations, a feature flagging system with pricing tiers, door access control systems, and infrastructure on Google Cloud with Terraform.',
    par: 3,
    yards: 165,
    // Northernmost — short par 3, tee far east, ~62 units W/WNW to green
    teePosition:   new THREE.Vector3( 18, 0, -55),
    greenPosition: new THREE.Vector3(-40, 0, -78),
  },
]

// ── Shared materials ──────────────────────────────────────────────────────────
const rough      = () => new THREE.MeshStandardMaterial({ color: 0x3a6b1a, roughness: 0.95, metalness: 0 })
const fairway    = () => new THREE.MeshStandardMaterial({ color: 0x4a8c22, roughness: 0.90, metalness: 0 })
const green      = () => new THREE.MeshStandardMaterial({ color: 0x2dba52, roughness: 0.75, metalness: 0 })
const fringe     = () => new THREE.MeshStandardMaterial({ color: 0x3ca840, roughness: 0.85, metalness: 0 })
const sand       = () => new THREE.MeshStandardMaterial({ color: 0xe8d5a0, roughness: 1.0,  metalness: 0 })
const path       = () => new THREE.MeshStandardMaterial({ color: 0xbcac90, roughness: 0.90, metalness: 0 })
const wood       = () => new THREE.MeshStandardMaterial({ color: 0x8B6440, roughness: 0.85, metalness: 0 })
const cream      = () => new THREE.MeshStandardMaterial({ color: 0xf4ede0, roughness: 0.75, metalness: 0.02 })
const darkGreen  = () => new THREE.MeshStandardMaterial({ color: 0x1a4a10, roughness: 0.80, metalness: 0 })
const stone      = () => new THREE.MeshStandardMaterial({ color: 0x9a9080, roughness: 0.90, metalness: 0.05 })
const roofMat    = () => new THREE.MeshStandardMaterial({ color: 0x2c4a1a, roughness: 0.85, metalness: 0 })
const whitePaint = () => new THREE.MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.50, metalness: 0.05 })
const flagRed    = () => new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.7, metalness: 0, side: THREE.DoubleSide })
// @ts-ignore — water material will be used when water hazards are added with holes 1-3
const water      = () => new THREE.MeshStandardMaterial({ color: 0x1a6ea8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })

export class World {
  zones: Zone[] = []
  // Putting green is ~57 yards (21 units) WEST of clubhouse — matches Lakeside satellite
  puttingGreenCenter = new THREE.Vector3(-22, 0, -25)
  puttingGreenHolePositions: THREE.Vector3[] = []
  private physicsWorld!: RAPIER.World

  constructor(scene: THREE.Scene, physicsWorld: RAPIER.World, sunDirection: THREE.Vector3) {
    this.physicsWorld = physicsWorld
    this.addGround(scene, physicsWorld)
    this.addSunLight(scene, sunDirection)
    this.addClubhouse(scene)
    this.addPuttingGreen(scene)
    this.addDrivingRange(scene)
    // Holes 1-3 not yet built — new W/WNW layout planned, see PLAN.md
    this.addCartPath(scene)
    this.addTrees(scene)
    this.addTerrainMounds(scene)
  }

  // ── Height function ─────────────────────────────────────────────────────────
  terrainHeight(x: number, z: number): number {
    const gauss = (cx: number, cz: number, r: number, h: number) => {
      const d2 = (x - cx) ** 2 + (z - cz) ** 2
      return h * Math.exp(-d2 / (2 * r * r))
    }

    // distToSeg will be used again when fairway corridors are added for holes 1-3
    // @ts-ignore
    const distToSeg = (x1: number, z1: number, x2: number, z2: number) => {
      const dx = x2 - x1, dz = z2 - z1
      const len2 = dx * dx + dz * dz
      if (len2 === 0) return Math.sqrt((x - x1) ** 2 + (z - z1) ** 2)
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / len2))
      return Math.sqrt((x - (x1 + t * dx)) ** 2 + (z - (z1 + t * dz)) ** 2)
    }

    // Small ambient undulation everywhere
    let h = 0.10 * Math.sin(x * 0.18 + 0.5) * Math.cos(z * 0.22 + 1.1)
          + 0.06 * Math.sin(x * 0.35 - 0.7) * Math.cos(z * 0.30 + 0.3)

    // Rolling hills — larger outside course bounds (Lakeside extends north to z≈-210)
    const inBounds = x > -140 && x < 110 && z > -215 && z < 80
    const s = inBounds ? 0.5 : 2.0
    h += s        * Math.sin(x * 0.018 + 0.4) * Math.cos(z * 0.022 + 0.7)
      + s * 0.55 * Math.sin(x * 0.037 - 0.8) * Math.cos(z * 0.042 + 0.3)
      + s * 0.30 * Math.sin(x * 0.065 + 1.8) * Math.sin(z * 0.055 - 0.5)

    // ── Flatten clubhouse & putting green area ────────────────────────────────
    const flat = Math.min(1,
      gauss(  0, -20, 14, 1.5) +   // clubhouse pad
      gauss(-22, -25, 12, 1.5)     // putting green
    )
    h *= 1 - flat * 0.92

    // ── Putting green: gentle undulation for realistic putting ────────────────
    const pgDist = Math.sqrt((x - (-22)) ** 2 + (z - (-25)) ** 2)
    const pgInf  = Math.max(0, 1 - pgDist / 11)
    h += pgInf * (
      0.13 * Math.sin((x + 18) * 0.48) * Math.cos((z + 22) * 0.41) +
      0.07 * (z + 25) / 8
    )

    return h
  }

  // ── Ground ─────────────────────────────────────────────────────────────────
  private addGround(scene: THREE.Scene, physicsWorld: RAPIER.World) {
    const SIZE = 500
    const SEGS = 96  // 96×96 grid — good balance of detail vs performance

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
    sun.shadow.camera.far = 500
    sun.shadow.camera.left = -200
    sun.shadow.camera.right = 200
    sun.shadow.camera.top = 200
    sun.shadow.camera.bottom = -200
    sun.shadow.bias = -0.0003
    scene.add(sun)
  }

  // ── Clubhouse ───────────────────────────────────────────────────────────────
  private addClubhouse(scene: THREE.Scene) {
    const club = new THREE.Group()
    club.position.set(0, 0, -20)
    scene.add(club)

    const building = new THREE.Mesh(new THREE.BoxGeometry(12, 5, 8), cream())
    building.position.set(0, 2.5, 0)
    building.castShadow = true
    building.receiveShadow = true
    club.add(building)

    const roof = new THREE.Mesh(new THREE.ConeGeometry(9, 3, 4), roofMat())
    roof.position.set(0, 6.5, 0)
    roof.rotation.y = Math.PI / 4
    roof.castShadow = true
    club.add(roof)

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.5, 0.8), stone())
    chimney.position.set(3, 7, 0)
    chimney.castShadow = true
    club.add(chimney)

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.12), wood())
    door.position.set(0, 1.2, 4.07)
    club.add(door)

    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf0e8d0, roughness: 0.7 })
    ;[[-0.8, 1.2], [0.8, 1.2]].forEach(([x, y]) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), frameMat)
      post.position.set(x, y, 4.1)
      club.add(post)
    })

    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88c8f0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.6 })
    ;[-3.5, -2, 2, 3.5].forEach(x => {
      const win = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.1), glassMat)
      win.position.set(x, 2.8, 4.05)
      club.add(win)
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.7, 0.05), frameMat)
      frame.position.set(x, 2.8, 4.02)
      club.add(frame)
    })

    const colMat = whitePaint()
    ;[-2.5, 0, 2.5].forEach(x => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 2.8, 12), colMat)
      col.position.set(x, 1.4, 5.5)
      col.castShadow = true
      club.add(col)
    })

    const porch = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 2.2), roofMat())
    porch.position.set(0, 2.9, 5.5)
    porch.castShadow = true
    club.add(porch)

    const porchFloor = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 3.5), stone())
    porchFloor.position.set(0, 0.1, 5.7)
    porchFloor.receiveShadow = true
    club.add(porchFloor)

    const signBoard = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.9, 0.18), darkGreen())
    signBoard.position.set(0, 3.8, 4.2)
    club.add(signBoard)

    const poleMat = new THREE.MeshStandardMaterial({ color: 0xd0d0d0, roughness: 0.4, metalness: 0.6 })
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 7, 10), poleMat)
    pole.position.set(7.5, 3.5, 0)
    pole.castShadow = true
    club.add(pole)
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), flagRed())
    flag.position.set(8.2, 6.5, 0)
    club.add(flag)

    const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 })
    for (let i = 0; i < 4; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 3.5), lineMat)
      line.rotation.x = -Math.PI / 2
      line.position.set(-12 + i * 3, 0.01, -6)
      club.add(line)
    }

    // Physics collider for clubhouse building
    const clubBody = this.physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    this.physicsWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(6, 3.5, 4).setTranslation(0, 3.5, -20),
      clubBody
    )

    this.zones.push({ name: 'clubhouse', position: new THREE.Vector3(0, 0, -20), triggerRadius: 12 })
  }

  // ── Putting Green ───────────────────────────────────────────────────────────
  private addPuttingGreen(scene: THREE.Scene) {
    const cx = this.puttingGreenCenter.x
    const cz = this.puttingGreenCenter.z
    const cy = this.terrainHeight(cx, cz)

    // ── Organic fringe shape (slightly larger than green) ────────────────────
    const fringeShape = new THREE.Shape()
    fringeShape.moveTo( 11,   0)
    fringeShape.bezierCurveTo( 12,  -4,   9, -10,   3, -10)
    fringeShape.bezierCurveTo( -2, -10,  -9,  -7, -10,  -1)
    fringeShape.bezierCurveTo(-11,   3,  -9,   9,  -3,  10)
    fringeShape.bezierCurveTo(  2,  11,   9,   8,  11,   0)
    const fMesh = new THREE.Mesh(new THREE.ShapeGeometry(fringeShape, 28), fringe())
    fMesh.rotation.x = -Math.PI / 2
    fMesh.position.set(cx, cy + 0.008, cz)
    fMesh.receiveShadow = true
    scene.add(fMesh)

    // ── Organic green surface with slope undulation ──────────────────────────
    const pgShape = new THREE.Shape()
    pgShape.moveTo(  9,   0)
    pgShape.bezierCurveTo( 10,  -3,   7,  -8,   2,  -8)
    pgShape.bezierCurveTo( -2,  -8,  -8,  -5,  -9,   0)
    pgShape.bezierCurveTo( -9,   4,  -6,   8,  -1,   9)
    pgShape.bezierCurveTo(  3,   9,   9,   6,   9,   0)
    const greenMesh = new THREE.Mesh(this.makeUndulatedGreenGeo(pgShape, 0.16), green())
    greenMesh.rotation.x = -Math.PI / 2
    greenMesh.position.set(cx, cy + 0.02, cz)
    greenMesh.receiveShadow = true
    scene.add(greenMesh)

    // ── Hole positions spread across the organic shape ───────────────────────
    const flagColors = [0xcc2222, 0x2244cc, 0xddaa00]
    this.puttingGreenHolePositions = [
      new THREE.Vector3(cx - 4,   this.terrainHeight(cx - 4,   cz + 3),   cz + 3),
      new THREE.Vector3(cx + 4,   this.terrainHeight(cx + 4,   cz - 2),   cz - 2),
      new THREE.Vector3(cx + 0.5, this.terrainHeight(cx + 0.5, cz + 6.5), cz + 6.5),
    ]

    this.puttingGreenHolePositions.forEach((pos, i) => {
      // Larger cup radius for putting green (easier to see and aim at)
      this.addCupAndFlag(scene, pos, flagColors[i], 0.12)
    })

    this.addSignPost(scene, new THREE.Vector3(cx - 8, 0, cz - 9), darkGreen())
    this.zones.push({ name: 'putting_green', position: this.puttingGreenCenter.clone(), triggerRadius: 12 })
  }

  // ── Driving Range ───────────────────────────────────────────────────────────
  private addDrivingRange(scene: THREE.Scene) {
    const pos = new THREE.Vector3(-38, 0, 5)

    const teeMat = new THREE.MeshStandardMaterial({ color: 0xd4c878, roughness: 0.9 })
    const teePlane = new THREE.Mesh(new THREE.PlaneGeometry(14, 20), teeMat)
    teePlane.rotation.x = -Math.PI / 2
    teePlane.position.copy(pos)
    teePlane.position.y = 0.01
    teePlane.receiveShadow = true
    scene.add(teePlane)

    const rangeFairway = new THREE.Mesh(new THREE.PlaneGeometry(70, 20), fairway())
    rangeFairway.rotation.x = -Math.PI / 2
    rangeFairway.rotation.z = Math.PI / 2
    rangeFairway.position.set(pos.x - 42, 0.005, pos.z)
    rangeFairway.receiveShadow = true
    scene.add(rangeFairway)

    ;[{ dist: 25, color: 0xffffff, r: 2.5 }, { dist: 45, color: 0xffcc00, r: 2.0 }, { dist: 65, color: 0xff4444, r: 1.6 }]
      .forEach(({ dist, color, r }) => {
        const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 32),
          new THREE.MeshStandardMaterial({ color, roughness: 0.6, side: THREE.DoubleSide }))
        ring.rotation.x = -Math.PI / 2
        ring.position.set(pos.x - dist, 0.02, pos.z)
        scene.add(ring)
      })

    const divMat = new THREE.MeshStandardMaterial({ color: 0x777766, roughness: 0.6, metalness: 0.3 })
    for (let i = -1; i <= 1; i++) {
      const divPost = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.2, 8), divMat)
      divPost.position.set(pos.x, 1.1, pos.z + i * 4.5)
      divPost.castShadow = true
      scene.add(divPost)
    }

    const bayRoof = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 20), roofMat())
    bayRoof.position.set(pos.x, 2.3, pos.z)
    bayRoof.castShadow = true
    scene.add(bayRoof)

    const netPostMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.5, roughness: 0.5 })
    ;[-10, 10].forEach(z => {
      const np = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 10, 8), netPostMat)
      np.position.set(pos.x - 75, 5, z)
      np.castShadow = true
      scene.add(np)
    })

    this.addSignPost(scene, new THREE.Vector3(pos.x + 3, 0, pos.z - 12),
      new THREE.MeshStandardMaterial({ color: 0x1a3a6a, roughness: 0.8 }))
    this.zones.push({ name: 'driving_range', position: pos.clone(), triggerRadius: 14 })
  }

  // ── Cart path ────────────────────────────────────────────────────────────────
  private addCartPath(scene: THREE.Scene) {
    const pathMat = path()
    const W = 3.2  // path width

    // Temporary local loop: Clubhouse → putting green → driving range → back
    // Full course routing will be added when holes 1-3 are built (see PLAN.md)
    const waypoints: Array<[number, number]> = [
      [  0, -12],   // clubhouse south exit
      [ -8, -20],   // west side of clubhouse
      [-22, -25],   // putting green
      [-38,  -5],   // driving range tee
      [-38,  10],   // range north end
      [-20,  15],   // swinging back east
      [ 15,  12],   // east side
      [ 18,   5],   // H1 tee marker (future)
      [  8,  -8],   // back to clubhouse
      [  0, -12],   // close loop
    ]

    for (let i = 0; i < waypoints.length - 1; i++) {
      const [x1, z1] = waypoints[i]
      const [x2, z2] = waypoints[i + 1]
      const dx = x2 - x1
      const dz = z2 - z1
      const len = Math.sqrt(dx * dx + dz * dz)
      const angle = Math.atan2(dx, dz)

      const seg = new THREE.Mesh(new THREE.PlaneGeometry(W, len + 0.5), pathMat)
      seg.rotation.x = -Math.PI / 2
      seg.rotation.z = -angle
      seg.position.set((x1 + x2) / 2, 0.002, (z1 + z2) / 2)
      seg.receiveShadow = true
      scene.add(seg)

      // Small junction pad at each corner to fill gaps
      const pad = new THREE.Mesh(new THREE.CircleGeometry(W * 0.65, 12), pathMat)
      pad.rotation.x = -Math.PI / 2
      pad.position.set(x1, 0.003, z1)
      scene.add(pad)
    }
  }

  // ── Trees ────────────────────────────────────────────────────────────────────
  private addTrees(scene: THREE.Scene) {
    const trunkMat  = new THREE.MeshStandardMaterial({ color: 0x6b4c2a, roughness: 0.95 })
    const foliage1  = new THREE.MeshStandardMaterial({ color: 0x1e5c18, roughness: 0.9 })
    const foliage2  = new THREE.MeshStandardMaterial({ color: 0x266b1e, roughness: 0.9 })
    const foliage3  = new THREE.MeshStandardMaterial({ color: 0x2d7a24, roughness: 0.9 })

    const addTree = (x: number, z: number, scale = 1.0, variety = 0) => {
      const g = new THREE.Group()

      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, 2.2 * scale, 8),
        trunkMat
      )
      trunk.position.y = 1.1 * scale
      trunk.castShadow = true
      g.add(trunk)

      const fMat = variety === 0 ? foliage1 : variety === 1 ? foliage2 : foliage3
      ;[0, 1, 2].forEach(i => {
        const r = (2.2 - i * 0.4) * scale
        const h = (2.0 - i * 0.2) * scale
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), i % 2 === 0 ? fMat : foliage2)
        cone.position.y = (2.2 + i * 1.4) * scale
        cone.castShadow = true
        cone.receiveShadow = true
        g.add(cone)
      })

      const groundY = this.terrainHeight(x, z)
      g.position.set(x, groundY, z)
      scene.add(g)

      // Cylinder collider for trunk
      const trunkBody = this.physicsWorld.createRigidBody(
        RAPIER.RigidBodyDesc.fixed().setTranslation(x, groundY + 1.1 * scale, z)
      )
      this.physicsWorld.createCollider(
        RAPIER.ColliderDesc.cylinder(1.1 * scale, 0.24 * scale),
        trunkBody
      )
    }

    // ── Trees around putting green (west of clubhouse) ───────────────────────
    ;[[-32,-18],[-34,-28],[-14,-35],[-12,-15],[-28,-38]].forEach(([x,z]) => addTree(x,z,1.1,1))

    // ── Trees behind / around clubhouse ──────────────────────────────────────
    for (let i = 0; i < 8; i++) addTree(-8 + i * 4, -38, 1.0 + Math.random() * 0.4, 0)
    ;[[25,-30],[28,-42],[24,-55],[28,-68]].forEach(([x,z])=>addTree(x,z,1.0+Math.random()*0.3,2))  // east tree line

    // ── Scattered boundary trees ──────────────────────────────────────────────
    const roughPos: [number,number][] = [
      [-55, 20], [-60, 0], [-55,-45], [-60,-60],
      [-80,-20], [-80,-40], [-80,-60], [-80,-80],
      [ 40, 20], [ 50, 5], [ 45,-20], [ 50,-40],
    ]
    roughPos.forEach(([x,z]) => addTree(x,z, 1.0+Math.random()*0.5, Math.floor(Math.random()*3)))
  }

  // ── Terrain mounds (visual interest, no physics) ────────────────────────────
  private addTerrainMounds(scene: THREE.Scene) {
    const moundPositions: Array<[number, number, number, number, number]> = [
      // x,  z,   rx,  rz,  yscale
      [ 50, -35,  6,   5,   0.28],
      [145, -22,  7,   5,   0.22],
      [170,  10,  5,   4,   0.30],
      [175,  80,  6,   5,   0.25],
      [ 20, 100,  8,   5,   0.20],
      [-30,  40,  7,   6,   0.18],
      [-55,  25,  5,   4,   0.25],
    ]

    moundPositions.forEach(([x, z, rx, rz, ys]) => {
      const geo = new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
      const mound = new THREE.Mesh(geo, rough())
      mound.scale.set(rx, ys * rx, rz)
      mound.position.set(x, 0, z)
      mound.receiveShadow = true
      scene.add(mound)
    })
  }

  // ── Helpers (some unused until holes 1-3 are built) ─────────────────────────

  // @ts-ignore
  private addBunker(scene: THREE.Scene, pos: THREE.Vector3, rx: number, rz: number) {
    const bunker = new THREE.Mesh(new THREE.CircleGeometry(1, 28), sand())
    bunker.rotation.x = -Math.PI / 2
    bunker.scale.set(rx, 1, rz)
    bunker.position.copy(pos).setY(0.006)
    bunker.receiveShadow = true
    scene.add(bunker)
  }

  // @ts-ignore
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

  // @ts-ignore
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
