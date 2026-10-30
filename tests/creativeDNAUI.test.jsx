import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import App from '../src/App.jsx';
import Storage from '../src/storage.js';
import { getPool } from '../src/engine.js';

function open(page) {
  const button=Array.from(document.querySelectorAll('.workspace-tab')).find(el=>el.textContent.includes(page));
  expect(button).toBeTruthy();
  fireEvent.click(button);
}
const run=()=>render(<App animationMs={0}/>);
beforeEach(()=>{
  cleanup();
  localStorage.clear();
  window.scrollTo=()=>{};
});

describe('CREATIVE DNA — user-facing generation and preferences',()=>{
  it('settings lab persists detail, novelty and mood after navigation and reload',()=>{
    const mounted=run();open('SETUP');
    fireEvent.click(screen.getByRole('button',{name:/구체적.*배경/}));
    fireEvent.change(document.querySelector('#dnaNovelty'),{target:{value:'4'}});
    fireEvent.change(document.querySelector('#dnaMood'),{target:{value:'dark'}});
    expect(Storage.loadDraft().creativeDNA).toMatchObject({detail:'detailed',novelty:4,mood:'dark'});
    open('CHAOS');
    expect(document.querySelector('.dna-active-summary').textContent).toContain('구체적');
    mounted.unmount();run();open('SETUP');
    expect(document.querySelector('#dnaNovelty').value).toBe('4');
    expect(document.querySelector('#dnaMood').value).toBe('dark');
  });
  it('topic and style BAN selections can be saved and reversed',()=>{
    run();open('SETUP');
    const control=document.querySelector('.dna-ban-details');
    fireEvent.click(control.querySelector('summary'));
    const zombie=screen.getByLabelText('좀비·언데드');
    fireEvent.click(zombie);
    const dark=screen.getByLabelText('어두운 분위기 차단');
    fireEvent.click(dark);
    expect(Storage.loadDraft().creativeDNA.bannedTopics).toContain('undead');
    expect(Storage.loadDraft().creativeDNA.bannedStyles).toContain('dark');
    fireEvent.click(zombie);
    expect(Storage.loadDraft().creativeDNA.bannedTopics).not.toContain('undead');
  });
  it('card exclusion strictly prevents the same keyword on the next draw',()=>{
    run();
    const card=document.querySelector('.result-card[data-slot="setting"]');
    const first=card.querySelector('.card-value').textContent;
    fireEvent.click(card.querySelector('.js-ban'));
    expect(Storage.loadDraft().creativeDNA.bannedExact).toContain(first);
    fireEvent.click(document.querySelector('#generateBtn'));
    expect(card.querySelector('.card-value').textContent).not.toBe(first);
    open('SETUP');
    fireEvent.click(document.querySelector('.dna-ban-details summary'));
    expect(document.querySelector('.dna-exact-list').textContent).toContain(first);
  });
  it('liking a result persists user preference without banning it',()=>{
    const mounted=run();
    const first=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    fireEvent.click(document.querySelector('.result-card[data-slot="setting"] .js-like'));
    expect(Storage.loadDraft().creativeDNA.likes).toContain(first);
    mounted.unmount();run();
    expect(document.querySelector('.result-card[data-slot="setting"] .js-like').getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelectorAll('.result-card')).toHaveLength(8);
  });
  it('ECHO preserves one unpinned protagonist for one draw only',()=>{
    run();
    const hero=document.querySelector('.result-card[data-slot="protagonist"]');
    const first=hero.querySelector('.card-value').textContent;
    fireEvent.click(screen.getByRole('button',{name:'ECHO'}));
    expect(Storage.loadDraft().creativeDNA.mutation).toBe('echo');
    fireEvent.click(document.querySelector('#generateBtn'));
    expect(hero.querySelector('.card-value').textContent).toBe(first);
    expect(hero.classList.contains('is-locked')).toBe(false);
    expect(document.querySelector('.mutation-result').textContent).toContain('계승');
  });
  it('RIFT raises novelty temporarily while not changing user novelty slider or chaos mode',()=>{
    run();
    fireEvent.click(screen.getByRole('button',{name:'RIFT'}));
    fireEvent.click(document.querySelector('#generateBtn'));
    expect(document.querySelector('.mutation-result').textContent).toContain('RIFT');
    expect(Storage.loadDraft().creativeDNA.novelty).toBe(2);
    expect(Storage.loadDraft().chaos).toBe(3);
    expect(Storage.loadDraft().mode).toBe('hybrid');
  });
  it('hard bans never clear old results if an entire slot is blocked',()=>{
    const current=run();
    const before=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    const all=getPool('story','setting').map(item=>item.t);
    current.unmount();
    const prior=Storage.loadDraft();
    Storage.saveDraft({...prior,creativeDNA:{bannedExact:all,banMode:'hard'}});
    run();
    fireEvent.click(document.querySelector('#generateBtn'));
    expect(document.querySelector('#toast').textContent).toContain('후보가 없는 항목');
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe(before);
  });
});
