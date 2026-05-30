const KIS_BASE = 'https://openapi.koreainvestment.com:9443';

// 토큰 발급 (하루 1번만 호출 권장)
async function getToken(appKey, appSecret) {
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
  return data.access_token;
}

async function getKRPrice(ticker, token, appKey, appSecret) {
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
  // NASDAQ 시도 후 NYSE
  for (const excd of ['NAS', 'NYSE', 'AMS']) {
    const res = await fetch(
      `${KIS_BASE}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${ticker}`,
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
    if (price && parseFloat(price) > 0) return parseFloat(price);
  }
  return null;
}

async function getJPPrice(ticker, token, appKey, appSecret) {
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

  const appKey    = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  // 토큰을 환경변수로 저장해두면 재발급 안 함
  let token       = process.env.KIS_TOKEN;

  if (!appKey || !appSecret) {
    return res.status(500).json({ error: 'KIS_APP_KEY or KIS_APP_SECRET not set' });
  }

  try {
    // 토큰이 없으면 발급
    let newTokenIssued = false;
    if (!token) {
      console.log('토큰 발급 중...');
      token = await getToken(appKey, appSecret);
      newTokenIssued = true;
      console.log('토큰 발급 완료 (전체길이):', token.length);
    }

    const { items } = req.body;
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
          console.log(`✅ ${item.name}(${item.ticker}): ${price}`);
        } else {
          console.log(`❌ ${item.name}(${item.ticker}): 조회 실패`);
        }
      } catch(e) {
        console.log(`Error ${item.ticker}:`, e.message);
      }
      await new Promise(r => setTimeout(r, 200));
    }

    res.status(200).json({
      prices: results,
      // 새로 발급된 경우 토큰 반환 (Vercel KIS_TOKEN에 저장 필요)
      newToken: newTokenIssued ? token : undefined,
    });
  } catch(e) {
    // 토큰 만료 시 안내
    if (e.message.includes('토큰') || e.message.includes('token')) {
      return res.status(200).json({
        error: '토큰 만료. Vercel KIS_TOKEN 환경변수를 갱신해주세요.',
        prices: []
      });
    }
    res.status(500).json({ error: e.message, prices: [] });
  }
}
