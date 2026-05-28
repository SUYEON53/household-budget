export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  try {
    const { messages, max_tokens } = req.body;

    // OpenRouter는 OpenAI 형식 사용
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://household-budget-eta.vercel.app',
        'X-Title': 'Household Budget App',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash-exp:free',
        messages,
        max_tokens: max_tokens || 2000,
        temperature: 0.3,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // 무료 모델 오류 시 다른 무료 모델로 fallback
      if (data.error?.message?.includes('rate') || data.error?.code === 429) {
        const fb = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://household-budget-eta.vercel.app',
          },
          body: JSON.stringify({
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages,
            max_tokens: max_tokens || 2000,
          }),
        });
        const fbData = await fb.json();
        const text = fbData.choices?.[0]?.message?.content || '';
        return res.status(200).json({ content: [{ type: 'text', text }] });
      }
      return res.status(200).json({
        content: [{ type: 'text', text: `[API 오류] ${data.error?.message || JSON.stringify(data.error)}` }]
      });
    }

    const text = data.choices?.[0]?.message?.content || '';
    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    res.status(200).json({ content: [{ type: 'text', text: `[서버 오류] ${e.message}` }] });
  }
}
