export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' });

  try {
    const { base64Data, mimeType, prompt } = req.body;
    if (!base64Data) return res.status(400).json({ error: '이미지 데이터 없음' });

    const body = {
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        maxOutputTokens: 2000,
        temperature: 0.1,
      }
    };

    // Gemini 1.5 Flash (Vision 지원, 무료 티어)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(200).json({ error: data.error?.message || 'Gemini API 오류' });
    }

    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    res.status(200).json({ text });

  } catch(e) {
    res.status(200).json({ error: e.message });
  }
}
