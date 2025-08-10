// api/summarize.js
// Works on Vercel and Next as a Web Handler (Node 18+).
// Set OPENAI_API_KEY in your project settings.
// Optional: OPENAI_MODEL (defaults to gpt-4o-mini)

export default async function handler(request) {
  try {
    // method gate
    if (request.method !== "POST") {
      return new Response("Use POST.", { status: 405 });
    }

    // parse body safely
    const { entries = [], topics = "" } = await request.json().catch(() => ({}));

    // handle empty input gracefully (don’t error the UI)
    if (!Array.isArray(entries) || entries.length === 0) {
      const summary = [
        "Hey — no entries found in the last 7 days.",
        "",
        "### Next steps",
        "- [ ] Add a couple of diary notes",
        "- [ ] Tag them with topics you care about",
        "- [ ] Hit Summarize again",
      ].join("\n");
      return Response.json({ summary }, { status: 200 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return new Response("OPENAI_API_KEY not set.", { status: 500 });

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    // build corpus
    const corpus = entries
      .filter(e => e && typeof e === "object")
      .sort((a, b) => (a.created || 0) - (b.created || 0))
      .map(e => {
        const d = new Date(e.created || Date.now()).toLocaleString();
        const t = (e.topics || "").trim();
        const title = (e.title || "").trim();
        const line = [title, e.text || ""].filter(Boolean).join(" — ");
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
TOPICS FOCUS: ${topics?.toString().trim() || "(none)"}

ENTRIES (last 7 days):
${corpus}
`.trim();

    // Call OpenAI (Chat Completions; simple + stable)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ]
      })
    });

    if (!r.ok) {
      // bubble up API errors so you see them in the UI
      const text = await r.text();
      return new Response(text || `Upstream error: ${r.status}`, { status: 502 });
    }

    const data = await r.json();
    const summary = data?.choices?.[0]?.message?.content || "(No summary returned)";
    return Response.json({ summary });
  } catch (e) {
    return new Response(e?.message || "Server error", { status: 500 });
  }
}
