// 한국투자증권 오픈API 시세 조회
const KIS_BASE = 'https://openapi.koreainvestment.com:9443';
let cachedToken = null;
let tokenExpiry = 0;

async function getToken(appKey, appSecret) {
  // 토큰 캐시 (30분)
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('토큰 발급 실패: ' + JSON.stringify(data));
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + 25 * 60 * 1000; // 25분
  return cachedToken;
}

async function getKRPrice(ticker, token, appKey, appSecret) {
  // 국내주식/ETF 현재가
  const res = await fetch(
    `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?fid_cond_mrkt_div_code=J&fid_input_iscd=${ticker}`,
    {
      headers: {
        'authorization': `Bearer ${token}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'FHKST01010100',
        'custtype': 'P',
      },
    }
  );
  const data = await res.json();
  const price = data?.output?.stck_prpr;
  return price ? parseFloat(price) : null;
}

async function getUSPrice(ticker, token, appKey, appSecret) {
  // 해외주식 현재가 (미국)
  const res = await fetch(
    `${KIS_BASE}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=NAS&SYMB=${ticker}`,
    {
      headers: {
        'authorization': `Bearer ${token}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'HHDFS00000300',
        'custtype': 'P',
      },
    }
  );
  const data = await res.json();
  // NYSE도 시도
  if (!data?.output?.last) {
    const res2 = await fetch(
      `${KIS_BASE}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=NYSE&SYMB=${ticker}`,
      {
        headers: {
          'authorization': `Bearer ${token}`,
          'appkey': appKey,
          'appsecret': appSecret,
          'tr_id': 'HHDFS00000300',
          'custtype': 'P',
        },
      }
    );
    const data2 = await res2.json();
    const price2 = data2?.output?.last;
    return price2 ? parseFloat(price2) : null;
  }
  const price = data?.output?.last;
  return price ? parseFloat(price) : null;
}

async function getJPPrice(ticker, token, appKey, appSecret) {
  // 일본주식
  const res = await fetch(
    `${KIS_BASE}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=TSE&SYMB=${ticker}`,
    {
      headers: {
        'authorization': `Bearer ${token}`,
        'appkey': appKey,
        'appsecret': appSecret,
        'tr_id': 'HHDFS00000300',
        'custtype': 'P',
      },
    }
  );
  const data = await res.json();
  const price = data?.output?.last;
  return price ? parseFloat(price) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  if (!appKey || !appSecret) {
    return res.status(500).json({ error: 'KIS_APP_KEY or KIS_APP_SECRET not set' });
  }

  try {
    const { items } = req.body;
    const token = await getToken(appKey, appSecret);
    const results = [];

    for (const item of items) {
      try {
        let price = null;
        if (item.currency === 'KRW') {
          price = await getKRPrice(item.ticker, token, appKey, appSecret);
        } else if (item.currency === 'USD') {
          price = await getUSPrice(item.ticker, token, appKey, appSecret);
        } else if (item.currency === 'JPY') {
          price = await getJPPrice(item.ticker, token, appKey, appSecret);
        }
        if (price !== null) {
          results.push({ ticker: item.ticker, price, currency: item.currency, name: item.name });
          console.log(`✅ ${item.ticker} (${item.name}): ${price}`);
        } else {
          console.log(`❌ ${item.ticker} (${item.name}): 조회 실패`);
        }
      } catch(e) {
        console.log(`Error ${item.ticker}:`, e.message);
      }
      // API 호출 간격 (과부하 방지)
      await new Promise(r => setTimeout(r, 200));
    }

    res.status(200).json({ prices: results });
  } catch(e) {
    console.error('Handler error:', e.message);
    res.status(500).json({ error: e.message });
  }
}
