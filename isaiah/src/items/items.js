// ============================================================================
//  Item registry. Each item:
//   id, name, tagline, pools[], type ('passive'|'active'), quality 0-4,
//   icon [shape, colorA, colorB], stats {dmg, dmgFlat, dmgMult, tears, tearsMult,
//   tearsFlat, range, shotSpeed, speed, luck}, flags [...], tearColor, tearScale,
//   weapon, extraShots, spread, cosmetic {}, familiars [], onPickup(p),
//   hooks {modifyTear, onFire, onTearHit, onEnemyKill, onRoomClear, onHurt,
//   onFloorStart, onRoomEnter, onUpdate, ...}, charge + use(p) for actives.
//  Flags: homing piercing spectral split poison burn slow fear charm freeze
//   bounce wiggle explosive flight bigBombs remoteBombs stickyBombs
//   homingBombs poisonBombs scatterBombs
// ============================================================================
import { S } from '../state.js';
import { fxRng } from '../core/rng.js';
import { audio } from '../core/audio.js';
import { TEAR_COLORS } from '../config.js';
import { spawnReward, spawnPickup } from '../entities/pickups.js';
import { addShake, setTex } from '../render/gfx.js';
import { poof, particles, creep } from '../entities/effects.js';

const chance = (base, luckK, p) => fxRng.chance(base + Math.max(0, p.stats.luck) * luckK);
function statusChance(flag, color, base, luckK) {
  return (t, p) => { if (chance(base, luckK, p)) { t.flags[flag] = 1; t.color = color; } };
}
const T = ['treasure'];

export const ITEMS = {
  // ---------------- stat ups ----------------
  gran_thimble: { name: "Gran's Thimble", tagline: 'a little armor for a little head', pools: [...T, 'boss'], quality: 2, icon: ['thimble'], stats: { dmg: 1 }, cosmetic: { hat: 'thimble' } },
  pepper_jar: { name: 'Pepper Jar', tagline: 'damage up, eyes watering', pools: [...T, 'boss'], quality: 1, icon: ['pepper'], stats: { dmg: 0.7, tears: 0.2 }, tearColor: 0xe8a0a0 },
  iron_kettle: { name: 'Iron Kettle', tagline: 'heavy, hot, angry', pools: ['boss', ...T], quality: 2, icon: ['kettle'], stats: { dmg: 1.6, speed: -0.15 } },
  angry_sock: { name: 'Angry Sock', tagline: 'it wants to kick something', pools: T, quality: 1, icon: ['sock'], stats: { dmg: 0.5, speed: 0.2 } },
  bloodshot: { name: 'Bloodshot Eye', tagline: 'you have not slept in days', pools: [...T, 'bargain'], quality: 3, icon: ['eye'], stats: { dmgMult: 1.5, tears: -0.4 }, tearColor: 0xd04040, cosmetic: { eyeColor: '#c02020' } },
  cousins_slingshot: { name: "Cousin's Slingshot", tagline: 'borrowed forever', pools: T, quality: 2, icon: ['slingshot'], stats: { dmg: 0.5, range: 1.5, shotSpeed: 0.2 } },
  onion_skin: { name: 'Onion Skin', tagline: 'it always makes you cry', pools: [...T, 'boss'], quality: 2, icon: ['onion'], stats: { tears: 0.7 } },
  salt_lick: { name: 'Salt Lick', tagline: 'tears up, range up', pools: ['boss', ...T], quality: 1, icon: ['salt'], stats: { tears: 0.4, range: 1.2 } },
  crybaby_bib: { name: 'Crybaby Bib', tagline: 'waaaaah', pools: T, quality: 2, icon: ['bib'], stats: { tears: 1.0, range: -0.8 } },
  sugar_cube: { name: 'Sugar Cube', tagline: 'zoom', pools: ['boss', 'shop'], quality: 1, icon: ['cube'], stats: { speed: 0.3 }, onPickup(p) { p.addContainers(1); } },
  liver_pie: { name: 'Liver Pie', tagline: 'health up (it tastes awful)', pools: ['boss', ...T], quality: 1, icon: ['pie'], onPickup(p) { p.addContainers(1); p.heal(2); } },
  stuffed_heart: { name: 'Stuffed Heart', tagline: 'health up, a lot', pools: ['boss'], quality: 2, icon: ['heart', '#c81e1e'], stats: { range: 0.5 }, onPickup(p) { p.addContainers(2); p.heal(99); } },
  breakfast: { name: 'Cold Breakfast', tagline: 'health up', pools: ['boss'], quality: 0, icon: ['plate'], onPickup(p) { p.addContainers(1); p.heal(2); }, noPool: true },
  lucky_foot: { name: 'Lucky Rabbit Foot', tagline: 'luck up', pools: [...T, 'shop'], quality: 1, icon: ['leaf'], stats: { luck: 2 } },
  cold_supper: { name: 'Cold Supper', tagline: 'health up, full belly', pools: ['boss', 'shop'], quality: 1, icon: ['plate', '#d8d8e8'], onPickup(p) { p.addContainers(1); p.heal(99); } },
  goat_skull: { name: 'Goat Skull', tagline: 'it whispers numbers', pools: ['bargain'], quality: 3, icon: ['skull'], stats: { dmg: 2, speed: 0.1 }, cosmetic: { horns: '#3a0a0a' } },
  chalk_circle: { name: 'Chalk Circle', tagline: 'damage up, do not step out', pools: ['bargain'], quality: 3, icon: ['chalk'], stats: { dmg: 1.5 } },
  black_bile: { name: 'Black Bile', tagline: 'your heart goes dark', pools: ['bargain'], quality: 2, icon: ['blood', '#2a1a2a'], stats: { dmg: 0.5 }, onPickup(p) { p.addSoul(4, 'b'); } },
  goat_horns: { name: 'Goat Horns', tagline: 'speed and spite', pools: ['bargain'], quality: 2, icon: ['horns'], stats: { dmg: 1, speed: 0.3 }, cosmetic: { horns: '#4a0a0a' } },
  holy_water: { name: 'Holy Water Bottle', tagline: 'blessed tears', pools: ['chapel'], quality: 3, icon: ['bottle', '#f0f0c0'], stats: { tears: 0.7, dmg: 0.4 }, flags: ['piercing'], tearColor: TEAR_COLORS.holy },
  rust_rosary: { name: 'Rust Rosary', tagline: 'pray it holds', pools: ['chapel', ...T], quality: 2, icon: ['rosary'], stats: { tears: 0.5 }, onPickup(p) { p.addSoul(2); }, cosmetic: { rosary: true } },
  // ---------------- tear modifiers ----------------
  bent_fork: { name: 'Bent Fork', tagline: 'homing tears', pools: T, quality: 3, icon: ['fork'], flags: ['homing'], cosmetic: { eyeColor: '#8a3ab0' } },
  dowsing_rod: { name: 'Dowsing Rod', tagline: 'it finds what you need', pools: ['shop', ...T], quality: 2, icon: ['rod'], flags: ['homing'], stats: { range: 1.5, tears: -0.2 } },
  knitting_needle: { name: 'Knitting Needle', tagline: 'piercing tears', pools: T, quality: 2, icon: ['needle'], flags: ['piercing'], stats: { shotSpeed: 0.2 } },
  cracked_marble: { name: 'Cracked Marble', tagline: 'tears split on impact', pools: T, quality: 2, icon: ['marble'], flags: ['split'] },
  third_eye_patch: { name: 'The Third Eye Patch', tagline: 'see what is not there', pools: T, quality: 3, icon: ['eyepatch'], extraShots: 2, cosmetic: { thirdEye: true } },
  four_leaf_spider: { name: 'Four-Leaf Spider', tagline: 'quad shot', pools: [...T, 'bargain'], quality: 3, icon: ['spider'], extraShots: 3, stats: { tears: -0.3 }, cosmetic: { extraEyes: true } },
  twin_straw: { name: 'Twin Straw', tagline: 'double shot', pools: T, quality: 2, icon: ['straw'], extraShots: 1, spread: 'parallel' },
  swamp_water: { name: 'Swamp Water', tagline: 'poison tears', pools: T, quality: 2, icon: ['bottle', '#6a9a2a'], flags: ['poison'], tearColor: TEAR_COLORS.poison, cosmetic: { skin: '#b8c8a0' } },
  wet_matchbook: { name: 'Wet Matchbook', tagline: 'it still lights, sometimes', pools: T, quality: 1, icon: ['matchbook'], stats: { dmg: 0.3 }, hooks: { modifyTear: statusChance('burn', TEAR_COLORS.burn, 0.2, 0.04) } },
  molasses: { name: 'Molasses', tagline: 'slowing tears', pools: T, quality: 1, icon: ['jar', '#5a3a1a'], flags: ['slow'], tearColor: TEAR_COLORS.slow, stats: { tears: 0.2 } },
  scary_story: { name: 'Scary Story', tagline: 'they are afraid now', pools: T, quality: 2, icon: ['book', '#3a2a4a', '#8a3ab0'], hooks: { modifyTear: statusChance('fear', TEAR_COLORS.fear, 0.18, 0.04) } },
  love_letter: { name: 'Love Letter', tagline: 'charming tears', pools: [...T, 'chapel'], quality: 2, icon: ['letter'], hooks: { modifyTear: statusChance('charm', TEAR_COLORS.charm, 0.18, 0.04) } },
  ice_tray: { name: 'Ice Tray', tagline: 'chilly tears', pools: T, quality: 2, icon: ['ice'], hooks: { modifyTear: statusChance('freeze', 0xb0e8ff, 0.14, 0.04) } },
  rubber_ball: { name: 'Rubber Ball', tagline: 'boing', pools: T, quality: 1, icon: ['ball'], flags: ['bounce'], stats: { range: 1 } },
  bendy_straw: { name: 'Bendy Straw', tagline: 'wiggly tears, tears up', pools: T, quality: 2, icon: ['worm'], flags: ['wiggle'], stats: { tears: 0.4 } },
  sour_ball: { name: 'Sour Ball', tagline: 'explosive tears', pools: ['bargain', ...T], quality: 3, icon: ['ball', '#d8e040', '#e84a4a'], flags: ['explosive'], stats: { tears: -0.5 }, tearColor: 0xd8e040 },
  feather_quill: { name: 'Feather Quill', tagline: 'tears pass through rocks', pools: ['chapel', ...T], quality: 2, icon: ['feather'], flags: ['spectral'], stats: { tears: 0.3 }, tearColor: 0xe8e8ff },
  sacred_thread: { name: 'Sacred Thread', tagline: 'guided by a kind hand', pools: ['chapel'], quality: 4, icon: ['halo'], flags: ['homing'], stats: { dmg: 1, dmgMult: 1.2 }, tearColor: TEAR_COLORS.holy, cosmetic: { halo: true } },
  spoiled_milk_tooth: { name: 'Spoiled Milk Tooth', tagline: 'chew on it', pools: T, quality: 2, icon: ['tooth'], tearStyle: 'tooth', stats: { dmgFlat: 1.4, tears: -0.3 }, tearColor: 0xe8dcc0 },
  big_bones: { name: 'Big Bones', tagline: 'you grew', pools: T, quality: 2, icon: ['bone'], stats: { dmg: 1, speed: -0.15 }, size: 1.25, tearScale: 1.3 },
  shrinking_draught: { name: 'Shrinking Draught', tagline: 'you shrank', pools: T, quality: 2, icon: ['bottle', '#c84ae8'], stats: { speed: 0.2, range: 0.5 }, size: 0.75 },
  junk_drawer: { name: 'Junk Drawer', tagline: 'you never know what you will get', pools: T, quality: 2, icon: ['drawer'],
    hooks: { modifyTear(t) { const opts = [['homing', TEAR_COLORS.homing], ['piercing', 0xffffff], ['poison', TEAR_COLORS.poison], ['slow', TEAR_COLORS.slow], ['fear', TEAR_COLORS.fear], ['charm', TEAR_COLORS.charm], ['burn', TEAR_COLORS.burn], ['split', 0xc0c0ff], ['bounce', 0xffe0a0], ['wiggle', 0xa0ffa0]]; const [f, c] = fxRng.pick(opts); t.flags[f] = 1; t.color = c; } } },
  kaleidoscope: { name: 'Kaleidoscope', tagline: 'everything, all at once', pools: ['secret', ...T], quality: 3, icon: ['kaleido'],
    hooks: { modifyTear(t) { t.dmg *= fxRng.range(0.6, 2.2); t.scale *= fxRng.range(0.7, 1.6); t.color = Math.floor(fxRng.next() * 0xffffff) | 0x404040; t.spr.scale.set(0.5 * t.scale, 0.5 * t.scale, 1); if (fxRng.chance(0.3)) t.flags.homing = 1; } } },
  magic_eight_ball: { name: 'Magic Eight Ball', tagline: 'ask again later', pools: T, quality: 1, icon: ['ball8'],
    onPickup(p) { p.eightBall = { dmg: fxRng.range(-0.3, 1.2), tears: fxRng.range(-0.3, 0.8), speed: fxRng.range(-0.1, 0.25), range: fxRng.range(-1, 2), luck: fxRng.int(-1, 2) }; },
    dynamicStats(p) { return p.eightBall || {}; } },
  // ---------------- weapons ----------------
  grans_bloodline: { name: "Gran's Bloodline", tagline: 'it runs in the family', pools: ['bargain', ...T], quality: 4, icon: ['blood', '#c01010'], weapon: 'laser', stats: { dmg: 0.5 }, cosmetic: { blood: true } },
  tin_can_phone: { name: 'Tin Can Telephone', tagline: 'can you hear me?', pools: T, quality: 3, icon: ['can'], weapon: 'tech', stats: { tears: 0.2 } },
  spitball_straw: { name: 'Spitball Straw', tagline: 'hold to charge', pools: T, quality: 3, icon: ['straw', '#4a8ae8', '#f0f0f0'], weapon: 'charged', stats: { dmg: 0.3 } },
  // ---------------- familiars ----------------
  cellar_moth: { name: 'Cellar Moth', tagline: 'drawn to your light', pools: T, quality: 2, icon: ['moth'], familiars: ['moth'] },
  choir_of_flies: { name: 'Choir of Flies', tagline: 'they sing when you cry', pools: [...T, 'bargain'], quality: 2, icon: ['flies'], familiars: ['choirfly', 'choirfly', 'choirfly'], cosmetic: { flies: true } },
  lint_ball: { name: 'Lint Ball', tagline: 'fuzzy protector', pools: ['shop', ...T], quality: 1, icon: ['lint'], familiars: ['lint'] },
  paper_doll: { name: 'Paper Doll', tagline: 'a friend who cries with you', pools: T, quality: 2, icon: ['doll'], familiars: ['doll'] },
  sock_puppet: { name: 'Sock Puppet', tagline: 'it bites back', pools: ['shop', ...T], quality: 2, icon: ['puppet'], familiars: ['puppet'] },
  dust_bunny: { name: 'Dust Bunny', tagline: 'it hunts', pools: T, quality: 2, icon: ['bunny'], familiars: ['bunny'] },
  severed_finger: { name: 'Severed Finger', tagline: 'it points at the guilty', pools: ['bargain'], quality: 3, icon: ['arm', '#c8a890'], familiars: ['finger'] },
  // ---------------- flight / survival ----------------
  dandelion_wish: { name: 'Dandelion Wish', tagline: 'flight', pools: [...T, 'chapel'], quality: 3, icon: ['dandelion'], flags: ['flight'], cosmetic: { wings: '#f0f0f0' } },
  moth_wings: { name: 'Moth Wings', tagline: 'flight, tears up', pools: ['chapel', 'bargain'], quality: 3, icon: ['wings', '#c8b890'], flags: ['flight'], stats: { tears: 0.3 }, cosmetic: { wings: '#c8b890', antennae: true } },
  cats_collar: { name: "Cat's Collar", tagline: 'extra life', pools: ['secret', ...T], quality: 4, icon: ['collar'],
    extraLife(p) { p.maxRed = Math.max(2, p.maxRed - 2); p.red = Math.min(p.maxRed, 2); } },
  grandpas_ghost: { name: "Grandpa's Ghost", tagline: 'he is still watching over you', pools: ['chapel', 'secret'], quality: 3, icon: ['ghost'],
    extraLife(p) { p.maxRed = 0; p.red = 0; p.soul = ['s', 's', 's', 's']; p.items.push('dandelion_wish'); p.refresh(); } },
  paper_halo: { name: 'Paper Halo', tagline: 'blocks one hit each room', pools: ['chapel'], quality: 4, icon: ['halo', '#f8f0d0'], cosmetic: { halo: true },
    onPickup(p) { p.holyShield = true; }, hooks: { onRoomEnter(p) { if (!S.room.cleared) p.holyShield = true; } } },
  candle_stub: { name: 'Candle Stub', tagline: 'a little light goes a long way', pools: ['shop'], quality: 1, icon: ['candle'], stats: { luck: 1 }, cosmetic: { hat: 'candle' } },
  bandage_roll: { name: 'Bandage Roll', tagline: 'soul hearts up', pools: [...T, 'shop'], quality: 1, icon: ['scroll', '#f0e8d8'], onPickup(p) { p.addSoul(4); } },
  // ---------------- economy / bombs / keys ----------------
  bad_penny: { name: 'Bad Penny', tagline: 'always comes back', pools: T, quality: 1, icon: ['coin', '#7a5a2a'], stats: { luck: 1 },
    hooks: { onRoomClear(p, room) { if (fxRng.chance(0.3)) spawnReward('coin', room.W / 2, room.H / 2, S.run.dropRng); } } },
  piggy_bank: { name: 'Piggy Bank', tagline: 'it rattles when you get hurt', pools: ['shop', ...T], quality: 1, icon: ['bag', '#e8a0b0'],
    onPickup(p) { p.coins = Math.min(99, p.coins + 3); }, hooks: { onHurt(p) { if (fxRng.chance(0.6)) spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2.5 }); } } },
  coupon: { name: 'Expired Coupon', tagline: 'everything half off', pools: ['shop', 'secret'], quality: 2, icon: ['scroll', '#f0e040'] },
  skeleton_key: { name: 'Skeleton Key', tagline: 'every door is yours', pools: ['secret', 'shop'], quality: 3, icon: ['key'], onPickup(p) { p.keys = Math.min(99, p.keys + 3); } },
  bottomless_bag: { name: 'Bottomless Bag', tagline: 'infinite bombs', pools: ['secret', 'bargain'], quality: 4, icon: ['bag'] },
  firework_crate: { name: 'Firework Crate', tagline: 'bigger booms, +5 bombs', pools: [...T, 'shop'], quality: 2, icon: ['firework'], flags: ['bigBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  remote_doorbell: { name: 'Remote Doorbell', tagline: 'press E again to detonate', pools: ['shop', ...T], quality: 2, icon: ['doorbell'], flags: ['remoteBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  gum_wad: { name: 'Gum Wad', tagline: 'sticky bombs, +5 bombs', pools: [...T, 'shop'], quality: 1, icon: ['gum'], flags: ['stickyBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  bloodhound_bomb: { name: 'Bloodhound Bombs', tagline: 'homing bombs, +5 bombs', pools: T, quality: 2, icon: ['rocket', '#6a3a8a'], flags: ['homingBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  rotten_egg: { name: 'Rotten Egg', tagline: 'poison bombs, +5 bombs', pools: T, quality: 1, icon: ['egg'], flags: ['poisonBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  scatter_seeds: { name: 'Scatter Seeds', tagline: 'bombs make baby bombs', pools: T, quality: 2, icon: ['seeds'], flags: ['scatterBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  blast_apron: { name: 'Blast Apron', tagline: 'explosion immunity, +3 bombs', pools: ['shop', ...T], quality: 2, icon: ['apron'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 3); } },
  // ---------------- maps ----------------
  crayon_map: { name: 'Crayon Map', tagline: 'floor revealed', pools: ['shop', ...T], quality: 1, icon: ['map'],
    onPickup(p) { p.mapRevealed = true; }, hooks: { onFloorStart(p) { p.mapRevealed = true; } } },
  compass_shell: { name: 'Compass Shell', tagline: 'special rooms revealed', pools: ['shop', ...T], quality: 1, icon: ['shell'],
    onPickup() { revealSpecial(); }, hooks: { onFloorStart() { revealSpecial(); } } },
  lantern_bug: { name: 'Lantern Bug', tagline: 'secrets glow', pools: ['secret', 'shop'], quality: 1, icon: ['bug'],
    onPickup(p) { p.secretsRevealed = true; revealSecrets(); }, hooks: { onFloorStart() { revealSecrets(); } } },

  // ================= ACTIVE ITEMS =================
  hymnal: { name: 'Hymnal', tagline: 'temporary flight', type: 'active', pools: ['library', 'chapel'], quality: 2, charge: 3, icon: ['book', '#e8e0d0', '#c8a040'],
    use(p) { p.buffs.push({ flags: ['flight'], until: 'room', cosmetic: null, stats: { dmg: 0.5 } }); p.refresh(); } },
  loaded_die: { name: 'Loaded Die', tagline: 'reroll your destiny', type: 'active', pools: ['secret', 'shop', ...T], quality: 4, charge: 6, icon: ['die'],
    use() { let any = false; for (const pk of S.pickups) if (pk.alive && pk.kind === 'pedestal' && pk.itemId) { pk.itemId = S.run.drawItem(pk.pool || 'treasure'); setTex(pk.icon, itemIconTexLazy(pk.itemId)); poof(pk.x, pk.z, 0xe8dcc0, 0.8); any = true; } return any ? true : false; } },
  photo_album: { name: 'Photo Album', tagline: 'temporary invincibility', type: 'active', pools: ['library'], quality: 2, charge: 3, icon: ['photo'],
    use(p) { p.invuln = 5; } },
  book_of_grievances: { name: 'Book of Grievances', tagline: 'it hurts them all', type: 'active', pools: ['library', 'bargain'], quality: 3, charge: 4, icon: ['book', '#3a0a0a', '#c03030'],
    use() { for (const e of S.enemies) if (e.alive) e.hurt(40, { flags: {} }); addShake(0.6); audio.play('roar'); } },
  pogo_stick: { name: 'Pogo Stick', tagline: 'boing! somewhere else', type: 'active', pools: T, quality: 1, charge: 2, icon: ['shoe'],
    use() { const rooms = S.floor.rooms.filter((r) => r !== S.room && !r.offgrid && r.type !== 'secret' && r.type !== 'boss'); S.game.teleport(fxRng.pick(rooms)); } },
  fly_jar: { name: 'Fly Jar', tagline: 'release the friends', type: 'active', pools: T, quality: 2, charge: 2, icon: ['jar', '#2a2224', '#c0d0d8'],
    use(p) { for (let i = 0; i < 4; i++) S.game.spawnBlueFly(p.x, p.z); } },
  sippy_cup: { name: 'Sippy Cup', tagline: 'reusable health', type: 'active', pools: [...T, 'chapel'], quality: 2, charge: 4, icon: ['cup'],
    use(p) { if (p.red >= p.maxRed) return false; p.heal(2); audio.play('heart'); } },
  bean_can: { name: 'Bean Can', tagline: 'toot', type: 'active', pools: T, quality: 1, charge: 1, icon: ['can', '#a85a3a'],
    use(p) { for (const e of S.enemies) if (e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 3) e.hurt(5, { flags: { poison: 1 }, kx: (e.x - p.x) * 3, kz: (e.z - p.z) * 3 }); particles(p.x, p.z, { count: 14, kind: 'smoke', color: 0x8a7a3a, life: 0.9, size: 1, speed: 3 }); } },
  bottle_rocket: { name: 'Bottle Rocket', tagline: 'blow yourself up (safely)', type: 'active', pools: T, quality: 1, charge: 1, icon: ['rocket'],
    use(p) { S.game.explode(p.x, p.z, { radius: 1.9, damage: 40, hurtsPlayer: false }); } },
  tantrum: { name: 'Tantrum', tagline: 'damage up for the room', type: 'active', pools: ['library', 'bargain'], quality: 2, charge: 3, icon: ['fist'],
    use(p) { p.buffs.push({ stats: { dmg: 2 }, until: 'room', cosmetic: null }); p.refresh(); audio.play('roar'); } },
  piggy_hammer: { name: 'Piggy Hammer', tagline: 'smash and grab', type: 'active', pools: ['shop', ...T], quality: 1, charge: 3, icon: ['hammer'],
    use(p) { const n = fxRng.int(2, 5); for (let i = 0; i < n; i++) spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2.5 }); } },
  crystal_ball: { name: 'Crystal Ball', tagline: 'see everything', type: 'active', pools: ['library', 'shop'], quality: 2, charge: 6, icon: ['crystal'],
    use(p) { p.mapRevealed = true; revealSpecial(); spawnReward('card', p.x, p.z + 0.5, S.run.dropRng); } },
  bubble_wand: { name: 'Bubble Wand', tagline: 'everything slows down', type: 'active', pools: T, quality: 2, charge: 2, icon: ['wand'],
    use() { for (const e of S.enemies) if (e.alive) e.status.slow = 6; } },
  snow_globe: { name: 'Snow Globe', tagline: 'freeze!', type: 'active', pools: ['library', ...T], quality: 2, charge: 3, icon: ['globe'],
    use() { for (const e of S.enemies) if (e.alive && !e.isBoss) e.status.freeze = 4; for (const s of S.shots) s.pop(); } },
};
for (const [id, it] of Object.entries(ITEMS)) { it.id = id; it.type = it.type || 'passive'; it.quality = it.quality ?? 1; }

let iconFn = null;
export function setIconFn(fn) { iconFn = fn; }
function itemIconTexLazy(id) { return iconFn(id); }
function revealSpecial() { if (!S.floor) return; for (const r of S.floor.rooms) if (!r.offgrid && r.type !== 'normal' && r.type !== 'secret' && !r.seen) r.seen = 'adjacent'; }
function revealSecrets() { if (!S.floor) return; for (const r of S.floor.rooms) if (r.type === 'secret') r.seen = r.seen || 'adjacent'; }

// ============================================================================
//  Trinkets (one slot; Ctrl drops)
// ============================================================================
export const TRINKETS = {
  lucky_button: { name: 'Lucky Button', tagline: 'luck up', icon: ['button'], stats: { luck: 1 } },
  swallowed_penny: { name: 'Swallowed Penny', tagline: 'getting hurt pays', icon: ['coin', '#c8823a'], hooks: { onHurt(p) { spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2 }); } } },
  cracked_tooth: { name: 'Cracked Tooth', tagline: 'damage up', icon: ['tooth', '#d8c8a0'], stats: { dmg: 0.4 } },
  doll_arm: { name: 'Doll Arm', tagline: 'range up', icon: ['arm'], stats: { range: 1.5 } },
  bottle_cap: { name: 'Bottle Cap', tagline: 'tears up, shot speed up', icon: ['cap'], stats: { tears: 0.25, shotSpeed: 0.15 } },
  pocket_lint: { name: 'Pocket Lint', tagline: 'something soft for later', icon: ['lint'], hooks: { onFloorStart(p) { if (fxRng.chance(0.5)) p.addSoul(2); } } },
  gran_hairpin: { name: "Gran's Hairpin", tagline: 'extra charge', icon: ['hairpin'], hooks: { onRoomClear(p) { S.game.chargeActive(p, 1); } } },
  fish_hook: { name: 'Fish Hook', tagline: 'tears curve toward prey', icon: ['hook'], hooks: { modifyTear(t, p) { if (fxRng.chance(0.25)) t.flags.homing = 1; } } },
  burnt_match: { name: 'Burnt Match', tagline: 'sometimes they catch', icon: ['matchbook', '#3a2a2a'], hooks: { modifyTear: statusChance('burn', TEAR_COLORS.burn, 0.1, 0.02) } },
  glass_marble: { name: 'Glass Marble', tagline: 'tears bounce', icon: ['marble', '#a0e0d0', '#ffffff'], flags: ['bounce'] },
  blue_thread: { name: 'Blue Thread', tagline: 'secrets reveal themselves', icon: ['needle', '#4a6ae8'], hooks: { onFloorStart() { revealSecrets(); } } },
  wishbone: { name: 'Wishbone', tagline: 'speed up, luck up', icon: ['bone'], stats: { speed: 0.15, luck: 1 } },
  tiny_bell: { name: 'Tiny Bell', tagline: 'shot speed up', icon: ['bell'], stats: { shotSpeed: 0.3 } },
  paper_crown: { name: 'Paper Crown', tagline: 'all stats up a little', icon: ['crown', '#e8d8a0'], stats: { dmg: 0.2, tears: 0.15, speed: 0.05, range: 0.4, luck: 0.5 }, cosmetic: { hat: 'crown', hatColor: '#e8d8a0' } },
};
for (const [id, it] of Object.entries(TRINKETS)) it.id = id;
