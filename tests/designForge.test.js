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

  it('replaces generated fields on regeneration while preserving authored text', () => {
    const merged = mergeGameDesignSeed({
      fields: { pitch: '플레이: 탐험', coreLoop: '내가 직접 쓴 루프' },
      generatedFields: { pitch: true }
    }, {
      genre: '던전RPG', gameplay: '방패병 협동 전투', mechanic: '자세 전환 검술',
      enemy: '연속 공격 후 강타하는 적', victory: '중앙 방벽 방어'
    });
    expect(merged.fields.pitch).toContain('방패병 협동 전투');
    expect(merged.fields.coreLoop).toBe('내가 직접 쓴 루프');
    expect(merged.seedStatus).toEqual({ changed: 10, preserved: 1 });
  });

  it('does not treat ordinary prose as an automatic field', () => {
    const merged = mergeGameDesignSeed({ fields: { pitch: '플레이어는 탐험을 통해 성장한다.' } }, { genre: 'RPG', gameplay: '전투', mechanic: '연계' });
    expect(merged.fields.pitch).toBe('플레이어는 탐험을 통해 성장한다.');
    expect(merged.seedStatus.preserved).toBe(1);
  });
});
