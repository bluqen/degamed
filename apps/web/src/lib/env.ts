/**
 * Public configuration. Every value here ships to the browser, so nothing secret belongs here.
 * Missing values don't crash the app: features that need them show a "setup needed" state.
 */
export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined,
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8787',
  playOrigin: (import.meta.env.VITE_PLAY_ORIGIN as string | undefined) ?? 'http://localhost:5174',
};

export const isAuthConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
export const isGoogleConfigured = isAuthConfigured && Boolean(env.googleClientId);
