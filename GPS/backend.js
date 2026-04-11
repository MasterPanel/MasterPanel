const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// KLUCZOWA ZMIANA: Serwowanie plików statycznych z aktualnego folderu
// To pozwoli przeglądarce pobrać manifest.json, ikony i service-worker.js
app.use(express.static(path.join(__dirname)));

// Magazyn urządzeń
let devices = {};

// CONFIG: Po ilu milisekundach braku aktywności usunąć użytkownika
const INACTIVITY_TIMEOUT = 30000; 

// Główna trasa
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Endpoint zapisu danych GPS
app.post('/update-location', (req, res) => {
    const { id, lat, lng, speed } = req.body;
    if (id && typeof lat === 'number') {
        devices[id] = {
            lat,
            lng,
            speed: speed || 0,
            lastSeen: Date.now()
        };
        
        console.log(`[GPS DATA] Node: ${id} | Lat: ${lat.toFixed(6)} | Lng: ${lng.toFixed(6)} | Speed: ${(speed * 3.6).toFixed(1)} km/h`);
        
        res.status(200).send('OK');
    } else {
        res.status(400).send('Błędne dane');
    }
});

// Endpoint pobierania lokalizacji wszystkich urządzeń
app.get('/get-all-locations', (req, res) => {
    res.json(devices);
});

// MECHANIZM AUTO-RESETU (Sprzątacz)
setInterval(() => {
    const now = Date.now();
    for (const id in devices) {
        if (now - devices[id].lastSeen > INACTIVITY_TIMEOUT) {
            console.log(`\x1b[31m[TIMEOUT]\x1b[0m Urządzenie ${id} rozłączone.`);
            delete devices[id];
        }
    }
}, 5000);
app.listen(3000, '0.0.0.0', () => {
    const reset = "\x1b[0m";
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const magenta = "\x1b[35m";
    const bold = "\x1b[1m";

    console.clear();
    console.log(green + bold + `
                   ██████╗ ██████╗ ███████╗
                  ██╔════╝ ██╔══██╗██╔════╝
                  ██║  ███╗██████╔╝███████╗
                  ██║   ██║██╔═══╝ ╚════██║
                  ╚██████╔╝██║     ███████║
                   ╚═════╝ ╚═╝     ╚══════╝
    ` + reset);


    console.log(magenta + "   [================- SYSTEM AKTYWNY -================]" + reset);
    console.log(`      ${magenta}\\${reset}${magenta}\\${reset}------====${cyan}Lokalizacja Zbiorowa====------ ${magenta}//${reset}`);

    console.log(magenta + "    |================================================|" + reset);
    
 console.log(green + "\n              		 --LOGI--\n" + reset);
})

