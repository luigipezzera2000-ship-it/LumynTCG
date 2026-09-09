const providerConfig = {
  tcgplayer: {
    label: "TCGPlayer",
    configured: Boolean(process.env.TCGPLAYER_CLIENT_ID && process.env.TCGPLAYER_CLIENT_SECRET),
    source: "tcgplayer"
  },
  cardmarket: {
    label: "CardMarket",
    configured: Boolean(process.env.CARDMARKET_API_URL && process.env.CARDMARKET_API_TOKEN),
    source: "cardmarket"
  }
};

export function getProviderStatus() {
  return Object.entries(providerConfig).map(([id, config]) => ({ id, label: config.label, configured: config.configured }));
}

async function tcgPlayerQuote(card) {
  const tokenResponse = await fetch("https://api.tcgplayer.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env.TCGPLAYER_CLIENT_ID,
      client_secret: process.env.TCGPLAYER_CLIENT_SECRET
    })
  });
  if (!tokenResponse.ok) throw new Error(`TCGPlayer token request failed (${tokenResponse.status})`);
  const token = await tokenResponse.json();
  const search = await fetch(`https://api.tcgplayer.com/catalog/products?from=0&size=10&search=${encodeURIComponent(card.name)}`, { headers: { Authorization: `bearer ${token.access_token}` } });
  if (!search.ok) throw new Error(`TCGPlayer catalog request failed (${search.status})`);
  const products = await search.json();
  const product = products.results?.find(item => item.name.toLowerCase() === card.name.toLowerCase()) || products.results?.[0];
  if (!product) return null;
  const prices = await fetch(`https://api.tcgplayer.com/pricing/product/${product.productId}`, { headers: { Authorization: `bearer ${token.access_token}` } });
  if (!prices.ok) throw new Error(`TCGPlayer pricing request failed (${prices.status})`);
  const pricing = await prices.json();
  const market = pricing.results?.map(item => Number(item.marketPrice)).find(value => Number.isFinite(value) && value > 0);
  return market ? { price: market, source: "tcgplayer" } : null;
}

async function cardMarketQuote(card) {
  const response = await fetch(`${process.env.CARDMARKET_API_URL.replace(/\/$/, "")}/cards?search=${encodeURIComponent(card.name)}`, {
    headers: { Authorization: `Bearer ${process.env.CARDMARKET_API_TOKEN}`, Accept: "application/json" }
  });
  if (!response.ok) throw new Error(`CardMarket request failed (${response.status})`);
  const payload = await response.json();
  const match = payload.cards?.find(item => item.name?.toLowerCase() === card.name.toLowerCase()) || payload.results?.[0];
  const price = Number(match?.price ?? match?.trendPrice ?? match?.avg);
  return Number.isFinite(price) && price > 0 ? { price, source: "cardmarket" } : null;
}

export async function quoteCard(card, provider = "demo") {
  if (provider === "tcgplayer" && providerConfig.tcgplayer.configured) return tcgPlayerQuote(card);
  if (provider === "cardmarket" && providerConfig.cardmarket.configured) return cardMarketQuote(card);
  return { price: Number(card.price), source: "demo" };
}
