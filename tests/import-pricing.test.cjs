const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePricing, pricingInputSchema, extractedPricing, priceNumber } = require('../.test-dist/lib/import-pricing.js');
const { heuristicPageAnalysis, coreReviewIssues } = require('../.test-dist/lib/pdf-import.js');
const { advertSchema, TEST_ADVERT } = require('../.test-dist/lib/advert.js');
const field=(value,confidence='HIGH')=>({value,confidence,source:'OCR',sourcePage:1});
const source={nettPrice:field('R1 000'),sellingPrice:field('Not found','LOW')};
const input=p=>pricingInputSchema.parse(p);
test('PDF calculation requires confirmation and uses 1.558 whole-rand rounding',()=>{
 assert.equal(resolvePricing(source,input({})).calculatedSellingPrice,null);
 const result=resolvePricing(source,input({pdfDecision:'CONFIRMED'}));assert.equal(result.finalSellingPrice,1558);assert.equal(result.calculatedSellingPrice,1558);
 assert.equal(resolvePricing({...source,nettPrice:field('1000.50')},input({pdfDecision:'CONFIRMED'})).finalSellingPrice,1559);
});
test('low-confidence and rejected PDF values never calculate',()=>{
 for(const confidence of ['LOW'])assert.equal(resolvePricing({...source,nettPrice:field('1000',confidence)},input({pdfDecision:'CONFIRMED'})).calculatedSellingPrice,null);
 assert.equal(resolvePricing(source,input({pdfDecision:'REJECTED'})).finalSellingPrice,null);
});
test('confirmed PDF selling price is direct and inactive fields never override',()=>{
 const r=resolvePricing({...source,sellingPrice:field('2499')},input({pdfSource:'SELLING',pdfDecision:'CONFIRMED',manualFinalSellingPrice:'999',nowPrice:'888'}));assert.equal(r.finalSellingPrice,2499);assert.equal(r.calculatedSellingPrice,null);
});
test('sale and manual prices work without any PDF prices and retain extraction',()=>{
 const missing=extractedPricing(heuristicPageAnalysis('INGCO reciprocating saw','','1'*1));const original=JSON.stringify(missing);
 const sale=resolvePricing(missing,input({method:'SALE',wasPrice:'R2 799',nowPrice:'R2 499',manualFinalSellingPrice:'1'}));assert.equal(sale.finalSellingPrice,2499);assert.equal(sale.wasPrice,2799);assert.deepEqual(sale.errors,[]);
 const manual=resolvePricing(missing,input({method:'MANUAL',manualFinalSellingPrice:'2399',nowPrice:'1'}));assert.equal(manual.finalSellingPrice,2399);assert.equal(JSON.stringify(missing),original);
 assert.equal(coreReviewIssues(heuristicPageAnalysis('INGCO reciprocating saw','','1'*1),{pricingValid:true}).some(x=>/price/i.test(x)),false);
});
test('each pricing mode validates its own required fields',()=>{
 for(const p of [{method:'SALE',nowPrice:'2499'},{method:'SALE',wasPrice:'2799',nowPrice:'0'},{method:'MANUAL',manualFinalSellingPrice:'-1'},{method:'MANUAL',manualFinalSellingPrice:'0.01'}])assert.ok(resolvePricing(source,input(p)).errors.length);
 for(const text of ['-2499','R2x499','NaN','Infinity','1e3','0','1.2.3'])assert.equal(priceNumber(text),null);
 assert.equal(priceNumber('R2,499.50'),2499.50);
});
test('advert persists NOW as final price and hides WAS outside sale mode',()=>{
 const base={...TEST_ADVERT,originalImageUrl:'data:image/png;base64,a',processedImageUrl:'data:image/png;base64,a',backgroundRemovalStatus:'COMPLETE'};
 const sale=advertSchema.parse({...base,pricingMethod:'SALE',wasPrice:2799,sellingPrice:'2499'});assert.equal(sale.nowPrice,2499);assert.equal(sale.wasPrice,2799);
 assert.equal(advertSchema.safeParse({...base,pricingMethod:'SALE'}).success,false);
 const manual=advertSchema.parse({...base,pricingMethod:'MANUAL',wasPrice:2799});assert.equal(manual.wasPrice,null);assert.equal(manual.nowPrice,null);
});
