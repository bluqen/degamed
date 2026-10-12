import { describe, expect, it } from 'vitest';
import { titleFromIdea } from './titles';
import { timeAgo } from './projects';

describe('titleFromIdea', () => {
  it('keeps the part before the first clause, drops a leading article, title-cases it', () => {
    expect(titleFromIdea('A neon cyberpunk platformer where a cat hacks drones')).toBe('Neon Cyberpunk Platformer');
    expect(titleFromIdea('A moody rain-soaked platformer where a little robot looks for its family')).toBe('Moody Rain-soaked Platformer');
  });

  it('caps the length and keeps small words lower case', () => {
    expect(titleFromIdea('the legend of the tiny brave knight of the north')).toBe('Legend of the Tiny Brave');
  });

  it('trims trailing punctuation and whitespace', () => {
    expect(titleFromIdea('  space  shooter!  ')).toBe('Space Shooter');
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
