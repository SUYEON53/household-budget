export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  try {
    const { messages, tools, max_tokens } = req.body;
    const hasWebSearch = tools && tools.some(t => t.type === 'web_search_20250305');

    const contents = messages.map(m => {
      let text = '';
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) text = m.content.map(c => c.text || '').join('');
      return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: text || ' ' }] };
    });

    const body = {
      contents,
      generationConfig: { maxOutputTokens: max_tokens || 2000, temperature: 0.3 }
    };

    if (hasWebSearch) body.tools = [{ google_search: {} }];

    // 모델명 수정 — 2.0-flash (정식), 웹검색 없으면 1.5-flash
    const model = hasWebSearch ? 'gemini-2.0-flash' : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      // 모델 오류 시 fallback — gemini-1.5-flash로 재시도
      if (data.error?.message?.includes('not found') || data.error?.message?.includes('not supported')) {
        const fallbackUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const fallbackRes = await fetch(fallbackUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, tools: undefined }),
        });
        const fallbackData = await fallbackRes.json();
        const text = fallbackData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        return res.status(200).json({ content: [{ type: 'text', text }] });
      }
      return res.status(200).json({
        content: [{ type: 'text', text: `[API 오류] ${data.error?.message || '알 수 없는 오류'}` }]
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    res.status(200).json({ content: [{ type: 'text', text: `[서버 오류] ${e.message}` }] });
  }
}
