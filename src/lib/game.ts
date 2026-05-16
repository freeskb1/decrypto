import {
  ref,
  get,
  set,
  update,
  remove,
  push,
  onValue,
  off,
  query,
  orderByChild,
  runTransaction,
  serverTimestamp,
  onDisconnect,
  Unsubscribe,
  DataSnapshot,
} from "firebase/database";
import { signInAnonymously, onAuthStateChanged, User } from "firebase/auth";
import { db, auth } from "./firebase";
import type {
  Room,
  Player,
  TeamState,
  Round,
  ChatMessage,
  TeamId,
  GameMode,
  ConnectMode,
  RoundStage,
  RoundTeamData,
} from "@/types/game";
import { normalizeClue } from "@/types/game";
import {
  generateRoomCode,
  generateGameCode,
  pickRandomKeywords,
  distributeTeams,
} from "./utils";
import keywordsData from "./keywords.json";

const KEYWORDS_POOL: string[] = keywordsData.keywords;

// ========================================================================
// 데이터 구조 (RTDB는 트리)
// ========================================================================
// /rooms/{roomId}                          ← Room 데이터
// /rooms/{roomId}/players/{uid}            ← Player
// /rooms/{roomId}/teams/white              ← TeamState
// /rooms/{roomId}/teams/black              ← TeamState
// /rooms/{roomId}/rounds/{n}               ← Round
// /rooms/{roomId}/chats/{pushKey}          ← ChatMessage
// /rooms/{roomId}/usedClues/{normalized}   ← { original, team, roundNumber }
// /roomCodes/{code}                        ← { roomId }  (코드로 방 빠르게 찾기)
// ========================================================================

function snapToArray<T>(snap: DataSnapshot): T[] {
  const out: T[] = [];
  snap.forEach((child) => {
    const val = child.val();
    if (val) out.push(val as T);
    return false;
  });
  return out;
}

// ====== 인증 ======
export async function ensureAnonymousAuth(): Promise<User> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (user) {
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

// ====== 방 생성 ======
export async function createRoom(
  hostUid: string,
  hostNickname: string,
  connectMode: ConnectMode,
  gameMode: GameMode
): Promise<{ roomId: string; code: string }> {
  // roomId: push로 자동 생성
  const newRoomRef = push(ref(db, "rooms"));
  const roomId = newRoomRef.key!;

  // 고유 코드 만들기 (충돌 시 재시도)
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = generateRoomCode();
    const codeSnap = await get(ref(db, `roomCodes/${code}`));
    if (!codeSnap.exists()) break;
  }

  const now = Date.now();

  const hostPlayer: Player = {
    uid: hostUid,
    nickname: hostNickname,
    team: null,
    isHost: true,
    isOnline: true,
    joinedAt: now,
    lastSeenAt: now,
  };

  // room 객체 안에 players를 포함해서 한 번에 set
  // (부모 경로 rooms/{roomId}와 자식 경로 rooms/{roomId}/players를 동시에 쓰면 RTDB 에러)
  const roomData: any = {
    id: roomId,
    code,
    createdAt: now,
    hostUid,
    connectMode,
    gameMode,
    phase: "waiting",
    roundNumber: 0,
    winner: null,
    players: {
      [hostUid]: hostPlayer,
    },
  };

  // 두 개의 별도 경로(서로 ancestor 관계 아님)에 동시 쓰기 - OK
  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}`] = roomData;
  updates[`roomCodes/${code}`] = { roomId };

  await update(ref(db), updates);

  return { roomId, code };
}

// ====== 방 참가 (코드로) ======
export async function joinRoom(
  code: string,
  uid: string,
  nickname: string
): Promise<string> {
  const codeSnap = await get(ref(db, `roomCodes/${code}`));
  if (!codeSnap.exists()) throw new Error("방을 찾을 수 없어요");

  const roomId = codeSnap.val().roomId;
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = roomSnap.val() as Room;
  if (room.phase === "ended") throw new Error("이미 종료된 방이에요");

  const now = Date.now();
  await set(ref(db, `rooms/${roomId}/players/${uid}`), {
    uid,
    nickname,
    team: null,
    isHost: false,
    isOnline: true,
    joinedAt: now,
    lastSeenAt: now,
  } as Player);

  return roomId;
}

// ====== 방 참가 (roomId로 - 링크 접속용) ======
export async function joinRoomById(
  roomId: string,
  uid: string,
  nickname: string
): Promise<void> {
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = roomSnap.val() as Room;
  if (room.phase === "ended") throw new Error("이미 종료된 방이에요");
  if (room.phase !== "waiting") throw new Error("이미 시작된 게임이에요");

  const now = Date.now();
  await set(ref(db, `rooms/${roomId}/players/${uid}`), {
    uid,
    nickname,
    team: null,
    isHost: false,
    isOnline: true,
    joinedAt: now,
    lastSeenAt: now,
  } as Player);
}

// ====== 구독: 방 정보 ======
export function subscribeRoom(
  roomId: string,
  cb: (room: Room | null) => void
): Unsubscribe {
  const r = ref(db, `rooms/${roomId}`);
  const handler = (snap: DataSnapshot) => {
    if (snap.exists()) {
      const val = snap.val();
      cb({
        id: roomId,
        code: val.code,
        createdAt: val.createdAt,
        hostUid: val.hostUid,
        connectMode: val.connectMode,
        gameMode: val.gameMode,
        phase: val.phase,
        roundNumber: val.roundNumber || 0,
        winner: val.winner ?? null,
      } as Room);
    } else {
      cb(null);
    }
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ====== 구독: 플레이어 목록 ======
export function subscribePlayers(
  roomId: string,
  cb: (players: Player[]) => void
): Unsubscribe {
  const r = ref(db, `rooms/${roomId}/players`);
  const handler = (snap: DataSnapshot) => {
    const players: Player[] = [];
    snap.forEach((child) => {
      const v = child.val();
      if (v) players.push(v as Player);
      return false;
    });
    players.sort((a, b) => a.joinedAt - b.joinedAt);
    cb(players);
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ====== 구독: 팀 상태 ======
export function subscribeTeam(
  roomId: string,
  teamId: TeamId,
  cb: (team: TeamState | null) => void
): Unsubscribe {
  const r = ref(db, `rooms/${roomId}/teams/${teamId}`);
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const v = snap.val();
    // clueAccumulation null/undefined 방어
    cb({
      name: v.name,
      keywords: v.keywords || [],
      shuffleUsedCount: v.shuffleUsedCount || 0,
      interceptionTokens: v.interceptionTokens || 0,
      miscommunicationTokens: v.miscommunicationTokens || 0,
      playerOrder: v.playerOrder || [],
      currentEncryptorIdx: v.currentEncryptorIdx || 0,
      clueAccumulation: v.clueAccumulation || { "1": [], "2": [], "3": [], "4": [] },
      ownResultAcked: v.ownResultAcked === true,
      interceptAcked: v.interceptAcked === true,
      keywordReady: v.keywordReady === true,
    });
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ====== 구독: 라운드 ======
export function subscribeRound(
  roomId: string,
  roundNumber: number,
  cb: (round: Round | null) => void
): Unsubscribe {
  const r = ref(db, `rooms/${roomId}/rounds/${roundNumber}`);
  const handler = (snap: DataSnapshot) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const v = snap.val();
    cb({
      roundNumber: v.roundNumber,
      white: hydrateRoundTeamData(v.white),
      black: hydrateRoundTeamData(v.black),
      status: v.status,
      stage: v.stage,
      encryptingTimerStartAt: v.encryptingTimerStartAt ?? null,
    });
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

function hydrateRoundTeamData(v: any): RoundTeamData {
  return {
    encryptorUid: v?.encryptorUid || "",
    code: v?.code || [],
    clues: v?.clues || [],
    cluesSubmittedAt: v?.cluesSubmittedAt ?? null,
    ownGuess: v?.ownGuess ?? null,
    ownGuessAt: v?.ownGuessAt ?? null,
    ownCorrect: v?.ownCorrect ?? null,
    interceptGuess: v?.interceptGuess ?? null,
    interceptGuessAt: v?.interceptGuessAt ?? null,
    intercepted: v?.intercepted ?? null,
  };
}

// ====== 구독: 채팅 ======
export function subscribeChat(
  roomId: string,
  cb: (messages: ChatMessage[]) => void
): Unsubscribe {
  const r = query(ref(db, `rooms/${roomId}/chats`), orderByChild("createdAt"));
  const handler = (snap: DataSnapshot) => {
    const messages: ChatMessage[] = [];
    snap.forEach((child) => {
      const v = child.val();
      if (v) messages.push({ id: child.key!, ...v } as ChatMessage);
      return false;
    });
    cb(messages);
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ====== 채팅 전송 ======
export async function sendChat(
  roomId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">
) {
  const chatRef = push(ref(db, `rooms/${roomId}/chats`));
  await set(chatRef, {
    ...msg,
    createdAt: Date.now(),
  });
}

// ====== 팀 랜덤 배정 + 키워드 발급 ======
export async function assignTeamsAndStart(roomId: string) {
  const playersSnap = await get(ref(db, `rooms/${roomId}/players`));
  const playerUids: string[] = [];
  playersSnap.forEach((child) => {
    playerUids.push(child.key!);
    return false;
  });

  const { white, black } = distributeTeams(playerUids);

  // 키워드 8개 뽑아서 4개씩 분배
  const allKeywords = pickRandomKeywords(KEYWORDS_POOL, 8);
  const whiteKeywords = allKeywords.slice(0, 4);
  const blackKeywords = allKeywords.slice(4, 8);

  const whiteTeam: TeamState = {
    name: "화이트팀",
    keywords: whiteKeywords,
    shuffleUsedCount: 0,
    interceptionTokens: 0,
    miscommunicationTokens: 0,
    playerOrder: white,
    currentEncryptorIdx: 0,
    clueAccumulation: { "1": [], "2": [], "3": [], "4": [] },
    ownResultAcked: false,
    interceptAcked: false,
    keywordReady: false,
  };
  const blackTeam: TeamState = {
    name: "블랙팀",
    keywords: blackKeywords,
    shuffleUsedCount: 0,
    interceptionTokens: 0,
    miscommunicationTokens: 0,
    playerOrder: black,
    currentEncryptorIdx: 0,
    clueAccumulation: { "1": [], "2": [], "3": [], "4": [] },
    ownResultAcked: false,
    interceptAcked: false,
    keywordReady: false,
  };

  // 한 번의 multi-path update
  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/teams/white`] = whiteTeam;
  updates[`rooms/${roomId}/teams/black`] = blackTeam;
  for (const uid of white) {
    updates[`rooms/${roomId}/players/${uid}/team`] = "white";
  }
  for (const uid of black) {
    updates[`rooms/${roomId}/players/${uid}/team`] = "black";
  }
  updates[`rooms/${roomId}/phase`] = "team_setup";

  await update(ref(db), updates);
}

// ====== 팀 이름 수정 ======
export async function updateTeamName(
  roomId: string,
  teamId: TeamId,
  name: string
) {
  const finalName = name.trim() || (teamId === "white" ? "화이트팀" : "블랙팀");
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), {
    name: finalName,
  });
}

// ====== 키워드 셔플 ======
export async function shuffleTeamKeywords(roomId: string, teamId: TeamId) {
  const teamRef = ref(db, `rooms/${roomId}/teams/${teamId}`);
  const otherTeamId: TeamId = teamId === "white" ? "black" : "white";
  const otherRef = ref(db, `rooms/${roomId}/teams/${otherTeamId}`);

  // 트랜잭션으로 셔플 카운트와 키워드 원자적 갱신
  const result = await runTransaction(teamRef, (team) => {
    if (!team) return team;
    if ((team.shuffleUsedCount || 0) >= 2) return; // 중단
    // 키워드는 트랜잭션 안에서 결정 (외부에서 미리 결정하면 변경됨)
    // 다만 상대 키워드를 알아야 해서 트랜잭션 후 별도 처리...
    // 간단하게: 트랜잭션 안에서 count만 올리고, 키워드는 외부에서 set
    team.shuffleUsedCount = (team.shuffleUsedCount || 0) + 1;
    return team;
  });

  if (!result.committed) throw new Error("셔플 횟수 초과");

  // 키워드 새로 뽑기 (양 팀 기존 키워드 제외)
  const otherSnap = await get(otherRef);
  const teamSnap = await get(teamRef);
  const myCurrentKeywords: string[] = teamSnap.val()?.keywords || [];
  const otherKeywords: string[] = otherSnap.val()?.keywords || [];
  const exclude = [...myCurrentKeywords, ...otherKeywords];
  const newKeywords = pickRandomKeywords(KEYWORDS_POOL, 4, exclude);

  await update(teamRef, { keywords: newKeywords });
}

// ====== 게임 시작 단계 전환 ======
export async function goToRulesScreen(roomId: string) {
  await update(ref(db, `rooms/${roomId}`), { phase: "rules" });
}

export async function goToKeywordReveal(roomId: string) {
  await update(ref(db, `rooms/${roomId}`), { phase: "keyword_reveal" });
}

// 키워드 공개 화면에서 "준비 완료" - 표시만 함
// 양 팀 모두 준비되면 KeywordReveal 컴포넌트(호스트)가 startRound를 호출
export async function markTeamReady(roomId: string, teamId: TeamId) {
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), {
    keywordReady: true,
  });
}

// ====== 라운드 시작 ======
export async function startRound(roomId: string, roundNumber: number) {
  console.log("[startRound] 시작", roomId, roundNumber);
  // 중복 시작 방지
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) {
    console.log("[startRound] 방 없음");
    return;
  }
  const currentRoom = roomSnap.val() as Room;
  if (
    currentRoom.phase === "round_in_progress" &&
    (currentRoom.roundNumber || 0) >= roundNumber
  ) {
    console.log("[startRound] 이미 진행 중", currentRoom.phase, currentRoom.roundNumber);
    return; // 이미 진행 중
  }

  const whiteSnap = await get(ref(db, `rooms/${roomId}/teams/white`));
  const blackSnap = await get(ref(db, `rooms/${roomId}/teams/black`));

  if (!whiteSnap.exists() || !blackSnap.exists()) {
    console.log("[startRound] 팀 없음", whiteSnap.exists(), blackSnap.exists());
    throw new Error("팀 정보를 찾을 수 없어요");
  }
  const white = whiteSnap.val() as TeamState;
  const black = blackSnap.val() as TeamState;

  const whitePlayerOrder = white.playerOrder || [];
  const blackPlayerOrder = black.playerOrder || [];
  const whiteEncryptorIdx =
    (roundNumber - 1) % Math.max(whitePlayerOrder.length, 1);
  const blackEncryptorIdx =
    (roundNumber - 1) % Math.max(blackPlayerOrder.length, 1);

  const round: Round = {
    roundNumber,
    white: emptyRoundTeamData(
      whitePlayerOrder[whiteEncryptorIdx] || "",
      generateGameCode()
    ),
    black: emptyRoundTeamData(
      blackPlayerOrder[blackEncryptorIdx] || "",
      generateGameCode()
    ),
    status: "in_progress",
    stage: "announce",
    encryptingTimerStartAt: null,
  };

  console.log("[startRound] round 객체 생성됨", JSON.stringify(round));

  // 모두 자식 경로 → 부모/자식 충돌 없음
  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/rounds/${roundNumber}`] = round;
  updates[`rooms/${roomId}/phase`] = "round_in_progress";
  updates[`rooms/${roomId}/roundNumber`] = roundNumber;
  updates[`rooms/${roomId}/teams/white/ownResultAcked`] = false;
  updates[`rooms/${roomId}/teams/white/interceptAcked`] = false;
  updates[`rooms/${roomId}/teams/black/ownResultAcked`] = false;
  updates[`rooms/${roomId}/teams/black/interceptAcked`] = false;

  await update(ref(db), updates);
  console.log("[startRound] update 완료!");
}

function emptyRoundTeamData(encryptorUid: string, code: number[]): RoundTeamData {
  return {
    encryptorUid,
    code,
    clues: [],
    cluesSubmittedAt: null,
    ownGuess: null,
    ownGuessAt: null,
    ownCorrect: null,
    interceptGuess: null,
    interceptGuessAt: null,
    intercepted: null,
  };
}

// ====== 단계 전환 ======
export async function advanceStage(
  roomId: string,
  roundNumber: number,
  nextStage: RoundStage
) {
  // 같은 stage로 이미 가있으면 무시 (중복 호출 방지)
  const stageRef = ref(db, `rooms/${roomId}/rounds/${roundNumber}/stage`);
  await runTransaction(stageRef, (current) => {
    if (current === nextStage) return; // 중단
    // stage 순서 체크
    const order: RoundStage[] = [
      "announce",
      "encrypting",
      "guessing",
      "own_result",
      "intercept",
      "settled",
    ];
    if (current && order.indexOf(current) >= order.indexOf(nextStage)) {
      return; // 이미 뒤로 못 감
    }
    return nextStage;
  });
}

// ====== 단서 제출 ======
export async function submitClues(
  roomId: string,
  roundNumber: number,
  teamId: TeamId,
  clues: string[]
) {
  // 단서 재사용 체크
  const usedSnap = await get(ref(db, `rooms/${roomId}/usedClues`));
  const used = new Set<string>();
  if (usedSnap.exists()) {
    usedSnap.forEach((child) => {
      const v = child.val();
      if (v && v.team === teamId) {
        used.add(normalizeClue(v.original));
      }
      return false;
    });
  }

  for (const c of clues) {
    if (used.has(normalizeClue(c))) {
      throw new Error(`"${c}" 는 이미 사용한 단서예요`);
    }
  }

  const now = Date.now();
  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/rounds/${roundNumber}/${teamId}/clues`] = clues;
  updates[`rooms/${roomId}/rounds/${roundNumber}/${teamId}/cluesSubmittedAt`] = now;

  // 사용 단서 기록
  for (const c of clues) {
    const norm = normalizeClue(c);
    // key는 정규화된 단서 + 팀 (중복 방지). path-safe 처리
    const safeKey = `${teamId}_${norm.replace(/[.#$\[\]\/]/g, "_")}`;
    updates[`rooms/${roomId}/usedClues/${safeKey}`] = {
      original: c,
      normalized: norm,
      team: teamId,
      roundNumber,
    };
  }

  await update(ref(db), updates);

  // 먼저 제출한 쪽이면 상대팀에게 타이머 시작
  const roundSnap = await get(ref(db, `rooms/${roomId}/rounds/${roundNumber}`));
  const r = roundSnap.val() as Round;
  const bothSubmitted = r.white?.cluesSubmittedAt && r.black?.cluesSubmittedAt;
  if (!bothSubmitted && (r.encryptingTimerStartAt === null || r.encryptingTimerStartAt === undefined)) {
    await update(ref(db, `rooms/${roomId}/rounds/${roundNumber}`), {
      encryptingTimerStartAt: now,
    });
  }
}

// ====== 자기 팀 추측 제출 ======
export async function submitOwnGuess(
  roomId: string,
  roundNumber: number,
  teamId: TeamId,
  guess: number[]
) {
  const roundSnap = await get(ref(db, `rooms/${roomId}/rounds/${roundNumber}`));
  const round = roundSnap.val() as Round;
  const teamData = round[teamId];
  const correct = arraysEqual(teamData.code, guess);

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/rounds/${roundNumber}/${teamId}/ownGuess`] = guess;
  updates[`rooms/${roomId}/rounds/${roundNumber}/${teamId}/ownGuessAt`] = Date.now();
  updates[`rooms/${roomId}/rounds/${roundNumber}/${teamId}/ownCorrect`] = correct;

  // 코드 누적 단서 갱신
  const teamSnap = await get(ref(db, `rooms/${roomId}/teams/${teamId}`));
  const team = teamSnap.val() as TeamState;
  const newAcc = { ...team.clueAccumulation };
  for (let i = 0; i < 3; i++) {
    const codeNum = String(teamData.code[i]);
    newAcc[codeNum] = [...(newAcc[codeNum] || []), teamData.clues[i]];
  }
  updates[`rooms/${roomId}/teams/${teamId}/clueAccumulation`] = newAcc;

  // 통신실패 토큰
  if (!correct) {
    updates[`rooms/${roomId}/teams/${teamId}/miscommunicationTokens`] =
      (team.miscommunicationTokens || 0) + 1;
  }

  await update(ref(db), updates);

  // 승부 체크
  await checkGameEnd(roomId);
}

// ====== 가로채기 제출 ======
export async function submitInterceptGuess(
  roomId: string,
  roundNumber: number,
  ourTeam: TeamId,
  guess: number[]
) {
  const opponentTeam: TeamId = ourTeam === "white" ? "black" : "white";
  const roundSnap = await get(ref(db, `rooms/${roomId}/rounds/${roundNumber}`));
  const round = roundSnap.val() as Round;
  const opponentData = round[opponentTeam];
  const intercepted = arraysEqual(opponentData.code, guess);

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/rounds/${roundNumber}/${opponentTeam}/interceptGuess`] =
    guess;
  updates[`rooms/${roomId}/rounds/${roundNumber}/${opponentTeam}/interceptGuessAt`] =
    Date.now();
  updates[`rooms/${roomId}/rounds/${roundNumber}/${opponentTeam}/intercepted`] =
    intercepted;

  if (intercepted) {
    const ourSnap = await get(ref(db, `rooms/${roomId}/teams/${ourTeam}`));
    const ours = ourSnap.val() as TeamState;
    updates[`rooms/${roomId}/teams/${ourTeam}/interceptionTokens`] =
      (ours.interceptionTokens || 0) + 1;
  }

  await update(ref(db), updates);
  await checkGameEnd(roomId);
}

// ====== 라운드 완료 체크 + 다음 라운드 ======
export async function tryAdvanceToNextRound(roomId: string, roundNumber: number) {
  const roundSnap = await get(ref(db, `rooms/${roomId}/rounds/${roundNumber}`));
  if (!roundSnap.exists()) return;
  const round = roundSnap.val() as Round;

  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  const room = roomSnap.val() as Room;
  const isDuel = room.gameMode === "duel";

  // 1라운드는 가로채기 없음
  const interceptDone =
    roundNumber === 1 ||
    (round.white?.interceptGuessAt != null && round.black?.interceptGuessAt != null);

  const ownDone =
    isDuel ||
    (round.white?.ownGuessAt != null && round.black?.ownGuessAt != null);

  if (ownDone && interceptDone && round.status !== "completed") {
    await update(ref(db, `rooms/${roomId}/rounds/${roundNumber}`), {
      status: "completed",
      stage: "settled",
    });

    // 게임 종료 체크는 이미 제출 시점에 됐음
    const roomNow = (await get(ref(db, `rooms/${roomId}`))).val() as Room;
    if (roomNow.phase === "ended") return;

    if (roundNumber >= 8) {
      await endGameByTokens(roomId);
    } else {
      await startRound(roomId, roundNumber + 1);
    }
  }
}

// ====== 승부 체크 ======
async function checkGameEnd(roomId: string) {
  const whiteSnap = await get(ref(db, `rooms/${roomId}/teams/white`));
  const blackSnap = await get(ref(db, `rooms/${roomId}/teams/black`));
  const white = whiteSnap.val() as TeamState;
  const black = blackSnap.val() as TeamState;

  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  const room = roomSnap.val() as Room;
  const isDuel = room.gameMode === "duel";

  let winner: TeamId | "draw" | null = null;

  if ((white.interceptionTokens || 0) >= 2) winner = "white";
  else if ((black.interceptionTokens || 0) >= 2) winner = "black";

  if (!isDuel) {
    if ((white.miscommunicationTokens || 0) >= 2) winner = "black";
    if ((black.miscommunicationTokens || 0) >= 2) winner = "white";
  }

  if (winner) {
    await update(ref(db, `rooms/${roomId}`), {
      phase: "ended",
      winner,
    });
  }
}

async function endGameByTokens(roomId: string) {
  const whiteSnap = await get(ref(db, `rooms/${roomId}/teams/white`));
  const blackSnap = await get(ref(db, `rooms/${roomId}/teams/black`));
  const white = whiteSnap.val() as TeamState;
  const black = blackSnap.val() as TeamState;

  let winner: TeamId | "draw" = "draw";
  if ((white.interceptionTokens || 0) > (black.interceptionTokens || 0))
    winner = "white";
  else if ((black.interceptionTokens || 0) > (white.interceptionTokens || 0))
    winner = "black";

  await update(ref(db, `rooms/${roomId}`), {
    phase: "ended",
    winner,
  });
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// ====== 모든 라운드 가져오기 (복기용) ======
export async function getAllRounds(roomId: string): Promise<Round[]> {
  const snap = await get(ref(db, `rooms/${roomId}/rounds`));
  const rounds: Round[] = [];
  snap.forEach((child) => {
    const v = child.val();
    if (v) {
      rounds.push({
        roundNumber: v.roundNumber,
        white: hydrateRoundTeamData(v.white),
        black: hydrateRoundTeamData(v.black),
        status: v.status,
        stage: v.stage,
        encryptingTimerStartAt: v.encryptingTimerStartAt ?? null,
      });
    }
    return false;
  });
  rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  return rounds;
}

// ====== 결과 화면 acknowledge ======
export async function ackOwnResult(roomId: string, teamId: TeamId) {
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), {
    ownResultAcked: true,
  });
}

export async function ackIntercept(roomId: string, teamId: TeamId) {
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), {
    interceptAcked: true,
  });
}

// ====== 라운드 정산 후 ack 초기화 ======
export async function resetAcks(roomId: string) {
  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}/teams/white/ownResultAcked`] = false;
  updates[`rooms/${roomId}/teams/white/interceptAcked`] = false;
  updates[`rooms/${roomId}/teams/black/ownResultAcked`] = false;
  updates[`rooms/${roomId}/teams/black/interceptAcked`] = false;
  await update(ref(db), updates);
}

// ====== 하트비트: onDisconnect 활용 + 가끔 갱신 ======
let heartbeatSetup: Record<string, boolean> = {};

export async function updateHeartbeat(roomId: string, uid: string) {
  try {
    // 처음 호출 시 onDisconnect 설정 (방을 나가면 자동으로 isOnline = false)
    const key = `${roomId}:${uid}`;
    if (!heartbeatSetup[key]) {
      heartbeatSetup[key] = true;
      const onlineRef = ref(db, `rooms/${roomId}/players/${uid}/isOnline`);
      onDisconnect(onlineRef).set(false);
    }
    await update(ref(db, `rooms/${roomId}/players/${uid}`), {
      lastSeenAt: Date.now(),
      isOnline: true,
    });
  } catch (e) {
    // 무시
  }
}
