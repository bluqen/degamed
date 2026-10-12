/**
 * Auto-tiling for the Tilemap component (Phaser-free so it can be unit-tested).
 * '#' = solid terrain, '=' = one-way platform, '+' = background wall, anything else = empty.
 */
import type { Rect } from './atmosphere-math';

export const TILE_ROLES = [
  'ground',
  'ground2',
  'ground3',
  'groundLeft',
  'groundRight',
  'fill',
  'fill2',
  'fillLeft',
  'fillRight',
  'ceiling',
  'platform',
  'platformLeft',
  'platformRight',
  'back',
] as const;
export type TileRole = (typeof TILE_ROLES)[number];

const hash = (x: number, y: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) % 100;
};

/** Picks a tile role for every cell. `has` says which optional roles the tileset provides. */
export function autotile(rows: readonly string[], has: (role: TileRole) => boolean): (TileRole | null)[][] {
  const H = rows.length;
  const at = (x: number, y: number) => {
    if (y < 0) return '.';
    if (y >= H) return '#';
    const row = rows[y]!;
    if (x < 0 || x >= row.length) return row[Math.max(0, Math.min(row.length - 1, x))] === '#' ? '#' : '.';
    return row[x]!;
  };
  const solid = (x: number, y: number) => at(x, y) === '#';
  const pick = (base: TileRole, x: number, y: number, variants: TileRole[]): TileRole => {
    const avail = variants.filter(has);
    if (!avail.length) return base;
    const r = hash(x, y);
    // Mostly the base tile, with the occasional variant so long runs don't look stamped.
    return r < 60 ? base : avail[r % avail.length]!;
  };
  return rows.map((row, y) =>
    [...row].map((ch, x): TileRole | null => {
      if (ch === '#') {
        const up = solid(x, y - 1);
        const left = solid(x - 1, y);
        const right = solid(x + 1, y);
        if (!up) {
          if (!left && has('groundLeft')) return 'groundLeft';
          if (!right && has('groundRight')) return 'groundRight';
          return pick('ground', x, y, ['ground2', 'ground3']);
        }
        if (!solid(x, y + 1) && has('ceiling')) return 'ceiling';
        if (!left && has('fillLeft')) return 'fillLeft';
        if (!right && has('fillRight')) return 'fillRight';
        return pick('fill', x, y, ['fill2']);
      }
      if (ch === '=') {
        const l = at(x - 1, y) === '=';
        const r = at(x + 1, y) === '=';
        if (!l && has('platformLeft')) return 'platformLeft';
        if (!r && has('platformRight')) return 'platformRight';
        return has('platform') ? 'platform' : 'ground';
      }
      if (ch === '+') return 'back';
      return null;
    }),
  );
}

/** Top surfaces you can stand on (rain splashes, decoration), in world pixels. */
export function tileSurfaces(rows: readonly string[], tileSize: number, ox = 0, oy = 0): Rect[] {
  const out: Rect[] = [];
  rows.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const ch = row[x];
      const top = (ch === '#' || ch === '=') && (y === 0 || !['#', '='].includes(rows[y - 1]?.[x] ?? '.'));
      if (top && start < 0) start = x;
      if (!top && start >= 0) {
        out.push({ x: ox + start * tileSize, y: oy + y * tileSize, width: (x - start) * tileSize, height: tileSize });
        start = -1;
      }
    }
  });
  return out;
}
