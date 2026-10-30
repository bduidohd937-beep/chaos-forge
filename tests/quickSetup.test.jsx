import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import App from '../src/App.jsx';
import Storage from '../src/storage.js';

const click = (el) => fireEvent.click(el);
const start = () => render(<App animationMs={0} />);
function go(name) {
  const tab = Array.from(document.querySelectorAll('.workspace-tab'))
    .find(item => item.textContent.includes(name));
  if (!tab) throw new Error('Missing workspace ' + name);
  click(tab);
}
function expandAdvanced() {
  click(screen.getByRole('button', { name: /고급 설정/ }));
}
function expandSubs() {
  click(screen.getByRole('button', { name: /서브 장르 선택/ }));
}
beforeEach(() => {
  cleanup();
  localStorage.clear();
  window.scrollTo = () => {};
});

describe('UX REFORGE — three-step setup and progressive disclosure', () => {
  it('offers one compact start path while optional controls are initially collapsed', () => {
    start(); go('SETUP');
    expect(screen.getByRole('heading', { name: /세 가지만 정하고/ })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '무엇을 만들까요?' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '어떤 장르인가요?' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: '어떤 느낌으로 만들까요?' })).not.toBeNull();
    expect(document.querySelectorAll('.setup-generator')).toHaveLength(4);
    expect(document.querySelectorAll('.quick-style .setup-mode')).toHaveLength(3);
    expect(document.querySelectorAll('.quick-detail-choices .dna-choice')).toHaveLength(3);
    expect(document.querySelector('.quick-setup-launch .setup-start')).not.toBeNull();
    expect(document.querySelector('#subGenreSearch')).toBeNull();
    expect(document.querySelector('#dnaNovelty')).toBeNull();
    expect(document.querySelector('.ban-panel')).toBeNull();
    expect(screen.getByRole('button', { name: /고급 설정/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('uses compact four-pill type switcher above the genre/style panels', () => {
    start(); go('SETUP');
    const switcher = document.querySelector('.quick-generator-step .quick-generator-tabs');
    expect(switcher).not.toBeNull();
    expect(switcher.getAttribute('aria-label')).toBe('창작 유형 선택');
    expect(switcher.querySelectorAll('.setup-generator')).toHaveLength(4);
    expect(switcher.querySelectorAll('.setup-generator small')).toHaveLength(0);
    expect(document.querySelector('.quick-setup-flow').firstElementChild.classList.contains('quick-generator-step')).toBe(true);
    expect(document.querySelector('.quick-setup-grid').children).toHaveLength(2);
    expect(document.querySelector('.quick-setup-grid .quick-style')).not.toBeNull();
    expect(document.querySelector('.quick-setup-grid #genreSelect')).not.toBeNull();
    const game = screen.getByRole('button', { name: 'GAME 생성기 선택' });
    click(game);
    expect(game.getAttribute('aria-pressed')).toBe('true');
    expect(Storage.loadDraft().generatorId).toBe('game');
    expect(document.querySelector('.quick-setup-review').textContent).toContain('GAME');
    expect(screen.getByRole('button', { name: 'STORY 생성기 선택' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps the selected generator across CHAOS and shows its specialist FORGE structure', () => {
    start(); go('SETUP');
    click(screen.getByRole('button', { name: 'HERO 생성기 선택' }));
    click(screen.getByRole('button', { name: /이 설정으로 창조하기/ }));
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(screen.getByRole('tab', { name: 'HERO' }).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelectorAll('.result-card')).toHaveLength(9);
    go('FORGE');
    fireEvent.click(screen.getByRole('button', { name: '전문 설정집 펼치기' }));
    expect(document.querySelector('.forge-outline').textContent).toContain('스킬 구성');
    go('SETUP');
    expect(screen.getByRole('button', { name: 'HERO 생성기 선택' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('groups creation recipe and DNA on one context strip and mutation with draw actions', () => {
    start();
    const context = document.querySelector('.chaos-context-strip');
    expect(context.querySelector('.chaos-formula')).not.toBeNull();
    expect(context.querySelector('.dna-active-summary')).not.toBeNull();
    const deck = document.querySelector('.chaos-control-deck');
    expect(deck.querySelector('.mutation-controls-wrap')).not.toBeNull();
    expect(deck.querySelector('#generateBtn')).not.toBeNull();
    expect(deck.querySelector('.reel-presets')).not.toBeNull();
    expect(document.querySelector('.mutation-deck')).toBeNull();
    click(screen.getByRole('button', { name: 'RIFT' }));
    expect(Storage.loadDraft().creativeDNA.mutation).toBe('rift');
    click(screen.getByRole('button', { name: 'ECHO' }));
    expect(Storage.loadDraft().creativeDNA.mutation).toBe('echo');
    expect(document.querySelectorAll('.result-card')).toHaveLength(8);
  });

  it('user can create without opening any optional controls', () => {
    start(); go('SETUP');
    fireEvent.change(document.querySelector('#genreSelect'), { target: { value: '미' } });
    click(screen.getByRole('radio', { name: '장르 맞춤' }));
    click(screen.getByRole('button', { name: /간결.*소재 중심/ }));
    const summary = document.querySelector('.quick-setup-review').textContent;
    expect(summary).toContain('미스터리');
    expect(summary).toContain('장르 맞춤');
    expect(summary).toContain('간결');
    click(screen.getByRole('button', { name: /이 설정으로 창조하기/ }));
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(Storage.loadDraft().creativeDNA.detail).toBe('brief');
    expect(Storage.loadDraft().genreSelection.main).toBe('미');
    expect(Storage.loadDraft().mode).toBe('genre');
    expect(document.querySelectorAll('.result-card')).toHaveLength(8);
  });

  it('subgenre selector expands on request, preserves selection when closed and allows removing chip', () => {
    start(); go('SETUP');
    expandSubs();
    const romance = Array.from(document.querySelectorAll('.genre-tile'))
      .find(item => item.textContent.includes('로맨스'));
    click(romance);
    expect(document.querySelector('.quick-sub-summary').textContent).toContain('로맨스');
    click(screen.getByRole('button', { name: '서브 장르 닫기' }));
    expect(document.querySelector('.genre-tile')).toBeNull();
    expect(Storage.loadDraft().genreSelection.subs).toEqual(['로']);
    click(screen.getByRole('button', { name: '로맨스 서브 장르 제거' }));
    expect(Storage.loadDraft().genreSelection.subs).toEqual([]);
    expandSubs();
    expect(document.querySelector('.genre-tile.selected')).toBeNull();
  });

  it('advanced drawer exposes chaos, originality, mood and BAN; hiding it does not reset values', () => {
    start(); go('SETUP');
    expandAdvanced();
    expect(screen.getByRole('button', { name: /고급 설정/ }).getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('#chaosRange')).not.toBeNull();
    fireEvent.change(document.querySelector('#chaosRange'), { target: { value: '5' } });
    fireEvent.change(document.querySelector('#dnaNovelty'), { target: { value: '4' } });
    fireEvent.change(document.querySelector('#dnaMood'), { target: { value: 'bright' } });
    const banDetail = document.querySelector('.ban-panel');
    click(banDetail.querySelector('.ban-manage-toggle'));
    click(screen.getByLabelText('좀비·언데드'));
    expect(Storage.loadDraft().creativeDNA.bannedTopics).toContain('undead');
    expandAdvanced();
    expect(document.querySelector('#chaosRange')).toBeNull();
    expect(document.querySelector('.quick-advanced-summary').textContent).toContain('밴 1개');
    expect(Storage.loadDraft().chaos).toBe(5);
    expandAdvanced();
    expect(document.querySelector('#chaosRange').value).toBe('5');
    expect(document.querySelector('#dnaNovelty').value).toBe('4');
    expect(document.querySelector('#dnaMood').value).toBe('bright');
    expect(document.querySelector('.ban-panel')).not.toBeNull();
  });

  it('CHAOS preference and BAN editing opens inline without navigating away from results', () => {
    start();
    click(document.querySelector('#openPreferencesBtn'));
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(document.querySelector('#dnaNovelty')).not.toBeNull();
    click(document.querySelector('#openBanManagerBtn'));
    expect(document.querySelector('#dnaNovelty')).toBeNull();
    expect(document.querySelector('.ban-panel .dna-ban-grid')).not.toBeNull();
    click(screen.getByRole('button', { name: /편집 닫기/ }));
    expect(document.querySelector('.chaos-preference-editor')).toBeNull();
    go('SETUP');
    expect(document.querySelector('#dnaNovelty')).toBeNull();
  });

  it('persisted legacy DNA and non-DNA data survive the new compact view', () => {
    Storage.saveDraft({
      generatorId: 'story', genre:'판', workspacePage:'setup', mode:'hybrid', chaos:4,
      genreSelection:{main:'판',subs:['로','미']},
      creativeDNA:{detail:'detailed',novelty:4,mood:'comic',banMode:'hard',
        bannedTopics:['reincarnation'],bannedStyles:[],bannedExact:['몰락한 기사'],likes:['다정한 분석가']},
      forgeDocs:{story:{title:'이전 소설',notes:'기존 작성 자료'}},
      results:{story:{values:{setting:'고대 도시'},locks:{setting:true}}}
    });
    const first = start();
    expect(document.querySelector('.quick-setup-review').textContent).toContain('로맨스');
    expect(document.querySelector('.quick-setup-review').textContent).toContain('구체적');
    expect(document.querySelector('.quick-advanced-summary').textContent).toContain('밴 2개');
    expect(document.querySelector('#dnaNovelty')).toBeNull();
    expandAdvanced();
    expect(document.querySelector('#dnaNovelty').value).toBe('4');
    first.unmount();
    start();
    expect(document.querySelector('#dnaNovelty')).toBeNull();
    go('FORGE');
    expect(document.querySelector('#forgeTitleInput').value).toBe('이전 소설');
    expect(document.querySelector('#forgeNotesInput').value).toBe('기존 작성 자료');
    go('CHAOS');
    expect(document.querySelector('.result-card[data-slot="setting"].is-locked')).not.toBeNull();
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe('고대 도시');
  });
});
