/**
 * FORGE Alpha 4 — generator-specific, offline writing templates.
 *
 * Each template is a schema, not an AI writing model. Source buttons paste
 * original CHAOS keywords into a field only on explicit user interaction.
 * Existing title/notes are kept intact for V2 Alpha 1–3 draft migration.
 */
const field = (id, label, guide, source = []) => ({ id, label, guide, source });

export const FORGE_TEMPLATES = {
  story: {
    eyebrow: 'NOVEL / STORY BIBLE',
    subtitle: '세계관에서 결말까지, 한 편의 이야기를 구조화합니다.',
    sections: [
      {
        id: 'concept', title: '작품의 중심', subtitle: '한 문장으로 작품을 설명하기', icon: '✧',
        fields: [
          field('logline', '핵심 로그라인', '주인공이 어떤 사건과 갈등에 휘말리는지 한두 문장으로 적어 보세요.', ['protagonist', 'event', 'conflict']),
          field('theme', '주제와 감정', '독자에게 끝까지 남기고 싶은 질문이나 감정은 무엇인가요?', ['mood', 'ending']),
          field('promise', '작품의 매력', '이 이야기만의 차별점이나 독자가 기대할 경험을 기록하세요.', ['genre', 'twist'])
        ]
      },
      {
        id: 'world', title: '세계와 인물', subtitle: '규칙·동기·관계', icon: '◈',
        fields: [
          field('worldRules', '세계관 규칙', '세계의 법칙, 금기, 사회 구조, 비용과 제약을 구체적으로 설명하세요.', ['setting']),
          field('protagonistArc', '주인공의 목표와 결핍', '겉으로 원하는 것과 진정으로 필요한 것이 어떻게 다른가요?', ['protagonist', 'conflict']),
          field('relationships', '핵심 인물 관계', '주인공을 도와주거나 방해하는 인물, 관계가 변하는 이유는?', ['protagonist', 'event'])
        ]
      },
      {
        id: 'plot', title: '서사 구조', subtitle: '발단 → 전개 → 위기 → 결말', icon: '◇',
        fields: [
          field('opening', '발단과 도입', '시작 장면과 주인공을 움직이게 하는 사건을 정하세요.', ['setting', 'event']),
          field('midpoint', '전개와 전환점', '상황을 뒤집는 첫 발견과 선택은 무엇인가요?', ['event', 'conflict']),
          field('climax', '절정과 최후의 선택', '주인공이 가장 큰 대가를 치르는 순간을 설계하세요.', ['conflict', 'twist']),
          field('resolution', '결말과 변화', '갈등이 해결된 뒤 세계와 인물은 어떻게 달라지나요?', ['ending'])
        ]
      },
      {
        id: 'mystery', title: '복선과 반전', subtitle: '떡밥·회수·모순 검토', icon: '⚑',
        fields: [
          field('foreshadow', '복선 배치', '초반에 독자에게 보여 줄 단서나 의미 있는 사물을 기록하세요.', ['event', 'twist']),
          field('reveal', '반전의 논리', '반전이 성립하는 이유와 독자가 다시 읽었을 때 발견할 근거는?', ['twist']),
          field('checks', '설정 충돌 검토', '인물 행동의 동기, 시간 순서, 세계관 규칙에 모순이 없는지 점검하세요.', ['conflict', 'ending'])
        ]
      }
    ]
  },
  game: {
    eyebrow: 'GAME / DESIGN DOCUMENT',
    subtitle: '플레이 경험에서 시스템과 MVP까지 설계합니다.',
    sections: [
      {
        id: 'concept', title: '게임 콘셉트', subtitle: '누가 왜 플레이하는가', icon: '✧',
        fields: [
          field('pitch', '한 문장 게임 소개', '플레이어가 무엇을 하며, 무엇 때문에 계속하고 싶어지나요?', ['genre', 'gameplay']),
          field('fantasy', '플레이어 판타지', '플레이어가 어떤 역할·능력·경험을 느끼게 할까요?', ['gameplay', 'mechanic']),
          field('audience', '대상과 플랫폼', '목표 플레이어, PC·모바일 등 플랫폼과 예상 플레이 길이.')
        ]
      },
      {
        id: 'loop', title: '핵심 플레이', subtitle: '입력 → 행동 → 보상', icon: '◈',
        fields: [
          field('coreLoop', '코어 루프', '행동 → 반응 → 보상 → 재도전의 반복을 단계로 적어 보세요.', ['gameplay', 'mechanic']),
          field('controls', '조작 및 상호작용', '플레이어가 실제로 누르거나 선택하는 요소는 무엇인가요?', ['gameplay']),
          field('mechanics', '핵심 시스템 규칙', '승패에 영향을 주는 규칙, 수치, 예외 처리 등을 정의하세요.', ['mechanic', 'special']),
          field('failStates', '실패와 재도전', '어떤 상황에서 실패하며, 다시 시작할 이유는 무엇인가요?', ['enemy', 'victory'])
        ]
      },
      {
        id: 'progression', title: '성장과 콘텐츠', subtitle: '반복할 동기를 설계하기', icon: '◇',
        fields: [
          field('progression', '성장 구조', '해금, 아이템, 능력, 스테이지 등 시간에 따른 발전을 설계하세요.', ['growth']),
          field('enemies', '적과 난이도 곡선', '일반 적·보스·환경 위협과 학습 단계의 차이를 설명하세요.', ['enemy']),
          field('levels', '스테이지와 콘텐츠', '플레이 지역, 도전 과제, 승리 조건을 정의하세요.', ['victory', 'gameplay'])
        ]
      },
      {
        id: 'production', title: '제작 계획', subtitle: '아트·범위·검증', icon: '⚑',
        fields: [
          field('visual', '아트와 UX', '색감, 시각 피드백, 접근성, UI 스타일을 정의하세요.', ['art']),
          field('mvp', '최소 플레이 가능 버전', '첫 버전에 꼭 있어야 하는 기능과 제외할 기능을 구분하세요.', ['mechanic', 'gameplay']),
          field('tests', '밸런스 검증', '플레이테스트에서 확인할 수치·재미·반복 피로도를 적으세요.', ['growth', 'victory'])
        ]
      }
    ]
  },
  character: {
    eyebrow: 'CHARACTER / PROFILE & ARC',
    subtitle: '성격보다 깊은 욕망과 변화를 가진 인물을 만듭니다.',
    sections: [
      {
        id: 'identity', title: '인물 정체성', subtitle: '첫인상과 진짜 모습', icon: '✧',
        fields: [
          field('overview', '인물 한 줄 소개', '이 인물을 처음 만난 독자에게 어떤 인상이 남을까요?', ['job', 'personality']),
          field('voice', '말투와 행동 습관', '말버릇, 호흡, 행동의 특징과 타인에게 보이는 가면.', ['personality']),
          field('contradiction', '외면과 내면의 차이', '겉으로 말하는 가치와 실제 행동 사이의 모순은?', ['personality', 'secret'])
        ]
      },
      {
        id: 'motives', title: '욕망과 상처', subtitle: '왜 그런 선택을 하는가', icon: '◈',
        fields: [
          field('goal', '표면적 목표', '현재 가장 절실하게 이루려는 목표는 무엇인가요?', ['desire']),
          field('wound', '과거의 상처', '어떤 사건이 현재의 가치관을 만들었나요?', ['past']),
          field('belief', '신념과 두려움', '절대로 포기할 수 없는 신념과 가장 두려운 것은?', ['belief', 'inner'])
        ]
      },
      {
        id: 'relations', title: '관계와 충돌', subtitle: '사람 사이에서 변하는 인물', icon: '◇',
        fields: [
          field('allies', '가까운 인물', '누구를 신뢰하고, 왜 관계가 유지되나요?', ['relationship']),
          field('rivals', '대립 관계', '가장 갈등하는 인물은 누구이고 무엇이 충돌하나요?', ['inner', 'secret']),
          field('secrets', '숨긴 비밀과 대가', '비밀이 밝혀지면 어떤 관계나 목표가 흔들리나요?', ['secret'])
        ]
      },
      {
        id: 'arc', title: '변화의 서사', subtitle: '선택·실패·성장', icon: '⚑',
        fields: [
          field('turning', '결정적 전환점', '기존 신념이 깨지는 사건과 그때의 선택을 설계하세요.', ['inner', 'past']),
          field('growthArc', '내적 변화', '끝에서 처음과 달라진 행동을 어떻게 보여 줄까요?', ['growth']),
          field('finalChoice', '마지막 선택', '가장 소중한 것을 걸고 어떤 결정을 내리나요?', ['belief', 'desire'])
        ]
      }
    ]
  },
  hero: {
    eyebrow: 'HERO / COMBAT DOSSIER',
    subtitle: '스킬의 멋뿐 아니라 역할과 약점, 상성을 설계합니다.',
    sections: [
      {
        id: 'identity', title: '전투 정체성', subtitle: '무엇이 다른 영웅인가', icon: '✧',
        fields: [
          field('identity', '영웅 콘셉트', '이 영웅의 한 줄 소개와 핵심 판타지는?', ['race', 'class']),
          field('role', '전장 내 역할', '선봉, 탱커, 지원, 암살 등 역할과 팀 기여 방식.', ['role', 'class']),
          field('weaponStyle', '무기와 전투 리듬', '사거리, 이동, 공격 속도, 주요 조작 리듬을 정하세요.', ['weapon', 'element'])
        ]
      },
      {
        id: 'skills', title: '스킬 구성', subtitle: '액티브·패시브·궁극기', icon: '◈',
        fields: [
          field('active', '액티브 스킬 상세', '발동 조건, 사거리, 효과, 쿨타임, 자원 소모를 기록하세요.', ['active']),
          field('passive', '패시브 스킬 상세', '항상 발동하는 효과와 조건부 강화, 중첩 규칙을 정하세요.', ['passive']),
          field('ultimate', '궁극기 상세', '강력한 기술의 연출, 비용, 위험, 대응 수단을 정하세요.', ['ultimate'])
        ]
      },
      {
        id: 'balance', title: '밸런스와 상성', subtitle: '강점·약점·대응 전략', icon: '◇',
        fields: [
          field('strengths', '강점과 전술', '이 영웅이 특히 강한 상황, 시너지를 설명하세요.', ['role', 'element']),
          field('weaknesses', '약점과 제약', '의도적으로 취약하게 만든 상황과 기술적 제약은?', ['weakness']),
          field('counterplay', '상대의 대응 수단', '다른 플레이어가 어떤 전략으로 상대할 수 있나요?', ['weakness', 'active'])
        ]
      },
      {
        id: 'growth', title: '성장과 연계', subtitle: '레벨업·팀 시너지', icon: '⚑',
        fields: [
          field('upgrades', '성장 및 해금', '레벨별 능력 변화, 특성 선택, 성장 한계를 정하세요.', ['passive', 'ultimate']),
          field('synergy', '아군과의 시너지', '어떤 동료와 상성이 좋고 어떤 조합은 피해야 하나요?', ['role', 'element']),
          field('signature', '대표 전투 장면', '이 영웅의 매력을 한 장면으로 보여 주는 전투를 적으세요.', ['weapon', 'ultimate'])
        ]
      }
    ]
  }
};

export const getForgeTemplate = (generatorId) => FORGE_TEMPLATES[generatorId] || null;
export const getForgeFields = (generatorId) =>
  (getForgeTemplate(generatorId)?.sections || []).flatMap((section) => section.fields);

/** A legacy doc ({title, notes}) remains fully readable after migration. */
export function normalizeForgeDoc(generatorId, raw) {
  const doc = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const validFields = getForgeFields(generatorId);
  const fields = {};
  for (const { id } of validFields) {
    const value = doc.fields?.[id];
    fields[id] = typeof value === 'string' ? value.slice(0, 12000) : '';
  }
  return {
    ...doc,
    title: typeof doc.title === 'string' ? doc.title.slice(0, 100) : '',
    notes: typeof doc.notes === 'string' ? doc.notes.slice(0, 20000) : '',
    fields
  };
}

export function forgeProgress(generatorId, rawDoc) {
  const doc = normalizeForgeDoc(generatorId, rawDoc);
  const all = getForgeFields(generatorId);
  const completed = all.filter(({ id }) => doc.fields[id].trim()).length;
  return { completed, total: all.length, percent: all.length ? Math.round(completed / all.length * 100) : 0 };
}

export function forgeSourceLines(generatorId, sourceIds, values = {}) {
  const source = Array.isArray(sourceIds) ? sourceIds : [];
  const keys = new Set(source);
  const sourceMap = new Map(
    (FORGE_SOURCE_LABELS[generatorId] || []).filter(([key]) => keys.has(key))
  );
  return [...sourceMap].map(([key, label]) => {
    const value = values?.[key];
    return typeof value === 'string' && value.trim() ? `${label}: ${value.trim()}` : '';
  }).filter(Boolean);
}

const FORGE_SOURCE_LABELS = {
  story: [['genre','장르'], ['setting','배경'], ['protagonist','주인공'], ['event','사건'], ['conflict','갈등'], ['twist','반전'], ['mood','분위기'], ['ending','결말']],
  game: [['genre','장르'], ['gameplay','플레이'], ['mechanic','메커니즘'], ['growth','성장'], ['special','특수 규칙'], ['enemy','적'], ['victory','승리 조건'], ['art','아트']],
  character: [['job','직업'], ['personality','성격'], ['desire','욕망'], ['past','과거'], ['secret','비밀'], ['belief','신념'], ['relationship','관계'], ['inner','내적 갈등'], ['growth','성장']],
  hero: [['race','종족'], ['class','직업'], ['weapon','무기'], ['element','속성'], ['role','역할'], ['active','액티브'], ['passive','패시브'], ['ultimate','궁극기'], ['weakness','약점']]
};

export function buildForgeExportData(generatorId, rawDoc, values = {}, exportedAt = new Date()) {
  const template = getForgeTemplate(generatorId);
  if (!template) throw new Error('Unknown generator: ' + generatorId);
  const doc = normalizeForgeDoc(generatorId, rawDoc);
  return {
    schema: 'chaos-forge/forge@1',
    generator: generatorId,
    title: doc.title,
    notes: doc.notes,
    sections: template.sections.map((section) => ({
      id: section.id,
      title: section.title,
      fields: section.fields.map((field) => ({
        id: field.id, label: field.label, text: doc.fields[field.id]
      }))
    })),
    source: Object.fromEntries(FORGE_SOURCE_LABELS[generatorId]
      .map(([id]) => [id, typeof values?.[id] === 'string' ? values[id] : ''])),
    exportedAt: exportedAt.toISOString()
  };
}

export function buildForgeMarkdown(data) {
  const cleanTitle = String(data.title || '제목 없는 기획서').replace(/[\r\n]+/g, ' ');
  const lines = [`# ${cleanTitle}`, '', `- 생성기: ${data.generator.toUpperCase()}`, `- 저장 파일 생성: ${data.exportedAt}`];
  if (data.notes?.trim()) lines.push('', '## 자유 메모', '', data.notes);
  for (const section of data.sections) {
    lines.push('', `## ${section.title}`);
    for (const entry of section.fields) {
      lines.push('', `### ${entry.label}`, '', entry.text?.trim() || '_(미작성)_');
    }
  }
  lines.push('', '## 원본 CHAOS 키워드');
  for (const [key, value] of Object.entries(data.source || {})) {
    if (value) lines.push(`- ${key}: ${value.replace(/[\r\n]+/g,' ')}`);
  }
  return lines.join('\n');
}
