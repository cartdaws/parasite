# PARASITE

A small third-person stealth game. You are a parasite loose on a ship: leap onto crew who haven't seen you, wear them, and use what each body can do to reach the escape pod.

- **Guard**: shoots, but gunfire is loud and draws attention.
- **Scientist**: opens the lab's keycard doors, and the crew trust them.
- **Maintenance bot**: slow, but the scanner and turret ignore it.

Every host rots, and every host you leave behind is a body someone will find.

Play: https://cartdaws.github.io/parasite/

## Controls
PC: WASD move · Shift run · mouse look · E leap · Q leave host · click shoot (as a guard) · Esc pause
Phone: left thumb moves (push far to run) · right thumb looks · on-screen LEAP / EXIT / FIRE

## Code
`src/map.js` (deck grid) → `world.js` (geometry, doors, collision, sight, paths) · `characters.js` (low-poly figures) · `actors.js` (bodies + crew AI) · `player.js` (possession, camera) · `game.js` (rules: alarm, shooting, turret, win/lose) · `hud.js` · `input.js` · `audio.js` · `fx.js`.

`npm run dev` · `npm run build` · `npm run smoke` (headless test of the core loop, desktop + phone)
