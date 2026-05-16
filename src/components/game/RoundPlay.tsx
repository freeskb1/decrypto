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

  // 단계 자동 진행 로직 (호스트가 담당, 안전망)
  useEffect(() => {
    if (!round || !me?.team || !me.isHost) return;
    const isDuel = room.gameMode === "duel";

    // 단계 B (encrypting) → 다음: 양 팀 단서 다 제출되면
    if (
      round.stage === "encrypting" &&
      round.white.cluesSubmittedAt &&
      round.black.cluesSubmittedAt
    ) {
      // 듀얼 모드는 자기팀 추측 단계 없이 바로 가로채기로
      advanceStage(
        room.id,
        round.roundNumber,
        isDuel ? "intercept" : "guessing"
      );
      return;
    }

    // 단계 C (guessing) → D-1 (own_result): 양 팀 추측 다 끝나면
    // 듀얼 모드는 한 팀만 추측해도 진행 (각자 알아서)
    if (round.stage === "guessing") {
      const whiteDone = round.white.ownGuessAt !== null;
      const blackDone = round.black.ownGuessAt !== null;
      if (whiteDone && blackDone) {
        advanceStage(room.id, round.roundNumber, "own_result");
        return;
      }
    }

    // 단계 D-1 → D-2: 양 팀 모두 결과 확인하면
    if (
      round.stage === "own_result" &&
      white?.ownResultAcked &&
      black?.ownResultAcked
    ) {
      advanceStage(room.id, round.roundNumber, "intercept");
      return;
    }

    // 단계 D-2 → 다음 라운드
    if (round.stage === "intercept") {
      const isDuel = room.gameMode === "duel";
      // 1라운드는 가로채기 스킵, 그 외엔 양 팀 가로채기 완료 필요
      const interceptDone =
        round.roundNumber === 1 ||
        (round.white.interceptGuessAt !== null &&
          round.black.interceptGuessAt !== null);
      // 양 팀이 가로채기 결과 화면 확인 완료
      const ackDone =
        white?.interceptAcked === true && black?.interceptAcked === true;
      if (interceptDone && ackDone) {
        tryAdvanceToNextRound(room.id, round.roundNumber);
        return;
      }
    }
  }, [round, white, black, me, room.id, room.gameMode, room.roundNumber]);

  if (!white || !black || !round || !me?.team) {
    console.log("[RoundPlay] 대기 중 - white:", !!white, "black:", !!black, "round:", !!round, "myTeam:", me?.team, "roundNumber:", room.roundNumber);
    return (
      <div className="p-4 text-sm text-zinc-400">
        불러오는 중...
        <div className="text-[10px] text-zinc-300 mt-2">
          {!white && "팀(화이트) "}
          {!black && "팀(블랙) "}
          {!round && `라운드(${room.roundNumber}) `}
          {!me?.team && "내 팀 정보 "}
          대기 중
        </div>
      </div>
    );
  }

  const myTeamId: TeamId = me.team;
  const myTeam = myTeamId === "white" ? white : black;
  const otherTeam = myTeamId === "white" ? black : white;

  const stage = round.stage;
  const isOnline = room.connectMode === "online";

  return (
    <div className="h-[100dvh] flex flex-col items-center bg-zinc-50 py-4 px-4">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">
        {/* 헤더 - 기록지 버튼 */}
        <div className="flex items-center px-4 pt-3 pb-1 gap-2 shrink-0">
          <button
            onClick={() => setShowNoteSheet(true)}
            className="p-1.5 hover:bg-zinc-100 rounded"
          >
            <FileText className="w-4 h-4 text-zinc-600" />
          </button>
        </div>

        {/* 단계별 화면 - 스크롤 가능, 채팅이 커지면 이 영역이 줄어듦 */}
        <div className="flex-1 flex flex-col overflow-y-auto min-h-0">
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

        {/* 채팅 패널 - 게임 화면과 공존 (덮지 않음) */}
        {isOnline && (
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
