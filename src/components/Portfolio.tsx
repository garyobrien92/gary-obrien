import { useEffect, useRef, useState, useCallback } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import { Experience, ZoneEvent, PuttingUpdate } from '../game/Experience'
import { HOLES } from '../game/World'

// ── Course map constants (mirror World.ts terrainHeightAt bounds) ─────────────
const MAP_X_MIN = -440, MAP_X_MAX = 160
const MAP_Z_MIN = -530, MAP_Z_MAX = 50
const MAP_CW = 570, MAP_CH = 450

function drawCourseMap(
  ctx: CanvasRenderingContext2D,
  playerX: number,
  playerZ: number,
) {
  const pad = 32
  const toMap = (wx: number, wz: number): [number, number] => [
    pad + (wx - MAP_X_MIN) / (MAP_X_MAX - MAP_X_MIN) * (MAP_CW - pad * 2),
    pad + (wz - MAP_Z_MIN) / (MAP_Z_MAX - MAP_Z_MIN) * (MAP_CH - pad * 2),
  ]

  ctx.clearRect(0, 0, MAP_CW, MAP_CH)
  ctx.fillStyle = '#0d2a08'
  ctx.fillRect(0, 0, MAP_CW, MAP_CH)

  ctx.strokeStyle = '#5aac2a'
  ctx.lineWidth = 2
  ctx.strokeRect(3, 3, MAP_CW - 6, MAP_CH - 6)

  ctx.fillStyle = '#e8f4e0'
  ctx.font = 'bold 14px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('LAKESIDE GOLF CLUB', MAP_CW / 2, 20)

  // Cart paths (mirror World.ts addCartPath segments)
  const cartPaths: [number, number][][] = [
    // Phase 1 — spawn → past pro shop → north side of putting green
    [[25,16],[8,16],[-5,14],[-20,4],[-40,-4],[-58,-6]],
    // Phase 3 — north of putting green → H1
    [[-58,-6],[-55,-20],[70,-91],[60,-95],[-60,-99],[-180,-95],[-260,-92],[-280,-90]],
    // Phase 4 — H1 green → H2
    [[-280,-90],[-211,-137],[-191,-147],[-88,-440],[-68,-445]],
    // Phase 5 — H2 green → H3 → return
    [[-68,-445],[-80,-480],[-100,-490],[-235,-345],[-250,-350],[-220,-320],[-10,-10],[0,0]],
  ]
  ctx.strokeStyle = '#b0a070'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.setLineDash([4, 4])
  cartPaths.forEach(pts => {
    ctx.beginPath()
    pts.forEach(([wx, wz], i) => {
      const [mx, mz] = toMap(wx, wz)
      if (i === 0) ctx.moveTo(mx, mz); else ctx.lineTo(mx, mz)
    })
    ctx.stroke()
  })
  ctx.setLineDash([])

  // Fairway lines
  const pairs: [number, number, number, number][] = [
    [60, -95, -280, -90],
    [-191, -147, -68, -445],
    [-100, -490, -250, -350],
  ]
  pairs.forEach(([tx, tz, gx, gz]) => {
    ctx.strokeStyle = '#4a8c22'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(...toMap(tx, tz))
    ctx.lineTo(...toMap(gx, gz))
    ctx.stroke()
  })

  // Putting green
  ctx.fillStyle = '#2dba52'
  ctx.beginPath()
  ctx.arc(...toMap(-45, 8), 8, 0, Math.PI * 2)
  ctx.fill()

  // Entry gate
  ctx.fillStyle = '#c8a850'
  ctx.beginPath()
  ctx.arc(...toMap(120, -40), 5, 0, Math.PI * 2)
  ctx.fill()

  // Pro shop (square)
  const [psx, psz] = toMap(0, 0)
  ctx.fillStyle = '#8B6440'
  ctx.fillRect(psx - 8, psz - 6, 16, 12)

  // Hole tees + greens + labels
  const holes = [
    { tee: [60, -95] as [number, number],   grn: [-280, -90]  as [number, number], n: '1' },
    { tee: [-191, -147] as [number, number], grn: [-68, -445]  as [number, number], n: '2' },
    { tee: [-100, -490] as [number, number], grn: [-250, -350] as [number, number], n: '3' },
  ]
  holes.forEach(({ tee, grn, n }) => {
    ctx.fillStyle = '#ffcc44'
    ctx.beginPath(); ctx.arc(...toMap(tee[0], tee[1]), 5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#33e060'
    ctx.beginPath(); ctx.arc(...toMap(grn[0], grn[1]), 6, 0, Math.PI * 2); ctx.fill()
    const [tx, tz] = toMap(tee[0], tee[1])
    ctx.fillStyle = '#fff'
    ctx.font = 'bold 11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`H${n}`, tx, tz - 8)
  })

  // Labels
  const lbl = (wx: number, wz: number, text: string, dx = 10, dy = 4) => {
    const [mx, mz] = toMap(wx, wz)
    ctx.fillStyle = '#e8f4e0'
    ctx.font = '10px sans-serif'
    ctx.textAlign = dx < 0 ? 'right' : 'left'
    ctx.fillText(text, mx + dx, mz + dy)
  }
  lbl(0, 0, 'Pro Shop', 12)
  lbl(-45, 8, 'Putting Green', -12)
  lbl(120, -40, 'Entry', 8)

  // Player dot
  const [px, pz] = toMap(playerX, playerZ)
  ctx.fillStyle = '#fff'
  ctx.shadowColor = '#fff'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(px, pz, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ff4444'
  ctx.beginPath()
  ctx.arc(px, pz, 4, 0, Math.PI * 2)
  ctx.fill()

  // Legend
  ctx.fillStyle = '#666'
  ctx.font = '9px sans-serif'
  ctx.textAlign = 'left'
  ctx.setLineDash([4, 4])
  ctx.strokeStyle = '#b0a070'
  ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(pad, MAP_CH - 11); ctx.lineTo(pad + 18, MAP_CH - 11); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillText('Cart path', pad + 22, MAP_CH - 7)
}

function CourseMapOverlay({ coords, onClose }: { coords: { x: number; y: number; z: number }; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    drawCourseMap(ctx, coords.x, coords.z)
  }, [coords])

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/75"
      onClick={onClose}
    >
      <div
        className="relative bg-black border-2 border-green-500/60 rounded-2xl shadow-2xl p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2 text-center">
          Course Map &nbsp;·&nbsp; <span className="text-white/50">M or ESC to close</span>
        </div>
        <canvas ref={canvasRef} width={MAP_CW} height={MAP_CH} className="block rounded-lg" />
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500 justify-center">
          <span><span className="text-yellow-400">■</span> Tee</span>
          <span><span className="text-green-400">●</span> Green</span>
          <span><span className="text-green-500">●</span> Putting Green</span>
          <span><span className="text-red-400">●</span> You</span>
        </div>
      </div>
    </div>
  )
}

// ── Zone panel content ────────────────────────────────────────────────────────
function ProShopPanel() {
  return (
    <div>
      <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">Lakeside Golf Club · Camden NSW</div>
      <h2 className="text-2xl font-bold mb-2">Gary O'Brien</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Software engineer &amp; creative developer. Drive around the course —
        each hole tells the story of a chapter in my career.
      </p>
      <div className="mt-3 text-gray-400 text-xs">
        Head to the <span className="text-green-400">Putting Green</span> to warm up,
        then follow the path to <span className="text-yellow-400">Hole 1</span>.
      </div>
    </div>
  )
}

function HoleTeePanel({ data }: { data: Record<string, string> }) {
  const hole = HOLES.find(h => String(h.id) === data.holeId) ?? HOLES[0]
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-yellow-400 text-xs font-bold uppercase tracking-widest">
          Hole {data.holeId} · Par {data.par} · {data.yards} yds
        </div>
      </div>
      <h2 className="text-xl font-bold text-white">{data.company}</h2>
      <div className="text-green-400 font-semibold text-sm mt-0.5">{data.role}</div>
      <div className="text-gray-400 text-xs mt-0.5">{data.years}</div>
      <p className="text-gray-300 text-sm leading-relaxed mt-2">{hole.description}</p>
    </div>
  )
}

function PuttingGreenPanel() {
  return (
    <div>
      <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">Putting Green</div>
      <h2 className="text-xl font-bold text-white mb-2">Practice Green</h2>
      <p className="text-gray-300 text-sm">
        Three holes to test your short game. Drive up to any hole on the green and give it a go!
      </p>
      <div className="mt-2 text-gray-400 text-xs">🏌️ Pro tip: approach the green slowly for best results.</div>
    </div>
  )
}

function DrivingRangePanel() {
  return (
    <div>
      <div className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Driving Range</div>
      <h2 className="text-xl font-bold text-white mb-2">Range</h2>
      <p className="text-gray-300 text-sm">
        Pick a bay and swing away. Click to aim, click again to set your power.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-gray-400">
        <div>🎯 <div className="text-white">50 yds</div></div>
        <div>🎯 <div className="text-white">100 yds</div></div>
        <div>🎯 <div className="text-white">150 yds</div></div>
      </div>
    </div>
  )
}

// ── Putting mode overlay ──────────────────────────────────────────────────────
function PuttingOverlay({ putting }: { putting: PuttingUpdate }) {
  if (!putting.active) return null
  const { state, power = 0 } = putting

  return (
    <div className="absolute inset-0 pointer-events-none select-none">
      {/* Controls hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-4 py-2 rounded-full font-mono">
        {(state === 'aiming' || state === 'charging')
          ? '← → Aim  ·  Hold SPACE to charge  ·  Release to putt  ·  ESC Exit'
          : 'ESC Exit'}
      </div>

      {/* Power bar (visible while charging) */}
      {state === 'charging' && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-48">
          <div className="text-white text-xs text-center mb-1 font-bold uppercase tracking-widest">Power</div>
          <div className="h-3 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-none"
              style={{
                width: `${power * 100}%`,
                background: power < 0.5
                  ? `hsl(${120 - power * 80}, 90%, 50%)`
                  : `hsl(${80 - (power - 0.5) * 160}, 90%, 50%)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Result messages */}
      {state === 'sunk' && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center animate-bounce">
          <div className="text-4xl font-black text-yellow-300 drop-shadow-lg">Hole In!</div>
          <div className="text-white text-sm mt-2">Press E for another ball</div>
        </div>
      )}
      {state === 'miss' && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center">
          <div className="text-2xl font-bold text-white/90 drop-shadow">Nice try!</div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Portfolio() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zone, setZone] = useState<ZoneEvent | null>(null)
  const [started, setStarted] = useState(false)
  const [putting, setPutting] = useState<PuttingUpdate>({ active: false, inPuttingZone: false })
  const [coords, setCoords] = useState({ x: 0, y: 0, z: 0 })
  const [showMap, setShowMap] = useState(false)

  const toggleMap = useCallback(() => setShowMap(v => !v), [])

  useEffect(() => {
    if (!started) return
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') setShowMap(v => !v)
      if (e.code === 'Escape') setShowMap(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [started])

  useEffect(() => {
    if (!started || !canvasRef.current) return
    let exp: Experience | null = null
    let cancelled = false
    const canvas = canvasRef.current

    RAPIER.init().then(() => {
      if (cancelled) return
      exp = new Experience(canvas)
      exp.onZoneEnter = (evt) => setZone(evt)
      exp.onZoneExit = () => setZone(null)
      exp.onPuttingUpdate = (update) => setPutting(update)
      exp.onPositionUpdate = (pos) => setCoords(pos)
    })

    return () => {
      cancelled = true
      exp?.destroy()
    }
  }, [started])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* ── Coord HUD (dev tool) ── */}
      {started && (
        <div className="absolute top-3 left-3 z-30 font-mono text-xs text-white/80 bg-black/50 px-2 py-1 rounded pointer-events-none select-none">
          x&nbsp;{coords.x.toFixed(1)}&nbsp;&nbsp;y&nbsp;{coords.y.toFixed(1)}&nbsp;&nbsp;z&nbsp;{coords.z.toFixed(1)}
        </div>
      )}

      {/* ── Intro splash ── */}
      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-green-900/90 to-black/90 z-20">
          <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">Portfolio</div>
          <h1 className="text-5xl font-black text-white mb-1">Gary O'Brien</h1>
          <p className="text-gray-400 text-sm mb-8">Software Engineer · Creative Developer</p>

          <div className="mb-8 text-center text-gray-300 text-sm space-y-1">
            <p>Drive your golf cart around the course.</p>
            <p>Each hole is a chapter of my career.</p>
          </div>

          <button
            onClick={() => setStarted(true)}
            className="px-8 py-3 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full text-lg transition-colors cursor-pointer"
          >
            Tee Off →
          </button>

          <div className="mt-6 text-gray-500 text-xs space-y-1 text-center">
            <div>↑ Forward &nbsp;·&nbsp; ↓ Reverse / Slow &nbsp;·&nbsp; ← → Steer</div>
            <div>WASD also works &nbsp;·&nbsp; SPACE to Brake</div>
          </div>
        </div>
      )}

      {/* ── Course map overlay ── */}
      {started && showMap && <CourseMapOverlay coords={coords} onClose={toggleMap} />}

      {/* ── Putting mode overlay ── */}
      {started && <PuttingOverlay putting={putting} />}

      {/* ── HUD ── */}
      {started && !putting.active && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono pointer-events-none select-none text-center">
          ↑↓←→ / WASD · Drive &nbsp;|&nbsp; SPACE · Brake &nbsp;|&nbsp; M · Map &nbsp;|&nbsp; Drag · Orbit &nbsp;|&nbsp; Scroll · Zoom
        </div>
      )}

      {/* ── "Press E" prompt when near putting green ── */}
      {started && !putting.active && putting.inPuttingZone && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 pointer-events-none select-none">
          <div className="bg-black/80 text-green-400 text-sm font-bold px-5 py-2 rounded-full border border-green-500/40"
            style={{ animation: 'slideUp 0.2s ease-out' }}>
            Press E to start putting
          </div>
        </div>
      )}

      {/* ── Zone info panel ── */}
      {started && zone && !putting.active && (
        <div
          key={zone.zone}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm"
          style={{ animation: 'slideUp 0.25s ease-out' }}
        >
          <div className="mx-4 bg-black/85 backdrop-blur border border-white/10 text-white p-5 rounded-2xl shadow-2xl">
            {(zone.zone === 'pro_shop' || zone.zone === 'clubhouse') && <ProShopPanel />}
            {zone.zone === 'putting_green' && <PuttingGreenPanel />}
            {zone.zone === 'driving_range' && <DrivingRangePanel />}
            {zone.zone.startsWith('hole_') && zone.data && <HoleTeePanel data={zone.data} />}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
