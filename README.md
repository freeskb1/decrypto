# Decrypto (한국어 웹 버전)

암호를 전송하라. 들키지 말고.

보드게임 Decrypto의 한국어 웹 버전입니다. 친구들과 모바일/PC 브라우저에서 함께 즐길 수 있어요.

## 기술 스택

- Next.js 14 (App Router) + TypeScript
- Firebase (Auth + Firestore) — 실시간 동기화
- Tailwind CSS + lucide-react
- Pretendard 폰트

---

# 🚀 배포 가이드

코드 zip을 받았다면 다음 순서로 진행하세요. **전체 소요 시간 약 15분.**

## 1. Firebase 콘솔 설정 (5분)

### 1-1. 프로젝트 생성

1. https://console.firebase.google.com 접속 (Google 계정 로그인)
2. **"프로젝트 추가"** 클릭
3. 프로젝트 이름 입력 (예: `decrypto-game`)
4. Google Analytics: **사용 안 함** 선택 (지금은 필요 없음)
5. 프로젝트 만들기

### 1-2. 웹 앱 등록

1. 프로젝트 메인 화면에서 **`</>` (웹) 아이콘** 클릭
2. 앱 닉네임 입력 (예: `decrypto-web`)
3. "Firebase 호스팅 설정" 체크 안 함 (Vercel 사용할 거니까)
4. 앱 등록

→ 다음 화면에 나오는 **firebaseConfig** 객체를 메모해두세요. 이런 형태입니다:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "decrypto-game.firebaseapp.com",
  projectId: "decrypto-game",
  storageBucket: "decrypto-game.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

### 1-3. 익명 로그인 활성화

1. 왼쪽 메뉴 **Authentication** → **시작하기**
2. **Sign-in method** 탭
3. **익명** 항목 클릭 → 사용 설정 → 저장

### 1-4. Firestore Database 생성

1. 왼쪽 메뉴 **Firestore Database** → **데이터베이스 만들기**
2. 위치: **`asia-northeast3 (Seoul)`** 선택 (한국에서 가장 빠름)
3. 보안 규칙: **테스트 모드로 시작** (나중에 강화 가능)
4. 사용 설정 클릭

### 1-5. Firestore 보안 규칙 (선택)

테스트 모드는 30일 후 만료됩니다. 게임 진행에 필요한 최소 규칙은:

1. **Firestore Database** → **규칙** 탭
2. 다음 규칙으로 교체 → **게시**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read, write: if request.auth != null;
      match /{document=**} {
        allow read, write: if request.auth != null;
      }
    }
  }
}
```

> 익명 인증된 모든 유저가 모든 방을 읽고 쓸 수 있는 단순 규칙입니다. 게임 자체는 정상 작동하지만 다른 방을 조작할 수도 있으니, 공개 운영하려면 추가 강화를 권장합니다.

---

## 2. GitHub 저장소 만들기 (3분)

### 2-1. 새 저장소 생성

1. https://github.com 로그인
2. 오른쪽 위 **`+`** → **New repository**
3. Repository name: `decrypto-game` (원하는 이름)
4. **Public** 또는 **Private** (어느 쪽이든 OK)
5. **README, .gitignore, license 추가 옵션은 모두 체크 해제**
6. **Create repository**

### 2-2. zip 압축 풀고 파일 업로드

1. 받은 `decrypto-game.zip` 압축 풀기
2. 안에 보이는 모든 파일/폴더를 선택
3. GitHub 저장소 페이지에 **드래그 앤 드롭**
   - "uploading an existing file" 링크 클릭 → 파일 드래그
4. Commit message: `initial commit` → **Commit changes**

> ⚠️ `node_modules` 폴더는 들어있지 않아야 합니다. Vercel이 자동으로 설치할 거예요.

---

## 3. Vercel 배포 (5분)

### 3-1. Vercel 가입 / 로그인

1. https://vercel.com 접속
2. **Continue with GitHub** 선택 (GitHub 계정 연동이 편함)

### 3-2. 프로젝트 import

1. Vercel 대시보드에서 **Add New...** → **Project**
2. 방금 만든 GitHub 저장소 옆 **Import** 클릭
3. **Configure Project** 화면이 나타남
   - Framework Preset: `Next.js` (자동 감지됨)
   - Root Directory: `.` (그대로 둠)

### 3-3. 환경변수 입력 (중요!)

**Environment Variables** 섹션을 펼친 뒤 다음 6개를 각각 추가합니다 (1-2 단계에서 받은 firebaseConfig 값):

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | (apiKey 값) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | (authDomain 값) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | (projectId 값) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | (storageBucket 값) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | (messagingSenderId 값) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | (appId 값) |

> 각각 Name 옆 입력칸에 이름, Value 입력칸에 값을 붙여넣고 **Add** 클릭.

### 3-4. 배포

1. **Deploy** 클릭
2. 2~3분 기다리면 빌드 완료
3. 축하 화면 + 자동 생성된 URL (예: `decrypto-game-xxx.vercel.app`)

---

## 4. 게임 플레이!

생성된 URL을 친구들에게 공유하고:
1. 닉네임 입력
2. 한 명이 "방 만들기" → 4자리 코드 공유
3. 다른 사람들이 코드로 참가
4. 방장이 "팀 랜덤 배정" → 게임 시작

---

# 🔧 트러블슈팅

### "Firebase 초기화 실패" 같은 에러
환경변수 6개를 모두 정확히 입력했는지 확인하세요. Vercel 대시보드 → 프로젝트 → Settings → Environment Variables에서 재확인. 수정했으면 **재배포** 필요 (Deployments 탭 → 최근 배포 → "..." → Redeploy).

### Firestore "permission denied" 에러
1-4 단계 보안 규칙이 테스트 모드인지 확인. 만료됐다면 1-5 단계의 규칙을 적용하세요.

### 익명 로그인 안 됨
Authentication → Sign-in method → 익명이 **사용 설정됨** 상태인지 확인.

### 방 코드 찾을 수 없음
방을 만든 사람과 참가하는 사람의 Firebase 프로젝트가 같은 곳을 봐야 합니다. 다른 URL을 쓰고 있다면 같은 환경변수를 사용하는지 확인.

---

# 📝 게임 규칙 요약

- 2팀, 팀당 2-4명
- 매 라운드 1-4 중 3자리 코드 생성 (예: 4·2·1)
- 암호전달자가 단서 작성 → 팀원 추측 + 상대팀 가로채기
- 가로채기 2개 = 승리 / 통신실패 2개 = 패배
- 8라운드 끝나면 토큰 많은 쪽 승리

자세한 룰은 앱 내 "게임 규칙 보기" 참고.

---

이 프로젝트는 Decrypto (Thomas Dagenais-Lespérance, Le Scorpion Masqué, 2018) 의 비상업 한국어 팬 메이드 웹 버전입니다.
