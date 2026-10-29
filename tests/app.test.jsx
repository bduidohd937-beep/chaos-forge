import { describe, it, expect, beforeEach, vi } from 'vitest';
import Storage from '../src/storage.js';
import { render, fireEvent, screen, cleanup, act } from '@testing-library/react';
import App from '../src/App.jsx';

function setup() {
  const utils = render(<App animationMs={0} />);
  const cards = () => Array.from(utils.container.querySelectorAll('.result-card'));
  const values = () => cards().map((card) => card.querySelector('.card-value').textContent);
  return { ...utils, cards, values };
}

const click = (node) => fireEvent.click(node);
const libraryView = (name) => {
  const tab = screen.getByRole('tab', { name: new RegExp(name) });
  click(tab);
};
const go = (page) => {
  const button = Array.from(document.querySelectorAll('.workspace-tab'))
    .find((node) => node.textContent.includes(page));
  if (!button) throw new Error('Missing workspace ' + page);
  click(button);
};

beforeEach(() => {
  localStorage.clear();
  cleanup();
  // jsdom에는 scrollTo 구현이 없다 (앱은 스크롤만 시도할 뿐이라 무해)
  window.scrollTo = () => {};
});

describe('CHAOS FORGE UI', () => {
  it('탭 4종과 STORY 8개 항목이 값과 함께 렌더된다', () => {
    const { cards, values } = setup();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(cards()).toHaveLength(8);
    expect(values().every((v) => v.trim().length > 0)).toBe(true);
    expect(document.querySelectorAll('.js-lock')).toHaveLength(8);
    expect(document.querySelectorAll('.js-reroll')).toHaveLength(8);
  });

  it('잠긴 항목은 전체 생성 후에도 값이 유지된다', () => {
    const { cards } = setup();
    const target = cards()[1];
    click(target.querySelector('.js-lock'));
    expect(target.classList.contains('is-locked')).toBe(true);

    const before = target.querySelector('.card-value').textContent;
    click(document.querySelector('#generateBtn'));
    expect(target.querySelector('.card-value').textContent).toBe(before);
  });

  it('잠금 해제 후에는 모든 항목이 다시 생성된다', () => {
    const { cards } = setup();
    click(cards()[1].querySelector('.js-lock'));
    click(document.querySelector('#unlockAllBtn'));
    expect(document.querySelectorAll('.result-card.is-locked')).toHaveLength(0);
  });

  it('항목별 재추첨은 다른 카드에 영향을 주지 않는다', () => {
    const { cards, values } = setup();
    const before = values();
    const target = cards()[3];
    click(target.querySelector('.js-reroll'));

    const after = values();
    before.forEach((value, i) => {
      if (i === 3) expect(after[i].trim().length).toBeGreaterThan(0);
      else expect(after[i]).toBe(value);
    });
  });

  it('잠긴 항목은 재추첨되지 않고 안내가 표시된다', () => {
    const { cards } = setup();
    const card = cards()[0];
    click(card.querySelector('.js-lock'));
    const before = card.querySelector('.card-value').textContent;
    click(card.querySelector('.js-reroll'));
    expect(card.querySelector('.card-value').textContent).toBe(before);
    expect(document.querySelector('#toast').textContent).toContain('잠긴');
  });

  it('랜덤 모드에 따라 혼돈 컨트롤이 활성/비활성된다', () => {
    setup();
    go('SETUP');
    click(screen.getByRole('radio', { name: '장르 맞춤' }));
    expect(document.querySelector('#chaosRange').disabled).toBe(true);
    expect(document.querySelector('#chaosControl').classList.contains('is-disabled')).toBe(true);

    click(screen.getByRole('radio', { name: '하이브리드' }));
    expect(document.querySelector('#chaosRange').disabled).toBe(false);

    fireEvent.change(document.querySelector('#chaosRange'), { target: { value: '5' } });
    expect(document.querySelector('#chaosValue').textContent.trim().startsWith('5')).toBe(true);
  });

  it('탭 전환 시 해당 생성기의 항목 수와 장르 목록이 바뀐다', () => {
    const { cards } = setup();
    click(screen.getByRole('tab', { name: 'HERO' }));
    expect(cards()).toHaveLength(9);
    expect(screen.getByRole('tab', { name: 'HERO' }).getAttribute('aria-selected')).toBe('true');

    go('SETUP');
    const genreOptions = Array.from(document.querySelectorAll('#genreSelect option')).map((o) => o.value);
    expect(genreOptions.length).toBeGreaterThan(20);
    expect(genreOptions).toContain('RPG');
    expect(genreOptions).toContain('판');
    go('CHAOS');

    click(screen.getByRole('tab', { name: 'CHARACTER' }));
    expect(cards()).toHaveLength(9);

    click(screen.getByRole('tab', { name: 'GAME' }));
    expect(cards()).toHaveLength(8);
  });

  it('직접 수정한 값이 탭을 옮겼다 돌아와도 유지된다', () => {
    const { cards } = setup();
    const value = cards()[0].querySelector('.card-value');
    value.textContent = '직접 수정한 값';
    fireEvent.input(value);

    click(screen.getByRole('tab', { name: 'GAME' }));
    click(screen.getByRole('tab', { name: 'STORY' }));
    expect(document.querySelector('.result-card .card-value').textContent).toBe('직접 수정한 값');
  });

  it('아이디어를 저장하고 검색으로 찾을 수 있다', () => {
    setup();
    fireEvent.change(document.querySelector('#ideaTitle'), { target: { value: '내 테스트 이야기' } });
    click(document.querySelector('#saveBtn'));
    go('LIBRARY');

    expect(document.querySelector('#ideaCount').textContent).toBe('1');
    expect(document.querySelectorAll('#ideaList li')).toHaveLength(1);

    fireEvent.change(document.querySelector('#ideaSearch'), { target: { value: '없는검색어' } });
    expect(document.querySelectorAll('#ideaList li')).toHaveLength(0);
    expect(document.querySelector('#ideaEmpty').textContent).toContain('검색');

    fireEvent.change(document.querySelector('#ideaSearch'), { target: { value: '테스트' } });
    expect(document.querySelectorAll('#ideaList li')).toHaveLength(1);
  });

  it('저장한 아이디어를 불러오면 값과 생성기가 복원된다', () => {
    const { values } = setup();
    click(screen.getByRole('tab', { name: 'HERO' }));
    const heroValues = values();

    fireEvent.change(document.querySelector('#ideaTitle'), { target: { value: '영웅 저장' } });
    click(document.querySelector('#saveBtn'));

    click(screen.getByRole('tab', { name: 'STORY' }));
    go('LIBRARY');
    click(screen.getByText('불러오기'));

    expect(screen.getByRole('tab', { name: 'HERO' }).getAttribute('aria-selected')).toBe('true');
    expect(values()).toEqual(heroValues);
  });

  it('사용자 키워드를 추가하면 생성 결과에 등장한다', () => {
    const { cards } = setup();
    go('LIBRARY');
    libraryView('사용자 키워드');

    fireEvent.change(document.querySelector('#customGenerator'), { target: { value: 'story' } });
    fireEvent.change(document.querySelector('#customSlot'), { target: { value: 'setting' } });
    fireEvent.change(document.querySelector('#customText'), { target: { value: '고래가 사는 도시' } });

    const chip = document.querySelector('#customGenres input');
    fireEvent.click(chip);
    fireEvent.submit(document.querySelector('#customForm'));

    expect(document.querySelector('#customCount').textContent).toBe('1');
    expect(document.querySelector('#customList').textContent).toContain('고래가 사는 도시');

    go('SETUP');
    click(screen.getByRole('radio', { name: '장르 맞춤' }));
    go('CHAOS');
    const settingCard = cards().find((card) => card.dataset.slot === 'setting');
    let hit = false;
    for (let i = 0; i < 300 && !hit; i++) {
      click(settingCard.querySelector('.js-reroll'));
      hit = settingCard.querySelector('.card-value').textContent === '고래가 사는 도시';
    }
    expect(hit).toBe(true);
  });

  it('새로 마운트해도 저장된 아이디어와 키워드가 유지된다', () => {
    setup();
    fireEvent.change(document.querySelector('#ideaTitle'), { target: { value: '유지 테스트' } });
    click(document.querySelector('#saveBtn'));
    go('LIBRARY');
    libraryView('사용자 키워드');

    fireEvent.change(document.querySelector('#customText'), { target: { value: '새 키워드' } });
    fireEvent.submit(document.querySelector('#customForm'));

    cleanup();
    render(<App animationMs={0} />);

    // 보관함은 목록을 한 번에 쌓지 않고 카테고리별로만 표시한다.
    expect(document.querySelector('#ideaCount').textContent).toBe('1');
    expect(document.querySelector('#ideaList').textContent).toContain('유지 테스트');
    libraryView('사용자 키워드');
    expect(document.querySelector('#customCount').textContent).toBe('1');
  });

  it('MD/JSON 내보내기 버튼이 파일 저장을 실행한다', () => {
    const created = [];
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn((blob) => {
        created.push(blob);
        return 'blob:mock';
      })
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    setup();
    fireEvent.click(document.querySelector('#exportMdBtn'));
    fireEvent.click(document.querySelector('#exportJsonBtn'));

    expect(created).toHaveLength(2);
    expect(created[0].type).toContain('text/markdown');
    expect(created[1].type).toContain('application/json');
    expect(document.querySelector('#toast').textContent).toContain('저장했습니다');
    expect(clickSpy).toHaveBeenCalledTimes(2);
    clickSpy.mockRestore();
  });

  it('콘솔 오류 없이 렌더된다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setup();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});


describe('V1.1 작업 초안 안정성', () => {
  it('생성기 상태와 잠금/결과가 새로고침 후에도 복원된다', () => {
    const first = setup();
    const storyValue = first.cards()[1].querySelector('.card-value').textContent;
    click(first.cards()[1].querySelector('.js-lock'));
    click(screen.getByRole('tab', { name: 'HERO' }));

    const saved = Storage.loadDraft();
    expect(saved.generatorId).toBe('hero');
    expect(saved.results.story.values.setting).toBe(storyValue);
    expect(saved.results.story.locks.setting).toBe(true);

    first.unmount();
    const second = setup();
    expect(screen.getByRole('tab', { name: 'HERO' }).getAttribute('aria-selected')).toBe('true');
    click(screen.getByRole('tab', { name: 'STORY' }));
    expect(second.cards()[1].querySelector('.card-value').textContent).toBe(storyValue);
    expect(second.cards()[1].classList.contains('is-locked')).toBe(true);
  });

  it('저장 실패를 성공으로 표시하지 않는다', () => {
    const saveDraft = vi.spyOn(Storage, 'saveDraft').mockReturnValue(false);
    const saveIdea = vi.spyOn(Storage, 'saveIdea').mockReturnValue(null);
    try {
      setup();
      expect(document.querySelector('.autosave-status').textContent).toContain('자동 저장 실패');
      click(document.querySelector('#saveBtn'));
      expect(document.querySelector('#toast').textContent).toContain('저장에 실패');
      go('LIBRARY');
      expect(document.querySelector('#ideaCount').textContent).toBe('0');
    } finally {
      saveDraft.mockRestore();
      saveIdea.mockRestore();
    }
  });
});


describe('V1.2 CHAOS MODE', () => {
  it('폭주 생성은 기본 장르·혼돈 설정을 바꾸지 않고 잠금을 유지한다', () => {
    const { cards } = setup();
    go('SETUP');
    click(screen.getByRole('radio', { name: '장르 맞춤' }));
    go('CHAOS');
    const target = cards()[1];
    click(target.querySelector('.js-lock'));
    const preserved = target.querySelector('.card-value').textContent;

    click(document.querySelector('#overdriveBtn'));
    expect(target.querySelector('.card-value').textContent).toBe(preserved);
    expect(target.classList.contains('is-locked')).toBe(true);

    go('SETUP');
    expect(screen.getByRole('radio', { name: '장르 맞춤' }).getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('#chaosValue').textContent.trim().startsWith('3')).toBe(true);
  });

  it('모든 카드 잠금 시 폭주와 전체 생성이 설정을 바꾸지 않는다', () => {
    const { cards } = setup();
    cards().forEach((card) => click(card.querySelector('.js-lock')));
    const before = cards().map((card) => card.querySelector('.card-value').textContent);
    click(document.querySelector('#overdriveBtn'));
    expect(document.querySelector('#toast').textContent).toContain('모든 항목');
    click(document.querySelector('#generateBtn'));
    expect(cards().map((card) => card.querySelector('.card-value').textContent)).toEqual(before);
  });

  it('직접 편집한 값은 콘셉트 프리뷰에도 바로 반영된다', () => {
    const { cards } = setup();
    const setting = cards().find((card) => card.dataset.slot === 'setting').querySelector('.card-value');
    setting.textContent = '사라진 달의 도시';
    fireEvent.input(setting);
    go('FORGE');
    expect(document.querySelector('.concept-preview').textContent).toContain('사라진 달의 도시');
    expect(document.querySelector('.preview-sections')).not.toBeNull();
    expect(document.querySelector('.forge-meter').getAttribute('aria-label')).toContain('전체 8개');
  });

  it('탭별로 다른 콘셉트 프리뷰를 보여준다', () => {
    setup();
    go('FORGE');
    const first = document.querySelector('.preview-sections').textContent;
    go('CHAOS');
    click(screen.getByRole('tab', { name: 'HERO' }));
    go('FORGE');
    const second = document.querySelector('.preview-sections').textContent;
    expect(first).not.toBe(second);
    expect(document.querySelector('.preview-section').textContent).toContain('전투 정체성');
  });

  it('움직임 최소화 브라우저 설정에서는 슬롯 연출을 생략한다', () => {
    const previous = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }));
    try {
      render(<App animationMs={620} />);
      click(document.querySelector('#generateBtn'));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(0);
      expect(document.querySelector('.preview-pending')).toBeNull();
    } finally {
      window.matchMedia = previous;
    }
  });
});


describe('V1.2.1 추첨 연출 복구', () => {
  it('기본 연출은 이전과 같은 클래식이며 선택을 자동 저장한다', () => {
    setup();
    const presets = Array.from(document.querySelectorAll('.reel-preset'));
    expect(presets.map((p) => p.textContent)).toEqual(['슬롯', '클래식', '즉시']);
    expect(presets[1].getAttribute('aria-pressed')).toBe('true');
    click(presets[0]);
    expect(presets[0].getAttribute('aria-pressed')).toBe('true');
    expect(Storage.loadDraft().reelStyle).toBe('slot');
  });

  it('슬롯 모드에서 회전 후 순차 정지하고 결과가 확정된다', () => {
    vi.useFakeTimers();
    try {
      render(<App animationMs={620} />);
      click(screen.getByRole('button', { name: '슬롯' }));
      click(document.querySelector('#generateBtn'));
      expect(document.querySelector('.results').classList.contains('is-slot')).toBe(true);
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(8);
      expect(document.querySelector('#toast').textContent).toContain('추첨 중');

      act(() => vi.advanceTimersByTime(810));
      const intermediate = document.querySelectorAll('.result-card.is-spinning').length;
      expect(intermediate).toBeGreaterThan(0);
      expect(intermediate).toBeLessThan(8);

      act(() => vi.advanceTimersByTime(1900));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(0);
      expect(document.querySelector('#toast').textContent).toContain('생성 완료');
      expect(document.querySelector('.preview-pending')).toBeNull();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('즉시 모드는 기다림 없이 결과를 보여준다', () => {
    render(<App animationMs={620} />);
    click(screen.getByRole('button', { name: '즉시' }));
    click(document.querySelector('#generateBtn'));
    expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(0);
    expect(document.querySelector('#toast').textContent).toContain('생성 완료');
  });
});


describe('V2.0 PROJECT REFORGE — 분리형 작업 공간', () => {
  it('설정실, 생성실, 창작실, 보관함에 각 화면의 기능만 노출된다', () => {
    setup();
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(document.querySelector('.results')).not.toBeNull();
    expect(document.querySelector('#genreSelect')).toBeNull();

    go('SETUP');
    expect(document.querySelector('#genreSelect')).not.toBeNull();
    expect(document.querySelector('.results')).toBeNull();
    go('FORGE');
    expect(document.querySelector('#forgeNotesInput')).not.toBeNull();
    expect(document.querySelector('#customForm')).toBeNull();
    go('LIBRARY');
    expect(document.querySelector('#ideaList')).not.toBeNull();
    expect(document.querySelector('#customForm')).toBeNull();
    libraryView('사용자 키워드');
    expect(document.querySelector('#customForm')).not.toBeNull();
    expect(document.querySelector('#ideaList')).toBeNull();
  });

  it('메인 장르 하나와 서브 장르 최대 3개를 자유롭게 선택한다', () => {
    setup();
    go('SETUP');
    const tile = (name) => Array.from(document.querySelectorAll('.genre-tile'))
      .find((node) => node.textContent.includes(name));
    ['로맨스', '미스터리', '코미디'].forEach(name => click(tile(name)));
    expect(document.querySelectorAll('.genre-tile.selected')).toHaveLength(3);
    expect(tile('공포').disabled).toBe(true);
    click(tile('미스터리'));
    expect(document.querySelectorAll('.genre-tile.selected')).toHaveLength(2);
    expect(tile('공포').disabled).toBe(false);

    fireEvent.change(document.querySelector('#genreSelect'), { target: { value: '로' } });
    expect(document.querySelectorAll('.genre-tile.selected')).toHaveLength(1);
    expect(Storage.loadDraft().genreSelection).toEqual({ main: '로', subs: ['코'] });
  });

  it('통합 장르 선택 및 설정 상태가 생성실과 새 세션에 유지된다', () => {
    const first = setup();
    go('SETUP');
    fireEvent.change(document.querySelector('#genreSelect'), { target: { value: 'SF' } });
    const chip = Array.from(document.querySelectorAll('.genre-tile'))
      .find(node => node.textContent.includes('로맨스'));
    click(chip);
    click(screen.getByRole('button', { name: /이 설정으로 창조하기/ }));
    expect(document.querySelector('.chaos-formula').textContent).toContain('SF');
    expect(document.querySelector('.chaos-formula').textContent).toContain('로맨스');
    expect(Storage.loadDraft().genreSelection).toEqual({ main: 'SF', subs: ['로'] });
    first.unmount();

    render(<App animationMs={0} />);
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(document.querySelector('.chaos-formula').textContent).toContain('로맨스');
  });

  it('FORGE의 제목·메모는 추첨 결과와 독립적으로 자동 저장된다', () => {
    const first = setup();
    go('FORGE');
    fireEvent.change(document.querySelector('#forgeTitleInput'), { target: { value: '별의 탐정' } });
    fireEvent.change(document.querySelector('#forgeNotesInput'), { target: { value: '첫 장면은 왕궁에서 시작한다.' } });
    expect(Storage.loadDraft().forgeDocs.story).toEqual({
      title: '별의 탐정', notes: '첫 장면은 왕궁에서 시작한다.'
    });
    first.unmount();

    render(<App animationMs={0} />);
    expect(document.querySelector('#forgeTitleInput').value).toBe('별의 탐정');
    expect(document.querySelector('#forgeNotesInput').value).toContain('왕궁');
  });

  it('기존 V1 장르·잠금 초안을 손실 없이 불러온다', () => {
    Storage.saveDraft({
      generatorId: 'story', genre: '판', mode: 'hybrid', chaos: 3,
      results: { story: { values: { setting: '이전 버전의 마법 학교' }, locks: { setting: true } } }
    });
    setup();
    const card = document.querySelector('[data-slot="setting"].result-card');
    expect(card.querySelector('.card-value').textContent).toBe('이전 버전의 마법 학교');
    expect(card.classList.contains('is-locked')).toBe(true);
    expect(Storage.loadDraft().genreSelection).toEqual({ main: '판', subs: [] });
  });

  it('아이디어 저장과 불러오기에서 서브 장르도 복원된다', () => {
    setup();
    go('SETUP');
    fireEvent.change(document.querySelector('#genreSelect'), { target: { value: '판' } });
    const romance = Array.from(document.querySelectorAll('.genre-tile'))
      .find(node => node.textContent.includes('로맨스'));
    click(romance);
    go('CHAOS');
    click(document.querySelector('#saveBtn'));
    expect(Storage.loadIdeas()[0].genres).toEqual({ main: '판', subs: ['로'] });
    go('SETUP');
    fireEvent.change(document.querySelector('#genreSelect'), { target: { value: 'SF' } });
    go('LIBRARY');
    click(screen.getByRole('button', { name: '불러오기' }));
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(document.querySelector('.chaos-formula').textContent).toContain('로맨스');
  });
});


describe('V2.0 Alpha 추첨 연출 체감 속도 회귀 검증', () => {
  it('기본 클래식은 클릭 후 1초 이상 실제 추첨 상태를 유지한다', () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      click(document.querySelector('#generateBtn'));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(8);
      expect(document.querySelector('.reel-status').textContent).toContain('클래식 추첨 진행 중');
      expect(document.querySelector('#generateBtn').getAttribute('aria-busy')).toBe('true');
      act(() => vi.advanceTimersByTime(1100));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(8);
      act(() => vi.advanceTimersByTime(1900));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(0);
      expect(document.querySelector('#generateBtn').getAttribute('aria-busy')).toBe('false');
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('기본 슬롯은 최소 2초 동안 회전하다가 카드를 순서대로 결정한다', () => {
    vi.useFakeTimers();
    try {
      render(<App />);
      click(screen.getByRole('button', { name: '슬롯' }));
      click(document.querySelector('#generateBtn'));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(8);
      act(() => vi.advanceTimersByTime(1200));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(8);
      act(() => vi.advanceTimersByTime(1000));
      const remaining = document.querySelectorAll('.result-card.is-spinning').length;
      expect(remaining).toBeGreaterThan(0);
      expect(remaining).toBeLessThan(8);
      act(() => vi.advanceTimersByTime(1600));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('시스템 움직임 최소화 사용자가 직접 슬롯을 고르면 명시적 선택을 따른다', () => {
    const old = window.matchMedia;
    window.matchMedia = vi.fn(() => ({ matches: true }));
    try {
      render(<App animationMs={620} />);
      expect(screen.getByRole('button', { name: '즉시' }).getAttribute('aria-pressed')).toBe('true');
      click(screen.getByRole('button', { name: '슬롯' }));
      click(document.querySelector('#generateBtn'));
      expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(8);
    } finally {
      window.matchMedia = old;
    }
  });

  it('즉시 모드는 기본 연출 시간과 관계없이 회전하지 않는다', () => {
    render(<App />);
    click(screen.getByRole('button', { name: '즉시' }));
    click(document.querySelector('#generateBtn'));
    expect(document.querySelectorAll('.result-card.is-spinning')).toHaveLength(0);
    expect(document.querySelector('#generateBtn').getAttribute('aria-busy')).toBe('false');
  });
});


describe('V2.0 Alpha 가독성·화면 구성 검수', () => {
  it('새 화면 진입 시 스크롤을 초기화하여 고정 헤더에 제목이 가려지지 않도록 한다', () => {
    const spy = vi.fn();
    window.scrollTo = spy;
    setup();
    spy.mockClear();
    go('SETUP');
    expect(spy).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
    go('CHAOS');
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('설정실은 추천 장르부터 보여주며 전체 펼치기 및 검색을 지원한다', () => {
    setup();
    go('SETUP');
    const list = () => Array.from(document.querySelectorAll('.genre-tile'));
    const initialCount = list().length;
    expect(initialCount).toBeGreaterThan(5);
    expect(initialCount).toBeLessThan(24);
    click(screen.getByRole('button', { name: /전체 장르 보기/ }));
    expect(list()).toHaveLength(24);
    fireEvent.change(document.querySelector('#subGenreSearch'), { target: { value: '스팀펑크' } });
    expect(list()).toHaveLength(1);
    expect(list()[0].textContent).toContain('스팀펑크');
    fireEvent.change(document.querySelector('#subGenreSearch'), { target: { value: '없는장르' } });
    expect(document.querySelector('.setup-genre-empty').textContent).toContain('다른 이름');
  });

  it('추천에 없는 장르도 최대 세 개까지 선택하고 검색 결과에 잠금 상태를 표시한다', () => {
    setup();
    go('SETUP');
    const search = document.querySelector('#subGenreSearch');
    fireEvent.change(search, { target: { value: '스팀펑크' } });
    const tile = document.querySelector('.genre-tile');
    click(tile);
    expect(tile.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('.setup-picked').textContent).toContain('스팀펑크');
    fireEvent.change(search, { target: { value: '' } });
    expect(Array.from(document.querySelectorAll('.genre-tile')).some(
      item => item.textContent.includes('스팀펑크')
    )).toBe(true);
  });

  it('생성실에서 주된 추첨 버튼·연출 선택·결과 제목을 명확히 구분한다', () => {
    setup();
    expect(document.querySelector('.chaos-primary-actions #generateBtn')).not.toBeNull();
    expect(document.querySelector('.chaos-deck-options .reel-presets')).not.toBeNull();
    expect(document.querySelector('.chaos-result-heading').textContent).toContain('추첨 결과');
    expect(document.querySelectorAll('.result-card')).toHaveLength(8);
  });

  it('카드별 잠금 및 재추첨에는 키워드 항목 이름이 포함된 접근성 이름이 있다', () => {
    setup();
    expect(screen.getByRole('button', { name: '배경 잠그기' })).not.toBeNull();
    expect(screen.getByRole('button', { name: '배경 다시 뽑기' })).not.toBeNull();
    click(screen.getByRole('button', { name: '배경 잠그기' }));
    expect(screen.getByRole('button', { name: '배경 잠금 해제' })).not.toBeNull();
  });

  it('보관함은 아이디어와 키워드 양쪽 패널을 동시에 복잡하게 펼치지 않는다', () => {
    setup();
    go('LIBRARY');
    expect(screen.getByRole('tab', { name: /저장된 아이디어/ }).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('#customForm')).toBeNull();
    libraryView('사용자 키워드');
    expect(screen.getByRole('tab', { name: /사용자 키워드/ }).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('#ideaList')).toBeNull();
  });
});


describe('Alpha 3 실제 사용자 추첨 기록', () => {
  it('연속 재추첨에서 최근 나온 같은 슬롯 값을 피하고 기록을 초안에 저장한다', () => {
    setup();
    const card = document.querySelector('.result-card[data-slot="setting"]');
    const values = [card.querySelector('.card-value').textContent];
    for (let i = 0; i < 3; i++) {
      click(card.querySelector('.js-reroll'));
      values.push(card.querySelector('.card-value').textContent);
    }
    expect(new Set(values).size).toBe(values.length);
    const saved = Storage.loadDraft();
    expect(saved.recentHistory.story.setting.slice(-3)).toEqual(values.slice(1));
    expect(saved.results.story.values.setting).toBe(values[3]);
  });

  it('새로고침 후에도 최근 재추첨 기록을 불러와 같은 결과를 연속 재사용하지 않는다', () => {
    const first = setup();
    const card = () => document.querySelector('.result-card[data-slot="setting"]');
    click(card().querySelector('.js-reroll'));
    click(card().querySelector('.js-reroll'));
    const previous = Storage.loadDraft().recentHistory.story.setting.slice();
    expect(previous.length).toBeGreaterThanOrEqual(2);
    first.unmount();
    render(<App animationMs={0} />);
    click(card().querySelector('.js-reroll'));
    const next = card().querySelector('.card-value').textContent;
    expect(previous).not.toContain(next);
    expect(Storage.loadDraft().recentHistory.story.setting.at(-1)).toBe(next);
  });

  it('전체 추첨을 반복해도 잠금이 유지되고 최근 슬롯 데이터가 갱신된다', () => {
    setup();
    const locked = document.querySelector('.result-card[data-slot="setting"]');
    click(locked.querySelector('.js-lock'));
    const before = locked.querySelector('.card-value').textContent;
    click(document.querySelector('#generateBtn'));
    click(document.querySelector('#generateBtn'));
    const draft = Storage.loadDraft();
    expect(draft.results.story.values.setting).toBe(before);
    expect(draft.recentHistory.story.setting).toEqual([]);
    expect(draft.recentHistory.story.event.length).toBeGreaterThan(0);
  });
});
