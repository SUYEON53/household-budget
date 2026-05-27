export default async function handler(req, res) {
  if(req.method !== 'POST') return res.status(405).end();

  try {
    const { messages, tools } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // 메시지 변환 (Anthropic → Gemini 형식)
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: typeof m.content === 'string' ? m.content : m.content.map(c=>c.text||'').join('') }]
    }));

    // Google Search grounding 설정 (웹 검색용)
    const hasWebSearch = tools && tools.some(t => t.type === 'web_search_20250305');

    const body = {
      contents,
      generationConfig: { maxOutputTokens: 2000 },
    };

    // 웹 검색이 필요한 경우 Google Search tool 추가
    if(hasWebSearch) {
      body.tools = [{ google_search: {} }];
    }

    const model = hasWebSearch ? 'gemini-2.0-flash' : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if(!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Gemini API error' });
    }

    // Gemini → Anthropic 응답 형식으로 변환 (기존 코드 호환)
    const text = data.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '';
    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
