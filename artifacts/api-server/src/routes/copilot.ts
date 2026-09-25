import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/copilot", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  const context = req.body?.context;

  if (!question || !context || typeof context !== "object") {
    res.status(400).json({ error: "A question and current CampusOne context are required." });
    return;
  }

  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    res.status(503).json({ error: "AI explanation is temporarily unavailable." });
    return;
  }

  try {
    const useGroq = apiKey.startsWith("gsk_");
    const response = await fetch(useGroq ? "https://api.groq.com/openai/v1/chat/completions" : "https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: useGroq ? "openai/gpt-oss-20b" : "gpt-5-mini",
        max_completion_tokens: 420,
        messages: [
          {
            role: "system",
            content: [
              "You are Ask CampusOne, a concise student financial planning explainer.",
              "Use only the supplied structured context. Never calculate or invent balances, tuition, risk months, opportunity amounts, eligibility, awards, or guarantees.",
              "The Financial Twin engine is the numerical source of truth. Explain the current state and route the student to FutureMe, Fix My Semester, or Demo Opportunities when helpful.",
              "State that opportunity matches are not official eligibility. Use 2-4 short paragraphs or bullets.",
            ].join(" "),
          },
          { role: "user", content: `Question: ${question}\nCurrent CampusOne context: ${JSON.stringify(context)}` },
        ],
      }),
      signal: AbortSignal.timeout(12_000),
    });

    const raw = await response.text();
    if (!response.ok) {
      throw new Error(`OpenAI request failed with ${response.status}`);
    }
    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) throw new Error("OpenAI returned no explanation");
    res.json({ answer });
  } catch (error) {
    req.log.warn({ error: error instanceof Error ? error.message : "unknown error" }, "Ask CampusOne fallback activated");
    res.json({ answer: null, unavailable: true });
  }
});

export default router;