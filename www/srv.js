// serv.js - Zaktualizowany główny plik serwera
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // Serwuje os.html, sklep.html, index.html itd.

// GŁÓWNA TRASA - Startuje Master OS
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'os.html'));
});

// GPS BACKEND (Zintegrowany z backend.js)
let devices = {};
app.post('/update-location', (req, res) => {
    const { id, lat, lng, speed } = req.body;
    if (id && typeof lat === 'number') {
        devices[id] = { lat, lng, speed: speed || 0, lastSeen: Date.now() };
        res.status(200).send('OK');
    } else {
        res.status(400).send('Błędne dane GPS');
    }
});

app.get('/get-all-locations', (req, res) => {
    res.json(devices);
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MASTER OS] Serwer działa na porcie ${PORT}`);
});
