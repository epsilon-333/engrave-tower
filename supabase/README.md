# 계정·저장 DB (Supabase)

- 프로젝트: `engrave-tower` (ap-northeast-2)
- 테이블 `players`(아이디, bcrypt 비밀번호, 저장 JSON), `sessions`(로그인 토큰, 60일)
- 테이블은 RLS로 직접 접근을 막고, 아래 DB 함수로만 사용합니다.
  `game_register`, `game_login`, `game_session`, `game_store`, `game_logout`
- 브라우저에는 공개용(publishable) 키만 들어갑니다.
