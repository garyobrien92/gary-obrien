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

export const HOLES = [
  {
    id: 1,
    company: 'TBD',
    role: 'TBD',
    years: 'TBD',
    description: 'Career details coming soon — send Gary your CV request!',
    par: 4,
    yards: 380,
    teePosition: new THREE.Vector3(60, 0, -15),
    greenPosition: new THREE.Vector3(133, 0, -4),
  },
  {
    id: 2,
    company: 'TBD',
    role: 'TBD',
    years: 'TBD',
    description: 'Career details coming soon — send Gary your CV request!',
    par: 3,
    yards: 160,
    teePosition: new THREE.Vector3(133, 0, 28),
    greenPosition: new THREE.Vector3(158, 0, 72),
  },
  {
    id: 3,
    company: 'TBD',
    role: 'TBD',
    years: 'TBD',
    description: 'Career details coming soon — send Gary your CV request!',
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

  constructor(scene: THREE.Scene, physicsWorld: RAPIER.World, sunDirection: THREE.Vector3) {
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

  // ── Ground ─────────────────────────────────────────────────────────────────
  private addGround(scene: THREE.Scene, physicsWorld: RAPIER.World) {
    const geo = new THREE.PlaneGeometry(500, 500, 1, 1)
    const groundMesh = new THREE.Mesh(geo, makeGrassMaterial())
    groundMesh.rotation.x = -Math.PI / 2
    groundMesh.receiveShadow = true
    scene.add(groundMesh)

    const groundBody = physicsWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    physicsWorld.createCollider(
      RAPIER.ColliderDesc.cuboid(500, 0.1, 500).setTranslation(0, -0.1, 0),
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
      new THREE.Vector3(center.x - 3.5, 0, center.z + 2),
      new THREE.Vector3(center.x + 3,   0, center.z - 3),
      new THREE.Vector3(center.x + 0.5, 0, center.z + 5.5),
    ]

    holePositions.forEach((pos, i) => {
      this.addCupAndFlag(scene, pos, flagColors[i])
    })

    this.addSignPost(scene, new THREE.Vector3(center.x - 8, 0, center.z - 9), darkGreen())
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

    // ── Oval green (CircleGeometry scaled to look oval) ──
    const greenFringe = new THREE.Mesh(new THREE.CircleGeometry(10, 48), fringe())
    greenFringe.rotation.x = -Math.PI / 2
    greenFringe.position.copy(greenPos).setY(0.007)
    greenFringe.scale.set(1.3, 1, 0.9)
    greenFringe.receiveShadow = true
    scene.add(greenFringe)

    const greenMesh = new THREE.Mesh(new THREE.CircleGeometry(8, 48), green())
    greenMesh.rotation.x = -Math.PI / 2
    greenMesh.position.copy(greenPos).setY(0.01)
    greenMesh.scale.set(1.3, 1, 0.85)   // stretched oval
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

    // ── Tee box ──
    this.addTeeBox(scene, tee)

    // ── Cup, flag, yardage sign ──
    this.addCupAndFlag(scene, greenPos, 0xcc2222)
    this.addYardageSign(scene, tee, id, par, yards, company, role, years)

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

    // ── Elevated tee platform (raised hill) ──
    const teeMound = new THREE.Mesh(
      new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      rough()
    )
    teeMound.scale.set(1, 0.5, 1)
    teeMound.position.set(tee.x, 0, tee.z)
    teeMound.castShadow = true
    scene.add(teeMound)

    // Tee surface on top of mound
    const teeSurface = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), fairway())
    teeSurface.rotation.x = -Math.PI / 2
    teeSurface.position.set(tee.x, 0.7, tee.z)
    teeSurface.receiveShadow = true
    scene.add(teeSurface)

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

    // ── Small tight circular green (elevated slightly) ──
    const greenMound = new THREE.Mesh(
      new THREE.SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      rough()
    )
    greenMound.scale.set(1, 0.25, 1)
    greenMound.position.set(greenPos.x, 0, greenPos.z)
    scene.add(greenMound)

    // Fringe — slightly bigger
    const gFringe = new THREE.Mesh(new THREE.CircleGeometry(7, 48), fringe())
    gFringe.rotation.x = -Math.PI / 2
    gFringe.position.copy(greenPos).setY(0.12)
    gFringe.receiveShadow = true
    scene.add(gFringe)

    // Green surface — tight circle
    const greenMesh = new THREE.Mesh(new THREE.CircleGeometry(5, 48), green())
    greenMesh.rotation.x = -Math.PI / 2
    greenMesh.position.copy(greenPos).setY(0.15)
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

    // ── Tee box markers ──
    this.addTeeBox(scene, tee, 0.7)

    // ── Cup, flag, yardage sign ──
    this.addCupAndFlag(scene, new THREE.Vector3(greenPos.x, 0.15, greenPos.z), 0x2244cc)
    this.addYardageSign(scene, tee, id, par, yards, company, role, years)

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

    // ── Kidney green — two overlapping ovals ──
    // Main lobe (larger, front)
    const gFringeLobe1 = new THREE.Mesh(new THREE.CircleGeometry(9, 40), fringe())
    gFringeLobe1.rotation.x = -Math.PI / 2
    gFringeLobe1.position.set(greenPos.x + 2, 0.006, greenPos.z - 1)
    gFringeLobe1.receiveShadow = true
    scene.add(gFringeLobe1)

    // Back lobe (smaller, offset)
    const gFringeLobe2 = new THREE.Mesh(new THREE.CircleGeometry(7, 40), fringe())
    gFringeLobe2.rotation.x = -Math.PI / 2
    gFringeLobe2.position.set(greenPos.x - 3, 0.007, greenPos.z + 5)
    gFringeLobe2.receiveShadow = true
    scene.add(gFringeLobe2)

    const greenLobe1 = new THREE.Mesh(new THREE.CircleGeometry(7, 40), green())
    greenLobe1.rotation.x = -Math.PI / 2
    greenLobe1.position.set(greenPos.x + 2, 0.01, greenPos.z - 1)
    greenLobe1.receiveShadow = true
    scene.add(greenLobe1)

    const greenLobe2 = new THREE.Mesh(new THREE.CircleGeometry(5, 40), green())
    greenLobe2.rotation.x = -Math.PI / 2
    greenLobe2.position.set(greenPos.x - 3, 0.012, greenPos.z + 5)
    greenLobe2.receiveShadow = true
    scene.add(greenLobe2)

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

    // ── Elevated tee with a view ──
    const teeMound = new THREE.Mesh(
      new THREE.SphereGeometry(7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      rough()
    )
    teeMound.scale.set(1, 0.45, 1)
    teeMound.position.set(tee.x, 0, tee.z)
    scene.add(teeMound)

    const teeSurface = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 6), fairway())
    teeSurface.position.set(tee.x, 0.7, tee.z)
    teeSurface.receiveShadow = true
    scene.add(teeSurface)

    this.addTeeBox(scene, new THREE.Vector3(tee.x, 0.7, tee.z))

    // ── Cup, flag, yardage sign ──
    this.addCupAndFlag(scene, new THREE.Vector3(greenPos.x, 0.01, greenPos.z), 0xddaa00)
    this.addYardageSign(scene, tee, id, par, yards, company, role, years)

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

    const addPathSegment = (
      x: number, z: number, length: number, rotationZ: number, width = 3
    ) => {
      const seg = new THREE.Mesh(new THREE.PlaneGeometry(width, length), pathMat)
      seg.rotation.x = -Math.PI / 2
      seg.rotation.z = rotationZ
      seg.position.set(x, 0.002, z)
      seg.receiveShadow = true
      scene.add(seg)
    }

    // Clubhouse → Putting green
    addPathSegment(11, 5, 25, Math.atan2(10 - 0, 22 - 0))

    // Clubhouse → Driving range
    addPathSegment(-19, 0, 42, 0)

    // Clubhouse → Hole 1 tee
    addPathSegment(30, -16, 62, Math.PI / 2)

    // Hole 1 along fairway (north side path)
    addPathSegment(82, -26, 50, Math.PI / 2)

    // Hole 1 green → Hole 2 tee (north)
    addPathSegment(133, 7, 42, 0)

    // Hole 2 tee → Hole 2 green area (along east side)
    addPathSegment(162, 50, 50, 0)

    // Hole 2 green → Hole 3 tee (west)
    addPathSegment(123, 78, 72, Math.PI / 2)

    // Hole 3 fairway path (south edge)
    addPathSegment(62, 75, 58, Math.PI / 2)

    // Hole 3 green → back to putting green area
    addPathSegment(30, 50, 85, 0)
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

      g.position.set(x, 0, z)
      scene.add(g)
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

  private addTeeBox(scene: THREE.Scene, teePos: THREE.Vector3, yBase = 0) {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 5), fairway())
    platform.position.copy(teePos)
    platform.position.y = yBase + 0.06
    platform.receiveShadow = true
    platform.castShadow = true
    scene.add(platform)

    const markerMat = new THREE.MeshStandardMaterial({ color: 0x2244bb, roughness: 0.5, metalness: 0.1 })
    ;[-0.6, 0.6].forEach(x => {
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.2, 12), markerMat)
      marker.position.set(teePos.x + x, yBase + 0.1, teePos.z + 1.5)
      scene.add(marker)
    })
  }

  private addCupAndFlag(scene: THREE.Scene, pos: THREE.Vector3, flagColor: number) {
    const holeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1 })
    const cup = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), holeMat)
    cup.rotation.x = -Math.PI / 2
    cup.position.copy(pos).setY(pos.y + 0.01)
    scene.add(cup)

    const pinMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.5, roughness: 0.4 })
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 3, 8), pinMat)
    pin.position.copy(pos).setY(pos.y + 1.52)
    pin.castShadow = true
    scene.add(pin)

    const flagMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.0, 0.6),
      new THREE.MeshStandardMaterial({ color: flagColor, roughness: 0.7, side: THREE.DoubleSide })
    )
    flagMesh.position.set(pos.x + 0.5, pos.y + 2.8, pos.z)
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
    teePos: THREE.Vector3,
    _id: number,
    _par: number,
    _yards: number,
    _company: string,
    _role: string,
    _years: string
  ) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.5, 8), wood())
    post.position.set(teePos.x + 3.5, 1.25, teePos.z)
    post.castShadow = true
    scene.add(post)

    const board = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, 0.18), darkGreen())
    board.position.set(teePos.x + 3.5, 2.85, teePos.z)
    board.castShadow = true
    scene.add(board)

    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(4, 0.55, 0.19),
      new THREE.MeshStandardMaterial({ color: 0xc8a400, roughness: 0.6, metalness: 0.2 })
    )
    stripe.position.set(teePos.x + 3.5, 3.97, teePos.z)
    scene.add(stripe)
  }
}
