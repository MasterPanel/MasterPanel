// api/zamek.js

// Pamięć ostatniego polecenia dla zamka
let lockCommand = null;

export default async (req, res) => {
  if (req.method === 'POST') {
    const { cmd } = req.body;

    if (!cmd) {
      return res.status(400).json({ error: "wymagane polecenie" });
    }

    lockCommand = {
      cmd,
      timestamp: Date.now()
    };

    // logowanie w wymaganym formacie
    console.log(`[zamek] : ${cmd === "unlock" ? "Zablokowany" : "Odblokowany"}`);

    return res.status(200).json({ status: "ok", message: `polecenie wysłane: ${cmd}` });

  } else if (req.method === 'GET') {
    if (lockCommand) {
      // tu też log w czytelnej formie
      console.log(`[zamek] : ${lockCommand.cmd === "lock" ? "Zablokowany" : "Odblokowany"}`);

      const commandToSend = lockCommand;
      lockCommand = null; // wyzerowanie po odebraniu
      return res.status(200).json(commandToSend);
    } else {
      return res.status(200).json({ status: "brak poleceń" });
    }

  } else {
    return res.status(405).json({ error: "niedozwolone" });
  }
};