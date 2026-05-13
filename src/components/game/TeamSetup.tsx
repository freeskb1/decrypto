"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  subscribeTeam,
  updateTeamName,
  goToRulesScreen,
} from "@/lib/game";
import type { Room, Player, TeamState, TeamId } from "@/types/game";
import { ArrowRight, Crown } from "lucide-react";

export default function TeamSetup({
  room,
  players,
  me,
}: {
  room: Room;
  players: Player[];
  me: Player | undefined;
}) {
  const toast = useToast();
  const [white, setWhite] = useState<TeamState | null>(null);
  const [black, setBlack] = useState<TeamState | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  if (!white || !black || !me?.team) return <div className="p-4 text-sm text-zinc-400">불러오는 중...</div>;

  const myTeamId: TeamId = me.team;
  const myTeam = myTeamId === "white" ? white : black;
  const otherTeam = myTeamId === "white" ? black : white;
  const myTeamPlayers = players.filter((p) => p.team === myTeamId);
  const otherTeamPlayers = players.filter((p) => p.team !== myTeamId);

  const handleNameChange = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateTeamName(room.id, myTeamId, val);
    }, 300);
  };

  const handleStart = async () => {
    if (!me.isHost) {
      toast.show("방장만 시작할 수 있어요", "error");
      return;
    }
    await goToRulesScreen(room.id);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-50">
      <div className="w-full max-w-sm bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-base font-medium">팀 구성</div>
          <div className="ml-auto font-mono text-[11px] px-2 py-1 rounded bg-zinc-100 text-zinc-600">
            {room.code}
          </div>
        </div>

        <div className="text-xs text-zinc-500 mb-4 leading-relaxed">
          팀이 무작위로 배정됐어요. 우리 팀 이름을 함께 정해보세요.
        </div>

        {/* 우리 팀 */}
        <TeamCard
          team={myTeam}
          players={myTeamPlayers}
          me={me}
          isMine={true}
          teamId={myTeamId}
          onNameChange={handleNameChange}
        />

        {/* VS */}
        <div className="flex items-center gap-2 my-3">
          <div className="flex-1 border-t border-dashed border-zinc-300" />
          <span className="text-[11px] text-zinc-400 font-mono tracking-wider">VS</span>
          <div className="flex-1 border-t border-dashed border-zinc-300" />
        </div>

        {/* 상대 팀 */}
        <TeamCard
          team={otherTeam}
          players={otherTeamPlayers}
          me={me}
          isMine={false}
          teamId={myTeamId === "white" ? "black" : "white"}
        />

        <div className="h-4" />

        {me.isHost ? (
          <Button className="w-full" size="lg" onClick={handleStart}>
            게임 시작 <ArrowRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className="text-center text-xs text-zinc-400 py-3">
            방장이 시작하길 기다리는 중...
          </div>
        )}
      </div>
    </div>
  );
}

function TeamCard({
  team,
  players,
  me,
  isMine,
  teamId,
  onNameChange,
}: {
  team: TeamState;
  players: Player[];
  me: Player;
  isMine: boolean;
  teamId: TeamId;
  onNameChange?: (val: string) => void;
}) {
  const [localName, setLocalName] = useState(team.name);
  const isWhite = teamId === "white";

  // 외부에서 팀명 변경되면 동기화 (다른 팀원이 수정)
  useEffect(() => {
    setLocalName(team.name);
  }, [team.name]);

  return (
    <div
      className={`bg-white rounded-xl p-3.5 border ${
        isMine ? "border-blue-500 border-2" : "border-zinc-200"
      }`}
    >
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            isWhite ? "bg-blue-500" : "bg-zinc-700"
          }`}
        />
        <span className="text-xs text-zinc-500">
          {isMine ? "우리 팀" : "상대 팀"}
        </span>
        <span
          className={`ml-auto text-[11px] px-2 py-0.5 rounded ${
            isMine ? "bg-blue-50 text-blue-600" : "bg-zinc-100 text-zinc-400"
          }`}
        >
          {isMine ? "입력 가능" : "보기 전용"}
        </span>
      </div>

      {isMine ? (
        <Input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            onNameChange?.(e.target.value);
          }}
          maxLength={12}
          selectOnFocus
          placeholder={isWhite ? "화이트팀" : "블랙팀"}
          className="mb-2.5 text-base"
        />
      ) : (
        <div className="px-3 py-2 bg-zinc-50 rounded-md mb-2.5 text-sm">
          {team.name || (isWhite ? "화이트팀" : "블랙팀")}
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {players.map((p) => (
          <div
            key={p.uid}
            className="flex items-center gap-1 px-2 py-1 bg-zinc-50 rounded-md text-xs"
          >
            {p.isHost && <Crown className="w-3 h-3 text-amber-500" />}
            <span>{p.nickname}</span>
            {p.uid === me.uid && <span className="text-zinc-400">· 나</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
