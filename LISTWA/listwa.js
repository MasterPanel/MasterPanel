const TuyaDevice = require('tuyapi');
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const device = new TuyaDevice({
    id: '5512065270039f4d24f4',
    key: "5d/'4xk8I}`Pj0@C",
    ip: '192.168.1.70',
    version: '3.3'
});

// Stan połączenia
let isConnected = false;

// Funkcja utrzymująca połączenie
async function connectDevice() {
    try {
        if (!isConnected) {
            console.log("Próba nawiązania połączenia z listwą...");
            await device.find();
            await device.connect();
        }
    } catch (err) {
        console.error("Błąd podczas inicjalizacji połączenia:", err.message);
        isConnected = false;
        // Ponowna próba za 5 sekund w przypadku niepowodzenia
        setTimeout(connectDevice, 5000);
    }
}

// Obsługa zdarzenia błędu urządzenia - KLUCZOWE dla uniknięcia ECONNRESET crash
device.on('error', (err) => {
    console.error('\x1b[33m%s\x1b[0m', `Błąd komunikacji z urządzeniem: ${err.message}`);
    isConnected = false;
    // Nie zamykamy procesu, pozwalamy bibliotece lub zdarzeniu 'disconnected' obsłużyć reconnect
});

device.on('connected', () => {
    isConnected = true;
    console.log('\x1b[32m%s\x1b[0m', 'Status: Połączono z listwą!');
});

device.on('disconnected', () => {
    isConnected = false;
    console.log('\x1b[31m%s\x1b[0m', 'Status: Rozłączono z listwą, próbuję połączyć ponownie...');
    // Opóźnienie ponownego łączenia, aby uniknąć pętli przy błędach sieci
    setTimeout(connectDevice, 5000);
});

// Inicjalizacja połączenia
connectDevice();

// API: Pobieranie statusu
app.get('/status', async (req, res) => {
    try {
        if (!isConnected) throw new Error("Urządzenie nie jest jeszcze połączone");
        // Parametr schema: true pozwala pobrać mapę wszystkich punktów danych
        const status = await device.get({schema: true});
        res.json(status.dps);
    } catch (error) {
        console.error("Błąd API /status:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// API: Sterowanie
app.post('/control', async (req, res) => {
    const { dp, value } = req.body;
    try {
        if (!isConnected) throw new Error("Urządzenie nie jest połączone");
        // Ustawienie konkretnego punktu danych (DP)
        await device.set({ dps: dp, set: value });
        res.json({ success: true });
    } catch (error) {
        console.error("Błąd API /control:", error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obsługa błędów krytycznych - zapobiega "cichemu" zawieszeniu
process.on('uncaughtException', (err) => {
    console.error('KRYTYCZNY BŁĄD (uncaughtException):', err.message);
    // Jeśli błąd to nie socket, wychodzimy, aby PM2 zrestartował aplikację
    if (!err.message.includes('socket')) {
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('NIEPRZECHWYCONA OBIETNICA (unhandledRejection):', reason);
    process.exit(1);
});

app.listen(4000, '0.0.0.0', () => {
    const reset = "\x1b[0m";
    const cyan = "\x1b[36m";
    const yellow = "\x1b[33m";
    const green = "\x1b[32m";
    const magenta = "\x1b[35m";
    const bold = "\x1b[1m";

    console.clear();
    
    // logo 
    console.log(green + bold + `
   ██╗     ██╗███████╗████████╗██╗    ██╗ █████╗ 
   ██║     ██║██╔════╝╚══██╔══╝██║    ██║██╔══██╗
   ██║     ██║███████╗   ██║   ██║ █╗ ██║███████║
   ██║     ██║╚════██║   ██║   ██║███╗██║██╔══██║
   ███████╗██║███████║   ██║   ╚███╔███╔╝██║  ██║
   ╚══════╝╚═╝╚══════╝   ╚═╝    ╚══╝╚══╝ ╚═╝  ╚═╝
    ` + reset);

    console.log(magenta + "   [================- SYSTEM AKTYWNY -================]" + reset);
    console.log(`      ${magenta}\\${reset}${magenta}\\${reset}-------=====${cyan}LISTWA ZASILAJĄCA=====------- ${magenta}//${reset}`);
    console.log(magenta + "    |================================================|" + reset);
});
