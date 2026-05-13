"use client";
import { useEffect, useRef, useState } from "react";
import { subscribeChat, sendChat } from "@/lib/game";
import type { ChatMessage, Player, Round, RoundStage, TeamId } from "@/types/game";
import { MessageCircle, ChevronUp, ChevronDown, Send, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";

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
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [lastReadAt, setLastReadAt] = useState<number>(Date.now());
  const scrollRef = useRef<HTMLDivElement>(null);

  // 단계 C(추측) 또는 D-2(가로채기) 자동 펼침
  useEffect(() => {
    if (stage === "guessing" || stage === "intercept") {
      setOpen(true);
    }
  }, [stage]);

  useEffect(() => {
    const unsub = subscribeChat(roomId, setMessages);
    return () => unsub();
  }, [roomId]);

  useEffect(() => {
    if (open) {
      setLastReadAt(Date.now());
      // 스크롤 하단으로
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      }, 50);
    }
  }, [open, messages.length]);

  // 암호전달자가 우리팀 채팅 입력 불가
  const isMeEncryptor =
    round &&
    (stage === "encrypting" || stage === "guessing") &&
    round[myTeamId].encryptorUid === me.uid;
  const teamInputDisabled = isMeEncryptor && scope === "team";

  const filtered = messages.filter((m) => {
    if (m.scope === "all") return true;
    return m.team === myTeamId;
  });

  const visibleMessages = filtered.filter(
    (m) => scope === "all" || m.team === myTeamId
  );
  const teamMessages = filtered.filter((m) => m.scope === "team" && m.team === myTeamId);
  const allMessages = filtered.filter((m) => m.scope === "all");
  const displayedMessages = scope === "team" ? teamMessages : allMessages;

  const unread = filtered.filter(
    (m) => m.createdAt > lastReadAt && m.senderUid !== me.uid
  ).length;

  const handleSend = async () => {
    if (!text.trim()) return;
    if (teamInputDisabled) return;
    await sendChat(roomId, {
      senderUid: me.uid,
      senderNickname: me.nickname,
      team: me.team || null,
      scope,
      text: text.trim(),
    });
    setText("");
  };

  const lastMsg = filtered[filtered.length - 1];

  if (!open) {
    return (
      <div
        className="border-t border-zinc-200 px-4 py-2.5 flex items-center gap-2.5 cursor-pointer bg-white"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="w-4 h-4 text-zinc-500" />
        <div className="flex-1 min-w-0 text-xs text-zinc-500 truncate">
          {lastMsg ? (
            <>
              <span className="font-medium text-zinc-900">{lastMsg.senderNickname}</span>{" "}
              · {lastMsg.text}
            </>
          ) : (
            "팀원과 의논해보세요"
          )}
        </div>
        {unread > 0 && (
          <div className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600">
            {unread}
          </div>
        )}
        <ChevronUp className="w-4 h-4 text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="border-t border-zinc-200 bg-white">
      {/* 헤더 */}
      <div className="px-4 py-2.5 border-b border-zinc-200 flex items-center gap-2">
        <MessageCircle className="w-3.5 h-3.5 text-zinc-900" />
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
        {teamInputDisabled && scope === "team" && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500">
            읽기 전용
          </span>
        )}
        <button
          onClick={() => setOpen(false)}
          className={`${teamInputDisabled && scope === "team" ? "" : "ml-auto"}`}
        >
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* 메시지 */}
      <div
        ref={scrollRef}
        className="px-4 py-2.5 max-h-[200px] overflow-y-auto flex flex-col gap-1.5"
      >
        {displayedMessages.length === 0 && (
          <div className="text-[11px] text-zinc-400 text-center py-3">
            메시지가 없어요
          </div>
        )}
        {displayedMessages.map((m) => {
          const mine = m.senderUid === me.uid;
          return (
            <div
              key={m.id}
              className={`max-w-[75%] ${mine ? "self-end items-end" : ""} flex flex-col gap-0.5`}
            >
              <div className={`text-[10px] text-zinc-500 px-1.5 ${mine ? "text-right" : ""}`}>
                {mine ? "나" : m.senderNickname}
              </div>
              <div
                className={`px-2.5 py-1.5 rounded-md text-xs ${
                  mine ? "bg-blue-50 text-blue-700" : "bg-zinc-50"
                }`}
              >
                {m.text}
              </div>
            </div>
          );
        })}
      </div>

      {/* 입력 */}
      {teamInputDisabled ? (
        <div className="px-3 py-2.5 border-t border-zinc-200 bg-zinc-50 flex items-center gap-1.5 justify-center">
          <Lock className="w-3 h-3 text-zinc-400" />
          <span className="text-[11px] text-zinc-400">
            암호전달자는 우리팀 채팅에 메시지를 보낼 수 없어요
          </span>
        </div>
      ) : (
        <div className="px-3 py-2 border-t border-zinc-200 flex gap-1.5">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="메시지 입력..."
            className="text-xs py-1.5"
            maxLength={200}
          />
          <button
            onClick={handleSend}
            className="px-2.5 bg-zinc-900 text-white rounded-lg text-xs"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
