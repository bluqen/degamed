/**
 * @degamed/ai: describe a game → play it → change it by chatting.
 *
 * The model writes a small GameSpec (kit, theme, params, title, story), never thousands of lines
 * of code, so every call costs a few hundred tokens. `instant` mode needs no AI at all.
 */
export type { Encoder } from '@degamed/engine/templates';
export type { ProjectFiles } from '@degamed/shared';

export { createGame, editGame, repairFromErrors, setAiLogger, type Progress, type CreateResult, type EditResult, type RepairResult, type AiLogger } from './game';
export { suggestions } from './suggest';
export {
  availableProviders,
  runnerFor,
  geminiModel,
  openaiModel,
  anthropicModel,
  degamedRunner,
  ProviderError,
  DEFAULT_MODELS,
  PROVIDER_LABELS,
  type ProviderId,
  type AiSettings,
  type TaskRunner,
} from './providers';
export {
  LIMITS,
  AiOutputError,
  estimateTokens,
  type ChatTurn,
  type GameSpec,
  type KitParam,
  type Usage,
  type FileEdit,
} from './protocol';
export { getBackend, setBackend, stubBackend, backendFromKits, catalogFor, SPEC_FILE, type GameBackend, type KitInfo, type ThemeInfo, type KitsModule } from './catalog';
export { instantSpec, instantEdit } from './instant';
export { applyEdits, MODS_FILE } from './patch';
export { checkProject } from './check';
