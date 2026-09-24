# 플레이리스트 메이커 (Playlist Maker)

[English](README.md) | **한국어**

노래 목록을 자연어로 한 줄씩 붙여넣으면, 각 곡을 가장 정확한 유튜브 영상과 매칭해서 내 계정에 실제 YouTube 재생목록을 만들어 주는 도구입니다.

- 아티스트/제목 순서가 뒤바뀌어도, 한국어/영어/일본어(원어·로마자) 혼용이나 오타가 있어도, `live`, `acoustic`, `MV`, `remix`, `Inst.` 같은 힌트가 있어도 인식합니다.
- 기본은 공식 음원(`<아티스트> - Topic` 채널)을 우선하고, 토글 하나로 공식 MV 우선으로 바꿀 수 있습니다.
- 재생목록을 만들기 전에 검토 화면에서 전부 확인합니다: 썸네일, 신뢰도 배지, 곡별 대안 드롭다운, 드래그 순서 변경, 건너뛰기/삭제, 수정 후 재검색.
- YouTube API 할당량을 최소로 씁니다 (검색 결과를 로컬에 캐시).
- 로그인 없이 쓸 수 있는 "임시 재생목록 링크"(`watch_videos`, best-effort)도 제공합니다.

> 이 앱은 **개인용, 단일 사용자, 로컬 실행**을 전제로 만들었습니다. 공개 배포 전에는 반드시 [보안 참고 사항](#보안-참고-사항)을 읽어 주세요.

## 동작 방식

```
붙여넣은 줄들
  -> LLM이 각 줄을 {artist, title, hints}로 파싱            (한 번에 일괄 호출)
  -> 코드가 제목을 입력한 원문 기준으로 고정하고 "Inst." 같은 힌트를 직접 추출
  -> YouTube Data API: search.list + videos.list             (SQLite 캐시)
  -> 결정론적 점수 계산 (Topic/공식 채널, 제목 일치, 길이, 감점 규칙)
  -> 애매하면: "Topic" 검색 1회 추가 후, LLM 1회 일괄 호출로 후보 중 선택
  -> 검토 화면 -> 재생목록 생성(OAuth) 또는 임시 링크
```

LLM은 유튜브를 검색하지 않습니다. (1) 텍스트를 구조화된 필드로 바꾸고 (2) 주어진 후보들 사이에서 동점을 가리는 역할만 합니다. 검색은 YouTube Data API가, 순위 결정은 테스트 가능한 일반 코드(`lib/scoring/`)가 담당합니다.

**점수 규칙 요약:** Topic/공식 아티스트 채널 가산, 제목에 아티스트와 곡명이 모두 있으면 가산, 1분 미만·10분 초과 감점, cover/live/remix/reaction/가사/sped up/nightcore/8D/노래방/직캠/방송 클립은 힌트를 주지 않았다면 감점, 힌트로 요청한 변형(예: `Inst.`)이 없는 영상은 감점.

## 준비물

- Node.js 22 이상
- Google Cloud 프로젝트 (YouTube Data API v3 + OAuth 클라이언트)
- OpenAI 호환 LLM 엔드포인트(`/chat/completions`)와 API 키

## 설정

### 1. Google Cloud (YouTube)

1. [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트를 만들거나 선택합니다.
2. **YouTube Data API v3**를 사용 설정합니다 (`APIs & Services > Library`).
3. **API 키**를 만듭니다 (`Credentials > Create credentials > API key`) → `YOUTUBE_API_KEY`. YouTube Data API v3로 제한을 걸어 두세요.
4. **OAuth 클라이언트 ID**를 **웹 애플리케이션** 유형으로 만들고, 승인된 리디렉션 URI에 다음을 추가합니다:
   `http://localhost:3000/api/auth/callback/google`
   → `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
5. OAuth 동의 화면이 **테스트(Testing)** 상태인 동안에는 **Test users**에 본인 Google 계정을 추가해야 합니다. 그렇지 않으면 로그인 시 `403 access_denied`가 납니다.

### 2. LLM

OpenAI 호환 chat-completions 서버라면 무엇이든 됩니다:

```
LLM_BASE_URL=https://your-server/api/v1
LLM_API_KEY=...
LLM_DEFAULT_MODEL=모델이름
```

서버가 제공하는 정확한 모델명은 `curl -H "Authorization: Bearer $LLM_API_KEY" $LLM_BASE_URL/models`로 확인할 수 있습니다.
앱은 JSON 모드(`response_format: json_object`)를 요청하고, 서버가 거부하면 자동으로 일반 모드로 재시도합니다. 응답은 Zod로 검증하며, 잘못된 경우 한 번 복구를 시도합니다.

### 3. 환경 변수

```bash
cp .env.example .env
openssl rand -base64 32     # 출력값을 AUTH_SECRET에 붙여넣기
```

`.env`를 채우세요. **`.env`는 절대 커밋하지 마세요** (git에서 제외되어 있습니다). `.env.example`에는 항상 빈 값(placeholder)만 있어야 합니다.

### 4. 실행

```bash
npm install
npm run dev        # http://localhost:3000 (127.0.0.1에만 바인딩)
npm test           # 단위 테스트, 네트워크 호출 없음
```

매칭과 검토는 로그인 없이 되고, 재생목록을 실제로 만들 때만 Google 로그인이 필요합니다.

## YouTube 할당량

기본 일일 할당량은 10,000 유닛입니다: `search.list` = 100, `playlists.insert` = 50, `playlistItems.insert` = 50, `videos.list` = 1. 화면에서 오늘 사용량과, 비용이 큰 단계 전에 예상 비용을 보여 줍니다 (예: 20곡 검색 ≈ 2,000, 생성 ≈ 1,050).

- 검색 결과는 `data/cache.db`(SQLite, git 제외)에 캐시되어, 같은 목록을 다시 돌리거나 대안 영상을 바꾸거나 오디오/MV 토글을 바꿔도 비용이 들지 않습니다.
- 중복된 줄은 검색을 한 번만 합니다. 확신이 없는 곡은 검색을 한 번 더 할 수 있습니다 (+100).
- `quotaExceeded`가 나면 안전하게 멈추고 부분 결과를 유지하며, 나중에 이어서 진행할 수 있습니다.
- 5xx/레이트리밋 오류는 지수 백오프로 재시도합니다.
- 할당량은 태평양 시간 자정에 초기화됩니다.

## 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| `MissingSecret` / "서버 구성 문제" | `.env`에 `AUTH_SECRET`이 없습니다. `.env` 수정 후 `npm run dev`를 재시작하세요. |
| Google 로그인 시 `403 access_denied` | OAuth 동의 화면의 Test users에 본인 계정을 추가하세요. |
| `LLM_API_KEY is not set` | `.env`를 채우고 재시작하세요. |
| LLM `404 model_not_found` | `LLM_DEFAULT_MODEL`이 틀렸습니다. 위의 `/models` 호출로 확인하세요. |
| LLM `429` / `5xx` | 제공자 한도/과부하입니다. 앱이 자동 재시도하며, 계속되면 잠시 후 다시 시도하세요. |
| 특정 곡의 대안이 이상하거나 비어 있음 | 해당 행의 "다시 검색"으로 캐시를 우회해 재검색하세요. |

## 보안 참고 사항

- **비밀 값은 서버에만 있습니다.** API 키는 라우트 핸들러에서만 읽습니다. Google OAuth 토큰은 암호화된 HttpOnly 세션 쿠키 안에만 있으며, 브라우저에 내려가는 세션 객체에는 **의도적으로 포함하지 않습니다**.
- **API 라우트에는 인증이 없습니다** (`/api/parse`, `/api/search`, `/api/disambiguate`). 로컬 단일 사용자용으로 설계했기 때문입니다. 서버에 접근할 수 있는 누구나 *내* LLM/YouTube 할당량을 쓸 수 있으므로 `dev`/`start`는 `127.0.0.1`에만 바인딩합니다. **공개 배포한다면 먼저 인증을 앞에 두세요.**
- 요청 본문은 크기 제한과 함께 Zod로 검증합니다 (최대 200줄, 줄당 300자, YouTube 영상 ID는 `[A-Za-z0-9_-]{11}` 형식). LLM이 고른 영상 ID는 제시된 후보 안에 있을 때만 받아들입니다.
- 포크를 푸시하기 전에 `git ls-files`에 `.env`가 없는지, `.env.example`이 빈 값인지 확인하세요. 키가 한 번이라도 유출됐다면 폐기(revoke)하고 재발급하세요.
- 취약점을 발견하면 공개 이슈 대신 GitHub의 비공개 보안 권고(private security advisory)로 알려 주세요.

## 프로젝트 구조

```
app/api/        라우트 핸들러 (parse, search, disambiguate, quota, playlist, auth)
components/     단일 페이지 UI (붙여넣기 -> 검토 표 -> 생성)
lib/llm/        OpenAI 호환 클라이언트, 구조화 출력 + 복구, 프롬프트
lib/parse/      후처리: 제목 고정, 힌트 추출
lib/youtube/    검색, 영상 상세, 재생목록 생성, 임시 링크
lib/scoring/    정규화 + 결정론적 점수 계산
lib/cache/      SQLite 캐시와 할당량 집계
tests/          Vitest 테스트 + 까다로운 쿼리 약 20개 픽스처
```

스택: Next.js (App Router) · TypeScript · Tailwind · Auth.js · Zod · SQLite (better-sqlite3) · Vitest.

## 라이선스

Apache License 2.0 — [LICENSE](LICENSE) 참고.
