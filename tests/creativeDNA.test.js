import { describe, it, expect } from 'vitest';
import {
  normalizeDNA, allowedKeywords, deriveTopics, isBanned, isExactBanned,
  dnaWeight, renderedText, banExact, toggleLike, auditKeywordPools, TOPICS
} from '../src/creativeDNA.js';
import { getPool, GENERATORS, pickKeyword, generateResult, rerollSlot, auditDNACoverage } from '../src/engine.js';
import { ALPHA5_LIBRARY } from '../src/data/alpha5.js';
import { K } from '../src/data/genres.js';

const seed = () => 0.12;

describe('Alpha 5 author-curated vocabulary and quality audit', () => {
  it('contains 68 distinct, manually authored triple-depth concepts in all 34 slots', () => {
    const unique = new Set();
    let concepts = 0;
    for (const gen of GENERATORS) for (const slot of gen.slots) {
      const items = ALPHA5_LIBRARY[gen.id][slot.key];
      expect(items).toHaveLength(2);
      for (const kw of items) {
        const id = gen.id+'/'+slot.key+'/'+kw.t;
        expect(unique.has(id)).toBe(false);
        unique.add(id); concepts++;
        expect(kw.forms.brief.length).toBeGreaterThanOrEqual(2);
        expect(kw.forms.balanced).toBe(kw.t);
        expect(kw.forms.detailed.length).toBeGreaterThan(kw.forms.brief.length);
        expect(kw.forms.detailed).not.toBe(kw.forms.balanced);
        expect(kw.novelty).toBeGreaterThanOrEqual(1);
        expect(kw.novelty).toBeLessThanOrEqual(4);
        expect(kw.g.length).toBeGreaterThan(0);
        expect(getPool(gen.id,slot.key).some(item=>item.t===kw.t)).toBe(true);
      }
    }
    expect(concepts).toBe(68);
  });
  it('diagnoses real dataset counts without claiming synonyms are fully understood', () => {
    const report = auditKeywordPools(GENERATORS,getPool);
    expect(report).toHaveLength(4);
    for(const item of report){
      const total=item.slots.reduce((n,s)=>n+s.count,0);
      expect(total).toBe(item.total);
      expect(item.slots.every(slot=>slot.count>2)).toBe(true);
      expect(item.slots.every(slot=>slot.forms>=2)).toBe(true);
    }
  });
});

describe('Alpha 5 Creative DNA normalization and ban safety', () => {
  it('normalizes invalid historic preferences and keeps bounded, unique lists', () => {
    const d=normalizeDNA({
      detail:'impossible', novelty:100, mood:'unknown', mutation:'oops',
      banMode:'oops', bannedTopics:['undead','undead','x'],bannedStyles:['long','x'],
      bannedExact:['a','a',42],likes:['good','good']
    });
    expect(d.detail).toBe('balanced');
    expect(d.novelty).toBe(2);
    expect(d.mutation).toBe('spark');
    expect(d.bannedTopics).toEqual(['undead']);
    expect(d.bannedStyles).toEqual(['long']);
    expect(d.bannedExact).toEqual(['a']);
    expect(d.likes).toEqual(['good']);
  });
  it('recognizes curated topic metadata and a documented set of legacy Korean aliases', () => {
    expect(deriveTopics({t:'전장에 되살아난 시체들이 나타난다'})).toContain('undead');
    expect(deriveTopics({t:'첫 번째 죽음 뒤에 시간이 역행한다'})).toContain('regression');
    expect(deriveTopics({t:'연인의 기억을 거래한다'})).toContain('romance');
    expect(deriveTopics({t:'드론과 지도를 확인한다'})).not.toContain('undead');
    expect(TOPICS.some(t=>t.id==='undead')).toBe(true);
  });
  it('hard BAN excludes all matched aliases and explicit tags before genre fallback', () => {
    const dna=normalizeDNA({bannedTopics:['undead']});
    const pool=[K('좀비 부대',['판']),K('되살아난 시체들의 군단',['판']),K('빛의 기사',['판'])];
    expect(allowedKeywords(pool,dna).map(x=>x.t)).toEqual(['빛의 기사']);
    expect(pickKeyword(pool,{
      generatorId:'story',mode:'random',dna,rng:seed
    }).t).toBe('빛의 기사');
    expect(pickKeyword(pool,{
      generatorId:'story',mode:'genre',genres:{main:'판',subs:[]},dna,rng:seed
    }).t).toBe('빛의 기사');
  });
  it('exhausted hard BAN returns null: never silently selects a forbidden keyword', () => {
    const dna=normalizeDNA({bannedTopics:['undead']});
    const pool=[K('좀비 장군',['판']),K('되살아난 시체',['판'])];
    expect(allowedKeywords(pool,dna)).toHaveLength(0);
    expect(pickKeyword(pool,{
      generatorId:'story',mode:'random',dna,rng:seed
    })).toBeNull();
    expect(pickKeyword(pool,{
      generatorId:'story',mode:'genre',genres:{main:'판',subs:[]},dna,rng:seed
    })).toBeNull();
  });
  it('an exact ban is always strict, even when topic/style bans are soft', () => {
    const dna=normalizeDNA({banMode:'soft',bannedTopics:['undead'],bannedExact:['빛의 기사']});
    const pool=[K('빛의 기사',['판']),K('좀비 부대',['판'])];
    expect(allowedKeywords(pool,dna).map(x=>x.t)).toEqual(['좀비 부대']);
    expect(isExactBanned(pool[0],dna)).toBe(true);
    expect(isBanned(pool[1],dna)).toBe(true);
  });
  it('an exact ban applies to all three expression variants of the same concept', () => {
    const kw=ALPHA5_LIBRARY.story.protagonist[0];
    const dna=banExact(normalizeDNA(),kw.forms.brief);
    expect(isExactBanned(kw,dna)).toBe(true);
    expect(allowedKeywords([kw],dna)).toHaveLength(0);
  });
  it('hard style ban prevents dark or long outputs and soft style ban lowers weight', () => {
    const dark=K('비극과 절망에 빠진 도시',['판']);
    const light=K('햇살 아래 행복한 시민들',['판']);
    expect(allowedKeywords([dark,light],{bannedStyles:['dark']}).map(x=>x.t)).toEqual([light.t]);
    const long=ALPHA5_LIBRARY.story.setting[0];
    expect(allowedKeywords([long],{detail:'detailed',bannedStyles:['long']})).toHaveLength(0);
    const soft=normalizeDNA({banMode:'soft',bannedStyles:['dark']});
    expect(dnaWeight(dark,soft)).toBeLessThan(dnaWeight(light,soft));
  });
  it('exact bans and likes do not mutate user data', () => {
    const base=normalizeDNA();
    const banned=banExact(base,'황혼의 검');
    expect(banned.bannedExact).toContain('황혼의 검');
    expect(base.bannedExact).toEqual([]);
    const liked=toggleLike(base,'달의 기사');
    expect(liked.likes).toEqual(['달의 기사']);
    expect(toggleLike(liked,'달의 기사').likes).toEqual([]);
  });
  it('short/standard/detailed are authored variants, not padded text', () => {
    const kw=ALPHA5_LIBRARY.game.mechanic[0];
    expect(renderedText(kw,{detail:'brief'})).toBe(kw.forms.brief);
    expect(renderedText(kw,{detail:'balanced'})).toBe(kw.t);
    expect(renderedText(kw,{detail:'detailed'})).toBe(kw.forms.detailed);
    const legacy=K('몰락한 기사',['판']);
    expect(renderedText(legacy,{detail:'detailed'})).toBe('몰락한 기사');
  });
  it('novelty and RIFT bias higher originality but remain weighted, non-generative', () => {
    const classic=ALPHA5_LIBRARY.story.ending[0]; // novelty 2
    const unusual=ALPHA5_LIBRARY.story.twist[0]; // novelty 4
    expect(dnaWeight(unusual,{novelty:4,mutation:'rift'}))
      .toBeGreaterThan(dnaWeight(classic,{novelty:4,mutation:'rift'}));
  });
});

describe('Alpha 5 engine compatibility and generation controls', () => {
  it('all four generators work under strict ban and brevity settings', () => {
    for(const gen of GENERATORS) {
      const dna=normalizeDNA({detail:'brief',bannedTopics:['undead'],novelty:4});
      const values=generateResult(gen.id,{
        mode:'genre',genres:{main:gen.genreList[0].k,subs:[]},
        chaos:1,dna,rng:seed
      });
      expect(gen.slots.every(slot=>values[slot.key].length>0)).toBe(true);
      expect(gen.slots.every(slot=>!deriveTopics({t:values[slot.key]}).includes('undead'))).toBe(true);
    }
  });
  it('BAN preserves a previous value when a slot has no eligible candidates, no forbidden replacement', () => {
    const all=getPool('story','setting').map(kw=>kw.t);
    const dna=normalizeDNA({bannedExact:all});
    const result=rerollSlot('story','setting',{
      mode:'random',dna,previous:'내가 직접 써 둔 배경'
    });
    expect(result).toBe('내가 직접 써 둔 배경');
    const report=auditDNACoverage('story',dna);
    expect(report.empty).toContain('배경');
  });
  it('locked values are preserved even when conflicting with a newly chosen BAN', () => {
    const result=generateResult('story',{
      mode:'random',dna:normalizeDNA({bannedTopics:['undead']}),
      locks:{protagonist:true},values:{protagonist:'좀비 장군'},
      rng:seed
    });
    expect(result.protagonist).toBe('좀비 장군');
    const report=auditDNACoverage('story',normalizeDNA({bannedTopics:['undead']}),
      [],{protagonist:true},{protagonist:'좀비 장군'});
    // Even an unregistered, hand-written lock is reported by known aliases.
    // Nothing overwrites the author's text automatically.
    expect(report.empty).toEqual([]);
    expect(report.blockedLocked).toContain('주인공');
  });
  it('RIFT never escapes bans while still choosing higher-novelty authored options', () => {
    const pool=[ALPHA5_LIBRARY.story.twist[0],ALPHA5_LIBRARY.story.twist[1]];
    const dna=normalizeDNA({mutation:'rift',bannedExact:[pool[0].t],novelty:4,detail:'detailed'});
    const out=pickKeyword(pool,{
      mode:'random',generatorId:'story',dna,rng:seed,
      previousTopics:['romance']
    });
    expect(out?.t).toBe(pool[1].t);
  });
});
