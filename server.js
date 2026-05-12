require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function moderieren(text) {
    const res = await fetch("https://api.openai.com/v1/moderations", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({ input: text })
    });
    const data = await res.json();
    console.log("OpenAI Antwort:", JSON.stringify(data));
    if (!data.results) throw new Error("Keine results: " + JSON.stringify(data));
    const result = data.results[0];
    if (result.flagged) {
        const kategorien = Object.entries(result.categories)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(", ");
        return { flagged: true, grund: kategorien };
    }
    return { flagged: false };
}

app.post("/absenden", async (req, res) => {
    const text = req.body.text;
    if (!text || text.trim() === "") {
        return res.status(400).json({ fehler: "Kein Text" });
    }

    let moderation = { flagged: false };
    try {
        moderation = await moderieren(text);
    } catch (e) {
        console.error("Moderation Fehler:", e.message);
    }

    if (moderation.flagged) {
        console.log("Gefilterter Text:", text, "| Grund:", moderation.grund);
        await supabase.from("gefiltert").insert({ text, grund: moderation.grund });
        return res.json({ erfolg: true });
    }

    const { error } = await supabase.from("antworten").insert({ text });
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
