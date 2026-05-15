import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  runTransaction,
  Unsubscribe,
  orderBy,
} from "firebase/firestore";
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
  // 고유 코드 만들기 (최대 5회 시도)
  let code = "";
  for (let i = 0; i < 5; i++) {
    code = generateRoomCode();
    const q = query(collection(db, "rooms"), where("code", "==", code), where("phase", "in", ["waiting", "team_setup", "rules", "keyword_reveal", "round_in_progress"]));
    const snap = await getDocs(q);
    if (snap.empty) break;
  }

  const roomRef = doc(collection(db, "rooms"));
  const now = Date.now();

  const room: Room = {
    id: roomRef.id,
    code,
    createdAt: now,
    hostUid,
    connectMode,
    gameMode,
    phase: "waiting",
    roundNumber: 0,
    winner: null,
  };

  await setDoc(roomRef, room);

  // 호스트 추가
  await setDoc(doc(db, "rooms", roomRef.id, "players", hostUid), {
    uid: hostUid,
    nickname: hostNickname,
    team: null,
    isHost: true,
    isOnline: true,
    joinedAt: now,
    lastSeenAt: now,
  } as Player);

  return { roomId: roomRef.id, code };
}

// ====== 방 참가 ======
export async function joinRoom(
  code: string,
  uid: string,
  nickname: string
): Promise<string> {
  const q = query(collection(db, "rooms"), where("code", "==", code));
  const snap = await getDocs(q);
  if (snap.empty) throw new Error("방을 찾을 수 없어요");

  // 진행 중인 방 우선
  const activeDoc =
    snap.docs.find((d) => d.data().phase !== "ended") || snap.docs[0];
  const room = activeDoc.data() as Room;

  if (room.phase === "ended") throw new Error("이미 종료된 방이에요");

  const roomId = activeDoc.id;
  const now = Date.now();

  await setDoc(doc(db, "rooms", roomId, "players", uid), {
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

// ====== 방 참가 (roomId로 직접 - 링크 접속용) ======
export async function joinRoomById(
  roomId: string,
  uid: string,
  nickname: string
): Promise<void> {
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = roomSnap.data() as Room;
  if (room.phase === "ended") throw new Error("이미 종료된 방이에요");
  if (room.phase !== "waiting") throw new Error("이미 시작된 게임이에요");

  const now = Date.now();
  await setDoc(doc(db, "rooms", roomId, "players", uid), {
    uid,
    nickname,
    team: null,
    isHost: false,
    isOnline: true,
    joinedAt: now,
    lastSeenAt: now,
  } as Player);
}
export function subscribeRoom(
  roomId: string,
  cb: (room: Room | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "rooms", roomId), (snap) => {
    cb(snap.exists() ? (snap.data() as Room) : null);
  });
}

// ====== 구독: 플레이어 목록 ======
export function subscribePlayers(
  roomId: string,
  cb: (players: Player[]) => void
): Unsubscribe {
  return onSnapshot(collection(db, "rooms", roomId, "players"), (snap) => {
    const players = snap.docs
      .map((d) => d.data() as Player)
      .sort((a, b) => a.joinedAt - b.joinedAt);
    cb(players);
  });
}

// ====== 구독: 팀 상태 ======
export function subscribeTeam(
  roomId: string,
  teamId: TeamId,
  cb: (team: TeamState | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "rooms", roomId, "teams", teamId), (snap) => {
    cb(snap.exists() ? (snap.data() as TeamState) : null);
  });
}

// ====== 구독: 라운드 ======
export function subscribeRound(
  roomId: string,
  roundNumber: number,
  cb: (round: Round | null) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, "rooms", roomId, "rounds", String(roundNumber)),
    (snap) => {
      cb(snap.exists() ? (snap.data() as Round) : null);
    }
  );
}

// ====== 구독: 채팅 ======
export function subscribeChat(
  roomId: string,
  cb: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "rooms", roomId, "chats"),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ChatMessage)));
  });
}

// ====== 채팅 전송 ======
export async function sendChat(
  roomId: string,
  msg: Omit<ChatMessage, "id" | "createdAt">
) {
  await addDoc(collection(db, "rooms", roomId, "chats"), {
    ...msg,
    createdAt: Date.now(),
  });
}

// ====== 팀 랜덤 배정 + 키워드 발급 ======
export async function assignTeamsAndStart(roomId: string) {
  const playersSnap = await getDocs(
    collection(db, "rooms", roomId, "players")
  );
  const playerUids = playersSnap.docs.map((d) => d.id);

  const { white, black } = distributeTeams(playerUids);

  // 키워드 8개 뽑아서 4개씩 분배
  const allKeywords = pickRandomKeywords(KEYWORDS_POOL, 8);
  const whiteKeywords = allKeywords.slice(0, 4);
  const blackKeywords = allKeywords.slice(4, 8);

  // 팀 상태 생성
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

  await setDoc(doc(db, "rooms", roomId, "teams", "white"), whiteTeam);
  await setDoc(doc(db, "rooms", roomId, "teams", "black"), blackTeam);

  // 각 플레이어의 team 필드 업데이트
  for (const uid of white) {
    await updateDoc(doc(db, "rooms", roomId, "players", uid), { team: "white" });
  }
  for (const uid of black) {
    await updateDoc(doc(db, "rooms", roomId, "players", uid), { team: "black" });
  }

  // 방 phase 전환
  await updateDoc(doc(db, "rooms", roomId), { phase: "team_setup" });
}

// ====== 팀 이름 수정 ======
export async function updateTeamName(
  roomId: string,
  teamId: TeamId,
  name: string
) {
  const finalName = name.trim() || (teamId === "white" ? "화이트팀" : "블랙팀");
  await updateDoc(doc(db, "rooms", roomId, "teams", teamId), {
    name: finalName,
  });
}

// ====== 키워드 셔플 ======
export async function shuffleTeamKeywords(roomId: string, teamId: TeamId) {
  await runTransaction(db, async (tx) => {
    const teamRef = doc(db, "rooms", roomId, "teams", teamId);
    const otherRef = doc(
      db,
      "rooms",
      roomId,
      "teams",
      teamId === "white" ? "black" : "white"
    );
    const teamSnap = await tx.get(teamRef);
    const otherSnap = await tx.get(otherRef);
    if (!teamSnap.exists()) throw new Error("팀이 없어요");

    const team = teamSnap.data() as TeamState;
    const other = otherSnap.exists() ? (otherSnap.data() as TeamState) : null;
    if (team.shuffleUsedCount >= 2) throw new Error("셔플 횟수 초과");

    const exclude = [
      ...team.keywords,
      ...(other ? other.keywords : []),
    ];
    const newKeywords = pickRandomKeywords(KEYWORDS_POOL, 4, exclude);

    tx.update(teamRef, {
      keywords: newKeywords,
      shuffleUsedCount: team.shuffleUsedCount + 1,
    });
  });
}

// ====== 게임 시작 (rules → keyword_reveal → round 1) ======
export async function goToRulesScreen(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), { phase: "rules" });
}

export async function goToKeywordReveal(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId), { phase: "keyword_reveal" });
}

// 키워드 공개 화면에서 "준비 완료"
// 내 팀을 준비 완료로 표시만 한다.
// 양 팀 모두 준비되면 KeywordReveal 컴포넌트(호스트)가 startRound를 호출한다.
export async function markTeamReady(roomId: string, teamId: TeamId) {
  await updateDoc(doc(db, "rooms", roomId, "teams", teamId), {
    keywordReady: true,
  });
}

// ====== 라운드 시작 ======
export async function startRound(roomId: string, roundNumber: number) {
  const whiteSnap = await getDoc(doc(db, "rooms", roomId, "teams", "white"));
  const blackSnap = await getDoc(doc(db, "rooms", roomId, "teams", "black"));

  if (!whiteSnap.exists() || !blackSnap.exists()) throw new Error("팀 없음");
  const white = whiteSnap.data() as TeamState;
  const black = blackSnap.data() as TeamState;

  // 듀얼 모드일 때 처리
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  const room = roomSnap.data() as Room;

  // 중복 실행 방지: 이미 해당 라운드가 진행 중이면 무시
  if (room.phase === "round_in_progress" && room.roundNumber >= roundNumber) {
    return;
  }

  // 암호전달자 순환
  const whiteEncryptorIdx = (roundNumber - 1) % Math.max(white.playerOrder.length, 1);
  const blackEncryptorIdx = (roundNumber - 1) % Math.max(black.playerOrder.length, 1);

  const round: Round = {
    roundNumber,
    white: emptyRoundTeamData(
      white.playerOrder[whiteEncryptorIdx] || "",
      generateGameCode()
    ),
    black: emptyRoundTeamData(
      black.playerOrder[blackEncryptorIdx] || "",
      generateGameCode()
    ),
    status: "in_progress",
    stage: "announce",
    encryptingTimerStartAt: null,
  };

  await setDoc(
    doc(db, "rooms", roomId, "rounds", String(roundNumber)),
    round
  );

  // 양 팀의 라운드별 ack 플래그 초기화
  await updateDoc(doc(db, "rooms", roomId, "teams", "white"), {
    ownResultAcked: false,
    interceptAcked: false,
  });
  await updateDoc(doc(db, "rooms", roomId, "teams", "black"), {
    ownResultAcked: false,
    interceptAcked: false,
  });

  await updateDoc(doc(db, "rooms", roomId), {
    phase: "round_in_progress",
    roundNumber,
  });
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
export async function advanceStage(roomId: string, roundNumber: number, nextStage: RoundStage) {
  await updateDoc(
    doc(db, "rooms", roomId, "rounds", String(roundNumber)),
    { stage: nextStage }
  );
}

// ====== 단서 제출 ======
export async function submitClues(
  roomId: string,
  roundNumber: number,
  teamId: TeamId,
  clues: string[]
) {
  // 단서 재사용 체크
  const usedQ = query(
    collection(db, "rooms", roomId, "usedClues"),
    where("team", "==", teamId)
  );
  const usedSnap = await getDocs(usedQ);
  const used = new Set<string>();
  usedSnap.docs.forEach((d) => used.add(normalizeClue(d.data().original)));

  for (const c of clues) {
    if (used.has(normalizeClue(c))) {
      throw new Error(`"${c}" 는 이미 사용한 단서예요`);
    }
  }

  const now = Date.now();
  const roundRef = doc(db, "rooms", roomId, "rounds", String(roundNumber));
  const update: any = {};
  update[`${teamId}.clues`] = clues;
  update[`${teamId}.cluesSubmittedAt`] = now;
  await updateDoc(roundRef, update);

  // 사용한 단서 기록
  for (const c of clues) {
    await addDoc(collection(db, "rooms", roomId, "usedClues"), {
      original: c,
      normalized: normalizeClue(c),
      team: teamId,
      roundNumber,
    });
  }

  // 양 팀 다 제출했는지 확인
  const roundSnap = await getDoc(roundRef);
  const round = roundSnap.data() as Round;
  if (round.white.cluesSubmittedAt && round.black.cluesSubmittedAt) {
    // 양 팀 다 단서 작성 끝
    const roomSnap = await getDoc(doc(db, "rooms", roomId));
    const room = roomSnap.data() as Room;
    if (room.gameMode === "duel") {
      // 듀얼 모드: 자기 팀 추측 없음 → 바로 가로채기 단계로
      await updateDoc(roundRef, { stage: "intercept" });
    } else {
      // 표준 모드: 자기 팀 추측 단계로
      await updateDoc(roundRef, { stage: "guessing" });
    }
  } else {
    // 먼저 제출한 쪽 → 상대팀에게 타이머 시작
    if (round.encryptingTimerStartAt === null) {
      await updateDoc(roundRef, { encryptingTimerStartAt: now });
    }
  }
}

// ====== 자기 팀 추측 제출 ======
export async function submitOwnGuess(
  roomId: string,
  roundNumber: number,
  teamId: TeamId,
  guess: number[]
) {
  const roundRef = doc(db, "rooms", roomId, "rounds", String(roundNumber));
  const roundSnap = await getDoc(roundRef);
  const round = roundSnap.data() as Round;
  const teamData = round[teamId];

  const correct = arraysEqual(teamData.code, guess);

  const update: any = {};
  update[`${teamId}.ownGuess`] = guess;
  update[`${teamId}.ownGuessAt`] = Date.now();
  update[`${teamId}.ownCorrect`] = correct;

  await updateDoc(roundRef, update);

  // 코드 누적 단서에 추가 (이번 라운드 단서를 각 코드 번호에 매핑)
  const teamRef = doc(db, "rooms", roomId, "teams", teamId);
  const teamSnap = await getDoc(teamRef);
  const team = teamSnap.data() as TeamState;
  const newAcc = { ...team.clueAccumulation };
  for (let i = 0; i < 3; i++) {
    const codeNum = String(teamData.code[i]);
    newAcc[codeNum] = [...(newAcc[codeNum] || []), teamData.clues[i]];
  }
  await updateDoc(teamRef, { clueAccumulation: newAcc });

  // 통신실패 토큰
  if (!correct) {
    await updateDoc(teamRef, {
      miscommunicationTokens: team.miscommunicationTokens + 1,
    });
  }

  // 승부 체크
  await checkGameEnd(roomId);
}

// ====== 가로채기 제출 ======
export async function submitInterceptGuess(
  roomId: string,
  roundNumber: number,
  ourTeam: TeamId, // 우리 팀
  guess: number[]
) {
  const opponentTeam: TeamId = ourTeam === "white" ? "black" : "white";
  const roundRef = doc(db, "rooms", roomId, "rounds", String(roundNumber));
  const roundSnap = await getDoc(roundRef);
  const round = roundSnap.data() as Round;
  const opponentData = round[opponentTeam];

  const intercepted = arraysEqual(opponentData.code, guess);

  // 가로채기는 상대 라운드 데이터의 interceptGuess 필드에 기록
  const update: any = {};
  update[`${opponentTeam}.interceptGuess`] = guess;
  update[`${opponentTeam}.interceptGuessAt`] = Date.now();
  update[`${opponentTeam}.intercepted`] = intercepted;

  await updateDoc(roundRef, update);

  if (intercepted) {
    const ourRef = doc(db, "rooms", roomId, "teams", ourTeam);
    const ourSnap = await getDoc(ourRef);
    const ours = ourSnap.data() as TeamState;
    await updateDoc(ourRef, {
      interceptionTokens: ours.interceptionTokens + 1,
    });
  }

  await checkGameEnd(roomId);
}

// ====== 라운드 완료 체크 + 다음 라운드 ======
export async function tryAdvanceToNextRound(roomId: string, roundNumber: number) {
  const roundRef = doc(db, "rooms", roomId, "rounds", String(roundNumber));
  const roundSnap = await getDoc(roundRef);
  const round = roundSnap.data() as Round;

  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  const room = roomSnap.data() as Room;

  const isDuel = room.gameMode === "duel";

  // 1라운드는 가로채기 없음
  const interceptDone =
    roundNumber === 1 ||
    (round.white.interceptGuessAt !== null && round.black.interceptGuessAt !== null);

  const ownDone =
    isDuel ||
    (round.white.ownGuessAt !== null && round.black.ownGuessAt !== null);

  if (ownDone && interceptDone && round.status !== "completed") {
    await updateDoc(roundRef, { status: "completed", stage: "settled" });

    // 게임 종료 체크는 이미 되었음 (제출 시점에)
    const roomNow = (await getDoc(doc(db, "rooms", roomId))).data() as Room;
    if (roomNow.phase === "ended") return;

    // 다음 라운드 또는 종료
    if (roundNumber >= 8) {
      // 8라운드 종료
      await endGameByTokens(roomId);
    } else {
      await startRound(roomId, roundNumber + 1);
    }
  }
}

// ====== 승부 체크 ======
async function checkGameEnd(roomId: string) {
  const whiteSnap = await getDoc(doc(db, "rooms", roomId, "teams", "white"));
  const blackSnap = await getDoc(doc(db, "rooms", roomId, "teams", "black"));
  const white = whiteSnap.data() as TeamState;
  const black = blackSnap.data() as TeamState;

  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  const room = roomSnap.data() as Room;
  const isDuel = room.gameMode === "duel";

  let winner: TeamId | "draw" | null = null;

  // 가로채기 2개 먼저 → 승리
  if (white.interceptionTokens >= 2) winner = "white";
  else if (black.interceptionTokens >= 2) winner = "black";

  // 통신실패 2개 → 패배 (듀얼 모드 제외)
  if (!isDuel) {
    if (white.miscommunicationTokens >= 2) winner = "black";
    if (black.miscommunicationTokens >= 2) winner = "white";
  }

  if (winner) {
    await updateDoc(doc(db, "rooms", roomId), {
      phase: "ended",
      winner,
    });
  }
}

async function endGameByTokens(roomId: string) {
  const whiteSnap = await getDoc(doc(db, "rooms", roomId, "teams", "white"));
  const blackSnap = await getDoc(doc(db, "rooms", roomId, "teams", "black"));
  const white = whiteSnap.data() as TeamState;
  const black = blackSnap.data() as TeamState;

  let winner: TeamId | "draw" = "draw";
  if (white.interceptionTokens > black.interceptionTokens) winner = "white";
  else if (black.interceptionTokens > white.interceptionTokens) winner = "black";

  await updateDoc(doc(db, "rooms", roomId), {
    phase: "ended",
    winner,
  });
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// ====== 모든 라운드 가져오기 (복기용) ======
export async function getAllRounds(roomId: string): Promise<Round[]> {
  const snap = await getDocs(collection(db, "rooms", roomId, "rounds"));
  return snap.docs
    .map((d) => d.data() as Round)
    .sort((a, b) => a.roundNumber - b.roundNumber);
}

// ====== 결과 화면 acknowledge ======
export async function ackOwnResult(roomId: string, teamId: TeamId) {
  await updateDoc(doc(db, "rooms", roomId, "teams", teamId), {
    ownResultAcked: true,
  });
}

export async function ackIntercept(roomId: string, teamId: TeamId) {
  await updateDoc(doc(db, "rooms", roomId, "teams", teamId), {
    interceptAcked: true,
  });
}

// ====== 라운드 정산 후 ack 초기화 ======
export async function resetAcks(roomId: string) {
  await updateDoc(doc(db, "rooms", roomId, "teams", "white"), {
    ownResultAcked: false,
    interceptAcked: false,
  });
  await updateDoc(doc(db, "rooms", roomId, "teams", "black"), {
    ownResultAcked: false,
    interceptAcked: false,
  });
}

// ====== 하트비트: 접속 상태 갱신 ======
export async function updateHeartbeat(roomId: string, uid: string) {
  try {
    await updateDoc(doc(db, "rooms", roomId, "players", uid), {
      lastSeenAt: Date.now(),
      isOnline: true,
    });
  } catch (e) {
    // 무시
  }
}
