# Gary O'Brien Portfolio — Development Plan

## Concept
An interactive 3D golf course portfolio. The player drives a golf cart around the course,
discovering career history at each hole's tee box, with a pro shop, putting green, and driving range.

---

## Tech Stack
- React + TypeScript + Vite
- Three.js r161 (3D rendering)
- Rapier (`@dimforge/rapier3d-compat`) — physics + vehicle controller
- GLTF/GLB models: golf cart (`/public/models/car.glb`), golf ball (`/public/models/golf_ball.glb`)
- Procedural canvas grass texture
- Cloudflare Pages — hosting, auto-deploys on push to `main`

---

## Coordinate System

```
Origin (0, 0, 0)  = Pro Shop entrance
+X = East         = toward Raby Road
-X = West         = toward Hume Highway
-Z = North        = toward holes 1–3
+Y = Up
1 unit = 1 metre
```

### Key Anchors

| Location        | Position             | Notes                          |
|-----------------|----------------------|--------------------------------|
| Pro Shop        | `(0, 0, 0)`          | Main entrance, starting point  |
| Putting Green   | `(-45, 0, 8)`        | Kidney-shaped, SW of pro shop  |
| Map Sign        | `(-18, 0, -2)`       | Near putting green             |
| Entry Gate      | `(120, 0, -40)`      | Road entrance from Raby Rd     |
| West Lake       | `(-390, -1.5, -280)` | Landscape feature, NW          |

---

## Hole → Job Mapping (Lakeside Golf Club Camden — definitive)

| Hole | Par | Yards | Direction | Company      | Role                       | Years                |
|------|-----|-------|-----------|--------------|----------------------------|----------------------|
| 1    | 4   | 400   | E → W     | Over-C       | Senior Fullstack Engineer  | Jan 2018 – Dec 2023  |
| 2    | 4   | 352   | SSW → NNE | Viva Leisure | Full Stack Developer       | Jan 2024 – Jun 2024  |
| 3    | 3   | 162   | NE → SW   | Hapana       | Senior Fullstack Developer | Jul 2024 – Present   |

### Hole Coordinates

**Hole 1 — Par 4, 400 yds — Over-C**
- Tee: `(60, 3.5, -95)` — elevated +3.5m, near entry road
- Green: `(-280, -1.5, -90)` — far west, slightly below ground level
- Direction: E → W, nearly straight
- Features: elevated tee (+3.5m), green at −1.5m, 3 bunkers, tree lines both sides, cart path south side

**Hole 2 — Par 4, 352 yds — Viva Leisure** *(corrected — green moved east +52m)*
- Tee: `(-191, -1.5, -147)`
- Green: `(-68, 4.0, -445)` ← corrected (was inside H3 fairway, moved east)
- Direction: SSW → NNE (uphill +5.5m to green)
- Features: 60 yds from H3 tee, 207-yd marker post, 2 greenside bunkers, walk path to H3

**Hole 3 — Par 3, 162 yds — Hapana** *(corrected — ponds GPS-confirmed)*
- Tee: `(-100, 5.0, -490)`
- Green: `(-250, 0.5, -350)`
- Direction: NE → SW
- Pond A: `(-199, 1.5, -446)` — 22×18m, NW side of fairway
- Pond B: `(-156, 1.5, -400)` — 16×12m, SE side of fairway
- Pond A ↔ Pond B separation: ~69 yds (GPS confirmed)
- Features: Rileys Creek crossing between ponds, 3-bunker complex right of green

---

## 9 Build Phases

### Phase 1 — Pro Shop + Putting Green *(start here)*
**File:** `World.ts → addProShop, addPuttingGreen`
- Timber-frame pro shop building at `(0, 0, 0)` with retaining walls
- Kidney-shaped putting green at `(-45, 0, 8)` with 3 holes, cups, flags
- Directional sign totem near putting green (`-18, 0, -2`)
- Entry gate arch at `(120, 0, -40)`
- Cart path from entry gate → pro shop → putting green → Hole 1 tee
- Zone trigger at pro shop (welcome/about panel)
- Zone trigger at putting green (enter putting mini-game)

### Phase 2 — Map System
**File:** `World.ts → addMapSign` + UI overlay
- Physical sign board near putting green showing course layout
- M-key fullscreen map overlay
- Live player dot + direction arrow on map
- World → map coordinate conversion

### Phase 3 — Hole 1 (400 yds par 4 — Over-C)
**File:** `World.ts → addHole1`
- Elevated tee box (+3.5m) at `(60, 3.5, -95)`, driveAngle ≈ west
- Fairway strip, ~18 units wide, E→W
- Organic green surface at `(-280, -1.5, -90)`, slightly sunken
- 3 bunkers (2 left of approach, 1 right)
- Tree lines north and south sides of fairway
- Cart path along south side
- Yardage sign, zone trigger (Over-C info panel)

### Phase 4 — Hole 2 (352 yds par 4 — Viva Leisure)
**File:** `World.ts → addHole2`
- Tee `(-191, -1.5, -147)`, green `(-68, 4.0, -445)` — uphill SSW→NNE
- 207-yd distance marker post mid-fairway
- 2 greenside bunkers
- 60-yd walk path from green to H3 tee
- Yardage sign, zone trigger (Viva Leisure info panel)

### Phase 5 — Hole 3 (162 yds par 3 — Hapana)
**File:** `World.ts → addHole3`
- Tee `(-100, 5.0, -490)`, green `(-250, 0.5, -350)` — NE→SW
- Pond A `(-199, 1.5, -446)` — 22×18m ellipse, NW side
- Pond B `(-156, 1.5, -400)` — 16×12m ellipse, SE side
- Rileys Creek crossing (bridge/stepping stones) between ponds
- Cart path threads between both ponds
- 3-bunker complex right of green
- Yardage sign, zone trigger (Hapana info panel)

### Phase 6 — Environment
**File:** `World.ts → addEnvironment`
- Terrain height displacement (tee mounds, green domes, fairway corridors)
- Rileys Creek corridor (NW diagonal through course)
- Eucalyptus woodland borders
- Rough zones
- Gledswood Homestead landmark (background)

### Phase 7 — Cart + Camera
**File:** `Car.ts, Camera.ts`
- Animated cart entry route: gate → past putting green → climb to H1 tee
- Cinematic follow camera during entry
- Orbit handoff once at H1 tee box

### Phase 8 — Driving Range *(future)*
- Range bays, target greens at 50/100/150 yds
- Yardage markers, safety netting
- "Coming Soon" directional sign

### Phase 9 — Full Course Holes 4–18 *(future)*
- Remaining 15 holes
- Central lake, southern ponds
- Water canal boundary, residential edge context

---

## Ground / World Size

With 1 unit = 1m and H3 tee at z=−490, the ground must cover at least **−550 to +150 in Z** and **−420 to +150 in X**.
Use `SIZE = 1000, SEGS = 128` centred at `(-130, 0, -230)` (course centroid).

---

## Current State (April 2026)

### Working (pre-clean-slate)
- [x] Golf cart physics (drive/steer/brake), Rapier vehicle controller
- [x] Cart GLB model, 4 wheels, front-wheel steering animation
- [x] Zone detection → info panel
- [x] Procedural grass texture
- [x] Intro splash screen with controls
- [x] Sky + HDR environment lighting
- [x] Putting mini-game (E to enter, aim, power, putt, gravity well into hole)
- [x] Organic putting green geometry + undulation

### Needs Replacing (wrong layout)
- [ ] `CLUBHOUSE_POSITION` was `(0,0,-20)` — should be `(0,0,0)` Pro Shop
- [ ] `PUTTING_GREEN_CENTER` was `(-22,0,-25)` — should be `(-45,0,8)`
- [ ] `HOLES` array has old W/WNW coords — replace with definitive coords above
- [ ] Ground SIZE=500 too small — expand to 1000 centred at course
- [ ] Terrain fairway corridors based on old coords — redo in Phase 6
- [ ] `addHolePreviewLayout` placeholder — replace with addHole1/2/3 in phases 3–5
- [ ] Cart path waypoints based on old layout — redo in Phase 7

---

## File Structure

```
src/
  components/
    Portfolio.tsx      # React wrapper, UI panels, intro splash
  game/
    Experience.ts      # Main game loop, zone detection
    World.ts           # Course geometry, terrain, zones, lighting, physics
    Car.ts             # Golf cart physics + model
    Camera.ts          # Follow camera with orbit
    Input.ts           # Keyboard input handler
    Physics.ts         # Rapier world wrapper

public/
  models/
    car.glb            # Golf cart model
    golf_ball.glb      # Golf ball model
  textures/
    environmentMap/
      2k.hdr
  fonts/
    helvetiker_regular.typeface.json
```

---

## Notes
- Cart model: front = model-local +Z. `rotation.y = 0`.
- Wheel GLB only has nodes on one side (x≈-0.56). Other side mirrored at load.
- Steering: pivot group, `pivot.rotation.y = steerAngle`. No rolling animation.
- Rapier vehicle controller: preUpdate(dt) → physics.update(dt) → postUpdate() order is critical.
- `World.terrainHeight(x, z)` — single source of truth for ground height.
- Golf hole diameter: 4.25 inches = 0.108m, radius = 0.054 units (regulation).
- Default branch: `main`. Cloudflare Pages auto-deploys on push.
- Hole 2 green correction: old position was inside H3 fairway — moved east +52m to `(-68, 4.0, -445)`.
- H3 Pond A↔B separation of 69 yds confirmed from GPS data.
