// Who is using this browser tab. Sent to the server as X-Member-Id.
// Kept per tab (sessionStorage) so two tabs can act as two different roommates.

let memberId = "m_alex";
try { memberId = sessionStorage.getItem("roomie-member") || memberId; } catch { /* storage blocked */ }

export const getMemberId = () => memberId;

export function setMemberId(id) {
  memberId = id;
  try { sessionStorage.setItem("roomie-member", id); } catch { /* storage blocked */ }
}
