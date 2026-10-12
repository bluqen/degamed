import { availableProviders, type AiSettings, type ProviderId } from './game';
import { loadKeys } from './keys';
import { env, isAuthConfigured } from './env';

const PREF = 'degamed.ai.provider';

export const PROVIDER_LABEL: Record<ProviderId, string> = {
  instant: 'Free instant mode',
  degamed: 'Degamed AI',
  gemini: 'Your Gemini key',
  openai: 'Your OpenAI key',
  anthropic: 'Your Anthropic key',
};

export function preferredProvider(): ProviderId | null {
  try {
    return (localStorage.getItem(PREF) as ProviderId | null) ?? null;
  } catch {
    return null;
  }
}

export function setPreferredProvider(p: ProviderId) {
  try {
    localStorage.setItem(PREF, p);
  } catch {
    // Storage blocked.
  }
}

/** The providers this person can use now, and the settings for the one in use. */
export function currentAi(): { providers: ProviderId[]; settings: AiSettings } {
  const keys = loadKeys();
  const providers = availableProviders(
    { gemini: keys.gemini, openai: keys.openai, anthropic: keys.anthropic },
    isAuthConfigured,
  );
  const pref = preferredProvider();
  // Best available by default: your own key, then hosted, then instant.
  const fallback =
    providers.find((p) => p !== 'instant' && p !== 'degamed') ??
    providers.find((p) => p === 'degamed') ??
    'instant';
  const provider = pref && providers.includes(pref) ? pref : fallback;
  const apiKey =
    provider === 'gemini'
      ? keys.gemini
      : provider === 'openai'
        ? keys.openai
        : provider === 'anthropic'
          ? keys.anthropic
          : undefined;
  return {
    providers,
    settings: { provider, apiKey, apiUrl: provider === 'degamed' ? env.apiUrl : undefined },
  };
}
