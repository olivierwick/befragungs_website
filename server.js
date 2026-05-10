const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

app.post("/absenden", (req, res) => {
    const text = req.body.text;
    if (!text || text.trim() === "") {
        return res.status(400).json({ fehler: "Kein Text" });
    }

    const datum = new Date().toISOString().replace(/[:.]/g, "-");
    const dateiname = path.join(__dirname, "antworten", `antwort_${datum}.txt`);

    fs.writeFile(dateiname, text, "utf8", (err) => {
        if (err) return res.status(500).json({ fehler: "Fehler beim Speichern" });
        res.json({ erfolg: true });
    });
});

app.listen(3000, () => {
    console.log("Server läuft auf http://localhost:3000");
});
