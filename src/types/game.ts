// Firestore 데이터 구조 타입 정의

export type TeamId = "white" | "black";
export type GamePhase =
  | "waiting"           // 대기실
  | "team_setup"        // 팀 배정 후 팀명 설정
  | "rules"             // 금지사항 안내
  | "keyword_reveal"    // 키워드 공개
  | "round_in_progress" // 라운드 진행 중
  | "ended";            // 종료
export type RoundStage =
  | "announce"   // 단계 A: 암호전달자 발표
  | "encrypting" // 단계 B: 단서 작성
  | "guessing"   // 단계 C: 자기 팀 추측
  | "own_result" // 단계 D-1: 자기 팀 결과
  | "intercept"  // 단계 D-2: 상대팀 가로채기
  | "settled";   // 라운드 정산 끝
export type GameMode = "standard" | "duel";
export type ConnectMode = "online" | "offline";

export interface Player {
  uid: string;
  nickname: string;
  team: TeamId | null;
  isHost: boolean;
  isOnline: boolean;
  joinedAt: number;
  lastSeenAt: number;
}

export interface TeamState {
  name: string;
  keywords: string[]; // 4개
  shuffleUsedCount: number; // 0~2
  interceptionTokens: number;
  miscommunicationTokens: number;
  playerOrder: string[]; // uid 순서
  currentEncryptorIdx: number;
  // 코드별 누적 단서: {1: ["빨강","과일"], 2: [...], 3: [...], 4: [...]}
  clueAccumulation: Record<string, string[]>;
  // 결과 화면 완료 상태
  ownResultAcked: boolean;
  interceptAcked: boolean;
  // 키워드 공개 화면에서 준비 완료
  keywordReady: boolean;
}

export interface RoundTeamData {
  encryptorUid: string;
  code: number[]; // 3자리, 1~4 중복없음
  clues: string[]; // 3개
  cluesSubmittedAt: number | null;
  ownGuess: number[] | null; // 자기 팀 추측
  ownGuessAt: number | null;
  ownCorrect: boolean | null;
  interceptGuess: number[] | null; // 상대팀이 우리에 대해 가로채기 시도
  interceptGuessAt: number | null;
  intercepted: boolean | null;
}

export interface Round {
  roundNumber: number;
  white: RoundTeamData;
  black: RoundTeamData;
  status: "in_progress" | "completed";
  stage: RoundStage;
  // 단계 B 타이머: 먼저 끝낸 팀 기준
  encryptingTimerStartAt: number | null;
}

export interface ChatMessage {
  id: string;
  senderUid: string;
  senderNickname: string;
  team: TeamId | null;
  scope: "team" | "all";
  text: string;
  createdAt: number;
}

export interface Room {
  id: string;
  code: string; // 4자리 숫자
  createdAt: number;
  hostUid: string;
  connectMode: ConnectMode;
  gameMode: GameMode;
  phase: GamePhase;
  roundNumber: number; // 0이면 시작 전, 1~8
  winner: TeamId | "draw" | null;
}

// 단서 정규화 (재사용 체크용): 공백 제거 + 소문자
export function normalizeClue(clue: string): string {
  return clue.trim().toLowerCase().replace(/\s+/g, "");
}
