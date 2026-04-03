import * as THREE from 'three'

export class Camera {
  instance: THREE.PerspectiveCamera
  private currentPos = new THREE.Vector3()
  private currentLook = new THREE.Vector3()

  // Orbit angles (user can drag to rotate around cart)
  private yaw = Math.PI  // start directly behind the cart
  private pitch = 0.45   // slightly above
  private distance = 10

  private isDragging = false
  private lastMouse = { x: 0, y: 0 }

  private onMouseDown: (e: MouseEvent) => void
  private onMouseMove: (e: MouseEvent) => void
  private onMouseUp: () => void
  private onWheel: (e: WheelEvent) => void

  constructor(sizes: { width: number; height: number }) {
    this.instance = new THREE.PerspectiveCamera(65, sizes.width / sizes.height, 0.1, 500)
    this.instance.position.set(0, 8, 10)

    this.onMouseDown = (e) => {
      // Only pan on right-click or middle-click (left click is for game interaction)
      if (e.button === 0 || e.button === 2) {
        this.isDragging = true
        this.lastMouse = { x: e.clientX, y: e.clientY }
      }
    }
    this.onMouseMove = (e) => {
      if (!this.isDragging) return
      const dx = e.clientX - this.lastMouse.x
      const dy = e.clientY - this.lastMouse.y
      this.lastMouse = { x: e.clientX, y: e.clientY }
      this.yaw -= dx * 0.008
      this.pitch = Math.max(0.15, Math.min(1.2, this.pitch + dy * 0.005))
    }
    this.onMouseUp = () => { this.isDragging = false }
    this.onWheel = (e) => {
      this.distance = Math.max(4, Math.min(20, this.distance + e.deltaY * 0.02))
    }

    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mouseup', this.onMouseUp)
    window.addEventListener('wheel', this.onWheel, { passive: true })
  }

  /** Smoothly move camera to a fixed position + lookAt (used in putting mode). */
  setPuttingView(position: THREE.Vector3, lookAt: THREE.Vector3) {
    this.currentPos.lerp(position, 0.06)
    this.instance.position.copy(this.currentPos)
    this.currentLook.lerp(lookAt, 0.08)
    this.instance.lookAt(this.currentLook)
  }

  update(carPosition: THREE.Vector3, carQuaternion: THREE.Quaternion) {
    // Get car's forward direction to anchor yaw relative to it
    const carYaw = new THREE.Euler().setFromQuaternion(carQuaternion, 'YXZ').y

    const totalYaw = carYaw + this.yaw

    // Compute camera position in spherical coords around cart
    const x = carPosition.x + Math.sin(totalYaw) * Math.cos(this.pitch) * this.distance
    const y = carPosition.y + Math.sin(this.pitch) * this.distance + 1
    const z = carPosition.z + Math.cos(totalYaw) * Math.cos(this.pitch) * this.distance

    this.currentPos.lerp(new THREE.Vector3(x, y, z), 0.07)
    this.instance.position.copy(this.currentPos)

    const lookTarget = carPosition.clone()
    lookTarget.y += 0.8
    this.currentLook.lerp(lookTarget, 0.12)
    this.instance.lookAt(this.currentLook)
  }

  resize(sizes: { width: number; height: number }) {
    this.instance.aspect = sizes.width / sizes.height
    this.instance.updateProjectionMatrix()
  }

  destroy() {
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mouseup', this.onMouseUp)
    window.removeEventListener('wheel', this.onWheel)
  }
}
