// 규칙 설명 (규칙 페이지 + 게임 시작 전 안내에서 같이 씀)

export const CLUE_BANS: { title: string; example: string; auto?: boolean }[] = [
  { title: "키워드 자체", example: '"사과"에 "사과" / "사 과"', auto: true },
  { title: "이미 쓴 단서 다시 쓰기", example: "우리 팀이 한 번 쓴 단서는 게임 내내 못 써요", auto: true },
  { title: "한 번에 같은 단서 두 번", example: '"빨강", "빨강", "과일"', auto: true },
  { title: "철자·자모 힌트", example: '"ㅅ으로 시작" / "받침 없음"' },
  { title: "글자 수", example: '"두 글자" / "2"' },
  { title: "화면상 위치·번호", example: '"삼총사"로 3번 키워드 암시' },
  { title: "발음 비슷한 말", example: '"사고"로 "사과" 암시' },
  { title: "외국어 번역", example: '"Apple" / "りんご"' },
];

export function ClueBanList() {
  return (
    <div className="bg-white border-[1.5px] border-line rounded-2xl py-1">
      {CLUE_BANS.map((f, i) => (
        <div
          key={i}
          className={`px-3.5 py-2.5 ${i < CLUE_BANS.length - 1 ? "border-b border-line" : ""}`}
        >
          <div className="flex items-center gap-2">
            <span className="text-stamp font-black">✕</span>
            <span className="text-[14px] font-bold">{f.title}</span>
            {f.auto && (
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-wt text-wt-ink">
                자동 차단
              </span>
            )}
          </div>
          <div className="text-xs text-muted pl-[22px] mt-0.5">{f.example}</div>
        </div>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border-[1.5px] border-line rounded-2xl px-4 py-3">
      <div className="font-serif font-black text-[17px] mb-1.5">{title}</div>
      <div className="text-[13px] leading-relaxed text-ink/90">{children}</div>
    </div>
  );
}

export function FullRules() {
  return (
    <div className="flex flex-col gap-3">
      <Section title="인원과 준비">
        <p>
          <b>4~8명</b>이 두 팀(흰팀·검은팀)으로 나뉘어요. 모두 같은 방에서 각자 폰으로 하고, 의논은
          소리 내어 해요. 3명은 팀을 고르게 나눌 수 없어 지원하지 않아요.
        </p>
        <p className="mt-1.5">각 팀은 비밀 키워드 4개(1~4번)를 받아요. 게임 내내 바뀌지 않아요.</p>
      </Section>

      <Section title="한 라운드 순서">
        <ol className="list-decimal pl-5 space-y-1">
          <li>
            양 팀 <b>암호전달자</b>가 동시에 3자리 암호(예: 3·1·4)를 받고, 각 숫자의 키워드를 떠올리게 할
            단서 3개를 써요. 한 사람이 먼저 확정하면 다른 사람은 <b>30초</b> 안에 확정해야 해요
            (0초가 되면 모두에게 &quot;시간 종료&quot;가 떠요).
          </li>
          <li>
            <b>우리 팀 해독</b>: 두 팀이 <b>동시에</b> 자기 팀 단서를 보고 우리 암호를 맞혀요. 이때 상대 팀 단서는
            안 보여요.
          </li>
          <li>
            <b>상대 팀 가로채기</b>(2라운드부터): 두 팀 다 해독을 내면, 서로 상대 팀 단서가 전달돼요. 두 팀이{" "}
            <b>동시에</b> 상대 암호를 맞혀요.
          </li>
          <li>두 팀 다 가로채기를 내면 <b>두 팀 결과를 같이 공개</b>하고 라운드 끝 판정</li>
        </ol>
        <p className="mt-1.5 text-muted">
          1라운드는 정보가 없어서 가로채기를 하지 않아요. 팀 답은 팀원 누구나 고칠 수 있고(모두 같은 답안을
          봐요), 한 번 제출하면 끝이에요. 암호전달자는 해독 답을 낼 수 없고, 단서를 낸 뒤에는 말하지
          않아요.
        </p>
      </Section>

      <Section title="토큰">
        <ul className="list-disc pl-5 space-y-0.5">
          <li>상대 암호를 정확히 맞히면 <b>가로채기</b> +1</li>
          <li>우리 팀 해독이 틀리면 <b>해독 실패</b> +1</li>
        </ul>
      </Section>

      <Section title="승패 (라운드가 끝날 때만 판정)">
        <ul className="list-disc pl-5 space-y-0.5">
          <li>가로채기 2개를 모은 팀이 승리</li>
          <li>해독 실패 2개를 모은 팀이 패배</li>
          <li>
            두 팀이 동시에 조건을 채웠거나, 8라운드가 끝나도 승부가 안 나면 <b>점수 = 가로채기 − 해독 실패</b>로
            비교
          </li>
          <li>점수도 같으면 각 팀이 상대 키워드 4개를 맞혀요. 더 많이 맞힌 팀 승리</li>
          <li>그것도 같으면 공동 승리</li>
        </ul>
      </Section>

      <Section title="단서로 쓰면 안 되는 것">
        <ClueBanList />
        <p className="mt-2 text-muted">키워드의 뜻·연상·관련된 것만 단서가 될 수 있어요. 예: 사과 → 빨강, 뉴턴, 백설공주</p>
      </Section>
    </div>
  );
}
