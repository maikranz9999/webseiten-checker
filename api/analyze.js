import fetch from "node-fetch";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const screenshotKey = process.env.SCREENSHOT_API_KEY;

  if (!url) {
    return res.status(400).json({ error: "URL fehlt." });
  }

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

    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"

      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await aiResponse.json();
    const feedback = data.content?.[0]?.text || "Keine Antwort von der KI erhalten.";

    res.status(200).json({
      screenshot: screenshotUrl,
      feedback
    });
  } catch (err) {
    console.error("Fehler:", err);
    res.status(500).json({ error: "Analyse fehlgeschlagen." });
  }
}
