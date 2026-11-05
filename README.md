# Kitti Online — updated build

## What changed
- The discard-first screen is removed. Players receive 13 cards, arrange 12 into four 3-card rounds, and the remaining card is automatically set aside privately.
- Four round spaces are shown at once. Players can tap-select cards and tap a round, or drag cards into a round. Cards can be moved between rounds or returned to the hand.
- The hand is displayed in a fan layout.
- Ready locks the arrangement; Unready allows edits. The lobby shows Ready x/4.
- The host can start with 2, 3, or 4 human players. Empty seats are filled by bots.
- Bots automatically arrange their hands and play when their turn arrives.
- The four human video tiles use queued WebRTC signaling and ICE candidate buffering. Bot seats show robot avatars.
- The host can kick people from the lobby.

## Deploy update to your existing Render service
1. Replace the files in your GitHub repository with the files in this ZIP (keep the repository root as the contents of this `kitti-online` folder).
2. Commit the changes.
3. Render should detect the GitHub commit and deploy automatically. If it does not, use Manual Deploy → Deploy latest commit.
4. Open your existing public Render URL and test in separate browser/device sessions.

## Important voice/video limitation
This version fixes the signaling logic that previously dropped early offers and ICE candidates, and creates a mesh between all human players. It includes public STUN servers only. STUN alone cannot guarantee audio/video through every mobile carrier, office firewall, or restrictive NAT. For reliable public calls, configure a TURN relay (for example, a paid TURN provider) and add its ICE server URL/username/credential to the `iceServers` list in `public/index.html`. Each player must click **Enable camera & microphone** and grant browser permissions. Do not promise universal connectivity until tested across the networks your players use.

## Run locally
Requires Node.js 20+. Run `npm install`, then `npm start`, and open `http://localhost:3000`.

## Current known scope
- Rooms are stored in server memory; a server restart/redeploy clears active rooms.
- A disconnected human cannot reclaim their seat by refreshing.
- The game is a private-room prototype, not a hardened commercial service. Test with four separate devices before sharing widely.
