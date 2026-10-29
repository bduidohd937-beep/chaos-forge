import { describe, it, expect, beforeEach, vi } from 'vitest';
import Storage from '../src/storage.js';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import App from '../src/App.jsx';

function setup() {
  const utils = render(<App animationMs={0} />);
  const cards = () => Array.from(utils.container.querySelectorAll('.result-card'));
  const values = () => cards().map((card) => card.querySelector('.card-value').textContent);
  return { ...utils, cards, values };
}

const click = (node) => fireEvent.click(node);

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
    click(screen.getByRole('radio', { name: '장르 맞춤' }));
    expect(document.querySelector('#chaosRange').disabled).toBe(true);
    expect(document.querySelector('#chaosControl').classList.contains('is-disabled')).toBe(true);

    click(screen.getByRole('radio', { name: '하이브리드' }));
    expect(document.querySelector('#chaosRange').disabled).toBe(false);

    fireEvent.change(document.querySelector('#chaosRange'), { target: { value: '5' } });
    expect(document.querySelector('#chaosValue').textContent).toBe('5');
  });

  it('탭 전환 시 해당 생성기의 항목 수와 장르 목록이 바뀐다', () => {
    const { cards } = setup();
    click(screen.getByRole('tab', { name: 'HERO' }));
    expect(cards()).toHaveLength(9);
    expect(screen.getByRole('tab', { name: 'HERO' }).getAttribute('aria-selected')).toBe('true');

    const genreOptions = Array.from(document.querySelectorAll('#genreSelect option')).map((o) => o.value);
    expect(genreOptions).toHaveLength(8);
    expect(genreOptions).toContain('RPG');

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
    click(screen.getByText('불러오기'));

    expect(screen.getByRole('tab', { name: 'HERO' }).getAttribute('aria-selected')).toBe('true');
    expect(values()).toEqual(heroValues);
  });

  it('사용자 키워드를 추가하면 생성 결과에 등장한다', () => {
    const { cards } = setup();

    fireEvent.change(document.querySelector('#customGenerator'), { target: { value: 'story' } });
    fireEvent.change(document.querySelector('#customSlot'), { target: { value: 'setting' } });
    fireEvent.change(document.querySelector('#customText'), { target: { value: '고래가 사는 도시' } });

    const chip = document.querySelector('#customGenres input');
    fireEvent.click(chip);
    fireEvent.submit(document.querySelector('#customForm'));

    expect(document.querySelector('#customCount').textContent).toBe('1');
    expect(document.querySelector('#customList').textContent).toContain('고래가 사는 도시');

    click(screen.getByRole('radio', { name: '장르 맞춤' }));
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

    fireEvent.change(document.querySelector('#customText'), { target: { value: '새 키워드' } });
    fireEvent.submit(document.querySelector('#customForm'));

    cleanup();
    render(<App animationMs={0} />);

    expect(document.querySelector('#ideaCount').textContent).toBe('1');
    expect(document.querySelector('#ideaList').textContent).toContain('유지 테스트');
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
      expect(document.querySelector('#ideaCount').textContent).toBe('0');
    } finally {
      saveDraft.mockRestore();
      saveIdea.mockRestore();
    }
  });
});


describe('V1.2 CHAOS MODE', () => {
  it('폭주 생성은 하이브리드 혼돈 5로 전환하며 잠금은 유지한다', () => {
    const { cards } = setup();
    click(screen.getByRole('radio', { name: '장르 맞춤' }));
    const target = cards()[1];
    click(target.querySelector('.js-lock'));
    const preserved = target.querySelector('.card-value').textContent;

    click(document.querySelector('#overdriveBtn'));
    expect(screen.getByRole('radio', { name: '하이브리드' }).getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('#chaosValue').textContent).toBe('5');
    expect(target.querySelector('.card-value').textContent).toBe(preserved);
    expect(target.classList.contains('is-locked')).toBe(true);
  });

  it('모든 카드 잠금 시 폭주와 전체 생성이 설정을 바꾸지 않는다', () => {
    const { cards } = setup();
    cards().forEach((card) => click(card.querySelector('.js-lock')));
    const before = cards().map((card) => card.querySelector('.card-value').textContent);
    click(document.querySelector('#overdriveBtn'));
    expect(document.querySelector('#toast').textContent).toContain('모든 항목');
    expect(document.querySelector('#chaosValue').textContent).toBe('3');
    click(document.querySelector('#generateBtn'));
    expect(cards().map((card) => card.querySelector('.card-value').textContent)).toEqual(before);
  });

  it('직접 편집한 값은 콘셉트 프리뷰에도 바로 반영된다', () => {
    const { cards } = setup();
    const setting = cards().find((card) => card.dataset.slot === 'setting').querySelector('.card-value');
    setting.textContent = '사라진 달의 도시';
    fireEvent.input(setting);
    expect(document.querySelector('.concept-preview').textContent).toContain('사라진 달의 도시');
    expect(document.querySelector('.preview-sections')).not.toBeNull();
    expect(document.querySelector('.forge-meter').getAttribute('aria-label')).toContain('전체 8개');
  });

  it('탭별로 다른 콘셉트 프리뷰를 보여준다', () => {
    setup();
    const first = document.querySelector('.preview-sections').textContent;
    click(screen.getByRole('tab', { name: 'HERO' }));
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
