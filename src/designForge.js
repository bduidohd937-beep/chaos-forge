/** V2.15 Design Forge: deterministic, offline game-design scaffolding. */
const text = (v) => typeof v === 'string' ? v.trim() : '';

export function buildGameDesignSeed(values = {}) {
  const v = Object.fromEntries(Object.entries(values || {}).map(([k, value]) => [k, text(value)]));
  if (!v.genre && !v.gameplay && !v.mechanic) return {};
  const mechanic = v.mechanic || '핵심 메커니즘';
  const gameplay = v.gameplay || '플레이 방식';
  const enemy = v.enemy || '적 위협';
  const victory = v.victory || '승리 조건';
  return {
    pitch: `${v.genre || '게임'}에서 플레이어는 ${gameplay}을 통해 ${mechanic}을 익히고, ${victory}를 달성한다.`,
    fantasy: `플레이어는 ${mechanic}을 직접 조작해 위기를 읽고, 위험을 감수한 선택으로 돌파한다.`,
    coreLoop: `탐색 → ${mechanic}으로 상황 해결 → ${enemy}의 패턴 대응 → 보상 선택 → 다음 구역 재도전`,
    controls: `${gameplay}의 기본 입력 1회로 관찰·이동·행동을 선택한다. 행동 결과는 다음 턴/구간의 위험도에 반영된다.`,
    mechanics: `${mechanic}은 입력, 비용, 결과를 명확히 가진다. 사용 전 예상 결과를 보여 주고, 실패 시 자원 또는 위치 중 하나를 잃는다.`,
    failStates: `${enemy}에게 핵심 자원을 모두 빼앗기거나 ${victory}에 필요한 조건을 놓치면 실패한다. 실패 후에는 원인과 재도전 보상을 보여 준다.`,
    progression: `${mechanic}의 선택지를 단계적으로 해금하되, 수치 상승보다 새로운 해결법을 추가한다.`,
    enemies: `${enemy}는 첫 구역에서 한 가지 규칙만 가르치고, 이후 구역에서 규칙을 조합해 난이도를 높인다.`,
    levels: `MVP는 튜토리얼 1개, 규칙을 검증하는 본편 2개, ${victory}를 확인하는 결말 1개로 구성한다.`,
    mvp: `필수: ${gameplay}, ${mechanic}, ${enemy}, ${victory}, 10분 내 1회 완주. 제외: 장기 성장, 다중 엔딩, 온라인 기능.`,
    tests: `첫 시도에서 핵심 규칙을 3분 안에 이해하는가; ${victory}까지 평균 ${'3~8'}회 행동이 걸리는가; 실패 원인을 설명할 수 있는가; 반복 3회 후에도 다른 선택을 시도하는가.`
  };
}

export function mergeGameDesignSeed(doc, values) {
  const seed = buildGameDesignSeed(values);
  const fields = { ...(doc?.fields || {}) };
  for (const [key, value] of Object.entries(seed)) if (!text(fields[key])) fields[key] = value;
  return { ...(doc || {}), fields };
}
