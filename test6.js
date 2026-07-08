import { Jimp } from 'jimp';

async function main() {
  const image = await Jimp.read("image2.jpg");
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  for (let x = 60; x <= 140; x++) {
    let colRedness = 0;
    for (let y = 0; y < h; y++) {
      const color = image.getPixelColor(x, y);
      const r = (color >> 24) & 255;
      const g = (color >> 16) & 255;
      const b = (color >> 8) & 255;
      colRedness += (r - (g + b) / 2);
    }
    console.log(x, colRedness / h);
  }
}
main();
