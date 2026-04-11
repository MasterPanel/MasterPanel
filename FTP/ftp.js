// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 5000;
const UPLOAD_FOLDER = 'uploaded_files';

// --- Konfiguracja Multer (do obsługi przesyłania plików) ---
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        // Upewniamy się, że katalog istnieje
        if (!fs.existsSync(UPLOAD_FOLDER)) {
            fs.mkdirSync(UPLOAD_FOLDER);
        }
        cb(null, UPLOAD_FOLDER);
    },
    filename: function (req, file, cb) {
        // Zapisz plik pod oryginalną nazwą
        cb(null, file.originalname);
    }
});

// Tworzenie instancji Multer do obsługi pola 'myFile' z formularza
const upload = multer({ storage: storage }).single('myFile');

// --- Trasy (Routes) ---

// 1. Serwowanie statycznych plików (w tym FTP.html)
// Umożliwia dostęp do FTP.html pod adresem /
app.get('/', (req, res) => {
    // Zakładamy, że FTP.html jest w tym samym katalogu co server.js
    res.sendFile(path.join(__dirname, 'FTP.html'));
});

// Opcjonalnie: serwowanie obrazka tła (jeśli nie jest ładowany z zewnętrznego URL)
// app.get('/3.jpg', (req, res) => {
//     res.sendFile(path.join(__dirname, '3.jpg'));
// });


// 2. Przesyłanie plików (POST /upload)
app.post('/upload', (req, res) => {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            // Wystąpił błąd Multer (np. zbyt duży plik)
            console.error('Błąd Multer:', err);
            return res.status(500).send('Błąd przesyłania: ' + err.message);
        } else if (err) {
            // Inny błąd
            console.error('Nieznany błąd:', err);
            return res.status(500).send('Wystąpił nieznany błąd serwera.');
        }

        // Sprawdzenie, czy plik został faktycznie przesłany
        if (!req.file) {
            return res.status(400).send('Proszę wybrać plik do przesłania.');
        }

        // Sukces
        res.status(200).send(`Plik "${req.file.originalname}" został pomyślnie przesłany.`);
    });
});


// 3. Pobieranie listy plików (GET /files)
app.get('/files', (req, res) => {
    fs.readdir(UPLOAD_FOLDER, (err, files) => {
        if (err) {
            console.error('Błąd odczytu katalogu:', err);
            return res.status(500).json({ error: 'Błąd serwera podczas listowania plików.' });
        }
        
        // Filtrowanie tylko plików (opcjonalne, ale zalecane)
        const fileList = files.filter(file => {
            return fs.statSync(path.join(UPLOAD_FOLDER, file)).isFile();
        });

        res.json(fileList);
    });
});

// 4. Pobieranie konkretnego pliku (GET /files/:filename)
// Używamy express.static do łatwej obsługi pobierania plików
app.use('/files', express.static(path.join(__dirname, UPLOAD_FOLDER)));


app.listen(5000, '0.0.0.0', () => {
    const reset = "\x1b[0m";
    const cyan = "\x1b[36m";
    const yellow = "\x1b[33m";
    const green = "\x1b[32m";
    const magenta = "\x1b[35m";
    const bold = "\x1b[1m";

    console.clear();
    
    // logo 
    console.log(green + bold + `
      ███████████ ███████████ ███████████ 
     ░░███░░░░░░█░█░░░███░░░█░░███░░░░░███
      ░███   █ ░ ░   ░███  ░  ░███    ░███
      ░███████       ░███     ░██████████ 
      ░███░░░█       ░███     ░███░░░░░░  
      ░███  ░        ░███     ░███        
      █████          █████    █████       
     ░░░░░          ░░░░░    ░░░░░                   
   
    ` + reset);

    console.log(magenta + "   [================- SYSTEM AKTYWNY -================]" + reset);
    console.log(`      ${magenta}\\${reset}${magenta}\\${reset}-------=====${cyan}  Serwer Plików =====------- ${magenta}//${reset}`);

    console.log(magenta + "    |================================================|" + reset);
})


