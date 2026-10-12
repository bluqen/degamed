/**
 * Stand-in for `@degamed/engine/kits` until it lands: one platformer kit built on the starter
 * template, with real, working params and theme switching. Same shapes as the contract.
 */
import { createPlatformerTemplate } from '@degamed/engine/templates';
import { stubThemes } from './stub-themes';
import type { Encoder, GameSpec, Kit, ProjectFiles } from './types';

const SPEC_PATH = 'game.spec.json';

export const STUB_KITS: Kit[] = [
  {
    id: 'platformer',
    name: 'Platformer',
    description: 'Run, jump and collect things on the way to the flag.',
    keywords: ['platformer', 'jump', 'mario', 'run', 'adventure', 'level'],
    params: [
      { key: 'speed', label: 'Run speed', type: 'number', min: 80, max: 280, step: 10, default: 150, group: 'Movement' },
      { key: 'jump', label: 'Jump height', type: 'number', min: 200, max: 520, step: 10, default: 330, group: 'Movement' },
      { key: 'gravity', label: 'Gravity', type: 'number', min: 400, max: 1600, step: 50, default: 900, group: 'Movement' },
      { key: 'enemies', label: 'Enemies', type: 'boolean', default: true, group: 'Challenge' },
      { key: 'difficulty', label: 'Difficulty', type: 'choice', choices: ['relaxed', 'normal', 'tricky'], default: 'normal', group: 'Challenge' },
      { key: 'coins', label: 'Coins to collect', type: 'boolean', default: true, group: 'Level' },
    ],
  },
];

type Ent = { id: string; tags?: string[]; components: Record<string, Record<string, unknown> | undefined> };

export function stubBuildGame(spec: GameSpec, encode: Encoder): ProjectFiles {
  const kit = STUB_KITS.find((k) => k.id === spec.kit) ?? STUB_KITS[0]!;
  const p: Record<string, number | boolean | string> = Object.fromEntries(kit.params.map((x) => [x.key, x.default]));
  Object.assign(p, spec.params ?? {});
  const files = createPlatformerTemplate(encode, spec.title || 'My game');

  const themes = stubThemes();
  const theme = themes.find((t) => t.id === spec.theme) ?? themes[0]!;
  const layerFiles = ['assets/backgrounds/sky.png', 'assets/backgrounds/mountains.png', 'assets/backgrounds/hills.png'];
  theme.layers.forEach((l, i) => {
    if (layerFiles[i]) files[layerFiles[i]] = encode(l.raster);
  });
  files['assets/tiles/grass.png'] = encode(theme.tiles.ground);
  files['assets/tiles/dirt.png'] = encode(theme.tiles.fill);

  const manifest = JSON.parse(files['project.json']!) as { physics: { gravity: { y: number } }; title: string };
  manifest.physics.gravity.y = Number(p.gravity);
  files['project.json'] = JSON.stringify(manifest, null, 2);

  const scenePath = 'scenes/main.scene.json';
  const scene = JSON.parse(files[scenePath]!) as { background?: string; entities: Ent[] };
  scene.background = theme.background;
  const enemySpeed = p.difficulty === 'relaxed' ? 18 : p.difficulty === 'tricky' ? 55 : 30;
  scene.entities = scene.entities.filter((e) => (p.enemies ? true : !e.tags?.includes('enemy')) && (p.coins ? true : !e.tags?.includes('coin')));
  for (const e of scene.entities) {
    const s = e.components.Script as { src: string; props?: Record<string, unknown> } | undefined;
    if (s?.src === 'scripts/player.js') s.props = { ...s.props, speed: Number(p.speed), jump: Number(p.jump) };
    if (s?.src === 'scripts/slime.js') s.props = { ...s.props, speed: enemySpeed };
  }
  files[scenePath] = JSON.stringify(scene, null, 2);
  files[SPEC_PATH] = JSON.stringify({ ...spec, kit: kit.id, theme: theme.id, params: p }, null, 2);
  return files;
}

export function stubReadSpec(files: ProjectFiles): GameSpec | null {
  try {
    const raw = files[SPEC_PATH];
    if (!raw) return null;
    const spec = JSON.parse(raw) as GameSpec;
    return typeof spec.kit === 'string' && typeof spec.theme === 'string' ? spec : null;
  } catch {
    return null;
  }
}
