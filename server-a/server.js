const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 3000;
const SERVER_B_URL = process.env.SERVER_B_URL || 'http://localhost:4000';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Tietokannan alustus (luodaan tiedosto /app/data/animals.db)
const dbFile = path.join(__dirname, 'data', 'animals.db');
const fs = require('fs');
if (!fs.existsSync(path.join(__dirname, 'data'))) {
    fs.mkdirSync(path.join(__dirname, 'data'));
}

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) console.error('Virhe tietokantaan yhdistämisessä:', err.message);
    else console.log('Yhdistetty SQLite-tietokantaan.');
});

// Luodaan taulu ja esimerkkidata automaattisesti käynnistyessä
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS animals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        type TEXT,
        age INTEGER,
        breed TEXT,
        description TEXT,
        image_url TEXT,
        status TEXT DEFAULT 'available'
    )`, () => {
        // Tarkistetaan onko taulu tyhjä, lisätään esimerkkidata tarvittaessa
        db.get(`SELECT COUNT(*) as count FROM animals`, (err, row) => {
            if (row.count === 0) {
                const stmt = db.prepare(`INSERT INTO animals (name, type, age, breed, description, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                stmt.run('Musti', 'Koira', 3, 'Labradorinnoutaja', 'Iloinen ja energinen koira, joka rakastaa leikkimistä.', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1', 'available');
                stmt.run('Misu', 'Kissa', 2, 'Maatiainen', 'Rauhallinen sylikissa, joka nauttii aurinkoisista paikoista.', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba', 'available');
                stmt.finalize();
                console.log('Esimerkkidata lisätty tietokantaan!');
            }
        });
    });
});

// --- API ENDPOINTIT (SERVER A) ---

// 1. GET /animals - Palauttaa kaikki eläimet
app.get('/api/animals', (req, res) => {
    db.all(`SELECT * FROM animals`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. GET /animals/:id - Palauttaa yhden eläimen tiedot
app.get('/api/animals/:id', (req, res) => {
    const { id } = req.params;
    db.get(`SELECT * FROM animals WHERE id = ?`, [id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Eläintä ei löytynyt' });
        res.json(row);
    });
});

// 3. POST /animals/:id/adopt - Vastaanottaa adoptiohakemuksen frontendiltä ja välittää Server B:lle
app.post('/api/animals/:id/adopt', async (req, res) => {
    const animalId = req.params.id;
    const applicantData = req.body;

    try {
        // Lähetetään hakemus eteenpäin Server B:lle
        const response = await fetch(`${SERVER_B_URL}/adoptions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ animalId, ...applicantData })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        // Päivitetään eläimen status tietokantaan adoptoiduksi
        db.run(`UPDATE animals SET status = 'adopted' WHERE id = ?`, [animalId]);

        res.json({ success: true, message: 'Adoptiohakemus välitetty onnistuneesti!', data });
    } catch (error) {
        console.error('Virhe yhteydessä Server B:hen:', error);
        res.status(500).json({ error: 'Adoptiopalveluun ei saatu yhteyttä.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server A pyörii portissa ${PORT}`);
});