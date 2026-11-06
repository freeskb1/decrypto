import {
  ref,
  get,
  set,
  update,
  push,
  onValue,
  off,
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
  TeamId,
  RoundStage,
  RoundTeamData,
  GuessDraft,
  TiebreakState,
} from "@/types/game";
import {
  normalizeClue,
  validateClues,
  otherTeamOf,
  defaultTeamName,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MAX_ROUNDS,
} from "@/types/game";
import {
  generateRoomCode,
  generateGameCode,
  pickRandomKeywords,
  distributeTeams,
  formatScore,
} from "./utils";
import keywordsData from "./keywords.json";

const KEYWORDS_POOL: string[] = Array.from(new Set<string>(keywordsData.keywords));

// ========================================================================
// 데이터 구조 (RTDB는 트리)
// ========================================================================
// /rooms/{roomId}                          ← Room 데이터 (+ usedKeywords, tiebreak, endReason)
// /rooms/{roomId}/players/{uid}            ← Player
// /rooms/{roomId}/teams/white|black        ← TeamState
// /rooms/{roomId}/rounds/{n}               ← Round (+ acks, drafts)
// /roomCodes/{code}                        ← { roomId }  (코드로 방 빠르게 찾기)
//
// 게임 진행에 관한 쓰기는 거의 모두 방 전체에 대한 트랜잭션(roomTx)으로 한다.
// → 두 사람이 동시에 눌러도 한 번만 반영되고(멱등), 방장 폰이 잠들어도
//   아무 플레이어의 폰이나 다음 단계로 넘길 수 있다.
// ========================================================================

// ====== 서버 시간 (폰마다 시계가 달라도 타이머가 맞도록) ======
let serverOffset = 0;
let offsetListening = false;
export function serverNow(): number {
  if (!offsetListening && typeof window !== "undefined" && db) {
    offsetListening = true;
    onValue(ref(db, ".info/serverTimeOffset"), (s) => {
      serverOffset = Number(s.val()) || 0;
    });
  }
  return Date.now() + serverOffset;
}

// 접속 중으로 볼지 (하트비트 15초 간격 → 50초 넘게 소식 없으면 자리 비움)
export function isPresent(p: Player, now: number): boolean {
  if (p.isOnline === false) return false;
  if (!p.lastSeenAt) return true;
  return now - p.lastSeenAt < 50000;
}

// ====== 작은 도우미 ======
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  if (v && typeof v === "object") {
    return Object.values(v as Record<string, unknown>).filter(
      (x): x is string => typeof x === "string"
    );
  }
  return [];
}

function toNumberArray(v: unknown): number[] {
  if (Array.isArray(v)) return v.map((x) => Number(x) || 0);
  if (v && typeof v === "object") {
    return Object.keys(v as Record<string, unknown>)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => Number((v as Record<string, unknown>)[k]) || 0);
  }
  return [];
}

function num(v: unknown): number {
  return Number(v) || 0;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

// 키워드 뽑기: 이 그룹이 이미 본 키워드(used)와 지금 게임 키워드(alsoExclude)를 빼고.
// 남은 게 모자라면 used를 비우고 다시 시작
function pickFresh(
  n: number,
  used: string[],
  alsoExclude: string[]
): { picked: string[]; used: string[] } {
  const ex = new Set([...used, ...alsoExclude]);
  let usedNow = used;
  if (KEYWORDS_POOL.filter((k) => !ex.has(k)).length < n) {
    usedNow = [];
  }
  const picked = pickRandomKeywords(KEYWORDS_POOL, n, [...usedNow, ...alsoExclude]);
  return { picked, used: [...usedNow, ...picked] };
}

// 방 전체 트랜잭션. mut가 true를 돌려주면 쓰고, false면 아무것도 안 함
// (로컬 캐시가 비어 있으면 current=null로 먼저 불리는데, 그대로 돌려주면 서버 값으로 다시 불린다)
async function roomTx(roomId: string, mut: (room: any) => boolean): Promise<boolean> {
  const res = await runTransaction(ref(db, `rooms/${roomId}`), (current: any) => {
    if (!current) return current;
    return mut(current) ? current : undefined;
  });
  return res.committed;
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

function makePlayer(uid: string, nickname: string, isHost: boolean, hubUid?: string): Player {
  const now = Date.now();
  const p: Player = {
    uid,
    nickname,
    team: null,
    isHost,
    isOnline: true,
    joinedAt: now,
    lastSeenAt: now,
  };
  // RTDB는 undefined 값을 쓰면 에러 → 있을 때만 넣기
  if (hubUid) p.hubUid = hubUid;
  return p;
}

// ====== 방 생성 ======
export async function createRoom(
  hostUid: string,
  hostNickname: string
): Promise<{ roomId: string; code: string }> {
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
  // room 객체 안에 players를 포함해서 한 번에 set
  const roomData: any = {
    id: roomId,
    code,
    createdAt: now,
    hostUid,
    connectMode: "offline", // 같은 방에서 각자 폰 (채팅 없음)
    gameMode: "standard",
    phase: "waiting",
    roundNumber: 0,
    winner: null,
    players: {
      [hostUid]: makePlayer(hostUid, hostNickname, true),
    },
  };

  const updates: Record<string, any> = {};
  updates[`rooms/${roomId}`] = roomData;
  updates[`roomCodes/${code}`] = { roomId };
  await update(ref(db), updates);

  return { roomId, code };
}

// 대기실 입장 공통 검사
function checkJoinable(room: any, uid: string) {
  const players = room.players || {};
  if (players[uid]) return; // 이미 있음 → 재입장 허용
  if (room.phase === "ended") throw new Error("이미 끝난 방이에요");
  if (room.phase !== "waiting") throw new Error("이미 시작된 게임이에요");
  if (Object.keys(players).length >= MAX_PLAYERS) {
    throw new Error(`방이 꽉 찼어요 (최대 ${MAX_PLAYERS}명)`);
  }
}

// ====== 방 참가 (코드로) ======
export async function joinRoom(code: string, uid: string, nickname: string): Promise<string> {
  const codeSnap = await get(ref(db, `roomCodes/${code}`));
  if (!codeSnap.exists()) throw new Error("방을 찾을 수 없어요");

  const roomId = codeSnap.val().roomId;
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = roomSnap.val();
  checkJoinable(room, uid);
  if (room.players && room.players[uid]) return roomId;

  await set(ref(db, `rooms/${roomId}/players/${uid}`), makePlayer(uid, nickname, false));
  return roomId;
}

// ====== 방 참가 (roomId로 - 링크 접속용) ======
export async function joinRoomById(roomId: string, uid: string, nickname: string): Promise<void> {
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없어요");
  const room = roomSnap.val();
  checkJoinable(room, uid);
  if (room.players && room.players[uid]) return;
  await set(ref(db, `rooms/${roomId}/players/${uid}`), makePlayer(uid, nickname, false));
}

// ====== 말랑월드 자동 입장 ======
// 방 키는 h{말랑월드 방 번호} (예: h4821). push id와 겹치지 않음.
// 방에 hubSid(= 말랑월드 판 id)를 두고, 판이 바뀌면 방장이 같은 키로 새 방을 만든다.
// 새 방을 만들 때 usedKeywords(이 그룹이 이미 본 키워드)는 이어받는다.

// 방장: 방이 없거나 예전 판(hubSid 다름)이면 새로 만들고, 이번 판이면 그대로 둔다 (멱등)
export async function ensureHubRoom(opts: {
  roomId: string;
  hubRoom: string;
  sid: string;
  uid: string;
  nickname: string;
  hubUid: string;
}): Promise<void> {
  const { roomId, hubRoom, sid, uid, nickname, hubUid } = opts;
  await runTransaction(ref(db, `rooms/${roomId}`), (current: any) => {
    if (current && current.hubSid === sid) {
      const players: Record<string, any> = { ...(current.players || {}) };
      if (players[uid]) return undefined; // 이미 들어와 있음 (새로고침 등) → 변경 없음
      // 같은 말랑월드 방장이 다른 브라우저(익명 uid가 바뀜)로 다시 들어온 경우만 방장 넘겨받기
      if (hubUid && current.hubHostUid === hubUid && current.phase === "waiting") {
        const oldHost: string | undefined = current.hostUid;
        if (oldHost && players[oldHost]) {
          players[oldHost] = { ...players[oldHost], isHost: false };
        }
        players[uid] = makePlayer(uid, nickname, true, hubUid);
        return { ...current, hostUid: uid, players };
      }
      return undefined; // 그 외에는 건드리지 않음
    }
    // 방이 없거나 예전 판 → 같은 키로 새 방 (예전 판의 라운드 등은 통째로 교체, 본 키워드만 이어받기)
    const carried = current ? toStringArray(current.usedKeywords) : [];
    const now = Date.now();
    return {
      id: roomId,
      code: hubRoom,
      createdAt: now,
      hostUid: uid,
      hubSid: sid,
      hubHostUid: hubUid || null,
      connectMode: "offline",
      gameMode: "standard",
      phase: "waiting",
      roundNumber: 0,
      winner: null,
      usedKeywords: carried.length ? carried : null,
      players: {
        [uid]: makePlayer(uid, nickname, true, hubUid),
      },
    };
  });
}

// 멤버: 이번 판 방에 멱등하게 입장. 이미 players에 있으면 다시 쓰지 않음 (게임 중이어도 재입장 가능)
export async function joinHubRoom(opts: {
  roomId: string;
  sid: string;
  uid: string;
  nickname: string;
  hubUid: string;
}): Promise<void> {
  const { roomId, sid, uid, nickname, hubUid } = opts;
  const meSnap = await get(ref(db, `rooms/${roomId}/players/${uid}`));
  if (meSnap.exists()) return;
  const roomSnap = await get(ref(db, `rooms/${roomId}`));
  if (!roomSnap.exists()) throw new Error("방장을 기다리는 중이에요");
  const room = roomSnap.val();
  if (room.hubSid !== sid) throw new Error("방장을 기다리는 중이에요");
  checkJoinable(room, uid);
  await set(ref(db, `rooms/${roomId}/players/${uid}`), makePlayer(uid, nickname, false, hubUid));
}

// ====== 구독: 방 정보 ======
function hydrateTiebreak(v: any): TiebreakState | null {
  if (!v) return null;
  const w = toStringArray(v.white);
  const b = toStringArray(v.black);
  return {
    prefix: v.prefix || "",
    white: w.length ? w : null,
    black: b.length ? b : null,
    whiteBy: v.whiteBy || "",
    blackBy: v.blackBy || "",
  };
}

export function subscribeRoom(roomId: string, cb: (room: Room | null) => void): Unsubscribe {
  const r = ref(db, `rooms/${roomId}`);
  const handler = (snap: DataSnapshot) => {
    if (snap.exists()) {
      const val = snap.val();
      cb({
        id: roomId,
        code: val.code,
        createdAt: val.createdAt,
        hostUid: val.hostUid,
        connectMode: val.connectMode || "offline",
        gameMode: val.gameMode || "standard",
        phase: val.phase,
        roundNumber: val.roundNumber || 0,
        winner: val.winner ?? null,
        endReason: val.endReason ?? null,
        tiebreak: hydrateTiebreak(val.tiebreak),
        hubSid: val.hubSid ?? undefined,
        hubHostUid: val.hubHostUid ?? undefined,
      } as Room);
    } else {
      cb(null);
    }
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ====== 구독: 플레이어 목록 ======
export function subscribePlayers(roomId: string, cb: (players: Player[]) => void): Unsubscribe {
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
function hydrateAccumulation(v: any): Record<string, string[]> {
  const out: Record<string, string[]> = { "1": [], "2": [], "3": [], "4": [] };
  if (!v) return out;
  for (const k of ["1", "2", "3", "4"]) {
    out[k] = toStringArray(v[k]);
  }
  return out;
}

function hydrateTeam(v: any, teamId: TeamId): TeamState {
  return {
    name: v.name || defaultTeamName(teamId),
    keywords: toStringArray(v.keywords),
    shuffleUsedCount: num(v.shuffleUsedCount),
    interceptionTokens: num(v.interceptionTokens),
    miscommunicationTokens: num(v.miscommunicationTokens),
    playerOrder: toStringArray(v.playerOrder),
    currentEncryptorIdx: num(v.currentEncryptorIdx),
    clueAccumulation: hydrateAccumulation(v.clueAccumulation),
    keywordReady: v.keywordReady === true,
  };
}

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
    cb(hydrateTeam(snap.val(), teamId));
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

// ====== 구독: 라운드 ======
function hydrateRoundTeamData(v: any): RoundTeamData {
  return {
    encryptorUid: v?.encryptorUid || "",
    code: toNumberArray(v?.code),
    clues: toStringArray(v?.clues),
    cluesSubmittedAt: v?.cluesSubmittedAt ?? null,
    ownGuess: v?.ownGuess ? toNumberArray(v.ownGuess) : null,
    ownGuessAt: v?.ownGuessAt ?? null,
    ownCorrect: v?.ownCorrect ?? null,
    interceptGuess: v?.interceptGuess ? toNumberArray(v.interceptGuess) : null,
    interceptGuessAt: v?.interceptGuessAt ?? null,
    intercepted: v?.intercepted ?? null,
  };
}

function hydrateDrafts(v: any): Record<string, GuessDraft> {
  const out: Record<string, GuessDraft> = {};
  if (!v || typeof v !== "object") return out;
  for (const k of Object.keys(v)) {
    const d = v[k];
    if (!d) continue;
    const picks = toNumberArray(d.picks);
    out[k] = {
      picks: [picks[0] || 0, picks[1] || 0, picks[2] || 0],
      editorUid: d.editorUid || "",
      editorName: d.editorName || "",
      at: num(d.at),
    };
  }
  return out;
}

function hydrateAcks(v: any): Record<string, Record<string, boolean>> {
  const out: Record<string, Record<string, boolean>> = { white: {}, black: {}, all: {} };
  if (!v || typeof v !== "object") return out;
  for (const t of ["white", "black", "all"]) {
    const m = v[t];
    if (m && typeof m === "object") {
      for (const uid of Object.keys(m)) {
        if (m[uid]) out[t][uid] = true;
      }
    }
  }
  return out;
}

function hydrateRound(v: any): Round {
  return {
    roundNumber: num(v.roundNumber),
    white: hydrateRoundTeamData(v.white),
    black: hydrateRoundTeamData(v.black),
    status: v.status === "completed" ? "completed" : "in_progress",
    stage: (v.stage || "encrypting") as RoundStage,
    encryptingTimerStartAt: v.encryptingTimerStartAt ?? null,
    acks: hydrateAcks(v.acks),
    drafts: hydrateDrafts(v.drafts),
  };
}

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
    cb(hydrateRound(snap.val()));
  };
  onValue(r, handler);
  return () => off(r, "value", handler);
}

function snapToRounds(snap: DataSnapshot): Round[] {
  const rounds: Round[] = [];
  snap.forEach((child) => {
    const v = child.val();
    if (v) rounds.push(hydrateRound(v));
    return false;
  });
  rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  return rounds;
}

export function subscribeAllRounds(roomId: string, cb: (rounds: Round[]) => void): Unsubscribe {
  const r = ref(db, `rooms/${roomId}/rounds`);
  const handler = (snap: DataSnapshot) => cb(snapToRounds(snap));
  onValue(r, handler);
  return () => off(r, "value", handler);
}

export async function getAllRounds(roomId: string): Promise<Round[]> {
  const snap = await get(ref(db, `rooms/${roomId}/rounds`));
  return snapToRounds(snap);
}

// ====== 팀/라운드 데이터 만들기 ======
function makeTeam(teamId: TeamId, name: string, keywords: string[], order: string[]) {
  return {
    name,
    keywords,
    shuffleUsedCount: 0,
    interceptionTokens: 0,
    miscommunicationTokens: 0,
    playerOrder: order,
    currentEncryptorIdx: 0,
    clueAccumulation: null,
    keywordReady: false,
  };
}

function emptyRoundTeamData(encryptorUid: string, code: number[]) {
  return {
    encryptorUid,
    code,
    clues: null,
    cluesSubmittedAt: null,
    ownGuess: null,
    ownGuessAt: null,
    ownCorrect: null,
    interceptGuess: null,
    interceptGuessAt: null,
    intercepted: null,
  };
}

function newRoundData(room: any, n: number) {
  const wOrder = toStringArray(room.teams?.white?.playerOrder);
  const bOrder = toStringArray(room.teams?.black?.playerOrder);
  const wEnc = wOrder.length ? wOrder[(n - 1) % wOrder.length] : "";
  const bEnc = bOrder.length ? bOrder[(n - 1) % bOrder.length] : "";
  return {
    roundNumber: n,
    white: emptyRoundTeamData(wEnc, generateGameCode()),
    black: emptyRoundTeamData(bEnc, generateGameCode()),
    status: "in_progress",
    stage: "encrypting",
    encryptingTimerStartAt: null,
  };
}

// 이 팀이 지난 라운드들에서 쓴 단서 (현재 라운드 제외)
function previousCluesOf(room: any, teamId: TeamId, beforeRound: number): string[] {
  const out: string[] = [];
  const rounds = room.rounds || {};
  for (const k of Object.keys(rounds)) {
    const r = rounds[k];
    if (!r || num(r.roundNumber) >= beforeRound) continue;
    out.push(...toStringArray(r[teamId]?.clues));
  }
  return out;
}

// ====== 팀 랜덤 배정 + 키워드 발급 ======
export async function assignTeamsAndStart(roomId: string) {
  let error = "";
  await roomTx(roomId, (room) => {
    error = "";
    if (room.phase !== "waiting") return false;
    const uids = Object.keys(room.players || {});
    if (uids.length < MIN_PLAYERS) {
      error = `최소 ${MIN_PLAYERS}명이 필요해요`;
      return false;
    }
    if (uids.length > MAX_PLAYERS) {
      error = `최대 ${MAX_PLAYERS}명까지 할 수 있어요`;
      return false;
    }
    const { white, black } = distributeTeams(uids);
    const { picked, used } = pickFresh(8, toStringArray(room.usedKeywords), []);
    room.teams = {
      white: makeTeam("white", defaultTeamName("white"), picked.slice(0, 4), white),
      black: makeTeam("black", defaultTeamName("black"), picked.slice(4, 8), black),
    };
    room.usedKeywords = used;
    for (const uid of white) room.players[uid].team = "white";
    for (const uid of black) room.players[uid].team = "black";
    room.rounds = null;
    room.tiebreak = null;
    room.winner = null;
    room.endReason = null;
    room.roundNumber = 0;
    room.phase = "team_setup";
    return true;
  });
  if (error) throw new Error(error);
}

// ====== 팀 이름 수정 ======
export async function updateTeamName(roomId: string, teamId: TeamId, name: string) {
  const finalName = name.trim() || defaultTeamName(teamId);
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), { name: finalName });
}

// ====== 키워드 다시 뽑기 (팀당 2번) ======
export async function shuffleTeamKeywords(roomId: string, teamId: TeamId) {
  let error = "";
  await roomTx(roomId, (room) => {
    error = "";
    if (room.phase !== "keyword_reveal") return false;
    const team = room.teams?.[teamId];
    const other = room.teams?.[otherTeamOf(teamId)];
    if (!team) return false;
    if (team.keywordReady) {
      error = "준비 완료 뒤에는 바꿀 수 없어요";
      return false;
    }
    if (num(team.shuffleUsedCount) >= 2) {
      error = "이미 2번 모두 썼어요";
      return false;
    }
    const current = [...toStringArray(team.keywords), ...toStringArray(other?.keywords)];
    const { picked, used } = pickFresh(4, toStringArray(room.usedKeywords), current);
    team.keywords = picked;
    team.shuffleUsedCount = num(team.shuffleUsedCount) + 1;
    room.usedKeywords = used;
    return true;
  });
  if (error) throw new Error(error);
}

// ====== 게임 시작 단계 전환 (방장 버튼) ======
export async function goToRulesScreen(roomId: string) {
  await roomTx(roomId, (room) => {
    if (room.phase !== "team_setup") return false;
    room.phase = "rules";
    return true;
  });
}

export async function goToKeywordReveal(roomId: string) {
  await roomTx(roomId, (room) => {
    if (room.phase !== "rules") return false;
    room.phase = "keyword_reveal";
    return true;
  });
}

// 키워드 공개 화면에서 "준비 완료"
export async function markTeamReady(roomId: string, teamId: TeamId) {
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), { keywordReady: true });
  await startFirstRoundIfReady(roomId);
}

// 양 팀 모두 준비되면 1라운드 시작 (누가 불러도 한 번만)
export async function startFirstRoundIfReady(roomId: string) {
  await roomTx(roomId, (room) => {
    if (room.phase !== "keyword_reveal") return false;
    if (!room.teams?.white?.keywordReady || !room.teams?.black?.keywordReady) return false;
    room.rounds = { 1: newRoundData(room, 1) };
    room.roundNumber = 1;
    room.phase = "round_in_progress";
    return true;
  });
}

// ====== 단서 제출 (암호전달자) ======
export async function submitClues(
  roomId: string,
  roundNumber: number,
  teamId: TeamId,
  uid: string,
  clues: string[]
) {
  let error = "";
  const trimmed = clues.map((c) => c.trim());
  await roomTx(roomId, (room) => {
    error = "";
    if (room.phase !== "round_in_progress" || num(room.roundNumber) !== roundNumber) return false;
    const round = room.rounds?.[roundNumber];
    if (!round || round.stage !== "encrypting") return false;
    const mine = round[teamId];
    if (!mine) return false;
    if (mine.encryptorUid !== uid) {
      error = "이번 라운드 암호전달자만 낼 수 있어요";
      return false;
    }
    if (mine.cluesSubmittedAt) return false; // 이미 냄
    const keywords = toStringArray(room.teams?.[teamId]?.keywords);
    const bad = validateClues(trimmed, keywords, previousCluesOf(room, teamId, roundNumber));
    if (bad) {
      error = bad;
      return false;
    }
    const now = serverNow();
    mine.clues = trimmed;
    mine.cluesSubmittedAt = now;
    const other = round[otherTeamOf(teamId)];
    if (other && other.cluesSubmittedAt) {
      // 둘 다 냄 → 양 팀 동시에 우리 팀 해독
      round.stage = "decode";
    } else if (!round.encryptingTimerStartAt) {
      round.encryptingTimerStartAt = now; // 다른 암호전달자에게 30초
    }
    return true;
  });
  if (error) throw new Error(error);
}

// ====== 공유 초안 (팀이 같이 고르는 답) ======
export function draftKey(target: TeamId, kind: "intercept" | "decode"): string {
  return `${target}_${kind}`;
}

export async function setDraft(
  roomId: string,
  roundNumber: number,
  key: string,
  picks: number[],
  uid: string,
  name: string
) {
  await set(ref(db, `rooms/${roomId}/rounds/${roundNumber}/drafts/${key}`), {
    picks: [picks[0] || 0, picks[1] || 0, picks[2] || 0],
    editorUid: uid,
    editorName: name,
    at: Date.now(),
  });
}

// ====== 해독 / 가로채기 제출 (팀 답) ======
// 해독 단계: 두 팀이 동시에 자기 팀 암호를 맞힘. 가로채기 단계: 두 팀이 동시에 상대 팀 암호를 맞힘.
// 결과(성공·실패·토큰·기록지)는 두 팀 다 낸 뒤 "다 같이 공개" 때 한 번에 계산한다 (중간에 정답이 새지 않게)
// 같은 단계의 그 팀 답이 이미 있으면 아무것도 안 함 (두 사람이 동시에 눌러도 한 번만)
export async function submitTeamGuess(
  roomId: string,
  roundNumber: number,
  target: TeamId,
  kind: "intercept" | "decode",
  guess: number[],
  uid: string
): Promise<"ok" | "already"> {
  let error = "";
  if (
    guess.length !== 3 ||
    guess.some((g) => g < 1 || g > 4) ||
    new Set(guess).size !== 3
  ) {
    throw new Error("숫자 3개를 서로 다르게 골라주세요");
  }
  const committed = await roomTx(roomId, (room) => {
    error = "";
    if (room.phase !== "round_in_progress" || num(room.roundNumber) !== roundNumber) return false;
    const round = room.rounds?.[roundNumber];
    if (!round || round.stage !== kind) return false;
    const data = round[target];
    if (!data) return false;
    const myTeam: TeamId | null = room.players?.[uid]?.team ?? null;

    if (kind === "intercept") {
      if (myTeam !== otherTeamOf(target)) {
        error = "가로채기는 상대 팀만 할 수 있어요";
        return false;
      }
      if (data.interceptGuess) return false;
      data.interceptGuess = guess;
      data.interceptGuessAt = Date.now();
      if (round.white?.interceptGuess && round.black?.interceptGuess) {
        scoreRound(room, round);
        round.stage = "reveal";
      }
      return true;
    }

    // 해독
    if (myTeam !== target) {
      error = "해독은 그 팀만 할 수 있어요";
      return false;
    }
    if (data.encryptorUid === uid) {
      error = "암호전달자는 해독 답을 낼 수 없어요";
      return false;
    }
    if (data.ownGuess) return false;
    data.ownGuess = guess;
    data.ownGuessAt = Date.now();
    if (round.white?.ownGuess && round.black?.ownGuess) {
      if (roundNumber >= 2) {
        round.stage = "intercept";
      } else {
        scoreRound(room, round); // 1라운드는 가로채기 없음
        round.stage = "reveal";
      }
    }
    return true;
  });
  if (error) throw new Error(error);
  return committed ? "ok" : "already";
}

// 두 팀 답이 다 모이면: 성공·실패 판정, 토큰, 기록지(번호 칸)에 단서 쌓기
function scoreRound(room: any, round: any) {
  const roundNumber = num(round.roundNumber);
  for (const t of ["white", "black"] as TeamId[]) {
    const data = round[t];
    const team = room.teams[t];
    if (!data || !team) continue;
    const code = toNumberArray(data.code);
    const ok = arraysEqual(code, toNumberArray(data.ownGuess));
    data.ownCorrect = ok;
    if (!ok) team.miscommunicationTokens = num(team.miscommunicationTokens) + 1;
    if (roundNumber >= 2) {
      const got = !!data.interceptGuess && arraysEqual(code, toNumberArray(data.interceptGuess));
      data.intercepted = got;
      if (got) {
        const o = room.teams[otherTeamOf(t)];
        o.interceptionTokens = num(o.interceptionTokens) + 1;
      }
    }
    const acc = hydrateAccumulation(team.clueAccumulation);
    const clues = toStringArray(data.clues);
    for (let i = 0; i < 3; i++) {
      const k = String(code[i]);
      if (acc[k] && clues[i]) acc[k] = [...acc[k], clues[i]];
    }
    team.clueAccumulation = acc;
  }
}

// ====== 공개 화면 확인 ======
export async function ackReveal(roomId: string, roundNumber: number, uid: string) {
  await set(ref(db, `rooms/${roomId}/rounds/${roundNumber}/acks/all/${uid}`), true);
}

// ====== 다음 단계로 (누구 폰이든 조건을 보면 호출, 멱등) ======
// fromStage가 지금 단계와 같을 때만 넘긴다 → 여러 폰이 동시에 불러도 한 번만
export async function advanceFromStage(roomId: string, roundNumber: number, fromStage: RoundStage) {
  await roomTx(roomId, (room) => {
    if (room.phase !== "round_in_progress" || num(room.roundNumber) !== roundNumber) return false;
    const round = room.rounds?.[roundNumber];
    if (!round || round.stage !== fromStage) return false;

    if (fromStage === "encrypting") {
      if (!round.white?.cluesSubmittedAt || !round.black?.cluesSubmittedAt) return false;
      round.stage = "decode";
      return true;
    }
    if (fromStage === "reveal") {
      round.stage = "settled";
      round.status = "completed";
      judgeEndOfRound(room, roundNumber);
      return true;
    }
    return false;
  });
}

// ====== 라운드 끝 판정 (양 팀 모두 끝난 뒤에만) ======
function judgeEndOfRound(room: any, roundNumber: number) {
  const w = room.teams.white;
  const b = room.teams.black;
  const wName = w.name || defaultTeamName("white");
  const bName = b.name || defaultTeamName("black");
  const wI = num(w.interceptionTokens);
  const wM = num(w.miscommunicationTokens);
  const bI = num(b.interceptionTokens);
  const bM = num(b.miscommunicationTokens);

  const whiteWins = wI >= 2 || bM >= 2;
  const blackWins = bI >= 2 || wM >= 2;

  if (whiteWins && !blackWins) {
    const why: string[] = [];
    if (wI >= 2) why.push(`${wName} 가로채기 2번`);
    if (bM >= 2) why.push(`${bName} 해독 실패 2번`);
    endGame(room, "white", why.join(" · "));
    return;
  }
  if (blackWins && !whiteWins) {
    const why: string[] = [];
    if (bI >= 2) why.push(`${bName} 가로채기 2번`);
    if (wM >= 2) why.push(`${wName} 해독 실패 2번`);
    endGame(room, "black", why.join(" · "));
    return;
  }
  if (whiteWins && blackWins) {
    decideByScore(room, `${roundNumber}라운드 양 팀 동시 조건`);
    return;
  }
  if (roundNumber >= MAX_ROUNDS) {
    decideByScore(room, `${MAX_ROUNDS}라운드 종료`);
    return;
  }
  // 다음 라운드
  const next = roundNumber + 1;
  if (!room.rounds) room.rounds = {};
  room.rounds[next] = newRoundData(room, next);
  room.roundNumber = next;
}

// 점수 = 가로채기 − 해독 실패. 같으면 키워드 맞히기
function decideByScore(room: any, prefix: string) {
  const w = room.teams.white;
  const b = room.teams.black;
  const sW = num(w.interceptionTokens) - num(w.miscommunicationTokens);
  const sB = num(b.interceptionTokens) - num(b.miscommunicationTokens);
  const text = `${prefix} · 점수 ${formatScore(sW)} vs ${formatScore(sB)}`;
  if (sW > sB) return endGame(room, "white", text);
  if (sB > sW) return endGame(room, "black", text);
  room.phase = "tiebreak";
  room.tiebreak = { prefix: `${text} 동점`, white: null, black: null, whiteBy: "", blackBy: "" };
}

function endGame(room: any, winner: TeamId | "draw", reason: string) {
  room.phase = "ended";
  room.winner = winner;
  room.endReason = reason;
}

// ====== 동점 → 상대 키워드 맞히기 ======
export async function submitTiebreak(
  roomId: string,
  team: TeamId,
  guesses: string[],
  uid: string,
  name: string
): Promise<"ok" | "already"> {
  let error = "";
  const clean = [0, 1, 2, 3].map((i) => (guesses[i] || "").trim());
  const committed = await roomTx(roomId, (room) => {
    error = "";
    if (room.phase !== "tiebreak" || !room.tiebreak) return false;
    if (room.players?.[uid]?.team !== team) {
      error = "우리 팀 답만 낼 수 있어요";
      return false;
    }
    const tb = room.tiebreak;
    if (toStringArray(tb[team]).length) return false; // 이미 냄
    tb[team] = clean.map((g) => g || "-"); // 빈 칸도 자리 유지 (RTDB는 빈 문자열 배열을 지우지 않지만 안전하게)
    tb[`${team}By`] = name;

    const wG = toStringArray(tb.white);
    const bG = toStringArray(tb.black);
    if (wG.length && bG.length) {
      const wKw = toStringArray(room.teams.black.keywords); // 흰팀이 맞힐 대상
      const bKw = toStringArray(room.teams.white.keywords);
      const count = (gs: string[], kws: string[]) =>
        kws.reduce((n, kw, i) => (gs[i] && normalizeClue(gs[i]) === normalizeClue(kw) ? n + 1 : n), 0);
      const cW = count(wG, wKw);
      const cB = count(bG, bKw);
      const base = `${tb.prefix || "동점"} → 키워드 맞히기 ${cW} vs ${cB}`;
      if (cW > cB) endGame(room, "white", base);
      else if (cB > cW) endGame(room, "black", base);
      else endGame(room, "draw", `${base} · 공동 승리`);
    }
    return true;
  });
  if (error) throw new Error(error);
  return committed ? "ok" : "already";
}

// ====== 같은 팀으로 다시 하기 ======
export async function rematchSameTeams(roomId: string) {
  await roomTx(roomId, (room) => {
    if (room.phase !== "ended" || !room.teams?.white || !room.teams?.black) return false;
    const w = room.teams.white;
    const b = room.teams.black;
    // 암호전달자 순서를 한 칸씩 돌려서 다음 게임은 다른 사람부터
    const rot = (arr: string[]) => (arr.length > 1 ? [...arr.slice(1), arr[0]] : arr);
    const wOrder = rot(toStringArray(w.playerOrder));
    const bOrder = rot(toStringArray(b.playerOrder));
    const { picked, used } = pickFresh(8, toStringArray(room.usedKeywords), []);
    room.teams = {
      white: makeTeam("white", w.name || defaultTeamName("white"), picked.slice(0, 4), wOrder),
      black: makeTeam("black", b.name || defaultTeamName("black"), picked.slice(4, 8), bOrder),
    };
    room.usedKeywords = used;
    room.rounds = null;
    room.tiebreak = null;
    room.winner = null;
    room.endReason = null;
    room.roundNumber = 0;
    room.phase = "keyword_reveal";
    return true;
  });
}

// ====== 하트비트: onDisconnect 활용 + 가끔 갱신 ======
export async function updateHeartbeat(roomId: string, uid: string) {
  try {
    // 매번 onDisconnect를 다시 건다 (방을 나가면 자동으로 isOnline = false)
    // — 한 번만 걸면 잠깐 끊겼다 재연결된 뒤에는 예약이 이미 소모돼 다시 안 걸림
    const onlineRef = ref(db, `rooms/${roomId}/players/${uid}/isOnline`);
    onDisconnect(onlineRef).set(false).catch(() => {});
    await update(ref(db, `rooms/${roomId}/players/${uid}`), {
      lastSeenAt: serverTimestamp(),
      isOnline: true,
    });
  } catch (e) {
    // 무시
  }
}
