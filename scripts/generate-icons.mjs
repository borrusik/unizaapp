import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = await readFile(new URL("../public/icon-512.svg", import.meta.url));

async function renderPng(size, output) {
  await sharp(source, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(output, import.meta.url)));
}

await Promise.all([
  renderPng(512, "../public/icon-512.png"),
  renderPng(192, "../public/icon-192.png"),
  renderPng(180, "../public/apple-touch-icon.png"),
]);

const faviconFrames = await Promise.all([16, 32, 48].map(async (size) => ({
  size,
  png: await sharp(source, { density: 384 }).resize(size, size).png().toBuffer(),
})));
const headerSize = 6 + faviconFrames.length * 16;
let offset = headerSize;
const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(faviconFrames.length, 4);
faviconFrames.forEach(({ size, png }, index) => {
  const entry = 6 + index * 16;
  header.writeUInt8(size, entry);
  header.writeUInt8(size, entry + 1);
  header.writeUInt8(0, entry + 2);
  header.writeUInt8(0, entry + 3);
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([
  header,
  ...faviconFrames.map(({ png }) => png),
]));

console.log("Generated official UNIZA app icons: 16, 32, 48, 180, 192 and 512 px");
