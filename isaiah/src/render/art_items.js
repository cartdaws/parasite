// Item / trinket / card icons (placeholder until the items phase).
import { tex, blob } from './draw.js';
export function itemIconTex(id) { return tex('item:' + id, 64, 64, (ctx, w, h, rng) => blob(ctx, 32, 32, 18, 18, '#c9a13a', rng)); }
export function trinketIconTex(id) { return tex('trinket:' + id, 48, 48, (ctx, w, h, rng) => blob(ctx, 24, 24, 12, 12, '#8a8a8a', rng)); }
export function cardTex(id) { return tex('card:' + id, 48, 64, (ctx, w, h, rng) => blob(ctx, 24, 32, 16, 24, '#e8dcc0', rng)); }
