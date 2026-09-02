import { issueSession, setSessionCookie, verifyPin } from "./_auth.js";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { member, pin } = req.body || {};
  if (!verifyPin(String(member || ""), String(pin || ""))) return res.status(401).json({ error: "PIN이 올바르지 않습니다." });
  setSessionCookie(res, issueSession(member));
  return res.status(200).json({ ok: true, member });
}
