import fs from 'fs';
import { PNG } from 'pngjs';
const data = fs.readFileSync('test.png');
const png = PNG.sync.read(data);
let minX = png.width, minY = png.height, maxX = 0, maxY = 0;
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const idx = (png.width * y + x) << 2;
    if (png.data[idx+3] > 10) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
}
console.log(`minX=${minX}, maxX=${maxX}, minY=${minY}, maxY=${maxY}`);
console.log(`width=${maxX - minX + 1}, height=${maxY - minY + 1}`);
