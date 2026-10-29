/**
 * CHAOS FORGE — 로컬 콘셉트 프리뷰.
 * AI나 외부 API 없이 슬롯 값을 의미별로 묶어 기획의 출발점을 제공한다.
 * 원본 키워드를 바꾸지 않고 직접 수정/재추첨 시 즉시 재계산한다.
 */
const PREVIEW_SCHEMAS = {
  story: {
    fallback: '새로운 이야기의 씨앗',
    title: ['protagonist', 'setting'],
    sections: [
      { label: '세계와 주인공', fields: [['배경', 'setting'], ['주인공', 'protagonist'], ['장르', 'genre']] },
      { label: '사건의 엔진', fields: [['사건', 'event'], ['갈등', 'conflict'], ['분위기', 'mood']] },
      { label: '마지막 한 수', fields: [['반전', 'twist'], ['결말', 'ending']] }
    ]
  },
  game: {
    fallback: '새로운 게임 기획',
    title: ['genre', 'mechanic'],
    sections: [
      { label: '핵심 플레이', fields: [['방식', 'gameplay'], ['메커니즘', 'mechanic']] },
      { label: '반복 동기', fields: [['성장', 'growth'], ['특수 규칙', 'special'], ['적', 'enemy']] },
      { label: '완성할 경험', fields: [['목표', 'victory'], ['비주얼', 'art']] }
    ]
  },
  character: {
    fallback: '새로운 인물 설정',
    title: ['job', 'personality'],
    sections: [
      { label: '겉으로 보이는 얼굴', fields: [['직업', 'job'], ['성격', 'personality'], ['인간관계', 'relationship']] },
      { label: '숨겨진 동기', fields: [['욕망', 'desire'], ['과거', 'past'], ['비밀', 'secret']] },
      { label: '변화를 만드는 힘', fields: [['신념', 'belief'], ['내적 갈등', 'inner'], ['성장', 'growth']] }
    ]
  },
  hero: {
    fallback: '새로운 영웅 설계',
    title: ['race', 'class'],
    sections: [
      { label: '전투 정체성', fields: [['무기', 'weapon'], ['속성', 'element'], ['역할', 'role']] },
      { label: '전투 시그니처', fields: [['액티브', 'active'], ['패시브', 'passive'], ['궁극기', 'ultimate']] },
      { label: '균형을 만드는 약점', fields: [['약점', 'weakness']] }
    ]
  }
};

/** @returns {{title:string, sections:{label:string,text:string}[], text:string}} */
export function buildConceptPreview(generatorId, values = {}) {
  const schema = PREVIEW_SCHEMAS[generatorId];
  if (!schema) return { title: '새로운 아이디어', sections: [], text: '새로운 아이디어' };
  const source = values && typeof values === 'object' ? values : {};
  const value = (key) => typeof source[key] === 'string' ? source[key].trim() : '';
  const title = schema.title.map(value).filter(Boolean).join(' · ') || schema.fallback;
  const sections = schema.sections.map(({ label, fields }) => {
    const text = fields.map(([name, key]) => {
      const content = value(key);
      return content ? `${name}: ${content}` : '';
    }).filter(Boolean).join('  /  ');
    return { label, text };
  }).filter(({ text }) => text.length > 0);
  const text = [title, ...sections.map(({ label, text: detail }) => `[${label}] ${detail}`)].join('\n');
  return { title, sections, text };
}
