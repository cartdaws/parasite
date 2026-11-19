// ============================================================================
//  THE FINDING OF ISAIAH — tunable numbers
//  Every gameplay number worth balancing lives here. Units: 1 tile = 1 world
//  unit, time in seconds, speeds in tiles/second, damage in raw HP.
// ============================================================================

export const CFG = {
  // ---- simulation / view ---------------------------------------------------
  TICK: 1 / 60,               // fixed update step
  CAMERA_TILT_DEG: 20,        // 3/4 tilt from straight-down
  VIEW_MIN_W: 16.2,           // world units always visible horizontally
  VIEW_MIN_H: 10.4,           // ...and vertically (on screen)
  WALL_HEIGHT: 1.7,
  ROOM_TRANSITION_TIME: 0.3,  // camera slide between rooms
  ENEMY_SPAWN_GRACE: 0.45,    // enemies idle this long after you enter

  // ---- room geometry --------------------------------------------------------
  ROOM_W: 13,                 // interior tiles of a 1x1 room
  ROOM_H: 7,
  CELL_W: 15,                 // grid pitch (interior + walls)
  CELL_H: 9,

  // ---- player ---------------------------------------------------------------
  PLAYER: {
    radius: 0.32,
    baseSpeed: 4.6,           // tiles/s at speed stat 1.0
    accelRate: 13,            // 1/s — how quickly you reach top speed (higher = snappier)
    frictionRate: 9,          // 1/s — how quickly you stop (lower = slidier)
    invulnTime: 1.0,
    startHearts: 3,           // red heart containers
    maxHearts: 12,            // total heart slots (red + soul)
    tearInheritVel: 0.35,     // fraction of player velocity added to tears
    pickupRadius: 0.55,
    holdItemTime: 1.1,        // item-over-head pose
  },

  // ---- base stats (Rebirth-style formulas, see stats.js) ---------------------
  STATS: {
    damage: 3.5, tearsUp: 0, range: 6.5, shotSpeed: 1.0, speed: 1.0, luck: 0,
    tearBaseSpeed: 9.5,       // tiles/s at shot speed 1.0
    tearFallTime: 0.22,       // portion of flight where the tear arcs to the floor
    tearHeight: 0.62,         // visual height tears fly at
    speedMin: 0.1, speedMax: 2.0,
    shotSpeedMin: 0.6,
    rangeMin: 1.5,
    minFireDelay: 2,          // frames (hard floor for fire delay)
    knockback: 2.4,           // tiles/s impulse on enemies hit
  },

  // ---- bombs ----------------------------------------------------------------
  BOMB: {
    fuse: 1.55, radius: 1.75, damage: 60, playerDamage: 2, // halves
    kickSpeed: 5, friction: 6, bigRadiusMult: 1.45,
  },

  // ---- hearts / damage ------------------------------------------------------
  DAMAGE: {
    fullHeartFromFloor: 3,    // from this floor on, most hits cost a full heart
    bossContactFull: true,    // touching a boss always costs a full heart
    bossShotsFullFromFloor: 2,// boss projectiles cost a full heart from this floor
    blackHeartBurst: 40,      // damage to all enemies when a black heart breaks
    spikeDamage: 1,           // halves (raised later floors via fullHeartFromFloor)
    fireDamage: 1,
  },

  // ---- floors ---------------------------------------------------------------
  FLOOR_NAMES: ['The Crawlspace', 'The Root Cellar', 'The Flooded Well', 'The Bone Kiln', 'The Underneath'],
  FLOOR_COUNT: 5,
  GRID_SIZE: 13,
  ROOMS_PER_FLOOR_MULT: 3.33,
  ROOMS_PER_FLOOR_ADD: [5, 6], // random extra rooms
  ROOMS_MAX: 22,
  LABYRINTH_ROOM_MULT: 1.75,
  BIG_ROOM_CHANCE: 0.12,      // chance per growth step to try a big room
  SECRET_ROOM_CHANCE: 0.85,
  OPTIONAL_ROOMS: {           // chance per floor of optional special rooms
    sacrifice: 0.22, challenge: 0.3, arcade: 0.28, library: 0.18,
  },
  CURSE_CHANCE: 0.28,         // per floor (never on floor 1 in the first run)

  // ---- room clear rewards (weights; luck shifts toward better ones) --------
  CLEAR_REWARD_BASE_CHANCE: 0.32,
  CLEAR_REWARD_LUCK_BONUS: 0.06,  // per luck point
  CLEAR_REWARDS: [
    ['coin', 30], ['heart', 18], ['key', 12], ['bomb', 12], ['chest', 9],
    ['card', 6], ['pill', 6], ['battery', 2], ['trinket', 2], ['lockedchest', 3],
  ],
  COIN_VALUES: [['penny', 85], ['nickel', 12], ['dime', 3]],
  HEART_TYPES: [['half', 40], ['full', 35], ['soul', 18], ['black', 4], ['double', 3]],

  // ---- obstacle drops ------------------------------------------------------
  POOP_HITS: 4,
  POOP_DROP_CHANCE: 0.18,
  FIRE_HP: 3,
  FIRE_DROP_CHANCE: 0.15,
  TINTED_ROCK_DROPS: [['soul', 3], ['bomb', 3], ['key', 2], ['coin', 2]],

  // ---- shop -----------------------------------------------------------------
  PRICES: { heart: 3, soul: 5, key: 5, bomb: 5, item: 15, card: 5, pill: 4, battery: 5 },
  SHOPKEEPER_COINS: [2, 5],

  // ---- deal rooms -----------------------------------------------------------
  DEAL: {
    baseChance: 0.35,         // after a boss (floor 2+)
    floor1Chance: 0.0,
    damagePenalty: 0.5,       // multiplier if you took red-heart damage this floor
    bossDamagePenalty: 0.65,  // ...and if you took damage in the boss fight
    chapelBaseShare: 0.0,     // share of deal rooms that are Chapel rooms
    chapelSkipBonus: 0.33,    // per Bargain room seen but not taken
    chapelTakenPenalty: true, // taking a Bargain deal locks Chapels this run
    bargainHeartCost: [1, 2], // red containers per item (by quality)
  },

  // ---- active items / misc ---------------------------------------------------
  BATTERY_CHARGE: 6,
  ENEMY_SHOT_SPEED: 4.6,
  ENEMY_SHOT_RANGE: 7.5,

  // ---- champions ------------------------------------------------------------
  CHAMPION_CHANCE: [0, 0.04, 0.07, 0.1, 0.12, 0.14], // index by floor
  CHAMPION_TYPES: [
    { id: 'red', tint: 0xff6060, hpMult: 2.0, drop: 'heart' },
    { id: 'yellow', tint: 0xffe060, speedMult: 1.45, drop: 'coin' },
    { id: 'green', tint: 0x80ff70, hpMult: 1.4, creep: true, drop: 'pill' },
    { id: 'blue', tint: 0x7090ff, deathShots: 6, drop: 'soul' },
    { id: 'black', tint: 0x6a5a6a, hpMult: 1.6, dmgMult: 2, drop: 'bomb' },
    { id: 'pink', tint: 0xff90d0, shotsAtYou: true, drop: 'key' },
  ],

  // ---- enemy stats (hp / speed) — behaviors live in entities/enemies.js -----
  // HP is per floor 1; later floors multiply by ENEMY_HP_FLOOR_SCALE.
  ENEMY_HP_FLOOR_SCALE: [1, 1, 1.25, 1.55, 1.85, 2.15],
  ENEMY: {
    gnat:      { hp: 4,  speed: 1.25 },
    twitchfly: { hp: 5,  speed: 3.2 },
    halogn:    { hp: 4,  speed: 2.4 },
    bloat:     { hp: 18, speed: 0.6 },
    moaner:    { hp: 10, speed: 1.55 },
    sprinter:  { hp: 10, speed: 2.2 },
    tusk:      { hp: 16, speed: 1.0, charge: 7.5 },
    pipe:      { hp: 12, fireRate: 1.6 },
    wellspout: { hp: 16, fireRate: 2.2 },
    peeper:    { hp: 12, speed: 0.9, fireRate: 1.0 },
    tick:      { hp: 8,  speed: 3.6 },
    toadsack:  { hp: 22, speed: 3.0 },
    molemite:  { hp: 10, fireRate: 2.4 },
    spider:    { hp: 6,  speed: 5.5 },
    broodsp:   { hp: 18, speed: 4.5 },
    clot:      { hp: 18, speed: 1.0 },
    clotlet:   { hp: 7,  speed: 1.4 },
    gasbag:    { hp: 10, speed: 1.3 },
    drooler:   { hp: 14, speed: 0.9 },
    spitter:   { hp: 12, speed: 1.1, fireRate: 2.0 },
    hive:      { hp: 24, spawnRate: 3.2 },
    draft:     { hp: 10, speed: 1.4 },
    wailhead:  { hp: 14, speed: 0.8, fireRate: 2.1 },
    grub:      { hp: 12, speed: 0.7 },
    leech:     { hp: 9,  speed: 4.2 },
    shellback: { hp: 20, speed: 1.0 },
    bonethrow: { hp: 14, speed: 0.9, fireRate: 2.4 },
    ember:     { hp: 8,  speed: 1.7 },
    nun:       { hp: 20, fireRate: 2.6 },
    nightcrawl:{ hp: 12, speed: 2.0 },
    kilnimp:   { hp: 16, speed: 2.4 },
  },

  // ---- bosses ---------------------------------------------------------------
  BOSS: {
    lump:      { hp: 260 },
    mildew:    { hp: 230 },
    taproot:   { hp: 320 },
    rottwins:  { hp: 190 },   // each
    hog:       { hp: 420 },
    wellkeeper:{ hp: 400 },
    kilnfather:{ hp: 520 },
    ashhound:  { hp: 480 },
    housemother: { hp: 1300, heartHp: 900 },
    hpFloorScale: [1, 1, 1.15, 1.35, 1.6, 1.8],
  },
  BOSS_INTRO_TIME: 2.1,

  // ---- items ----------------------------------------------------------------
  TREASURE_QUALITY_WEIGHTS: [1, 1, 1, 0.75, 0.35],   // by quality 0..4
  ACTIVE_ROOM_CHARGE: 1,
};

// Per-floor content tables (enemy pools are ids from CFG.ENEMY, bosses from CFG.BOSS)
export const FLOORS = [
  null,
  { // 1
    enemies: ['gnat', 'twitchfly', 'moaner', 'pipe', 'clot', 'spider', 'tick', 'grub', 'bloat', 'gasbag', 'peeper', 'hive'],
    bosses: ['lump', 'mildew'],
    palette: { floor: '#5a4636', floor2: '#4c3a2c', wall: '#3d2f26', wallTop: '#2b211b', accent: '#7a5d43' },
    drone: [55, 82.4],
  },
  { // 2
    enemies: ['moaner', 'sprinter', 'tusk', 'pipe', 'clot', 'broodsp', 'spider', 'tick', 'drooler', 'spitter', 'hive', 'grub', 'molemite', 'halogn', 'bloat', 'gasbag'],
    bosses: ['taproot', 'rottwins', 'lump'],
    palette: { floor: '#4e4a30', floor2: '#3f3c25', wall: '#3a3322', wallTop: '#26221a', accent: '#6f6a3c' },
    drone: [49, 73.4],
  },
  { // 3
    enemies: ['sprinter', 'tusk', 'wellspout', 'peeper', 'toadsack', 'molemite', 'leech', 'drooler', 'draft', 'wailhead', 'clot', 'broodsp', 'spitter', 'halogn', 'twitchfly'],
    bosses: ['hog', 'wellkeeper', 'rottwins'],
    palette: { floor: '#36464a', floor2: '#2b3a3d', wall: '#263236', wallTop: '#182124', accent: '#4d6a68' },
    drone: [43.6, 65.4],
  },
  { // 4
    enemies: ['shellback', 'bonethrow', 'ember', 'nun', 'kilnimp', 'tusk', 'wellspout', 'wailhead', 'toadsack', 'leech', 'draft', 'nightcrawl', 'gasbag', 'broodsp'],
    bosses: ['kilnfather', 'ashhound', 'hog'],
    palette: { floor: '#4a3430', floor2: '#3c2925', wall: '#3a2220', wallTop: '#221413', accent: '#8a4a32' },
    drone: [41.2, 61.7],
  },
  { // 5
    enemies: ['shellback', 'bonethrow', 'ember', 'nun', 'kilnimp', 'nightcrawl', 'wailhead', 'draft', 'leech', 'toadsack', 'wellspout', 'broodsp', 'spitter'],
    bosses: ['housemother'],
    palette: { floor: '#3a2a3a', floor2: '#2e202e', wall: '#2a1c2a', wallTop: '#170f17', accent: '#6e3a5a' },
    drone: [36.7, 55],
  },
];
