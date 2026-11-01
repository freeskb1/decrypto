import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Noto Sans KR"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        serif: ['"Noto Serif KR"', "ui-serif", "serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // 밝은 첩보: 서류 종이 바탕 + 흰팀(아이보리/남색) vs 검은팀(먹색) + 빨간 도장
        desk: "#E9E4D8",
        paper: "#FBF8F1",
        ink: "#1E2433",
        muted: "#6C6A62",
        line: "#DDD6C6",
        hint: "#B7B1A3",
        wt: { DEFAULT: "#F4EFE2", ink: "#24365C" },
        bt: { DEFAULT: "#23262E", ink: "#F2EFE6" },
        stamp: "#D7263D",
        ok: "#1E8E5A",
        got: "#FCE8EA",
      },
    },
  },
  plugins: [],
};

export default config;
