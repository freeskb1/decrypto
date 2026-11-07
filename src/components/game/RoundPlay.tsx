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
  const isReveal = round?.stage === "reveal";
  const acks: Record<string, boolean> = isReveal && round ? round.acks.all || {} : {};
  const ackedCount = present.filter((p) => acks[p.uid]).length;
  const allAcked = isReveal && present.length > 0 && ackedCount >= present.length;

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
    if (isReveal && allAcked) should = true;
    if (!should) return;
    const key = `${round.roundNumber}:${round.stage}`;
    const t = Date.now();
    // 같은 단계는 3초에 한 번만 시도 (실패해도 다시 시도)
    if (advanceRef.current.key === key && t - advanceRef.current.at < 3000) return;
    advanceRef.current = { key, at: t };
    advanceFromStage(room.id, round.roundNumber, round.stage).catch((e) =>
      console.error("advance failed", e)
    );
  }, [round, room.id, room.phase, isReveal, allAcked, now]);

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
  // 해독 = 우리 팀 단서, 가로채기 = 상대 팀 단서 (두 팀 동시)
  const guessStage =
    round.stage === "decode"
      ? { target: me.team, kind: "decode" as const }
      : round.stage === "intercept"
      ? { target: otherTeamOf(me.team), kind: "intercept" as const }
      : null;
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
  // 우리 팀 암호전달자가 연결이 끊겼거나 우리 팀 시간이 다 됨 → 팀원이 대신할 수 있음
  const encP = players.find((p) => p.uid === round[myTeamId].encryptorUid);
  const encAway = stage === "encrypting" && !round[myTeamId].cluesSubmittedAt && (!encP || !isPresent(encP, now));
  const myTimeOver = timeOver && pendingEncryptors[0] === myTeamId;

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
  } else if (stage === "decode" || stage === "intercept") {
    const isDecode = stage === "decode";
    const isEnc = round[myTeamId].encryptorUid === me.uid;
    if (isDecode) {
      role = isEnc ? "암호전달자 · 말하지 말고 기다려요" : "해독 · 우리 단서 맞히기";
      roleMuted = isEnc;
    } else {
      role = "가로채기 · 상대 단서 맞히기";
    }
    // 아직 답을 안 낸 팀 (해독: 그 팀 단서의 ownGuess / 가로채기: 상대 팀 단서의 interceptGuess)
    const notDone = (["white", "black"] as TeamId[]).filter((t) =>
      isDecode ? !round[t].ownGuess : !round[otherTeamOf(t)].interceptGuess
    );
    const label = isDecode ? "해독" : "가로채기";
    wait =
      notDone.length === 0 ? (
        "넘어가는 중…"
      ) : (
        <>
          기다리는 중: <b className="font-black">{nameList(notDone.map((t) => teamOf(t).name))}</b> {label}
          <span className="block text-muted text-xs mt-0.5">
            {isDecode
              ? round.roundNumber >= 2
                ? "두 팀 다 해독하면 상대 단서 가로채기로 넘어가요"
                : "두 팀 다 해독하면 같이 공개해요 (1라운드는 가로채기 없음)"
              : "두 팀 다 가로채면 같이 공개해요"}
          </span>
        </>
      );
    if (notDone.length === 0) waitTone = "ok";
  } else if (stage === "reveal") {
    role = "결과 보는 중";
    roleMuted = true;
    const next = round.roundNumber >= MAX_ROUNDS ? "게임 결과" : "라운드 끝 판정";
    const notYet = present.filter((p) => !acks[p.uid]).map((p) => p.nickname);
    wait = (
      <>
        다음: <b className="font-black">{next}</b> · 모두 확인하면 넘어가요 ({ackedCount}/{present.length})
        {notYet.length > 0 && (
          <span className="block text-muted text-xs mt-0.5">기다리는 중: {nameList(notYet, 4)}</span>
        )}
      </>
    );
    waitTone = allAcked ? "ok" : "red";
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
            canTakeOver={encAway || myTimeOver}
            takeOverReason={
              encAway
                ? `${nick(round[myTeamId].encryptorUid)}님 연결이 끊겼어요`
                : "시간이 다 됐어요"
            }
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
            actingTeam={myTeam}
          />
        )}

        {isReveal && (
          <StageReveal
            round={roundP}
            myTeamId={myTeamId}
            myTeam={myTeam}
            otherTeam={teamOf(otherTeamOf(myTeamId))}
            acked={!!acks[meP.uid]}
            allAcked={allAcked}
            onAck={() => {
              ackReveal(room.id, roundP.roundNumber, meP.uid).catch(() => {});
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
