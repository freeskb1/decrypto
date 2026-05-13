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
        sans: ["Pretendard", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
      },
      colors: {
        // 화이트팀: 채도 낮은 블루
        white_team: {
          DEFAULT: "#378ADD",
          bg: "#E8F2FB",
        },
        // 블랙팀: 차콜
        black_team: {
          DEFAULT: "#444441",
          bg: "#E8E8E6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
