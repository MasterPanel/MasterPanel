import express from 'express';
import cors from 'cors';
import pkg from '@tuya/tuya-connector-nodejs';
const { TuyaContext } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// --- KONFIGURACJA TUYA ---
const context = new TuyaContext({
  baseUrl: 'https://openapi.tuyaeu.com',
  accessKey: 'rgk9jd55a95f3e8undhf',
  secretKey: 'bf54f53674b943aba6ca1148b9e5e114', // <--- WPISZ TUTAJ SWÓJ SECRET KEY
});

const DEVICE_ID = '002616442462ab4822cb';

// --- FRONTEND ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="pl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="theme-color" content="#000">

    <title>Master Panel</title>
            <style>
                body { font-family: sans-serif; display: flex; justify-content: center; padding: 50px; background: #222; }
                .card { background: #111; padding: 30px; border-radius: 15px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center; width: 300px; }
                button { width: 100%; padding: 105px; margin: 10px 0; border: none; border-radius: 8px; cursor: pointer; font-weight: bold; color: white; font-size: 16px; }
                .on { background: #10b981; }
                .off { background: #ef4444; }
                #status { margin-top: 15px; color: #666; }
            </style>
        </head>
        <body>
            <div class="card">
                <h2>Master Gniazdo</h2>
                <button class="on" onclick="sendAction(true)">WŁĄCZ</button>
                <button class="off" onclick="sendAction(false)">WYŁĄCZ</button>
                <div id="status">Gotowy</div>
            </div>
            <script>
                async function sendAction(state) {
                    const status = document.getElementById('status');
                    status.innerText = 'Wysyłanie...';
                    try {
                        const response = await fetch('/control', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ power: state })
                        });
                        const result = await response.json();
                        status.innerText = result.success ? 'Wykonano pomyślnie' : 'Błąd: ' + result.msg;
                    } catch (e) {
                        status.innerText = 'Błąd serwera';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// --- BACKEND ---
app.post('/control', async (req, res) => {
    const powerState = req.body.power;
    
    try {
        const result = await context.request({
            path: '/v1.0/devices/' + DEVICE_ID + '/commands',
            method: 'POST',
            body: {
                commands: [{ code: 'switch_1', value: powerState }]
            }
        });
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, msg: error.message });
    }
});

app.listen(3000, '0.0.0.0', () => {
    const reset = "\x1b[0m";
    const cyan = "\x1b[36m";
    const yellow = "\x1b[33m";
    const green = "\x1b[32m";
    const magenta = "\x1b[35m";
    const bold = "\x1b[1m";

    console.clear();
    
    // logo 
    console.log(green + bold + `
 ██████   ██████                    █████                        
░░██████ ██████                    ░░███                         
 ░███░█████░███   ██████    █████  ███████    ██████  ████████   
 ░███░░███ ░███  ░░░░░███  ███░░  ░░░███░    ███░░███░░███░░███  
 ░███ ░░░  ░███   ███████ ░░█████   ░███    ░███████  ░███ ░░░   
 ░███      ░███  ███░░███  ░░░░███  ░███ ███░███░░░   ░███       
 █████     █████░░████████ ██████   ░░█████ ░░██████  █████      
░░░░░     ░░░░░  ░░░░░░░░ ░░░░░░     ░░░░░   ░░░░░░  ░░░░░       
                                                                 
                                                                 
                                                                 
     ███████████                                ████                 
    ░░███░░░░░███                              ░░███                 
     ░███    ░███  ██████   ████████    ██████  ░███                 
     ░██████████  ░░░░░███ ░░███░░███  ███░░███ ░███                 
     ░███░░░░░░    ███████  ░███ ░███ ░███████  ░███                 
     ░███         ███░░███  ░███ ░███ ░███░░░   ░███                 
     █████       ░░████████ ████ █████░░██████  █████                
    ░░░░░         ░░░░░░░░ ░░░░ ░░░░░  ░░░░░░  ░░░░░                 
   
    ` + reset);

    console.log(magenta + "   [================- SYSTEM AKTYWNY -================]" + reset);
    console.log(`      ${magenta}\\${reset}${magenta}\\${reset}-------=====${cyan}    Gniazdo	    =====------- ${magenta}//${reset}`);

    console.log(magenta + "    |================================================|" + reset);
})


