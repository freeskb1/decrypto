// 말랑월드(https://kwangbban.vercel.app)에서 넘어온 쿼리 읽기
// 예: /?room=4821&sid=xxx&uid=yyy&name=철수&host=1&hub=...
// hub.js(defer)가 window.KWANGBBAN을 늦게 채울 수 있으므로 location.search를 직접 읽는다.

export interface HubParams {
  room: string; // 말랑월드 방 번호 (숫자)
  sid: string; // 이번 판 id
  uid: string; // 말랑월드 계정 uid
  name: string; // 말랑월드 닉네임 (최대 6자)
  host: boolean; // 방장 여부
}

export function readHubParams(search: string): HubParams | null {
  const q = new URLSearchParams(search);
  const room = q.get("room") || "";
  const sid = q.get("sid") || "";
  if (!/^\d{1,10}$/.test(room) || !sid) return null;
  return {
    room,
    sid,
    uid: q.get("uid") || "",
    name: (q.get("name") || "").trim().slice(0, 12), // 게임 닉네임 최대 12자
    host: q.get("host") === "1",
  };
}

// 게임 DB의 방 키: h{room} (게임에서 직접 만든 push id 방과 겹치지 않음)
export function hubRoomId(room: string): string {
  return `h${room}`;
}

interface KwangbbanInfo {
  hub?: string;
  sid?: string;
}

// "말랑월드로" 버튼용 주소. 쿼리 → hub.js가 저장한 값(window.KWANGBBAN) 순서로 찾는다. 없으면 null
// 방장이 누르면 &end=sid 를 붙여 이번 판을 끝냄 → 모두 말랑월드 방으로 따라옴 (hub.js와 같은 방식)
export function hubReturnUrl(isHost: boolean): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  let hub = q.get("hub") || "";
  let sid = q.get("sid") || "";
  const w = window as unknown as { KWANGBBAN?: KwangbbanInfo };
  if (!hub && w.KWANGBBAN && w.KWANGBBAN.hub) {
    hub = w.KWANGBBAN.hub;
    sid = w.KWANGBBAN.sid || sid;
  }
  if (!hub) return null;
  return isHost && sid ? `${hub}&end=${encodeURIComponent(sid)}` : hub;
}

export function goToHub(isHost: boolean): void {
  const url = hubReturnUrl(isHost);
  if (!url) return;
  // 게임의 떠나기 경고가 이 값을 보고 건너뛰게 (hub.js와 같은 약속)
  (window as unknown as { KWANGBBAN_LEAVING?: boolean }).KWANGBBAN_LEAVING = true;
  try {
    sessionStorage.removeItem("kwangbban");
  } catch {
    // 무시
  }
  window.location.href = url;
}
