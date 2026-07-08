import { Jimp } from 'jimp';

async function main() {
  const image = await Jimp.read("image.jpg");
  const w = image.bitmap.width;
  const h = image.bitmap.height;
  let minLuma = 9999999;
  let lineX = -1;
  for (let x = 0; x < w / 2; x++) {
    let colLuma = 0;
    for (let y = 0; y < h; y++) {
      const color = image.getPixelColor(x, y);
      const r = (color >> 24) & 255;
      const g = (color >> 16) & 255;
      const b = (color >> 8) & 255;
      colLuma += (r * 0.299 + g * 0.587 + b * 0.114);
    }
    if (colLuma < minLuma) {
      minLuma = colLuma;
      lineX = x;
    }
  }
  console.log("Darkest column in left half:", lineX, "ratio:", lineX / w);
}
main();
