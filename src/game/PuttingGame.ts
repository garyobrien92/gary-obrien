import * as THREE from 'three'

export type PuttingState = 'aiming' | 'charging' | 'rolling' | 'sunk' | 'miss'

// Boundary ellipse for the putting green (semi-axes, matches organic shape in World.ts)
const BOUNDARY_RX = 9.5
const BOUNDARY_RZ = 8.0
const GRAVITY_WELL_RADIUS = 0.55   // units from hole centre where the pull starts
const GRAVITY_WELL_STRENGTH = 18   // acceleration toward hole at well edge
const HOLE_SINK_RADIUS = 0.18      // ball sinks when it gets this close (regulation ~0.054 visual, a bit generous)
const SLOPE_GRAVITY = 22           // acceleration down slope (m/s² equivalent in game units)

export class PuttingGame {
  state: PuttingState = 'aiming'
  power = 0

  private stateTimer = 0
  private scene: THREE.Scene
  private ballMesh: THREE.Mesh
  private aimArrow: THREE.ArrowHelper
  private ballPos = new THREE.Vector3()
  private ballVel = new THREE.Vector3()
  private aimAngle = 0
  private shotCameraDir = new THREE.Vector3(1, 0, 0)
  private holePositions: THREE.Vector3[]
  private targetHoleIdx = 0
  private terrainHeight: (x: number, z: number) => number
  private greenCenter: THREE.Vector3

  onStateChange?: (state: PuttingState, power: number) => void

  constructor(
    scene: THREE.Scene,
    holePositions: THREE.Vector3[],
    greenCenter: THREE.Vector3,
    terrainHeight: (x: number, z: number) => number
  ) {
    this.scene = scene
    this.holePositions = holePositions
    this.greenCenter = greenCenter
    this.terrainHeight = terrainHeight

    // Golf ball (regulation 0.054 unit radius)
    const ballGeo = new THREE.SphereGeometry(0.054, 16, 12)
    const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 })
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat)
    this.ballMesh.castShadow = true
    this.ballMesh.visible = false
    scene.add(this.ballMesh)

    // Aim arrow (yellow)
    this.aimArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0.1, 0),
      1.5,
      0xffee00,
      0.4,
      0.25
    )
    this.aimArrow.visible = false
    scene.add(this.aimArrow)
  }

  /** Start a new putt — picks a random hole and places the ball 3-5 units away. */
  activate() {
    this.targetHoleIdx = Math.floor(Math.random() * this.holePositions.length)
    const hole = this.holePositions[this.targetHoleIdx]

    const angle = Math.random() * Math.PI * 2
    const dist = 3 + Math.random() * 2
    const sx = hole.x + Math.cos(angle) * dist
    const sz = hole.z + Math.sin(angle) * dist
    const sy = this.terrainHeight(sx, sz) + 0.055

    this.ballPos.set(sx, sy, sz)
    this.ballVel.set(0, 0, 0)
    this.power = 0
    this.aimAngle = Math.atan2(hole.z - sz, hole.x - sx)
    this.shotCameraDir.set(Math.cos(this.aimAngle), 0, Math.sin(this.aimAngle))

    this.ballMesh.position.copy(this.ballPos)
    this.ballMesh.visible = true
    this.aimArrow.visible = true

    this.setState('aiming')
  }

  /** After a miss, keep the ball where it stopped and go back to aiming. */
  private resumeAiming() {
    this.ballVel.set(0, 0, 0)
    this.power = 0
    // Re-aim toward the hole from current ball position
    const hole = this.holePositions[this.targetHoleIdx]
    this.aimAngle = Math.atan2(hole.z - this.ballPos.z, hole.x - this.ballPos.x)
    this.shotCameraDir.set(Math.cos(this.aimAngle), 0, Math.sin(this.aimAngle))
    this.aimArrow.visible = true
    this.ballMesh.visible = true
    this.setState('aiming')
  }

  deactivate() {
    this.ballMesh.visible = false
    this.aimArrow.visible = false
  }

  private setState(s: PuttingState) {
    this.state = s
    this.stateTimer = 0
    this.onStateChange?.(s, this.power)
  }

  update(delta: number, input: {
    left: boolean
    right: boolean
    spaceDown: boolean
    spaceReleased: boolean
  }) {
    this.stateTimer += delta

    // Miss: show "Nice try" briefly then resume from where ball stopped
    if (this.state === 'miss' && this.stateTimer > 1.5) {
      this.resumeAiming()
      return
    }
    if (this.state === 'sunk') return

    const hole = this.holePositions[this.targetHoleIdx]

    if (this.state === 'aiming') {
      if (input.left)  this.aimAngle -= 2.0 * delta
      if (input.right) this.aimAngle += 2.0 * delta
      this.updateArrow()

      if (input.spaceDown) {
        this.power = 0
        this.setState('charging')
      }
    } else if (this.state === 'charging') {
      if (input.left)  this.aimAngle -= 2.0 * delta
      if (input.right) this.aimAngle += 2.0 * delta
      this.updateArrow()

      this.power = Math.min(1, this.power + delta * 0.65)
      this.onStateChange?.(this.state, this.power)

      if (input.spaceReleased) {
        const speed = this.power * 9 // max ~9 units/sec at full power
        this.shotCameraDir.set(Math.cos(this.aimAngle), 0, Math.sin(this.aimAngle))
        this.ballVel.set(Math.cos(this.aimAngle) * speed, 0, Math.sin(this.aimAngle) * speed)
        this.power = 0
        this.aimArrow.visible = false
        this.setState('rolling')
      }
    } else if (this.state === 'rolling') {
      // ── Slope physics: ball accelerates downhill ──────────────────
      const eps = 0.18
      const dhdx = (this.terrainHeight(this.ballPos.x + eps, this.ballPos.z)
                  - this.terrainHeight(this.ballPos.x - eps, this.ballPos.z)) / (2 * eps)
      const dhdz = (this.terrainHeight(this.ballPos.x, this.ballPos.z + eps)
                  - this.terrainHeight(this.ballPos.x, this.ballPos.z - eps)) / (2 * eps)
      this.ballVel.x -= dhdx * SLOPE_GRAVITY * delta
      this.ballVel.z -= dhdz * SLOPE_GRAVITY * delta

      // ── Gravity well near each hole ───────────────────────────────
      for (const holePos of this.holePositions) {
        const hdx = holePos.x - this.ballPos.x
        const hdz = holePos.z - this.ballPos.z
        const hdist = Math.sqrt(hdx * hdx + hdz * hdz)
        if (hdist < GRAVITY_WELL_RADIUS && hdist > 0.01) {
          const pull = GRAVITY_WELL_STRENGTH * (1 - hdist / GRAVITY_WELL_RADIUS)
          this.ballVel.x += (hdx / hdist) * pull * delta
          this.ballVel.z += (hdz / hdist) * pull * delta
        }
      }

      // ── Friction: 62% speed retained per second ───────────────────
      const decay = Math.pow(0.62, delta)
      this.ballVel.multiplyScalar(decay)

      // ── Move ball ─────────────────────────────────────────────────
      this.ballPos.x += this.ballVel.x * delta
      this.ballPos.z += this.ballVel.z * delta
      this.ballPos.y = this.terrainHeight(this.ballPos.x, this.ballPos.z) + 0.055

      this.ballMesh.position.copy(this.ballPos)

      // ── Visual spin ───────────────────────────────────────────────
      const spd = this.ballVel.length()
      if (spd > 0.05) {
        const axis = new THREE.Vector3(-this.ballVel.z, 0, this.ballVel.x).normalize()
        this.ballMesh.rotateOnWorldAxis(axis, spd * delta * 10)
      }

      // ── Hole detection ────────────────────────────────────────────
      const dx = this.ballPos.x - hole.x
      const dz = this.ballPos.z - hole.z
      if (dx * dx + dz * dz < HOLE_SINK_RADIUS * HOLE_SINK_RADIUS) {
        this.ballMesh.visible = false
        this.aimArrow.visible = false
        this.setState('sunk')
        return
      }

      // ── Boundary: ellipse bounce ──────────────────────────────────
      const bcx = (this.ballPos.x - this.greenCenter.x) / BOUNDARY_RX
      const bcz = (this.ballPos.z - this.greenCenter.z) / BOUNDARY_RZ
      const bd2 = bcx * bcx + bcz * bcz
      if (bd2 > 1) {
        const bd = Math.sqrt(bd2)
        // Push ball back to just inside boundary
        this.ballPos.x = this.greenCenter.x + (bcx / bd) * BOUNDARY_RX * 0.97
        this.ballPos.z = this.greenCenter.z + (bcz / bd) * BOUNDARY_RZ * 0.97
        // Normal at ellipse point (unnormalized gradient of ellipse equation)
        const nnx = bcx / (BOUNDARY_RX * bd)
        const nnz = bcz / (BOUNDARY_RZ * bd)
        const nlen = Math.sqrt(nnx * nnx + nnz * nnz)
        const nx = nnx / nlen, nz = nnz / nlen
        const dot = this.ballVel.x * nx + this.ballVel.z * nz
        // Reflect and lose ~40% energy on bounce
        this.ballVel.x = (this.ballVel.x - 2 * dot * nx) * 0.60
        this.ballVel.z = (this.ballVel.z - 2 * dot * nz) * 0.60
      }

      // ── Ball stopped: resume aiming from current position ─────────
      if (spd < 0.06) {
        this.setState('miss')
      }
    }
  }

  private updateArrow() {
    const dir = new THREE.Vector3(Math.cos(this.aimAngle), 0, Math.sin(this.aimAngle))
    this.aimArrow.position.copy(this.ballPos).add(new THREE.Vector3(0, 0.08, 0))
    this.aimArrow.setDirection(dir)
    const len = this.state === 'charging' ? 1.5 + this.power * 2.5 : 1.5
    this.aimArrow.setLength(len, 0.4, 0.25)
  }

  private getCameraForward(): THREE.Vector3 {
    // Aim states should rotate camera exactly with the current aim direction.
    if (this.state === 'aiming' || this.state === 'charging') {
      return new THREE.Vector3(Math.cos(this.aimAngle), 0, Math.sin(this.aimAngle))
    }

    // After strike, keep camera locked to the strike direction.
    return this.shotCameraDir.clone()
  }

  getCameraPosition(): THREE.Vector3 {
    const fwd = this.getCameraForward()
    return this.ballPos.clone()
      .addScaledVector(fwd, -2.5)
      .add(new THREE.Vector3(0, 1.5, 0))
  }

  getCameraLookAt(): THREE.Vector3 {
    const fwd = this.getCameraForward()
    return this.ballPos.clone()
      .addScaledVector(fwd, 2.5)
      .add(new THREE.Vector3(0, 0.2, 0))
  }

  dispose() {
    this.scene.remove(this.ballMesh)
    this.scene.remove(this.aimArrow)
    ;(this.ballMesh.geometry as THREE.BufferGeometry).dispose()
  }
}
