import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Server } from 'socket.io';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

/* ========================================================
   ZMIENNE GLOBALNE I PLIKI
   ======================================================== */
const CHAT_FILE = path.join(__dirname, 'chatData.json');
const DATA_FILE = path.join(__dirname, 'dhtData.json');
const LIGHT_FILE = path.join(__dirname, 'lightData.json');

let devices = {};
let lastLogTime = {};
const GPS_INACTIVITY_TIMEOUT = 30000;

// Inicjalizacja plików jeśli nie istnieją
[CHAT_FILE, DATA_FILE, LIGHT_FILE].forEach(file => {
    if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(file === CHAT_FILE ? [] : {}, null, 2));
});

let roomCommands = JSON.parse(fs.readFileSync(LIGHT_FILE, 'utf8'));
let dhtData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
let roomState = {};

/* ========================================================
   MIDDLEWARE & FIXES
   ======================================================== */
app.use((req, res, next) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));

/* ========================================================
   OBSŁUGA SOCKET.IO (Mózg systemu)
   ======================================================== */
io.on('connection', (socket) => {
    console.log(`\x1b[36m[LOG]\x1b[0m Połączono: ${socket.id}`);
    
    // Wyślij startowe dane do klienta
    socket.emit('allDevices', Object.values(devices));
    socket.emit('initStates', { rooms: roomCommands, sensors: dhtData });

    // Obsługa sterowania z poziomu Panelu (Frontend -> Serwer -> ESP32)
    socket.on('setLight', (data) => {
        const { room, brightness } = data;
        roomCommands[room] = { brightness: parseInt(brightness), timestamp: Date.now() };
        
        fs.writeFile(LIGHT_FILE, JSON.stringify(roomCommands, null, 2), () => {});
        
        // Wyślij rozkaz do ESP32 i zaktualizuj inne panele
        io.emit('commandUpdate', { room, brightness });
        console.log(`[LIGHT] ${room} -> ${brightness}%`);
    });

    socket.on('disconnect', () => {
        console.log(`\x1b[31m[LOG]\x1b[0m Rozłączono: ${socket.id}`);
    });
});

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
        console.log(`[TV] Przekazuję komendę: ${cmd} ...`);
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
/* ========================================================
   API - POMIARY (DHT)
   ======================================================== */
app.get('/api/dht', (req, res) => res.json(dhtData));

app.post('/api/dht', (req, res) => {
    const { room, temp, hum } = req.body;
    if (room) {
        dhtData[room] = { temp, hum, timestamp: Date.now() };
        fs.writeFile(DATA_FILE, JSON.stringify(dhtData, null, 2), () => {});
        
        // Powiadom frontend o nowych pomiarach natychmiast
        io.emit('sensorUpdate', { room, temp, hum });
        return res.json({ status: "ok" });
    }
    res.status(400).json({ error: "Brak danych" });
});

/* ========================================================
   API - STEROWANIE (KOMPATYBILNOŚĆ WSTECZNA)
   ======================================================== */
app.all('/api/commands', (req, res) => {
    if (req.method === 'POST') {
        const { room, brightness } = req.body;
        roomCommands[room] = { brightness: parseInt(brightness), timestamp: Date.now() };
        fs.writeFile(LIGHT_FILE, JSON.stringify(roomCommands, null, 2), () => {});
        
        io.emit('commandUpdate', { room, brightness }); // WebSocket push
        return res.json({ status: 'ok', room, brightness });
    }
    const { room } = req.query;
    res.json(room ? (roomCommands[room] || { brightness: 0 }) : roomCommands);
});

/* ========================================================
   GPS TRACKING
   ======================================================== */
app.post('/update-location', (req, res) => {
    const { id, lat, lng, accuracy } = req.body;
    if (id && lat && lng) {
        devices[id] = { id, lat, lng, accuracy: accuracy || 15, lastSeen: Date.now() };
        io.emit('locationUpdate', { id, coords: [lng, lat], accuracy });
        res.status(200).send('OK');
    } else res.status(400).send('Err');
});

/* ========================================================
   POZOSTAŁE FUNKCJE (TV, POWER, CHAT)
   ======================================================== */
// ... (Tutaj pozostaje Twoja oryginalna logika TV i Power Bridge bez zmian) ...
app.post('/api/chat', (req, res) => { /* Twój oryginalny kod czatu */ });
app.get('/api/chat', (req, res) => { /* Twój oryginalny kod czatu */ });


/* =======================
   START SERWERA
======================= */
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
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
