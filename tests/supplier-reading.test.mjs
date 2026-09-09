import test from 'node:test';
import assert from 'node:assert/strict';
import { applyNoPriceProduct, validateReading } from '../lib/supplier-reading.ts';
import { handleReading } from '../lib/supplier-reading-server.ts';
import { handleIsolation } from '../lib/product-isolation-server.ts';
const field = value => ({ value, confidence: 'high', evidence: value || '' });
const product = { brand:field('INGCO'),title:field('20 V reciprocating saw'), model:field(null),description:field(null),
  specs:[field('Wood cutting capacity: 210 mm'),field('Metal cutting capacity: 12 mm')],included:[],excluded:[field('Battery and charger sold separately')],nettPrice:field(null),promotionalPrice:field(null) };
const reading = {rawText:'Wood:210mm Metal:12mm Battery and charger sold separately',warnings:['Model and pricing not found'],products:[product]};
const config = { apiKey:'test-key',accessCode:'test-staff-code' };
function upload(code='test-staff-code') {
  const body=new FormData();body.append('image',new Blob(['fixture'],{type:'image/png'}),'page.png');
  return new Request('https://example.test/api/read-supplier',{method:'POST',headers:{'x-toolhub-access-code':code},body});
}
test('no-price reading retains all manual price and sale controls',()=>{
  const current={title:'Old',model:'',description:'',specs:[],product:'old',price:'1299',saleEnabled:true,previousPrice:'1500',discountedPrice:'1199',campaign:'Special',store:'Toolhub'};
  const updated=applyNoPriceProduct(current,product,'clean.png');
  for(const key of ['price','saleEnabled','previousPrice','discountedPrice','campaign','store'])assert.equal(updated[key],current[key]);
  assert.equal(updated.condition,'Battery and charger sold separately');
  assert.equal(updated.specs[0],'Wood cutting capacity: 210 mm');
  assert.equal(updated.model,'');
});
test('schema validation rejects malformed or incomplete product information',()=>{
  assert.equal(validateReading(reading),true);
  assert.equal(validateReading({...reading,products:[{...product,nettPrice:123}]}),false);
  assert.equal(validateReading({...reading,products:[{...product,excluded:undefined}]}),false);
});
test('unconfigured and unauthorised services never call a paid provider',async()=>{
  const provider=()=>{throw Error('must not be called');};
  assert.equal((await handleReading(upload(),{},provider)).status,503);
  assert.equal((await handleReading(upload('wrong'),config,provider)).status,401);
  assert.equal((await handleIsolation(upload('wrong'),config,provider)).status,401);
});
test('reading request includes the original image and handles structured no-price results',async()=>{
  const response=await handleReading(upload(),config,async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/responses');
    const body=JSON.parse(init.body);assert.equal(body.store,false);
    assert.equal(body.input[0].content[1].type,'input_image');
    assert.equal(body.text.format.strict,true);
    return Response.json({status:'completed',output:[{type:'reasoning'},{content:[{type:'output_text',text:JSON.stringify(reading)}]}]});
  });
  assert.equal(response.status,200); assert.equal((await response.json()).products[0].nettPrice.value,null);
});
test('reading fails closed on truncated provider output',async()=>{
  const response=await handleReading(upload(),config,async()=>Response.json({status:'incomplete',output:[]}));
  assert.equal(response.status,502);
});
test('image request preserves fidelity and demands transparent product-only output',async()=>{
  const png=Buffer.from([137,80,78,71,13,10,26,10,0,0]);
  const response=await handleIsolation(upload(),config,async(url,init)=>{
    assert.equal(url,'https://api.openai.com/v1/images/edits');
    assert.equal(init.body.get('input_fidelity'),'high');
    assert.equal(init.body.get('background'),'transparent');
    assert.match(init.body.get('prompt'),/packaging/);
    return Response.json({data:[{b64_json:png.toString('base64')}]});
  });
  assert.equal(response.status,200);assert.equal(response.headers.get('X-Product-Isolation'),'ai-edited-review-required');
});
test('image failure never silently substitutes the full supplier page',async()=>{
  assert.equal((await handleIsolation(upload(),config,async()=>Response.json({data:[]}))).status,502);
});
