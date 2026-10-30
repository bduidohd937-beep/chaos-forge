import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, cleanup, screen } from '@testing-library/react';
import App from '../src/App.jsx';
import Storage from '../src/storage.js';

beforeEach(() => {
  cleanup();
  localStorage.clear();
  window.scrollTo = () => {};
});

function setup() { return render(<App animationMs={0} />); }
function expertMode() { fireEvent.click(screen.getByRole('button', { name: '전문 설정집 펼치기' })); }
function page(target) {
  const button = Array.from(document.querySelectorAll('.workspace-tab'))
    .find((item) => item.textContent.includes(target));
  if (!button) throw new Error('Missing page ' + target);
  fireEvent.click(button);
}
function section(name) {
  const item = Array.from(document.querySelectorAll('.forge-outline-item'))
    .find((node) => node.textContent.includes(name));
  if (!item) throw new Error('Missing section ' + name);
  fireEvent.click(item);
}
const field = (id, generator = 'story') =>
  document.getElementById(`forge-field-${generator}-${id}`);

describe('Alpha 4 FORGE studio UI', () => {
  it('starts in novice-friendly simple mode and expands the same document without losing content', () => {
    setup(); page('FORGE');
    expect(screen.getByText('간편 작성')).not.toBeNull();
    expect(document.querySelectorAll('.forge-outline-item')).toHaveLength(1);
    expect(document.querySelectorAll('.forge-field')).toHaveLength(3);
    fireEvent.change(field('logline'), { target: { value: '같은 문서를 계속 편집합니다' } });
    fireEvent.click(screen.getByRole('button', { name: '전문 설정집 펼치기' }));
    expect(document.querySelectorAll('.forge-outline-item')).toHaveLength(4);
    expect(field('logline').value).toBe('같은 문서를 계속 편집합니다');
    section('복선과 반전');
    expect(field('reveal')).not.toBeNull();
  });

  it('shows a STORY-specific outline, live progress and editable structured fields', () => {
    setup();
    page('FORGE');
    expertMode();
    expect(document.querySelectorAll('.forge-outline-item')).toHaveLength(4);
    expect(document.querySelector('.forge-outline').textContent).toContain('복선과 반전');
    expect(field('logline')).not.toBeNull();
    expect(field('worldRules')).toBeNull();
    expect(document.querySelector('.forge-progress-track').getAttribute('aria-valuenow')).toBe('0');
    fireEvent.change(field('logline'), { target: { value: '사라진 왕국의 법을 찾는 탐정' } });
    expect(Storage.loadDraft().forgeDocs.story.fields.logline).toContain('탐정');
    expect(document.querySelector('.forge-progress-track').getAttribute('aria-valuenow')).toBe('1');
    section('서사 구조');
    expect(field('logline')).toBeNull();
    expect(field('opening')).not.toBeNull();
    // UX 2.4 shows progress for the CURRENT section, rather than the
    // intimidating 13-field global count.
    expect(document.querySelector('.forge-progress-track').getAttribute('aria-valuenow')).toBe('0');
    expect(document.querySelector('.forge-stage-progress').textContent).toContain('0 / 4');
    section('작품의 중심');
    expect(document.querySelector('.forge-progress-track').getAttribute('aria-valuenow')).toBe('1');
    expect(field('logline').value).toBe('사라진 왕국의 법을 찾는 탐정');
  });

  it('keeps legacy title and notes while adding structured content and restoring after reload', () => {
    Storage.saveDraft({
      generatorId: 'story', workspacePage: 'forge', mode: 'hybrid', genre: '판', chaos: 3,
      results: { story: { values: { setting: '도시', event: '계약 파기' }, locks: { setting: true } } },
      forgeDocs: { story: { title: '기존 제목', notes: '내가 먼저 적어 둔 메모' } }
    });
    const first = setup();
    expertMode();
    expect(document.querySelector('#forgeTitleInput').value).toBe('기존 제목');
    expect(document.querySelector('#forgeNotesInput').value).toBe('내가 먼저 적어 둔 메모');
    fireEvent.change(field('logline'), { target: { value: '도시를 잃은 탐정' } });
    section('세계와 인물');
    fireEvent.change(field('worldRules'), { target: { value: '계약이 마법의 근원' } });
    first.unmount();
    setup();
    expertMode();
    expect(document.querySelector('#forgeTitleInput').value).toBe('기존 제목');
    expect(document.querySelector('#forgeNotesInput').value).toBe('내가 먼저 적어 둔 메모');
    expect(field('logline').value).toBe('도시를 잃은 탐정');
    section('세계와 인물');
    expect(field('worldRules').value).toBe('계약이 마법의 근원');
    page('CHAOS');
    expect(document.querySelector('[data-slot="setting"].result-card').classList.contains('is-locked')).toBe(true);
    expect(document.querySelector('[data-slot="setting"] .card-value').textContent).toBe('도시');
  });

  it('adds original keywords only on request and never destroys authored writing', () => {
    Storage.saveDraft({
      generatorId: 'story', mode: 'genre', genre: '판', chaos: 3,
      results: { story: { values: { protagonist: '탐정', event: '시계의 정지', conflict: '도시 전체의 실종' }, locks: {} } }
    });
    setup(); page('FORGE'); expertMode();
    fireEvent.change(field('logline'), { target: { value: '이미 작성한 문단은 지켜주세요.' } });
    const action = screen.getByRole('button', { name: '핵심 로그라인에 원본 키워드 가져오기' });
    fireEvent.click(action);
    expect(field('logline').value).toContain('이미 작성한 문단은 지켜주세요.');
    expect(field('logline').value).toContain('주인공: 탐정');
    expect(field('logline').value).toContain('사건: 시계의 정지');
    const previous = field('logline').value;
    fireEvent.click(action);
    expect(field('logline').value).toBe(previous);
    expect(document.querySelector('#toast').textContent).toContain('이미');
  });

  it('does not modify CHAOS results when editing FORGE sections', () => {
    setup();
    const before = Array.from(document.querySelectorAll('.result-card'))
      .map((node) => node.querySelector('.card-value').textContent);
    page('FORGE'); expertMode();
    fireEvent.change(field('logline'), { target: { value: '새로 추가하는 작품 설정' } });
    section('복선과 반전');
    fireEvent.change(field('reveal'), { target: { value: '사실은 시간의 신이었다' } });
    page('CHAOS');
    const after = Array.from(document.querySelectorAll('.result-card'))
      .map((node) => node.querySelector('.card-value').textContent);
    expect(after).toEqual(before);
  });

  it('offers GAME/CHARACTER/HERO-specific fields and independent per-generator drafts', () => {
    setup(); page('FORGE'); expertMode();
    fireEvent.change(field('logline'), { target: { value: '스토리 문서' } });
    page('CHAOS');
    fireEvent.click(screen.getByRole('tab', { name: 'GAME' }));
    page('FORGE');
    expertMode();
    expect(field('logline')).toBeNull();
    section('핵심 플레이');
    expect(field('coreLoop', 'game')).not.toBeNull();
    fireEvent.change(field('coreLoop', 'game'), { target: { value: '전투→보상→영웅 강화' } });
    page('CHAOS');
    fireEvent.click(screen.getByRole('tab', { name: 'CHARACTER' }));
    page('FORGE');
    expertMode();
    section('욕망과 상처');
    expect(field('wound', 'character')).not.toBeNull();
    page('CHAOS');
    fireEvent.click(screen.getByRole('tab', { name: 'HERO' }));
    page('FORGE');
    expertMode();
    section('스킬 구성');
    expect(field('active','hero')).not.toBeNull();
    expect(field('ultimate','hero')).not.toBeNull();
    page('CHAOS');
    fireEvent.click(screen.getByRole('tab', { name: 'STORY' }));
    page('FORGE');
    expertMode();
    expect(field('logline').value).toBe('스토리 문서');
    expect(Storage.loadDraft().forgeDocs.game.fields.coreLoop).toContain('영웅 강화');
  });

  it('can copy the full document and export JSON/Markdown independently of CHAOS export', () => {
    setup(); page('FORGE'); expertMode();
    fireEvent.change(document.querySelector('#forgeTitleInput'), { target: { value: '매력적인 기획서' } });
    fireEvent.change(field('logline'), { target: { value: '마법을 잃은 주인공' } });
    const originalClick = HTMLAnchorElement.prototype.click;
    const originalCreate = URL.createObjectURL;
    const originalRevoke = URL.revokeObjectURL;
    const visited = [];
    try {
      URL.createObjectURL = vi.fn(() => 'blob:forge-test');
      URL.revokeObjectURL = vi.fn();
      HTMLAnchorElement.prototype.click = function () { visited.push(this.download); };
      fireEvent.click(screen.getByRole('button', { name: 'MD 저장' }));
      fireEvent.click(screen.getByRole('button', { name: 'JSON 백업' }));
      expect(visited.length).toBe(2);
      expect(visited[0]).toMatch(/forge-story.*\.md$/);
      expect(visited[1]).toMatch(/forge-story.*\.json$/);
      expect(document.querySelector('#toast').textContent).toContain('내보냈습니다');
    } finally {
      HTMLAnchorElement.prototype.click = originalClick;
      URL.createObjectURL = originalCreate;
      URL.revokeObjectURL = originalRevoke;
    }
  });

  it('keeps source preview and normal navigation after editing', () => {
    setup(); page('FORGE'); expertMode();
    expect(document.querySelector('.concept-preview')).not.toBeNull();
    expect(document.querySelector('.forge-source-details')).not.toBeNull();
    expect(document.querySelectorAll('.forge-outline-item')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: /CHAOS 추첨실/ }));
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(document.querySelector('#generateBtn')).not.toBeNull();
  });

  it('shows a storage failure warning instead of falsely claiming notes were saved', () => {
    const spy = vi.spyOn(Storage, 'saveDraft').mockReturnValue(false);
    try {
      setup(); page('FORGE');
      fireEvent.change(field('logline'), { target: { value: '메모는 화면에 남아 있음' } });
      expect(document.querySelector('.forge-save-state').textContent).toContain('자동 저장 실패');
      expect(document.querySelector('.autosave-status').textContent).toContain('자동 저장 실패');
      expect(field('logline').value).toContain('메모는 화면에 남아 있음');
    } finally {
      spy.mockRestore();
    }
  });
});
