// api/commands.js

// Pamięć poleceń dla każdego pokoju
let roomCommands = {};  
// struktura np. { salon: { brightness: 100, timestamp: ... }, sypialnia: {...} }

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => (n < 10 ? "0" + n : n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default async (req, res) => {
  if (req.method === 'POST') {
    const { room, brightness } = req.body;
    if (!room) {
      return res.status(400).json({ error: "Room is required" });
    }
    const ts = Date.now();
    roomCommands[room] = {
      brightness: brightness,
      timestamp: ts
    };

    // log w żądanym formacie
    console.log(`[${room}] Jasność : ${brightness} , Czas: ${formatTime(ts)}`);

    res.status(200).json({ status: 'ok', message: `Command stored for ${room}` });

  } else if (req.method === 'GET') {
    const { room } = req.query;

    if (!room) {
      return res.status(200).json(roomCommands);
    }

    if (roomCommands[room]) {
      const cmd = roomCommands[room];
      console.log(`[${room}] Jasność : ${cmd.brightness} , Czas: ${formatTime(cmd.timestamp)}`);

      const commandToSend = cmd;
      delete roomCommands[room];
      res.status(200).json(commandToSend);
    } else {
      res.status(200).json({ status: 'no_command' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
};