"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Screen, PageHead } from "@/components/game/ui";
import { FullRules } from "@/components/game/RulesContent";

export default function RulesPage() {
  const router = useRouter();
  return (
    <Screen>
      <PageHead
        title="게임 규칙"
        left={
          <button className="p-1 -ml-1" onClick={() => router.back()} aria-label="뒤로">
            <ArrowLeft className="w-5 h-5" />
          </button>
        }
      />
      <div className="px-4 py-4">
        <p className="text-[13px] text-muted mb-3">
          우리 팀끼리만 통하는 단서로 암호를 전하고, 상대 팀 암호는 가로채세요.
        </p>
        <FullRules />
      </div>
    </Screen>
  );
}
