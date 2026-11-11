import * as THREE from 'three'

// ── Lakeside Golf Club Camden — real course shapes ────────────────────────────
// Traced from north-up satellite imagery (BlueGolf course map, web-mercator
// zoom 18 ≈ 0.495 m/px at this latitude) and cross-checked against the club's
// course map PDF. World space: 1 unit = 1 m, +X east, −Z north, origin = pro shop.
//
// Points are kept as the pixel coordinates they were traced at, and converted
// by v1/v2/v3 (one per satellite view), so a shape can be re-traced or nudged
// without redoing the maths.

export type Pt = [number, number]                       // world [x, z]
export interface Ellipse { c: Pt; rx: number; rz: number; rot?: number }
type Shape = Pt[] | Ellipse

const M = 0.495  // metres per traced pixel at zoom 18
const v1 = (px: number, py: number): Pt => [(px - 1124) * M, (py - 551) * M]            // hole 1 view
const v2 = (px: number, py: number): Pt => [(px - 1051) * M, (py - 993) * M]            // hole 2 view
const v3 = (px: number, py: number): Pt => [(px / 2 - 568.5) * M, (py / 2 - 1179.5) * M] // hole 3 view (zoom 19)

// Ground plane footprint — covers holes 1–4, the west lake and the clubhouse.
export const GROUND = { centerX: -150, centerZ: -200, size: 1400 }

// Centreline + half-width → closed outline (smoothed when drawn).
function ribbon(line: Array<[Pt, number]>): Pt[] {
  const left: Pt[] = [], right: Pt[] = []
  line.forEach(([p, hw], i) => {
    const a = line[Math.max(0, i - 1)][0], b = line[Math.min(line.length - 1, i + 1)][0]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len
    left.push([p[0] + nx * hw, p[1] + nz * hw])
    right.push([p[0] - nx * hw, p[1] - nz * hw])
  })
  return [...left, ...right.reverse()]
}

// Practice putting green — same kidney outline the putting mini-game was built on.
const PUTTING_GREEN: Pt = [-45, 8]
function puttingGreenPath(ctx: CanvasRenderingContext2D, toPx: (p: Pt) => Pt) {
  const [cx, cz] = PUTTING_GREEN
  const P = (x: number, y: number) => toPx([cx + x, cz - y])
  ctx.beginPath()
  ctx.moveTo(...P(13, 1))
  ctx.bezierCurveTo(...P(15, -5), ...P(11, -12), ...P(3, -12))
  ctx.bezierCurveTo(...P(-4, -12), ...P(-13, -8), ...P(-14, 0))
  ctx.bezierCurveTo(...P(-14, 5), ...P(-10, 12), ...P(-3, 13))
  ctx.bezierCurveTo(...P(3, 13), ...P(11, 10), ...P(13, 1))
  ctx.closePath()
}

export const COURSE = {
  fairways: [
    // Hole 1 — runs WSW from below the tees to the green
    ribbon([[v1(428, 514), 13], [v1(470, 497), 19], [v1(583, 459), 22], [v1(680, 432), 20], [v1(722, 424), 12]]),
    // Hole 2 — long par 5 heading NNE, stops short of the two ponds
    ribbon([[v2(552, 682), 14], [v2(600, 615), 19], [v2(641, 562), 20], [v2(730, 454), 20],
            [v2(800, 360), 19], [v2(845, 285), 15], [v2(860, 258), 10]]),
    // Hole 3 — par 3: just the mown surround in front of the green
    { c: v3(410, 650), rx: 26, rz: 22 },
    // Hole 4 — back down the east shore of the lake, between holes 1 and 2
    ribbon([[v2(312, 742), 13], [v2(360, 680), 18], [v2(405, 624), 18], [v2(460, 560), 17], [v2(500, 512), 12]]),
  ] as Shape[],

  // One tee per hole (the real course has several pads per hole; we keep the
  // forward one, closest to the green)
  tees: [
    { c: v1(890, 389), rx: 6, rz: 6 },      // H1
    { c: v2(436, 743), rx: 5, rz: 5 },      // H2
    { c: v3(714, 410), rx: 5, rz: 5 },      // H3
    { c: [-183, -360], rx: 6, rz: 6 },      // H4 (just forward of the back tee, beside the path)
  ] as Ellipse[],

  // Putting surfaces only (the mown apron around them comes from the collar).
  // pin = where the hole and flagstick go on that green
  greens: [
    { c: v1(327, 557), rx: 13, rz: 13, pin: v1(322, 548) },              // H1
    { c: v3(975, 495), rx: 12.5, rz: 14, pin: v3(990, 480) },            // H2
    { c: v3(440, 640), rx: 11, rz: 14, pin: v3(438, 607) },              // H3
    { c: v1(277.6, 408.5), rx: 9, rz: 13, pin: v1(274, 418) },           // H4
  ] as Array<Ellipse & { pin: Pt }>,

  bunkers: [
    { c: v1(314.7, 519), rx: 3.5, rz: 3.5 }, { c: v1(359.5, 566), rx: 3.5, rz: 3.5 }, { c: v1(303, 584), rx: 4, rz: 4 }, // H1
    { c: v3(922, 570), rx: 3, rz: 3 }, { c: v3(988, 590), rx: 3, rz: 3 },                                               // H2
    { c: v3(387, 697), rx: 3.5, rz: 3.5 }, { c: v3(479, 687), rx: 2.8, rz: 2.8 },                                       // H3
    { c: v1(272, 376), rx: 3, rz: 3 }, { c: v1(301.5, 391), rx: 3, rz: 3 }, { c: v1(304, 426), rx: 3, rz: 3 },          // H4
  ] as Ellipse[],

  water: [
    // West lake beside the Hume Highway
    // (the three south-east shore points are world coords re-measured on Google Maps:
    // the first trace put that shore ~20 m too close to the 4th fairway)
    [v2(300, 470), v2(290, 530), [-346, -226], [-316, -243], [-277, -287], v2(590, 330), v2(612, 252),
     v2(594, 205), v2(545, 200), v2(500, 260), v2(450, 350), v2(380, 410), v2(310, 440)],
    // The two ponds short of the hole 2 green
    [v3(590, 770), v3(610, 735), v3(660, 722), v3(720, 735), v3(740, 770), v3(700, 800), v3(660, 845), v3(610, 850), v3(585, 820)],
    [v3(790, 745), v3(830, 710), v3(900, 690), v3(945, 680), v3(950, 700), v3(900, 720), v3(850, 745), v3(800, 765)],
    // Wetlands either side of hole 3
    { c: v3(450, 420), rx: 16, rz: 12 },
    { c: v3(690, 570), rx: 22, rz: 14 },
    // Dark pond between the hole 4 fairway and the hole 2 tee
    { c: v2(474, 722), rx: 10, rz: 18 },
  ] as Shape[],
}

// Greenside bunkers hug the putting surface but must never sit on it: any
// bunker that overlaps a green is slid straight outward until it clears.
const BUNKER_GAP = 1.5
COURSE.bunkers.forEach(b => COURSE.greens.forEach(g => {
  const dx = b.c[0] - g.c[0], dz = b.c[1] - g.c[1]
  const d = Math.hypot(dx / (g.rx + b.rx + BUNKER_GAP), dz / (g.rz + b.rz + BUNKER_GAP))
  if (d > 0 && d < 1) b.c = [g.c[0] + dx / d, g.c[1] + dz / d]
}))

// ── Cart paths ────────────────────────────────────────────────────────────────
// Legs 1–4 follow the real cart paths traced from the satellite imagery.
// Each leg is drawn as its own smooth curve.
export const CART_PATHS: Pt[][] = [
  // Spawn → past the pro shop → round the east and north of the putting green
  // (game-specific: the in-game pro shop is not the real clubhouse building)
  [[25, 16], [8, 16], [-5, 14], [-17, 7], [-22, -5], [-34, -14], [-58, -17]],
  // Real path: past the Hole 1 tee, along the north side of the 1st fairway, to
  // the junction, then the spur that ends between the 1st and 4th greens
  [[-58, -17], [-66, -38], [-76, -62], [-90, -72], [-104, -71], [-146, -63], [-177, -76],
   [-197, -86], [-235, -90], [-268, -84], [-298, -78], [-314, -67], [-337, -55], [-356, -55],
   [-367, -47], [-387, -38], [-405, -30]],
  // Real path: from the junction north past the Hole 2 tee, up between the 4th
  // and 2nd fairways, round the corner of the lake past the Hole 4 tee and the
  // 3rd green, past the Hole 3 tee, and round the back of the 2nd green
  [[-356, -55], [-350, -72], [-329, -103], [-314, -124], [-301, -144], [-266, -181], [-243, -213],
   [-232, -248], [-229, -271], [-229, -300], [-212, -338], [-197, -362], [-180, -388], [-160, -398],
   [-144, -410], [-140, -435], [-130, -458], [-111, -470], [-91, -481], [-72, -485], [-59, -489],
   [-34, -489], [-19, -477], [-14, -460], [-21, -439]],
  // Right-hand side of Hole 2: leaves the 1st-fairway path, follows the dirt
  // track through the trees and then the tree line up the east of the 2nd
  // fairway, and meets the path coming round the back of the 2nd green — so
  // the route is a loop: up the right of 2, round to the 3rd tee, back down
  // the lake side past 3 and 4. (Faint on the imagery; the upper half is inferred.)
  [[-197, -86], [-204, -108], [-205, -134], [-198, -168], [-189, -191], [-170, -214], [-151, -236],
   [-135, -242], [-108, -267], [-87, -309], [-70, -331], [-50, -362], [-32, -380], [-17, -398],
   [-16, -420], [-21, -439]],
  // Hole 4: leaves the main path below the 4th tee, runs down the right-hand
  // (lake) side of the 4th fairway, then over Rileys Creek and round the west
  // of the 4th green to the end of the 1st-hole spur — closing the loop.
  // The fairway-side stretch is newer than the satellite imagery, so it is
  // placed from Gary's description, not traced.
  [[-229, -271], [-252, -268], [-280, -262], [-308, -240], [-344, -205], [-362, -172], [-385, -140],
   [-404, -112], [-425, -105], [-449, -91], [-461, -73], [-460, -43], [-444, -28], [-405, -30]],
]

// ── Surface map ───────────────────────────────────────────────────────────────
// One texture over the whole ground: R = fairway cut (fairways, tees, green
// collars), G = putting surface (plus a faint collar/tee marker), B = sand,
// A = water. The terrain shader blends
// grass types from it, so adding a hole is just adding shapes above.
export function buildSurfaceMap(res = 1024): THREE.DataTexture {
  const minX = GROUND.centerX - GROUND.size / 2
  const minZ = GROUND.centerZ - GROUND.size / 2
  const k = res / GROUND.size
  const toPx = (p: Pt): Pt => [(p[0] - minX) * k, (p[1] - minZ) * k]

  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = res
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  const trace = (s: Shape) => {
    ctx.beginPath()
    if (Array.isArray(s)) {
      // Smooth closed curve through the midpoints of each edge
      const pts = s.map(toPx)
      const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
      ctx.moveTo(...mid(pts[pts.length - 1], pts[0]))
      pts.forEach((p, i) => ctx.quadraticCurveTo(...p, ...mid(p, pts[(i + 1) % pts.length])))
    } else {
      const [x, y] = toPx(s.c)
      ctx.ellipse(x, y, s.rx * k, s.rz * k, s.rot ?? 0, 0, Math.PI * 2)
    }
    ctx.closePath()
  }

  const data = new Uint8Array(res * res * 4)
  const bake = (channel: number, draw: () => void) => {
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, res, res)
    ctx.fillStyle = ctx.strokeStyle = '#fff'
    draw()
    const px = ctx.getImageData(0, 0, res, res).data
    for (let i = 0; i < res * res; i++) data[i * 4 + channel] = px[i * 4]
  }

  const COLLAR = 3.5  // metres of fairway-cut fringe around each green
  bake(0, () => {
    COURSE.fairways.forEach(s => { trace(s); ctx.fill() })
    COURSE.tees.forEach(s => { trace(s); ctx.fill() })
    ctx.lineWidth = COLLAR * 2 * k
    COURSE.greens.forEach(s => { trace(s); ctx.fill(); ctx.stroke() })
    puttingGreenPath(ctx, toPx); ctx.fill(); ctx.stroke()
  })
  bake(1, () => {
    // Faint (0.25) marker on collars and tees: tells the shader "close-mown, no stripes"
    ctx.fillStyle = ctx.strokeStyle = '#404040'
    ctx.lineWidth = COLLAR * 2 * k
    COURSE.tees.forEach(s => { trace(s); ctx.fill() })
    COURSE.greens.forEach(s => { trace(s); ctx.stroke() })
    puttingGreenPath(ctx, toPx); ctx.stroke()
    // Putting surfaces at full strength
    ctx.fillStyle = '#fff'
    COURSE.greens.forEach(s => { trace(s); ctx.fill() })
    puttingGreenPath(ctx, toPx); ctx.fill()
  })
  bake(2, () => COURSE.bunkers.forEach(s => { trace(s); ctx.fill() }))
  bake(3, () => COURSE.water.forEach(s => { trace(s); ctx.fill() }))

  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat)
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 8  // keeps mown edges crisp at the grazing angles a cart sees them from
  tex.needsUpdate = true
  return tex
}
