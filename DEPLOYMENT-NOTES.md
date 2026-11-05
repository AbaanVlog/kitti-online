# Deployment notes

Deploy as a Node.js web service, not a static site. Start command: `npm start`. Health check: `/health`.

For dependable four-person voice/video on the public internet, configure a TURN relay. The bundled client currently has STUN only; WebRTC may fail on restrictive NATs or firewalls. TURN credentials must be obtained from a TURN provider and added to the `iceServers` array in `public/index.html`. Never commit private TURN credentials to a public GitHub repository; use a server-generated client config or a private repository/secret configuration for production.

The server stores room state in memory and does not support reconnecting a player after a browser refresh. Free hosting may sleep when idle.
