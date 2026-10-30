import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import App from '../src/App.jsx';
import Storage from '../src/storage.js';

const run = () => render(<App animationMs={0}/>);
const click = (el) => fireEvent.click(el);
const go = name => click(Array.from(document.querySelectorAll('.workspace-tab'))
  .find(item => item.textContent.includes(name)));
beforeEach(() => {
  cleanup();
  localStorage.clear();
  window.scrollTo = () => {};
  vi.restoreAllMocks();
});

describe('UX 2.1 — first experience and legacy draft recognition', () => {
  it('labels first-time seeded data as a sample, with all cards unlocked', () => {
    run();
    expect(document.querySelector('#firstIdeaBtn')).not.toBeNull();
    expect(document.querySelector('.session-guide').textContent).toContain('샘플 미리보기');
    expect(document.querySelectorAll('.result-card')).toHaveLength(8);
    expect(document.querySelectorAll('.result-card.is-locked')).toHaveLength(0);
    expect(document.querySelectorAll('.card-lock-state')).toHaveLength(8);
    expect(document.querySelector('.card-lock-state').textContent).toContain('열림');
    expect(Storage.loadDraft().sessionPhase).toBe('sample');
  });

  it('first draw starts a real draft without creating meaningless sample archive', () => {
    run();
    click(document.querySelector('#firstIdeaBtn'));
    expect(document.querySelector('#firstIdeaBtn')).toBeNull();
    expect(Storage.loadDraft().sessionPhase).toBe('active');
    expect(Storage.loadDraftArchives()).toHaveLength(0);
    expect(document.querySelectorAll('.result-card.is-locked')).toHaveLength(0);
    expect(document.querySelector('#generateBtn')).not.toBeNull();
  });

  it('recognizes prior V2/legacy draft and resumes without silently changing values or locks', () => {
    Storage.saveDraft({
      generatorId:'story',mode:'hybrid',genre:'판',chaos:3,workspacePage:'chaos',
      results:{story:{values:{setting:'이전 세계관',protagonist:'기억하는 인물'},locks:{setting:true}}}
    });
    run();
    expect(document.querySelector('.session-guide').textContent).toContain('자동으로 복원');
    const card=document.querySelector('.result-card[data-slot="setting"]');
    expect(card.querySelector('.card-value').textContent).toBe('이전 세계관');
    expect(card.querySelector('.card-lock-state').textContent).toContain('고정');
    expect(card.querySelector('.js-lock').getAttribute('aria-pressed')).toBe('true');
    click(document.querySelector('#resumeIdeaBtn'));
    expect(document.querySelector('.session-guide')).toBeNull();
    expect(card.querySelector('.card-value').textContent).toBe('이전 세계관');
    expect(Storage.loadDraftArchives()).toHaveLength(0);
  });

  it('lock badge and global all-locked warning explain how to permit rerolls', () => {
    run();
    const cards=Array.from(document.querySelectorAll('.result-card'));
    cards.forEach(card => click(card.querySelector('.js-lock')));
    expect(document.querySelector('.all-locked-help').textContent).toContain('모든 카드가 고정');
    expect(document.querySelectorAll('.card-lock-state.is-locked')).toHaveLength(8);
    const setting=document.querySelector('.result-card[data-slot="setting"]');
    expect(setting.querySelector('.js-lock').getAttribute('title')).toContain('다음 추첨');
    click(document.querySelector('#generateBtn'));
    expect(document.querySelector('#toast').textContent).toContain('모든 항목');
    click(screen.getByRole('button',{name:'전체 잠금 해제하기'}));
    expect(document.querySelector('.all-locked-help')).toBeNull();
    expect(document.querySelectorAll('.result-card.is-locked')).toHaveLength(0);
  });
});

describe('UX 2.1 — safe full-draft checkpoints and return path', () => {
  it('new work requires explicit confirmation and archives the full previous session', () => {
    run();
    // Put actual authored content in both CHAOS and FORGE before new work.
    const setting=document.querySelector('.result-card[data-slot="setting"]');
    const oldValue=setting.querySelector('.card-value').textContent;
    click(setting.querySelector('.js-lock'));
    go('FORGE');
    fireEvent.change(document.querySelector('#forgeTitleInput'),{target:{value:'잃어버리면 안 되는 작품'}});
    fireEvent.change(document.querySelector('#forgeNotesInput'),{target:{value:'오래 쓴 기획 노트'}});
    go('CHAOS');
    const current=Storage.loadDraft();
    expect(current.results.story.locks.setting).toBe(true);

    click(document.querySelector('#newIdeaBtn'));
    expect(document.querySelector('.new-idea-confirm').textContent).toContain('이전 작업 기록');
    expect(Storage.loadDraftArchives()).toHaveLength(0);
    click(screen.getByRole('button',{name:'취소'}));
    expect(document.querySelector('.new-idea-confirm')).toBeNull();
    expect(setting.querySelector('.card-value').textContent).toBe(oldValue);
    click(document.querySelector('#newIdeaBtn'));
    click(document.querySelector('#confirmNewIdeaBtn'));

    expect(Storage.loadDraftArchives()).toHaveLength(1);
    const old=Storage.loadDraftArchives()[0].draft;
    expect(old.forgeDocs.story.title).toBe('잃어버리면 안 되는 작품');
    expect(old.forgeDocs.story.notes).toBe('오래 쓴 기획 노트');
    expect(old.results.story.values.setting).toBe(oldValue);
    expect(old.results.story.locks.setting).toBe(true);
    expect(document.querySelectorAll('.result-card.is-locked')).toHaveLength(0);
    go('FORGE');
    expect(document.querySelector('#forgeTitleInput').value).toBe('');
    go('CHAOS');
    expect(document.querySelector('.session-history').textContent).toContain('잃어버리면 안 되는 작품');
  });

  it('restoring an archive preserves the current idea as another checkpoint', () => {
    run();
    const card=document.querySelector('.result-card[data-slot="setting"]');
    const first=card.querySelector('.card-value').textContent;
    click(card.querySelector('.js-lock'));
    go('FORGE');
    fireEvent.change(document.querySelector('#forgeTitleInput'),{target:{value:'오래된 이야기'}});
    go('CHAOS');
    click(document.querySelector('#newIdeaBtn'));
    click(document.querySelector('#confirmNewIdeaBtn'));
    const old=Storage.loadDraftArchives()[0];
    const newValue=document.querySelector('.result-card[data-slot="setting"] .card-value').textContent;
    click(document.querySelector('.session-history summary'));
    click(screen.getByRole('button',{name:/오래된 이야기 이전 작업 불러오기/}));
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe(first);
    expect(document.querySelector('.result-card[data-slot="setting"].is-locked')).not.toBeNull();
    expect(Storage.loadDraftArchives().length).toBe(2);
    expect(Storage.loadDraftArchives()[0].draft.results.story.values.setting).toBe(newValue);
    go('FORGE');
    expect(document.querySelector('#forgeTitleInput').value).toBe('오래된 이야기');
    expect(Storage.getDraftArchive(old.id).draft.forgeDocs.story.title).toBe('오래된 이야기');
  });

  it('does not clear or overwrite any active state when archiving fails', () => {
    run();
    const card=document.querySelector('.result-card[data-slot="setting"]');
    const value=card.querySelector('.card-value').textContent;
    click(card.querySelector('.js-lock'));
    vi.spyOn(Storage,'archiveDraft').mockReturnValue(null);
    click(document.querySelector('#newIdeaBtn'));
    click(document.querySelector('#confirmNewIdeaBtn'));
    expect(document.querySelector('#toast').textContent).toContain('보관하지 못했');
    expect(document.querySelector('.new-idea-confirm')).not.toBeNull();
    expect(card.querySelector('.card-value').textContent).toBe(value);
    expect(card.classList.contains('is-locked')).toBe(true);
    expect(Storage.loadDraftArchives()).toHaveLength(0);
  });

  it('restored work survives reload and specialized FORGE docs for other generators are untouched', () => {
    run();
    go('FORGE');
    fireEvent.change(document.querySelector('#forgeTitleInput'),{target:{value:'스토리 설정집'}});
    go('SETUP');
    click(screen.getByRole('button',{name:'GAME 생성기 선택'}));
    go('FORGE');
    fireEvent.change(document.querySelector('#forgeTitleInput'),{target:{value:'게임 설계서'}});
    go('CHAOS');
    click(document.querySelector('#newIdeaBtn'));
    click(document.querySelector('#confirmNewIdeaBtn'));
    expect(Storage.loadDraft().forgeDocs.story.title).toBe('스토리 설정집');
    expect(Storage.loadDraft().forgeDocs.game).toBeUndefined();
    const mounted=document.querySelector('.result-card');
    expect(mounted).not.toBeNull();
    cleanup();
    run();
    go('FORGE');
    expect(document.querySelector('#forgeTitleInput').value).toBe('');
    go('SETUP');
    click(screen.getByRole('button',{name:'STORY 생성기 선택'}));
    go('FORGE');
    expect(document.querySelector('#forgeTitleInput').value).toBe('스토리 설정집');
    expect(Storage.loadDraftArchives()[0].draft.forgeDocs.game.title).toBe('게임 설계서');
  });
});
