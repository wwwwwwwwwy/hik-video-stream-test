# HIK Video Stream Test

Minimal Bun C/S test project for H5player stream playback.

## Setup

Download the H5player frontend SDK files into `vendor/video-sdk`:

```bash
bun run sdk:download
```

Start the Bun server:

```bash
bun run dev
```

Open:

```text
http://127.0.0.1:8080/test-hik-video.html
```

## How It Works

- The browser loads the page and SDK from the Bun server.
- `/video-sdk/*` is served from local files in `vendor/video-sdk`.
- The frontend posts the input `ws://` or `wss://` stream URL to `/api/proxy-url`.
- The backend returns a local playback URL plus a `sessionID`.
- H5player connects only to the Bun server.
- The Bun server connects to the real upstream stream and forwards WebSocket frames in both directions.

## TLS Note

`bun run dev` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` because the current internal `wss://192.168.64.44:6014` endpoint uses a TLS certificate that Bun does not trust by default. Remove this setting when the upstream certificate is trusted.
