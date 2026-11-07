"use client";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { subscribeTeam, updateTeamName, goToRulesScreen } from "@/lib/game";
import type { Room, Player, TeamState, TeamId } from "@/types/game";
import { defaultTeamName } from "@/types/game";
import { ArrowRight, Crown } from "lucide-react";
import { Screen, PageHead, TeamPill } from "./ui";
import { cn } from "@/lib/utils";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const u1 = subscribeTeam(room.id, "white", setWhite);
    const u2 = subscribeTeam(room.id, "black", setBlack);
    return () => {
      u1();
      u2();
    };
  }, [room.id]);

  if (!white || !black || !me?.team) {
    return (
      <Screen>
        <div className="p-6 text-sm text-muted">불러오는 중...</div>
      </Screen>
    );
  }

  const myTeamId: TeamId = me.team;

  const handleNameChange = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateTeamName(room.id, myTeamId, val);
    }, 400);
  };

  // 누구든 넘길 수 있음 (방장 폰이 꺼져도 멈추지 않게)
  const handleStart = async () => {
    try {
      await goToRulesScreen(room.id);
    } catch (e: any) {
      toast.show(e?.message || "넘기기 실패", "error");
    }
  };

  return (
    <Screen>
      <PageHead title="팀 구성" right={<TeamPill teamId={myTeamId} name={`나: ${(myTeamId === "white" ? white : black).name}`} />} />
      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        <p className="text-[13px] text-muted">
          같은 팀끼리 가까이 앉아요.
        </p>
        {(["white", "black"] as TeamId[]).map((t) => (
          <TeamCard
            key={t}
            teamId={t}
            team={t === "white" ? white : black}
            players={players.filter((p) => p.team === t)}
            me={me}
            isMine={t === myTeamId}
            onNameChange={t === myTeamId ? handleNameChange : undefined}
          />
        ))}
        <div className="mt-auto">
          <Button size="lg" className="w-full" onClick={handleStart}>
            다 앉았어요 · 다음 <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Screen>
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
      className={cn(
        "rounded-2xl p-3.5",
        isWhite ? "bg-wt text-wt-ink shadow-[inset_0_0_0_1.5px_#24365C]" : "bg-bt text-bt-ink",
        isMine && "ring-2 ring-stamp ring-offset-2 ring-offset-paper"
      )}
    >
      <div className="flex items-center gap-2 mb-2 text-xs font-bold opacity-80">
        {isWhite ? "흰팀" : "검은팀"} · {isMine ? "우리 팀" : "상대 팀"} · {players.length}명
      </div>
      {isMine && onNameChange ? (
        <Input
          value={localName}
          onChange={(e) => {
            setLocalName(e.target.value);
            onNameChange(e.target.value);
          }}
          maxLength={8}
          selectOnFocus
          placeholder={defaultTeamName(teamId)}
          className="mb-2.5 font-serif font-black text-[18px] text-ink"
        />
      ) : (
        <div className="font-serif font-black text-[20px] mb-2">{team.name || defaultTeamName(teamId)}</div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {players.map((p) => (
          <span
            key={p.uid}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-lg text-[13px] font-bold",
              isWhite ? "bg-white/70" : "bg-white/10"
            )}
          >
            {p.isHost && <Crown className="w-3 h-3" />}
            {p.nickname}
            {p.uid === me.uid && <span className="opacity-60">· 나</span>}
          </span>
        ))}
      </div>
    </div>
  );
}
