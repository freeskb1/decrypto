"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeChat, sendChat } from "@/lib/game";
import type { ChatMessage, Player, Round, RoundStage, TeamId } from "@/types/game";
import { MessageCircle, ChevronUp, ChevronDown, Send, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";

type ChatSize = "mini" | "normal" | "max";

export default function ChatPanel({
  roomId,
  me,
  myTeamId,
  round,
  stage,
}: {
  roomId: string;
  me: Player;
  myTeamId: TeamId;
  round: Round | null;
  stage: RoundStage;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scope, setScope] = useState<"team" | "all">("team");
  const [size, setSize] = useState<ChatSize>("mini");
  const [text, setText] = useState("");
  const [lastReadAt, setLastReadAt] = useState<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoOpenedStage = useRef<RoundStage | null>(null);

  // 단계 C(추측) 또는 D-2(가로채기) 진입 시 미니였으면 기본으로 1회 자동 확대
  useEffect(() => {
    if (
      (stage === "guessing" || stage === "intercept") &&
      autoOpenedStage.current !== stage
    ) {
      setSize((prev) => (prev === "mini" ? "normal" : prev));
      autoOpenedStage.current = stage;
    }
  }, [stage]);

  useEffect(() => {
    const unsub = subscribeChat(roomId, setMessages);
    return () => unsub();
  }, [roomId]);

  // 메시지 늘거나 사이즈 바뀌면 스크롤 하단으로
  useEffect(() => {
    if (size !== "mini") {
      setLastReadAt(Date.now());
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [size, messages.length]);

  // 암호전달자가 우리팀 채팅 입력 불가 (B, C 단계)
  const isMeEncryptor =
    round &&
    (stage === "encrypting" || stage === "guessing") &&
    round[myTeamId].encryptorUid === me.uid;
  const teamInputDisabled = isMeEncryptor && scope === "team";

  const displayedMessages = messages.filter((m) => {
    if (scope === "all") return m.scope === "all";
    return m.scope === "team" && m.team === myTeamId;
  });

  const unread = messages.filter((m) => {
    if (m.senderUid === me.uid) return false;
    if (m.createdAt <= lastReadAt) return false;
    if (m.scope === "all") return true;
    return m.team === myTeamId;
  }).length;

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (teamInputDisabled) return;
    setText("");
    try {
      await sendChat(roomId, {
        senderUid: me.uid,
        senderNickname: me.nickname,
        team: me.team || null,
        scope,
        text: trimmed,
      });
    } catch (e) {
      setText(trimmed);
    }
  };

  const lastVisibleMsg = messages
    .filter((m) => (m.scope === "all" ? true : m.team === myTeamId))
    .slice(-1)[0];

  const grow = () => {
    setSize((s) => (s === "mini" ? "normal" : s === "normal" ? "max" : "max"));
  };
  const shrink = () => {
    setSize((s) => (s === "max" ? "normal" : s === "normal" ? "mini" : "mini"));
  };

  // ===== 미니 (하단 바) =====
  if (size === "mini") {
    return (
      <div
        className="border-t border-zinc-200 px-4 py-2.5 flex items-center gap-2.5 cursor-pointer bg-white shrink-0"
        onClick={() => setSize("normal")}
      >
        <MessageCircle className="w-4 h-4 text-zinc-500 shrink-0" />
        <div className="flex-1 min-w-0 text-xs text-zinc-500 truncate">
          {lastVisibleMsg ? (
            <>
              <span className="font-medium text-zinc-900">
                {lastVisibleMsg.senderUid === me.uid
                  ? "나"
                  : lastVisibleMsg.senderNickname}
              </span>{" "}
              · {lastVisibleMsg.text}
            </>
          ) : (
            "탭하여 채팅 열기"
          )}
        </div>
        {unread > 0 && (
          <div className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500 text-white shrink-0">
            {unread}
          </div>
        )}
        <ChevronUp className="w-4 h-4 text-zinc-400 shrink-0" />
      </div>
    );
  }

  // ===== 기본 / 최대 =====
  // 기본: 메시지 영역 고정 높이 / 최대: flex-1로 크게
  const isMax = size === "max";

  return (
    <div
      className={`border-t border-zinc-200 bg-white flex flex-col shrink-0 ${
        isMax ? "flex-1 min-h-0" : ""
      }`}
    >
      {/* 헤더 */}
      <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-2 shrink-0">
        <MessageCircle className="w-3.5 h-3.5 text-zinc-900 shrink-0" />
        <div className="flex gap-3 ml-1">
          <button
            onClick={() => setScope("team")}
            className={`text-xs pb-0.5 ${
              scope === "team"
                ? "font-medium text-blue-600 border-b-[1.5px] border-blue-500"
                : "text-zinc-500"
            }`}
          >
            우리팀
          </button>
          <button
            onClick={() => setScope("all")}
            className={`text-xs pb-0.5 ${
              scope === "all"
                ? "font-medium text-blue-600 border-b-[1.5px] border-blue-500"
                : "text-zinc-500"
            }`}
          >
            전체
          </button>
        </div>

        {teamInputDisabled && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 ml-2">
            읽기 전용
          </span>
        )}

        {/* 사이즈 조절 버튼 */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={grow}
            disabled={isMax}
            className="p-1 rounded hover:bg-zinc-100 disabled:opacity-30"
            aria-label="채팅 크게"
          >
            <ChevronUp className="w-4 h-4 text-zinc-500" />
          </button>
          <button
            onClick={shrink}
            className="p-1 rounded hover:bg-zinc-100"
            aria-label="채팅 작게"
          >
            <ChevronDown className="w-4 h-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* 메시지 영역 */}
      <div
        ref={scrollRef}
        className={`px-4 py-2.5 overflow-y-auto flex flex-col gap-1.5 ${
          isMax ? "flex-1 min-h-0" : "h-[140px]"
        }`}
      >
        {displayedMessages.length === 0 && (
          <div className="text-[11px] text-zinc-400 text-center py-4">
            {scope === "team"
              ? "우리팀 채팅이 비어있어요"
              : "전체 채팅이 비어있어요"}
          </div>
        )}
        {displayedMessages.map((m) => {
          const mine = m.senderUid === me.uid;
          return (
            <div
              key={m.id}
              className={`max-w-[78%] flex flex-col gap-0.5 ${
                mine ? "self-end items-end" : ""
              }`}
            >
              <div
                className={`text-[10px] text-zinc-500 px-1.5 ${
                  mine ? "text-right" : ""
                }`}
              >
                {mine ? "나" : m.senderNickname}
              </div>
              <div
                className={`px-2.5 py-1.5 rounded-lg text-xs break-words ${
                  mine
                    ? "bg-blue-500 text-white"
                    : "bg-zinc-100 text-zinc-900"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* 입력 영역 */}
      {teamInputDisabled ? (
        <div className="px-3 py-2.5 border-t border-zinc-200 bg-zinc-50 flex items-center gap-1.5 justify-center shrink-0">
          <Lock className="w-3 h-3 text-zinc-400" />
          <span className="text-[11px] text-zinc-400">
            암호전달자는 우리팀 채팅을 보낼 수 없어요
          </span>
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-zinc-200 flex gap-1.5 shrink-0">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={scope === "team" ? "우리팀에게..." : "전체에게..."}
            className="text-xs py-2"
            maxLength={200}
            autoComplete="off"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="px-3 bg-blue-500 text-white rounded-lg text-xs disabled:opacity-40 shrink-0"
            aria-label="전송"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
