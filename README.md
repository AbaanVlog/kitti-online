# Kitti Online

## Easiest way to test on a Mac
1. Install Node.js LTS from https://nodejs.org if it is not already installed.
2. Extract this ZIP file.
3. Double-click **Start Kitti.command**. It installs the required packages the first time and opens the game at http://localhost:3000.
4. Keep the black Terminal window open while playing.

If macOS blocks the file, Control-click it, choose Open, then confirm Open.

## Test with four players
Open four browser windows/profiles on the same computer and join the same room code. For friends on other devices, the game must first be deployed to an online Node.js host.

## Technical notes
This is a starter project, not a deployed service. Voice/video uses WebRTC with a public STUN server; some networks need a TURN relay for reliable connections. Node.js 20 or newer is required.
