const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// Tietokanta adoptioille
const dbFile = path.join(__dirname, 'data', 'adoptions.db');
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Virhe Server B tietokannassa:', err.message);
    else console.log('Yhdistetty Server B tietokantaan.');
});

db.run(`CREATE TABLE IF NOT EXISTS adoptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    animalId INTEGER,
    name TEXT,
    email TEXT,
    phone TEXT,
    message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// POST /adoptions - Vastaanottaa hakemuksen Server A:lta
app.post('/adoptions', (req, res) => {
    const { animalId, name, email, phone, message } = req.body;

    if (!name || !email) {
        return res.status(400).json({ error: 'Nimi ja sähköposti ovat pakollisia.' });
    }

    const stmt = db.prepare(`INSERT INTO adoptions (animalId, name, email, phone, message) VALUES (?, ?, ?, ?, ?)`);
    stmt.run(animalId, name, email, phone, message, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        console.log(`Tallennettu adoptiohakemus eläimelle ID: ${animalId} hakijalta ${name}`);
        res.status(201).json({ success: true, adoptionId: this.lastID });
    });
});

app.listen(PORT, () => {
    console.log(`Server B pyörii portissa ${PORT}`);
});