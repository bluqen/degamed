import { describe, expect, it } from 'vitest';
import { titleFromIdea } from './titles';
import { timeAgo } from './projects';

describe('titleFromIdea', () => {
  it('takes the first few words and drops a leading article', () => {
    expect(titleFromIdea('A neon cyberpunk platformer where a cat hacks drones')).toBe('Neon cyberpunk platformer where a');
  });

  it('trims trailing punctuation and whitespace', () => {
    expect(titleFromIdea('  space  shooter!  ')).toBe('Space shooter');
  });

  it('falls back for empty ideas', () => {
    expect(titleFromIdea('   ')).toBe('Untitled game');
  });
});

describe('timeAgo', () => {
  const now = Date.parse('2026-10-07T12:00:00Z');
  it('formats recent times', () => {
    expect(timeAgo('2026-10-07T11:59:30Z', now)).toBe('just now');
    expect(timeAgo('2026-10-07T11:15:00Z', now)).toBe('45m ago');
    expect(timeAgo('2026-10-07T10:00:00Z', now)).toBe('2h ago');
    expect(timeAgo('2026-10-04T12:00:00Z', now)).toBe('3d ago');
  });

  it('never goes negative for clock skew', () => {
    expect(timeAgo('2026-10-07T12:05:00Z', now)).toBe('just now');
  });
});
