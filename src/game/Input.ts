export class Input {
  private keys: Record<string, boolean> = {}
  private justPressed = new Set<string>()
  private justReleased = new Set<string>()
  private onKeyDown: (e: KeyboardEvent) => void
  private onKeyUp: (e: KeyboardEvent) => void

  constructor() {
    this.onKeyDown = (e) => {
      if (!this.keys[e.code]) this.justPressed.add(e.code)
      this.keys[e.code] = true
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Escape'].includes(e.code)) {
        e.preventDefault()
      }
    }
    this.onKeyUp = (e) => {
      this.keys[e.code] = false
      this.justReleased.add(e.code)
    }
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
  }

  isDown = (code: string) => !!this.keys[code]

  /** Returns true once per key press, then clears. */
  consumePress(code: string): boolean {
    if (this.justPressed.has(code)) {
      this.justPressed.delete(code)
      return true
    }
    return false
  }

  /** Returns true once per key release, then clears. */
  consumeRelease(code: string): boolean {
    if (this.justReleased.has(code)) {
      this.justReleased.delete(code)
      return true
    }
    return false
  }

  destroy() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
  }
}
