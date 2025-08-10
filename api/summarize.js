// api/summarize.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Use POST.");
  const { entries, topics } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).send("Missing entries.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).send("OPENAI_API_KEY not set.");

  const corpus = entries
    .sort((a, b) => a.created - b.created)
    .map(e => {
      const d = new Date(e.created).toLocaleString();
      const t = (e.topics || "").trim();
      const title = (e.title || "").trim();
      const line = [title, e.text].filter(Boolean).join(" — ");
      return `- [${d}] ${t ? `(${t}) ` : ""}${line}`;
    })
    .join("\n");

  const system = `
You are an editorial assistant. Summarize journal entries into a newsletter-ready brief:
- Start with a friendly 1–2 sentence intro.
- Then 3–6 bullet highlights (actionable, concrete; keep each to one line).
- Add a short "Themes & Patterns" paragraph.
- End with a "Next steps" checklist (2–5 items) using checkboxes [ ].
Use plain markdown. If TOPICS are provided, prioritize those.
`.trim();

  const user = `
TOPICS FOCUS: ${topics?.trim() || "(none)"}

ENTRIES (last 7 days):
${corpus}
`.trim();

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(500).send(text);
    }
    const data = await r.json();
    const summary = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).send(e?.message || "OpenAI error");
  }
}
