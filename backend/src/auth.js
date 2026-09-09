import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.warn("JWT_SECRET is not configured; authentication routes will return an error.");
}

export function createToken(user) {
  if (!secret) throw new Error("JWT_SECRET is not configured");
  return jwt.sign({ sub: user.id, email: user.email, displayName: user.display_name }, secret, { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const header = req.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token || !secret) return res.status(401).json({ error: "Authentication required" });
  try {
    req.user = jwt.verify(token, secret);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
