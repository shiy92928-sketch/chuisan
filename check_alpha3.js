import fs from 'fs';
import { PNG } from 'pngjs';
const data = fs.readFileSync('test.png');
const png = PNG.sync.read(data);
const midY = Math.floor(png.height / 2);
for (let x = 350; x < 400; x += 5) {
  const idx = (png.width * midY + x) << 2;
  console.log("X=", x, "A=", png.data[idx+3], "R=", png.data[idx]);
}
for (let x = 2080; x < 2120; x += 5) {
  const idx = (png.width * midY + x) << 2;
  console.log("X=", x, "A=", png.data[idx+3], "R=", png.data[idx]);
}
