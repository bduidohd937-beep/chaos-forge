import { describe, expect, it } from 'vitest';
import { buildGameDesignSeed, mergeGameDesignSeed } from '../src/designForge.js';

describe('V2.15 Design Forge', () => {
  it('turns mechanic keywords into actionable rules and a distinct loop', () => {
    const seed = buildGameDesignSeed({ genre: '던전 RPG', gameplay: '턴제 탐험', mechanic: '시간표', enemy: '추적자', victory: '심층부 도달' });
    expect(seed.coreLoop).toContain('시간표');
    expect(seed.mechanics).toContain('비용');
    expect(seed.failStates).toContain('실패');
    expect(seed.mvp).toContain('제외');
    expect(seed.coreLoop).not.toBe(seed.mechanics);
  });

  it('does not overwrite user-authored fields', () => {
    const merged = mergeGameDesignSeed({ fields: { pitch: '내 로그라인' } }, { genre: 'RPG', mechanic: '시간표' });
    expect(merged.fields.pitch).toBe('내 로그라인');
    expect(merged.fields.coreLoop).toContain('시간표');
  });
});
