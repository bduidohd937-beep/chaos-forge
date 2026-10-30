/**
 * CHAOS FORGE Alpha 5 — CREATIVE DNA.
 * Offline and deterministic preference rules. This is NOT AI semantic
 * understanding: curated metadata + conservative Korean alias matching.
 * A hard ban must NEVER silently fall back to banned keywords.
 */
export const TOPICS = [
  { id: 'reincarnation', label: '환생·전생', aliases: ['환생','전생','다른 생에 태어','새 생으로 태어','다시 태어','이세계 전생'] },
  { id: 'regression', label: '회귀·시간 반복', aliases: ['회귀','타임 루프','타임루프','시간 역행','시간을 되감','하루를 반복','같은 하루를 반복','과거로 돌아','시간을 거슬러','시간 되돌리'] },
  { id: 'undead', label: '좀비·언데드', aliases: ['좀비','언데드','살아난 시체','되살아난 시체','죽은 시체가','사령술','네크로맨서','망자','시체 군단'] },
  { id: 'academy', label: '학원·학교', aliases: ['학교','학원','캠퍼스','동아리','교실','학생회','입학','졸업'] },
  { id: 'tragedy', label: '비극·희생', aliases: ['비극','비참','희생','파멸','절망','죽음을 맞','모두가 죽','새드엔딩','새드 엔딩'] },
  { id: 'romance', label: '연애·로맨스', aliases: ['연애','로맨스','연인','약혼','고백','첫사랑','사랑하는','사랑을','결혼'] },
  { id: 'comedy', label: '개그·코미디', aliases: ['코미디','개그','우스꽝','장난','실수투성이','웃음','웃기','유쾌','엉뚱','코믹'] },
  { id: 'horror', label: '공포·괴담', aliases: ['공포','괴담','저주','귀신','유령','악령','섬뜩','끔찍'] },
  { id: 'war', label: '전쟁·군사', aliases: ['전쟁','군대','군사','병사','전투','용병','전선','적국','무기 밀매'] },
  { id: 'politics', label: '권력·음모', aliases: ['정치','권력','음모','암살','황제','왕위','재판','정권','의회'] }
];
export const STYLE_BANS = [
  { id: 'long', label: '긴 설명 차단', description: '한 문장이 긴 표현을 제외' },
  { id: 'short', label: '짧은 표현 차단', description: '짧은 소재명만 있는 표현을 제외' },
  { id: 'dark', label: '어두운 분위기 차단', description: '비극·음산함 등 명시적 스타일 중심' },
  { id: 'comic', label: '우스꽝스러운 분위기 차단', description: '개그·코미디 분위기 중심' }
];
export const MUTATIONS = [
  { id: 'spark', label: 'SPARK', description: '장르 설정을 따르며 새로운 아이디어를 추첨' },
  { id: 'echo', label: 'ECHO', description: '기존 아이디어의 한 조각을 한 번만 계승' },
  { id: 'rift', label: 'RIFT', description: '기존 키워드와 멀어지는 파격적인 변이' }
];
const topicIds = new Set(TOPICS.map(x=>x.id));
const styleIds = new Set(STYLE_BANS.map(x=>x.id));
const norm = (value) => String(value || '').trim().toLocaleLowerCase().replace(/\s+/g,' ');
const unique = (arr,max,valid) => [...new Set(Array.isArray(arr)?arr.filter(v=>typeof v==='string').map(v=>v.slice(0,200).trim()).filter(v=>v && (!valid||valid.has(v))):[])].slice(0,max);
const allowedDetail = ['brief','balanced','detailed'], allowedMood=['any','bright','dark','comic'];
const allowedMutation = MUTATIONS.map(m=>m.id);
export const defaultDNA = {
  detail:'balanced', novelty:2, mood:'any', mutation:'spark',
  banMode:'hard', bannedTopics:[], bannedStyles:[], bannedExact:[], likes:[]
};
export function normalizeDNA(raw) {
  const d = raw && typeof raw==='object' && !Array.isArray(raw) ? raw : {};
  return {
    detail:allowedDetail.includes(d.detail)?d.detail:'balanced',
    novelty:[1,2,3,4].includes(Number(d.novelty))?Number(d.novelty):2,
    mood:allowedMood.includes(d.mood)?d.mood:'any',
    mutation:allowedMutation.includes(d.mutation)?d.mutation:'spark',
    banMode:d.banMode==='soft'?'soft':'hard',
    bannedTopics:unique(d.bannedTopics,TOPICS.length,topicIds),
    bannedStyles:unique(d.bannedStyles,STYLE_BANS.length,styleIds),
    bannedExact:unique(d.bannedExact,80),
    likes:unique(d.likes,80)
  };
}
export function deriveTopics(keyword) {
  const given = Array.isArray(keyword?.topics)?keyword.topics.filter(x=>topicIds.has(x)):[];
  // Alias matching is a conservative fallback for legacy, manually edited,
  // and user-defined keywords. It cannot claim to understand all synonyms.
  const texts = [keyword?.t,...Object.values(keyword?.forms||{})].filter(x=>typeof x==='string');
  const joined = texts.map(norm).join(' ');
  return [...new Set([...given,...TOPICS.filter(t=>t.aliases.some(a=>joined.includes(norm(a)))).map(t=>t.id)])];
}
export function renderedText(keyword,dna) {
  const d=normalizeDNA(dna);
  if(!keyword?.forms) return String(keyword?.t||'');
  return String(keyword.forms[d.detail] || keyword.forms.balanced || keyword.t || '');
}
function styleTags(keyword) {
  const tags = Array.isArray(keyword?.styles)?keyword.styles.filter(x=>styleIds.has(x)):[];
  const text=renderedText(keyword, {detail:'detailed'});
  if(text.length>75) tags.push('long');
  if(text.length<=11) tags.push('short');
  if(deriveTopics(keyword).some(t=>t==='tragedy'||t==='horror'))tags.push('dark');
  if(deriveTopics(keyword).includes('comedy'))tags.push('comic');
  return [...new Set(tags)];
}
export function isBanned(keyword,dna) {
  const d=normalizeDNA(dna);
  const exact = new Set(d.bannedExact.map(norm));
  const allTexts=[keyword?.t,...Object.values(keyword?.forms||{})].filter(x=>typeof x==='string');
  if(allTexts.some(t=>exact.has(norm(t))))return true;
  if(deriveTopics(keyword).some(t=>d.bannedTopics.includes(t)))return true;
  if(styleTags(keyword).some(t=>d.bannedStyles.includes(t)))return true;
  return false;
}
/** Hard ban filters strictly; soft ban applies penalty at scoring only. */
export function allowedKeywords(pool,dna) {
  if(!Array.isArray(pool))return [];
  const d=normalizeDNA(dna);
  return d.banMode==='hard'?pool.filter(kw=>!isBanned(kw,d)):pool.slice();
}
/**
 * Base weights still dominate. The chosen axes have modest, capped influence:
 * 1=traditional, 4=novel, 2=neutral. Likes never bypass hard bans.
 */
export function dnaWeight(keyword,dna,context={}) {
  const d=normalizeDNA(dna);
  let score=1;
  const novelty=Number.isFinite(keyword?.novelty)?Math.max(1,Math.min(4,keyword.novelty)):2;
  score *= Math.max(.35,Math.min(2.3,1+(novelty-2)*(d.novelty-2)*.38));
  const length = renderedText(keyword,d).length;
  if(d.detail==='brief')score*=length<25?1.35:length>65?.55:.9;
  if(d.detail==='detailed')score*=keyword?.forms?.detailed?1.8:length>32?1.25:.7;
  if(d.mood!=='any'){
    const moods=Array.isArray(keyword?.moods)?keyword.moods:[];
    if(moods.includes(d.mood))score*=1.65;
    else if(moods.length)score*=.55;
  }
  const labels=[keyword?.t,...Object.values(keyword?.forms||{})].map(norm);
  if(d.likes.some(s=>labels.includes(norm(s))))score*=1.65;
  const preferredTopics = d.likes.flatMap(s=>TOPICS.filter(t=>t.aliases.some(a=>norm(s).includes(norm(a)))).map(t=>t.id));
  if(deriveTopics(keyword).some(t=>preferredTopics.includes(t)))score*=1.22;
  if(d.banMode==='soft'&&isBanned(keyword,d))score*=.05;
  if(d.mutation==='rift'){
    score*=novelty>=3?1.7:.66;
    const previous=Array.isArray(context.previousTopics)?context.previousTopics:[];
    if(previous.length&&deriveTopics(keyword).some(t=>previous.includes(t)))score*=.55;
  }
  return Math.max(.01,Math.min(6,score));
}
/** Exact keyword ban (not an entire genre). An empty value cannot be banned. */
export function banExact(dna,text) {
  const d=normalizeDNA(dna), value=String(text||'').trim().slice(0,200);
  if(!value||d.bannedExact.some(s=>norm(s)===norm(value)))return d;
  return {...d,bannedExact:[...d.bannedExact,value].slice(-80)};
}
export function toggleLike(dna,text) {
  const d=normalizeDNA(dna),value=String(text||'').trim().slice(0,200);
  if(!value)return d;
  return {...d,likes:d.likes.some(v=>norm(v)===norm(value))
    ?d.likes.filter(v=>norm(v)!==norm(value))
    :[...d.likes,value].slice(-80)};
}
/** Readonly explainable coverage diagnostic; users see explicit shortages. */
export function auditKeywordPools(generators,getPool) {
  return generators.map(g=>{
    const slots=g.slots.map(slot=>{
      const pool=getPool(g.id,slot.key);
      const forms=pool.filter(kw=>kw.forms?.brief&&kw.forms?.detailed).length;
      const duplicates=pool.length-new Set(pool.map(kw=>norm(kw.t))).size;
      return {key:slot.key,label:slot.label,count:pool.length,forms,duplicates,needsReview:pool.length<12||duplicates>0};
    });
    return {generator:g.id,total:slots.reduce((n,s)=>n+s.count,0),slots};
  });
}
