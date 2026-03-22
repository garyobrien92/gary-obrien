import { useEffect, useRef, useState } from 'react'
import RAPIER from '@dimforge/rapier3d-compat'
import { Experience, ZoneEvent } from '../game/Experience'
import { HOLES } from '../game/World'

// ── Zone panel content ────────────────────────────────────────────────────────
function ClubhousePanel() {
  return (
    <div>
      <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">Welcome</div>
      <h2 className="text-2xl font-bold mb-2">Gary O'Brien</h2>
      <p className="text-gray-300 text-sm leading-relaxed">
        Software engineer &amp; creative developer. Drive around the course —
        each hole tells the story of a job in my career.
      </p>
      <div className="mt-3 text-gray-400 text-xs">
        Visit the <span className="text-green-400">Putting Green</span> for some fun,
        or warm up at the <span className="text-blue-400">Driving Range</span>.
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

// ── Main component ────────────────────────────────────────────────────────────
export default function Portfolio() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [zone, setZone] = useState<ZoneEvent | null>(null)
  const [started, setStarted] = useState(false)

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
    })

    return () => {
      cancelled = true
      exp?.destroy()
    }
  }, [started])

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

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

      {/* ── HUD ── */}
      {started && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-xs font-mono pointer-events-none select-none text-center">
          ↑↓←→ / WASD · Drive &nbsp;|&nbsp; SPACE · Brake &nbsp;|&nbsp; Drag · Orbit camera &nbsp;|&nbsp; Scroll · Zoom
        </div>
      )}

      {/* ── Zone info panel ── */}
      {started && zone && (
        <div
          key={zone.zone}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-sm"
          style={{ animation: 'slideUp 0.25s ease-out' }}
        >
          <div className="mx-4 bg-black/85 backdrop-blur border border-white/10 text-white p-5 rounded-2xl shadow-2xl">
            {zone.zone === 'clubhouse' && <ClubhousePanel />}
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
