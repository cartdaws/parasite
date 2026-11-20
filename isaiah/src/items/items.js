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
  gran_thimble: { name: "Grandma's Thimble", tagline: "a tiny helmet. damage up", pools: [...T, 'boss'], quality: 2, icon: ['thimble'], stats: { dmg: 1 }, cosmetic: { hat: 'thimble' } },
  pepper_jar: { name: "Hot Sauce", tagline: "damage up. your eyes are watering", pools: [...T, 'boss'], quality: 1, icon: ['bottle', '#d8301a', '#e8d8c8'], stats: { dmg: 0.7, tears: 0.2 }, tearColor: 0xe8a0a0 },
  iron_kettle: { name: "Cast Iron Skillet", tagline: "heavy hitter", pools: ['boss', ...T], quality: 2, icon: ['skillet'], stats: { dmg: 1.6, speed: -0.15 } },
  angry_sock: { name: "Gym Sock", tagline: "it smells like victory", pools: T, quality: 1, icon: ['sock'], stats: { dmg: 0.5, speed: 0.2 } },
  bloodshot: { name: "Bloodshot Eye", tagline: "you pulled an all-nighter", pools: [...T, 'bargain'], quality: 3, icon: ['eye'], stats: { dmgMult: 1.5, tears: -0.4 }, tearColor: 0xd04040, cosmetic: { eyeColor: '#c02020' } },
  cousins_slingshot: { name: "Slingshot", tagline: "your cousin wants it back", pools: T, quality: 2, icon: ['slingshot'], stats: { dmg: 0.5, range: 1.5, shotSpeed: 0.2 } },
  onion_skin: { name: "Raw Onion", tagline: "it always makes you cry", pools: [...T, 'boss'], quality: 2, icon: ['onion'], stats: { tears: 0.7 } },
  salt_lick: { name: "Salt Shaker", tagline: "tears up, range up", pools: ['boss', ...T], quality: 1, icon: ['salt'], stats: { tears: 0.4, range: 1.2 } },
  crybaby_bib: { name: "Baby Bib", tagline: "waaaah!", pools: T, quality: 2, icon: ['bib'], stats: { tears: 1.0, range: -0.8 } },
  sugar_cube: { name: "Sugar Rush", tagline: "speed up!", pools: ['boss', 'shop'], quality: 1, icon: ['candy'], stats: { speed: 0.3 }, onPickup(p) { p.addContainers(1); } },
  liver_pie: { name: "Meatloaf", tagline: "health up. it's Tuesday", pools: ['boss', ...T], quality: 1, icon: ['loaf'], onPickup(p) { p.addContainers(1); p.heal(2); } },
  stuffed_heart: { name: "Big Heart", tagline: "health up, a lot", pools: ['boss'], quality: 2, icon: ['heart', '#c81e1e'], stats: { range: 0.5 }, onPickup(p) { p.addContainers(2); p.heal(99); } },
  breakfast: { name: "Pancakes", tagline: "health up", pools: ['boss'], quality: 0, icon: ['pancakes'], onPickup(p) { p.addContainers(1); p.heal(2); }, noPool: true },
  lucky_foot: { name: "Rabbit's Foot", tagline: "luck up", pools: [...T, 'shop'], quality: 1, icon: ['leaf'], stats: { luck: 2 } },
  cold_supper: { name: "Leftover Casserole", tagline: "health up, full belly", pools: ['boss', 'shop'], quality: 1, icon: ['plate', '#d8d8e8'], onPickup(p) { p.addContainers(1); p.heal(99); } },
  goat_skull: { name: "Goat Skull", tagline: "it whispers numbers", pools: ['bargain'], quality: 3, icon: ['skull'], stats: { dmg: 2, speed: 0.1 }, cosmetic: { horns: '#3a0a0a' } },
  chalk_circle: { name: "Spirit Board", tagline: "damage up. don't ask it questions", pools: ['bargain'], quality: 3, icon: ['board'], stats: { dmg: 1.5 } },
  black_bile: { name: "Black Licorice", tagline: "nobody likes it. black hearts", pools: ['bargain'], quality: 2, icon: ['straw', '#2a1a22', '#4a3a42'], stats: { dmg: 0.5 }, onPickup(p) { p.addSoul(4, 'b'); } },
  goat_horns: { name: "Devil Horns", tagline: "speed and spite", pools: ['bargain'], quality: 2, icon: ['horns'], stats: { dmg: 1, speed: 0.3 }, cosmetic: { horns: '#4a0a0a' } },
  holy_water: { name: "Holy Water", tagline: "blessed tears", pools: ['chapel'], quality: 3, icon: ['bottle', '#f0f0c0'], stats: { tears: 0.7, dmg: 0.4 }, flags: ['piercing'], tearColor: TEAR_COLORS.holy },
  rust_rosary: { name: "Grandma's Rosary", tagline: "say a little prayer", pools: ['chapel', ...T], quality: 2, icon: ['rosary'], stats: { tears: 0.5 }, onPickup(p) { p.addSoul(2); }, cosmetic: { rosary: true } },
  // ---------------- tear modifiers ----------------
  bent_fork: { name: "Bent Fork", tagline: "homing tears", pools: T, quality: 3, icon: ['fork'], flags: ['homing'], cosmetic: { eyeColor: '#8a3ab0' } },
  dowsing_rod: { name: "Divining Rod", tagline: "it finds what you need", pools: ['shop', ...T], quality: 2, icon: ['rod'], flags: ['homing'], stats: { range: 1.5, tears: -0.2 } },
  knitting_needle: { name: "Knitting Needle", tagline: "piercing tears", pools: T, quality: 2, icon: ['needle'], flags: ['piercing'], stats: { shotSpeed: 0.2 } },
  cracked_marble: { name: "Cracked Marble", tagline: "tears split on impact", pools: T, quality: 2, icon: ['marble'], flags: ['split'] },
  third_eye_patch: { name: "Third Eye", tagline: "triple shot", pools: T, quality: 3, icon: ['eyepatch'], extraShots: 2, cosmetic: { thirdEye: true } },
  four_leaf_spider: { name: "Spider Eyes", tagline: "quad shot", pools: [...T, 'bargain'], quality: 3, icon: ['spider'], extraShots: 3, stats: { tears: -0.3 }, cosmetic: { extraEyes: true } },
  twin_straw: { name: "Crazy Straw", tagline: "double shot", pools: T, quality: 2, icon: ['straw'], extraShots: 1, spread: 'parallel' },
  swamp_water: { name: "Swamp Water", tagline: "poison tears", pools: T, quality: 2, icon: ['bottle', '#6a9a2a'], flags: ['poison'], tearColor: TEAR_COLORS.poison, cosmetic: { skin: '#b8c8a0' } },
  wet_matchbook: { name: "Book of Matches", tagline: "sometimes they catch", pools: T, quality: 1, icon: ['matchbook'], stats: { dmg: 0.3 }, hooks: { modifyTear: statusChance('burn', TEAR_COLORS.burn, 0.2, 0.04) } },
  molasses: { name: "Maple Syrup", tagline: "sticky, slowing tears", pools: T, quality: 1, icon: ['bottle', '#a8601a', '#e0c890'], flags: ['slow'], tearColor: TEAR_COLORS.slow, stats: { tears: 0.2 } },
  scary_story: { name: "Campfire Story", tagline: "now they're scared", pools: T, quality: 2, icon: ['book', '#3a2a4a', '#8a3ab0'], hooks: { modifyTear: statusChance('fear', TEAR_COLORS.fear, 0.18, 0.04) } },
  love_letter: { name: "Valentine", tagline: "charming tears", pools: [...T, 'chapel'], quality: 2, icon: ['letter'], hooks: { modifyTear: statusChance('charm', TEAR_COLORS.charm, 0.18, 0.04) } },
  ice_tray: { name: "Ice Pop", tagline: "brain-freeze tears", pools: T, quality: 2, icon: ['icepop'], hooks: { modifyTear: statusChance('freeze', 0xb0e8ff, 0.14, 0.04) } },
  rubber_ball: { name: "Bouncy Ball", tagline: "boing!", pools: T, quality: 1, icon: ['ball'], flags: ['bounce'], stats: { range: 1 } },
  bendy_straw: { name: "Gummy Worm", tagline: "wiggly tears, tears up", pools: T, quality: 2, icon: ['worm', '#f05a8a'], flags: ['wiggle'], stats: { tears: 0.4 } },
  sour_ball: { name: "Firecracker", tagline: "explosive tears", pools: ['bargain', ...T], quality: 3, icon: ['firecracker'], flags: ['explosive'], stats: { tears: -0.5 }, tearColor: 0xd8e040 },
  feather_quill: { name: "Angel Feather", tagline: "tears pass through rocks", pools: ['chapel', ...T], quality: 2, icon: ['feather'], flags: ['spectral'], stats: { tears: 0.3 }, tearColor: 0xe8e8ff },
  sacred_thread: { name: "Guardian Angel", tagline: "someone's looking out for you", pools: ['chapel'], quality: 4, icon: ['halo'], flags: ['homing'], stats: { dmg: 1, dmgMult: 1.2 }, tearColor: TEAR_COLORS.holy, cosmetic: { halo: true } },
  spoiled_milk_tooth: { name: "Baby Tooth", tagline: "the tooth fairy never came", pools: T, quality: 2, icon: ['tooth'], tearStyle: 'tooth', stats: { dmgFlat: 1.4, tears: -0.3 }, tearColor: 0xe8dcc0 },
  big_bones: { name: "Growth Spurt", tagline: "you got bigger", pools: T, quality: 2, icon: ['ruler'], stats: { dmg: 1, speed: -0.15 }, size: 1.25, tearScale: 1.3 },
  shrinking_draught: { name: "Shrink Ray", tagline: "you got smaller", pools: T, quality: 2, icon: ['raygun'], stats: { speed: 0.2, range: 0.5 }, size: 0.75 },
  junk_drawer: { name: "Junk Drawer", tagline: "you never know what you'll get", pools: T, quality: 2, icon: ['drawer'],
    hooks: { modifyTear(t) { const opts = [['homing', TEAR_COLORS.homing], ['piercing', 0xffffff], ['poison', TEAR_COLORS.poison], ['slow', TEAR_COLORS.slow], ['fear', TEAR_COLORS.fear], ['charm', TEAR_COLORS.charm], ['burn', TEAR_COLORS.burn], ['split', 0xc0c0ff], ['bounce', 0xffe0a0], ['wiggle', 0xa0ffa0]]; const [f, c] = fxRng.pick(opts); t.flags[f] = 1; t.color = c; } } },
  kaleidoscope: { name: "Kaleidoscope", tagline: "everything, all at once", pools: ['secret', ...T], quality: 3, icon: ['kaleido'],
    hooks: { modifyTear(t) { t.dmg *= fxRng.range(0.6, 2.2); t.scale *= fxRng.range(0.7, 1.6); t.color = Math.floor(fxRng.next() * 0xffffff) | 0x404040; t.spr.scale.set(0.5 * t.scale, 0.5 * t.scale, 1); if (fxRng.chance(0.3)) t.flags.homing = 1; } } },
  magic_eight_ball: { name: "Magic 8 Ball", tagline: "ask again later", pools: T, quality: 1, icon: ['ball8'],
    onPickup(p) { p.eightBall = { dmg: fxRng.range(-0.3, 1.2), tears: fxRng.range(-0.3, 0.8), speed: fxRng.range(-0.1, 0.25), range: fxRng.range(-1, 2), luck: fxRng.int(-1, 2) }; },
    dynamicStats(p) { return p.eightBall || {}; } },
  // ---------------- weapons ----------------
  grans_bloodline: { name: "Bad Blood", tagline: "it runs in the family", pools: ['bargain', ...T], quality: 4, icon: ['blood', '#c01010'], weapon: 'laser', stats: { dmg: 0.5 }, cosmetic: { blood: true } },
  tin_can_phone: { name: "Walkie-Talkie", tagline: "come in, over", pools: T, quality: 3, icon: ['walkie'], weapon: 'tech', stats: { tears: 0.2 } },
  spitball_straw: { name: "Spitball Straw", tagline: "hold to charge", pools: T, quality: 3, icon: ['straw', '#4a8ae8', '#f0f0f0'], weapon: 'charged', stats: { dmg: 0.3 } },
  // ---------------- familiars ----------------
  cellar_moth: { name: "Porch Moth", tagline: "drawn to the light", pools: T, quality: 2, icon: ['moth'], familiars: ['moth'] },
  choir_of_flies: { name: "Fly Choir", tagline: "they sing when you cry", pools: [...T, 'bargain'], quality: 2, icon: ['flies'], familiars: ['choirfly', 'choirfly', 'choirfly'], cosmetic: { flies: true } },
  lint_ball: { name: "Dryer Lint", tagline: "fuzzy bodyguard", pools: ['shop', ...T], quality: 1, icon: ['lint'], familiars: ['lint'] },
  paper_doll: { name: "Paper Doll", tagline: "a friend who cries with you", pools: T, quality: 2, icon: ['doll'], familiars: ['doll'] },
  sock_puppet: { name: "Sock Puppet", tagline: "it bites back", pools: ['shop', ...T], quality: 2, icon: ['puppet'], familiars: ['puppet'] },
  dust_bunny: { name: "Dust Bunny", tagline: "it hunts", pools: T, quality: 2, icon: ['bunny'], familiars: ['bunny'] },
  severed_finger: { name: "Severed Finger", tagline: "it points at the guilty", pools: ['bargain'], quality: 3, icon: ['arm', '#c8a890'], familiars: ['finger'] },
  // ---------------- flight / survival ----------------
  dandelion_wish: { name: "Dandelion", tagline: "make a wish. flight", pools: [...T, 'chapel'], quality: 3, icon: ['dandelion'], flags: ['flight'], cosmetic: { wings: '#f0f0f0' } },
  moth_wings: { name: "Moth Wings", tagline: "flight, tears up", pools: ['chapel', 'bargain'], quality: 3, icon: ['wings', '#c8b890'], flags: ['flight'], stats: { tears: 0.3 }, cosmetic: { wings: '#c8b890', antennae: true } },
  cats_collar: { name: "Cat's Collar", tagline: "one more life", pools: ['secret', ...T], quality: 4, icon: ['collar'],
    extraLife(p) { p.maxRed = Math.max(2, p.maxRed - 2); p.red = Math.min(p.maxRed, 2); } },
  grandpas_ghost: { name: "Grandpa's Ghost", tagline: "he's still watching over you", pools: ['chapel', 'secret'], quality: 3, icon: ['ghost'],
    extraLife(p) { p.maxRed = 0; p.red = 0; p.soul = ['s', 's', 's', 's']; p.items.push('dandelion_wish'); p.refresh(); } },
  paper_halo: { name: "Tinfoil Halo", tagline: "blocks one hit each room", pools: ['chapel'], quality: 4, icon: ['halo', '#d8d8e0'], cosmetic: { halo: true },
    onPickup(p) { p.holyShield = true; }, hooks: { onRoomEnter(p) { if (!S.room.cleared) p.holyShield = true; } } },
  candle_stub: { name: "Birthday Candle", tagline: "make a wish. luck up", pools: ['shop'], quality: 1, icon: ['candle', '#f08ab0'], stats: { luck: 1 }, cosmetic: { hat: 'candle' } },
  bandage_roll: { name: "Bandages", tagline: "soul hearts up", pools: [...T, 'shop'], quality: 1, icon: ['scroll', '#f0e8d8'], onPickup(p) { p.addSoul(4); } },
  // ---------------- economy / bombs / keys ----------------
  bad_penny: { name: "Lucky Penny", tagline: "found it heads up", pools: T, quality: 1, icon: ['coin', '#7a5a2a'], stats: { luck: 1 },
    hooks: { onRoomClear(p, room) { if (fxRng.chance(0.3)) spawnReward('coin', room.W / 2, room.H / 2, S.run.dropRng); } } },
  piggy_bank: { name: "Piggy Bank", tagline: "it rattles when you get hurt", pools: ['shop', ...T], quality: 1, icon: ['bag', '#e8a0b0'],
    onPickup(p) { p.coins = Math.min(99, p.coins + 3); }, hooks: { onHurt(p) { if (fxRng.chance(0.6)) spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2.5 }); } } },
  coupon: { name: "Coupon Book", tagline: "everything half off", pools: ['shop', 'secret'], quality: 2, icon: ['scroll', '#f0e040'] },
  skeleton_key: { name: "Skeleton Key", tagline: "every door is yours", pools: ['secret', 'shop'], quality: 3, icon: ['key'], onPickup(p) { p.keys = Math.min(99, p.keys + 3); } },
  bottomless_bag: { name: "Bottomless Backpack", tagline: "infinite bombs", pools: ['secret', 'bargain'], quality: 4, icon: ['backpack'] },
  firework_crate: { name: "Fourth of July", tagline: "bigger booms, +5 bombs", pools: [...T, 'shop'], quality: 2, icon: ['firework'], flags: ['bigBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  remote_doorbell: { name: "Garage Door Opener", tagline: "press bomb again to blow them", pools: ['shop', ...T], quality: 2, icon: ['remote'], flags: ['remoteBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  gum_wad: { name: "Chewed Gum", tagline: "sticky bombs, +5 bombs", pools: [...T, 'shop'], quality: 1, icon: ['gum'], flags: ['stickyBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  bloodhound_bomb: { name: "Bloodhound Bombs", tagline: "homing bombs, +5 bombs", pools: T, quality: 2, icon: ['rocket', '#6a3a8a'], flags: ['homingBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  rotten_egg: { name: "Rotten Egg", tagline: "poison bombs, +5 bombs", pools: T, quality: 1, icon: ['egg'], flags: ['poisonBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  scatter_seeds: { name: "Popcorn", tagline: "bombs pop into baby bombs", pools: T, quality: 2, icon: ['popcorn'], flags: ['scatterBombs'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 5); } },
  blast_apron: { name: "Welding Apron", tagline: "explosion proof, +3 bombs", pools: ['shop', ...T], quality: 2, icon: ['apron'], onPickup(p) { p.bombs = Math.min(99, p.bombs + 3); } },
  // ---------------- maps ----------------
  crayon_map: { name: "Crayon Map", tagline: "floor revealed", pools: ['shop', ...T], quality: 1, icon: ['map'],
    onPickup(p) { p.mapRevealed = true; }, hooks: { onFloorStart(p) { p.mapRevealed = true; } } },
  compass_shell: { name: "Compass", tagline: "special rooms revealed", pools: ['shop', ...T], quality: 1, icon: ['compass'],
    onPickup() { revealSpecial(); }, hooks: { onFloorStart() { revealSpecial(); } } },
  lantern_bug: { name: "Lightning Bug", tagline: "secrets light up", pools: ['secret', 'shop'], quality: 1, icon: ['bug'],
    onPickup(p) { p.secretsRevealed = true; revealSecrets(); }, hooks: { onFloorStart() { revealSecrets(); } } },

  // ================= ACTIVE ITEMS =================
  hymnal: { name: "Hymn Book", tagline: "temporary flight", type: 'active', pools: ['library', 'chapel'], quality: 2, charge: 3, icon: ['book', '#e8e0d0', '#c8a040'],
    use(p) { p.buffs.push({ flags: ['flight'], until: 'room', cosmetic: null, stats: { dmg: 0.5 } }); p.refresh(); } },
  loaded_die: { name: "Loaded Die", tagline: "reroll your luck", type: 'active', pools: ['secret', 'shop', ...T], quality: 4, charge: 6, icon: ['die'],
    use() { let any = false; for (const pk of S.pickups) if (pk.alive && pk.kind === 'pedestal' && pk.itemId) { pk.itemId = S.run.drawItem(pk.pool || 'treasure'); setTex(pk.icon, itemIconTexLazy(pk.itemId)); poof(pk.x, pk.z, 0xe8dcc0, 0.8); any = true; } return any ? true : false; } },
  photo_album: { name: "Family Photo Album", tagline: "temporary invincibility", type: 'active', pools: ['library'], quality: 2, charge: 3, icon: ['photo'],
    use(p) { p.invuln = 5; } },
  book_of_grievances: { name: "Book of Grudges", tagline: "it hurts them all", type: 'active', pools: ['library', 'bargain'], quality: 3, charge: 4, icon: ['book', '#3a0a0a', '#c03030'],
    use() { for (const e of S.enemies) if (e.alive) e.hurt(40, { flags: {} }); addShake(0.6); audio.play('roar'); } },
  pogo_stick: { name: "Pogo Stick", tagline: "boing! somewhere else", type: 'active', pools: T, quality: 1, charge: 2, icon: ['shoe'],
    use() { const rooms = S.floor.rooms.filter((r) => r !== S.room && !r.offgrid && r.type !== 'secret' && r.type !== 'boss'); S.game.teleport(fxRng.pick(rooms)); } },
  fly_jar: { name: "Jar of Flies", tagline: "let them out", type: 'active', pools: T, quality: 2, charge: 2, icon: ['jar', '#2a2224', '#c0d0d8'],
    use(p) { for (let i = 0; i < 4; i++) S.game.spawnBlueFly(p.x, p.z); } },
  sippy_cup: { name: "Sippy Cup", tagline: "reusable health", type: 'active', pools: [...T, 'chapel'], quality: 2, charge: 4, icon: ['cup'],
    use(p) { if (p.red >= p.maxRed) return false; p.heal(2); audio.play('heart'); } },
  bean_can: { name: "Can of Beans", tagline: "toot", type: 'active', pools: T, quality: 1, charge: 1, icon: ['can', '#a85a3a'],
    use(p) { for (const e of S.enemies) if (e.alive && Math.hypot(e.x - p.x, e.z - p.z) < 3) e.hurt(5, { flags: { poison: 1 }, kx: (e.x - p.x) * 3, kz: (e.z - p.z) * 3 }); particles(p.x, p.z, { count: 14, kind: 'smoke', color: 0x8a7a3a, life: 0.9, size: 1, speed: 3 }); } },
  bottle_rocket: { name: "Bottle Rocket", tagline: "blow yourself up (safely)", type: 'active', pools: T, quality: 1, charge: 1, icon: ['rocket'],
    use(p) { S.game.explode(p.x, p.z, { radius: 1.9, damage: 40, hurtsPlayer: false }); } },
  tantrum: { name: "Tantrum", tagline: "damage up for the room", type: 'active', pools: ['library', 'bargain'], quality: 2, charge: 3, icon: ['fist'],
    use(p) { p.buffs.push({ stats: { dmg: 2 }, until: 'room', cosmetic: null }); p.refresh(); audio.play('roar'); } },
  piggy_hammer: { name: "Hammer", tagline: "smash the piggy bank", type: 'active', pools: ['shop', ...T], quality: 1, charge: 3, icon: ['hammer'],
    use(p) { const n = fxRng.int(2, 5); for (let i = 0; i < n; i++) spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2.5 }); } },
  crystal_ball: { name: "Crystal Ball", tagline: "see everything", type: 'active', pools: ['library', 'shop'], quality: 2, charge: 6, icon: ['crystal'],
    use(p) { p.mapRevealed = true; revealSpecial(); spawnReward('card', p.x, p.z + 0.5, S.run.dropRng); } },
  bubble_wand: { name: "Bubble Wand", tagline: "everything slows down", type: 'active', pools: T, quality: 2, charge: 2, icon: ['wand'],
    use() { for (const e of S.enemies) if (e.alive) e.status.slow = 6; } },
  snow_globe: { name: "Snow Globe", tagline: "freeze!", type: 'active', pools: ['library', ...T], quality: 2, charge: 3, icon: ['globe'],
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
  lucky_button: { name: "Lucky Button", tagline: "luck up", icon: ['button'], stats: { luck: 1 } },
  swallowed_penny: { name: "Swallowed Penny", tagline: "getting hurt pays", icon: ['coin', '#c8823a'], hooks: { onHurt(p) { spawnReward('coin', p.x, p.z, S.run.dropRng, { spread: 2 }); } } },
  cracked_tooth: { name: "Chipped Tooth", tagline: "damage up", icon: ['tooth', '#d8c8a0'], stats: { dmg: 0.4 } },
  doll_arm: { name: "Action Figure Arm", tagline: "range up", icon: ['arm'], stats: { range: 1.5 } },
  bottle_cap: { name: "Soda Cap", tagline: "tears up, shot speed up", icon: ['cap'], stats: { tears: 0.25, shotSpeed: 0.15 } },
  pocket_lint: { name: "Pocket Lint", tagline: "something soft for later", icon: ['lint'], hooks: { onFloorStart(p) { if (fxRng.chance(0.5)) p.addSoul(2); } } },
  gran_hairpin: { name: "Grandma's Bobby Pin", tagline: "extra charge", icon: ['hairpin'], hooks: { onRoomClear(p) { S.game.chargeActive(p, 1); } } },
  fish_hook: { name: "Fish Hook", tagline: "tears curve toward prey", icon: ['hook'], hooks: { modifyTear(t, p) { if (fxRng.chance(0.25)) t.flags.homing = 1; } } },
  burnt_match: { name: "Burnt Match", tagline: "sometimes they catch", icon: ['matchbook', '#3a2a2a'], hooks: { modifyTear: statusChance('burn', TEAR_COLORS.burn, 0.1, 0.02) } },
  glass_marble: { name: "Shooter Marble", tagline: "tears bounce", icon: ['marble', '#a0e0d0', '#ffffff'], flags: ['bounce'] },
  blue_thread: { name: "Blue Yarn", tagline: "secrets show themselves", icon: ['needle', '#4a6ae8'], hooks: { onFloorStart() { revealSecrets(); } } },
  wishbone: { name: "Wishbone", tagline: "speed up, luck up", icon: ['bone'], stats: { speed: 0.15, luck: 1 } },
  tiny_bell: { name: "Bike Bell", tagline: "shot speed up", icon: ['bell'], stats: { shotSpeed: 0.3 } },
  paper_crown: { name: "Paper Crown", tagline: "all stats up a little", icon: ['crown', '#e8d8a0'], stats: { dmg: 0.2, tears: 0.15, speed: 0.05, range: 0.4, luck: 0.5 }, cosmetic: { hat: 'crown', hatColor: '#e8d8a0' } },
};
for (const [id, it] of Object.entries(TRINKETS)) it.id = id;
