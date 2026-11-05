#!/bin/bash
cd "$(dirname "$0")"
clear
 echo "=================================="
 echo "        KITTI ONLINE"
 echo "=================================="
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "Node.js is needed to run this game. Opening the download page..."
  open "https://nodejs.org/"
  echo "Install the LTS version, then double-click Start Kitti.command again."
  read -r -p "Press Enter to close..."
  exit 1
fi
NODE_MAJOR=$(node -p 'Number(process.versions.node.split(".")[0])')
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "This game needs Node.js 20 or newer. Opening the download page..."
  open "https://nodejs.org/"
  echo "Install the LTS version, then double-click Start Kitti.command again."
  read -r -p "Press Enter to close..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "First-time setup: installing game files. This may take a minute..."
  npm install || { echo "Installation failed. Please send a screenshot of this window."; read -r; exit 1; }
fi
echo "Starting Kitti..."
(open "http://localhost:3000" >/dev/null 2>&1 || true)
npm start
