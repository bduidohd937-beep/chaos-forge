# CHAOS FORGE v1.0

소설·게임·캐릭터·세계관 기획을 위한 **한국어 랜덤 아이디어 생성 웹앱**입니다.
단순한 단어 추첨기가 아니라 **장르 적합성**과 **혼돈(의외성)**을 직접 조절하는
하이브리드 생성 시스템입니다.

- **React 19 + Vite 8** (JavaScript, TypeScript 아님)
- 백엔드·외부 API 없음 — 정적 빌드만으로 동작
- LocalStorage 기반 아이디어 저장
- GitHub Pages 배포 (Actions 워크플로 포함)

> 저장소: <https://github.com/bduidohd937-beep/chaos-forge>
> 배포 주소: <https://bduidohd937-beep.github.io/chaos-forge/>

## 이전 버전(바닐라)과의 관계

최초 구현은 HTML/CSS/Vanilla JS였고, 현재 코드는 React + Vite로 전환된 버전입니다.
바닐라 버전은 커밋 `Add vanilla CHAOS FORGE v1.0 baseline before React/Vite migration`에
그대로 남아 있어 `git show`로 확인할 수 있습니다.

| | 바닐라 버전 | 현재(React + Vite) |
| --- | --- | --- |
| 빌드 | 없음 (파일 직접 실행) | `npm run build` → `dist/` |
| UI | DOM 직접 조작 | 컴포넌트 + 상태 |
| 데이터/엔진 | 전역 스크립트 | ES 모듈 (`import`/`export`) |
| 테스트 | Node vm + jsdom | Vitest + Testing Library |

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
```

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버 (0.0.0.0 바인딩, 모바일에서도 접속 가능) |
| `npm run build` | `dist/`에 정적 빌드 |
| `npm run preview` | 빌드 결과를 로컬에서 미리보기 |
| `npm test` | Vitest 전체 테스트 (엔진 + UI) |

## 기능

### 생성기 4종

| 탭 | 이름 | 항목 |
| --- | --- | --- |
| STORY | 소설 생성기 | 장르 · 배경 · 주인공 · 핵심 사건 · 갈등 · 반전 · 분위기 · 결말 |
| GAME | 게임 생성기 | 게임 장르 · 플레이 방식 · 핵심 메커니즘 · 성장 시스템 · 특수 규칙 · 적 유형 · 승리 조건 · 아트 스타일 |
| CHARACTER | 인물 생성기 | 직업 · 성격 · 욕망 · 과거 · 비밀 · 신념 · 인간관계 · 내적 갈등 · 성장 방향 |
| HERO | 영웅 생성기 | 종족 · 직업 · 무기 · 속성 · 전투 역할 · 액티브 스킬 · 패시브 스킬 · 궁극기 · 약점 |

네 생성기는 서로 다른 데이터셋을 쓰고, 하나의 공통 엔진(`src/engine.js`)을 공유합니다.

### 하이브리드 랜덤 시스템

| 모드 | 동작 |
| --- | --- |
| 장르 맞춤 | 선택 장르의 태그·호환 태그와 일치하는 키워드만 선택 |
| 완전 랜덤 | 장르 제약 없이 가중치만 적용해 선택 |
| 하이브리드 | 장르 적합성과 의외성을 확률로 혼합 |

혼돈 레벨 1~5는 장르 밖 키워드가 나올 확률을 조절합니다.

```
p(장르 밖) = (chaos - 1) / 4 × 0.9
   1레벨 → 0.000 (장르 일치만)
   3레벨 → 0.450 (절반 혼합)
   5레벨 → 0.900 (거의 무작위)
```

키워드 속성:

- **장르 태그** `g` — 그 장르스러운 정도 (장르 맞춤 모드의 필터)
- **호환 태그** `c` — 다른 장르와 어울리는 정도 (필터 포함, 가중치 낮음)
- **가중치** `w` — 높을수록 자주 등장 (기본 1, 흔한 소재 1.3~1.5)

### 인터페이스

- 전체 생성 (슬롯머신 연출) / 항목별 재추첨 / 개별 잠금 (잠긴 항목은 전체 생성에서도 유지)
- 장르 선택 · 랜덤 모드 선택 · 혼돈 레벨 조절
- 결과 직접 수정 (카드 본문 클릭 후 편집)
- 결과 복사 (클립보드)
- 결과를 **마크다운(.md) / JSON(.json) 파일로 내려받기**
- 아이디어 저장/삭제/검색/불러오기 (새로고침 후에도 유지)
- 사용자 키워드 추가 (생성기·항목·장르 태그 지정, 즉시 생성 반영)

## 키워드 데이터

- 총 **569개** 한국어 키워드, 슬롯별 중복 0 (테스트로 검증)
- 스토리 장르: 판타지 · 현대 판타지 · 무협 · SF · 사이버펑크 · 스팀펑크 · 로맨스 · 코미디 · 공포 · 미스터리 · 스릴러 · 밀리터리 · 아포칼립스 · 일상 · 학원 · 역사 · 신화
- 게임 장르: RPG · 로그라이크 · 디펜스 · 전략 · 액션 · 시뮬레이션 · 생존 · 퍼즐

```
src/data/genres.js     장르 정의 + K() 키워드 헬퍼
src/data/story.js      STORY 풀 (8슬롯, 144개)
src/data/game.js       GAME 풀 (8슬롯, 136개)
src/data/character.js  CHARACTER 풀 (9슬롯, 145개)
src/data/hero.js       HERO 풀 (9슬롯, 144개)
```

## 구조

```
index.html                  Vite 엔트리
vite.config.js              React 플러그인, base './', Vitest 설정
src/main.jsx                React 마운트
src/App.jsx                 생성기 상태·연출·저장 흐름
src/engine.js               공통 생성 엔진
src/storage.js              LocalStorage 저장소
src/export.js               마크다운/JSON 내보내기 + 파일 저장
src/components/
  ControlsBar.jsx           장르/모드/혼돈/생성 버튼
  ResultCard.jsx            결과 카드 (잠금·재추첨·직접 수정)
  IdeasPanel.jsx            저장된 아이디어 검색/불러오기/삭제
  CustomPanel.jsx           사용자 키워드 추가/삭제
src/styles.css              다크 판타지 + 개발자 도구 테마
tests/engine.test.js        엔진·데이터·저장소 테스트
tests/export.test.js        내보내기 빌더·파일 저장 테스트
tests/app.test.jsx          UI 통합 테스트
.github/workflows/deploy.yml GitHub Pages 배포
```

## 테스트

```bash
npm test
```

`tests/engine.test.js`

- 키워드 500개 이상 / 슬롯별 중복 없음 / 장르·호환 태그 유효성 / 가중치
- 혼돈 확률 범위·단조 증가, 혼돈 1은 장르 밖 미출현, 혼돈이 오르면 증가
- 장르 맞춤 모드 필터, 완전 랜덤 모드의 제약 무시
- 전체 생성이 모든 슬롯을 채움, 잠금 유지(빈 잠금 포함), 재추첨이 항상 풀 안에 있음
- 커스텀 키워드 병합·등장, 무효 장르 폴백
- 아이디어 저장/수정/검색/삭제, 커스텀 키워드 추가/삭제, 손상 데이터 복구

`tests/app.test.jsx` (Testing Library + jsdom)

- 탭 4종·8개 카드 렌더, 잠금 유지, 잠금 해제, 단일 카드 재추첨
- 모드 전환에 따른 혼돈 컨트롤 활성화, 탭 전환 시 항목 수·장르 목록 변화
- 직접 수정 값의 탭 간 유지, 아이디어 저장·검색·불러오기
- 커스텀 키워드가 실제 생성 결과에 등장
- 재마운트(새로고침 시뮬레이션) 후 저장 데이터 유지

## 내보내기

결과 영역의 **MD 저장 / JSON 저장** 버튼으로 현재 화면의 결과를 파일로 받습니다.
파일명은 `chaos-forge-<생성기>-<YYYYMMDD-HHmm>.<확장자>` 형식입니다(예: `chaos-forge-story-20261029-1705.md`).

**마크다운** — 문서·노션·위키에 바로 붙여 넣을 수 있는 표 형식

```md
# CHAOS FORGE · STORY (소설 생성기)

- 모드: 하이브리드
- 장르: 판타지
- 혼돈: 4/5
- 생성 시각: 2026-10-29 17:05

| 항목 | 내용 | 상태 |
| --- | --- | --- |
| 장르 | 하이 판타지 |  |
| 배경 | 폐허가 된 대도시 | 잠금 |
```

**JSON** — 다른 도구로 넘길 때 쓰는 구조화 데이터

```json
{
  "schema": "chaos-forge/idea@1",
  "generator": { "id": "story", "tab": "STORY", "title": "소설 생성기" },
  "mode": "hybrid",
  "modeLabel": "하이브리드",
  "genre": { "key": "판", "label": "판타지" },
  "chaos": 4,
  "exportedAt": "2026-10-29T08:05:00.000Z",
  "items": [{ "key": "setting", "label": "배경", "value": "폐허가 된 대도시", "locked": true }]
}
```

빈 값도 슬롯 순서대로 포함되며, 잠금 여부가 `locked`/`상태` 열로 함께 기록됩니다.

## 배포 (GitHub Pages)

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml`이 테스트 → 빌드 → 배포를 수행합니다.
저장소 Settings → Pages → Source를 **GitHub Actions**로 한 번만 설정하면 됩니다.

수동 배포:

```bash
npm run build
npx gh-pages -d dist    # gh-pages 브랜치 방식 사용 시
```

`vite.config.js`의 `base: './'` 덕분에 `https://<user>.github.io/chaos-forge/` 같은
하위 경로에서도 자산 경로가 깨지지 않습니다.

## 데이터 저장

`localStorage`에만 저장됩니다.

| 키 | 내용 |
| --- | --- |
| `chaosforge.ideas.v1` | 저장된 아이디어 |
| `chaosforge.custom.v1` | 사용자 키워드 |

localStorage가 막힌 환경에서는 메모리로 동작하며 새로고침 시 사라집니다.

## 제한 사항 (V1.0)

- 아이디어·키워드는 해당 브라우저에만 저장됩니다 (동기화·로그인 없음)
- 잠금 상태 자체는 새로고침 시 초기화됩니다 (값은 저장본에서 복원)
- 이미지 생성 없음 (텍스트 기반)
- 자동화 테스트는 jsdom 기준이며, 실제 브라우저/모바일 렌더링은 육안 확인이 필요합니다
