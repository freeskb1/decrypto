"use client";
import { useState } from "react";
import type { TeamId, TeamState } from "@/types/game";
import { cn } from "@/lib/utils";

// ====== 화면 틀: 책상 바탕 위 서류 종이 한 장 ======
export function Screen({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="min-h-[100dvh] bg-desk flex justify-center">
      <div
        className={cn(
          "paper-lines w-full max-w-md min-h-[100dvh] flex flex-col sm:shadow-[0_22px_46px_rgba(40,30,10,.22)]",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

// 상단 제목 줄 (대기실·팀 구성 등)
export function PageHead({
  title,
  right,
  left,
}: {
  title: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b-[1.5px] border-dashed border-line">
      {left}
      <div className="font-serif font-black text-[20px]">{title}</div>
      <div className="ml-auto">{right}</div>
    </div>
  );
}

// ====== 팀 표시 ======
export function TeamPill({
  teamId,
  name,
  className,
}: {
  teamId: TeamId;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black whitespace-nowrap",
        teamId === "white"
          ? "bg-wt text-wt-ink shadow-[inset_0_0_0_1.5px_#24365C]"
          : "bg-bt text-bt-ink",
        className
      )}
    >
      {name}
    </span>
  );
}

export function Dots({
  count,
  max = 2,
  className,
}: {
  count: number;
  max?: number;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex gap-[3px]", className)}>
      {Array.from({ length: max }).map((_, i) => (
        <i
          key={i}
          className={cn(
            "inline-block w-[11px] h-[11px] rounded-full border-2 border-current",
            i < count && "bg-current"
          )}
        />
      ))}
    </span>
  );
}

// ====== 상단 상태 줄: 라운드 · 양 팀 토큰 ======
export function StatusBar({
  roundLabel,
  white,
  black,
  onOpenNotes,
}: {
  roundLabel: string;
  white: TeamState | null;
  black: TeamState | null;
  onOpenNotes?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pt-4 pb-2.5 border-b-[1.5px] border-dashed border-line">
      <span className="font-mono font-bold text-[13px] bg-ink text-paper rounded-md px-[7px] py-[3px] whitespace-nowrap">
        {roundLabel}
      </span>
      {white && black && (
        <div className="ml-auto flex flex-col gap-1 text-[11px] font-bold">
          <TokenRow teamId="white" team={white} />
          <TokenRow teamId="black" team={black} />
        </div>
      )}
      {onOpenNotes && (
        <button
          onClick={onOpenNotes}
          className={cn(
            "rounded-lg border-[1.5px] border-line bg-white px-2 py-1.5 text-[11px] font-black text-ink whitespace-nowrap",
            !(white && black) && "ml-auto"
          )}
        >
          기록지
        </button>
      )}
    </div>
  );
}

function TokenRow({ teamId, team }: { teamId: TeamId; team: TeamState }) {
  const color = teamId === "white" ? "text-wt-ink" : "text-bt";
  return (
    <div className={cn("flex items-center gap-1.5 justify-end", color)}>
      <span className="truncate max-w-[56px]">{team.name}</span>
      <span className="flex items-center gap-1">
        <span className="text-muted font-medium">가로채기</span>
        <Dots count={team.interceptionTokens} />
      </span>
      <span className="flex items-center gap-1">
        <span className="text-muted font-medium">해독실패</span>
        <Dots count={team.miscommunicationTokens} className="text-stamp" />
      </span>
    </div>
  );
}

// 상태 줄 아래: 내 팀 + 이번 단계 내 역할
export function MeLine({
  teamId,
  teamName,
  role,
  muted,
}: {
  teamId: TeamId;
  teamName: string;
  role: string;
  muted?: boolean;
}) {
  return (
    <div className="mx-4 mt-2.5 flex items-center gap-2 text-xs font-bold">
      <TeamPill teamId={teamId} name={teamName} />
      <span className={muted ? "text-muted" : "text-stamp"}>{role}</span>
    </div>
  );
}

// "기다리는 중" 줄
export function WaitLine({
  children,
  tone = "red",
}: {
  children: React.ReactNode;
  tone?: "red" | "ok" | "muted";
}) {
  return (
    <div className="flex items-center gap-2 bg-white border-[1.5px] border-line rounded-2xl px-3 py-2.5 text-[13px]">
      <i
        className={cn(
          "w-2 h-2 rounded-full flex-[0_0_8px]",
          tone === "red" && "bg-stamp pulse-dot",
          tone === "ok" && "bg-ok",
          tone === "muted" && "bg-hint"
        )}
      />
      <span className="min-w-0">{children}</span>
    </div>
  );
}

// ====== 암호 카드: 누르고 있는 동안만 보임 ======
export function HoldCode({
  code,
  label = "내 암호",
  onHoldChange,
}: {
  code: number[];
  label?: string;
  onHoldChange?: (holding: boolean) => void;
}) {
  const [holding, setHolding] = useState(false);
  const setH = (v: boolean) => {
    setHolding(v);
    onHoldChange?.(v);
  };
  return (
    <button
      type="button"
      className="no-callout w-full bg-bt text-bt-ink rounded-2xl px-4 py-3.5 flex items-center justify-between text-left"
      onPointerDown={(e) => {
        e.preventDefault();
        setH(true);
      }}
      onPointerUp={() => setH(false)}
      onPointerLeave={() => setH(false)}
      onPointerCancel={() => setH(false)}
      onContextMenu={(e) => e.preventDefault()}
      onBlur={() => setH(false)}
    >
      <div>
        <div className="text-[11px] tracking-[0.2em] font-bold opacity-70">{label}</div>
        <div className="font-mono font-bold text-[34px] tracking-[0.18em] leading-tight">
          {holding ? code.join("·") : "•·•·•"}
        </div>
      </div>
      <span className="text-[11px] font-bold border-[1.5px] border-white/40 rounded-full px-2.5 py-1.5 whitespace-nowrap">
        {holding ? "손 떼면 숨겨요" : "누르고 있으면 보여요"}
      </span>
    </button>
  );
}

// ====== 키워드 4칸 ======
export function KeywordGrid({
  keywords,
  teamId,
  big,
}: {
  keywords: string[];
  teamId: TeamId;
  big?: boolean;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-[10px] px-1 text-center font-bold break-all",
            big ? "py-3 text-[15px]" : "py-2 text-[13px]",
            teamId === "white" ? "bg-wt text-wt-ink" : "bg-bt text-bt-ink"
          )}
        >
          <small className="block font-mono text-[11px] opacity-60">{i + 1}</small>
          {keywords[i] || "?"}
        </div>
      ))}
    </div>
  );
}

// ====== 단서 카드 (큰 글씨) ======
export function ClueCards({ clues, teamId }: { clues: string[]; teamId: TeamId }) {
  const marks = ["①", "②", "③"];
  return (
    <div className="flex flex-col gap-2">
      {clues.map((c, i) => (
        <div
          key={i}
          className={cn(
            "flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[20px] font-black break-all",
            teamId === "white" ? "bg-wt text-wt-ink" : "bg-bt text-bt-ink"
          )}
        >
          <em className="not-italic font-mono text-xs opacity-60 w-4 shrink-0">{marks[i]}</em>
          {c}
        </div>
      ))}
    </div>
  );
}

// ====== 번호별 지난 단서 (공개된 것만) ======
export function ClueHistory({
  title,
  accumulation,
}: {
  title: string;
  accumulation: Record<string, string[]>;
}) {
  return (
    <div className="bg-white border-[1.5px] border-line rounded-2xl px-3 py-2.5 text-xs">
      <b className="font-bold">{title}</b>
      <div className="grid grid-cols-4 gap-1.5 mt-1.5">
        {[1, 2, 3, 4].map((n) => {
          const list = accumulation[String(n)] || [];
          return (
            <div key={n} className="bg-paper rounded-lg p-1.5 leading-normal min-h-[52px] break-all">
              <small className="block font-mono font-bold text-muted">{n}</small>
              {list.length === 0 ? (
                <span className="text-hint">—</span>
              ) : (
                list.map((c, i) => <div key={i}>{c}</div>)
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ====== 숫자 고르기 (44px 버튼) ======
export function DigitPicker({
  clues,
  picks,
  onPick,
  disabled,
}: {
  clues: string[];
  picks: number[];
  onPick?: (clueIdx: number, n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      {clues.map((clue, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="flex-1 min-w-0 text-[13px] font-bold text-muted truncate">{clue}</span>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((n) => {
              const on = picks[i] === n;
              const usedElsewhere = picks.some((p, idx) => idx !== i && p === n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => onPick?.(i, n)}
                  className={cn(
                    "w-11 h-11 rounded-xl border-[1.5px] grid place-items-center font-mono font-bold text-lg transition-colors",
                    on
                      ? "bg-ink text-paper border-ink"
                      : "bg-white border-line text-ink",
                    !on && usedElsewhere && "opacity-25",
                    disabled && !on && "opacity-40"
                  )}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// 이름 목록을 짧게: "철수, 영희 외 2명"
export function nameList(names: string[], max = 3): string {
  if (names.length === 0) return "";
  if (names.length <= max) return names.join(", ");
  return `${names.slice(0, max).join(", ")} 외 ${names.length - max}명`;
}
