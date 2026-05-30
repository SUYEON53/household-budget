// 토큰 발급 전용 엔드포인트
const KIS_BASE = 'https://openapi.koreainvestment.com:9443';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const appKey    = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;
  if (!appKey || !appSecret) {
    return res.status(500).json({ error: 'KIS 환경변수 없음' });
  }

  try {
    const response = await fetch(`${KIS_BASE}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        appkey: appKey,
        appsecret: appSecret,
      }),
    });
    const data = await response.json();
    if (!data.access_token) {
      return res.status(400).json({ error: data.msg1 || '토큰 발급 실패' });
    }
    // 토큰 반환 (만료 시간 포함)
    res.status(200).json({
      token: data.access_token,
      expires: data.access_token_token_expired,
      message: 'Vercel KIS_TOKEN 환경변수에 아래 token 값을 저장하세요'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
