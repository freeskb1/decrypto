import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

export const metadata: Metadata = {
  title: "Decrypto",
  description: "암호를 전송하라. 들키지 말고.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <ToastProvider>{children}</ToastProvider>
        {/* 광배월드 공용 스크립트: 광배월드에서 온 경우에만 "광배월드" 버튼 + 방장 따라가기 */}
        <Script
          src="https://kwangbban.vercel.app/hub.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
