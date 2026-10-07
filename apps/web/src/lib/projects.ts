import { supabase } from './supabase';
import type { ArtStyle, ScriptLanguage } from '@degamed/shared';

export interface ProjectRow {
  id: string;
  title: string;
  description: string | null;
  art_style: ArtStyle;
  language: ScriptLanguage;
  visibility: 'private' | 'unlisted' | 'public';
  updated_at: string;
}

const COLUMNS = 'id, title, description, art_style, language, visibility, updated_at';

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. See docs/SETUP.md.');
  return supabase;
}

export async function listMyProjects(): Promise<ProjectRow[]> {
  const { data, error } = await requireClient()
    .from('projects')
    .select(COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as ProjectRow[];
}

export async function getProject(id: string): Promise<ProjectRow | null> {
  const { data, error } = await requireClient().from('projects').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ProjectRow | null;
}

export async function createProject(input: {
  title: string;
  description: string;
  artStyle: ArtStyle;
  language: ScriptLanguage;
}): Promise<ProjectRow> {
  const client = requireClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error('Please sign in first.');
  const { data, error } = await client
    .from('projects')
    .insert({
      owner_id: auth.user.id,
      title: input.title,
      description: input.description,
      art_style: input.artStyle,
      language: input.language,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as ProjectRow;
}

/** "2h ago"-style relative time for project cards. */
export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const units: [number, string][] = [
    [60 * 60 * 24 * 365, 'y'],
    [60 * 60 * 24 * 30, 'mo'],
    [60 * 60 * 24, 'd'],
    [60 * 60, 'h'],
    [60, 'm'],
  ];
  for (const [size, label] of units) {
    if (seconds >= size) return `${Math.floor(seconds / size)}${label} ago`;
  }
  return 'just now';
}
