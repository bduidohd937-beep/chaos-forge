import { beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../src/App.jsx';
import Storage from '../src/storage.js';
import { getForgeTemplate } from '../src/forgeSchema.js';

const run = () => render(<App animationMs={0}/>);
const click = element => fireEvent.click(element);
const go = name => click(Array.from(document.querySelectorAll('.workspace-tab'))
  .find(element => element.textContent.includes(name)));
const field = (id, kind='story') => document.querySelector(`#forge-field-${kind}-${id}`);
const text = (el, value) => fireEvent.change(el, { target: { value } });
const outline = title => Array.from(document.querySelectorAll('.forge-outline-item'))
  .find(item => item.textContent.includes(title));
const coreOf = kind => getForgeTemplate(kind).sections[0];

beforeEach(() => {
  cleanup();
  localStorage.clear();
  window.scrollTo = () => {};
});

describe('FORGE UX 2.4 — progressive creation and stage-by-stage expert writing', () => {
  it('does not force an empty core step forward; recommends the next stage after exactly three completed fields', () => {
    run(); go('FORGE');
    const core = coreOf('story');
    expect(document.querySelectorAll('.forge-field')).toHaveLength(core.fields.length);
    expect(document.querySelector('#forgeNextCore')).toBeNull();
    expect(document.querySelector('.forge-guided-next').textContent).toContain('0 / 3');
    core.fields.slice(0,2).forEach((item, index) => text(field(item.id), '내용 ' + index));
    expect(document.querySelector('#forgeNextCore')).toBeNull();
    expect(document.querySelector('.forge-guided-next').textContent).toContain('2 / 3');
    text(field(core.fields[2].id), '작품의 매력');
    const next = document.querySelector('#forgeNextCore');
    expect(next.textContent).toContain('세계와 인물');
    expect(document.querySelector('.forge-guided-next').textContent).toContain('핵심 3개를 다 작성');
    expect(Storage.loadDraft().forgeDocs.story.fields[core.fields[2].id]).toBe('작품의 매력');
    click(next);
    expect(document.querySelectorAll('.forge-outline-item')).toHaveLength(4);
    expect(document.querySelector('.forge-section-count').textContent).toContain('2 / 4');
    expect(field('worldRules')).not.toBeNull();
    expect(field(core.fields[0].id)).toBeNull();
    expect(document.querySelector('.forge-progress-track').getAttribute('aria-valuemax')).toBe('3');
    expect(document.querySelector('.forge-progress-track').getAttribute('aria-valuenow')).toBe('0');
  });

  it('offers next/previous step navigation without blocking unfinished sections or showing every field', () => {
    run(); go('FORGE');
    click(screen.getByRole('button', { name: '전문 설정집 펼치기' }));
    expect(document.querySelectorAll('.forge-field')).toHaveLength(3);
    expect(document.querySelector('.forge-outline-progress').textContent).toContain('0 / 4');
    click(document.querySelector('#forgeNextStage'));
    expect(document.querySelector('.forge-section-count').textContent).toContain('2 / 4');
    expect(document.querySelectorAll('.forge-field')).toHaveLength(3);
    text(field('worldRules'), '비밀 세계의 세 가지 규칙');
    expect(document.querySelector('.forge-stage-progress').textContent).toContain('1 / 3');
    click(document.querySelector('#forgeNextStage'));
    expect(document.querySelector('.forge-section-count').textContent).toContain('3 / 4');
    expect(field('opening')).not.toBeNull();
    expect(field('worldRules')).toBeNull();
    click(document.querySelector('#forgePreviousStage'));
    expect(field('worldRules').value).toBe('비밀 세계의 세 가지 규칙');
    expect(Storage.loadDraft().forgeDocs.story.fields.worldRules).toBe('비밀 세계의 세 가지 규칙');
  });

  it('shows stage completion and final review while preserving authored content', () => {
    run(); go('FORGE');
    click(screen.getByRole('button', { name: '전문 설정집 펼치기' }));
    const sections = getForgeTemplate('story').sections;
    sections.forEach((section, index) => {
      expect(document.querySelector('.forge-section-count').textContent).toContain(`${index+1} / 4`);
      section.fields.forEach(item => text(field(item.id), '작성 완료: '+item.label));
      if(index < sections.length - 1) click(document.querySelector('#forgeNextStage'));
    });
    expect(document.querySelector('.forge-outline-progress').textContent).toContain('4 / 4');
    expect(document.querySelector('#forgeNextStage')).toBeNull();
    click(document.querySelector('#forgeReviewStages'));
    expect(field(sections[0].fields[0].id).value).toContain('작성 완료');
    expect(Storage.loadDraft().forgeDocs.story.fields[sections[3].fields[0].id]).toContain('작성 완료');
    expect(document.querySelector('.forge-outline-progress').textContent).toContain('4 / 4');
  });

  it('simple mode always displays core fields after visiting deeper stages; nothing is discarded', () => {
    run(); go('FORGE');
    click(screen.getByRole('button', { name: '전문 설정집 펼치기' }));
    click(outline('복선과 반전'));
    text(field('reveal'), '최종 진실');
    click(screen.getByRole('button', { name: '간편 작성으로 돌아가기' }));
    expect(document.querySelectorAll('.forge-field')).toHaveLength(3);
    expect(field('logline')).not.toBeNull();
    expect(field('reveal')).toBeNull();
    expect(document.querySelector('.forge-section-head').textContent).toContain('작품의 중심');
    click(screen.getByRole('button', { name: '전문 설정집 펼치기' }));
    expect(field('logline')).not.toBeNull();
    click(outline('복선과 반전'));
    expect(field('reveal').value).toBe('최종 진실');
  });

  it('automatically uses the correct next-stage title for all four specialized schemas', () => {
    run(); go('CHAOS');
    for (const kind of ['STORY','GAME','CHARACTER','HERO']) {
      click(screen.getByRole('tab',{name:kind}));
      go('FORGE');
      const gen=kind.toLowerCase();
      const sections=getForgeTemplate(gen).sections;
      expect(document.querySelectorAll('.forge-field')).toHaveLength(sections[0].fields.length);
      sections[0].fields.forEach(item => text(field(item.id,gen), kind+' · '+item.label));
      const next=document.querySelector('#forgeNextCore');
      expect(next).not.toBeNull();
      expect(next.textContent).toContain(sections[1].title);
      click(next);
      expect(document.querySelector('.forge-section-head').textContent).toContain(sections[1].title);
      expect(document.querySelector('.forge-section-count').textContent).toContain('2 / 4');
      expect(Storage.loadDraft().forgeDocs[gen].fields[sections[0].fields[0].id])
        .toContain(kind);
      go('CHAOS');
    }
  });

  it('restores legacy draft title, notes and structured fields with guided stages after reload', () => {
    Storage.saveDraft({
      generatorId:'story', workspacePage:'forge', mode:'hybrid',genre:'판',chaos:3,
      results:{story:{values:{setting:'이전 배경'},locks:{setting:true}}},
      forgeDocs:{story:{
        title:'오래된 작품',notes:'기존 메모',
        fields:{logline:'오래된 로그라인',worldRules:'오래된 세계관',reveal:'오래된 반전'}
      }}
    });
    const mounted=run();
    expect(field('logline').value).toBe('오래된 로그라인');
    expect(document.querySelector('#forgeTitleInput').value).toBe('오래된 작품');
    mounted.unmount();
    run();
    expect(document.querySelector('#forgeNotesInput').value).toBe('기존 메모');
    click(screen.getByRole('button',{name:'전문 설정집 펼치기'}));
    click(document.querySelector('#forgeNextStage'));
    expect(field('worldRules').value).toBe('오래된 세계관');
    click(outline('복선과 반전'));
    expect(field('reveal').value).toBe('오래된 반전');
    go('CHAOS');
    expect(document.querySelector('.result-card[data-slot="setting"].is-locked')).not.toBeNull();
    expect(document.querySelector('.result-card[data-slot="setting"] .card-value').textContent).toBe('이전 배경');
  });

  it('core guide still allows early expert access and includes a return path to CHAOS', () => {
    run(); go('FORGE');
    expect(document.querySelector('.forge-guided-next').textContent).toContain('꼭 순서대로 작성할 필요는 없어요');
    click(screen.getByRole('button',{name:'전문 설정집 펼치기'}));
    click(outline('서사 구조'));
    expect(field('opening')).not.toBeNull();
    click(screen.getByRole('button',{name:/CHAOS 추첨실/}));
    expect(document.querySelector('[data-screen]').dataset.screen).toBe('chaos');
  });
});
