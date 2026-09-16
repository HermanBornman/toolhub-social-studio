const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const Module=require('node:module'),originalResolve=Module._resolveFilename;
Module._resolveFilename=function(name,...rest){return originalResolve.call(this,name==='server-only'?path.resolve('tests/server-only-fixture.cjs'):name.startsWith('@/')?path.resolve('.test-dist',name.slice(2)):name,...rest)};
const {Webhook}=require('standardwebhooks');
const secret=Buffer.alloc(32,7).toString('base64');
process.env.SUPABASE_SEND_SMS_HOOK_SECRET='v1,whsec_'+secret;
process.env.SMSPORTAL_CLIENT_ID='test-client';
process.env.SMSPORTAL_API_SECRET='test-secret';
const route=require('../.test-dist/app/api/auth/send-sms-hook/route');

function signedRequest(payload,valid=true){
 const timestamp=new Date();
 const id='msg_test_otp';
 const signature=new Webhook(secret).sign(id,timestamp,payload);
 return new Request('http://localhost/api/auth/send-sms-hook',{method:'POST',headers:{'content-type':'application/json','webhook-id':id,'webhook-timestamp':String(Math.floor(timestamp.getTime()/1000)),'webhook-signature':valid?signature:'v1,invalid'},body:payload});
}

test('signed Supabase Send SMS Hook forwards its one OTP to SMSPortal',async()=>{
 const original=global.fetch,calls=[];
 global.fetch=async(url,init)=>{calls.push({url,init});return new Response('{}',{status:200})};
 try{
  const payload=JSON.stringify({user:{phone:'+27795144898'},sms:{otp:'123456'}});
  const response=await route.POST(signedRequest(payload));
  assert.equal(response.status,200);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://rest.smsportal.com/v3/BulkMessages');
  assert.match(calls[0].init.headers.authorization,/^Basic /);assert.ok(!calls[0].init.headers.authorization.includes('test-client'));
  assert.deepEqual(JSON.parse(calls[0].init.body),{Messages:[{Content:'Your Toolhub login code is 123456. It expires shortly. Do not share this code.',Destination:'27795144898'}]});
 }finally{global.fetch=original}
});

test('unsigned or malformed SMS hooks fail generically without provider delivery',async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response('{}',{status:200})};
 try{
  const response=await route.POST(signedRequest(JSON.stringify({user:{phone:'+27795144898'},sms:{otp:'123456'}}),false));
  assert.equal(response.status,500);assert.equal(calls,0);const text=await response.text();assert.equal(text.includes('123456'),false);assert.equal(text.includes('27795144898'),false);assert.match(text,/SMS delivery failed/);
 }finally{global.fetch=original}
});

test('OTP implementation has no browser credential names or logging calls',()=>{
 for(const file of ['app/api/auth/send-sms-hook/route.ts','lib/auth/smsportal.ts']){const source=fs.readFileSync(file,'utf8');assert.equal(source.includes('NEXT_PUBLIC_SMSPORTAL'),false);assert.equal(source.includes('console.'),false)}
});
