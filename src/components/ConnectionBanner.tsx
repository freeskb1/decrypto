"use client";
import { useEffect, useRef, useState } from "react";
import { goOffline, goOnline, onValue, off, ref, type DataSnapshot } from "firebase/database";
import { db } from "@/lib/firebase";

// 서버 연결이 끊기면 화면 위에 알림 + 자동 재연결
// (폰이 잠들었다 깨거나 와이파이가 바뀌면 연결이 끊긴 채로 화면이 멈춰 보일 수 있음
//  → 내가 누른 "준비 완료"가 서버에 안 가서 우리 팀 전체가 못 넘어가는 문제)
export default function ConnectionBanner() {
  const [down, setDown] = useState(false);
  const everConnected = useRef(false);
  const downTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!db) return;
    const r = ref(db, ".info/connected");
    const handler = (snap: DataSnapshot) => {
      const ok = snap.val() === true;
      if (downTimer.current) clearTimeout(downTimer.current);
      if (ok) {
        everConnected.current = true;
        setDown(false);
      } else {
        // 처음 접속 중이거나 잠깐 끊긴 건 무시하고 3초 넘게 끊겨 있으면 표시
        downTimer.current = setTimeout(() => setDown(true), everConnected.current ? 3000 : 8000);
      }
    };
    onValue(r, handler);

    // 화면으로 돌아오면 연결을 새로 맺기 (폰이 잠들었다 깨어난 경우)
    const kick = () => {
      if (document.visibilityState !== "visible") return;
      try {
        goOffline(db);
        goOnline(db);
      } catch {
        // 무시
      }
    };
    document.addEventListener("visibilitychange", kick);
    window.addEventListener("online", kick);
    return () => {
      off(r, "value", handler);
      document.removeEventListener("visibilitychange", kick);
      window.removeEventListener("online", kick);
      if (downTimer.current) clearTimeout(downTimer.current);
    };
  }, []);

  if (!down) return null;
  return (
    <div className="fixed top-0 inset-x-0 z-[200] bg-stamp text-white text-center text-[13px] font-bold px-3 py-2 shadow-md">
      서버 연결이 끊겼어요 · 다시 연결하는 중
      <br />
      <button className="underline mt-0.5" onClick={() => window.location.reload()}>
        안 되면 여기를 눌러 새로고침
      </button>
    </div>
  );
}
