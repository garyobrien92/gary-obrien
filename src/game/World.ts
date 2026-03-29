import * as THREE from 'three'
import RAPIER from '@dimforge/rapier3d-compat'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

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

export const HOLES = [
  {
    id: 1,
    company: 'Over-C',
    role: 'Senior Fullstack Engineer & Web Developer',
    years: 'Jan 2018 - Dec 2023',
    description: 'Led frontend and backend development across hub microservices and web dashboards. Built with NestJS, MongoDB, Kafka, Vue.js, React, and AWS.',
    par: 4,
    yards: 380,
    teePosition: new THREE.Vector3(60, 0, -15),
    greenPosition: new THREE.Vector3(133, 0, -4),
  },
  {
    id: 2,
    company: 'Viva Leisure',
    role: 'Full Stack Developer',
    years: 'TBD - TBD',
    description: 'Full stack development with a focus on cloud infrastructure. Worked with Terraform, MongoDB, AWS ECS and ECR.',
    par: 3,
    yards: 160,
    teePosition: new THREE.Vector3(133, 0, 28),
    greenPosition: new THREE.Vector3(158, 0, 72),
  },
  {
    id: 3,
    company: 'Hapana',
    role: 'Senior Fullstack Developer',
    years: 'TBD - Present',
    description: 'Tech Lead for the Integrations Squad. Built Stripe and Zapier integrations, a feature flagging system with pricing tiers, door access control systems, and infrastructure on Google Cloud with Terraform.',
    par: 4,
    yards: 310,
    teePosition: new THREE.Vector3(88, 0, 82),
    greenPosition: new THREE.Vector3(36, 0, 92),
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
const water      = () => new THREE.MeshStandardMaterial({ color: 0x1a6ea8, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 })

export class World {
  zones: Zone[] = []
  private physicsWorld!: RAPIER.World

  constructor(scene: THREE.Scene, physicsWorld: RAPIER.World, sunDirection: THREE.Vector3) {
    this.physicsWorld = physicsWorld
    this.addGround(scene, physicsWorld)
    this.addSunLight(scene, sunDirection)
    this.addClubhouse(scene)
    this.addPuttingGreen(scene)
    this.addDrivingRange(scene)
    this.addHole1(scene)
    this.addHole2(scene)
    this.addHole3(scene)
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

    // Rolling hills — larger outside course bounds
    const inBounds = x > -55 && x < 190 && z > -55 && z < 125
    const s = inBounds ? 0.5 : 2.0
    h += s        * Math.sin(x * 0.018 + 0.4) * Math.cos(z * 0.022 + 0.7)
      + s * 0.55 * Math.sin(x * 0.037 - 0.8) * Math.cos(z * 0.042 + 0.3)
      + s * 0.30 * Math.sin(x * 0.065 + 1.8) * Math.sin(z * 0.055 - 0.5)

    // Flatten fairway corridors
    const fw1 = Math.max(0, 1 - distToSeg(55, -15, 133, -4) / 12)
    const fw2 = Math.max(0, 1 - distToSeg(133, 28, 158, 72) / 11)
    const fw3 = Math.max(0, 1 - distToSeg(88, 82, 36, 92) / 10)
    h *= 1 - Math.max(fw1, fw2, fw3) * 0.93

    // Flatten tee areas and clubhouse
    const flat = Math.min(1,
      gauss(60, -15, 9, 1.5) + gauss(133, 28, 9, 1.5) +
      gauss(88, 82, 9, 1.5)  + gauss(0, -20, 14, 1.5)
    )
    h *= 1 - flat * 0.92

    // Bunker depressions
    h -= 0.10 * gauss(92, -24, 3.5, 1)
    h -= 0.10 * gauss(126,  4, 4.0, 1)
    h -= 0.10 * gauss(56,  76, 3.5, 1)

    // Green domes baked into terrain
    h += gauss(133,  -4, 9, 0.55)  // hole 1
    h += gauss(158,  72, 8, 0.45)  // hole 2
    h += gauss( 36,  92, 8, 0.50)  // hole 3

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
    const center = new THREE.Vector3(22, 0, 10)

    const gMesh = new THREE.Mesh(new THREE.CircleGeometry(9, 48), green())
    gMesh.rotation.x = -Math.PI / 2
    gMesh.position.copy(center)
    gMesh.position.y = 0.01
    gMesh.receiveShadow = true
    scene.add(gMesh)

    const fMesh = new THREE.Mesh(new THREE.RingGeometry(9, 11, 48), fringe())
    fMesh.rotation.x = -Math.PI / 2
    fMesh.position.copy(center)
    fMesh.position.y = 0.008
    scene.add(fMesh)

    const edgeGeo = new THREE.TorusGeometry(9, 0.25, 8, 48)
    const edge = new THREE.Mesh(edgeGeo, fringe())
    edge.rotation.x = Math.PI / 2
    edge.position.copy(center)
    edge.position.y = 0.15
    edge.castShadow = true
    scene.add(edge)

    const flagColors = [0xcc2222, 0x2244cc, 0xddaa00]
    const holePositions = [
      new THREE.Vector3(center.x - 3.5, this.terrainHeight(center.x - 3.5, center.z + 2), center.z + 2),
      new THREE.Vector3(center.x + 3,   this.terrainHeight(center.x + 3,   center.z - 3), center.z - 3),
      new THREE.Vector3(center.x + 0.5, this.terrainHeight(center.x + 0.5, center.z + 5.5), center.z + 5.5),
    ]

    holePositions.forEach((pos, i) => {
      this.addCupAndFlag(scene, pos, flagColors[i])
    })

    this.addSignPost(scene, new THREE.Vector3(center.x - 8, 0, center.z - 9), darkGreen())

    // Golf ball on the putting green
    const ballLoader = new GLTFLoader()
    ballLoader.load('/models/golf_ball.glb', (gltf) => {
      const ball = gltf.scene
      ball.scale.setScalar(0.05)
      ball.position.set(center.x - 3.5, this.terrainHeight(center.x - 3.5, center.z + 2) + 0.02, center.z + 2)
      ball.traverse(c => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true } })
      scene.add(ball)
    })

    this.zones.push({ name: 'putting_green', position: center.clone(), triggerRadius: 12 })
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

  // ── Hole 1 — Par 4, 380 yds — Dogleg Right, Oval Green ─────────────────────
  // Tee: (60, 0, -15)  →  Elbow: (100, 0, -15)  →  Green: (133, 0, -4)
  private addHole1(scene: THREE.Scene) {
    const hole = HOLES[0]
    const { teePosition: tee, greenPosition: greenPos, id, par, yards, company, role, years } = hole

    // ── Fairway: two segments for the dogleg ──
    // Segment A — straight east from tee
    const fwA = new THREE.Mesh(new THREE.PlaneGeometry(45, 14), fairway())
    fwA.rotation.x = -Math.PI / 2
    fwA.position.set(82, 0.008, -15)
    fwA.receiveShadow = true
    scene.add(fwA)

    // Segment B — angled NE toward green
    const elbowToGreen = new THREE.Vector3(133, 0, -4).clone().sub(new THREE.Vector3(100, 0, -15))
    const lenB = elbowToGreen.length()
    const angleB = Math.atan2(elbowToGreen.x, elbowToGreen.z)
    const midB = new THREE.Vector3(116, 0, -9.5)
    const fwB = new THREE.Mesh(new THREE.PlaneGeometry(lenB + 4, 13), fairway())
    fwB.rotation.x = -Math.PI / 2
    fwB.rotation.z = -angleB
    fwB.position.copy(midB).setY(0.008)
    fwB.receiveShadow = true
    scene.add(fwB)

    // ── Rough strip alongside fairway A (north side) ──
    const roughN = new THREE.Mesh(new THREE.PlaneGeometry(45, 6), rough())
    roughN.rotation.x = -Math.PI / 2
    roughN.position.set(82, 0.004, -22)
    roughN.receiveShadow = true
    scene.add(roughN)

    // ── Irregular organic green — gently domed with surface undulation ──
    const fringeShape = new THREE.Shape()
    fringeShape.moveTo(-11, -5)
    fringeShape.bezierCurveTo(-14, -2, -12, 5, -7, 8)
    fringeShape.bezierCurveTo(-2, 11, 6, 9, 10, 5)
    fringeShape.bezierCurveTo(14, 1, 13, -5, 8, -8)
    fringeShape.bezierCurveTo(3, -11, -7, -9, -11, -5)
    const greenFringe = new THREE.Mesh(new THREE.ShapeGeometry(fringeShape, 24), fringe())
    greenFringe.rotation.x = -Math.PI / 2
    greenFringe.position.copy(greenPos).setY(this.terrainHeight(greenPos.x, greenPos.z) + 0.02)
    greenFringe.receiveShadow = true
    scene.add(greenFringe)

    const greenShape = new THREE.Shape()
    greenShape.moveTo(-9, -4)
    greenShape.bezierCurveTo(-12, -1, -10, 4, -5, 7)
    greenShape.bezierCurveTo(0, 10, 7, 8, 9, 4)
    greenShape.bezierCurveTo(12, 0, 11, -5, 6, -7)
    greenShape.bezierCurveTo(1, -9, -6, -8, -9, -4)
    const greenMesh = new THREE.Mesh(this.makeUndulatedGreenGeo(greenShape, 0.18), green())
    greenMesh.rotation.x = -Math.PI / 2
    greenMesh.position.copy(greenPos).setY(this.terrainHeight(greenPos.x, greenPos.z) + 0.05)
    greenMesh.receiveShadow = true
    scene.add(greenMesh)

    // ── Gentle mound behind green ──
    const moundGeo = new THREE.SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    const mound = new THREE.Mesh(moundGeo, rough())
    mound.scale.set(1, 0.35, 1)
    mound.position.set(greenPos.x + 9, 0, greenPos.z)
    mound.receiveShadow = true
    scene.add(mound)

    // ── Bunkers ──
    this.addBunker(scene, new THREE.Vector3(92, 0, -24), 3.5, 2.5)   // left of fairway
    this.addBunker(scene, new THREE.Vector3(92, 0, -7),  3.0, 2.0)   // right of fairway
    this.addBunker(scene, new THREE.Vector3(126, 0, 4),  4.0, 2.8)   // front-right of green
    this.addBunker(scene, new THREE.Vector3(128, 0, -14), 3.2, 2.0)  // back-left of green

    // ── Water hazard right of approach ──
    const pond = new THREE.Mesh(new THREE.CircleGeometry(7, 32), water())
    pond.rotation.x = -Math.PI / 2
    pond.position.set(118, 0.05, 8)
    scene.add(pond)
    const bank = new THREE.Mesh(new THREE.RingGeometry(7, 8.5, 32), fringe())
    bank.rotation.x = -Math.PI / 2
    bank.position.set(118, 0.02, 8)
    scene.add(bank)

    // ── Tee box ── (drive goes east / +X, driveAngleY = π/2)
    this.addTeeBox(scene, tee, Math.PI / 2, this.terrainHeight(tee.x, tee.z))

    // ── Cup, flag, yardage sign ──
    this.addCupAndFlag(scene, new THREE.Vector3(greenPos.x, this.terrainHeight(greenPos.x, greenPos.z), greenPos.z), 0xcc2222)
    // Sign south of tee, facing west (toward approaching cart)
    this.addYardageSign(scene, new THREE.Vector3(tee.x + 2, 0, tee.z + 7), -Math.PI / 2, id, par, yards, company, role, years)

    this.zones.push({
      name: `hole_${id}_tee`,
      position: tee.clone(),
      triggerRadius: 10,
      data: { company, role, years, par: String(par), yards: String(yards), holeId: String(id) },
    })
    this.zones.push({
      name: `hole_${id}_green`,
      position: greenPos.clone(),
      triggerRadius: 10,
      data: { company, role, years },
    })
  }

  // ── Hole 2 — Par 3, 160 yds — Elevated Tee Over Water, Tight Circle Green ──
  // Tee: (133, 0, 28)  →  Green: (158, 0, 72)   shot angles NE over a lake
  private addHole2(scene: THREE.Scene) {
    const hole = HOLES[1]
    const { teePosition: tee, greenPosition: greenPos, id, par, yards, company, role, years } = hole

    // ── Large lake between tee and green ──
    const lakeShape = new THREE.Shape()
    lakeShape.ellipse(0, 0, 18, 14, 0, Math.PI * 2)
    const lakeGeo = new THREE.ShapeGeometry(lakeShape, 32)
    const lake = new THREE.Mesh(lakeGeo, water())
    lake.rotation.x = -Math.PI / 2
    lake.position.set(145, 0.05, 52)
    scene.add(lake)

    // Lake bank
    const lakeBank = new THREE.Mesh(new THREE.RingGeometry(14, 16, 48), fringe())
    lakeBank.rotation.x = -Math.PI / 2
    lakeBank.position.set(145, 0.02, 52)
    lakeBank.scale.set(1.3, 1, 1)
    scene.add(lakeBank)

    // OB stakes around lake
    const stakeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 })
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) {
      const sx = 145 + Math.cos(a) * 17
      const sz = 52 + Math.sin(a) * 13
      const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.0, 6), stakeMat)
      stake.position.set(sx, 0.5, sz)
      scene.add(stake)
    }

    // Fringe — slightly bigger
    const gFringe = new THREE.Mesh(new THREE.CircleGeometry(7, 48), fringe())
    gFringe.rotation.x = -Math.PI / 2
    gFringe.position.copy(greenPos).setY(this.terrainHeight(greenPos.x, greenPos.z) + 0.02)
    gFringe.receiveShadow = true
    scene.add(gFringe)

    // Green surface — irregular shape with undulation
    const h2GreenShape = new THREE.Shape()
    h2GreenShape.moveTo(-5, 0)
    h2GreenShape.bezierCurveTo(-5, -4, -2, -6, 2, -5)
    h2GreenShape.bezierCurveTo(5, -4, 6, -1, 5, 2)
    h2GreenShape.bezierCurveTo(5, 5, 2, 6, -1, 5)
    h2GreenShape.bezierCurveTo(-4, 6, -5, 4, -5, 0)
    const greenMesh = new THREE.Mesh(this.makeUndulatedGreenGeo(h2GreenShape, 0.14), green())
    greenMesh.rotation.x = -Math.PI / 2
    greenMesh.position.copy(greenPos).setY(this.terrainHeight(greenPos.x, greenPos.z) + 0.05)
    greenMesh.receiveShadow = true
    scene.add(greenMesh)

    // Bunker wrapping the front of green (crescent)
    for (let a = -0.9; a <= 0.9; a += 0.22) {
      const bx = greenPos.x - 7 * Math.cos(a)
      const bz = greenPos.z + 7 * Math.sin(a)
      const b = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), sand())
      b.rotation.x = -Math.PI / 2
      b.position.set(bx, 0.05, bz)
      scene.add(b)
    }

    // ── Tee box ── (drive goes NE, driveAngleY ≈ 0.515)
    this.addTeeBox(scene, tee, 0.515, this.terrainHeight(tee.x, tee.z))

    // ── Cup, flag, yardage sign ──
    this.addCupAndFlag(scene, new THREE.Vector3(greenPos.x, this.terrainHeight(greenPos.x, greenPos.z), greenPos.z), 0x2244cc)
    // Sign to south-east of tee, facing north-west
    this.addYardageSign(scene, new THREE.Vector3(tee.x + 8, 0, tee.z - 6), Math.PI * 0.75, id, par, yards, company, role, years)

    this.zones.push({
      name: `hole_${id}_tee`,
      position: tee.clone(),
      triggerRadius: 10,
      data: { company, role, years, par: String(par), yards: String(yards), holeId: String(id) },
    })
    this.zones.push({
      name: `hole_${id}_green`,
      position: greenPos.clone(),
      triggerRadius: 9,
      data: { company, role, years },
    })
  }

  // ── Hole 3 — Short Par 4, 310 yds — Narrow Dogleg Left, Kidney Green ───────
  // Tee: (88, 0, 82)  →  Elbow: (68, 0, 82)  →  Green: (36, 0, 92)   heading W then NW
  private addHole3(scene: THREE.Scene) {
    const hole = HOLES[2]
    const { teePosition: tee, greenPosition: greenPos, id, par, yards, company, role, years } = hole

    // ── Fairway: narrow, two segments ──
    // Segment A — straight west from tee
    const fwA = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), fairway())
    fwA.rotation.x = -Math.PI / 2
    fwA.position.set(76, 0.008, 82)
    fwA.receiveShadow = true
    scene.add(fwA)

    // Segment B — angled NW toward green
    const elbowToGreen = new THREE.Vector3(36, 0, 92).clone().sub(new THREE.Vector3(64, 0, 82))
    const lenB = elbowToGreen.length()
    const angleB = Math.atan2(elbowToGreen.x, elbowToGreen.z)
    const fwB = new THREE.Mesh(new THREE.PlaneGeometry(lenB + 2, 10), fairway())
    fwB.rotation.x = -Math.PI / 2
    fwB.rotation.z = -angleB
    fwB.position.set(50, 0.008, 87)
    fwB.receiveShadow = true
    scene.add(fwB)

    // Slight rough strips flanking hole 3 (tight corridor feel)
    const roughStrip1 = new THREE.Mesh(new THREE.PlaneGeometry(24, 5), rough())
    roughStrip1.rotation.x = -Math.PI / 2
    roughStrip1.position.set(76, 0.004, 88)
    scene.add(roughStrip1)

    const roughStrip2 = new THREE.Mesh(new THREE.PlaneGeometry(24, 5), rough())
    roughStrip2.rotation.x = -Math.PI / 2
    roughStrip2.position.set(76, 0.004, 76)
    scene.add(roughStrip2)

    // ── Kidney-shaped green — domed with undulation ──
    const kidneyFringeShape = new THREE.Shape()
    kidneyFringeShape.moveTo(-9, 0)
    kidneyFringeShape.bezierCurveTo(-11, -7, -4, -12, 3, -9)
    kidneyFringeShape.bezierCurveTo(10, -6, 12, 1, 9, 6)
    kidneyFringeShape.bezierCurveTo(8, 9, 5, 11, 2, 9)
    kidneyFringeShape.bezierCurveTo(4, 6, 3, 3, 0, 2)
    kidneyFringeShape.bezierCurveTo(-2, 2, -3, 5, -1, 8)
    kidneyFringeShape.bezierCurveTo(-4, 10, -7, 8, -8, 4)
    kidneyFringeShape.bezierCurveTo(-10, 2, -9, 0, -9, 0)
    const gFringe = new THREE.Mesh(new THREE.ShapeGeometry(kidneyFringeShape, 24), fringe())
    gFringe.rotation.x = -Math.PI / 2
    gFringe.position.copy(greenPos).setY(this.terrainHeight(greenPos.x, greenPos.z) + 0.02)
    gFringe.receiveShadow = true
    scene.add(gFringe)

    const kidneyGreenShape = new THREE.Shape()
    kidneyGreenShape.moveTo(-7, 0)
    kidneyGreenShape.bezierCurveTo(-9, -5, -3, -10, 2, -7)
    kidneyGreenShape.bezierCurveTo(8, -4, 10, 1, 7, 5)
    kidneyGreenShape.bezierCurveTo(6, 8, 3, 9, 1, 7)
    kidneyGreenShape.bezierCurveTo(3, 4, 2, 2, 0, 1)
    kidneyGreenShape.bezierCurveTo(-2, 2, -3, 4, -1, 7)
    kidneyGreenShape.bezierCurveTo(-4, 9, -7, 7, -8, 3)
    kidneyGreenShape.bezierCurveTo(-10, 1, -7, 0, -7, 0)
    const greenMesh3 = new THREE.Mesh(this.makeUndulatedGreenGeo(kidneyGreenShape, 0.18), green())
    greenMesh3.rotation.x = -Math.PI / 2
    greenMesh3.position.copy(greenPos).setY(this.terrainHeight(greenPos.x, greenPos.z) + 0.05)
    greenMesh3.receiveShadow = true
    scene.add(greenMesh3)

    // Gentle uphill mound framing back of green
    const backMound = new THREE.Mesh(
      new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      rough()
    )
    backMound.scale.set(1.2, 0.3, 1)
    backMound.position.set(greenPos.x - 10, 0, greenPos.z + 6)
    scene.add(backMound)

    // ── Bunkers ──
    this.addBunker(scene, new THREE.Vector3(greenPos.x + 6, 0, greenPos.z + 8), 3.5, 2.5)  // front right
    this.addBunker(scene, new THREE.Vector3(greenPos.x + 10, 0, greenPos.z - 4), 3.0, 2.0) // far right
    this.addBunker(scene, new THREE.Vector3(72, 0, 76), 2.8, 2.0)  // fairway left

    // Small pond left of approach
    const pond = new THREE.Mesh(new THREE.CircleGeometry(5, 28), water())
    pond.rotation.x = -Math.PI / 2
    pond.position.set(56, 0.05, 76)
    scene.add(pond)
    const pondBank = new THREE.Mesh(new THREE.RingGeometry(5, 6.2, 28), fringe())
    pondBank.rotation.x = -Math.PI / 2
    pondBank.position.set(56, 0.02, 76)
    scene.add(pondBank)

    // ── Tee box ── (drive goes west / -X, driveAngleY = -π/2)
    this.addTeeBox(scene, tee, -Math.PI / 2, this.terrainHeight(tee.x, tee.z))

    // ── Cup, flag, yardage sign ──
    this.addCupAndFlag(scene, new THREE.Vector3(greenPos.x, this.terrainHeight(greenPos.x, greenPos.z), greenPos.z), 0xddaa00)
    // Sign to north of tee, facing south (toward approaching cart from east)
    this.addYardageSign(scene, new THREE.Vector3(tee.x - 2, 0, tee.z - 8), Math.PI / 2, id, par, yards, company, role, years)

    this.zones.push({
      name: `hole_${id}_tee`,
      position: tee.clone(),
      triggerRadius: 10,
      data: { company, role, years, par: String(par), yards: String(yards), holeId: String(id) },
    })
    this.zones.push({
      name: `hole_${id}_green`,
      position: greenPos.clone(),
      triggerRadius: 10,
      data: { company, role, years },
    })
  }

  // ── Cart path ────────────────────────────────────────────────────────────────
  private addCartPath(scene: THREE.Scene) {
    const pathMat = path()
    const W = 3.2  // path width

    // Waypoints trace the path: Clubhouse → H1 tee → H1 green → H2 tee → H2 green → H3 tee → H3 green → back
    const waypoints: Array<[number, number]> = [
      [  0,  -8],   // clubhouse exit
      [ 30,  -8],   // head east
      [ 55,  -26],  // curve south toward H1 tee
      [ 62,  -26],  // alongside H1 tee (south)
      [100,  -26],  // south of H1 fairway
      [115,  -18],  // bend north toward H1 green
      [133,  -18],  // past H1 green (south)
      [133,    4],  // head north between H1 and H2
      [133,   20],  // approaching H2 tee (east side)
      [143,   26],  // curve east around H2 tee
      [164,   36],  // east side of H2 — heading north
      [166,   68],  // east of H2 green
      [158,   80],  // curve west toward H3
      [122,   88],  // heading west toward H3 tee
      [ 95,   90],  // south of H3 tee
      [ 85,   77],  // curve south then west alongside H3 fairway
      [ 50,   77],  // south of H3 fairway
      [ 28,   84],  // curve up to H3 green
      [ 22,   72],  // south of H3 green
      [ 16,   38],  // head south back to clubhouse
      [  8,   10],  // approaching clubhouse
      [  0,   -8],  // back to clubhouse entrance
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

    // Trees lining hole 1 fairway (south edge — OB)
    for (let i = 0; i < 9; i++) addTree(58 + i * 9, -30, 0.9 + Math.random() * 0.3, 0)
    // Trees lining hole 1 fairway (north rough)
    for (let i = 0; i < 7; i++) addTree(65 + i * 9, -2, 0.8 + Math.random() * 0.3, 2)

    // Trees framing hole 2 (east side OB)
    for (let i = 0; i < 6; i++) addTree(168, 30 + i * 8, 1.0 + Math.random() * 0.3, 1)
    // Trees west of hole 2 (beside lake)
    for (let i = 0; i < 4; i++) addTree(130, 35 + i * 8, 0.9 + Math.random() * 0.2, 0)

    // Trees tight on both sides of hole 3 fairway (narrow corridor)
    for (let i = 0; i < 6; i++) addTree(62 + i * 6, 72, 1.0 + Math.random() * 0.2, 2)  // south
    for (let i = 0; i < 6; i++) addTree(62 + i * 6, 92, 0.9 + Math.random() * 0.3, 1)  // north
    // Behind hole 3 green
    for (let i = 0; i < 4; i++) addTree(22 + i * 5, 96, 1.1 + Math.random() * 0.3, 0)

    // Trees around putting green
    ;[[-5, 20], [-6, -2], [34, 8], [33, 22]].forEach(([x, z]) => addTree(x, z, 1.1, 1))

    // Trees behind clubhouse
    for (let i = 0; i < 8; i++) addTree(-8 + i * 4, -34, 1.0 + Math.random() * 0.4, 0)

    // Scattered rough trees
    const roughPos = [
      [-50, 20], [-55, -10], [-45, 35], [-20, 42], [15, 42],
      [40, 38], [85, 38], [140, 0], [148, 80], [20, 100],
    ]
    roughPos.forEach(([x, z]) => addTree(x, z, 1.0 + Math.random() * 0.5, Math.floor(Math.random() * 3)))
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

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private addBunker(scene: THREE.Scene, pos: THREE.Vector3, rx: number, rz: number) {
    const bunker = new THREE.Mesh(new THREE.CircleGeometry(1, 28), sand())
    bunker.rotation.x = -Math.PI / 2
    bunker.scale.set(rx, 1, rz)
    bunker.position.copy(pos).setY(0.006)
    bunker.receiveShadow = true
    scene.add(bunker)
  }

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

  private addCupAndFlag(scene: THREE.Scene, pos: THREE.Vector3, flagColor: number) {
    // Real golf hole: 4.25 inches diameter = 0.108m → radius = 0.054
    const HOLE_R = 0.054
    const CUP_DEPTH = 0.12

    // Dark opening disc (sits just above surface)
    const openingMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 })
    const opening = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R, 24), openingMat)
    opening.rotation.x = -Math.PI / 2
    opening.position.copy(pos).setY(pos.y + 0.005)
    scene.add(opening)

    // White cup liner (open-top cylinder, visible from above)
    const linerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.BackSide })
    const liner = new THREE.Mesh(new THREE.CylinderGeometry(HOLE_R, HOLE_R, CUP_DEPTH, 24, 1, true), linerMat)
    liner.position.copy(pos).setY(pos.y - CUP_DEPTH / 2)
    scene.add(liner)

    // Cup bottom (dark)
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(HOLE_R, 24), openingMat)
    bottom.rotation.x = Math.PI / 2
    bottom.position.copy(pos).setY(pos.y - CUP_DEPTH)
    scene.add(bottom)

    // Flagstick
    const pinMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.5, roughness: 0.4 })
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.4, 8), pinMat)
    pin.position.copy(pos).setY(pos.y + 1.2)
    pin.castShadow = true
    scene.add(pin)

    // Flag
    const flagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.7, 0.45),
      new THREE.MeshStandardMaterial({ color: flagColor, roughness: 0.7, side: THREE.DoubleSide })
    )
    flagMesh.position.set(pos.x + 0.36, pos.y + 2.22, pos.z)
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
