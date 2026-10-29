import { describe, it, expect } from 'vitest';
import { buildConceptPreview } from '../src/synthesis.js';

describe('V1.2 오프라인 콘셉트 프리뷰', () => {
  it('STORY 핵심 세계관과 갈등 및 결말을 묶는다', () => {
    const preview = buildConceptPreview('story', {
      protagonist: '추방된 연금술사', setting: '하늘에 떠 있는 수도',
      event: '태양이 사라진다', conflict: '왕국의 내전',
      twist: '왕이 가짜였다', ending: '불완전한 승리'
    });
    expect(preview.title).toContain('추방된 연금술사');
    expect(preview.sections).toHaveLength(3);
    expect(preview.text).toContain('태양이 사라진다');
    expect(preview.text).toContain('왕이 가짜였다');
  });

  it('게임과 인물, 영웅도 각 슬롯의 중요한 정보가 포함된다', () => {
    const cases = [
      ['game', { genre: 'RPG', mechanic: '시간 역행', victory: '탑 공략' }, '탑 공략'],
      ['character', { job: '탐정', secret: '왕족', desire: '속죄' }, '왕족'],
      ['hero', { race: '엘프', class: '총잡이', active: '그림자 돌진', weakness: '근거리전' }, '근거리전']
    ];
    for (const [id, values, token] of cases) {
      const preview = buildConceptPreview(id, values);
      expect(preview.title.length).toBeGreaterThan(0);
      expect(preview.text).toContain(token);
    }
  });

  it('입력 원본을 변경하지 않고 새 프리뷰가 계산된다', () => {
    const values = { race: '엘프', class: '궁수', weakness: '독' };
    const first = buildConceptPreview('hero', values);
    values.class = '전사';
    const second = buildConceptPreview('hero', values);
    expect(first.title).toContain('궁수');
    expect(second.title).toContain('전사');
  });

  it('빈 값과 손상된 데이터에도 안전하다', () => {
    expect(buildConceptPreview('story', {}).sections).toHaveLength(0);
    expect(buildConceptPreview('hero', null).title).toBe('새로운 영웅 설계');
    expect(buildConceptPreview('nope').sections).toHaveLength(0);
    expect(buildConceptPreview('game', { mechanic: 42 }).text).not.toContain('42');
  });

  it('기획 프리뷰는 임의의 희귀도 점수를 만들지 않는다', () => {
    const preview = buildConceptPreview('hero', { race: '엘프', class: '궁수' });
    expect(preview).not.toHaveProperty('rarity');
    expect(preview.text).not.toContain('확률');
  });
});
