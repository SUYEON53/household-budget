export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { items } = req.body;
    const results = [];
    for (const item of items) {
      try {
        const price = await fetchPrice(item);
        if (price !== null) results.push({ ticker: item.ticker, price, currency: item.currency });
      } catch(e) { console.log(`Failed ${item.ticker}:`, e.message); }
    }
    res.status(200).json({ prices: results });
  } catch(e) { res.status(500).json({ error: e.message }); }
}

async function fetchPrice({ ticker, exchange, currency }) {
  const suffixes = getSuffixes(exchange, currency);
  for (const suffix of suffixes) {
    const symbol = ticker + suffix;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) continue;
    const data = await resp.json();
    const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
    if (price) return price;
  }
  return null;
}

function getSuffixes(exchange, currency) {
  if (currency === 'USD') return ['', ''];
  if (exchange === 'KRX' || exchange === 'ETF') return ['.KS', '.KQ'];
  if (currency === 'JPY') return ['.T'];
  return ['', '.KS'];
}
