import lgtvFactory from 'lgtv2';
import express from 'express';
import cors from 'cors';
import wol from 'wake_on_lan';

/* =======================
   KONFIGURACJA
======================= */

let isConnected = false;
const TV_MAC_ADDRESS = '14:C9:13:BB:35:A5'; // Twój adres MAC
const TV_IP = '192.168.1.13';

const lgtv = lgtvFactory({
    url: `ws://${TV_IP}:3000`,
    timeout: 5000,
    reconnect: 3000
});

const app = express();
app.use(cors());

/* =======================
   LOGIKA POŁĄCZENIA
======================= */

lgtv.on('connect', () => {
    console.log('\x1b[32m[TV]\x1b[0m MASTER: Połączono z TV');
    isConnected = true;
});

lgtv.on('error', (err) => {
    isConnected = false;
});

lgtv.on('close', () => {
    console.log('\x1b[33m[STATUS]\x1b[0m Zamknięto połączenie z TV');
    isConnected = false;
});

/* =======================
   ENDPOINTY STATUSU I KONTROLI
======================= */

// Status połączenia
app.get('/status', (req, res) => {
    res.json({ online: isConnected });
});

// Główny endpoint dla pilota
app.get('/command/:cmd', (req, res) => {
    const cmd = req.params.cmd;

    // Lista komend wybudzających (dodano ENTER)
    const wakeUpCommands = ['POWER', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'HOME'];

    // OBSŁUGA WŁĄCZANIA (Wake-on-LAN)
    if (wakeUpCommands.includes(cmd) && !isConnected) {
        console.log(`\x1b[33m[WŁĄCZ]\x1b[0m TV offline. Trwa ${cmd} wybudzanie...`);
        wol.wake(TV_MAC_ADDRESS, (err) => {
            if (err) console.error('Błąd WoL:', err);
        });
        return res.json({ status: 'sent_wol' });
    }

    // MAPOWANIE KOMEND DO USŁUG WEBOS
    const commands = {
        'POWER':    'ssap://system/turnOff',
        'HOME':     'ssap://system.launcher/launch',
        'YOUTUBE':  'ssap://system.launcher/launch',
        'UP':       'ssap://com.webos.service.ircu/sendKey',
        'DOWN':     'ssap://com.webos.service.ircu/sendKey',
        'LEFT':     'ssap://com.webos.service.ircu/sendKey',
        'RIGHT':    'ssap://com.webos.service.ircu/sendKey',
        'ENTER':    'ssap://com.webos.service.ircu/sendKey',
        'VOL_UP':   'ssap://audio/volumeUp',
        'VOL_DOWN': 'ssap://audio/volumeDown'
    };

    if (!commands[cmd]) return res.sendStatus(404);

    if (!isConnected) {
        return res.status(503).json({ error: 'TV offline' });
    }

    // DEFINICJA PAYLOADU
    let payload = {};
    
    if (cmd === 'YOUTUBE') {
        payload = { id: 'youtube.leanback.v4' };
    } else if (cmd === 'HOME') {
        payload = { id: 'com.webos.app.home' };
    } else if (['UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER'].includes(cmd)) {
        // Mapowanie przycisku OK na klawisz ENTER w protokole LG
        payload = { keyName: cmd };
    }

    lgtv.request(commands[cmd], payload, (err, response) => {
        if (err) {
            console.error(`\x1b[31m[BŁĄD]\x1b[0m Komenda ${cmd} nieudana`);
            return res.status(500).json({ error: 'Request failed' });
        }
        res.json({ status: 'ok' });
    });
});

// Otwieranie linków
app.get('/open-url', (req, res) => {
    if (!isConnected) return res.status(503).json({ error: 'TV offline' });
    const encodedUrl = req.query.url;
    if (!encodedUrl) return res.sendStatus(400);
    const targetUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    console.log(`\x1b[36m[URL]\x1b[0m Otwieranie: ${targetUrl}`);

    lgtv.request('ssap://system.launcher/open', { target: targetUrl });
    res.json({status: 'ok'});
});

// Powiadomienia Toast
app.get('/toast', (req, res) => {
    if (!isConnected) return res.status(503).json({ error: 'TV offline' });
    const msg = req.query.msg || 'Wiadomość od Mastera';
    lgtv.request('ssap://system.notifications/createToast', { message: msg });
    res.sendStatus(200);
});

/* =======================
   START SERWERA
======================= */

app.listen(8080, '0.0.0.0', () => {
    const reset = "\x1b[0m";
    const cyan = "\x1b[36m";
    const green = "\x1b[32m";
    const magenta = "\x1b[35m";
    const bold = "\x1b[1m";

    console.clear();
    console.log(green + bold + `
  ████████╗██╗   ██╗    ██████╗ ██╗██╗      ██████╗ ████████╗
  ╚══██╔══╝██║   ██║    ██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝
     ██║   ██║   ██║    ██████╔╝██║██║     ██║   ██║   ██║   
     ██║   ╚██╗ ██╔╝    ██╔═══╝ ██║██║     ██║   ██║   ██║   
     ██║    ╚████╔╝     ██║     ██║███████╗╚██████╔╝   ██║   
     ╚═╝     ╚═══╝      ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝   
    ` + reset);

    console.log(magenta + "   [================- SYSTEM AKTYWNY -================]" + reset);
    console.log(`      ${magenta}\\${reset}${magenta}\\${reset}------====${cyan}PILOT DO LG WEBOS TV\\${reset}====------ ${magenta}//${reset}`);
    console.log(magenta + "    |================================================|" + reset);
    console.log(green + "\n              		 --LOGI--\n" + reset);
});
