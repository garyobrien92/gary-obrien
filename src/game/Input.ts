export class Input {
  private keys: Record<string, boolean> = {}
  private onKeyDown: (e: KeyboardEvent) => void
  private onKeyUp: (e: KeyboardEvent) => void

  constructor() {
    this.onKeyDown = (e) => {
      this.keys[e.code] = true
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault()
      }
    }
    this.onKeyUp = (e) => { this.keys[e.code] = false }
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  isDown = (code: string) => !!this.keys[code]

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }
}
