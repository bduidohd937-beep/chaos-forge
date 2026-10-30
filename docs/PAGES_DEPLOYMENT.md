# CHAOS FORGE — GitHub Pages 배포 운영 규칙 (UX 2.3.1)

## 배포 소유자는 단 하나

GitHub Pages `github-pages` 환경에 업로드하고 `actions/deploy-pages`를 실행하는 유일한 워크플로는
[`.github/workflows/deploy-v2-preview.yml`](../.github/workflows/deploy-v2-preview.yml)이다.
같은 사이트에 배포하는 별도 `deploy.yml`이나 병렬 워크플로를 **만들지 않는다**.

2026-10-30 기준 중복 배포가 발견됐다. `deploy.yml`은 UX 2.2 커밋을,
`deploy-v2-preview.yml`은 UX 2.3 커밋을 가리키고 각각 서로 다른 concurrency group으로 실행되었다.
둘 다 Pages 사이트 전체를 게시하므로 나중에 끝나는 실행이 앞선 결과물을 덮어쓸 수 있었다.
UX 2.3.1에서는 이전 `deploy.yml`을 삭제하고 새 워크플로 하나로 통합한다.

## V1과 V2를 동시에 보존

- `main`의 **V1 정식 코드는 수정하지 않고** 빌드 결과의 루트 `/`에 게시한다.
- 테스트를 통과한 **특정 V2 커밋 SHA**를 `REVIEWED_V2_SHA`에 고정하고 `/preview/v2/`에 게시한다.
- 두 버전은 각각 `npm ci`, `npm test -- --run`, `npm run build`를 통과해야만 Pages에 게시할 수 있다.
- V2 checkout SHA를 확인하고, 루트/미리보기의 `index.html`, V2 자산 디렉터리와 `.nojekyll` 파일이 포함됐는지 검증한다.
- 동일 `github-pages` concurrency group에서 가장 최신 실행만 게시되도록 한다.

## 다음 V2 패치 배포 절차

1. 기존 V2 기능 브랜치를 수정하고 별도 기능 PR로 검토한다. 이 PR을 **V1 운영 `main`에 병합하지 않는다.**
2. 해당 V2 커밋의 테스트/빌드가 통과한 상태에서 정확한 SHA를 확인한다.
3. **기존의 단일 워크플로**에 있는 `REVIEWED_V2_SHA`만 검증된 SHA로 바꾸는 작은 PR을 `main`으로 제출한다.
4. PR 검증이 통과하면 이 배포 전용 PR만 병합한다. 병합된 `main`에서 **Pages 배포 1회**만 실행되는지 확인한다.
5. 루트 V1과 `/preview/v2/`를 둘 다 확인한다. 문제가 있으면 새 워크플로를 추가하지 말고,
   `REVIEWED_V2_SHA`를 이전에 검증한 커밋으로 되돌리는 PR을 만든다.

## 보호/제약

- GitHub Pages 배포 성공은 애플리케이션 기능과 브라우저 렌더링이 완벽하다는 의미는 아니다.
  실제 데스크톱·모바일 사용성 검수는 별도 수행한다.
- 같은 도메인의 V1과 V2는 로컬스토리지 키를 분리해야 한다. 기존의 키 정책은 변경하지 않는다.
- 이 정리는 **배포 과정만 수정**한다. 사용자 작품, FORGE 원고 및 창작 엔진에는 변경이 없다.
