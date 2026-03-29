# Gary O'Brien Portfolio — Development Plan

## Concept
An interactive 3D golf course portfolio. The player drives a golf cart around the course,
discovering career history at each hole's tee box, with a clubhouse, putting green, and driving range.

---

## Tech Stack
- React + TypeScript + Vite
- Three.js r161 (3D rendering)
- Rapier (`@dimforge/rapier3d-compat`) — physics + vehicle controller
- GLTF/GLB models: golf cart (`/public/models/car.glb`), golf ball (`/public/models/golf_ball.glb`)
- Procedural canvas grass texture
- Cloudflare Pages — hosting, auto-deploys on push to `main`

---

## Current State (as of March 2026)

### Working
- [x] 3D golf course world with fairways, rough, paths, water, trees, sand traps
- [x] Golf cart physics (drive forward/back, steer, brake)
- [x] Cart model loaded with correct front-facing orientation
- [x] 4 wheels visible (GLB provides one side, mirror cloned for other side)
- [x] Front-wheel steering animation (pivot groups, no 360° spin)
- [x] Zone detection (drive into area → info panel appears)
- [x] Zones: Clubhouse, Putting Green, Driving Range, hole tee boxes + greens
- [x] Procedural grass texture
- [x] Intro splash screen with controls
- [x] Sky + HDR environment lighting

### Completed This Session (March 2026)
- [x] **Branch cleanup** — `main` is default branch, `master` + `dev` deleted locally and remotely
- [x] **Cloudflare** — configured to deploy from `main` branch
- [x] **README** updated to reflect actual project
- [x] **CV updated** — added Hapana (Senior Fullstack Dev, current) and Viva Leisure (Full Stack Dev) roles
- [x] **3D terrain** — 96×96 subdivided mesh with `terrainHeight(x,z)` function:
  - Rolling hills in rough areas, flat fairway corridors, tee area flats
  - Bunker depressions, green domes baked into the height field
  - Larger hills outside course bounds
- [x] **Trimesh physics collider** — built from exact terrain geometry vertices (not flat cuboid)
  - Cart now pitches/rolls on slopes and drives up green domes correctly
- [x] **Realistic greens** — organic ShapeGeometry (bezier paths) with vertex undulation:
  - Hole 1: irregular forward-skewed shape
  - Hole 2: organic oval
  - Hole 3: proper kidney shape
  - All green surfaces elevated to match terrain dome height
- [x] **Flat tee boxes** — rectangular platform (8×5), three sets of coloured markers:
  - Black (championship/back), Blue (men's/middle), Red (forward/ladies)
  - Dome-topped cylinders, fringe trim around edge
- [x] **Yardage sign with canvas text** — shows Hole #, Par, Yards, Company, Role, Years, tee marker legend
  - Sign positioned to the side of each tee box, facing approaching cart
- [x] **Hole → Job mapping** (3 most recent jobs, chronological):
  - Hole 1: Over-C — Senior Fullstack Engineer (Jan 2018 – Dec 2023)
  - Hole 2: Viva Leisure — Full Stack Developer (TBD)
  - Hole 3: Hapana — Senior Fullstack Developer (TBD – Present)
- [x] **Flowing cart path** — 22 waypoints with junction pads: Clubhouse → H1 → H2 → H3 → back
- [x] **Physics colliders on trees** — cylinder collider per trunk, trees positioned at terrain height
- [x] **Physics collider on clubhouse** — cuboid collider prevents driving through building
- [x] **Golf ball on putting green** — GLB model, scale 0.05, placed at first hole position
- [x] **Realistic golf hole** — correct 4.25 inch (0.054 unit radius) diameter:
  - Dark opening disc, white cup liner (3D cylinder), dark bottom, slim flagstick
  - All 3 putting green holes + all 3 course holes use correct size

---

## Known Issues / To Fix
- [ ] Bunkers, water hazards, other structures have no physics colliders (cart drives through)
- [ ] Yardage signs need correct dates (TBD placeholders for Viva Leisure / Hapana)
- [ ] Cart starting position could be better (currently spawns at 0,2,10 near clubhouse)
- [ ] Cart path segments sit at y=0.002 — should follow terrain height
- [ ] Terrain mounds (visual-only spheres in `addTerrainMounds`) now redundant since terrain handles hills

---

## Roadmap

### Phase 1 — Content (Priority)
- [ ] **Fill in TBD dates** on Viva Leisure and Hapana in the HOLES array
- [ ] **Clubhouse intro panel** — welcome text, tagline, links (GitHub, LinkedIn, email)
- [ ] **Skills / tech section** — scoreboard-style panel at the driving range
- [ ] **Contact info** — visible on course (19th hole / clubhouse)

### Phase 2 — Golf Gameplay
- [ ] Actual putting mechanic on the putting green (aim + power)
- [ ] Driving range balls
- [ ] Score tracking / hole completion events

### Phase 3 — Visual Polish
- [ ] Fairway mowing stripes (alternating dark/light)
- [ ] Better tree models or more variety
- [ ] Cart path texture follows terrain (currently flat at y=0.002)
- [ ] Ambient sounds (birds, wind, distant golf)
- [ ] Mobile controls (touch joystick overlay)
- [ ] Remove redundant `addTerrainMounds` (terrain now handles this)

### Phase 4 — Performance & Deployment
- [ ] Lazy-load GLB models
- [ ] Compress textures / reduce bundle size
- [ ] SEO meta tags + OG image

---

## File Structure

```
src/
  components/
    Portfolio.tsx      # React wrapper, UI panels, intro splash
  game/
    Experience.ts      # Main game loop, zone detection
    World.ts           # Course geometry, terrain, zones, lighting, physics colliders
    Car.ts             # Golf cart physics + model
    Camera.ts          # Follow camera with orbit
    Input.ts           # Keyboard input handler
    Physics.ts         # Rapier world wrapper

public/
  models/
    car.glb            # Golf cart model
    golf_ball.glb      # Golf ball model (scale 0.05 for realistic size)
  textures/
    environmentMap/
      2k.hdr           # HDR sky for reflections
  fonts/
    helvetiker_regular.typeface.json
```

---

## Hole → Job Mapping

| Hole | Par | Yards | Company      | Role                       | Years               |
|------|-----|-------|--------------|----------------------------|---------------------|
| 1    | 4   | 380   | Over-C       | Senior Fullstack Engineer  | Jan 2018 – Dec 2023 |
| 2    | 3   | 160   | Viva Leisure | Full Stack Developer       | TBD – TBD           |
| 3    | 4   | 310   | Hapana       | Senior Fullstack Developer | TBD – Present       |

---

## Notes
- Cart model: front = model-local +Z. `rotation.y = 0`.
- Wheel GLB only has nodes on one side (x≈-0.56). Other side is mirrored at load time.
- Steering: pivot group approach — `pivot.rotation.y = steerAngle`. No rolling animation.
- Rapier vehicle controller: preUpdate(dt) → physics.update(dt) → postUpdate() order is critical.
- Terrain: `World.terrainHeight(x, z)` is the single source of truth for ground height.
  Use it when placing any object that sits on the ground.
- Golf hole size: 4.25 inches = 0.108m diameter, radius = 0.054 units (regulation size).
- Default branch: `main`. Cloudflare Pages auto-deploys on push to `main`.
