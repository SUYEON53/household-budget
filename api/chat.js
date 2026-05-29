export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'OPENROUTER_API_KEY not set' });

  try {
    const { messages, max_tokens } = req.body;

    const FREE_MODELS = [
      'meta-llama/llama-3.3-70b-instruct:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemma-3-27b-it:free',
      'qwen/qwen-2.5-72b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ];

    let text = '';
    let lastError = '';
    for (const model of FREE_MODELS) {
      try {
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
          console.log('Success with model:', model);
          break;
        }
        lastError = data.error?.message || 'unknown';
        console.log(`Model ${model} failed: ${lastError}`);
      } catch(e) {
        lastError = e.message;
        console.log(`Model ${model} exception: ${e.message}`);
      }
    }

    if (!text) {
      return res.status(200).json({
        content: [{ type: 'text', text: `[오류] 모든 무료 모델 실패. 마지막 오류: ${lastError}` }]
      });
    }

    res.status(200).json({ content: [{ type: 'text', text }] });

  } catch (e) {
    res.status(200).json({ content: [{ type: 'text', text: `[서버 오류] ${e.message}` }] });
  }
}
