# The Finding of Isaiah

A top-down roguelike twin-stick dungeon crawler (three.js + Vite, plain JS).
Isaiah has hidden in the crawlspace under his grandmother's house — and it goes
deeper than houses go: **The Crawlspace → The Root Cellar → The Flooded Well →
The Bone Kiln → The Underneath**. He fights with his tears.

Every sprite, icon, door, card, portrait, story panel and sound is generated in
code at runtime — there are no asset files.

```
cd isaiah
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/
```

## Controls
| | Keyboard | Gamepad |
|---|---|---|
| Move | WASD | left stick / d-pad |
| Cry (4-way, last pressed wins) | Arrow keys | right stick or Y/B/A/X |
| Bomb | E | LT / LB |
| Card / pill | Q | RB |
| Active item | Space | RT |
| Drop trinket | Ctrl | — |
| Map | Tab | Back |
| Pause | Esc / P | Start |
| Restart run | hold R | hold Back+Start |

## What's in it
- **Floors**: 13×13 cell grid grown breadth-first from the center (`3.33 × floor + 5–6` rooms), dead ends become Boss / Treasure / Shop rooms, plus optional Sacrifice, Challenge, Arcade and Library rooms and a hidden Secret room (bomb the wall; some walls show a tinted crack). 1×1, 1×2, 2×1, 2×2 and L-shaped rooms. 47 hand-authored 13×7 ASCII templates (`src/world/templates.js`), mirrored for variety.
- **Doors** lock when you enter a room with enemies and slam open when it's clear; clears can drop a luck-weighted reward. Shops/libraries need a key, arcades a coin.
- **31 enemy types** (flies, chasers, chargers, turrets, aligned shooters, hoppers, burrowers, spiders, splitting clots, exploders, creep-leavers, ghosts, a shielded knight, lobbers...) and **6 champion variants**.
- **8 two-phase bosses** — The Lump, Mother Mildew, Taproot, The Rot Twins (shared bar), The Drowned Hog, The Well-Keeper, The Kiln Father, The Ash Hound — and **The Housemother**, whose foot, arms and eyes come through the walls and floor before her heart is exposed. Boss intro cards are skippable.
- **91 items** (77 passive, 14 active) + **14 trinkets** via a data-driven hook system (`modifyTear`, `onFire`, `onTearHit`, `onEnemyKill`, `onRoomClear`, `onHurt`, `onFloorStart`, ...). Effects stack: homing + split = homing split shots, laser + multishot = several beams. Passives change Isaiah's look (thimble hat, horns, halo, third eye, wings...).
- **Pools**: Treasure, Boss, Shop, Bargain (costs heart containers), Chapel (free, more likely if you skipped Bargains), Secret, Library — seeded, no repeats in a run.
- **14 cards, 16 pills** (pill colors shuffled per seed, identified on use).
- **Curses**: Darkness, the Lost, the Maze, the Unknown, the Labyrinth.
- Seeded runs (seed on the pause screen; type one in on the character screen), saved unlocks / best run / settings in `localStorage`. Beat The Housemother to unlock **June**.

## Tuning
Every gameplay number lives in **`src/config.js`**: player speed/acceleration/friction, base stats, bomb numbers, damage rules, room counts, special-room chances, reward tables, prices, deal-room odds, champion odds, per-enemy HP/speed, boss HP, per-floor enemy pools and palettes.

## Code map
```
src/config.js        all tunables + per-floor tables
src/game.js          run/floor/room flow, transitions, doors, clears, explosions
src/run.js           seed streams, item pools, pill colors, curses
src/core/            loop (fixed 60Hz), input (kbd + gamepad), rng, audio (WebAudio synth), save
src/render/          gfx (ortho camera, pooled billboards), draw (crayon helpers), art_* generators, roomview
src/world/           floorgen, templates, roomfill (templates → grid), room (grid + collision)
src/entities/        player, tears/lasers, enemies, bosses, pickups, bombs, familiars, effects
src/items/           items + trinkets, consumables (cards/pills), stats, hooks, logic (game rules)
src/ui/              hud (canvas overlay), menus (DOM), panels (story)
tools/playtest.mjs   headless Playwright playtests: node tools/playtest.mjs <outDir> <scenario>
                     scenarios: basic, explore, rooms, gallery, boss, allitems, perf, tour, bigroom
```
