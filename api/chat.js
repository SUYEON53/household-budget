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
        parts: [{ text: text || ' ' }]
      };
    });

    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: max_tokens || 2000,
        temperature: 0.3,
      }
    };

    if (hasWebSearch) {
      body.tools = [{ google_search: {} }];
    }

    // 웹검색은 flash-exp, 일반은 flash
    const model = hasWebSearch
      ? 'gemini-2.0-flash-exp'
      : 'gemini-1.5-flash';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    console.log('Calling Gemini:', model, 'webSearch:', hasWebSearch);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log('Gemini status:', response.status, 'error:', data.error?.message);

    if (!response.ok) {
      return res.status(200).json({
        content: [{ type: 'text', text: `[API 오류] ${data.error?.message || '알 수 없는 오류'}` }]
      });
    }

    const parts = data.candidates?.[0]?.content?.parts || [];
    const text = parts.map(p => p.text || '').join('');

    res.status(200).json({
      content: [{ type: 'text', text }]
    });

  } catch (e) {
    console.error('Handler error:', e.message);
    // 500 대신 200으로 반환해서 프론트에서 에러 메시지 표시
    res.status(200).json({
      content: [{ type: 'text', text: `[서버 오류] ${e.message}` }]
    });
  }
}
