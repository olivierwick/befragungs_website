require("dotenv").config();
const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.post("/absenden", async (req, res) => {
    const text = req.body.text;
    if (!text || text.trim() === "") {
        return res.status(400).json({ fehler: "Kein Text" });
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
