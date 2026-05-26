require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const filter = require("leo-profanity");
const Anthropic = require("@anthropic-ai/sdk");

filter.loadDictionary("en");
filter.add(filter.getDictionary("fr"));
filter.add(['wichser', 'wixer', 'wichsen', 'hurensohn', 'hurenbock', 'ficken', 'fick', 'gefickt', 'fotze', 'nutte', 'schlampe', 'arschloch', 'vollidiot', 'vollpfosten', 'drecksau', 'dreckssau', 'miststück', 'schwuchtel', 'orospu', 'siktir', 'amk', 'piç']);

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    if (req.path === "/" || req.path.endsWith(".html")) {
        res.set("Cache-Control", "no-store");
    }
    next();
});
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function pruefeMitKI(text, frage) {
    try {
        const message = await anthropic.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 50,
            messages: [{
                role: "user",
                content: `Du prüfst Antworten auf eine Umfrage über das Klybeck-Viertel in Basel.

Antwort: "${text}"

Regel 1 — "zuKurz": Lehne ab NUR wenn:
- Zufällige Buchstaben ohne Wörter (z.B. "akjbdkjwbd")
- Dasselbe Wort 3x oder mehr wiederholt (z.B. "hallo hallo hallo")
- Nur aufgezählte unverbundene Wörter (z.B. "basel klybeck hallo beton tisch")

Regel 2 — "schimpfwort": Enthält Schimpfwörter oder Beleidigungen (in irgendeiner Sprache).

Antworte NUR mit einem dieser JSON-Werte (kein weiterer Text):
{"ok":true}
{"ok":false,"grund":"zuKurz"}
{"ok":false,"grund":"schimpfwort"}`
            }]
        });
        const responseText = message.content[0].text;
        console.log("Claude raw:", responseText);
        const match = responseText.match(/\{[^}]+\}/);
        console.log("Claude match:", match ? match[0] : "null");
        if (!match) return { ok: true };
        return JSON.parse(match[0]);
    } catch (e) {
        console.error("KI-Prüfung Fehler:", e.message);
        return { ok: true };
    }
}

app.post("/absenden", async (req, res) => {
    const text = req.body.text;
    const frage = req.body.frage || null;
    if (!text || text.trim() === "") {
        return res.status(400).json({ fehler: "leer" });
    }

    if (filter.check(text)) {
        console.log("Schimpfwort (leo):", text);
        await supabase.from("schimpfwoerter").insert({ text, frage });
        return res.json({ erfolg: true });
    }

    const ki = await pruefeMitKI(text, frage);
    if (!ki.ok) {
        console.log("KI-Filter:", text, "->", ki.grund);
        if (ki.grund === "zuKurz") {
            return res.json({ fehler: "zuKurz" });
        }
        if (ki.grund === "schimpfwort") {
            const { data: d1, error: e1 } = await supabase.from("schimpfwoerter").insert({ text, frage }).select();
            console.log("schimpfwoerter insert result:", JSON.stringify({ data: d1, error: e1 }));
        }
        return res.json({ erfolg: true });
    }

    const { error } = await supabase.from("antworten").insert({ text, frage });
    if (error) {
        console.error("Supabase Fehler:", error.message);
        return res.status(500).json({ fehler: "Fehler beim Speichern" });
    }

    console.log("Neue Antwort gespeichert:", text);
    res.json({ erfolg: true });
});

app.listen(3000, () => {
    console.log("Server läuft auf http://localhost:3000");
});
