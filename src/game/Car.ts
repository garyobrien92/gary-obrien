import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import RAPIER from '@dimforge/rapier3d-compat'
import { Input } from './Input'
import { CLUBHOUSE_POSITION, terrainHeightAt } from './World'

// Car forward = +Z, up = +Y, right = +X
const WHEEL_POSITIONS = [
  new THREE.Vector3(-0.85, 0,  1.2),  // front left
  new THREE.Vector3( 0.85, 0,  1.2),  // front right
  new THREE.Vector3(-0.85, 0, -1.2),  // rear left
  new THREE.Vector3( 0.85, 0, -1.2),  // rear right
]
const DIRECTION_CS    = { x: 0, y: -1, z: 0 }
const AXLE_CS         = { x: 1, y:  0, z: 0 }
const SUSPENSION_REST = 0.6
const WHEEL_RADIUS    = 0.38

const ENGINE_FORCE    = 1000
const TOP_SPEED       = 10
const BRAKE_AMP       = 35
const IDLE_BRAKE      = 0.06
const REVERSE_BRAKE   = 0.4
const STEER_AMP       = 0.65

const MODEL_SCALE     = 1.5   // tweak if too big/small
const MODEL_Y_OFFSET  = -0.55 // tweak if floating or clipping ground
// Parked south-east of pro shop entrance (left side of building).
// Cart faces north-west so pro shop + putting green are directly ahead.
// Y = terrain height + ride height (suspension_rest + wheel_radius + buffer ≈ 1.1)
const SPAWN_X = 21, SPAWN_Z = 13.1
const SPAWN_POSITION  = new THREE.Vector3(SPAWN_X, terrainHeightAt(SPAWN_X, SPAWN_Z) + 1.0, SPAWN_Z)
const TO_SHOP = CLUBHOUSE_POSITION.clone().sub(SPAWN_POSITION)
const SPAWN_YAW = Math.atan2(TO_SHOP.x, TO_SHOP.z)

export class Car {
  mesh: THREE.Group
  private body: RAPIER.RigidBody
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private controller: any
  private _input: Input
  private steerAngle = 0
  // Steering pivot groups wrapping front wheels (handle any local-axis orientation)
  private _steerPivots: THREE.Group[] = []

  constructor(scene: THREE.Scene, world: RAPIER.World, input: Input) {
    this._input = input
    this.mesh = new THREE.Group()
    scene.add(this.mesh)

    // ── Load golf cart model ──────────────────────────────────────
    const loader = new GLTFLoader()
    loader.load('/models/car.glb', (gltf) => {
      const model = gltf.scene
      // This model's front is at model-local +Z. No rotation needed.
      model.rotation.y = 0
      model.scale.setScalar(MODEL_SCALE)
      model.position.y = MODEL_Y_OFFSET

      const wheelNodes: THREE.Object3D[] = []

      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true
          child.receiveShadow = true
        }
        if (/wheel/i.test(child.name)) wheelNodes.push(child)
      })

      // Model front is at model-local +Z (highest Z = front of cart).
      // Sort DESCENDING so index 0 = front axle (highest Z = z≈0.66).
      wheelNodes.sort((a, b) => {
        const zDiff = b.position.z - a.position.z   // descending: highest Z first
        if (Math.abs(zDiff) > 0.3) return zDiff
        return a.position.x - b.position.x
      })

      // Deduplicate: keep one representative node per Z bucket (one per axle).
      const byZ = new Map<number, THREE.Object3D>()
      for (const w of wheelNodes) {
        const zKey = Math.round(w.position.z * 2)
        if (!byZ.has(zKey)) byZ.set(zKey, w)
      }
      // Descending by Z so index 0 = front axle (highest Z), index 1 = rear
      const zKeys = [...byZ.keys()].sort((a, b) => b - a)

      this._steerPivots = []

      // Add model now so world matrices can be computed
      this.mesh.add(model)
      model.updateWorldMatrix(true, true)

      zKeys.slice(0, 2).forEach((zKey, axleIdx) => {
        const source = byZ.get(zKey)!
        const isFront = axleIdx === 0

        // Capture BEFORE any reparenting changes source.parent / source.position
        const origParent = source.parent!
        const origX      = source.position.x

        // ── Mirror wheel (cloned before attach so position is still original) ──
        const mirror = source.clone(true)
        mirror.traverse(c => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow = true; c.receiveShadow = true
            const mat  = (c as THREE.Mesh).material
            const mats = Array.isArray(mat) ? mat : [mat]
            mats.forEach(m => { (m as THREE.MeshStandardMaterial).side = THREE.DoubleSide })
          }
        })
        mirror.position.x = -origX        // flip X in parent-local space
        origParent.add(mirror)

        if (isFront) {
          // ── Steer pivot for source wheel ──────────────────────────
          const sPos = new THREE.Vector3()
          source.getWorldPosition(sPos)
          const pivotS = new THREE.Group()
          pivotS.position.copy(model.worldToLocal(sPos.clone()))
          model.add(pivotS)
          pivotS.attach(source)
          this._steerPivots.push(pivotS)

          // ── Steer pivot for mirror wheel ──────────────────────────
          model.updateWorldMatrix(true, true)   // refresh after reparenting
          const mPos = new THREE.Vector3()
          mirror.getWorldPosition(mPos)
          const pivotM = new THREE.Group()
          pivotM.position.copy(model.worldToLocal(mPos.clone()))
          model.add(pivotM)
          pivotM.attach(mirror)
          this._steerPivots.push(pivotM)
        }
      })

      console.log('Steer pivots:', this._steerPivots.length)
    })

    // ── Physics chassis ───────────────────────────────────────────
    const spawnQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), SPAWN_YAW)
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(SPAWN_POSITION.x, SPAWN_POSITION.y, SPAWN_POSITION.z)
      .setRotation({ x: spawnQuat.x, y: spawnQuat.y, z: spawnQuat.z, w: spawnQuat.w })
      .setLinearDamping(0.1)
      .setAngularDamping(0.1)
      .setCanSleep(false)
    this.body = world.createRigidBody(bodyDesc)

    world.createCollider(
      RAPIER.ColliderDesc.cuboid(0.9, 0.4, 1.8)
        .setTranslation(0, -0.1, 0)
        .setMassProperties(2.5, { x: 0, y: -0.5, z: 0 }, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0, w: 1 })
        .setFriction(0.4)
        .setRestitution(0.15),
      this.body
    )

    // ── Vehicle controller ────────────────────────────────────────
    this.controller = world.createVehicleController(this.body)
    this.controller.setIndexForwardAxis = 2
    this.controller.indexUpAxis         = 1

    for (const pos of WHEEL_POSITIONS) {
      this.controller.addWheel(pos, DIRECTION_CS, AXLE_CS, SUSPENSION_REST, WHEEL_RADIUS)
    }
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelSuspensionStiffness(i, 30)
      this.controller.setWheelSuspensionCompression(i, 10)
      this.controller.setWheelSuspensionRelaxation(i, 2.7)
      this.controller.setWheelMaxSuspensionForce(i, 100)
      this.controller.setWheelMaxSuspensionTravel(i, 0.5)
      this.controller.setWheelFrictionSlip(i, 0.9)
      this.controller.setWheelSideFrictionStiffness(i, 1.8)
    }
  }

  preUpdate(dt: number) {
    const { isDown } = this._input

    const accelerating = (isDown('ArrowUp')   || isDown('KeyW')) ?  1
                       : (isDown('ArrowDown')  || isDown('KeyS')) ? -1 : 0
    const braking = isDown('Space') ? 1 : 0

    const vel  = this.body.linvel()
    const rot  = this.body.rotation()
    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)
    const fwd  = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
    const speed = fwd.dot(new THREE.Vector3(vel.x, vel.y, vel.z))
    const goingForward = speed > 0.1

    const overflow = Math.max(0, Math.abs(speed) - TOP_SPEED)
    let engineForce = accelerating * ENGINE_FORCE / (1 + overflow) * dt

    let brake = braking
    if (!braking && Math.abs(accelerating) < 0.1) brake = IDLE_BRAKE
    if (
      Math.abs(speed) > 0.5 &&
      ((accelerating > 0 && !goingForward) || (accelerating < 0 && goingForward))
    ) {
      brake = REVERSE_BRAKE
      engineForce = 0
    }
    brake *= BRAKE_AMP * dt

    const targetSteer = (isDown('ArrowLeft')  || isDown('KeyA')) ?  STEER_AMP
                      : (isDown('ArrowRight') || isDown('KeyD')) ? -STEER_AMP : 0
    this.steerAngle += (targetSteer - this.steerAngle) * 0.10

    this.controller.setWheelSteering(0, this.steerAngle)
    this.controller.setWheelSteering(1, this.steerAngle)
    for (let i = 0; i < 4; i++) {
      this.controller.setWheelEngineForce(i, -engineForce)
      this.controller.setWheelBrake(i, brake)
    }
    this.controller.updateVehicle(dt)
  }

  postUpdate() {
    const rot  = this.body.rotation()
    const pos  = this.body.translation()
    const quat = new THREE.Quaternion(rot.x, rot.y, rot.z, rot.w)

    // Sync chassis group (model moves with it via MODEL_Y_OFFSET child)
    this.mesh.position.set(pos.x, pos.y, pos.z)
    this.mesh.quaternion.copy(quat)

    // Steer: only rotate the front-wheel pivots (bounded ±STEER_AMP, never 360°)
    for (const pivot of this._steerPivots) {
      pivot.rotation.y = this.steerAngle
    }
  }

  getPosition(): THREE.Vector3 {
    const p = this.body.translation()
    return new THREE.Vector3(p.x, p.y, p.z)
  }

  getQuaternion(): THREE.Quaternion {
    const q = this.body.rotation()
    return new THREE.Quaternion(q.x, q.y, q.z, q.w)
  }
}
