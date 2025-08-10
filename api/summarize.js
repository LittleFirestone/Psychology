// api/summarize.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).send("Use POST.");

  const { entries, topics } = req.body || {};
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).send("Missing entries.");
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).send("OPENAI_API_KEY not set.");

  const client = new OpenAI({ apiKey });

  // Build a compact corpus
  const corpus = entries
    .sort((a,b)=>a.created-b.created)
    .map(e => {
      const d = new Date(e.created).toLocaleString();
      const t = (e.topics||"").trim();
      return `- [${d}] ${t ? `(${t}) ` : ""}${e.text}`;
    })
    .join("\n");

  const focus = (topics || "").trim();
  const system = `
You are a calm, clear editorial assistant. Summarize journal entries into a 
newsletter-ready brief with:
- 3–6 bullet highlights (actionable + specific)
- A short “Themes & patterns” paragraph
- A short “Next steps” checklist (2–5 items)
Write with warmth, brevity, and concrete phrasing. Avoid therapy jargon. 
If topics were provided, focus on them.`.trim();

  const user = `
TOPICS: ${focus || "(none)"}

ENTRIES (most recent week):
${corpus}
`.trim();

  try {
    const completion = await client.chat.completions.create({
      // If you have access to a newer model, you can swap the model name.
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    });

    const summary = completion.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ summary });
  } catch (err: any) {
    return res.status(500).send(err?.message || "OpenAI error.");
  }
}
