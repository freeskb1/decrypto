import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 4자리 방 코드 생성
export function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// 배열 셔플 (Fisher–Yates)
export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

// 3자리 코드 생성 (1~4 중복없이 3개)
export function generateGameCode(): number[] {
  return shuffleArray([1, 2, 3, 4]).slice(0, 3);
}

// 키워드 풀에서 N개 랜덤 추출 (exclude 제외, 중복 없음)
export function pickRandomKeywords(pool: string[], n: number, exclude: string[] = []): string[] {
  const ex = new Set(exclude);
  const unique = Array.from(new Set(pool));
  const available = unique.filter((k) => !ex.has(k));
  return shuffleArray(available).slice(0, n);
}

// 팀 분배 (인원 N → 흰팀 / 검은팀, 인원 차이 최대 1)
export function distributeTeams(playerUids: string[]): { white: string[]; black: string[] } {
  const shuffled = shuffleArray(playerUids);
  const half = Math.ceil(shuffled.length / 2);
  return {
    white: shuffled.slice(0, half),
    black: shuffled.slice(half),
  };
}

// 시간 포맷 (0:21)
export function formatTimer(seconds: number): string {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// 점수 표시: +1 / 0 / -1
export function formatScore(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}
