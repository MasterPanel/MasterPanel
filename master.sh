#!/bin/bash

cd ~/Desktop/API || { echo "Nie znaleziono katalogu ~/Desktop/API"; exit 1; }

echo "Uruchamianie serv.js i tvtxt.js..."
node serv.js &
sleep 5
node tvtxt.js &

sleep 2

cd ~/Desktop/API/LISTWA || { echo "Nie znaleziono katalogu LISTWA"; exit 1; }

echo "Uruchamianie listwa.js..."
node listwa.js &

sleep 2

echo "Uruchamianie ngrok na porcie 3000..."
ngrok http 3000
