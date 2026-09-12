const {PNG}=require('pngjs');
exports.png=(width=2,height=1,transparent=true)=>{
 const png=new PNG({width,height});
 for(let i=0;i<png.data.length;i+=4){png.data[i]=30;png.data[i+1]=40;png.data[i+2]=50;png.data[i+3]=255;}
 if(transparent)png.data[3]=0;
 return PNG.sync.write(png);
};
exports.dataUrl=(...args)=>'data:image/png;base64,'+exports.png(...args).toString('base64');
