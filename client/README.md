# Antesala client: route recorder

`/grabar` records the walk-through (entrance → reception → waiting room → consultation → exit) on a
phone, warns in real time about dark or too-fast footage, and uploads it to `POST {API}/guia`.
Main target: Safari on iOS 16+. Chrome Android works too. Only browser APIs are used
(getUserMedia, MediaRecorder, Canvas, DeviceMotionEvent).

## Run

```bash
npm install
npm run dev          # http://localhost:3000/grabar
npm run dev:https    # same, over HTTPS (self-signed certificate in certificates/, git-ignored)
npm test             # unit tests (pure logic + upload); run `npm run build` first for build.test.ts
```

## Test on an iPhone

The camera only works on HTTPS (or `localhost`), so the iPhone cannot open `http://<LAN-IP>:3000`.
The easiest way is a tunnel to the dev server, which gives a trusted HTTPS URL:

```bash
npm run dev
cloudflared tunnel --url http://localhost:3000   # or: ngrok http 3000
```

Open the printed `https://…` URL + `/grabar` in Safari. `next.config.ts` already allows
`*.trycloudflare.com` and `*.ngrok-free.*` as dev origins. The upload goes to `/api/guia`, forwarded
to `API_PROXY_TARGET` (default `http://localhost:8000`), so the backend must expose that route.
If the upload fails, the app offers the video and the metadata JSON as downloads.

## Tune the limits on site

Open `/grabar?debug=1`: an overlay shows the live luminance, rotation (°/s), frame difference, the
motion source (gyro or frames), the recorder mimeType and the real camera resolution/fps. Compare
those numbers with the thresholds in `RECORDING` (`lib/config.ts`):

| Setting | Default | Meaning |
| --- | --- | --- |
| `light` | 60, +10, 1.5 s / 1 s | luminance 0–255; alert below, clears above threshold + margin |
| `gyro` | 60 °/s, 1 s / 1 s | rotation speed; alert above, clears below threshold − margin |
| `frameDiff` | 30, 1 s / 1 s | no-sensor fallback: mean frame difference 0–255 |
| `maxDurationSec` | 120 | automatic stop |
| `videoBitsPerSecond` | 2.5 Mbps | recorder bitrate |

All UI text is in `lib/i18n/es.ts`.

## Layout

- `app/grabar/page.tsx`: state machine `intro → permisos → listo → grabando → revision → enviando → hecho | error`
- `lib/use*.ts`: camera, recorder, frame sampler, light/motion monitors, alert log
- `lib/pure/`: luminance, frame difference, hysteresis, alert log, mimeType (unit-tested)
- `lib/upload.ts`: multipart POST with progress (XMLHttpRequest) and download fallback
