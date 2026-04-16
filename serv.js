import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* ========================================================
   PWA & NGROK FIX (GLOBALNY)
   Musi być na samym początku, aby bot PWABuilder widział stronę
   ======================================================== */
app.use((req, res, next) => {
    // Nagłówek omijający ekran powitalny ngrok dla bota i przeglądarek
    res.setHeader('ngrok-skip-browser-warning', 'true');
    // Pozwolenie na pobieranie manifestu i ikon z innych domen (CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

app.use(cors());
app.use(express.json());

/* ========================================================
   OBSŁUGA MANIFESTU PWA I PLIKÓW STATYCZNYCH
   ======================================================== */
app.get('/manifest.json', (req, res) => {
    const locations = [
        path.join(__dirname, 'manifest.json'),
        path.join(__dirname, 'public', 'manifest.json')
    ];
    const manifestPath = locations.find(loc => fs.existsSync(loc));
    if (manifestPath) {
        res.setHeader('Content-Type', 'application/manifest+json');
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(manifestPath);
    } 
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

/* =======================
   KOMUNIKATOR (CHAT)
======================= */
const CHAT_FILE = path.join(__dirname, 'chatData.json');

if (!fs.existsSync(CHAT_FILE)) {
    fs.writeFileSync(CHAT_FILE, JSON.stringify([], null, 2));
}

app.get('/api/chat', (req, res) => {
    try {
        const data = fs.readFileSync(CHAT_FILE, 'utf8');
        res.json(JSON.parse(data || "[]"));
    } catch (e) {
        res.status(500).json({ error: "Błąd odczytu czatu" });
    }
});

app.post('/api/chat', (req, res) => {
    try {
        const { user, message } = req.body;
        if (!message) return res.status(400).json({ error: "Brak treści" });

        let chatHistory = [];
        try {
            const data = fs.readFileSync(CHAT_FILE, 'utf8');
            chatHistory = JSON.parse(data || "[]");
        } catch (e) { chatHistory = []; }
        
        const newMessage = {
            id: Date.now(),
            user: user || 'Anonim',
            text: message,
            time: new Date().toLocaleTimeString()
        };

        chatHistory.push(newMessage);
        if (chatHistory.length > 100) chatHistory.shift();
        fs.writeFileSync(CHAT_FILE, JSON.stringify(chatHistory, null, 2));
        
        console.log(`[CHAT] Nowa wiadomość od ${user}`);
        res.json(newMessage);
    } catch (e) {
        res.status(500).json({ error: "Błąd zapisu wiadomości" });
    }
});

/* =======================
   GPS TRACKING
======================= */
let devices = {};
const GPS_INACTIVITY_TIMEOUT = 30000;

app.post('/update-location', (req, res) => {
    const { id, lat, lng, speed } = req.body;
    if (id && typeof lat === 'number' && typeof lng === 'number') {
        devices[id] = { lat, lng, speed: speed || 0, lastSeen: Date.now() };
        console.log(`\x1b[32m[GPS]\x1b[0m Update: ${id} | Speed: ${(speed * 3.6).toFixed(1)} km/h`);
        res.status(200).send('OK');
    } else {
        res.status(400).send('Błędne dane GPS');
    }
});

app.get('/get-all-locations', (req, res) => res.json(devices));

setInterval(() => {
    const now = Date.now();
    for (const id in devices) {
        if (now - devices[id].lastSeen > GPS_INACTIVITY_TIMEOUT) {
            console.log(`\x1b[31m[GPS TIMEOUT]\x1b[0m ${id} zniknął z sieci.`);
            delete devices[id];
        }
    }
}, 5000);

/* =======================
   LG TV BRIDGE (KOMUNIKACJA Z PORTEM 8080)
======================= */
app.get('/api/tv/status', async (req, res) => {
    try {
        const r = await fetch('http://localhost:8080/status');
        res.json(await r.json());
    } catch (e) { res.json({ online: false, error: 'Bridge unreachable' }); }
});

app.get('/api/tv/toast', async (req, res) => {
    try {
        await fetch(`http://localhost:8080/toast?msg=${encodeURIComponent(req.query.msg || 'Hello')}`);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: 'Bridge error' }); }
});

app.get('/api/tv/open-url', async (req, res) => {
    try {
        await fetch(`http://localhost:8080/open-url?url=${req.query.url}`);
        res.json({ status: 'ok' });
    } catch (e) { res.status(500).json({ error: 'Bridge error' }); }
});

app.get('/api/tv/:cmd', async (req, res) => {
    const cmd = req.params.cmd;
    if (['status', 'toast', 'open-url'].includes(cmd)) return;
    try {
        console.log(`[SERW] Przekazuję komendę: ${cmd} do mostka...`);
        const r = await fetch(`http://localhost:8080/command/${cmd}`);
        res.json(await r.json());
    } catch (e) {
        res.status(500).json({ error: 'TV Bridge offline' });
    }
});

/* =======================
   LISTWA (POWER BRIDGE)
======================= */
app.get('/api/power/status', async (req, res) => {
    try {
        const r = await fetch('http://localhost:4000/status');
        res.json(await r.json());
    } catch (e) { res.status(500).json({ error: 'Power bridge offline' }); }
});

app.post('/api/power/control', async (req, res) => {
    try {
        const r = await fetch('http://localhost:4000/control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        res.json(await r.json());
    } catch (e) { res.status(500).json({ error: 'Power bridge error' }); }
});

/* =======================
   DANE LOKALNE (DHT & LIGHT)
======================= */
const DATA_FILE = path.join(__dirname, 'dhtData.json');
const LIGHT_FILE = path.join(__dirname, 'lightData.json');

let roomCommands = fs.existsSync(LIGHT_FILE) ? JSON.parse(fs.readFileSync(LIGHT_FILE, 'utf8')) : {};
let dhtData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : {};

/* =======================
   LIGHT COMMANDS
======================= */

app.all('/api/commands', (req, res) => {

    /* WYSYŁANIE KOMENDY */

    if (req.method === 'POST') {

        const { room, brightness } = req.body;

        roomCommands[room] = {
            brightness: parseInt(brightness) || 0,
            timestamp: Date.now()
        };

        fs.writeFileSync(LIGHT_FILE, JSON.stringify(roomCommands, null, 2));

        console.log(`[LIGHT] ${room} -> ${brightness}`);

        return res.json({ status: 'ok' });
    }


    /* ODCZYT KOMENDY */

    const { room } = req.query;

    if (room && roomCommands[room]) {

        const cmd = roomCommands[room];

        /* USUŃ PO ODCZYCIE */
        delete roomCommands[room];

        fs.writeFileSync(LIGHT_FILE, JSON.stringify(roomCommands, null, 2));

        return res.json(cmd);
    }

    res.json({ status: 'no_command' });

});


/* =======================
   LIGHT STATE
======================= */

app.post('/api/light/state', (req, res) => {

    const { room, brightness } = req.body;

    roomState[room] = {
        brightness,
        time: Date.now()
    };

    res.json({ status: "ok" });

});


app.get('/api/light/state', (req, res) => {

    const { room } = req.query;

    if (room && roomState[room])
        return res.json(roomState[room]);

    res.json({ status: "offline" });

});




/* =======================
   START SERWERA
======================= */
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
    const reset = "\x1b[0m", cyan = "\x1b[36m", green = "\x1b[32m", magenta = "\x1b[35m", bold = "\x1b[1m";
    console.clear();
    console.log(green + bold + `
    ███╗   ███╗ █████╗ ███████╗████████╗███████╗██████╗ 
    ████╗ ████║██╔══██╗██╔════╝╚══██╔══╝██╔════╝██╔══██╗
    ██╔████╔██║███████║███████╗   ██║   █████╗  ██████╔╝
    ██║╚██╔╝██║██╔══██║╚════██║   ██║   ██╔════╝██╔══██╗
    ██║ ╚═╝ ██║██║  ██║███████║   ██║   ███████╗██║  ██║
    ╚═╝     ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚══════╝╚═╝  ╚═╝

         ██████╗  █████╗ ███╗   ██╗███████╗██╗     
         ██╔══██╗██╔══██╗████╗  ██║██╔════╝██║     
         ██████╔╝███████║██╔██╗ ██║█████╗  ██║     
         ██╔═══╝ ██╔══██║██║╚██╗██║██╔════╝██║     
         ██║     ██║  ██║██║ ╚████║███████╗███████╗
         ╚═╝     ╚═╝  ╚═╝╚═╝  ╚═══╝╚══════╝╚══════╝
    ` + reset);
    console.log(magenta + "   [================- SYSTEM AKTYWNY -================]" + reset);
    console.log(`      ${magenta}\\${reset}${magenta}\\${reset}------====${cyan}http://localhost:${PORT}${reset}====------ ${magenta}//${reset}`);
    console.log(magenta + "    |================================================|" + reset);
    console.log(green + "\n              		 --LOGI--\n" + reset);
});
