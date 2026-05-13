import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 4자리 방 코드 생성
export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 3자리 코드 생성 (1~4 중복없이 3개)
export function generateGameCode(): number[] {
  const all = [1, 2, 3, 4];
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

// 키워드 풀에서 N개 랜덤 추출
export function pickRandomKeywords(pool: string[], n: number, exclude: string[] = []): string[] {
  const available = pool.filter((k) => !exclude.includes(k));
  const shuffled = [...available].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

// 배열 셔플
export function shuffleArray<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

// 팀 분배 (인원 N → 화이트 / 블랙)
export function distributeTeams(playerUids: string[]): { white: string[]; black: string[] } {
  const shuffled = shuffleArray(playerUids);
  const half = Math.ceil(shuffled.length / 2);
  return {
    white: shuffled.slice(0, half),
    black: shuffled.slice(half),
  };
}

// 시간 포맷
export function formatTimer(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
