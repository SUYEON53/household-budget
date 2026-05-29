export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  try {
    const { messages, max_tokens } = req.body;

    // 무료 모델 순서대로 시도
    const FREE_MODELS = [
      'google/gemini-2.0-flash-thinking-exp:free',
      'google/gemini-2.5-pro-exp-03-25:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ];

    let text = '';
    for (const model of FREE_MODELS) {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://household-budget-eta.vercel.app',
          'X-Title': 'Household Budget',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: max_tokens || 2000,
          temperature: 0.3,
        }),
      });

      const data = await response.json();

      if (response.ok && data.choices?.[0]?.message?.content) {
        text = data.choices[0].message.content;
        break;
      }
      // 이 모델 실패 시 다음 모델로
      console.log(`Model ${model} failed:`, data.error?.message);
    }

    if (!text) {
      return res.status(200).json({
        content: [{ type: 'text', text: '[오류] 사용 가능한 무료 모델이 없습니다. 잠시 후 다시 시도해주세요.' }]
      });
    }

    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    res.status(200).json({ content: [{ type: 'text', text: `[서버 오류] ${e.message}` }] });
  }
}
