const {PrismaClient}=require('@prisma/client');
const {createClient}=require('@supabase/supabase-js');
const roles=['STAFF','MARKETING','MANAGER','ADMIN'];
async function linkUser(db,provider,input){
 if(!input.confirm||!input.userId||!input.providerUserId||!roles.includes(input.role)||!input.name?.trim())throw Error('Supply --confirm, --user-id, --provider-user-id, --role and --name');
 const {data,error}=await provider.auth.admin.getUserById(input.providerUserId);
 if(error||!data.user?.email)throw Error('Provider identity could not be verified');
 const email=data.user.email.toLowerCase();
 return db.$transaction(async tx=>{
  const existing=await tx.user.findUnique({where:{id:input.userId}});
  if(existing?.authProviderUserId&&(existing.authProviderUserId!==data.user.id||existing.authProvider!=='supabase'))throw Error('Existing provider link cannot be reassigned');
  if(existing&&existing.role!==input.role)throw Error('Preserve the historical role; change it through user administration');
  const adminCount=await tx.user.count({where:{role:'ADMIN',active:true,authProvider:'supabase',authProviderUserId:{not:null}}});
  let actor=null;
  if(adminCount===0){if(!input.bootstrapAdmin||input.role!=='ADMIN')throw Error('First linked administrator requires --bootstrap-admin');}
  else {actor=await tx.user.findUnique({where:{id:input.actorId||''}});if(!actor?.active||actor.role!=='ADMIN'||actor.authProvider!=='supabase'||!actor.authProviderUserId)throw Error('Supply a linked active administrator with --actor-id');}
  const duplicate=await tx.user.findUnique({where:{email}});
  if(duplicate&&duplicate.id!==input.userId)throw Error('Email belongs to an existing Toolhub user; preserve that user ID');
  const user=await tx.user.upsert({where:{id:input.userId},update:{authProvider:'supabase',authProviderUserId:data.user.id,email},create:{id:input.userId,email,name:input.name.trim(),role:input.role,authProvider:'supabase',authProviderUserId:data.user.id}});
  await tx.authSession.deleteMany({where:{userId:user.id}});
  await tx.auditLog.create({data:{action:'USER_INVITED',entityType:'USER',entityId:user.id,userId:actor?.id||user.id,userName:actor?.name||user.name,metadata:JSON.stringify({method:'operator_verified_supabase_link',bootstrap:adminCount===0,existingUser:Boolean(existing)})}});
  return{id:user.id,role:user.role,active:user.active};
 });
}
async function main(){
 const args=process.argv.slice(2),arg=name=>{const index=args.indexOf('--'+name);return index<0?undefined:args[index+1]};
 if(!args.includes('--confirm'))throw Error('No changes made. Read docs/production-authentication.md before using --confirm.');
 if(process.env.AUTH_MODE!=='supabase'||!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Server authentication configuration is incomplete');
 const db=new PrismaClient(),provider=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 try{await linkUser(db,provider,{confirm:true,userId:arg('user-id'),providerUserId:arg('provider-user-id'),role:arg('role'),name:arg('name'),actorId:arg('actor-id'),bootstrapAdmin:args.includes('--bootstrap-admin')});console.log('Toolhub provider identity linked; audit event recorded.');}
 finally{await db.$disconnect()}
}
module.exports={linkUser};
if(require.main===module)main().catch(error=>{console.error(error instanceof Error&&/^(Supply|First linked|Existing provider|Preserve|Email belongs|No changes made|Server authentication|Provider identity)/.test(error.message)?error.message:'Unable to link account; inspect configuration without printing credentials.');process.exitCode=1});
