import { inflateSync } from "node:zlib";
// Decode only the bounded, non-interlaced 8-bit RGBA PNG format accepted by review.
export function hasTransparentPng(dataUrl:string):boolean {
 try {
  if(!dataUrl.startsWith('data:image/png;base64,'))return false;
  const b=Buffer.from(dataUrl.split(',')[1]||'','base64');
  if(!b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return false;
  const w=b.readUInt32BE(16),h=b.readUInt32BE(20),type=b[25];
  if(!w||!h||w*h>16000000||b[24]!==8||![4,6].includes(type)||b[28]!==0)return false;
  const channels=type===6?4:2,stride=w*channels,parts:Buffer[]=[];
  for(let i=8;i+12<=b.length;){const n=b.readUInt32BE(i);if(i+12+n>b.length)return false;const name=b.toString('ascii',i+4,i+8);if(name==='IDAT')parts.push(b.subarray(i+8,i+8+n));i+=12+n;}
  const raw=inflateSync(Buffer.concat(parts),{maxOutputLength:(stride+1)*h});if(raw.length!==(stride+1)*h)return false;
  let previous=Buffer.alloc(stride),transparent=false,visible=false;
  for(let y=0;y<h;y++){const row=Buffer.alloc(stride),filter=raw[y*(stride+1)];if(filter>4)return false;for(let x=0;x<stride;x++){const a=x>=channels?row[x-channels]:0,c=x>=channels?previous[x-channels]:0,up=previous[x];let predictor=0;if(filter===1)predictor=a;if(filter===2)predictor=up;if(filter===3)predictor=Math.floor((a+up)/2);if(filter===4){const p=a+up-c,pa=Math.abs(p-a),pb=Math.abs(p-up),pc=Math.abs(p-c);predictor=pa<=pb&&pa<=pc?a:pb<=pc?up:c;}row[x]=(raw[y*(stride+1)+1+x]+predictor)&255;if(x%channels===channels-1){transparent ||= row[x]<255;visible ||= row[x]>0;}}previous=row;}
  return transparent&&visible;
 }catch{return false;}
}
