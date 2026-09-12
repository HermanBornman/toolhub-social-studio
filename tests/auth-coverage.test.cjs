const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?files(path.join(dir,x.name)):[path.join(dir,x.name)])}
const publicPages=new Set(['login','forgot-password','reset-password','auth/confirm'].map(x=>'app/'+x+'/page.tsx'));
test('every private page calls the server page guard before business queries',()=>{
 for(const file of files('app').filter(x=>x.endsWith('page.tsx'))){const name=file.replaceAll('\\','/');if(publicPages.has(name))continue;const source=fs.readFileSync(file,'utf8');assert.match(source,/await requirePageUser\(\)/,name);const query=source.indexOf('await prisma.');if(query>=0)assert.ok(source.indexOf('await requirePageUser()')<query,name)}
});
test('every business API export remains behind the central authorization wrapper',()=>{
 for(const file of files('app/api').filter(x=>x.endsWith('route.ts'))){if(file.replaceAll('\\','/').includes('/auth/[operation]/'))continue;const source=fs.readFileSync(file,'utf8');assert.match(source,/withAuthorization/,file);const exports=[...source.matchAll(/export\s+(?:const|async function|function)\s+(GET|POST|PUT|PATCH|DELETE)/g)];assert.ok(exports.length,file);for(const exp of exports)assert.match(source.slice(exp.index),new RegExp('export const '+exp[1]+' = withAuthorization'),file+' '+exp[1])}
});
test('provider/session modules are marked server-only and runtime never imports browser fixtures',()=>{
 for(const name of ['server','provider'])assert.match(fs.readFileSync('lib/auth/'+name+'.ts','utf8'),/import "server-only"/);
 for(const file of [...files('app'),...files('lib'),...files('components')].filter(x=>/\.tsx?$/.test(x))){const source=fs.readFileSync(file,'utf8');assert.ok(!source.includes('browser-provider-fixture')&&!source.includes('server-only-fixture'),file);if(source.startsWith('"use client"'))assert.ok(!/SUPABASE_SERVICE_ROLE_KEY|AUTH_ENCRYPTION_KEY|lib\/auth\/(server|provider|service)/.test(source),file)}
});
test('production code no longer reads development identity environment variables',()=>{
 for(const file of [...files('app'),...files('lib'),...files('components')].filter(x=>/\.tsx?$/.test(x)))assert.ok(!/process\.env\.TOOLHUB_USER_(ROLE|ID|NAME)/.test(fs.readFileSync(file,'utf8')),file)
});
