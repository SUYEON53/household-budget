export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { items } = req.body;
    // items: [{ticker, exchange, currency, name}]
    const results = [];

    for (const item of items) {
      try {
        const price = await fetchPrice(item);
        if (price !== null) {
          results.push({ ticker: item.ticker, price, currency: item.currency });
        }
      } catch(e) {
        console.log(`Failed ${item.ticker}:`, e.message);
      }
    }

    res.status(200).json({ prices: results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}

async function fetchPrice({ ticker, exchange, currency, name }) {
  // Yahoo Finance API (무료, CORS 없음)
  const yExchange = getYahooSuffix(exchange, currency);
  const symbol = ticker + yExchange;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });

  if (!resp.ok) {
    // KRX는 .KS 시도
    if (exchange === 'KRX' && !yExchange.includes('KS')) {
      const url2 = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}.KS?interval=1d&range=1d`;
      const r2 = await fetch(url2, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r2.ok) {
        const d2 = await r2.json();
        return extractPrice(d2);
      }
    }
    return null;
  }

  const data = await resp.json();
  return extractPrice(data);
}

function extractPrice(data) {
  try {
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    // regularMarketPrice 또는 previousClose
    return meta.regularMarketPrice || meta.previousClose || null;
  } catch(e) {
    return null;
  }
}

function getYahooSuffix(exchange, currency) {
  if (currency === 'USD') return '';  // 미국 주식은 suffix 없음
  if (exchange === 'KRX' || exchange === 'ETF') return '.KS';
  if (exchange === 'KOSDAQ') return '.KQ';
  if (currency === 'JPY') return '.T';
  return '';
}
