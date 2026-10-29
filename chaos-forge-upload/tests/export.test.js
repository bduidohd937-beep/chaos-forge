import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildExportData,
  buildMarkdown,
  buildJson,
  buildFilename,
  downloadFile
} from '../src/export.js';

const baseValues = {
  genre: '하이 판타지',
  setting: '폐허가 된 대도시',
  protagonist: '',
  event: '왕국의 마력이 하룻밤에 말라 버린다',
  conflict: '마법과 기계가 서로를 지우려 한다',
  twist: '조연이 진짜 주인공이었다',
  mood: '암울한 디스토피아',
  ending: '대가를 치른 승리'
};

const exportedAt = new Date('2026-10-29T08:05:00');

function makeData(overrides = {}) {
  return buildExportData({
    generatorId: 'story',
    mode: 'hybrid',
    genre: '판',
    chaos: 4,
    values: baseValues,
    locks: { setting: true },
    exportedAt,
    ...overrides
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('내보내기 데이터', () => {
  it('생성기 정보와 슬롯 순서를 그대로 담는다', () => {
    const data = makeData();
    expect(data.schema).toBe('chaos-forge/idea@1');
    expect(data.generator).toEqual({ id: 'story', tab: 'STORY', title: '소설 생성기' });
    expect(data.modeLabel).toBe('하이브리드');
    expect(data.genre).toEqual({ key: '판', label: '판타지' });
    expect(data.chaos).toBe(4);
    expect(data.items.map((item) => item.key)).toEqual([
      'genre',
      'setting',
      'protagonist',
      'event',
      'conflict',
      'twist',
      'mood',
      'ending'
    ]);
    expect(data.items[1]).toEqual({
      key: 'setting',
      label: '배경',
      value: '폐허가 된 대도시',
      locked: true
    });
    expect(data.items[2].value).toBe('');
  });

  it('하이브리드가 아니면 혼돈 값을 비운다', () => {
    expect(makeData({ mode: 'random', chaos: 5 }).chaos).toBeNull();
    expect(makeData({ mode: 'genre' }).chaos).toBeNull();
  });

  it('알 수 없는 생성기는 예외로 알린다', () => {
    expect(() => makeData({ generatorId: 'nope' })).toThrow();
  });
});

describe('마크다운 내보내기', () => {
  it('제목·메타·표를 만든다', () => {
    const md = buildMarkdown(makeData());
    expect(md).toContain('# CHAOS FORGE · STORY (소설 생성기)');
    expect(md).toContain('- 모드: 하이브리드');
    expect(md).toContain('- 장르: 판타지');
    expect(md).toContain('- 혼돈: 4/5');
    expect(md).toContain('| 항목 | 내용 | 상태 |');
    expect(md).toContain('| 장르 | 하이 판타지 |  |');
    expect(md).toContain('| 배경 | 폐허가 된 대도시 | 잠금 |');
    // 헤더 1줄 + 구분선 1줄 + 항목 8줄
    const tableLines = md.split('\n').filter((line) => line.startsWith('| '));
    expect(tableLines).toHaveLength(10);
    expect(tableLines.filter((line) => line.includes('---'))).toHaveLength(1);
  });

  it('랜덤 모드에서는 혼돈 줄을 넣지 않는다', () => {
    const md = buildMarkdown(makeData({ mode: 'random' }));
    expect(md).not.toContain('- 혼돈:');
  });

  it('파이프와 줄바꿈이 표를 깨뜨리지 않는다', () => {
    const md = buildMarkdown(makeData({ values: { ...baseValues, setting: 'a | b\nc' } }));
    expect(md).toContain('| 배경 | a \\| b c | 잠금 |');
  });
});

describe('JSON 내보내기', () => {
  it('파싱 가능한 구조로 직렬화한다', () => {
    const json = buildJson(makeData());
    const parsed = JSON.parse(json);
    expect(parsed.generator.id).toBe('story');
    expect(parsed.items).toHaveLength(8);
    expect(parsed.items[1].locked).toBe(true);
    expect(parsed.exportedAt).toBe(exportedAt.toISOString());
    expect(json).toContain('\n  "schema"');
  });
});

describe('파일 저장', () => {
  it('파일명에 생성기·타임스탬프·확장자를 넣는다', () => {
    expect(buildFilename('hero', 'md', exportedAt)).toBe('chaos-forge-hero-20261029-0805.md');
    expect(buildFilename('game', 'json', exportedAt)).toBe('chaos-forge-game-20261029-0805.json');
  });

  it('Blob을 만들어 다운로드를 트리거한다', () => {
    const blobs = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((blob) => {
        blobs.push(blob);
        return 'blob:chaos';
      })
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const ok = downloadFile('chaos-forge-story-20261029-0805.md', '# hi', 'text/markdown;charset=utf-8');

    expect(ok).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(blobs).toHaveLength(1);
    expect(blobs[0].type).toContain('text/markdown');
    expect(document.body.querySelector('a[download]')).toBeNull();
  });

  it('지원하지 않는 환경에서는 false를 돌려준다', () => {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: undefined
    });
    expect(downloadFile('x.md', 'x')).toBe(false);
  });
});
