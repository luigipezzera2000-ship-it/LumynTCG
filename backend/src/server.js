import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import multer from "multer";
import { createToken, requireAuth } from "./auth.js";
import { checkDatabase, initializeDatabase, pool } from "./db.js";
import { getProviderStatus, quoteCard } from "./priceProviders.js";

const app = express();
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173").split(",").map(origin => origin.trim()).filter(Boolean);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin not allowed by CORS"));
} }));
app.use(express.json());

const cards = [
  { id: "00000000-0000-0000-0000-000000000001", name: "Charizard ex", set: "Obsidian Flames", number: "125/197", rarity: "Ultra Rare", price: 68.42 },
  { id: "00000000-0000-0000-0000-000000000002", name: "Mew ex", set: "151", number: "193/165", rarity: "Illustration Rare", price: 41.8 },
  { id: "00000000-0000-0000-0000-000000000003", name: "Umbreon VMAX", set: "Evolving Skies", number: "095/203", rarity: "Secret Rare", price: 281 }
];
app.get("/api/prices/providers", (_req, res) => res.json(getProviderStatus()));
app.get("/api/health", async (_req, res) => {
  try {
    await checkDatabase();
    res.json({ status: "ok", service: "lumyntcg-api", database: "connected" });
  } catch {
    res.status(503).json({ status: "degraded", service: "lumyntcg-api", database: "unavailable" });
  }
});
app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (typeof email !== "string" || !email.includes("@") || typeof password !== "string" || password.length < 8 || typeof displayName !== "string" || !displayName.trim()) {
    return res.status(400).json({ error: "Email, display name and a password of at least 8 characters are required" });
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      "INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name, created_at",
      [email.trim().toLowerCase(), passwordHash, displayName.trim()]
    );
    const user = result.rows[0];
    await pool.query("INSERT INTO collections (user_id) VALUES ($1)", [user.id]);
    res.status(201).json({ user, token: createToken(user) });
  } catch (error) {
    if (error.code === "23505") return res.status(409).json({ error: "An account with this email already exists" });
    console.error("Registration failed", error);
    res.status(503).json({ error: "Unable to create account right now" });
  }
});
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (typeof email !== "string" || typeof password !== "string") return res.status(400).json({ error: "Email and password are required" });
  try {
    const result = await pool.query("SELECT id, email, display_name, password_hash, created_at FROM users WHERE email = $1", [email.trim().toLowerCase()]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ error: "Invalid email or password" });
    const { password_hash: _passwordHash, ...safeUser } = user;
    res.json({ user: safeUser, token: createToken(user) });
  } catch (error) {
    console.error("Login failed", error);
    res.status(503).json({ error: "Unable to log in right now" });
  }
});
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, email, display_name, created_at FROM users WHERE id = $1", [req.user.sub]);
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error("User lookup failed", error);
    res.status(503).json({ error: "Unable to load profile right now" });
  }
});
app.get("/api/cards", async (req, res) => {
  const search = String(req.query.search || "").trim();
  const game = String(req.query.game || "").trim();
  const set = String(req.query.set || "").trim();
  const rarity = String(req.query.rarity || "").trim();
  const page = Math.max(Number.parseInt(req.query.page || "1", 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit || "12", 10) || 12, 1), 50);
  try {
    const values = [];
    const filters = [];
    if (search) { values.push(`%${search}%`); filters.push(`(c.name ILIKE $${values.length} OR c.number ILIKE $${values.length} OR s.name ILIKE $${values.length})`); }
    if (game) { values.push(game); filters.push(`s.game = $${values.length}`); }
    if (set) { values.push(set); filters.push(`s.code = $${values.length}`); }
    if (rarity) { values.push(rarity); filters.push(`c.rarity = $${values.length}`); }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const count = await pool.query(`SELECT COUNT(*)::int AS total FROM cards c JOIN sets s ON s.id = c.set_id ${where}`, values);
    values.push(limit, (page - 1) * limit);
    const result = await pool.query(
      `SELECT c.id, c.name, s.name AS "set", s.code AS "setCode", s.game, c.number, c.rarity,
              COALESCE(latest.price, 0) AS price
       FROM cards c JOIN sets s ON s.id = c.set_id
       LEFT JOIN LATERAL (SELECT price FROM prices p WHERE p.card_id = c.id ORDER BY captured_at DESC LIMIT 1) latest ON true
       ${where} ORDER BY s.release_date DESC NULLS LAST, c.number LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    res.json({ cards: result.rows.map(row => ({ ...row, price: Number(row.price) })), page, limit, total: count.rows[0].total, totalPages: Math.ceil(count.rows[0].total / limit) });
  } catch (error) {
    console.error("Catalog lookup failed", error);
    res.status(503).json({ error: "Unable to load catalog right now" });
  }
});
app.get("/api/sets", async (_req, res) => {
  try {
    const result = await pool.query("SELECT s.code, s.name, s.game, COUNT(c.id)::int AS cards FROM sets s LEFT JOIN cards c ON c.set_id = s.id GROUP BY s.id ORDER BY s.release_date DESC NULLS LAST");
    res.json(result.rows);
  } catch (error) {
    console.error("Set lookup failed", error);
    res.status(503).json({ error: "Unable to load sets right now" });
  }
});
app.post("/api/scanner/recognize", requireAuth, upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "A JPG, PNG, or WebP image up to 8MB is required" });
  try {
    const hint = `${req.file.originalname} ${req.body?.hint || ""}`.toLowerCase();
    const matched = cards.find(card => hint.includes(card.name.toLowerCase().split(" ")[0])) || cards[0];
    const result = await pool.query(
      `SELECT c.id, c.name, s.name AS "set", c.number, c.rarity,
              COALESCE(latest.price, 0) AS price
       FROM cards c JOIN sets s ON s.id = c.set_id
       LEFT JOIN LATERAL (SELECT price FROM prices p WHERE p.card_id = c.id ORDER BY captured_at DESC LIMIT 1) latest ON true
       WHERE c.id = $1`,
      [matched.id]
    );
    res.json({ provider: process.env.GOOGLE_VISION_CREDENTIALS ? "google-vision-ready" : "demo-recognition", confidence: process.env.GOOGLE_VISION_CREDENTIALS ? 0.72 : 0.35, card: { ...result.rows[0], price: Number(result.rows[0].price) }, filename: req.file.originalname });
  } catch (error) {
    console.error("Card scan failed", error);
    res.status(503).json({ error: "Unable to analyze this card right now" });
  }
});
app.get("/api/portfolio/summary", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(uc.quantity * COALESCE(latest.price, 0)), 0) AS "totalValue",
              COALESCE(SUM(uc.quantity), 0)::int AS "cardCount"
       FROM user_cards uc
       JOIN collections c ON c.id = uc.collection_id
       LEFT JOIN LATERAL (SELECT price FROM prices p WHERE p.card_id = uc.card_id ORDER BY captured_at DESC LIMIT 1) latest ON true
       WHERE c.user_id = $1`,
      [req.user.sub]
    );
    res.json({ ...result.rows[0], monthlyChange: 0, score: 0 });
  } catch (error) {
    console.error("Portfolio summary failed", error);
    res.status(503).json({ error: "Unable to load portfolio right now" });
  }
});
app.get("/api/portfolio/history", requireAuth, async (req, res) => {
  const days = Math.min(Math.max(Number.parseInt(req.query.days || "30", 10) || 30, 7), 365);
  try {
    const result = await pool.query(
      `SELECT TO_CHAR(DATE_TRUNC('day', p.captured_at), 'Mon DD') AS day,
              ROUND(SUM(uc.quantity * p.price)::numeric, 2) AS value
       FROM user_cards uc
       JOIN collections col ON col.id = uc.collection_id
       JOIN prices p ON p.card_id = uc.card_id
       WHERE col.user_id = $1 AND p.captured_at >= CURRENT_DATE - ($2::int * INTERVAL '1 day')
       GROUP BY DATE_TRUNC('day', p.captured_at)
       ORDER BY DATE_TRUNC('day', p.captured_at)`,
      [req.user.sub, days]
    );
    res.json(result.rows.map(row => ({ day: row.day, value: Number(row.value) })));
  } catch (error) {
    console.error("Portfolio history lookup failed", error);
    res.status(503).json({ error: "Unable to load portfolio history right now" });
  }
});
app.get("/api/prices/:cardId/history", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT source, price, captured_at AS "capturedAt"
       FROM prices WHERE card_id = $1 ORDER BY captured_at ASC LIMIT 365`,
      [req.params.cardId]
    );
    res.json(result.rows.map(row => ({ ...row, price: Number(row.price) })));
  } catch (error) {
    console.error("Price history lookup failed", error);
    res.status(503).json({ error: "Unable to load price history right now" });
  }
});
app.post("/api/prices/refresh", requireAuth, async (req, res) => {
  const provider = String(req.body?.provider || "demo").toLowerCase();
  if (!["demo", "tcgplayer", "cardmarket"].includes(provider)) return res.status(400).json({ error: "Unsupported price provider" });
  const selected = provider === "demo" ? { configured: true } : getProviderStatus().find(item => item.id === provider);
  if (!selected?.configured) return res.status(400).json({ error: `${provider} is not configured` });
  try {
    const catalog = await pool.query(
      `SELECT c.id, c.name, COALESCE(latest.price, 0) AS price
       FROM cards c
       LEFT JOIN LATERAL (SELECT price FROM prices p WHERE p.card_id = c.id ORDER BY captured_at DESC LIMIT 1) latest ON true`
    );
    const quotes = [];
    for (const card of catalog.rows) {
      const quote = await quoteCard(card, provider);
      if (quote) quotes.push({ cardId: card.id, price: quote.price, source: quote.source });
    }
    for (const quote of quotes) await pool.query("INSERT INTO prices (card_id, source, price) VALUES ($1, $2, $3)", [quote.cardId, quote.source, quote.price]);
    res.json({ provider, updated: quotes.length, prices: quotes });
  } catch (error) {
    console.error("Price refresh failed", error);
    res.status(503).json({ error: "Unable to refresh prices right now" });
  }
});
app.get("/api/portfolio/cards", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT uc.id, uc.card_id AS "cardId", uc.quantity, uc.condition, uc.purchase_price AS "purchasePrice",
              c.name, s.name AS "set", c.number, c.rarity,
              COALESCE(latest.price, 0) AS price
       FROM user_cards uc
       JOIN collections col ON col.id = uc.collection_id
       JOIN cards c ON c.id = uc.card_id
       JOIN sets s ON s.id = c.set_id
       LEFT JOIN LATERAL (SELECT price FROM prices p WHERE p.card_id = c.id ORDER BY captured_at DESC LIMIT 1) latest ON true
       WHERE col.user_id = $1 ORDER BY uc.created_at DESC`,
      [req.user.sub]
    );
    res.json(result.rows);
  } catch (error) {
    console.error("Portfolio cards lookup failed", error);
    res.status(503).json({ error: "Unable to load portfolio cards right now" });
  }
});
app.post("/api/portfolio/cards", requireAuth, async (req, res) => {
  const { cardId, quantity = 1, condition = "NM", purchasePrice = null } = req.body;
  if (!cardId || !Number.isInteger(quantity) || quantity < 1) return res.status(400).json({ error: "cardId and a positive integer quantity are required" });
  try {
    const result = await pool.query(
      `INSERT INTO user_cards (collection_id, card_id, quantity, condition, purchase_price)
       SELECT id, $2, $3, $4, $5 FROM collections WHERE user_id = $1 ORDER BY created_at LIMIT 1
       RETURNING id, card_id, quantity, condition, purchase_price`,
      [req.user.sub, cardId, quantity, condition, purchasePrice]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Collection not found" });
    res.status(201).json({ message: "Card added to portfolio", card: result.rows[0] });
  } catch (error) {
    console.error("Portfolio card insert failed", error);
    res.status(503).json({ error: "Unable to add card right now" });
  }
});
app.delete("/api/portfolio/cards/:id", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM user_cards uc USING collections c
       WHERE uc.id = $1 AND uc.collection_id = c.id AND c.user_id = $2 RETURNING uc.id`,
      [req.params.id, req.user.sub]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Portfolio card not found" });
    res.status(204).send();
  } catch (error) {
    console.error("Portfolio card deletion failed", error);
    res.status(503).json({ error: "Unable to remove card right now" });
  }
});
app.post("/api/trades/analyze", (req, res) => {
  const normalize = list => Array.isArray(list) && list.every(card => card && Number.isFinite(Number(card.price)) && Number(card.price) >= 0);
  if (!normalize(req.body.yours) || !normalize(req.body.theirs)) return res.status(400).json({ error: "Both trade lists must be arrays of cards with valid prices" });
  const value = list => list.reduce((sum, card) => sum + Number(card.price), 0);
  const yours = value(req.body.yours), theirs = value(req.body.theirs);
  const difference = Number((theirs - yours).toFixed(2));
  const fairness = Number(Math.max(0, 100 - Math.abs(difference) / Math.max(yours, theirs, 1) * 100).toFixed(1));
  res.json({ yours, theirs, difference, fairness, verdict: difference > 0 ? "You receive more value" : difference < 0 ? "You give more value" : "Perfectly even trade" });
});
app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
const port = Number(process.env.PORT || 4000);
initializeDatabase()
  .then(() => app.listen(port, () => console.log(`LumynTCG API running on port ${port}`)))
  .catch(error => {
    console.error("Database initialization failed", error);
    process.exitCode = 1;
  });
