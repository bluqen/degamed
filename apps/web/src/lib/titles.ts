const SMALL = new Set(['a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'to', 'for', 'at', 'by']);

/**
 * Derives a short working title from the idea text: the part before the first
 * "where / about / with / that…" clause, in title case, at most five words.
 */
export function titleFromIdea(idea: string): string {
  const cleaned = idea
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:]+$/, '');
  if (!cleaned) return 'Untitled game';
  const head = cleaned.split(
    /\s+(?:where|about|with|that|who|which|in which|set in|starring)\s+/i,
  )[0]!;
  const words = head
    .replace(/^(an?|the)\s+/i, '')
    .split(' ')
    .slice(0, 5);
  return words
    .map((w, i) =>
      i > 0 && SMALL.has(w.toLowerCase())
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(' ')
    .replace(/[.,!?;:]+$/, '');
}
