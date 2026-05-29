export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  try {
    const { messages, max_tokens } = req.body;

    // openrouter/free = 사용 가능한 무료 모델 자동 선택
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://household-budget-eta.vercel.app',
        'X-Title': 'Household Budget',
      },
      body: JSON.stringify({
        model: 'openrouter/auto',
        messages,
        max_tokens: max_tokens || 2000,
        temperature: 0.3,
        provider: {
          allow_fallbacks: true,
          require_parameters: true,
        }
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.choices?.[0]?.message?.content) {
      // fallback: deepseek 무료
      const fb = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://household-budget-eta.vercel.app',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-chat-v3-0324:free',
          messages,
          max_tokens: max_tokens || 2000,
        }),
      });
      const fbData = await fb.json();
      const text = fbData.choices?.[0]?.message?.content || '';
      if (!text) {
        return res.status(200).json({
          content: [{ type: 'text', text: `[오류] ${data.error?.message || fbData.error?.message || '사용 가능한 모델 없음'}` }]
        });
      }
      return res.status(200).json({ content: [{ type: 'text', text }] });
    }

    const text = data.choices[0].message.content;
    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    res.status(200).json({ content: [{ type: 'text', text: `[서버 오류] ${e.message}` }] });
  }
}
