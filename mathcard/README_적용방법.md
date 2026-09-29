# 던전 카드 모험 — 적용 방법

쌓기나무 문제를 풀어 카드를 모으고, 친구와 1:1로 대결하는 카드게임입니다.
코드를 직접 고칠 필요는 없고, 아래 순서대로 **올리고(배포) → 반 만들고 → 학생 접속**만 하시면 됩니다.

---

## 1. 폴더 구성

| 파일·폴더 | 하는 일 |
|---|---|
| `server.js` | 게임 서버 (채점, 카드 뽑기, 대결 판정, 매칭) |
| `game/cards.js` | **카드 수치와 게임 설정** (HP, MP, 턴 시간 등). 숫자를 바꾸고 싶을 때 여기만 고치면 됨 |
| `game/battle.js` | 대결 규칙 계산 |
| `game/problems.js` | 쌓기나무 문제 자동 생성 |
| `game/cardArt.js` | 카드 그림과 카드 뒷면 자동 생성 |
| `public/index.html` 외 | 학생 화면 |
| `public/teacher.html` | 교사 관리 화면 |
| `public/img/` | 배경(미로 1~4)과 대결판 그림 |
| `public/img/custom/` | **내 그림으로 바꿀 때 파일을 넣는 곳** (아래 6번 참고) |
| `package.json` | 필요한 프로그램 목록 |

---

## 2. 배포하기 (Render)

릴레이 그림 게임과 같은 방식입니다.

1. 이 폴더 전체를 GitHub 저장소에 올립니다. (`node_modules` 폴더는 올리지 않아도 됩니다.)
2. Render에서 **New → Web Service**를 누르고 그 저장소를 연결합니다.
3. 설정값을 이렇게 넣습니다.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
4. **Environment(환경 변수)**에 교사 비밀번호를 꼭 넣어 주세요.
   - Key: `ADMIN_PASSWORD`
   - Value: 선생님만 아는 비밀번호
   - 넣지 않으면 기본 비밀번호 `teacher1234`가 쓰입니다. 학생이 알 수 있으니 꼭 바꿔 주세요.
5. 배포가 끝나면 주소가 생깁니다. (예: `https://math-card.onrender.com`)
   - 학생용 주소: `https://…onrender.com`
   - 교사용 주소: `https://…onrender.com/teacher.html`

> 내 컴퓨터에서 먼저 확인해 보고 싶으면: Node.js를 설치하고, 이 폴더에서 `npm install` → `npm start`를 실행한 뒤 `http://localhost:3000`에 접속하세요.

---

## 3. 수업 운영 순서

1. **수업 1~2분 전**에 교사 화면에 접속합니다. 무료 서버는 쉬고 있다가 첫 접속 때 깨어나느라 1분 정도 걸릴 수 있어요.
2. 교사 화면에서 비밀번호로 로그인하고 **반 만들기**를 합니다. (예: 반 코드 `6-1`, 24명)
3. 학생들이 학생용 주소로 들어와 **반 → 자기 번호**를 누릅니다.
   - 이미 접속 중인 번호는 눌리지 않아서, 두 명이 같은 번호로 들어오는 걸 막아 줘요.
4. 학생: **모험 시작 → 게임 방법 팝업 확인 → 문제 풀기 → 카드 3장 중 1장 고르기**를 반복합니다.
   - 문제는 다섯 가지 유형이 골고루 섞여서 나옵니다.
   - 틀리면 같은 문제를 다시 풉니다.
   - 5번 연속으로 틀리면 남은 칸이 가뭄 카드로 채워집니다.
5. 18장이 모이면 **대결 방법 팝업**이 뜨고, **대결 찾기**를 누르면 대기열에 들어갑니다.
6. **접속한 학생이 모두 대기열에 들어오면** 무작위로 짝이 정해집니다.
   - 인원이 홀수면 한 명은 **연습 로봇**과 대결해요.
   - 직전 상대와는 되도록 다시 만나지 않게 짝을 짓습니다.
   - 늦는 학생 때문에 너무 오래 기다리면 교사 화면의 **"지금 대기 중인 학생끼리 매칭"** 버튼을 누르세요.
7. 대결이 끝나면 결과 화면이 나오고, **다음 모험 준비**에서 가져갈 카드 5장을 고릅니다.
   - 고를 수 있는 건 기본 카드를 뺀, 직접 얻은 카드예요.
   - 그 뒤 7문제를 풀어 다시 18장을 채웁니다.

### 교사 화면 기능

- **진행 현황:** 학생마다 접속 여부, 단계, 카드 수, 몇 번째 판인지, 전적, 대결 중 HP가 보입니다.
  - 연속 오답이 3번 이상이면 표시가 떠서 도움이 필요한 학생을 찾을 수 있어요.
  - 가뭄 덱을 받은 학생도 표시됩니다.
- **대결 결과 기록:** 시각, 대결한 두 사람, 승자, 턴 수, 남은 HP가 남습니다.
- **학생 초기화 / 반 전체 초기화:** 대결 중인 학생을 초기화하면 상대의 승리로 처리돼요.
- **반 삭제**

---

## 4. 알아두실 점

- **기록은 서버 메모리에만 저장돼요.** 서버가 재시작되거나 오래 쉬면 반, 덱, 기록이 모두 사라지고, 반을 다시 만들면 됩니다. 수업 중에는 학생들이 계속 접속해 있어서 괜찮습니다.
- **새로고침해도 괜찮아요.** 같은 기기에서는 자동으로 다시 들어가고, 다른 기기에서도 같은 번호를 누르면 이어서 할 수 있습니다.
- **대결 중에 나가면** 그 학생의 턴은 15초마다 자동으로 패스됩니다.
- **가로 화면 전용이에요.** 세로로 들면 "화면을 가로로 돌려 주세요" 안내가 떠요. 안드로이드 태블릿은 번호를 누를 때 전체 화면과 가로 고정을 자동으로 시도해요. 아이패드는 기기에서 직접 가로로 돌려 주세요.
- **글꼴:** 제목 글꼴(주아체)은 인터넷에서 불러옵니다. 학교망에서 막히면 기본 글꼴로 보일 뿐 게임에는 문제없어요.

---

## 5. 숫자 바꾸기 (`game/cards.js`)

맨 위 `CONFIG`에서 바꿀 수 있어요.

| 항목 | 지금 값 | 뜻 |
|---|---|---|
| `HP` | 15 | 시작 HP이자 최대 HP |
| `MP` | 5 | 시작 MP이자 최대 MP |
| `TURN_SECONDS` | 15 | 한 턴에 카드를 고르는 제한 시간(초) |
| `REVEAL_SECONDS` | 3 | 카드를 공개한 뒤 보여 주는 시간(초) |
| `KEEP_COUNT` | 5 | 다음 게임으로 가져가는 카드 수 |
| `DROUGHT_WRONG` | 5 | 몇 번 연속으로 틀리면 가뭄 덱을 줄지 |

카드 수치는 그 아래 `CARDS`에서 바꿉니다. (예: `cost: 2` → `cost: 1`)
카드 설명 문장은 수치에 맞춰 자동으로 만들어져요. 직접 고치기 어려우시면 Claude에게 "○○ 카드 MP를 1로 바꿔줘"라고 부탁하세요.

---

## 6. 그림 바꾸기

### 지금 쓰고 있는 그림

| 쓰이는 곳 | 파일 |
|---|---|
| 로그인, 로비, 카드 선택, 결과 화면 | `public/img/maze1.jpg` |
| 문제 풀이 (문제마다 1·2·3이 무작위로 바뀜) | `public/img/maze1.jpg`, `maze2.jpg`, `maze3.jpg` |
| 대기열 화면, 대결 화면 양옆 | `public/img/maze4.jpg` |
| 대결판 | `public/img/board.jpg` |

선생님이 주신 미로 배경 1~4와 대결판 그림을 **웹용으로 줄인 파일**이에요. 원본 PNG는 한 장에 9MB라서, 24명이 동시에 받으면 학교 와이파이가 느려져요. 그래서 한 장에 약 300KB로 줄였어요.

**원본 파일은 GitHub에 올리지 않아도 됩니다.** `custom/미로 배경` 폴더와 `대결판 그림.jpg`는 게임에서 쓰지 않아요.

### 새 그림으로 바꾸는 방법

`public/img/custom/` 폴더에 **아래 이름**으로 그림 파일(png, jpg, webp)을 넣으면, 기본 그림 대신 그 그림이 쓰여요.
- 한 장에 **1MB 이하**를 추천해요. 큰 그림은 Claude에게 "웹용으로 줄여줘"라고 부탁하세요.
- 가로 그림을 추천해요. 대결판은 정사각형이어야 해요.

| 바꿀 그림 | 파일 이름 |
|---|---|
| 미로 배경 1~4 | `custom/maze1.jpg` ~ `custom/maze4.jpg` |
| 대결판 (정사각형) | `custom/board.jpg` |
| 카드 뒷면 (세로 2:3) | `custom/cardback.png` |
| 카드 그림 (가로:세로 = 10:7, 예: 1000×700) | `custom/cards/카드id.png` |

**대결판을 바꿀 때 주의할 점:** HP와 MP 칸은 지금 대결판 그림의 **오른쪽 위(상대)**와 **왼쪽 아래(나)**에 있는 빈 칸 위치에 맞춰 놓았어요. 모양이 다른 대결판으로 바꾸면 위치 조정이 필요하니 Claude에게 그림을 보여 주세요.

### 카드 id 목록

| 카드 | id | 카드 | id |
|---|---|---|---|
| 기본 공격 | `base_attack` | 명상 | `meditate` |
| 기본 방어 | `base_defense` | 집중 | `focus` |
| 마나 충전 | `base_mana` | 응급 처치 | `firstaid` |
| 내려치기 | `strike` | 회복 물약 | `potion` |
| 방어구 부수기 | `weakpoint` | 조커 | `joker` |
| 강타 | `heavy` | 반사 거울 | `mirror` |
| 암살 | `pierce` | 녹슨 대검 (가뭄) | `rusty_sword` |
| 무차별공격 | `ultimate` | 무딘 창 (가뭄) | `dull_spear` |
| 단단한 방패 | `guard` | 금 간 방패 (가뭄) | `cracked` |
| 철벽 | `fortress` | 약한 충전 (가뭄) | `weak_mana` |
| 마나 방패 | `managuard` | | |

### Gemini로 카드 그림 만들기 (추천)

지금 카드 그림은 코드로 그린 그림이에요. 미로 배경처럼 **그림 느낌의 던전 RPG 일러스트**로 바꾸고 싶으시면, Gemini에 아래 공통 문장과 카드별 문장을 이어 붙여 만들어 보세요.

**공통 문장:**
> dark fantasy dungeon RPG card illustration, painterly digital art, dramatic torch lighting, stone dungeon background, no text, no letters, no border, landscape 10:7 ratio,

| 카드 | 이어 붙일 문장 |
|---|---|
| 기본 공격 | a worn steel longsword with glowing embers |
| 기본 방어 | an iron round buckler with rivets |
| 마나 충전 | a glowing blue mana crystal floating |
| 내려치기 | a sword slashing downward with a bright arc trail |
| 방어구 부수기 | a war hammer shattering a steel shield into pieces |
| 강타 | a huge spiked mace smashing the ground with a shockwave |
| 암살 | a hooded assassin with red eyes holding a dagger in the shadows |
| 무차별공격 | crossed swords surrounded by roaring fire |
| 단단한 방패 | a knight's heater shield with a red cross emblem |
| 철벽 | a massive stone fortress wall with an iron portcullis |
| 마나 방패 | a steel shield glowing with blue runes |
| 명상 | a candle inside a glowing blue rune circle |
| 집중 | a glowing purple eye inside a golden rune circle |
| 응급 처치 | bandages and healing herbs on an old table |
| 회복 물약 | a glowing red healing potion flask |
| 조커 | a cracked half-black half-white jester mask with gold bells |
| 반사 거울 | an ornate golden mirror reflecting purple magic |
| 녹슨 대검 | a rusty broken greatsword |
| 무딘 창 | an old dull rusty spear |
| 금 간 방패 | a cracked rusty shield |
| 약한 충전 | a dim cracked mana crystal |

만든 그림은 `custom/cards/` 폴더에 **카드 id 이름**으로 저장하면 돼요. (예: `custom/cards/strike.png`)

---

## 7. 이럴 땐 이렇게

| 증상 | 해결 |
|---|---|
| 학생 화면에 "아직 열린 반이 없어요" | 교사 화면에서 반을 먼저 만들어 주세요. 서버가 재시작됐다면 반을 다시 만들어야 해요. |
| "이미 다른 기기에서 접속 중인 번호" | 다른 학생이 잘못 눌렀을 수 있어요. 그 기기를 닫거나 새로고침하면 풀립니다. |
| 대기열에서 계속 기다림 | 아직 문제를 푸는 학생이 있어서예요. 교사 화면의 매칭 버튼으로 바로 시작할 수 있어요. |
| 학생이 번호를 잘못 골랐음 | 로비 화면의 "번호 바꾸기"를 누르세요. 이미 진행 중이면 교사 화면에서 그 번호를 초기화하세요. |
| 교사 화면 로그인이 안 됨 | Render의 `ADMIN_PASSWORD` 값과 같은지 확인하세요. |
