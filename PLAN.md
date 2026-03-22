# Gary O'Brien Portfolio — Development Plan

## Concept
An interactive 3D golf course portfolio. The player drives a golf cart around the course,
discovering career history at each hole's tee box, with a clubhouse, putting green, and driving range.

---

## Tech Stack
- React + TypeScript + Vite
- Three.js r161 (3D rendering)
- Rapier (`@dimforge/rapier3d-compat`) — physics + vehicle controller
- GLTF/GLB models: golf cart (`/public/models/car.glb`)
- Procedural canvas grass texture

---

## Current State (as of March 2026)

### Working
- [x] 3D golf course world with fairways, rough, paths, water, trees, sand traps
- [x] Golf cart physics (drive forward/back, steer, brake)
- [x] Cart model loaded with correct front-facing orientation
- [x] 4 wheels visible (GLB provides one side, mirror cloned for other side)
- [x] Front-wheel steering animation (pivot groups, no 360° spin)
- [x] Zone detection (drive into area → info panel appears)
- [x] Zones: Clubhouse, Putting Green, Driving Range, 9 Hole tee boxes
- [x] Procedural grass texture
- [x] Intro splash screen with controls
- [x] Sky + HDR environment lighting

### Known Issues / To Fix
- [ ] Grass texture could look more realistic (mowing stripes, fairway vs rough colour variation)
- [ ] Hole info panels need real content (currently placeholder text)
- [ ] Clubhouse panel needs real intro content
- [ ] No minimap / hole marker UI
- [ ] Cart can occasionally get stuck or flip on terrain edges

---

## Roadmap

### Phase 1 — Content (Priority)
> Requires CV / career summary from Gary

- [ ] **Populate hole panels** — each hole = one job:
  - Company name, role, years, tech stack, key achievements
  - 9 holes total — need details for each
- [ ] **Clubhouse intro panel** — welcome text, tagline, links (GitHub, LinkedIn, email)
- [ ] **Skills / tech section** — maybe a scoreboard-style panel at the driving range
- [ ] **Contact info** — visible somewhere on the course (19th hole?)

### Phase 2 — Golf Gameplay
- [ ] Actual putting mechanic on the putting green (click to aim, click to set power)
- [ ] Driving range balls (click bay, ball launches)
- [ ] Score tracking / hole completion events
- [ ] Simple flag + hole marker on each tee box

### Phase 3 — Visual Polish
- [ ] Fairway mowing stripes (alternating dark/light strips)
- [ ] Rough vs fairway colour differentiation
- [ ] Better tree models or more variety
- [ ] Clubhouse building 3D model
- [ ] Path/cart-track texture
- [ ] Ambient sounds (birds, wind, distant golf)
- [ ] Mobile controls (touch joystick overlay)

### Phase 4 — Performance & Deployment
- [ ] Lazy-load GLB models
- [ ] Compress textures / reduce bundle size
- [ ] Deploy to Vercel / Netlify
- [ ] Custom domain
- [ ] SEO meta tags + OG image

---

## File Structure

```
src/
  components/
    Portfolio.tsx      # React wrapper, UI panels, intro splash
  game/
    Experience.ts      # Main game loop, zone detection
    World.ts           # Course geometry, zones, lighting
    Car.ts             # Golf cart physics + model
    Camera.ts          # Follow camera with orbit
    Input.ts           # Keyboard input handler
    Physics.ts         # Rapier world wrapper

public/
  models/
    car.glb            # Golf cart model (Blenderkit)
  textures/
    environmentMap/
      2k.hdr           # HDR sky for reflections
```

---

## Hole → Job Mapping (to be filled in with CV)

| Hole | Par | Yards | Company | Role | Years | Notes |
|------|-----|-------|---------|------|-------|-------|
| 1    | 4   | 380   | TBD     | TBD  | TBD   |       |
| 2    | 3   | 155   | TBD     | TBD  | TBD   |       |
| 3    | 5   | 510   | TBD     | TBD  | TBD   |       |
| 4    | 4   | 395   | TBD     | TBD  | TBD   |       |
| 5    | 3   | 170   | TBD     | TBD  | TBD   |       |
| 6    | 4   | 420   | TBD     | TBD  | TBD   |       |
| 7    | 5   | 530   | TBD     | TBD  | TBD   |       |
| 8    | 4   | 400   | TBD     | TBD  | TBD   |       |
| 9    | 4   | 360   | TBD     | TBD  | TBD   |       |

---

## Notes
- Cart model: Blenderkit GLB. Front = model-local +Z. `rotation.y = 0`.
- Wheel GLB only has nodes on one side (x≈-0.56). Other side is mirrored at load time.
- Steering: pivot group approach — `pivot.rotation.y = steerAngle`. No rolling animation.
- Rapier vehicle controller: preUpdate(dt) → physics.update(dt) → postUpdate() order is critical.
