export function fitProductBox(sourceWidth: number, sourceHeight: number, boxWidth: number, boxHeight: number) {
if (sourceWidth <= 0 || sourceHeight <= 0 || boxWidth <= 0 || boxHeight <= 0) {
return { width: 0, height: 0, scale: 0 };
}
const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
return { width: sourceWidth * scale, height: sourceHeight * scale, scale };
}
