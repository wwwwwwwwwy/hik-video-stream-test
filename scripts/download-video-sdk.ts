import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const baseUrl = 'https://dev.meos.center/iot-message-notification/video-sdk';
const outputDir = join(process.cwd(), 'vendor', 'video-sdk');

const requiredFiles = [
  'h5player.min.js',
  'playctrl1/Decoder.js',
  'playctrl1/DecodeWorker.js',
  'playctrl1simd/Decoder.js',
  'playctrl1simd/DecodeWorker.js',
  'playctrl2/Decoder.js',
  'playctrl2/DecodeWorker.js',
  'playctrl3/Decoder.js',
  'playctrl3/DecodeWorker.js'
];

const optionalFiles = [
  'AudioRenderer.js',
  'SuperRender_10.js',
  'talk/AudioInterCom.js',
  'talkW/AudioInterCom.js',
  'transform/systemTransform-worker.js',
  'playctrl1/AudioRenderer.js',
  'playctrl1/SuperRender_10.js',
  'playctrl1simd/AudioRenderer.js',
  'playctrl1simd/SuperRender_10.js',
  'playctrl2/AudioRenderer.js',
  'playctrl2/SuperRender_10.js',
  'playctrl3/AudioRenderer.js',
  'playctrl3/SuperRender_10.js'
];

async function downloadFile(path: string, required: boolean): Promise<void> {
  const url = `${baseUrl}/${path}`;
  const response = await fetch(url);

  if (!response.ok) {
    const message = `${response.status} ${response.statusText} ${url}`;
    if (required) {
      throw new Error(`Failed to download required SDK file: ${message}`);
    }
    console.warn(`Skipped optional SDK file: ${message}`);
    return;
  }

  const target = join(outputDir, path);
  await mkdir(dirname(target), { recursive: true });
  await Bun.write(target, await response.arrayBuffer());
  console.log(`Downloaded ${path}`);
}

for (const path of requiredFiles) {
  await downloadFile(path, true);
}

for (const path of optionalFiles) {
  await downloadFile(path, false);
}
