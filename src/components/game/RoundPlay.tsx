"use client";
import { useEffect, useState } from "react";
import {
  subscribeTeam,
  subscribeRound,
  ackOwnResult,
  ackIntercept,
  tryAdvanceToNextRound,
  advanceStage,
} from "@/lib/game";
import type { Room, Player, TeamState, TeamId, Round } from "@/types/game";
import StageAnnounce from "./stages/StageAnnounce";
import StageEncrypting from "./stages/StageEncrypting";
import StageGuessing from "./stages/StageGuessing";
import StageOwnResult from "./stages/StageOwnResult";
import StageIntercept from "./stages/StageIntercept";
import ChatPanel from "./ChatPanel";
import NoteSheet from "./NoteSheet";
import { FileText } from "lucide-react";

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

  // 단계 자동 진행 로직
  useEffect(() => {
    if (!round || !me?.team) return;
    const myTeamId = me.team;

    // 단계 B (encrypting) → C (guessing): 양 팀 단서 다 제출되면 자동 진행은 submitClues 내부에서 처리됨
    // 단계 C (guessing) → D-1 (own_result): 양 팀 추측 다 끝나면
    if (round.stage === "guessing" && round.white.ownGuessAt && round.black.ownGuessAt) {
      // 단계 own_result로 진행
      if (me.isHost) {
        advanceStage(room.id, round.roundNumber, "own_result");
      }
    }

    // 단계 D-1 → D-2: 양 팀 모두 ack하면
    if (round.stage === "own_result" && white?.ownResultAcked && black?.ownResultAcked) {
      if (me.isHost) {
        advanceStage(room.id, round.roundNumber, "intercept");
      }
    }

    // 단계 D-2 끝나면 다음 라운드 자동 진행 검토
    if (round.stage === "intercept") {
      const isDuel = room.gameMode === "duel";
      const interceptDone = round.roundNumber === 1 ||
        (round.white.interceptGuessAt && round.black.interceptGuessAt);
      const ackDone = white?.interceptAcked && black?.interceptAcked;
      if (interceptDone && (round.roundNumber === 1 || ackDone)) {
        if (me.isHost) {
          tryAdvanceToNextRound(room.id, round.roundNumber);
        }
      }
    }
  }, [round, white, black, me, room.id, room.gameMode, room.roundNumber]);

  if (!white || !black || !round || !me?.team) {
    return <div className="p-4 text-sm text-zinc-400">불러오는 중...</div>;
  }

  const myTeamId: TeamId = me.team;
  const myTeam = myTeamId === "white" ? white : black;
  const otherTeam = myTeamId === "white" ? black : white;

  const stage = round.stage;

  return (
    <div className="min-h-screen flex flex-col items-center bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl my-4 mx-4 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[600px]">
        {/* 헤더 - 기록지 버튼 */}
        <div className="flex items-center px-4 pt-3 pb-1 gap-2">
          <button
            onClick={() => setShowNoteSheet(true)}
            className="p-1.5 hover:bg-zinc-100 rounded"
          >
            <FileText className="w-4 h-4 text-zinc-600" />
          </button>
        </div>

        {/* 단계별 화면 */}
        <div className="flex-1 flex flex-col">
          {stage === "announce" && (
            <StageAnnounce
              room={room}
              round={round}
              myTeam={myTeam}
              otherTeam={otherTeam}
              myTeamId={myTeamId}
              players={players}
              me={me}
            />
          )}
          {stage === "encrypting" && (
            <StageEncrypting
              room={room}
              round={round}
              myTeam={myTeam}
              otherTeam={otherTeam}
              myTeamId={myTeamId}
              players={players}
              me={me}
            />
          )}
          {stage === "guessing" && (
            <StageGuessing
              room={room}
              round={round}
              myTeam={myTeam}
              otherTeam={otherTeam}
              myTeamId={myTeamId}
              players={players}
              me={me}
            />
          )}
          {stage === "own_result" && (
            <StageOwnResult
              room={room}
              round={round}
              myTeam={myTeam}
              otherTeam={otherTeam}
              myTeamId={myTeamId}
              me={me}
              onAck={() => ackOwnResult(room.id, myTeamId)}
            />
          )}
          {stage === "intercept" && (
            <StageIntercept
              room={room}
              round={round}
              myTeam={myTeam}
              otherTeam={otherTeam}
              myTeamId={myTeamId}
              me={me}
              onAck={() => ackIntercept(room.id, myTeamId)}
            />
          )}
        </div>

        {/* 채팅 패널 */}
        {room.connectMode === "online" && (
          <ChatPanel
            roomId={room.id}
            me={me}
            myTeamId={myTeamId}
            round={round}
            stage={stage}
          />
        )}
      </div>

      {/* 기록지 모달 */}
      {showNoteSheet && (
        <NoteSheet
          room={room}
          myTeam={myTeam}
          otherTeam={otherTeam}
          myTeamId={myTeamId}
          onClose={() => setShowNoteSheet(false)}
        />
      )}
    </div>
  );
}
