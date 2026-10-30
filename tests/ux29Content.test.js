import { describe, expect, it } from 'vitest';
import { ALL_GENRES, GENERATORS, getPool, getEligiblePool, generateResult, rerollSlot, auditDNACoverage } from '../src/engine.js';
import { REFORGE_LIBRARY, REFORGE_COUNT, isReforgeReady } from '../src/data/reforge29Library.js';
import { ALPHA5_LIBRARY } from '../src/data/alpha5.js';
import { genreAffinity } from '../src/genreMix.js';

const isSingleWord = text => typeof text === 'string' && !!text.trim() && !/\s/.test(text);
const seed = () => 0.31;
const SLOT_COUNT = GENERATORS.reduce((sum, gen) => sum + gen.slots.length, 0);

describe('UX 2.9 curated three-depth creative content', () => {
  it('adds 272 authored entries across all 34 generator slots', () => {
    expect(SLOT_COUNT).toBe(34);
    expect(REFORGE_COUNT).toBe(272);
    const validTags = new Set(ALL_GENRES.map(g=>g.k));
    for (const gen of GENERATORS) {
      for (const slot of gen.slots) {
        const entries = REFORGE_LIBRARY[gen.id][slot.key];
        expect(entries, gen.id + '.' + slot.key).toHaveLength(8);
        expect(new Set(entries.map(item => item.t)).size).toBe(8);
        for (const entry of entries) {
          expect(isReforgeReady(entry)).toBe(true);
          expect(isSingleWord(entry.forms.brief), entry.forms.brief).toBe(true);
          expect(entry.forms.detailed).not.toBe(entry.forms.balanced);
          expect(entry.forms.balanced).not.toBe(entry.forms.brief);
          expect(entry.g.length).toBeGreaterThan(0);
          for (const tag of entry.g) expect(validTags.has(tag), tag).toBe(true);
        }
      }
    }
  });

  it('retains all 68 Alpha5 entries, each with a reviewed one-word alias', () => {
    for (const gen of GENERATORS) for (const slot of gen.slots) {
      const old = ALPHA5_LIBRARY[gen.id][slot.key];
      const stored = getPool(gen.id, slot.key);
      for (const entry of old) {
        const converted = stored.find(item => item.t === entry.t);
        expect(converted, gen.id + '.' + slot.key + ':' + entry.t).toBeDefined();
        expect(isSingleWord(converted.forms.brief)).toBe(true);
        expect(converted.forms.balanced).toBe(entry.forms.balanced);
        expect(converted.forms.detailed).toBe(entry.forms.detailed);
      }
    }
  });

  it('built-in live pool contains only full, explicit forms for each depth', () => {
    for (const gen of GENERATORS) for (const slot of gen.slots) {
      const pool = getEligiblePool(gen.id,slot.key,[],{detail:'brief'});
      expect(pool).toHaveLength(10);
      expect(pool.every(isReforgeReady)).toBe(true);
      expect(pool.every(kw=>isSingleWord(kw.forms.brief))).toBe(true);
    }
  });

  it('keyword, sentence and detailed modes produce their own authored values', () => {
    for (const gen of GENERATORS) {
      for (const detail of ['brief','balanced','detailed']) {
        const values = generateResult(gen.id, {
          mode:'genre', genres:{main:gen.id==='story'||gen.id==='character'?'판':'RPG',subs:[]},
          dna:{detail},rng:seed
        });
        for (const slot of gen.slots) {
          const pool=getEligiblePool(gen.id,slot.key,[],{detail});
          expect(pool.some(kw=>kw.forms[detail]===values[slot.key]),
            gen.id + '/' + slot.key + '/' + detail).toBe(true);
          if(detail==='brief') expect(isSingleWord(values[slot.key])).toBe(true);
        }
      }
    }
  });

  it('fantasy and mystery remain genre-specific across all four generators', () => {
    for (const gen of GENERATORS) for (const main of ['판','미']) {
      const values = generateResult(gen.id,{
        mode:'genre',genres:{main,subs:[]},dna:{detail:'brief'},rng:seed
      });
      for (const slot of gen.slots) {
        const matches=getEligiblePool(gen.id,slot.key,[],{detail:'brief'})
          .filter(kw=>kw.forms.brief===values[slot.key]);
        expect(matches.some(kw=>genreAffinity(kw,gen.id,main)>0),
          gen.id + '/' + slot.key + '/' + main).toBe(true);
      }
    }
  });

  it('hard bans remain strict and never fall back to a legacy paragraph', () => {
    const result=generateResult('story',{
      mode:'random',dna:{detail:'brief',bannedTopics:['undead']},rng:seed
    });
    expect(Object.values(result).every(isSingleWord)).toBe(true);
    const slot=getEligiblePool('story','setting',[],{detail:'brief',bannedTopics:['undead']});
    expect(slot.every(item=>!item.forms.brief.includes('좀비'))).toBe(true);
  });

  it('locked legacy user text is preserved even after switching depths', () => {
    const previous='내가 써 둔 긴 문장과 정확한 세계관 설정은 바꾸지 않는다.';
    const values=generateResult('story',{
      mode:'genre',genres:{main:'판',subs:[]},dna:{detail:'brief'},
      locks:{setting:true},values:{setting:previous},rng:seed
    });
    expect(values.setting).toBe(previous);
    expect(isSingleWord(values.protagonist)).toBe(true);
  });

  it('reroll uses curated three-depth pool, never returns legacy paragraph in keyword mode', () => {
    for (const gen of GENERATORS) for (const slot of gen.slots) {
      const text=rerollSlot(gen.id,slot.key,{
        mode:'genre',genres:{main:'미',subs:[]},dna:{detail:'brief'},rng:seed
      });
      expect(isSingleWord(text),gen.id+'.'+slot.key+':'+text).toBe(true);
    }
  });

  it('custom user-authored texts and strict ban coverage remain non-destructive', () => {
    const custom=[{id:'owner',generator:'story',slot:'setting',
      text:'내가 직접 작성한 특별한 장소',genres:['판'],weight:500}];
    const pool=getEligiblePool('story','setting',custom,{detail:'brief'});
    expect(pool.some(kw=>kw.t===custom[0].text)).toBe(true);
    const count=auditDNACoverage('story',{detail:'brief'},custom);
    expect(count.empty).toHaveLength(0);
    expect(count.available).toBeGreaterThan(0);
  });
});
