# HIK Video Stream Test

Minimal Node.js C/S test project for H5player stream playback.

## Setup

Download the H5player frontend SDK files into `vendor/video-sdk`:

```bash
npm run sdk:download
```

Start the Node.js server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:8080/test-hik-video.html
```

## How It Works

- The browser loads the page and SDK from the Node.js server.
- `/video-sdk/*` is served from local files in `vendor/video-sdk`.
- The frontend posts the input `ws://` or `wss://` stream URL to `/api/proxy-url`.
- The backend returns a local playback URL plus a `sessionID`.
- H5player connects only to the Node.js server.
- The Node.js server connects to the real upstream stream and forwards WebSocket frames in both directions.

## TLS Note

`npm run dev` sets `NODE_TLS_REJECT_UNAUTHORIZED=0` because the current internal `wss://192.168.64.44:6014` endpoint uses a TLS certificate that Node.js does not trust by default. Remove this setting when the upstream certificate is trusted.
