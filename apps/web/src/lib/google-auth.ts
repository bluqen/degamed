/**
 * "Sign in with Google" using Google Identity Services (GIS) instead of Supabase's redirect.
 *
 * Google shows its own popup with *our* app name and domain, returns an ID token to this
 * page, and we hand that token to Supabase with `signInWithIdToken`. The user never sees
 * the `…supabase.co` address. A nonce ties the token to this page load so it can't be replayed.
 */
import { env } from './env';
import { supabase } from './supabase';

interface CredentialResponse {
  credential: string;
}

interface GoogleIdApi {
  initialize(config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce: string;
    ux_mode?: 'popup' | 'redirect';
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard' | 'icon';
      theme?: 'outline' | 'filled_blue' | 'filled_black';
      size?: 'large' | 'medium' | 'small';
      text?: 'signin_with' | 'signup_with' | 'continue_with';
      shape?: 'rectangular' | 'pill';
      width?: number;
      logo_alignment?: 'left' | 'center';
    },
  ): void;
  prompt(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisLoading: Promise<GoogleIdApi> | null = null;

function loadGis(): Promise<GoogleIdApi> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  gisLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () =>
      window.google?.accounts?.id
        ? resolve(window.google.accounts.id)
        : reject(new Error('Google sign-in failed to load'));
    script.onerror = () => {
      gisLoading = null;
      reject(new Error('Could not reach Google sign-in. Check your connection.'));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/** Returns [raw nonce for Supabase, SHA-256 hex of it for Google]. */
export async function createNonce(): Promise<[string, string]> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return [raw, hashed];
}

/**
 * Renders the official Google button into `container`. Resolves once it's on screen.
 * `onError` receives user-facing messages; `onSignedIn` fires after Supabase accepts the token.
 */
export async function mountGoogleButton(
  container: HTMLElement,
  handlers: { onSignedIn: () => void; onError: (message: string) => void },
): Promise<void> {
  if (!supabase || !env.googleClientId) {
    handlers.onError('Google sign-in is not configured yet. See docs/SETUP.md.');
    return;
  }
  const client = supabase;
  const [rawNonce, hashedNonce] = await createNonce();
  const gis = await loadGis();

  gis.initialize({
    client_id: env.googleClientId,
    nonce: hashedNonce,
    ux_mode: 'popup',
    use_fedcm_for_prompt: true,
    itp_support: true,
    callback: async ({ credential }) => {
      const { error } = await client.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
        nonce: rawNonce,
      });
      if (error) handlers.onError(error.message);
      else handlers.onSignedIn();
    },
  });

  container.replaceChildren();
  gis.renderButton(container, {
    type: 'standard',
    theme: 'filled_black',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    width: Math.min(360, container.clientWidth || 360),
    logo_alignment: 'left',
  });
}
