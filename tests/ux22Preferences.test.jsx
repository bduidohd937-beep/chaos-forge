import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from '../src/App.jsx';
import Storage from '../src/storage.js';

const run = () => render(<App animationMs={0}/>);
const click = (target) => fireEvent.click(target);
function go(name) {
  const button = Array.from(document.querySelectorAll('.workspace-tab'))
    .find(node => node.textContent.includes(name));
  if(!button) throw new Error('Missing workspace: '+name);
  click(button);
}
beforeEach(() => {
  cleanup();
  localStorage.clear();
  window.scrollTo=()=>{};
});

describe('UX 2.2 — understandable in-place creative preferences', () => {
  it('defaults to compact CHAOS and opens distinct preference and BAN panels without navigation', () => {
    run();
    expect(document.querySelector('.chaos-preference-editor')).toBeNull();
    const taste=document.querySelector('#openPreferencesBtn');
    const ban=document.querySelector('#openBanManagerBtn');
    expect(taste.getAttribute('aria-expanded')).toBe('false');
    expect(ban.getAttribute('aria-expanded')).toBe('false');
    click(taste);
    expect(taste.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
    expect(screen.getByRole('heading',{name:'내 취향으로 추천 조절'})).not.toBeNull();
    expect(document.querySelector('#dnaNovelty')).not.toBeNull();
    expect(document.querySelector('.ban-panel')).toBeNull();
    click(ban);
    expect(taste.getAttribute('aria-expanded')).toBe('false');
    expect(ban.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.preference-panel')).toBeNull();
    expect(screen.getByRole('heading',{name:'나오지 않았으면 하는 소재'})).not.toBeNull();
    expect(document.querySelector('.ban-panel .dna-ban-grid')).not.toBeNull();
    click(screen.getByRole('button',{name:/편집 닫기/}));
    expect(document.querySelector('.chaos-preference-editor')).toBeNull();
  });

  it('taste weights update without adding banned topics and persist after reload', () => {
    const mounted=run();
    const before=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    click(document.querySelector('#openPreferencesBtn'));
    fireEvent.change(document.querySelector('#dnaNovelty'),{target:{value:'4'}});
    fireEvent.change(document.querySelector('#dnaMood'),{target:{value:'comic'}});
    expect(Storage.loadDraft().creativeDNA).toMatchObject({
      novelty:4,mood:'comic',bannedTopics:[],bannedStyles:[],bannedExact:[]
    });
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe(before);
    mounted.unmount();
    run();
    click(document.querySelector('#openPreferencesBtn'));
    expect(document.querySelector('#dnaNovelty').value).toBe('4');
    expect(document.querySelector('#dnaMood').value).toBe('comic');
  });

  it('BAN manager starts expanded inside CHAOS; exact phrases and topic bans are independently reversible', () => {
    run();
    const first=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    click(document.querySelector('#openBanManagerBtn'));
    expect(document.querySelector('.ban-manage-toggle').getAttribute('aria-expanded')).toBe('true');
    click(screen.getByLabelText('좀비·언데드'));
    fireEvent.change(document.querySelector('#dnaExactInput'),{target:{value:'싫은 표현'}});
    click(screen.getByRole('button',{name:'문구 제외'}));
    expect(Storage.loadDraft().creativeDNA.bannedTopics).toContain('undead');
    expect(Storage.loadDraft().creativeDNA.bannedExact).toContain('싫은 표현');
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe(first);
    click(screen.getByRole('button',{name:'싫은 표현 차단 해제'}));
    click(screen.getByLabelText('좀비·언데드'));
    expect(Storage.loadDraft().creativeDNA.bannedTopics).toEqual([]);
    expect(Storage.loadDraft().creativeDNA.bannedExact).toEqual([]);
  });

  it('explicit hard and soft choices preserve exact bans and current written text', () => {
    run();
    const first=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    click(document.querySelector('#openBanManagerBtn'));
    click(screen.getByLabelText('회귀·시간 반복'));
    click(screen.getByRole('button',{name:/출현 줄이기/}));
    expect(Storage.loadDraft().creativeDNA).toMatchObject({banMode:'soft',bannedTopics:['regression']});
    const field=document.querySelector('#dnaExactInput');
    fireEvent.change(field,{target:{value:'싫은 개별 문구'}});
    click(screen.getByRole('button',{name:'문구 제외'}));
    expect(Storage.loadDraft().creativeDNA.bannedExact).toEqual(['싫은 개별 문구']);
    click(screen.getByRole('button',{name:/완전 차단/}));
    expect(Storage.loadDraft().creativeDNA).toMatchObject({banMode:'hard',bannedExact:['싫은 개별 문구']});
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe(first);
  });

  it('SETUP shows separate preference and BAN sections; BAN is a labeled button not a hidden summary', () => {
    run();go('SETUP');
    click(screen.getByRole('button',{name:/고급 설정/}));
    expect(document.querySelector('.preference-panel')).not.toBeNull();
    expect(document.querySelector('.ban-panel')).not.toBeNull();
    expect(document.querySelector('.ban-panel .ban-manage-toggle').getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.ban-panel .dna-ban-grid')).toBeNull();
    click(document.querySelector('.ban-manage-toggle'));
    expect(document.querySelector('.ban-panel .dna-ban-grid')).not.toBeNull();
    expect(document.querySelector('#dnaNovelty')).not.toBeNull();
    click(document.querySelector('.ban-manage-toggle'));
    expect(document.querySelector('.ban-panel .dna-ban-grid')).toBeNull();
    expect(document.querySelector('#dnaNovelty')).not.toBeNull();
  });

  it('likes can be reversed from preference panel while per-card exclusion remains independently stored', () => {
    run();
    const card=document.querySelector('.result-card[data-slot="setting"]');
    const keyword=card.querySelector('.card-value').textContent;
    click(card.querySelector('.js-like'));
    click(card.querySelector('.js-ban'));
    expect(Storage.loadDraft().creativeDNA.likes).toContain(keyword);
    expect(Storage.loadDraft().creativeDNA.bannedExact).toContain(keyword);
    click(document.querySelector('#openPreferencesBtn'));
    click(screen.getByRole('button',{name:`${keyword} 좋아요 취소`}));
    expect(Storage.loadDraft().creativeDNA.likes).not.toContain(keyword);
    expect(Storage.loadDraft().creativeDNA.bannedExact).toContain(keyword);
    click(document.querySelector('#openBanManagerBtn'));
    expect(document.querySelector('.dna-exact-list').textContent).toContain(keyword);
  });

  it('inline preference changes do not affect existing locked cards or unrelated FORGE writing', () => {
    run();
    const old=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    click(document.querySelector('.result-card[data-slot="setting"] .js-lock'));
    go('FORGE');
    fireEvent.change(document.querySelector('#forgeTitleInput'),{target:{value:'보존해야 할 기획서'}});
    go('CHAOS');
    click(document.querySelector('#openBanManagerBtn'));
    click(screen.getByLabelText('좀비·언데드'));
    click(document.querySelector('#openPreferencesBtn'));
    fireEvent.change(document.querySelector('#dnaNovelty'),{target:{value:'3'}});
    expect(document.querySelector('.result-card[data-slot="setting"].is-locked')).not.toBeNull();
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe(old);
    go('FORGE');
    expect(document.querySelector('#forgeTitleInput').value).toBe('보존해야 할 기획서');
  });
});
