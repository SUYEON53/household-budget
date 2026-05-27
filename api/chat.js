export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  try {
    const { messages, tools, max_tokens } = req.body;
    const hasWebSearch = tools && tools.some(t => t.type === 'web_search_20250305');

    // Anthropic 메시지 → Gemini contents 변환
    const contents = messages.map(m => {
      let text = '';
      if (typeof m.content === 'string') {
        text = m.content;
      } else if (Array.isArray(m.content)) {
        text = m.content.map(c => c.text || '').join('');
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }]
      };
    });

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 2000,
        temperature: 0.3,
      }
    };

    // 웹검색 필요 시 Google Search grounding
    if (hasWebSearch) {
      body.tools = [{ googleSearch: {} }];
    }

    const model = hasWebSearch ? 'gemini-2.0-flash' : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || 'Gemini API error',
        detail: data
      });
    }

    // Gemini 응답 → Anthropic 형식으로 변환 (기존 프론트 코드 호환)
    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');

    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (e) {
    console.error('Handler error:', e);
    res.status(500).json({ error: e.message });
  }
}
