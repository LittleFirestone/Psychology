// /api/summarize.js  (Vercel Serverless Function: Node 18+)
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).send("Use POST.");

    const { entries = [], topics = "" } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).send("OPENAI_API_KEY not set.");

    if (!Array.isArray(entries) || entries.length === 0) {
      const summary = [
        "No entries found for the last 7 days.",
        "",
        "### Next steps",
        "- [ ] Add a couple of diary notes",
        "- [ ] Tag them with topics you care about",
        "- [ ] Hit Summarize again",
      ].join("\n");
      return res.status(200).json({ summary });
    }

    const corpus = entries
      .filter(e => e && typeof e === "object")
      .sort((a,b)=>(a.created||0)-(b.created||0))
      .map(e=>{
        const d = new Date(e.created || Date.now()).toLocaleString();
        const t = (e.topics || "").trim();
        const title = (e.title || "").trim();
        const line = [title, e.text || ""].filter(Boolean).join(" — ");
        return `- [${d}] ${t ? `(${t}) ` : ""}${line}`;
      }).join("\n");

    const system = `
You are an editorial assistant. Summarize journal entries into a newsletter-ready brief:
- Start with a friendly 1–2 sentence intro.
- Then 3–6 bullet highlights (actionable, concrete; one line each).
- Add a short "Themes & Patterns" paragraph.
- End with a "Next steps" checklist (2–5 items) with [ ] checkboxes.
Use plain markdown. If TOPICS are provided, prioritize those.
`.trim();

    const user = `
TOPICS FOCUS: ${topics?.toString().trim() || "(none)"}

ENTRIES (last 7 days):
${corpus}
`.trim();

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const r = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "Authorization":`Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role:"system", content: system },
          { role:"user", content: user }
        ]
      })
    });

    const txt = await r.text();
    if(!r.ok){
      return res.status(502).send(`OpenAI error ${r.status}: ${txt}`);
    }

    let data; 
    try { data = JSON.parse(txt); } 
    catch { return res.status(502).send(`OpenAI returned non-JSON: ${txt}`); }

    const summary = data?.choices?.[0]?.message?.content || "(No summary returned)";
    return res.status(200).json({ summary });
  } catch (e) {
    return res.status(500).send(e?.message || "Server error");
  }
}
