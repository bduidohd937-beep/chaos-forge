import { describe, expect, it } from 'vitest';
import { auditDNACoverage, generateResult, rerollSlot } from '../src/engine.js';
import { normalizeDNA } from '../src/creativeDNA.js';

describe('V2.12 slot activation', () => {
  it('preserves an OFF value and excludes it from generation', () => {
    const values = { twist: '사용자가 보존한 반전', setting: '기존 배경' };
    const result = generateResult('story', {
      mode: 'genre', genre: '판', genres: { main: '판', subs: [] },
      enabled: { twist: false }, values, locks: { twist: true }, dna: normalizeDNA()
    });
    expect(result.twist).toBe(values.twist);
  });

  it('does not report an OFF slot as a BAN shortage and does not reroll it', () => {
    const enabled = { twist: false };
    expect(auditDNACoverage('story', normalizeDNA({ bannedExact: ['x'] }), [], {}, {}, enabled).empty)
      .not.toContain('반전');
    expect(rerollSlot('story', 'twist', { enabled, previous: '보존값' })).toBe('보존값');
  });
});
