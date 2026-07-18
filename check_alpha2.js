import fs from 'fs';
import { PNG } from 'pngjs';
const data = fs.readFileSync('test.png');
const png = PNG.sync.read(data);
const midX = Math.floor(png.width / 2);
for (let y = 100; y < 300; y += 10) {
  const idx = (png.width * y + midX) << 2;
  console.log("Y=", y, "A=", png.data[idx+3], "R=", png.data[idx]);
}
for (let y = 1400; y < 1550; y += 10) {
  const idx = (png.width * y + midX) << 2;
  console.log("Y=", y, "A=", png.data[idx+3], "R=", png.data[idx]);
}
