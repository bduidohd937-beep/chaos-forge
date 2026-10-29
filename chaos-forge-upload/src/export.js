/* CHAOS FORGE - 결과 내보내기
 * 현재 생성 결과를 마크다운/JSON 문자열로 만들고 파일로 내려받는다.
 * UI와 무관한 순수 함수라 테스트에서 그대로 검증한다.
 */

import { GENRE_NAME_MAP, GENERATOR_MAP, MODES } from './engine.js';

const modeLabel = (key) => MODES.find((m) => m.k === key)?.n ?? key;

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD HH:mm' (로컬 시간) */
function formatStamp(date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** 파일명: chaos-forge-story-20261029-1705.md */
export function buildFilename(generatorId, extension, date = new Date()) {
  const stamp =
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}`;
  return `chaos-forge-${generatorId}-${stamp}.${extension}`;
}

/**
 * 내보내기용 데이터 구조 (JSON의 기반이자 마크다운의 입력)
 * @param {{generatorId: string, mode: string, genre: string, chaos: number,
 *          values?: Record<string,string>, locks?: Record<string,boolean>,
 *          exportedAt?: Date}} input
 */
export function buildExportData({
  generatorId,
  mode,
  genre,
  chaos,
  values = {},
  locks = {},
  exportedAt = new Date()
}) {
  const gen = GENERATOR_MAP[generatorId];
  if (!gen) throw new Error(`알 수 없는 생성기: ${generatorId}`);

  return {
    schema: 'chaos-forge/idea@1',
    app: 'CHAOS FORGE',
    version: '1.0',
    generator: { id: gen.id, tab: gen.tab, title: gen.title },
    mode,
    modeLabel: modeLabel(mode),
    genre: { key: genre, label: GENRE_NAME_MAP[genre] || genre },
    chaos: mode === 'hybrid' ? Number(chaos) || 1 : null,
    exportedAt: exportedAt.toISOString(),
    exportedAtLabel: formatStamp(exportedAt),
    items: gen.slots.map((slot) => ({
      key: slot.key,
      label: slot.label,
      value: String(values[slot.key] ?? ''),
      locked: Boolean(locks[slot.key])
    }))
  };
}

/** 마크다운 표 셀에서 깨질 수 있는 문자를 정리한다 */
const escapeCell = (text) => String(text).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();

export function buildMarkdown(data) {
  const lines = [
    `# CHAOS FORGE · ${data.generator.tab} (${data.generator.title})`,
    '',
    `- 모드: ${data.modeLabel}`,
    `- 장르: ${data.genre.label}`
  ];
  if (data.chaos != null) lines.push(`- 혼돈: ${data.chaos}/5`);
  lines.push(`- 생성 시각: ${data.exportedAtLabel}`);
  lines.push('', '| 항목 | 내용 | 상태 |', '| --- | --- | --- |');

  for (const item of data.items) {
    lines.push(`| ${escapeCell(item.label)} | ${escapeCell(item.value)} | ${item.locked ? '잠금' : ''} |`);
  }

  lines.push('', '> CHAOS FORGE v1.0 · 장르 적합성 × 혼돈 아이디어 생성기');
  return lines.join('\n');
}

export function buildJson(data) {
  return JSON.stringify(data, null, 2);
}

/**
 * Blob으로 파일을 만들어 다운로드를 트리거한다.
 * @returns {boolean} 지원하지 않는 환경이면 false
 */
export function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return false;
  }

  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
