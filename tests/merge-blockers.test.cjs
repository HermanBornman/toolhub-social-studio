const test=require('node:test');const assert=require('node:assert/strict');
const {PNG}=require('pngjs');const {png,dataUrl}=require('./png-fixture.cjs');
const {validatePng}=require('../.test-dist/lib/png-transparency');
const {validateProductImages,validateSourceImage}=require('../.test-dist/lib/server-image');
const {authorize}=require('../.test-dist/lib/authorization');
const {getCurrentUser,canEditAdvert}=require('../.test-dist/lib/user-role');
const {EMPTY_ADVERT}=require('../.test-dist/lib/advert');
const {dedupeSpecFields,uniqueSpecifications}=require('../.test-dist/lib/specifications');
const {heuristicPageAnalysis}=require('../.test-dist/lib/pdf-import');
const {correctionAudit,advertPricingAudit}=require('../.test-dist/lib/correction-audit');
const {validateArtworkAsset,artworkType}=require('../.test-dist/lib/final-artwork');
const user=role=>({id:role,name:role,email:role+'@test.local',role});
test('genuine transparent PNG is decoded and accepted',()=>assert.equal(validatePng(dataUrl(),{transparent:true}).transparent,true));
test('fake PNG, malformed base64 and MIME mismatch are rejected',()=>{for(const value of ['data:image/png;base64,AAAA',dataUrl().replace('image/png','image/jpeg'),dataUrl()+'!'])assert.throws(()=>validatePng(value));});
test('CRC corruption, truncation, missing IEND and trailing payload are rejected',()=>{
 const bad=png();bad[45]^=1;
 for(const bytes of [bad,png().subarray(0,-5),png().subarray(0,-12),Buffer.concat([png(),Buffer.from('trailing')])])assert.throws(()=>validatePng('data:image/png;base64,'+bytes.toString('base64')));
});
test('PNG IHDR dimension bomb rejected before decode',()=>{const b=png();b.writeUInt32BE(20000000,16);assert.throws(()=>validatePng('data:image/png;base64,'+b.toString('base64')),/DIMENSIONS/)});
test('opaque RGB and opaque RGBA processed products rejected',()=>{
 const bytes=PNG.sync.write({width:2,height:1,data:Buffer.from([1,2,3,255,1,2,3,255])},{colorType:2});
 for(const value of [dataUrl(2,1,false),'data:image/png;base64,'+bytes.toString('base64')])assert.throws(()=>validatePng(value,{transparent:true}),/TRANSPARENT/);
});
test('fully invisible PNG is not a product',()=>{const p=new PNG({width:2,height:1});assert.throws(()=>validatePng('data:image/png;base64,'+PNG.sync.write(p).toString('base64'),{transparent:true}),/TRANSPARENT/)});
test('final artwork must be opaque and exactly 1080 by 1350',()=>{
 assert.equal(validatePng(dataUrl(1080,1350,false),{finalArtwork:true}).height,1350);
 for(const value of [dataUrl(1200,1200,false),dataUrl(1080,1350,true)])assert.throws(()=>validatePng(value,{finalArtwork:true}),/FINAL_ARTWORK/);
});
test('general image write validation rejects invalid processed PNG even with original fallback',async()=>{
 for(const useOriginalImage of [true,false])await assert.rejects(()=>validateProductImages({originalImageUrl:dataUrl(),processedImageUrl:'data:image/png;base64,AAAA',backgroundRemovalStatus:'COMPLETE',useOriginalImage},true));
});
test('COMPLETE image cannot be empty; source decoding does not trust JPEG/WebP MIME',async()=>{
 await assert.rejects(()=>validateProductImages({originalImageUrl:dataUrl(),processedImageUrl:'',backgroundRemovalStatus:'COMPLETE'},true));
 for(const mime of ['jpeg','webp'])await assert.rejects(()=>validateSourceImage(`data:image/${mime};base64,YWJj`));
});
test('STAFF blocked from marketing, manager and admin functions',()=>{for(const permission of ['MARKETING','REVIEW','ADMIN'])assert.throws(()=>authorize(permission,user('STAFF')),/FORBIDDEN/)});
test('MARKETING cannot modify admin settings',()=>assert.throws(()=>authorize('ADMIN',user('MARKETING')),/FORBIDDEN/));
test('explicit no-user state and absent/invalid configured identity denied',()=>{
 assert.throws(()=>authorize('READ',null),/UNAUTHENTICATED/);
 const previous=process.env.TOOLHUB_USER_ROLE;try{delete process.env.TOOLHUB_USER_ROLE;assert.throws(getCurrentUser,/UNAUTHENTICATED/);process.env.TOOLHUB_USER_ROLE='INVALID';assert.throws(getCurrentUser,/UNAUTHENTICATED/);}finally{if(previous===undefined)delete process.env.TOOLHUB_USER_ROLE;else process.env.TOOLHUB_USER_ROLE=previous;}
});
test('even Admin cannot edit submitted or approved artwork snapshots',()=>{for(const status of ['AWAITING_APPROVAL','APPROVED','PUBLISHED'])assert.equal(canEditAdvert({status,createdByUserId:'x'},user('ADMIN')),false)});
test('real forms have no runtime fixture product, price, specs or inclusion assumptions',()=>{for(const key of ['productName','sku','sellingPrice','primarySpecification','secondarySpecification','feature01','feature02'])assert.equal(EMPTY_ADVERT[key],'');assert.equal(require('../.test-dist/lib/advert').TEST_ADVERT,undefined)});
test('conservative dedupe preserves distinct materials and modifiers',()=>{
 assert.deepEqual(uniqueSpecifications(['Wood: 210 mm','210mm wood cutting capacity','Metal: 12mm','Wood: 12 mm','Blade length: 210 mm']),['Wood: 210 mm','Metal: 12mm','Wood: 12 mm','Blade length: 210 mm']);
});
test('labelled extraction spans do not generate duplicate bare unit values',()=>{
 const result=heuristicPageAnalysis('INGCO\nProduct: Saw\nWood 210mm\nMetal:12 mm\n20V','','1'*1);
 assert.deepEqual(result.technicalSpecifications.map(x=>x.value),['Wood 210 mm','Metal:12 mm','20 V']);
});
test('cross-slot rendering and saved specs do not repeat capacity',()=>{
 const result=dedupeSpecFields({primarySpecification:'Wood: 210 mm',secondarySpecification:'Metal: 12 mm',feature01:'12mm metal cutting capacity',feature02:'20 V',keyBenefit:''});assert.equal(result.feature01,'');assert.equal(result.secondarySpecification,'Metal: 12 mm');assert.equal(result.feature02,'20 V');
});
test('audit snapshots keep original extraction and previous/new manual prices without mutation',()=>{
 const original={extracted:{nettPrice:{value:'1000',confidence:'HIGH'}},calculatedSellingPrice:1558};const before={pricingMethod:'PDF',sellingPrice:1558,wasPrice:null,nowPrice:null,pricingAuditJson:JSON.stringify(original)};const after={...before,pricingMethod:'MANUAL',sellingPrice:1299};
 const event=correctionAudit(advertPricingAudit(before),advertPricingAudit(after),{userId:'reviewer',pdfImportId:'import',pageId:'page',advertisementId:'advert'});
 assert.equal(event.before.finalSellingPrice,1558);assert.equal(event.after.manualFinalSellingPrice,1299);assert.equal(event.after.extracted.nettPrice.value,'1000');assert.equal(event.after.calculatedSellingPrice,1558);assert.ok(event.recordedAt);assert.equal(before.sellingPrice,1558);
});
test('only correct immutable approved asset is accepted; product data and other revisions are never fallbacks',()=>{
 const advert={id:'advert',productImage:dataUrl(),processedImageUrl:dataUrl(),originalImageUrl:dataUrl(),productName:'Saw',sellingPrice:1299,submittedAt:new Date(0)};
 const asset={id:'asset',advertisementId:advert.id,type:artworkType('APPROVED',advert),mimeType:'image/png',path:dataUrl(1080,1350,false)};
 assert.equal(validateArtworkAsset(advert,asset).id,'asset');
 for(const item of [null,{...asset,path:advert.productImage},{...asset,type:'FINAL_SUBMITTED'},{...asset,advertisementId:'other'}])assert.throws(()=>validateArtworkAsset(advert,item));
 assert.throws(()=>validateArtworkAsset({...advert,sellingPrice:2499},asset),/FINAL_ARTWORK_MISSING/);
});
test('duplicate included-item text is not repeated as a technical spec, distinct included items survive',()=>{
 const {excludeSupplierBadges}=require('../.test-dist/lib/pdf-import');const a=heuristicPageAnalysis('Product: Saw\nWood: 210 mm','','1'*1);a.includedItems=[{...a.technicalSpecifications[0],value:'210 mm wood cutting capacity'},{...a.technicalSpecifications[0],value:'Carry case'}];const result=excludeSupplierBadges(a);assert.deepEqual(result.technicalSpecifications.map(x=>x.value),['Wood: 210 mm']);assert.deepEqual(result.includedItems.map(x=>x.value),['Carry case']);
});
