import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3, Bell, BookOpen, ChevronDown, CircleHelp, Grid2X2, Layers3, Menu, Plus, ScanLine, Search, Settings, Sparkles, TrendingUp, Trophy, Wallet, X } from "lucide-react";
import "./styles.css";
import "./auth.css";
import "./provider.css";

const cards = [
  { id: 1, name: "Charizard ex", set: "Obsidian Flames", number: "125/197", rarity: "Ultra Rare", price: 68.42, change: 12.4, color: "orange", image: "🔥" },
  { id: 2, name: "Mew ex", set: "151", number: "193/165", rarity: "Illustration Rare", price: 41.8, change: 5.8, color: "pink", image: "🧬" },
  { id: 3, name: "Umbreon VMAX", set: "Evolving Skies", number: "095/203", rarity: "Secret Rare", price: 281.0, change: -2.1, color: "purple", image: "🌙" },
  { id: 4, name: "Pikachu", set: "Crown Zenith", number: "GG30/GG70", rarity: "Galarian Gallery", price: 29.99, change: 8.7, color: "yellow", image: "⚡" }
];
const chartData = [{ day: "May 1", value: 8200 }, { day: "May 5", value: 8460 }, { day: "May 9", value: 8310 }, { day: "May 13", value: 9020 }, { day: "May 17", value: 9650 }, { day: "May 21", value: 10130 }, { day: "May 25", value: 10480 }, { day: "May 29", value: 11240 }];

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

function Dashboard({ user, onLogout }) {
  const [active, setActive] = useState("Overview");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [dark, setDark] = useState(true);
  const [portfolio, setPortfolio] = useState([]);
  const [summary, setSummary] = useState({ totalValue: 0, cardCount: 0 });
  const [chartData, setChartData] = useState([]);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [priceProvider, setPriceProvider] = useState("demo");
  const [priceProviders, setPriceProviders] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [catalogMeta, setCatalogMeta] = useState({ page: 1, totalPages: 1, total: 0 });
  const [catalogSet, setCatalogSet] = useState("");
  const [catalogRarity, setCatalogRarity] = useState("");
  const [trade, setTrade] = useState({ yours: [], theirs: [] });
  const [tradeResult, setTradeResult] = useState(null);
  const [scanFile, setScanFile] = useState(null);
  const [scanPreview, setScanPreview] = useState("");
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const token = localStorage.getItem("lumyntcg_token");
  React.useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([fetch(`${API_URL}/portfolio/cards`, { headers }), fetch(`${API_URL}/portfolio/summary`, { headers }), fetch(`${API_URL}/portfolio/history`, { headers })])
      .then(async ([cardsResponse, summaryResponse, historyResponse]) => {
        if (!cardsResponse.ok || !summaryResponse.ok || !historyResponse.ok) throw new Error("Unable to load portfolio");
        setPortfolio(await cardsResponse.json());
        setSummary(await summaryResponse.json());
        setChartData(await historyResponse.json());
      })
      .catch(error => console.error(error));
  }, [token]);
  React.useEffect(() => {
    fetch(`${API_URL}/prices/providers`).then(response => response.json()).then(setPriceProviders).catch(error => console.error(error));
  }, []);
  React.useEffect(() => {
    if (active !== "Card catalog") return;
    const params = new URLSearchParams({ search: query, set: catalogSet, rarity: catalogRarity, page: String(catalogMeta.page), limit: "12" });
    fetch(`${API_URL}/cards?${params}`)
      .then(async response => { if (!response.ok) throw new Error("Unable to load catalog"); return response.json(); })
      .then(data => { setCatalog(data.cards); setCatalogMeta({ page: data.page, totalPages: data.totalPages, total: data.total }); })
      .catch(error => console.error(error));
  }, [active, query, catalogSet, catalogRarity, catalogMeta.page]);
  async function addCard(cardId) {
    const response = await fetch(`${API_URL}/portfolio/cards`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ cardId, quantity: 1 }) });
    if (!response.ok) throw new Error("Unable to add card");
    const added = await response.json();
    setPortfolio(current => [added.card, ...current]);
    setShowAdd(false);
  }
  async function removeCard(id) {
    const response = await fetch(`${API_URL}/portfolio/cards/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error("Unable to remove card");
    setPortfolio(current => current.filter(card => card.id !== id));
  }
  async function refreshPrices() {
    setRefreshingPrices(true);
    try {
      const response = await fetch(`${API_URL}/prices/refresh`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ provider: priceProvider }) });
      if (!response.ok) throw new Error("Unable to refresh prices");
      window.location.reload();
    } catch (error) {
      console.error(error);
      setRefreshingPrices(false);
    }
  }
  async function analyzeTrade() {
    const response = await fetch(`${API_URL}/trades/analyze`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(trade) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setTradeResult(result);
  }
  function selectScanFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setScanFile(file);
    setScanResult(null);
    setScanPreview(URL.createObjectURL(file));
  }
  async function scanCard() {
    if (!scanFile) return;
    setScanning(true);
    try {
      const form = new FormData();
      form.append("image", scanFile);
      const response = await fetch(`${API_URL}/scanner/recognize`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setScanResult(result);
    } catch (error) {
      setScanResult({ error: error.message });
    } finally {
      setScanning(false);
    }
  }
  function toggleTrade(side, card) {
    setTrade(current => ({ ...current, [side]: current[side].some(item => item.id === card.id) ? current[side].filter(item => item.id !== card.id) : [...current[side], card] }));
    setTradeResult(null);
  }
  const filtered = useMemo(() => cards.filter(c => `${c.name} ${c.set}`.toLowerCase().includes(query.toLowerCase())), [query]);
  const nav = [
    { label: "Overview", icon: Grid2X2 }, { label: "My collection", icon: Wallet }, { label: "Card catalog", icon: BookOpen },
    { label: "Trade analyzer", icon: BarChart3 }, { label: "Scanner", icon: ScanLine }
  ];
  return <div className={dark ? "app" : "app light"}>
    <aside className="sidebar">
      <div className="brand"><img src="/lumyntcg-logo.png" alt="LumynTCG" /><span>Lumyn<span className="accent">TCG</span></span></div>
      <div className="workspace"><div className="avatar">LM</div><div><b>Luigi's collection</b><small>Personal workspace</small></div><ChevronDown size={15}/></div>
      <nav>{nav.map(({ label, icon: Icon }) => <button className={active === label ? "nav-item active" : "nav-item"} onClick={() => setActive(label)} key={label}><Icon size={18}/>{label}</button>)}</nav>
      <div className="side-label">MANAGE</div>
      <nav><button className="nav-item"><Layers3 size={18}/>Sets &amp; releases</button><button className="nav-item"><Trophy size={18}/>Wishlist</button></nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings size={18}/>Settings</button><button className="nav-item"><CircleHelp size={18}/>Help center</button><div className="upgrade"><Sparkles size={18}/><b>Unlock more insights</b><small>Try Lumyn Pro free for 14 days.</small><button>Explore Pro</button></div></div>
    </aside>
    <main>
      <header><button className="mobile-menu"><Menu size={20}/></button><div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{active}</strong></div><div className="header-actions"><div className="search"><Search size={17}/><input placeholder="Search cards, sets..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>⌘ K</kbd></div><button className="icon-btn"><Bell size={19}/><i/></button><button className="avatar" title="Log out" onClick={onLogout}>{(user.display_name || user.email).slice(0, 2).toUpperCase()}</button></div></header>
      <div className="content">
        <div className="page-title"><div><p className="eyebrow">SATURDAY, MAY 31, 2025</p><h1>{active === "Overview" ? `Good morning, ${user.display_name.split(" ")[0]}` : active}</h1><p className="muted">{active === "Overview" ? "Here's what's happening with your collection." : "Explore and manage your TCG collection."}</p></div><button className="primary" onClick={() => setShowAdd(true)}><Plus size={17}/> Add cards</button></div>
        {active === "Overview" && <><section className="stats"><Stat icon={Wallet} label="Portfolio value" value={`$${Number(summary.totalValue).toFixed(2)}`} change="+0.0%"/><Stat icon={TrendingUp} label="30d performance" value="+$0.00" change="No history yet"/><Stat icon={Layers3} label="Cards owned" value={summary.cardCount} change="Live portfolio"/><Stat icon={Trophy} label="Collection score" value="—" change="Add more cards" /></section>
          <section className="grid-two"><div className="panel chart-panel"><div className="panel-head"><div><h2>Portfolio performance</h2><p className="muted">Your collection value over time</p></div><div className="price-actions"><select value={priceProvider} onChange={event => setPriceProvider(event.target.value)}><option value="demo">Demo</option>{priceProviders.map(provider => <option key={provider.id} value={provider.id} disabled={!provider.configured}>{provider.label}{provider.configured ? "" : " (not configured)"}</option>)}</select><button className="link" onClick={refreshPrices}>{refreshingPrices ? "Updating..." : "Refresh prices"}</button></div></div><div className="chart-legend"><span><i className="dot blue"/>Portfolio value</span><strong>${Number(summary.totalValue).toFixed(2)} <small>live</small></strong></div>{chartData.length ? <ResponsiveContainer width="100%" height={245}><AreaChart data={chartData}><defs><linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c6cff" stopOpacity=".32"/><stop offset="100%" stopColor="#7c6cff" stopOpacity="0"/></linearGradient></defs><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#8990a5", fontSize: 11 }}/><YAxis hide domain={["dataMin - 500", "dataMax + 500"]}/><Tooltip contentStyle={{ background: "#191d2b", border: "1px solid #343a50", borderRadius: 10 }} formatter={v => [`$${v.toLocaleString()}`, "Value"]}/><Area type="monotone" dataKey="value" stroke="#8175ff" strokeWidth={3} fill="url(#fill)"/></AreaChart></ResponsiveContainer> : <div className="empty chart-empty">Add cards to see your price trend.</div>}</div><div className="panel"><div className="panel-head"><div><h2>Top performers</h2><p className="muted">Current market prices</p></div><button className="link">View all</button></div>{cards.slice(0, 3).map(c => <CardRow key={c.id} card={c}/>)}</div></section>
          <section className="grid-two lower"><div className="panel"><div className="panel-head"><div><h2>Recently added</h2><p className="muted">Latest cards in your collection</p></div><button className="link" onClick={() => setActive("My collection")}>View collection</button></div><div className="card-grid">{portfolio.slice(0, 3).map(c => <CardTile key={c.id} card={c} onRemove={removeCard}/>)}</div>{portfolio.length === 0 && <p className="muted">Your collection is empty. Add your first card.</p>}</div><div className="panel insights"><div className="panel-head"><div><h2>Collection insights</h2><p className="muted">Personalized tips for you</p></div><Sparkles size={18} color="#a49aff"/></div><div className="insight"><div className="insight-icon purple-bg">↗</div><div><b>Build your first collection</b><p className="muted">Add cards to unlock portfolio trends.</p></div></div></div></section>
        </>}
        {active === "My collection" && <section className="panel catalog-panel"><div className="panel-head"><div><h2>Your cards</h2><p className="muted">Stored in your PostgreSQL portfolio</p></div><button className="primary" onClick={() => setShowAdd(true)}><Plus size={15}/> Add cards</button></div><div className="catalog-grid">{portfolio.map(c => <CardTile key={c.id} card={c} onRemove={removeCard}/>)}</div>{portfolio.length === 0 && <div className="empty">No cards in your collection yet.</div>}</section>}
        {active === "Trade analyzer" && <section className="trade-layout"><div className="panel trade-panel"><div className="panel-head"><div><h2>Compare trade value</h2><p className="muted">Select cards on each side to calculate fairness.</p></div><BarChart3 size={19} color="#a49aff"/></div><div className="trade-columns"><TradeSide title="You give" side="yours" selected={trade.yours} cards={cards} onToggle={toggleTrade}/><div className="trade-vs">VS</div><TradeSide title="You receive" side="theirs" selected={trade.theirs} cards={cards} onToggle={toggleTrade}/></div><button className="primary analyze-btn" onClick={analyzeTrade}>Analyze trade</button>{tradeResult && <div className={`trade-result ${tradeResult.fairness >= 85 ? "good" : tradeResult.fairness >= 60 ? "warn" : "bad"}`}><div><span>Trade fairness</span><strong>{tradeResult.fairness}%</strong></div><div><b>{tradeResult.verdict}</b><small>You give ${tradeResult.yours.toFixed(2)} · You receive ${tradeResult.theirs.toFixed(2)} · Difference ${Math.abs(tradeResult.difference).toFixed(2)}</small></div></div>}</div></section>}
        {active === "Scanner" && <section className="scanner-layout"><div className="panel scanner-panel"><div className="panel-head"><div><h2>Scan a card</h2><p className="muted">Upload a clear front image to identify the card.</p></div><ScanLine size={19} color="#a49aff"/></div><label className="scan-drop">{scanPreview ? <img src={scanPreview} alt="Card preview"/> : <><ScanLine size={36}/><b>Drop an image here</b><small>JPG, PNG or WebP · max 8MB</small></>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectScanFile}/></label><button className="primary analyze-btn" disabled={!scanFile || scanning} onClick={scanCard}>{scanning ? "Analyzing..." : "Identify card"}</button></div>{scanResult && <div className="panel scan-result">{scanResult.error ? <div className="auth-error">{scanResult.error}</div> : <><p className="eyebrow">MATCH FOUND · {Math.round(scanResult.confidence * 100)}% CONFIDENCE</p><h2>{scanResult.card.name}</h2><p className="muted">{scanResult.card.set} · {scanResult.card.number}</p><div className="scan-price">${scanResult.card.price.toFixed(2)} <small>latest market price</small></div><button className="primary" onClick={() => addCard(scanResult.card.id)}>Add to collection</button></>}</div>}</section>}
        {active === "Card catalog" && <section className="panel catalog-panel"><div className="filter-row"><div className="tabs"><button className={catalogRarity ? "tab" : "tab active"} onClick={() => { setCatalogRarity(""); setCatalogMeta({ ...catalogMeta, page: 1 }); }}>All cards</button><button className={catalogRarity === "Ultra Rare" ? "tab active" : "tab"} onClick={() => { setCatalogRarity("Ultra Rare"); setCatalogMeta({ ...catalogMeta, page: 1 }); }}>Ultra Rare</button><button className={catalogRarity === "Illustration Rare" ? "tab active" : "tab"} onClick={() => { setCatalogRarity("Illustration Rare"); setCatalogMeta({ ...catalogMeta, page: 1 }); }}>Illustration Rare</button></div><select value={catalogSet} onChange={event => { setCatalogSet(event.target.value); setCatalogMeta({ ...catalogMeta, page: 1 }); }}><option value="">All sets</option><option value="SV151">151</option><option value="OBF">Obsidian Flames</option><option value="EVS">Evolving Skies</option></select></div><div className="catalog-count muted">{catalogMeta.total} cards found</div><div className="catalog-grid">{catalog.map(c => <CardTile key={c.id} card={c}/>)}</div>{catalog.length === 0 && <div className="empty">No cards found. Try another search.</div>}<div className="pagination"><button className="tab" disabled={catalogMeta.page <= 1} onClick={() => setCatalogMeta({ ...catalogMeta, page: catalogMeta.page - 1 })}>Previous</button><span className="muted">Page {catalogMeta.page} of {catalogMeta.totalPages || 1}</span><button className="tab" disabled={catalogMeta.page >= catalogMeta.totalPages} onClick={() => setCatalogMeta({ ...catalogMeta, page: catalogMeta.page + 1 })}>Next</button></div></section>}
      </div>
    </main>
    {showAdd && <div className="modal-backdrop" onClick={() => setShowAdd(false)}><div className="modal" onClick={e => e.stopPropagation()}><button className="close" onClick={() => setShowAdd(false)}><X size={18}/></button><div className="modal-icon"><Plus size={22}/></div><h2>Add cards to collection</h2><p className="muted">Choose a card from the catalog.</p><div className="quick-add">{cards.map(c => <button key={c.id} onClick={() => addCard(c.id)}><span className={`mini-art ${c.color}`}>{c.image}</span><span><b>{c.name}</b><small>{c.set} · ${c.price}</small></span><Plus size={17}/></button>)}</div></div></div>}
  </div>;
}
function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", displayName: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to authenticate");
      localStorage.setItem("lumyntcg_token", data.token);
      onAuthenticated(data.user);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }
  return <div className="auth-page"><div className="auth-glow"/><div className="auth-card"><div className="brand auth-brand"><img src="/lumyntcg-logo.png" alt="LumynTCG" /><span>Lumyn<span className="accent">TCG</span></span></div><p className="eyebrow">YOUR COLLECTION, ELEVATED</p><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p className="muted">{mode === "login" ? "Sign in to continue to your collection." : "Start tracking your collection in minutes."}</p><form onSubmit={submit}>{mode === "register" && <label>Display name<input required value={form.displayName} onChange={e => setForm({ ...form, displayName: e.target.value })} placeholder="Luigi Collector"/></label>}<label>Email<input required type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com"/></label><label>Password<input required minLength={8} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters"/></label>{error && <div className="auth-error">{error}</div>}<button className="primary auth-submit" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}</button></form><p className="auth-switch">{mode === "login" ? "Don't have an account?" : "Already have an account?"} <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}> {mode === "login" ? "Create one" : "Sign in"}</button></p></div></div>;
}
function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  React.useEffect(() => {
    const token = localStorage.getItem("lumyntcg_token");
    if (!token) { setChecking(false); return; }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => { if (!response.ok) throw new Error("Session expired"); return response.json(); })
      .then(data => setUser(data.user))
      .catch(() => localStorage.removeItem("lumyntcg_token"))
      .finally(() => setChecking(false));
  }, []);
  if (checking) return <div className="auth-loading">Loading LumynTCG...</div>;
  if (!user) return <AuthScreen onAuthenticated={setUser}/>;
  return <Dashboard user={user} onLogout={() => { localStorage.removeItem("lumyntcg_token"); setUser(null); }}/>;
}
function Stat({ icon: Icon, label, value, change }) { return <div className="stat"><div className="stat-icon"><Icon size={18}/></div><p>{label}</p><h2>{value}</h2><small className={change.startsWith("+") ? "positive" : ""}>{change.startsWith("+") ? "↗ " : ""}{change}</small></div>; }
function CardRow({ card }) { return <div className="card-row"><div className={`mini-art ${card.color}`}>{card.image}</div><div className="card-name"><b>{card.name}</b><small>{card.set}</small></div><strong>${card.price.toFixed(2)}</strong><small className={card.change > 0 ? "positive" : "negative"}>{card.change > 0 ? "↗" : "↘"} {Math.abs(card.change)}%</small></div>; }
function CardTile({ card, onRemove }) { const source = cards.find(item => item.id === card.cardId) || card; return <div className="card-tile"><div className={`art ${source.color || "purple"}`}><span>{source.image || "🃏"}</span><label>{card.rarity}</label></div><div className="tile-info"><b>{card.name}</b><small>{card.set} · {card.number}</small><div><strong>${Number(card.price || 0).toFixed(2)}</strong>{onRemove ? <button className="remove-card" onClick={() => onRemove(card.id)}>Remove</button> : <em className={card.change > 0 ? "positive" : "negative"}>{card.change > 0 ? "+" : ""}{card.change}%</em>}</div></div></div>; }
function TradeSide({ title, side, selected, cards, onToggle }) { return <div className="trade-side"><h3>{title}<strong>${selected.reduce((total, card) => total + card.price, 0).toFixed(2)}</strong></h3>{cards.map(card => <button className={selected.some(item => item.id === card.id) ? "trade-card selected" : "trade-card"} onClick={() => onToggle(side, card)} key={card.id}><span className={`mini-art ${card.color}`}>{card.image}</span><span><b>{card.name}</b><small>{card.set}</small></span><span className="trade-price">${card.price.toFixed(2)}</span></button>)}</div>; }
createRoot(document.getElementById("root")).render(<App />);
