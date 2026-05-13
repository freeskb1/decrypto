"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { subscribeTeam, getAllRounds } from "@/lib/game";
import type { Room, Player, TeamState, TeamId, Round } from "@/types/game";
import {
  Trophy,
  Check,
  X,
  Radar,
  RefreshCw,
  Share2,
  ListChecks,
  ArrowLeft,
} from "lucide-react";

export default function EndedScreen({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const router = useRouter();
  const [white, setWhite] = useState<TeamState | null>(null);
  const [black, setBlack] = useState<TeamState | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [showReview, setShowReview] = useState(false);
  const [reviewTab, setReviewTab] = useState<TeamId>("white");

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    getAllRounds(room.id).then(setRounds);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  if (!white || !black || !me?.team) {
    return <div className="p-4 text-sm text-zinc-400">불러오는 중...</div>;
  }

  const myTeamId: TeamId = me.team;
  const myWon = room.winner === myTeamId;
  const winnerTeam = room.winner === "white" ? white : room.winner === "black" ? black : null;

  if (showReview) {
    return (
      <ReviewScreen
        white={white}
        black={black}
        rounds={rounds}
        winner={room.winner}
        currentTab={reviewTab}
        setTab={setReviewTab}
        onBack={() => setShowReview(false)}
        onHome={() => router.push("/")}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        {/* 트로피 */}
        <div className="text-center py-6">
          <div className="w-[72px] h-[72px] rounded-full bg-blue-50 inline-flex items-center justify-center mb-4">
            <Trophy className="w-10 h-10 text-blue-600" />
          </div>
          <div className="font-mono text-[11px] text-zinc-400 tracking-[0.15em] mb-2">
            MISSION COMPLETE
          </div>
          <div className="text-[24px] font-medium mb-1.5">
            {room.winner === "draw"
              ? "무승부"
              : `${winnerTeam?.name} 승리`}
          </div>
          <div className="text-[13px] text-zinc-500">
            {myWon
              ? "축하해요!"
              : room.winner === "draw"
              ? "팽팽한 승부였어요"
              : "아쉬워요. 다음에 다시 도전하세요"}
          </div>
        </div>

        {/* 최종 점수 */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3.5 mb-3.5">
          <div className="text-[10px] text-zinc-500 mb-2.5">최종 점수</div>
          <div className="flex gap-2 items-stretch">
            <ScoreCard team={white} teamId="white" winner={room.winner === "white"} />
            <div className="flex items-center font-mono text-[10px] text-zinc-400">
              VS
            </div>
            <ScoreCard team={black} teamId="black" winner={room.winner === "black"} />
          </div>
          <div className="mt-2.5 text-[11px] text-zinc-400 text-center">
            총 {rounds.length}라운드 진행
          </div>
        </div>

        <Button
          className="w-full mb-2"
          size="lg"
          onClick={() => setShowReview(true)}
        >
          <ListChecks className="w-4 h-4" />전체 기록 보기
        </Button>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            onClick={() => {
              const result = `Decrypto: ${winnerTeam?.name || "무승부"}!`;
              navigator.share?.({ text: result }).catch(() => {
                navigator.clipboard?.writeText(result);
              });
            }}
          >
            <Share2 className="w-3.5 h-3.5" />결과 공유
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            size="sm"
            onClick={() => router.push("/")}
          >
            <RefreshCw className="w-3.5 h-3.5" />새 게임
          </Button>
        </div>
      </div>
    </div>
  );
}

function ScoreCard({
  team,
  teamId,
  winner,
}: {
  team: TeamState;
  teamId: TeamId;
  winner: boolean;
}) {
  const isWhite = teamId === "white";
  return (
    <div
      className={`flex-1 p-2.5 rounded-md text-center ${
        winner ? "bg-blue-50" : "bg-zinc-50"
      }`}
    >
      <div className="flex items-center justify-center gap-1 mb-1.5">
        <div
          className={`w-2 h-2 rounded-full ${
            isWhite ? "bg-blue-500" : "bg-zinc-700"
          }`}
        />
        <span
          className={`text-xs font-medium ${
            winner ? "text-blue-700" : ""
          }`}
        >
          {team.name}
        </span>
      </div>
      <div className="text-[10px] text-zinc-500 mb-1.5">
        가로채기 / 실패
      </div>
      <div className="flex gap-1.5 justify-center items-center">
        <div className="flex gap-0.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < team.interceptionTokens
                  ? "bg-blue-500"
                  : "border border-zinc-300"
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] text-zinc-400">/</span>
        <div className="flex gap-0.5">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i < team.miscommunicationTokens
                  ? "bg-red-500"
                  : "border border-zinc-300"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReviewScreen({
  white,
  black,
  rounds,
  winner,
  currentTab,
  setTab,
  onBack,
  onHome,
}: {
  white: TeamState;
  black: TeamState;
  rounds: Round[];
  winner: TeamId | "draw" | null;
  currentTab: TeamId;
  setTab: (t: TeamId) => void;
  onBack: () => void;
  onHome: () => void;
}) {
  const team = currentTab === "white" ? white : black;
  const otherTeamId: TeamId = currentTab === "white" ? "black" : "white";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3.5">
          <button className="p-1.5 hover:bg-zinc-100 rounded" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="text-[15px] font-medium">게임 복기</div>
          {winner !== "draw" && winner && (
            <div className="ml-auto text-[11px] px-2 py-0.5 rounded bg-blue-50 text-blue-600">
              {winner === "white" ? white.name : black.name} 승
            </div>
          )}
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-zinc-50 rounded-md p-0.5 mb-3 border border-zinc-200">
          <button
            onClick={() => setTab("white")}
            className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 rounded ${
              currentTab === "white"
                ? "font-medium bg-white border border-zinc-200"
                : "text-zinc-500"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            {white.name}
          </button>
          <button
            onClick={() => setTab("black")}
            className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 rounded ${
              currentTab === "black"
                ? "font-medium bg-white border border-zinc-200"
                : "text-zinc-500"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
            {black.name}
          </button>
        </div>

        {/* 키워드 (모두 공개) */}
        <div className="bg-white border border-zinc-200 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[11px] text-zinc-500">
              {team.name} 키워드
            </span>
            <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-green-50 text-green-700">
              공개
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {team.keywords.map((kw, i) => (
              <div key={i} className="text-center p-1.5 bg-zinc-50 rounded-md">
                <div className="font-mono text-[10px] text-zinc-400">{i + 1}</div>
                <div className="text-[13px] font-medium truncate">{kw}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 라운드 요약 */}
        <div className="bg-white border border-zinc-200 rounded-xl py-1">
          <div className="px-3 py-2 border-b border-zinc-200 text-[11px] text-zinc-500">
            {team.name} 라운드 기록
          </div>
          {rounds.map((round, idx) => {
            const data = round[currentTab];
            const otherData = round[otherTeamId];
            const isLast = idx === rounds.length - 1;
            const isFinal = winner !== "draw" && isLast;
            return (
              <div
                key={round.roundNumber}
                className="px-3 py-2.5 border-b border-zinc-200 last:border-b-0"
              >
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-[11px] text-zinc-400">
                    #{String(round.roundNumber).padStart(2, "0")}
                  </span>
                  {data.ownCorrect !== null && (
                    <>
                      {data.ownCorrect ? (
                        <>
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-[11px] text-green-600">
                            통신 성공
                          </span>
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3 text-red-500" />
                          <span className="text-[11px] text-red-500">
                            통신 실패
                          </span>
                        </>
                      )}
                    </>
                  )}
                  {data.intercepted === true && (
                    <>
                      <Radar className="w-3 h-3 text-blue-500 ml-1" />
                      <span className="text-[11px] text-blue-500">
                        상대 가로채기
                      </span>
                    </>
                  )}
                  {isFinal && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 ml-auto">
                      결승
                    </span>
                  )}
                </div>
                {data.clues.length > 0 && (
                  <div className="flex gap-1 text-[11px] text-zinc-500">
                    <span className="truncate flex-1">
                      {data.clues.join(" · ")}
                    </span>
                    <span className="font-mono">{data.code.join("·")}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-3" />
        <Button className="w-full mb-1.5" size="lg" onClick={onHome}>
          <RefreshCw className="w-4 h-4" />새 게임 만들기
        </Button>
        <Button variant="outline" className="w-full" size="sm" onClick={onHome}>
          메인으로
        </Button>
      </div>
    </div>
  );
}
