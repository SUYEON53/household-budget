export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });
  try {
    const { messages, max_tokens } = req.body;
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://household-budget-eta.vercel.app',
        'X-Title': 'Household Budget',
      },
      body: JSON.stringify({ model: 'openrouter/auto', messages, max_tokens: max_tokens || 2000, temperature: 0.3 }),
    });
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    if (!text) return res.status(200).json({ content: [{ type: 'text', text: `[오류] ${data.error?.message || '응답 없음'}` }] });
    res.status(200).json({ content: [{ type: 'text', text }] });
  } catch (e) {
    res.status(200).json({ content: [{ type: 'text', text: `[서버 오류] ${e.message}` }] });
  }
}
