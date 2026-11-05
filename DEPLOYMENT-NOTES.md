# Public deployment notes

This project is a Node.js + Express + Socket.IO web service. It must be deployed as a persistent web service/container, not as a static site.

## Container
- Dockerfile included.
- Listens on `process.env.PORT` (fallback 3000).
- Health endpoint: `/health`.

## Render
The included `render.yaml` describes a Docker web service. Render's standard workflow still requires a connected Git repository; it does not deploy this ZIP by itself. Create a Git repository containing these files, then create a Blueprint/Web Service from it.

## Important limitations before a public launch
- Room state is held in server memory; rooms disappear on restart/redeploy and this is not horizontally scalable.
- Players cannot reconnect after disconnect in this starter build.
- WebRTC currently relies on public STUN only. Some networks will need a TURN relay for reliable audio/video.
- Add abuse protection/rate limits and test four separate devices before promoting as a production game.
