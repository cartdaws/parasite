// The deck, as a grid. Every system reads it: the builder draws it, collision and sight test against it, and the crew walk it.
//
// Cell kinds
//   WALL    solid for everyone
//   FLOOR   open
//   VENT    a duct inside the walls: only the worm fits
//   DOOR    opens for anyone who walks up to it
//   LABDOOR keycard door: opens only for a scientist
//   GATE    security scanner: anyone can walk through, but it reports anything that is not a maintenance bot
//   POD     the escape pod: reach it to win
export const CELL = 2;          // metres per cell
export const WALL = 0, FLOOR = 1, VENT = 2, DOOR = 3, LABDOOR = 4, GATE = 5, POD = 6;

export const W = 40, H = 22;

// Rooms: floor rectangles (inclusive cell coordinates) with a name, a light colour, and who belongs there.
export const ROOMS = [
  { id: 'cargo', name: 'CARGO HOLD', x0: 1, y0: 1, x1: 9, y1: 8, light: 0x7aa6c8, crates: [[3, 6], [4, 6], [7, 2], [8, 2], [8, 3], [2, 2]] },
  { id: 'crew', name: 'CREW QUARTERS', x0: 1, y0: 12, x1: 9, y1: 20, light: 0xd8c49a, crates: [[1, 14], [1, 17], [1, 20], [6, 20], [9, 13]] },
  { id: 'hall', name: 'MAIN CORRIDOR', x0: 11, y0: 1, x1: 13, y1: 20, light: 0x9ab8cc, crates: [] },
  { id: 'lab', name: 'RESEARCH LAB', x0: 15, y0: 1, x1: 25, y1: 8, light: 0x7ae0d0, crates: [[18, 3], [19, 3], [22, 6], [23, 6], [25, 1]], restricted: ['guard'] },
  { id: 'security', name: 'SECURITY', x0: 15, y0: 12, x1: 25, y1: 20, light: 0xe08a6a, crates: [[17, 14], [17, 15], [22, 18], [23, 18]], restricted: ['scientist'] },
  { id: 'pod', name: 'POD BAY', x0: 29, y0: 2, x1: 38, y1: 19, light: 0x9fe0a0, crates: [[31, 8], [31, 9], [35, 15], [36, 15]] },
];

export function buildMap() {
  const g = new Uint8Array(W * H); // all WALL
  const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) g[y * W + x] = v; };
  const solids = [];
  for (const r of ROOMS) for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) set(x, y, FLOOR);
  // short corridors to the pod bay
  for (let x = 26; x <= 28; x++) { set(x, 4, FLOOR); set(x, 16, FLOOR); }
  // doors
  set(10, 6, DOOR);        // cargo -> hall
  set(10, 16, DOOR);       // crew -> hall
  set(14, 16, DOOR);       // hall -> security
  set(14, 4, LABDOOR);     // hall -> lab (scientists only)
  set(27, 4, LABDOOR);     // lab -> pod bay (scientists only)
  set(27, 16, GATE);       // security -> pod bay: the scanner
  // the worm's ways: a duct from the cargo hold down to the crew quarters, and a grille through the corridor wall into the lab
  for (let y = 9; y <= 11; y++) set(5, y, VENT);
  set(14, 7, VENT);
  // the escape pod
  set(36, 10, POD);
  // crates are solid blocks for everyone (except where they would close a path)
  for (const r of ROOMS) for (const [x, y] of r.crates) solids.push([x, y]);
  for (const [x, y] of solids) set(x, y, WALL);

  const spawns = {
    worm: [1, 8],
    npcs: [
      { type: 'guard', at: [6, 4], room: 'cargo' },
      { type: 'guard', at: [12, 9], room: 'hall' },
      { type: 'scientist', at: [5, 16], room: 'crew' },
      { type: 'scientist', at: [20, 5], room: 'lab' },
      { type: 'bot', at: [20, 16], room: 'security' },
      { type: 'guard', at: [33, 12], room: 'pod' },
    ],
    turret: { at: [30, 15], facing: [-1, 0.2] },
  };
  return { grid: g, spawns, crates: solids };
}

export const cellAt = (grid, x, y) => (x < 0 || y < 0 || x >= W || y >= H ? WALL : grid[y * W + x]);
export const roomAt = (cx, cy) => ROOMS.find((r) => cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) || null;
export const toCell = (v) => Math.floor(v / CELL);
export const cellCenter = (c) => c * CELL + CELL / 2;
