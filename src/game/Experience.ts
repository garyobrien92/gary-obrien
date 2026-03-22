import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { Physics } from './Physics'
import { Input } from './Input'
import { Car } from './Car'
import { Camera } from './Camera'
import { World } from './World'

export type ZoneEvent = {
  zone: string
  data?: Record<string, string>
}

export class Experience {
  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private clock: THREE.Clock
  private physics: Physics
  private input: Input
  private car: Car
  private camera: Camera
  private world: World
  private animationId = 0
  private sizes: { width: number; height: number }
  private currentZone: string | null = null

  onZoneEnter?: (event: ZoneEvent) => void
  onZoneExit?: () => void

  constructor(canvas: HTMLCanvasElement) {
    this.sizes = { width: window.innerWidth, height: window.innerHeight }

    // ── Scene ────────────────────────────────────────────────────
    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0xc9dff0, 0.004)

    // ── Renderer ─────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // ── Sky ──────────────────────────────────────────────────────
    const sky = new Sky()
    sky.scale.setScalar(450000)
    this.scene.add(sky)

    const sunDir = new THREE.Vector3()
    const phi = THREE.MathUtils.degToRad(82)   // sun elevation (near horizon = golden-ish)
    const theta = THREE.MathUtils.degToRad(200)
    sunDir.setFromSphericalCoords(1, phi, theta)

    const skyUniforms = sky.material.uniforms
    skyUniforms['sunPosition'].value.copy(sunDir)
    skyUniforms['turbidity'].value = 6
    skyUniforms['rayleigh'].value = 1.5
    skyUniforms['mieCoefficient'].value = 0.004
    skyUniforms['mieDirectionalG'].value = 0.8

    // ── HDR Environment (reflections on cart, etc.) ──────────────
    new RGBELoader().load('/textures/environmentMap/2k.hdr', (hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping
      this.scene.environment = hdr
    })

    // ── Systems ──────────────────────────────────────────────────
    this.physics = new Physics()
    this.input = new Input()
    this.camera = new Camera(this.sizes)
    this.scene.add(this.camera.instance)

    this.world = new World(this.scene, this.physics.world, sunDir)
    this.car = new Car(this.scene, this.physics.world, this.input)

    this.clock = new THREE.Clock()
    window.addEventListener('resize', this.onResize)
    this.tick()
  }

  private onResize = () => {
    this.sizes.width = window.innerWidth
    this.sizes.height = window.innerHeight
    this.camera.resize(this.sizes)
    this.renderer.setSize(this.sizes.width, this.sizes.height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  }

  private checkZones() {
    const pos = this.car.getPosition()
    let entered: string | null = null
    let enteredData: Record<string, string> | undefined

    for (const zone of this.world.zones) {
      if (pos.distanceTo(zone.position) < zone.triggerRadius) {
        entered = zone.name
        enteredData = zone.data
        break
      }
    }

    if (entered !== this.currentZone) {
      this.currentZone = entered
      if (entered) {
        this.onZoneEnter?.({ zone: entered, data: enteredData })
      } else {
        this.onZoneExit?.()
      }
    }
  }

  private tick = () => {
    const delta = Math.min(this.clock.getDelta(), 0.05)
    this.car.preUpdate(delta)
    this.physics.update(delta)
    this.car.postUpdate()
    this.camera.update(this.car.getPosition(), this.car.getQuaternion())
    this.checkZones()
    this.renderer.render(this.scene, this.camera.instance)
    this.animationId = requestAnimationFrame(this.tick)
  }

  destroy() {
    cancelAnimationFrame(this.animationId)
    window.removeEventListener('resize', this.onResize)
    this.input.destroy()
    this.camera.destroy()
    this.renderer.dispose()
  }
}
