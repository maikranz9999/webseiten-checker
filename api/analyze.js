import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, hint: "POST with { url } to analyze" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body || {};
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const screenshotKey = process.env.SCREENSHOT_API_KEY;

  if (!url) return res.status(400).json({ error: "URL fehlt." });

  try {
    const screenshotUrl = `https://shot.screenshotapi.net/screenshot?token=${screenshotKey}&url=${encodeURIComponent(
      url
    )}&full_page=true&output=image&file_type=png`;

    const prompt = `
Analysiere die Webseite ${url} nach diesen Kriterien:

1. SEO – Struktur, Meta-Tags, Lesbarkeit, technische Basis.
2. Sprache – Rechtschreibung, Ausdruck, Professionalität.
3. Ästhetik – Design, Farben, Typografie, Nutzerführung.

Bewerte jeden Punkt von 1–10 und gib 2–3 konkrete Verbesserungsvorschläge.
`;

    const modelPrimary = "claude-sonnet-4-5-20250929";
    const modelFallback = "claude-3-5-sonnet-20240620";

    async function callAnthropic(model) {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const raw = await r.text();
      if (!r.ok) {
        // wichtig: Fehlermeldung zurückgeben, damit du sie im Frontend siehst
        return { ok: false, status: r.status, errorRaw: raw };
      }
      let data;
      try { data = JSON.parse(raw); }
      catch (e) { return { ok: false, status: 502, errorRaw: `JSON parse error: ${raw}` }; }
      const text = data?.content?.[0]?.text;
      if (!text) return { ok: false, status: 502, errorRaw: `No text in response: ${raw}` };
      return { ok: true, text };
    }

    // 1) Primär versuch
    let ai = await callAnthropic(modelPrimary);

    // 2) Fallback falls Modell nicht verfügbar / 401 / 400 etc.
    if (!ai.ok) {
      // Nur wenn klarer Modell-/Zugriffsfehler, auf Fallback gehen
      if (String(ai.errorRaw).toLowerCase().includes("invalid") ||
          String(ai.errorRaw).toLowerCase().includes("not found") ||
          String(ai.status) === "400" || String(ai.status) === "404" || String(ai.status) === "403") {
        ai = await callAnthropic(modelFallback);
      }
    }

    if (!ai.ok) {
      // Fehler sichtbar an Frontend geben
      return res.status(502).json({
        screenshot: screenshotUrl,
        feedback: `KI-Fehler (${ai.status}). Details:\n${ai.errorRaw}`
      });
    }

    return res.status(200).json({
      screenshot: screenshotUrl,
      feedback: ai.text
    });

  } catch (err) {
    console.error("Fehler:", err);
    return res.status(500).json({ error: "Analyse fehlgeschlagen." });
  }
}
