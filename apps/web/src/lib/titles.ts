/** Derives a short working title from the idea text. */
export function titleFromIdea(idea: string): string {
  const cleaned = idea.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled game';
  const words = cleaned.replace(/^(an?|the)\s+/i, '').split(' ').slice(0, 5).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1).replace(/[.,!?;:]+$/, '');
}
