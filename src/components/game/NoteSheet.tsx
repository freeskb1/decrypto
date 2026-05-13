"use client";
import { useEffect, useState } from "react";
import { getAllRounds } from "@/lib/game";
import type { Room, TeamState, TeamId, Round } from "@/types/game";
import { X, Lock, Eye } from "lucide-react";

export default function NoteSheet({
  room,
  myTeam,
  otherTeam,
  myTeamId,
  onClose,
  reveal = false,
}: {
  room: Room;
  myTeam: TeamState;
  otherTeam: TeamState;
  myTeamId: TeamId;
  onClose: () => void;
  reveal?: boolean;
}) {
  const [tab, setTab] = useState<"mine" | "other">("mine");
  const [rounds, setRounds] = useState<Round[]>([]);

  useEffect(() => {
    getAllRounds(room.id).then(setRounds);
  }, [room.id, room.roundNumber]);

  const otherTeamId: TeamId = myTeamId === "white" ? "black" : "white";

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-4">
          <button className="p-1.5 hover:bg-zinc-100 rounded" onClick={onClose}>
            <X className="w-4 h-4" />
          </button>
          <div className="text-[15px] font-medium">기록지</div>
          <div className="ml-auto font-mono text-[11px] text-zinc-400">
            ROUND {String(room.roundNumber).padStart(2, "0")} / 08
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-zinc-50 rounded-md p-0.5 mb-3 border border-zinc-200">
          <button
            onClick={() => setTab("mine")}
            className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 rounded ${
              tab === "mine"
                ? "font-medium bg-white border border-zinc-200"
                : "text-zinc-500"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            우리팀
          </button>
          <button
            onClick={() => setTab("other")}
            className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 rounded ${
              tab === "other"
                ? "font-medium bg-white border border-zinc-200"
                : "text-zinc-500"
            }`}
          >
            <div className="w-2 h-2 rounded-full bg-zinc-700" />
            상대팀
          </button>
        </div>

        {tab === "mine" ? (
          <MineTab myTeam={myTeam} rounds={rounds} myTeamId={myTeamId} />
        ) : (
          <OtherTab
            otherTeam={otherTeam}
            rounds={rounds}
            otherTeamId={otherTeamId}
            reveal={reveal}
          />
        )}
      </div>
    </div>
  );
}

function MineTab({
  myTeam,
  rounds,
  myTeamId,
}: {
  myTeam: TeamState;
  rounds: Round[];
  myTeamId: TeamId;
}) {
  return (
    <>
      {/* 키워드 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 mb-3">
        <div className="text-[10px] text-zinc-500 mb-1.5">우리 팀 키워드</div>
        <div className="grid grid-cols-4 gap-1">
          {myTeam.keywords.map((kw, i) => (
            <div
              key={i}
              className="text-center p-1 bg-zinc-50 rounded-md"
            >
              <div className="font-mono text-[9px] text-zinc-400">{i + 1}</div>
              <div className="text-[12px] font-medium truncate">{kw}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 라운드별 */}
      <div className="bg-white border border-zinc-200 rounded-xl py-1 mb-3">
        <div className="grid grid-cols-[24px_1fr_30px_30px] gap-1.5 px-3 py-1.5 border-b border-zinc-200 text-[9px] text-zinc-400">
          <span>#</span>
          <span>단서</span>
          <span className="text-center">추측</span>
          <span className="text-center">정답</span>
        </div>

        {rounds.length === 0 && (
          <div className="text-[11px] text-zinc-400 text-center py-3">
            기록이 없어요
          </div>
        )}

        {rounds.map((round) => {
          const data = round[myTeamId];
          return (
            <div
              key={round.roundNumber}
              className="px-3 py-2 border-b border-zinc-200 last:border-b-0"
            >
              {data.clues.length > 0 ? (
                data.clues.map((clue, i) => {
                  const ok = data.ownGuess?.[i] === data.code[i];
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[24px_1fr_30px_30px] gap-1.5 items-center py-0.5"
                    >
                      <div className="font-mono text-[11px] text-zinc-400">
                        {i === 0 ? String(round.roundNumber).padStart(2, "0") : ""}
                      </div>
                      <span className="text-[12px] truncate">{clue}</span>
                      <span
                        className={`font-mono text-[11px] text-center ${
                          data.ownGuess
                            ? ok
                              ? "text-green-600"
                              : "text-red-500"
                            : "text-zinc-400"
                        }`}
                      >
                        {data.ownGuess?.[i] ?? "—"}
                      </span>
                      <span className="font-mono text-[11px] text-center">
                        {data.code[i]}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-[11px] text-zinc-400 text-center py-1">
                  진행 예정
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 코드별 누적 단서 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5">
        <div className="text-[10px] text-zinc-500 mb-2">코드별 누적 단서</div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-zinc-50 rounded-md p-1.5 text-center"
            >
              <div className="font-mono text-[10px] text-zinc-400 pb-1 mb-1 border-b border-zinc-200">
                {n}번
              </div>
              <div className="flex flex-col gap-0.5">
                {(myTeam.clueAccumulation[String(n)] || []).map((c, i) => (
                  <div key={i} className="text-[11px] text-zinc-500 truncate">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function OtherTab({
  otherTeam,
  rounds,
  otherTeamId,
  reveal,
}: {
  otherTeam: TeamState;
  rounds: Round[];
  otherTeamId: TeamId;
  reveal: boolean;
}) {
  return (
    <>
      {/* 상대 키워드 (가림) */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5 mb-3">
        <div className="flex items-center gap-1.5 mb-1.5">
          {reveal ? (
            <Eye className="w-3 h-3 text-green-600" />
          ) : (
            <Lock className="w-3 h-3 text-zinc-400" />
          )}
          <span className="text-[10px] text-zinc-500">상대 팀 키워드</span>
          <span
            className={`ml-auto text-[9px] px-1.5 py-0.5 rounded ${
              reveal
                ? "bg-green-50 text-green-700"
                : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {reveal ? "공개" : "게임 종료 시 공개"}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {otherTeam.keywords.map((kw, i) => (
            <div
              key={i}
              className="text-center p-1 bg-zinc-50 rounded-md"
            >
              <div className="font-mono text-[9px] text-zinc-400">{i + 1}</div>
              <div
                className={`text-[12px] truncate ${
                  reveal ? "font-medium" : "font-mono text-zinc-400"
                }`}
              >
                {reveal ? kw : "???"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 라운드별 */}
      <div className="bg-white border border-zinc-200 rounded-xl py-1 mb-3">
        <div className="grid grid-cols-[24px_1fr_36px_30px] gap-1.5 px-3 py-1.5 border-b border-zinc-200 text-[9px] text-zinc-400">
          <span>#</span>
          <span>단서</span>
          <span className="text-center">가로채기</span>
          <span className="text-center">정답</span>
        </div>

        {rounds.length === 0 && (
          <div className="text-[11px] text-zinc-400 text-center py-3">
            기록이 없어요
          </div>
        )}

        {rounds.map((round) => {
          const data = round[otherTeamId];
          const isFirst = round.roundNumber === 1;
          return (
            <div
              key={round.roundNumber}
              className="px-3 py-2 border-b border-zinc-200 last:border-b-0"
            >
              {data.clues.length > 0 ? (
                data.clues.map((clue, i) => {
                  const guess = data.interceptGuess?.[i];
                  const ok = guess === data.code[i];
                  return (
                    <div
                      key={i}
                      className="grid grid-cols-[24px_1fr_36px_30px] gap-1.5 items-center py-0.5"
                    >
                      <div className="font-mono text-[11px] text-zinc-400">
                        {i === 0 ? String(round.roundNumber).padStart(2, "0") : ""}
                      </div>
                      <span className="text-[12px] truncate">{clue}</span>
                      <span
                        className={`font-mono text-[11px] text-center ${
                          isFirst
                            ? "text-zinc-400"
                            : guess !== undefined && guess !== null
                            ? ok
                              ? "text-green-600"
                              : "text-red-500"
                            : "text-zinc-400"
                        }`}
                      >
                        {isFirst ? "—" : guess ?? "—"}
                      </span>
                      <span className="font-mono text-[11px] text-center">
                        {data.code[i] ?? "?"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div className="text-[11px] text-zinc-400 text-center py-1">
                  진행 예정
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 누적 단서 */}
      <div className="bg-white border border-zinc-200 rounded-xl p-2.5">
        <div className="text-[10px] text-zinc-500 mb-2">
          상대 코드별 누적 단서 (추리용)
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-zinc-50 rounded-md p-1.5 text-center"
            >
              <div className="font-mono text-[10px] text-zinc-400 pb-1 mb-1 border-b border-zinc-200">
                {n}번
              </div>
              <div className="flex flex-col gap-0.5">
                {(otherTeam.clueAccumulation[String(n)] || []).map((c, i) => (
                  <div key={i} className="text-[11px] text-zinc-500 truncate">
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
