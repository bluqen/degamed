import type { ProjectFiles } from '@degamed/shared';
import { buildGame } from '../kits';
import type { Encoder } from '../kits/types';

export type { Encoder } from '../kits/types';

/**
 * The starter project: the platformer kit on the default art theme. Kept for the editor's
 * "new project" flow; new code should call `buildGame` from `@degamed/engine/kits`.
 */
export function createPlatformerTemplate(encode: Encoder, title = 'Starter Platformer'): ProjectFiles {
  return buildGame({ kit: 'platformer', title, theme: '', seed: 1, params: { length: 6 } }, encode);
}
