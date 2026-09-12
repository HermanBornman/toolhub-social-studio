// Explicit manual-browser fixture only. Not imported by application/runtime code.
const http=require('node:http'),{randomBytes}=require('node:crypto');
if(process.env.TOOLHUB_AUTH_FIXTURE!=='true'||process.env.NODE_ENV==='production')throw Error('Enable this loopback fixture explicitly outside production');
const roleNames=['staff','marketing','manager','admin'];
const people=new Map(roleNames.map((name,i)=>[`${name}@test.local`,{id:`00000000-0000-4000-8000-00000000000${i+1}`,email:`${name}@test.local`,aud:'authenticated',role:'authenticated',email_confirmed_at:new Date().toISOString(),created_at:new Date().toISOString(),app_metadata:{},user_metadata:{},identities:[],password:'Local-browser-test-123!'}]));
const access=new Map(),refresh=new Map();
const safe=user=>{const {password,...value}=user;return value};
const grant=user=>{const expires_at=Math.floor(Date.now()/1000)+3600;const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:user.id,exp:expires_at,aud:'authenticated',role:'authenticated'})).toString('base64url')+'.'+randomBytes(32).toString('base64url');const refresh_token=randomBytes(32).toString('hex');access.set(token,user);refresh.set(refresh_token,user);return{access_token:token,refresh_token,expires_at,expires_in:3600,token_type:'bearer',user:safe(user)}};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:3104');let text='';for await(const chunk of req){text+=chunk;if(text.length>8192){res.writeHead(413).end();return}}let body={};try{body=JSON.parse(text||'{}')}catch{}
 const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data))};
 const user=access.get((req.headers.authorization||'').replace(/^Bearer /,''));
 if(url.pathname==='/auth/v1/token'){
  const person=url.searchParams.get('grant_type')==='refresh_token'?refresh.get(body.refresh_token):people.get(body.email);
  if(!person||(url.searchParams.get('grant_type')!=='refresh_token'&&person.password!==body.password))return send(400,{error:'invalid_grant',error_description:'Invalid login credentials'});
  return send(200,grant(person));
 }
 if(url.pathname==='/auth/v1/user'&&user){if(req.method==='PUT'&&body.password)user.password=body.password;return send(200,safe(user))}
 if(url.pathname==='/auth/v1/logout'){access.delete((req.headers.authorization||'').replace(/^Bearer /,''));return send(200,{})}
 if(url.pathname==='/auth/v1/recover')return send(200,{});
 if(url.pathname==='/auth/v1/verify'&&body.token_hash==='a'.repeat(64)&&['recovery','invite'].includes(body.type))return send(200,grant(people.get('staff@test.local')));
 if(url.pathname.startsWith('/auth/v1/admin/users/')){const found=[...people.values()].find(x=>x.id===url.pathname.split('/').at(-1));if(found)return send(200,safe(found))}
 return send(401,{message:'Unauthorized'});
}).listen(3104,'127.0.0.1',()=>console.log('Loopback auth fixture ready on 127.0.0.1:3104; test identities only.'));
