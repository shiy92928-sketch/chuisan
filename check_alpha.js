import fs from 'fs';
import { PNG } from 'pngjs';

const data = fs.readFileSync('test.png');
const png = PNG.sync.read(data);

console.log("Width:", png.width, "Height:", png.height);
const midY = Math.floor(png.height / 2);
let startX = -1;
let endX = -1;
for (let x = 0; x < png.width; x++) {
  const idx = (png.width * midY + x) << 2;
  const a = png.data[idx + 3];
  if (a > 50 && startX === -1) startX = x;
  if (a > 50) endX = x;
}
console.log("Mid Y alpha > 50: startX=", startX, "endX=", endX);

const midX = Math.floor(png.width / 2);
let startY = -1;
let endY = -1;
for (let y = 0; y < png.height; y++) {
  const idx = (png.width * y + midX) << 2;
  const a = png.data[idx + 3];
  if (a > 50 && startY === -1) startY = y;
  if (a > 50) endY = y;
}
console.log("Mid X alpha > 50: startY=", startY, "endY=", endY);
