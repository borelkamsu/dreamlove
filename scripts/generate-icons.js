const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');
const bg = path.join(iconsDir, 'icon-bg.svg');
const bgMaskable = path.join(iconsDir, 'icon-bg-maskable.svg');
const logo = path.join(__dirname, '..', 'public', 'img', 'logo-white.png');

async function makeIcon(bgSvg, size, logoScale, outFile) {
  const bgBuf = await sharp(fs.readFileSync(bgSvg), { density: 384 }).resize(size, size).toBuffer();
  const logoSize = Math.round(size * logoScale);
  const logoBuf = await sharp(logo).resize(logoSize, logoSize, { fit: 'inside' }).toBuffer();
  await sharp(bgBuf)
    .composite([{ input: logoBuf, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, outFile));
  console.log(`Genere: ${outFile}`);
}

async function run() {
  await makeIcon(bg, 192, 0.62, 'icon-192.png');
  await makeIcon(bg, 512, 0.62, 'icon-512.png');
  await makeIcon(bg, 180, 0.62, 'apple-touch-icon.png');
  await makeIcon(bg, 32, 0.62, 'favicon-32.png');
  await makeIcon(bgMaskable, 192, 0.42, 'icon-maskable-192.png');
  await makeIcon(bgMaskable, 512, 0.42, 'icon-maskable-512.png');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
