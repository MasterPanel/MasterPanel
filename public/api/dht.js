// api/dht.js
import fs from 'fs';
import path from 'path';

// Ścieżka do pliku tymczasowego (Vercel pozwala tylko na zapis do /tmp)
const DATA_FILE = path.join('/tmp', 'dhtData.json');

// Pamięć danych DHT dla wszystkich pokoi
let dhtData = {};

// Próba wczytania danych z poprzedniej sesji
try {
  if (fs.existsSync(DATA_FILE)) {
    const saved = fs.readFileSync(DATA_FILE, 'utf8');
    dhtData = JSON.parse(saved);
    console.log("Odtworzono dane z pliku /tmp/dhtData.json");
  }
} catch (err) {
  console.error("Błąd wczytywania danych:", err);
  dhtData = {};
}

// Funkcja formatująca czas
function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Funkcja czyszcząca stare dane (starsze niż 1 godzina)
function cleanupOldData() {
  const now = Date.now();
  const HOUR_MS = 60 * 60 * 1000;
  let removed = 0;

  for (const room in dhtData) {
    if (now - dhtData[room].time > HOUR_MS) {
      delete dhtData[room];
      removed++;
    }
  }

  if (removed > 0) {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(dhtData, null, 2), 'utf8');
      console.log(`Usunięto ${removed} starych wpisów z /tmp/dhtData.json`);
    } catch (err) {
      console.error("Błąd zapisu po czyszczeniu:", err);
    }
  }
}

// Uruchamianie automatycznego czyszczenia co 10 minut
setInterval(cleanupOldData, 10 * 60 * 1000);

// Główna funkcja API
export default function handler(req, res) {
  // Nagłówki CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Obsługa POST (zapis danych)
  if (req.method === 'POST') {
    const { room, temp, hum } = req.body;

    if (!room || temp === undefined || hum === undefined) {
      return res.status(400).json({ error: "Wymagane parametry: room, temp, hum" });
    }

    const ts = Date.now();
    const formattedRoom = room.toLowerCase();

    dhtData[formattedRoom] = {
      temp: parseFloat(temp).toFixed(1),
      hum: parseFloat(hum).toFixed(1),
      time: ts,
      timeFormatted: formatTime(ts),
    };

    // Zapis do pliku
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(dhtData, null, 2), 'utf8');
    } catch (err) {
      console.error("Błąd zapisu pliku:", err);
    }

    console.log(`[${room}] Zapisano: Temp=${dhtData[formattedRoom].temp}°C, Hum=${dhtData[formattedRoom].hum}%, Czas=${dhtData[formattedRoom].timeFormatted}`);

    return res.status(200).json({
      message: `Dane dla ${room} zapisane.`,
      data: dhtData[formattedRoom],
    });
  }

  // Obsługa GET (pobranie danych)
  if (req.method === 'GET') {
    cleanupOldData(); // Czyszczenie przy każdym zapytaniu
    return res.status(200).json(dhtData);
  }

  res.setHeader('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).end(`Method ${req.method} Not Allowed`);
}