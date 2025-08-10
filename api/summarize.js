// api/summarize.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { topics } = req.body || {};
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'Send { topics: string[] }' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY missing' });

    const model = process.env.OPENAI_MODEL || 'gpt-5-thinking'; // or set OPENAI_MODEL=gpt-4o-mini in Vercel

    const prompt = `
Summarize these diary topics into a crisp bullet list. Group similar items, pull
key themes, and finish with 3 actionable suggestions.

Topics:
${topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}
`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are a concise, supportive therapist-assistant.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(resp.status).json({ error: err || 'OpenAI error' });
    }

    const data = await resp.json();
    const text = data.choices?.[0]?.message?.content?.trim() || 'No summary';
    return res.status(200).json({ summary: text });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
