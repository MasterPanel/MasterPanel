import lgtvFactory from 'lgtv2';
import express from 'express';
import cors from 'cors';
import wol from 'wake_on_lan';

/* KONFIGURACJA 
*/
const TV_IP = '192.168.1.13';
const TV_MAC = '14:C9:13:BB:35:A5';

const app = express();
app.use(cors());

const lgtv = lgtvFactory({
    url: `ws://${TV_IP}:3000`,
    timeout: 5000,
    reconnect: 3000
});

let isConnected = false;
let pointerSocket = null;

/* LOGIKA POŁĄCZENIA - KLUCZOWA DLA webOS 3.x
*/
lgtv.on('connect', () => {
    console.log('\x1b[32m[SYSTEM]\x1b[0m Połączono z LG webOS 3.4.0');
    isConnected = true;

    // Uzyskanie specjalnego gniazda dla D-Pad (to rozwiązuje problem braku reakcji)
    lgtv.request('ssap://com.webos.service.ircu/getPointerInputSocket', (err, res) => {
        if (!err && res && res.socketPath) {
            lgtv.getSocket(res.socketPath, (sErr, sock) => {
                if (!sErr && sock) {
                    pointerSocket = sock;
                    console.log('\x1b[35m[INPUT]\x1b[0m Gniazdo wskaźnika aktywne. D-Pad odblokowany.');
                }
            });
        }
    });
});

lgtv.on('error', () => { isConnected = false; pointerSocket = null; });
lgtv.on('close', () => { isConnected = false; pointerSocket = null; });

/* API STEROWANIA
*/
app.get('/api/tv/status', (req, res) => res.json({ online: isConnected }));

app.get('/api/tv/command/:cmd', (req, res) => {
    const cmd = req.params.cmd.toUpperCase();
    
    if (cmd === 'POWER' && !isConnected) {
        wol.wake(TV_MAC);
        return res.json({ status: 'wol_sent' });
    }

    if (!isConnected) return res.status(503).json({ error: 'TV offline' });

    // Obsługa D-Pada przez fizyczny tunel (Pointer Socket)
    const dpad = ['UP', 'DOWN', 'LEFT', 'RIGHT', 'ENTER', 'BACK'];
    if (dpad.includes(cmd) && pointerSocket) {
        // W webOS 3.x komenda 'click' jest pewniejsza niż 'ENTER'
        const keyName = (cmd === 'ENTER') ? 'click' : cmd;
        pointerSocket.send('button', { name: keyName });
        console.log(`[POINTER] Wysłano: ${keyName}`);
        return res.json({ status: 'ok_pointer' });
    }

    // Pozostałe funkcje (Głośność, Home, Power)
    const commands = {
        'VOL_UP':   'ssap://audio/volumeUp',
        'VOL_DOWN': 'ssap://audio/volumeDown',
        'POWER':    'ssap://system/turnOff',
        'HOME':     'ssap://system.launcher/launch'
    };

    const uri = commands[cmd];
    const payload = (cmd === 'HOME') ? { id: 'com.webos.app.home' } : {};

    lgtv.request(uri, payload, (err) => {
        if (err) console.error(`[BŁĄD ${cmd}]`, err.message);
        res.json({ status: err ? 'error' : 'ok' });
    });
});

/* FRONTEND - JEDEN PLIK
*/
const htmlContent = `
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>MasterOS Remote</title>
    <style>
        body { background: #080808; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
        .remote { background: #121212; padding: 40px; border-radius: 60px; border: 1px solid #252525; box-shadow: 0 30px 60px rgba(0,0,0,0.8); text-align: center; }
        .status { font-size: 9px; letter-spacing: 2px; margin-bottom: 20px; color: #444; transition: 0.3s; }
        .status.on { color: #00ff88; text-shadow: 0 0 10px #00ff8866; }
        .grid { display: grid; grid-template-columns: repeat(3, 80px); gap: 15px; margin: 25px 0; }
        button { background: #1a1a1a; border: 1px solid #333; color: #fff; border-radius: 20px; font-size: 20px; padding: 22px; cursor: pointer; transition: 0.1s; }
        button:active { background: #444; transform: scale(0.9); }
        .btn-pwr { background: #b71c1c; grid-column: span 3; font-size: 13px; font-weight: bold; margin-bottom: 10px; border: none; }
        .btn-home { background: #0d47a1; border: none; }
    </style>
</head>
<body>
    <div class="remote">
        <div id="st" class="status">POŁĄCZENIE PRZERWANE</div>
        <button class="btn-pwr" onclick="s('POWER')">POWER SYSTEM</button>
        <div class="grid">
            <div></div><button onclick="s('UP')">▲</button><div></div>
            <button onclick="s('LEFT')">◀</button>
            <button style="background:#333" onclick="s('ENTER')">OK</button>
            <button onclick="s('RIGHT')">▶</button>
            <div></div><button onclick="s('DOWN')">▼</button><div></div>
        </div>
        <div class="grid">
            <button onclick="s('VOL_UP')">+</button>
            <button class="btn-home" onclick="s('HOME')">HOME</button>
            <button onclick="s('VOL_DOWN')">-</button>
        </div>
    </div>
    <script>
        async function s(c) {
            if(navigator.vibrate) navigator.vibrate(40);
            fetch('/api/tv/command/' + c).catch(() => {});
        }
        async function update() {
            try {
                const r = await fetch('/api/tv/status');
                const d = await r.json();
                const e = document.getElementById('st');
                e.innerText = d.online ? 'MASTER LINK: ACTIVE' : 'MASTER LINK: OFFLINE';
                e.className = 'status' + (d.online ? ' on' : '');
            } catch(e) {}
        }
        setInterval(update, 3000);
        update();
    </script>
</body>
</html>
`;

app.get('/', (req, res) => res.send(htmlContent));

app.listen(8080, '0.0.0.0', () => {
    console.clear();
    console.log('\x1b[36m%s\x1b[0m', '====================================');
    console.log('\x1b[36m%s\x1b[0m', ' MASTER REMOTE v3 (webOS 3.x FIX)   ');
    console.log('\x1b[36m%s\x1b[0m', ' Adres: http://' + 'TWOJE_IP_MALINY' + ':8080');
    console.log('\x1b[36m%s\x1b[0m', '====================================');
});
