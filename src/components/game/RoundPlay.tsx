"use client";
import { useEffect, useRef, useState } from "react";
import {
  subscribeTeam,
  subscribeRound,
  advanceFromStage,
  ackReveal,
  serverNow,
  isPresent,
} from "@/lib/game";
import type { Room, Player, TeamState, TeamId, Round, RoundStage } from "@/types/game";
import { otherTeamOf, MAX_ROUNDS, TIMER_SECONDS } from "@/types/game";
import { formatTimer } from "@/lib/utils";
import StageEncrypting from "./stages/StageEncrypting";
import StageGuess from "./stages/StageGuess";
import StageReveal from "./stages/StageReveal";
import NoteSheet from "./NoteSheet";
import { Screen, StatusBar, MeLine, WaitLine, nameList } from "./ui";

type Kind = "intercept" | "decode" | "reveal";

function parseStage(stage: RoundStage): { target: TeamId; kind: Kind } | null {
  const m = /^(white|black)_(intercept|decode|reveal)$/.exec(stage);
  if (!m) return null;
  return { target: m[1] as TeamId, kind: m[2] as Kind };
}

export default function RoundPlay({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const [white, setWhite] = useState<TeamState | null>(null);
  const [black, setBlack] = useState<TeamState | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [now, setNow] = useState(() => serverNow());
  const advanceRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    const u3 = subscribeRound(room.id, room.roundNumber, setRound);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [room.id, room.roundNumber]);

  // 1초마다 시계 (타이머 + 자리 비운 사람 판단)
  useEffect(() => {
    const t = setInterval(() => setNow(serverNow()), 1000);
    return () => clearInterval(t);
  }, []);

  // 공개 화면: 확인해야 하는 사람 = 접속 중인 플레이어 전원
  const teamPlayers = players.filter((p) => p.team === "white" || p.team === "black");
  const present = teamPlayers.filter((p) => isPresent(p, now) || p.uid === me?.uid);
  const parsed = round ? parseStage(round.stage) : null;
  const revealTarget: TeamId | null = parsed && parsed.kind === "reveal" ? parsed.target : null;
  const acks: Record<string, boolean> =
    revealTarget && round ? round.acks[revealTarget] || {} : {};
  const ackedCount = present.filter((p) => acks[p.uid]).length;
  const allAcked = revealTarget !== null && present.length > 0 && ackedCount >= present.length;

  // ===== 자동 진행: 누구 폰이든 조건을 보면 (멱등 트랜잭션이라 여러 명이 불러도 한 번만) =====
  useEffect(() => {
    if (!round || room.phase !== "round_in_progress") return;
    let should = false;
    if (
      round.stage === "encrypting" &&
      round.white.cluesSubmittedAt &&
      round.black.cluesSubmittedAt
    ) {
      should = true;
    }
    if (revealTarget && allAcked) should = true;
    if (!should) return;
    const key = `${round.roundNumber}:${round.stage}`;
    const t = Date.now();
    // 같은 단계는 3초에 한 번만 시도 (실패해도 다시 시도)
    if (advanceRef.current.key === key && t - advanceRef.current.at < 3000) return;
    advanceRef.current = { key, at: t };
    advanceFromStage(room.id, round.roundNumber, round.stage).catch((e) =>
      console.error("advance failed", e)
    );
  }, [round, room.id, room.phase, revealTarget, allAcked, now]);

  if (!white || !black || !round || !me?.team) {
    return (
      <Screen>
        <div className="p-6 text-sm text-muted">불러오는 중...</div>
      </Screen>
    );
  }

  const meP: Player = me;
  const roundP: Round = round;
  const myTeamId: TeamId = me.team;
  const guessStage =
    parsed && parsed.kind !== "reveal"
      ? { target: parsed.target, kind: parsed.kind as "intercept" | "decode" }
      : null;
  const revealT: TeamId | null = revealTarget;
  const myTeam = myTeamId === "white" ? white : black;
  const whiteT: TeamState = white;
  const blackT: TeamState = black;
  const teamOf = (t: TeamId): TeamState => (t === "white" ? whiteT : blackT);
  const nick = (uid: string) => players.find((p) => p.uid === uid)?.nickname || "?";
  const stage = round.stage;

  // ===== 타이머 (먼저 낸 쪽이 생기면 다른 암호전달자에게 30초) =====
  const pendingEncryptors: TeamId[] = (["white", "black"] as TeamId[]).filter(
    (t) => !round[t].cluesSubmittedAt
  );
  const timerRunning =
    stage === "encrypting" && !!round.encryptingTimerStartAt && pendingEncryptors.length === 1;
  const timeLeft = timerRunning
    ? Math.max(0, TIMER_SECONDS - Math.floor((now - (round.encryptingTimerStartAt || 0)) / 1000))
    : TIMER_SECONDS;
  const timeOver = timerRunning && timeLeft <= 0;

  // ===== 내 역할 + 기다리는 사람 =====
  let role = "";
  let roleMuted = false;
  let wait: React.ReactNode = null;
  let waitTone: "red" | "ok" | "muted" = "red";

  if (stage === "encrypting") {
    const isEnc = round[myTeamId].encryptorUid === me.uid;
    if (isEnc) {
      role = round[myTeamId].cluesSubmittedAt ? "단서 확정함 · 기다려요" : "이번엔 내가 암호전달자";
    } else {
      role = `우리 암호전달자: ${nick(round[myTeamId].encryptorUid)}`;
      roleMuted = true;
    }
    if (pendingEncryptors.length === 0) {
      wait = "단서 공개로 넘어가는 중…";
      waitTone = "ok";
    } else if (timerRunning) {
      const t = pendingEncryptors[0];
      wait = (
        <>
          기다리는 중: {teamOf(t).name} 암호전달자 <b className="font-black">{nick(round[t].encryptorUid)}</b>
          {" · "}남은 시간{" "}
          <span className="font-mono font-bold text-stamp">{formatTimer(timeLeft)}</span>
        </>
      );
    } else {
      wait = (
        <>
          기다리는 중: 암호전달자{" "}
          <b className="font-black">
            {nameList(pendingEncryptors.map((t) => nick(round[t].encryptorUid)))}
          </b>
        </>
      );
    }
  } else if (parsed) {
    const T = parsed.target;
    const O = otherTeamOf(T);
    const tName = teamOf(T).name;
    const oName = teamOf(O).name;
    const isTEncryptor = round[T].encryptorUid === me.uid;
    if (parsed.kind === "intercept") {
      if (myTeamId === O) {
        role = "가로채기 · 우리 팀이 먼저 말해요";
      } else {
        role = isTEncryptor ? "암호전달자 · 조용히 들어요" : "상대가 우리 단서를 가로채는 중";
        roleMuted = !isTEncryptor;
      }
      const names = players.filter((p) => p.team === O).map((p) => p.nickname);
      wait = (
        <>
          기다리는 중: {oName} 가로채기 <b className="font-black">({nameList(names)})</b>
        </>
      );
    } else if (parsed.kind === "decode") {
      if (myTeamId === T) {
        role = isTEncryptor ? "암호전달자 · 말하지 말고 기다려요" : "해독 · 우리 단서 맞히기";
      } else {
        role = `${tName} 해독 지켜보기`;
        roleMuted = true;
      }
      const names = players
        .filter((p) => p.team === T && p.uid !== round[T].encryptorUid)
        .map((p) => p.nickname);
      wait = (
        <>
          기다리는 중: {tName} 해독 <b className="font-black">({nameList(names)})</b>
        </>
      );
    } else {
      role = "결과 보는 중";
      roleMuted = true;
      const next =
        T === "white"
          ? `${oName} 단서 공개`
          : round.roundNumber >= MAX_ROUNDS
          ? "게임 결과"
          : "라운드 끝 판정";
      const notYet = present.filter((p) => !acks[p.uid]).map((p) => p.nickname);
      wait = (
        <>
          다음: <b className="font-black">{next}</b> · 모두 확인하면 넘어가요 ({ackedCount}/
          {present.length})
          {notYet.length > 0 && (
            <span className="block text-muted text-xs mt-0.5">
              기다리는 중: {nameList(notYet, 4)}
            </span>
          )}
        </>
      );
      waitTone = allAcked ? "ok" : "red";
    }
  } else {
    role = "다음 라운드 준비 중";
    roleMuted = true;
    wait = "잠시만요…";
    waitTone = "muted";
  }

  return (
    <Screen>
      <StatusBar
        roundLabel={`R${round.roundNumber} / ${MAX_ROUNDS}`}
        white={white}
        black={black}
        onOpenNotes={() => setShowNoteSheet(true)}
      />
      <MeLine teamId={myTeamId} teamName={myTeam.name} role={role} muted={roleMuted} />

      <div className="flex-1 flex flex-col gap-3 px-4 py-3.5">
        {timeOver && (
          <div className="rounded-2xl bg-stamp text-white px-4 py-3 text-center">
            <div className="font-serif font-black text-[20px]">시간 종료</div>
            <div className="text-[13px] font-bold mt-0.5">
              {nick(round[pendingEncryptors[0]].encryptorUid)}님, 지금 바로 단서를 확정해주세요
            </div>
          </div>
        )}

        {stage === "encrypting" && (
          <StageEncrypting
            room={room}
            round={round}
            myTeam={myTeam}
            myTeamId={myTeamId}
            me={me}
            encryptorName={nick(round[myTeamId].encryptorUid)}
          />
        )}

        {guessStage && (
          <StageGuess
            room={room}
            round={roundP}
            target={guessStage.target}
            kind={guessStage.kind}
            myTeamId={myTeamId}
            me={meP}
            myTeam={myTeam}
            targetTeam={teamOf(guessStage.target)}
            actingTeam={teamOf(
              guessStage.kind === "intercept" ? otherTeamOf(guessStage.target) : guessStage.target
            )}
          />
        )}

        {revealT && (
          <StageReveal
            round={roundP}
            target={revealT}
            myTeamId={myTeamId}
            targetTeam={teamOf(revealT)}
            otherTeam={teamOf(otherTeamOf(revealT))}
            acked={!!acks[meP.uid]}
            allAcked={allAcked}
            onAck={() => {
              ackReveal(room.id, roundP.roundNumber, revealT, meP.uid).catch(() => {});
            }}
            onSkip={() => {
              advanceFromStage(room.id, roundP.roundNumber, roundP.stage).catch(() => {});
            }}
          />
        )}

        <div className="mt-auto pt-1">
          <WaitLine tone={waitTone}>{wait}</WaitLine>
        </div>
      </div>

      {showNoteSheet && (
        <NoteSheet
          room={room}
          white={white}
          black={black}
          myTeamId={myTeamId}
          onClose={() => setShowNoteSheet(false)}
        />
      )}
    </Screen>
  );
}
