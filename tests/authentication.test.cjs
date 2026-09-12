const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const tmpRoot=path.resolve('tmp');fs.mkdirSync(tmpRoot,{recursive:true});const temp=fs.mkdtempSync(path.join(tmpRoot,'auth-test-'));fs.writeFileSync(path.join(temp,'test.db'),'');
process.env.DATABASE_URL='file:'+path.join(temp,'test.db').replaceAll('\\','/');
process.env.APP_URL='http://localhost';process.env.AUTH_MODE='supabase';process.env.AUTH_ENCRYPTION_KEY='a1'.repeat(32);
const Module=require('node:module'),originalResolve=Module._resolveFilename;
Module._resolveFilename=function(name,...rest){return originalResolve.call(this,name==='server-only'?path.resolve('tests/server-only-fixture.cjs'):name.startsWith('@/')?path.resolve('.test-dist',name.slice(2)):name,...rest)};
const {prisma}=require('../.test-dist/lib/prisma');
const {createAuthService}=require('../.test-dist/lib/auth/service');
const {sessionDigest,tokenCipher}=require('../.test-dist/lib/auth/crypto');
const {changeUser}=require('../.test-dist/lib/auth/users');
const {authorize}=require('../.test-dist/lib/authorization');
const {canEditAdvert,canApproveAdvert}=require('../.test-dist/lib/user-role');
let clock=new Date(),seq=0,failVerify=false,failLogout=false;const tokens=new Map();let resetRequests=0,passwordUpdates=0,providerCalls=0;
function issue(id,expiresAt=Math.floor(clock.getTime()/1000)+3600){const accessToken='test-access-'+(++seq),refreshToken='test-refresh-'+seq;tokens.set(accessToken,id);tokens.set(refreshToken,id);return{accessToken,refreshToken,expiresAt}}
const provider={
 async login(email,password){providerCalls++;if(password!=='test-password-123')throw Error('provider failure');return issue(email.split('@')[0])},
 async verify(access){providerCalls++;if(failVerify||!tokens.has(access))throw Error('provider failure');return{id:tokens.get(access)}},
 async refresh(refresh){providerCalls++;if(!tokens.has(refresh))throw Error('expired');return issue(tokens.get(refresh))},
 async logout(access){providerCalls++;if(failLogout)throw Error('offline');tokens.delete(access)},
 async reset(){resetRequests++},async redeem(_hash,type){return issue(type==='invite'?'staff':'staff')},async updatePassword(){passwordUpdates++}
};
const service=createAuthService(prisma,provider,process.env.AUTH_ENCRYPTION_KEY,()=>clock);
let browserSecret;
const serverPath=require.resolve('../.test-dist/lib/auth/server'),actualServer=require(serverPath);
require.cache[serverPath].exports={...actualServer,authService:()=>service,sessionSecret:async()=>browserSecret,getCurrentUser:()=>service.getUser(browserSecret),withRequestUser:(_u,fn)=>fn()};
const route=name=>require('../.test-dist/app/api/'+name+'/route');
const auth=(operation,body={},origin='http://localhost')=>route('auth/[operation]').POST(new Request('http://localhost/api/auth/'+operation,{method:'POST',headers:{'content-type':'application/json',...(origin?{origin}:{})},body:JSON.stringify(body)}),{params:Promise.resolve({operation})});
const login=async id=>{const result=await service.login(id+'@test.local','test-password-123');browserSecret=result.secret;return result};
let users={};
test.before(async()=>{
 execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env:process.env,stdio:'pipe'});
 for(const role of ['STAFF','MARKETING','MANAGER','ADMIN']){const id=role.toLowerCase();users[id]=await prisma.user.create({data:{id,email:id+'@test.local',name:'Test '+role,role,authProvider:'supabase',authProviderUserId:id}})}
 await prisma.user.create({data:{id:'inactive',email:'inactive@test.local',name:'Inactive',role:'STAFF',active:false,authProvider:'supabase',authProviderUserId:'inactive'}});
 await prisma.user.create({data:{id:'historic',email:'historic@test.local',name:'Historical owner',role:'ADMIN'}});
});
test.after(async()=>{await prisma.$disconnect();if(!fs.realpathSync(temp).startsWith(fs.realpathSync(tmpRoot)+path.sep))throw Error('Unexpected test folder');fs.rmSync(temp,{recursive:true,force:true})});

test('valid provider session maps to local user and local role',async()=>{const s=await login('staff');assert.equal((await service.getUser(s.secret)).role,'STAFF');assert.equal(s.user.id,'staff')});
test('no session and forged secrets fail closed',async()=>{for(const secret of [undefined,'ADMIN','x'.repeat(43)])await assert.rejects(()=>service.getUser(secret),/UNAUTHENTICATED/)});
test('provider identity does not auto-link by matching email or create unknown users',async()=>{const count=await prisma.user.count();await assert.rejects(()=>service.login('historic@test.local','test-password-123'));await assert.rejects(()=>service.login('unknown@test.local','test-password-123'));assert.equal(await prisma.user.count(),count)});
test('inactive user cannot log in',async()=>{await assert.rejects(()=>service.login('inactive@test.local','test-password-123'),/UNAUTHENTICATED/)});
test('provider verification failure blocks existing session',async()=>{const s=await login('staff');failVerify=true;try{await assert.rejects(()=>service.getUser(s.secret))}finally{failVerify=false}});
test('tokens encrypted at rest and only digest of cookie stored',async()=>{const s=await login('staff'),row=await prisma.authSession.findUniqueOrThrow({where:{id:sessionDigest(s.secret)}});assert.notEqual(row.id,s.secret);assert.ok(!row.providerTokens.includes('test-access'));assert.ok(!JSON.stringify(row).includes(s.secret));assert.equal(tokenCipher(process.env.AUTH_ENCRYPTION_KEY).decrypt(row.providerTokens).accessToken.startsWith('test-access'),true)});
test('authenticated encryption detects tampering and rejects invalid keys',()=>{const c=tokenCipher(process.env.AUTH_ENCRYPTION_KEY),value=Buffer.from(c.encrypt({x:1}),'base64');value[30]^=1;assert.throws(()=>c.decrypt(value.toString('base64')));assert.throws(()=>tokenCipher('short'))});
test('new login rotates session secret and revokes previous local session',async()=>{const first=await login('staff'),second=await service.login('staff@test.local','test-password-123',first.secret);assert.notEqual(first.secret,second.secret);await assert.rejects(()=>service.getUser(first.secret));assert.equal((await service.getUser(second.secret)).id,'staff')});
test('expired local session denied even with provider token',async()=>{const s=await login('staff');clock=new Date(clock.getTime()+13*3600000);await assert.rejects(()=>service.getUser(s.secret));clock=new Date()});
test('expired provider token refreshed with identity checked, absolute session expiry unchanged',async()=>{const s=await login('staff'),row=await prisma.authSession.findUniqueOrThrow({where:{id:sessionDigest(s.secret)}});clock=new Date(clock.getTime()+3600000);assert.equal((await service.getUser(s.secret)).id,'staff');const after=await prisma.authSession.findUniqueOrThrow({where:{id:row.id}});assert.equal(after.expiresAt.getTime(),row.expiresAt.getTime());assert.notEqual(after.providerTokens,row.providerTokens);clock=new Date()});
test('logout immediately denies replay and records audit despite provider outage',async()=>{const s=await login('staff');failLogout=true;try{await service.logout(s.secret)}finally{failLogout=false}await assert.rejects(()=>service.getUser(s.secret));assert.ok(await prisma.auditLog.findFirst({where:{action:'USER_LOGOUT',userId:'staff'}}))});
test('unauthenticated API returns 401 before database business data',async()=>{browserSecret=undefined;for(const name of ['session','products','adverts','pdf-imports','plans','users'])assert.equal((await route(name).GET(new Request('http://localhost/api/'+name))).status,401,name)});
test('unauthenticated page guard redirects to login',async()=>{browserSecret=undefined;const {requirePageUser}=require('../.test-dist/lib/auth/page');await assert.rejects(()=>requirePageUser(),error=>String(error.digest).includes('NEXT_REDIRECT;replace;/login;'))});
test('STAFF and MARKETING denied user administration API',async()=>{for(const id of ['staff','marketing']){await login(id);assert.equal((await route('users').GET(new Request('http://localhost/api/users'))).status,403)}});
test('MANAGER permitted approvals and ADMIN permitted settings',async()=>{authorize('REVIEW',(await login('manager')).user);authorize('ADMIN',(await login('admin')).user)});
test('ADMIN users API exposes no encrypted tokens or provider IDs',async()=>{await login('admin');const response=await route('users').GET(new Request('http://localhost/api/users?q=staff'));assert.equal(response.status,200);const text=await response.text();assert.match(text,/staff@test.local/);for(const term of ['providerTokens','authProviderUserId','test-access','test-refresh'])assert.ok(!text.includes(term))});
test('non-admin and stale admin actors cannot change access',async()=>{for(const user of [users.staff,users.marketing,users.manager,{...users.staff,role:'ADMIN'}])await assert.rejects(()=>changeUser(prisma,user,'manager',{role:'STAFF'}),/FORBIDDEN/)});
test('admin cannot change own role or deactivate self',async()=>{await assert.rejects(()=>changeUser(prisma,users.admin,'admin',{role:'STAFF'}),/SELF_USER_CHANGE/);await assert.rejects(()=>changeUser(prisma,users.admin,'admin',{active:false}),/SELF_USER_CHANGE/)});
test('admin role change persists audit and existing session immediately uses new DB role',async()=>{const s=await login('staff');await changeUser(prisma,users.admin,'staff',{role:'MARKETING'});assert.equal((await service.getUser(s.secret)).role,'MARKETING');const log=await prisma.auditLog.findFirstOrThrow({where:{action:'USER_ROLE_CHANGE',entityId:'staff'},orderBy:{createdAt:'desc'}});assert.deepEqual(JSON.parse(log.metadata),{field:'role',before:'STAFF',after:'MARKETING'});await changeUser(prisma,users.admin,'staff',{role:'STAFF'})});
test('deactivation revokes sessions while preserving user ownership and history',async()=>{const s=await login('staff');await changeUser(prisma,users.admin,'staff',{active:false});await assert.rejects(()=>service.getUser(s.secret));assert.equal(await prisma.authSession.count({where:{userId:'staff'}}),0);assert.ok(await prisma.user.findUnique({where:{id:'staff'}}));assert.ok(await prisma.auditLog.findFirst({where:{action:'USER_DEACTIVATED',entityId:'staff'}}));await changeUser(prisma,users.admin,'staff',{active:true});await assert.rejects(()=>service.getUser(s.secret));assert.ok(await prisma.auditLog.findFirst({where:{action:'USER_ACTIVATED',entityId:'staff'}}))});
test('user update rejects credential and provider-link changes',async()=>{for(const input of [{password:'secret'},{authProviderUserId:'other'},{role:'SUPERADMIN'},{active:'true'},{}])await assert.rejects(()=>changeUser(prisma,users.admin,'staff',input),/INVALID_USER_INPUT/)});
test('staff ownership and advert self-approval remain enforced',()=>{assert.equal(canEditAdvert({status:'DRAFT',createdByUserId:'someone-else'},users.staff),false);assert.equal(canApproveAdvert({createdByUserId:'manager'},users.manager),false);assert.equal(canApproveAdvert({createdByUserId:'staff',submittedByUserId:'manager'},users.manager),false)});
test('cross-origin and missing-Origin auth requests denied before provider calls',async()=>{for(const origin of ['https://evil.example',undefined]){const count=providerCalls;const response=await auth('login',{email:'staff@test.local',password:'test-password-123'},origin===undefined?null:origin);assert.equal(response.status,403);assert.equal(providerCalls,count)}});
test('authenticated mutation without same origin is denied',async()=>{await login('admin');const response=await route('users/[id]').PATCH(new Request('http://localhost/api/users/staff',{method:'PATCH',headers:{origin:'https://evil.example'},body:'{"role":"ADMIN"}'}),{params:Promise.resolve({id:'staff'})});assert.equal(response.status,403)});
test('login returns opaque HttpOnly SameSite cookie, never tokens or roles',async()=>{browserSecret=undefined;const response=await auth('login',{email:'staff@test.local',password:'test-password-123',role:'ADMIN',userId:'admin'});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=lax/i);assert.match(cookie,/Max-Age=43200/i);assert.deepEqual(await response.json(),{ok:true})});
test('production cookies are Secure with host prefix',()=>{const before=process.env.NODE_ENV;process.env.NODE_ENV='production';try{assert.equal(actualServer.cookieOptions(1).secure,true);assert.equal(actualServer.sessionCookieName(),'__Host-toolhub-session')}finally{if(before===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=before}});
test('generic failures do not enumerate wrong-password, inactive or unlinked accounts',async()=>{const values=[];for(const [email,password] of [['staff@test.local','bad'],['inactive@test.local','test-password-123'],['unknown@test.local','test-password-123']]){const r=await auth('login',{email,password});assert.equal(r.status,401);values.push(await r.text())}assert.equal(new Set(values).size,1)});
test('failed-login audit contains no credentials or email guesses',async()=>{const logs=await prisma.auditLog.findMany({where:{action:'LOGIN_FAILED'}});assert.ok(logs.length);for(const row of logs){assert.equal(row.entityId,'anonymous');assert.equal(row.metadata,null);assert.equal(row.userId,null)}});
test('reset response is generic and calls native provider',async()=>{const before=resetRequests;const a=await auth('forgot-password',{email:'staff@test.local'}),b=await auth('forgot-password',{email:'absent@test.local'});assert.equal(await a.text(),await b.text());assert.equal(resetRequests,before+2)});
test('recovery token only grants password session, not studio access',async()=>{const s=await service.redeem('a'.repeat(64),'recovery');await assert.rejects(()=>service.getUser(s.secret));assert.equal((await service.recoveryUser(s.secret)).id,'staff');assert.equal(s.expiresAt.getTime()-clock.getTime(),900000)});
test('invite token can establish password setup session for explicitly mapped user',async()=>{const s=await service.redeem('b'.repeat(64),'invite');assert.equal((await service.recoveryUser(s.secret)).id,'staff');await assert.rejects(()=>service.getUser(s.secret))});
test('normal login cannot be used to bypass recovery-only password endpoint',async()=>{const s=await login('staff');await assert.rejects(()=>service.updatePassword(s.secret,'changed-test-password'))});
test('password update uses provider then revokes all local sessions',async()=>{const app=await login('staff'),reset=await service.redeem('c'.repeat(64),'recovery');await service.updatePassword(reset.secret,'changed-test-password');assert.equal(passwordUpdates,1);await assert.rejects(()=>service.getUser(app.secret));await assert.rejects(()=>service.recoveryUser(reset.secret));assert.ok(await prisma.auditLog.findFirst({where:{action:'PASSWORD_UPDATED',userId:'staff'}}))});
test('logout API clears cookie and protected API denies subsequent access',async()=>{await login('staff');const response=await auth('logout');assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/Max-Age=0/);assert.equal((await route('session').GET(new Request('http://localhost/api/session'))).status,401)});
test('no public signup endpoint is provided',async()=>{const r=await auth('signup',{email:'new@test.local',password:'test-password-123'});assert.equal(r.status,404)});
test('database throttle bounds repeated attempts and stores no email address',async()=>{const {throttle}=require('../.test-dist/lib/auth/http');await throttle('test','private@test.local',1);await assert.rejects(()=>throttle('test','private@test.local',1),/RATE_LIMITED/);const rows=await prisma.authThrottle.findMany();assert.ok(rows.length);assert.ok(!JSON.stringify(rows).includes('private@test.local'))});
test('configuration fails closed even when old environment admin identity is set',()=>{const {supabaseProvider}=require('../.test-dist/lib/auth/provider');const prev=process.env.AUTH_MODE;process.env.TOOLHUB_USER_ROLE='ADMIN';for(const mode of [undefined,'dev']){if(mode)process.env.AUTH_MODE=mode;else delete process.env.AUTH_MODE;assert.throws(supabaseProvider,/UNAUTHENTICATED/)}process.env.AUTH_MODE=prev});

test('operator onboarding verifies provider identity, preserves old ID, and records USER_INVITED',async()=>{
 const {linkUser}=require('../scripts/link-auth-user.cjs');
 const native={auth:{admin:{getUserById:async id=>({data:{user:{id,email:'historical-real@test.local'}},error:null})}}};
 const result=await linkUser(prisma,native,{confirm:true,userId:'historic',providerUserId:'provider-historical',name:'Unused replacement name',role:'ADMIN',actorId:'admin'});
 assert.equal(result.id,'historic');const row=await prisma.user.findUniqueOrThrow({where:{id:'historic'}});assert.equal(row.name,'Historical owner');assert.equal(row.authProviderUserId,'provider-historical');assert.equal(row.email,'historical-real@test.local');assert.ok(await prisma.auditLog.findFirst({where:{action:'USER_INVITED',entityId:'historic',userId:'admin'}}));
});
test('onboarding cannot silently change historical roles or reassign provider identity',async()=>{
 const {linkUser}=require('../scripts/link-auth-user.cjs');const native={auth:{admin:{getUserById:async id=>({data:{user:{id,email:'staff@test.local'}},error:null})}}};
 await assert.rejects(()=>linkUser(prisma,native,{confirm:true,userId:'staff',providerUserId:'other-provider',role:'STAFF',name:'Staff',actorId:'admin'}),/cannot be reassigned/);
 await assert.rejects(()=>linkUser(prisma,native,{confirm:true,userId:'staff',providerUserId:'staff',role:'ADMIN',name:'Staff',actorId:'admin'}),/historical role/);
});
test('existing linked Admin prevents bootstrap bypass and unconfirmed operator writes',async()=>{
 const {linkUser}=require('../scripts/link-auth-user.cjs');const native={auth:{admin:{getUserById:async id=>({data:{user:{id,email:'new@test.local'}},error:null})}}};
 await assert.rejects(()=>linkUser(prisma,native,{confirm:true,userId:'new',providerUserId:'new-provider',role:'ADMIN',name:'New',bootstrapAdmin:true}),/linked active administrator/);
 await assert.rejects(()=>linkUser(prisma,native,{userId:'new'}),/Supply/);
 assert.equal(await prisma.user.findUnique({where:{id:'new'}}),null);
});
