import RAPIER from '@dimforge/rapier3d-compat'

export class Physics {
  world: RAPIER.World

  constructor() {
    this.world = new RAPIER.World({ x: 0.0, y: -9.81, z: 0.0 })
  }

  update(deltaTime: number) {
    this.world.timestep = Math.min(deltaTime, 1 / 30)
    this.world.step()
  }
}
