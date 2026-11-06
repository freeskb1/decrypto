import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import ConnectionBanner from "@/components/ConnectionBanner";

export const metadata: Metadata = {
  title: "Decrypto",
  description: "암호를 전송하라. 들키지 말고.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FBF8F1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Noto+Serif+KR:wght@700;900&family=IBM+Plex+Mono:wght@500;700&display=swap"
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
        <ConnectionBanner />
        {/* 말랑월드 공용 스크립트: 말랑월드에서 온 경우에만 "말랑월드" 버튼 + 방장 따라가기 */}
        <Script src="https://kwangbban.vercel.app/hub.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
