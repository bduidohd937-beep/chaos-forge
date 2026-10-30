import { describe, it, expect } from 'vitest';
import {
  FORGE_TEMPLATES, getForgeTemplate, getForgeFields, normalizeForgeDoc,
  forgeProgress, forgeSourceLines, buildForgeExportData, buildForgeMarkdown
} from '../src/forgeSchema.js';
import { GENERATORS } from '../src/engine.js';

describe('Alpha 4 generator-specific FORGE document schemas', () => {
  it('each of 4 generators has 4 specialized sections and unique field IDs', () => {
    expect(Object.keys(FORGE_TEMPLATES).sort()).toEqual(['character','game','hero','story']);
    for (const gen of GENERATORS) {
      const template = getForgeTemplate(gen.id);
      expect(template.sections).toHaveLength(4);
      const fields = getForgeFields(gen.id);
      expect(fields.length).toBeGreaterThanOrEqual(10);
      expect(new Set(fields.map(({ id }) => id)).size).toBe(fields.length);
      for (const section of template.sections) {
        expect(section.title.length).toBeGreaterThan(3);
        expect(section.fields.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('generator-specific fields are distinct: plot, core loop, motive, and combat skills', () => {
    expect(getForgeFields('story').map(f => f.id)).toContain('climax');
    expect(getForgeFields('game').map(f => f.id)).toContain('coreLoop');
    expect(getForgeFields('character').map(f => f.id)).toContain('wound');
    expect(getForgeFields('hero').map(f => f.id)).toContain('counterplay');
    expect(getForgeFields('hero').map(f => f.id)).not.toContain('climax');
  });

  it('legacy title and notes are preserved without editing or lost unknown data', () => {
    const legacy = { title: '우리들의 탐정', notes: '분량 3장\n비밀을 가진 사람', extraLegacy: 11 };
    const result = normalizeForgeDoc('story', legacy);
    expect(result.title).toBe(legacy.title);
    expect(result.notes).toBe(legacy.notes);
    expect(result.extraLegacy).toBe(11);
    expect(result.fields.logline).toBe('');
    expect(legacy).not.toHaveProperty('fields');
  });

  it('broken or oversized stored document fields are normalized safely', () => {
    const normalized = normalizeForgeDoc('story', {
      title: 'T'.repeat(200),
      notes: 99,
      fields: { logline: 'x'.repeat(20000), theme: null, secret: 'ignored' }
    });
    expect(normalized.title).toHaveLength(100);
    expect(normalized.notes).toBe('');
    expect(normalized.fields.logline).toHaveLength(12000);
    expect(normalized.fields.theme).toBe('');
    expect(normalized.fields).not.toHaveProperty('secret');
  });

  it('completion is derived only from authored structured fields, not free notes', () => {
    const start = forgeProgress('game', { notes: '임시 노트' });
    expect(start.completed).toBe(0);
    const result = forgeProgress('game', { fields: { coreLoop: '턴마다 카드를 뽑는다', pitch: '두 세계의 전쟁' } });
    expect(result.completed).toBe(2);
    expect(result.percent).toBe(Math.round(2 / result.total * 100));
  });

  it('source suggestions reflect only existing real Chaos values', () => {
    expect(forgeSourceLines('story', ['setting', 'event'], {
      setting: '떠다니는 왕국', event: '시간이 멈춘다', conflict: '공개하지 말 것'
    })).toEqual(['배경: 떠다니는 왕국', '사건: 시간이 멈춘다']);
    expect(forgeSourceLines('hero', ['active'], { active: '그림자 도약' }))
      .toEqual(['액티브: 그림자 도약']);
    expect(forgeSourceLines('story', ['setting'], { setting: null })).toEqual([]);
  });

  it('FORGE export contains readable sections and a separate source snapshot', () => {
    const date = new Date('2026-10-30T00:00:00.000Z');
    const data = buildForgeExportData('story', {
      title: '달이 지워진 도시',
      notes: '기존 메모는 유지',
      fields: { logline: '도시의 달을 되찾으려는 탐정', resolution: '기억의 회복' }
    }, { protagonist: '탐정', setting: '지워진 도시' }, date);
    expect(data.schema).toBe('chaos-forge/forge@1');
    expect(data.generator).toBe('story');
    expect(data.sections).toHaveLength(4);
    expect(data.sections[0].fields[0].text).toContain('탐정');
    expect(data.source.setting).toBe('지워진 도시');
    expect(data.exportedAt).toBe(date.toISOString());
    const markdown = buildForgeMarkdown(data);
    expect(markdown).toContain('# 달이 지워진 도시');
    expect(markdown).toContain('## 서사 구조');
    expect(markdown).toContain('### 핵심 로그라인');
    expect(markdown).toContain('## 자유 메모');
    expect(markdown).toContain('원본 CHAOS 키워드');
    expect(JSON.parse(JSON.stringify(data)).source.protagonist).toBe('탐정');
  });

  it('empty data creates an exportable draft, unknown generator throws', () => {
    const data = buildForgeExportData('character', {});
    expect(data.sections).toHaveLength(4);
    expect(buildForgeMarkdown(data)).toContain('_(미작성)_');
    expect(() => buildForgeExportData('invalid', {})).toThrow();
  });
});
