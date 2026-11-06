// Realtime Database 데이터 구조 타입 정의

export type TeamId = "white" | "black";
export type GamePhase =
  | "waiting" // 대기실
  | "team_setup" // 팀 배정 후 팀명 설정
  | "rules" // 금지사항 안내
  | "keyword_reveal" // 키워드 공개
  | "round_in_progress" // 라운드 진행 중
  | "tiebreak" // 동점 → 상대 키워드 맞히기
  | "ended"; // 종료

// 한 라운드 진행 순서: 두 팀이 같은 단계를 동시에 하고, 두 팀 다 끝나야 다음 단계
// 암호 만들기(양 팀 동시) → 우리 팀 해독(양 팀 동시, 결과는 아직 비밀)
// → 상대 팀 가로채기(양 팀 동시, 2라운드부터) → 다 같이 공개(두 팀 결과 한 번에) → 라운드 끝 판정
export type RoundStage = "encrypting" | "decode" | "intercept" | "reveal" | "settled";

export const STAGE_ORDER: RoundStage[] = ["encrypting", "decode", "intercept", "reveal", "settled"];

// 예전 데이터 호환용으로만 남겨 둠 (지금은 항상 standard / offline)
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
  hubUid?: string; // 말랑월드에서 들어온 경우 말랑월드 계정 uid
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
  // 그 팀 암호가 "공개"된 뒤에만 쌓인다
  clueAccumulation: Record<string, string[]>;
  // 키워드 공개 화면에서 준비 완료
  keywordReady: boolean;
}

export interface RoundTeamData {
  encryptorUid: string;
  code: number[]; // 3자리, 1~4 중복없음
  clues: string[]; // 3개
  cluesSubmittedAt: number | null;
  ownGuess: number[] | null; // 자기 팀 해독
  ownGuessAt: number | null;
  ownCorrect: boolean | null;
  interceptGuess: number[] | null; // 상대팀이 이 팀 암호를 가로채려 한 답
  interceptGuessAt: number | null;
  intercepted: boolean | null;
}

// 팀이 같이 고르는 답안 (공유 초안)
export interface GuessDraft {
  picks: number[]; // 3칸, 0 = 비어 있음
  editorUid: string;
  editorName: string;
  at: number;
}

export interface Round {
  roundNumber: number;
  white: RoundTeamData;
  black: RoundTeamData;
  status: "in_progress" | "completed";
  stage: RoundStage;
  // 먼저 단서를 낸 쪽이 생기면 시각 기록 → 다른 암호전달자에게 30초
  encryptingTimerStartAt: number | null;
  // 공개 화면 확인: acks.all[uid] = true
  acks: Record<string, Record<string, boolean>>;
  // 공유 초안: drafts["white_decode"](흰팀 해독), drafts["white_intercept"](검은팀이 흰팀 암호 가로채기)
  drafts: Record<string, GuessDraft>;
}

export interface TiebreakState {
  prefix: string; // 끝난 이유 앞부분 (예: "8라운드 종료 · 점수 +1 vs +1")
  white: string[] | null; // 흰팀이 적은 검은팀 키워드 4개
  black: string[] | null; // 검은팀이 적은 흰팀 키워드 4개
  whiteBy: string; // 제출한 사람 이름
  blackBy: string;
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
  endReason: string | null;
  tiebreak: TiebreakState | null;
  hubSid?: string; // 말랑월드 판 id (말랑월드에서 만든 방만)
  hubHostUid?: string; // 말랑월드 방장 uid
}

export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const MAX_ROUNDS = 8;
export const TIMER_SECONDS = 30;

export function otherTeamOf(t: TeamId): TeamId {
  return t === "white" ? "black" : "white";
}

export function defaultTeamName(t: TeamId): string {
  return t === "white" ? "흰팀" : "검은팀";
}

export function stageIndex(stage: RoundStage | string | null | undefined): number {
  const i = STAGE_ORDER.indexOf(stage as RoundStage);
  return i < 0 ? 0 : i;
}

// 이 팀 단서가 상대 팀에게도 공개됐는지 (해독 단계에서는 자기 팀만 봄 → 가로채기 단계부터 공개)
export function cluesPublic(round: Round, team: TeamId): boolean {
  if (round.status === "completed") return true;
  return stageIndex(round.stage) >= stageIndex("intercept");
}

// 이 팀 암호(정답)가 공개됐는지
export function codeRevealed(round: Round, team: TeamId): boolean {
  if (round.status === "completed") return true;
  return stageIndex(round.stage) >= stageIndex("reveal");
}

// 단서 정규화 (재사용 체크용): 공백 제거 + 소문자
export function normalizeClue(clue: string): string {
  return clue.trim().toLowerCase().replace(/\s+/g, "");
}

// 단서 검사: 문제가 있으면 안내 문구, 없으면 null
export function validateClues(
  clues: string[],
  keywords: string[],
  previousClues: string[]
): string | null {
  if (clues.length !== 3 || clues.some((c) => !c || !c.trim())) {
    return "단서 3개를 모두 입력해주세요";
  }
  const kw = new Set(keywords.map(normalizeClue));
  const prev = new Set(previousClues.map(normalizeClue));
  const seen = new Set<string>();
  for (const c of clues) {
    const n = normalizeClue(c);
    if (kw.has(n)) return `"${c.trim()}"은(는) 우리 키워드 자체라 쓸 수 없어요`;
    if (seen.has(n)) return `"${c.trim()}"을(를) 두 번 썼어요`;
    if (prev.has(n)) return `"${c.trim()}"은(는) 우리 팀이 이미 쓴 단서예요`;
    seen.add(n);
  }
  return null;
}
