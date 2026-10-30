import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from '../src/App.jsx';
import WorkspaceStore from '../src/storage.js';
import {
  WORKSPACE_BACKUP_SCHEMA, WORKSPACE_BACKUP_SCOPE,
  buildWorkspaceBackup, inspectWorkspaceBackup
} from '../src/workspaceBackup.js';

// Storage's scope is selected at module load. JSDOM defaults to the root
// path, whereas real V2 runs under /preview/v2/.
const storageKey = name => window.location.pathname.includes('/preview/v2/')
  ? 'chaosforge.reforge-preview.v2.' + name
  : 'chaosforge.' + name + '.v1';
const fixture = () => ({
  draft: {
    version: 1, generatorId: 'story', mode: 'hybrid', genre: '판', chaos: 3,
    workspacePage:'forge', sessionPhase:'active',
    results: { story: { values: {setting:'도시'}, locks: {setting:true} } },
    forgeDocs: { story: {
      title: '소중한 작품', notes: '오래된 자유 메모',
      fields: {logline:'복원할 로그라인', reveal:'비밀 반전'}
    } },
    creativeDNA: {bannedExact:['이 단어는 제외'], likes:['반짝이는 소재']},
    recentHistory: { story: {setting:['유리 성', '도시']} }
  },
  ideas: [{id:'idea-1',title:'보관 아이디어',generator:'story',values:{setting:'돌산'}}],
  custom: [{id:'custom-1',generator:'story',slot:'setting',text:'내 키워드',genres:['판']}],
  archives: [{id:'archive-1',label:'이전 장면',savedAt:123456789,
    generatorId:'story',draft:{
      version: 1, generatorId:'story',
      results:{story:{values:{setting:'예전 도시'},locks:{setting:true}}},
      forgeDocs:{story:{title:'옛 작품',fields:{logline:'오래된 이야기'}}}
    }}]
});
const start = () => render(<App animationMs={0}/>);
function toLibrary() {
  fireEvent.click([...document.querySelectorAll('.workspace-tab')].find(item=>item.textContent.includes('LIBRARY')));
}
function chooseText(text, filename='backup.json') {
  const file = new File([text],filename,{type:'application/json'});
  Object.defineProperty(file,'text',{value:()=>Promise.resolve(text)});
  fireEvent.change(document.querySelector('#fullBackupFile'),{target:{files:[file]}});
}

beforeEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  window.scrollTo=()=>{};
});

describe('UX 2.7 — complete V2 backup and crash-safe restore', () => {
  it('includes current draft, full FORGE fields, lock, preferences, archives, ideas and custom keywords', () => {
    const original=fixture();
    const packageFile=buildWorkspaceBackup(original);
    expect(packageFile.schema).toBe(WORKSPACE_BACKUP_SCHEMA);
    expect(packageFile.scope).toBe(WORKSPACE_BACKUP_SCOPE);
    const scanned=inspectWorkspaceBackup(JSON.stringify(packageFile));
    expect(scanned.summary).toMatchObject({ideas:1,custom:1,archives:1,forgeDocs:1});
    expect(scanned.backup.data).toEqual(original);
    expect(scanned.backup.data.archives[0].draft.forgeDocs.story.title).toBe('옛 작품');
    expect(scanned.backup.data.draft.results.story.locks.setting).toBe(true);
  });

  it('rejects corrupt, incompatible or unsupported backup JSON before mutating any local storage', () => {
    const original=fixture();
    WorkspaceStore.saveDraft(original.draft);
    WorkspaceStore.saveIdea({title:'기존 자료',generator:'story',values:{setting:'기존'}});
    const before={draft:localStorage.getItem(storageKey('draft')),ideas:localStorage.getItem(storageKey('ideas'))};
    const good=buildWorkspaceBackup(original);
    const broken=JSON.parse(JSON.stringify(good));
    broken.data.draft.forgeDocs.story.fields.logline='파일을 수정함';
    const wrong=JSON.parse(JSON.stringify(good));
    wrong.schema='chaos-forge/workspace-backup@999';
    const different=JSON.parse(JSON.stringify(good));
    different.scope='chaosforge.draft.v1';
    const invalid=JSON.parse(JSON.stringify(good));
    invalid.data.archives[0].draft.results.story.values.setting=7;
    for (const input of ['{bad json',broken,wrong,different,invalid]) {
      expect(()=>WorkspaceStore.restoreFullBackup(input)).toThrow();
    }
    expect(localStorage.getItem(storageKey('draft'))).toBe(before.draft);
    expect(localStorage.getItem(storageKey('ideas'))).toBe(before.ideas);
    expect(localStorage.getItem(storageKey('restore-transaction'))).toBeNull();
  });

  it('strict backup capture refuses corrupted stored collections rather than silently dropping them', () => {
    const original=fixture();
    localStorage.setItem(storageKey('ideas'),'{invalid');
    expect(()=>WorkspaceStore.createFullBackup(original.draft)).toThrow(/손상/);
    expect(localStorage.getItem(storageKey('ideas'))).toBe('{invalid');
  });

  it('restores all four storage collections and verifies they match the selected backup', () => {
    WorkspaceStore.saveDraft(fixture().draft);
    WorkspaceStore.saveIdea({title:'교체될 아이디어',generator:'story',values:{setting:'현재'}});
    const backup=buildWorkspaceBackup(fixture());
    const result=WorkspaceStore.restoreFullBackup(backup);
    expect(result.summary).toMatchObject({ideas:1,custom:1,archives:1});
    expect(WorkspaceStore.loadDraft().forgeDocs.story.fields.reveal).toBe('비밀 반전');
    expect(WorkspaceStore.loadDraft().results.story.locks.setting).toBe(true);
    expect(WorkspaceStore.loadIdeas()[0].title).toBe('보관 아이디어');
    expect(WorkspaceStore.loadCustom()[0].text).toBe('내 키워드');
    expect(WorkspaceStore.loadDraftArchives()[0].draft.forgeDocs.story.title).toBe('옛 작품');
    expect(localStorage.getItem(storageKey('restore-transaction'))).toBeNull();
  });

  it('rolls back the entire workspace if any write fails after the journal is saved', () => {
    const seed=fixture();
    WorkspaceStore.saveDraft(seed.draft);
    WorkspaceStore.saveIdea({title:'돌아올 생각',generator:'story',values:{setting:'기존'}});
    WorkspaceStore.addCustom({generator:'story',slot:'setting',text:'기존 키워드'});
    const before=Object.fromEntries(['draft','ideas','custom','draft-archives']
      .map(k=>[k,localStorage.getItem(storageKey(k))]));
    const realSet=window.Storage.prototype.setItem;
    let failed=false;
    const spy=vi.spyOn(window.Storage.prototype,'setItem').mockImplementation(function(key,value) {
      if(!failed && key===storageKey('custom')) {
        failed=true;
        throw new Error('QuotaExceededError');
      }
      return realSet.call(this,key,value);
    });
    expect(()=>WorkspaceStore.restoreFullBackup(buildWorkspaceBackup(seed))).toThrow(/되돌렸습니다/);
    spy.mockRestore();
    expect(failed).toBe(true);
    for (const [key,raw] of Object.entries(before)) expect(localStorage.getItem(storageKey(key))).toBe(raw);
    expect(localStorage.getItem(storageKey('restore-transaction'))).toBeNull();
  });

  it('recovers an interrupted restore journal before App loads and autosaves the draft', () => {
    const old=fixture().draft;
    WorkspaceStore.saveDraft(old);
    const previous=Object.fromEntries(['draft','ideas','custom','draft-archives']
      .map(key=>[key(key),localStorage.getItem(key(key))]));
    localStorage.setItem(storageKey('restore-transaction'),
      JSON.stringify({version:1,previous,createdAt:Date.now()}));
    localStorage.setItem(storageKey('draft'),JSON.stringify({...old,forgeDocs:{story:{title:'쓰다 만 복원'}}}));
    expect(WorkspaceStore.recoverInterruptedRestore()).toBe('recovered');
    expect(WorkspaceStore.loadDraft().forgeDocs.story.title).toBe('소중한 작품');
    expect(localStorage.getItem(storageKey('restore-transaction'))).toBeNull();
    start();
    expect(document.querySelector('#forgeTitleInput').value).toBe('소중한 작품');
  });

  it('blocks autosave if a corrupted pending-restore journal cannot be recovered', () => {
    localStorage.setItem(storageKey('restore-transaction'),'corrupt');
    start();
    expect(screen.getByRole('alert').textContent).toContain('자동 저장을 중지');
    expect(localStorage.getItem(storageKey('draft'))).toBeNull();
    expect(localStorage.getItem(storageKey('restore-transaction'))).toBe('corrupt');
  });

  it('LIBRARY imports only after preview, explicit replacement consent, and user click', async () => {
    WorkspaceStore.saveDraft({
      version:1,generatorId:'story',mode:'hybrid',genre:'판',chaos:3,workspacePage:'library',
      results:{story:{values:{setting:'기존 장면'},locks:{setting:false}}},
      forgeDocs:{story:{title:'복원 전 제목'}}
    });
    start();
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('library');
    const bundle=buildWorkspaceBackup(fixture());
    fireEvent.click(document.querySelector('#fullBackupImport summary'));
    chooseText(JSON.stringify(bundle));
    await waitFor(()=>expect(document.querySelector('.full-backup-compare')).not.toBeNull());
    expect(document.querySelector('#confirmFullRestoreBtn').disabled).toBe(true);
    expect(document.querySelector('.full-backup-compare').textContent).toContain('보관 아이디어'.slice(0,0)); // counts are previewed
    expect(WorkspaceStore.loadDraft().forgeDocs.story.title).toBe('복원 전 제목');
    fireEvent.click(document.querySelector('.full-backup-consent input'));
    expect(document.querySelector('#confirmFullRestoreBtn').disabled).toBe(false);
    fireEvent.click(document.querySelector('#confirmFullRestoreBtn'));
    expect(WorkspaceStore.loadDraft().forgeDocs.story.title).toBe('소중한 작품');
    expect(document.querySelector('#forgeTitleInput').value).toBe('소중한 작품');
    expect(WorkspaceStore.loadCustom()[0].text).toBe('내 키워드');
    expect(WorkspaceStore.loadDraftArchives()).toHaveLength(1);
    expect(document.querySelector('#toast').textContent).toContain('복원');
  });

  it('invalid selected file displays an error and cannot reveal a destructive restore button', async () => {
    start();toLibrary();
    fireEvent.click(document.querySelector('#fullBackupImport summary'));
    chooseText('{\"not\":\"a backup\"}');
    await waitFor(()=>expect(document.querySelector('.full-backup-status')?.textContent).toContain('파일 확인 실패'));
    expect(document.querySelector('.full-backup-compare')).toBeNull();
    expect(document.querySelector('#confirmFullRestoreBtn')).toBeNull();
  });
});
