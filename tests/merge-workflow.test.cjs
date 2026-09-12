const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{execFileSync}=require('node:child_process');
const {dataUrl}=require('./png-fixture.cjs'),{TEST_ADVERT}=require('./advert-fixture.cjs');
const tempRoot=path.resolve('tmp');fs.mkdirSync(tempRoot,{recursive:true});const temp=fs.mkdtempSync(path.join(tempRoot,'merge-test-'));fs.writeFileSync(path.join(temp,'test.db'),Buffer.alloc(0));
process.env.DATABASE_URL='file:'+path.join(temp,'test.db').replaceAll('\\','/');
process.env.SOCIAL_PUBLISHING_MODE='dry-run';process.env.AI_MODE='mock';process.env.AUTO_SCHEDULING_MODE='approved-plans-only';
delete process.env.SUPABASE_URL;delete process.env.SUPABASE_SERVICE_ROLE_KEY;
// Compile-time aliases resolved only inside this isolated Node test process.
const Module=require('node:module'),resolve=Module._resolveFilename;
Module._resolveFilename=function(name,...rest){return resolve.call(this,name.startsWith('@/')?path.resolve('.test-dist',name.slice(2)):name,...rest)};
const {prisma}=require('../.test-dist/lib/prisma');
const route=name=>require('../.test-dist/app/api/'+name+'/route');
const actor=(role,id=role.toLowerCase())=>{process.env.TOOLHUB_USER_ROLE=role;process.env.TOOLHUB_USER_ID=id;return {id,name:'Toolhub '+role,email:id+'@toolhub.local',role}};
const req=(body,method='POST')=>new Request('http://localhost/api/test',{method,headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const params=id=>({params:Promise.resolve({id})});
const input=()=>({...TEST_ADVERT,sku:'REAL-TEST-SAW',productName:'Reciprocating saw',primarySpecification:'Wood: 210 mm',secondarySpecification:'Metal: 12 mm',feature01:'12 mm metal cutting capacity',feature02:'',sellingPrice:'1299',pricingMethod:'MANUAL',originalImageUrl:dataUrl(),processedImageUrl:dataUrl(),backgroundRemovalStatus:'COMPLETE'});
let staff,manager,admin;
test.before(async()=>{
 execFileSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy'],{env:process.env,stdio:'pipe'});
 execFileSync(process.execPath,['prisma/seed.cjs'],{env:process.env,stdio:'pipe'});
 staff=actor('STAFF','staff-test');manager=actor('MANAGER','manager-test');admin=actor('ADMIN','admin-test');
 for(const user of [staff,manager,admin])await prisma.user.create({data:user});
});
test.after(async()=>{await prisma.$disconnect();if(!fs.realpathSync(temp).startsWith(fs.realpathSync(tempRoot)+path.sep))throw Error('Unexpected test directory');fs.rmSync(temp,{recursive:true,force:true});});
async function createAdvert(){actor('STAFF',staff.id);const r=await route('adverts').POST(req(input()));assert.equal(r.status,201,await r.clone().text());return r.json()}
async function submittedAdvert(){const advert=await createAdvert();const response=await route('adverts/[id]/submit').POST(req({expectedUpdatedAt:advert.updatedAt,artworkDataUrl:dataUrl(1080,1350,false)}),params(advert.id));assert.equal(response.status,200,await response.clone().text());return prisma.advertisement.findUniqueOrThrow({where:{id:advert.id}})}
async function approvedAdvert(){const advert=await submittedAdvert();const asset=await prisma.advertisementAsset.findFirstOrThrow({where:{advertisementId:advert.id}});actor('MANAGER',manager.id);const response=await route('approvals/[id]').POST(req({action:'APPROVE',artworkAssetId:asset.id}),params(advert.id));assert.equal(response.status,200,await response.clone().text());return prisma.advertisement.findUniqueOrThrow({where:{id:advert.id}})}
test('fresh migrations and metadata-only seed never create demo products or identities',async()=>{assert.equal(await prisma.product.count(),0);assert.equal(await prisma.user.count({where:{id:{startsWith:'dev-'}}}),0)});
test('general advert API rejects fake/corrupt/opaque processed PNG and persists no advert',async()=>{
 actor('STAFF',staff.id);const count=await prisma.advertisement.count();
 for(const processedImageUrl of ['data:image/png;base64,AAAA',dataUrl(2,1,false),dataUrl().slice(0,-8)]){const r=await route('adverts').POST(req({...input(),processedImageUrl}));assert.equal(r.status,400)}
 assert.equal(await prisma.advertisement.count(),count);
});
test('product API applies the same server PNG guard',async()=>{
 actor('STAFF',staff.id);const r=await route('products').POST(req({...input(),brand:'INGCO',category:'Tools',currentPrice:1299,processedImageUrl:'data:image/png;base64,AAAA'}));assert.equal(r.status,400);assert.equal(await prisma.product.count(),0);
});
test('new draft stays DRAFT, manual price retained, distinct specs persist once',async()=>{const created=await createAdvert(),advert=await prisma.advertisement.findUniqueOrThrow({where:{id:created.id}});assert.equal(advert.status,'DRAFT');assert.equal(advert.sellingPrice,1299);assert.equal(advert.feature01,'');assert.equal(advert.secondarySpecification,'Metal: 12 mm');assert.equal(advert.submittedAt,null)});
test('submission rejects wrong dimensions and concurrent stale revision before state changes',async()=>{
 const created=await createAdvert();for(const body of [{expectedUpdatedAt:created.updatedAt,artworkDataUrl:dataUrl(1200,1200,false)},{expectedUpdatedAt:'stale',artworkDataUrl:dataUrl(1080,1350,false)}]){const r=await route('adverts/[id]/submit').POST(req(body),params(created.id));assert.ok([400,409].includes(r.status))}
 assert.equal((await prisma.advertisement.findUniqueOrThrow({where:{id:created.id}})).status,'DRAFT');
});
test('manager approval is bound to the exact submitted PNG shown during review',async()=>{
 const advert=await submittedAdvert();actor('MANAGER',manager.id);
 const r=await route('approvals/[id]').POST(req({action:'APPROVE',artworkAssetId:'unseen'}),params(advert.id));assert.equal(r.status,409);
 assert.equal((await prisma.advertisement.findUniqueOrThrow({where:{id:advert.id}})).status,'AWAITING_APPROVAL');
});
test('creator cannot self-approve an advert even after gaining manager role',async()=>{
 const advert=await submittedAdvert();actor('MANAGER',staff.id);const r=await route('approvals/[id]').POST(req({action:'APPROVE'}),params(advert.id));assert.equal(r.status,403);
});
test('route gates deny staff management actions, Marketing admin settings and all unconfigured requests',async()=>{
 actor('STAFF',staff.id);
 for(const [name,method] of [['approvals/[id]','POST'],['plans','POST'],['social-posts','POST'],['social-posts/[id]/action','POST'],['ai/status','POST'],['social-channels','PATCH']]){const response=await route(name)[method](req({}),params('missing'));assert.equal(response.status,403,name)}
 actor('MARKETING','marketing-test');for(const name of ['ai/status','social-channels'])assert.equal((await route(name).POST(req({}))).status,403);
 delete process.env.TOOLHUB_USER_ROLE;for(const name of ['products','adverts','pdf-imports','plans','session'])assert.equal((await route(name).GET(new Request('http://localhost/api/test'))).status,401,name);
});
test('publishing uses approved final bytes and refuses any caller-supplied cut-out',async()=>{
 const advert=await approvedAdvert();const {syncSocialChannels,createSocialPost}=require('../.test-dist/lib/social-service');await syncSocialChannels(admin);
 const channels=await prisma.socialChannel.findMany();const source={idempotencyKey:'approved-artwork-test',advertisementId:advert.id,caption:'Saw',channelIds:[channels[0].id],mode:'SCHEDULE',scheduledLocal:'2099-10-10T10:00',timezone:'Africa/Johannesburg'};
 await assert.rejects(()=>createSocialPost({...source,artworkDataUrl:advert.productImage},manager),/ARTWORK_REQUIRES_REVIEW/);
 const post=await createSocialPost(source,manager);assert.equal(post.finalArtworkData,dataUrl(1080,1350,false));assert.notEqual(post.finalArtworkData,advert.productImage);assert.equal(post.status,'SCHEDULED');assert.equal(post.dryRun,true);
 await assert.rejects(()=>createSocialPost(source,null),/UNAUTHENTICATED/);
 await assert.rejects(()=>createSocialPost(source,staff),/FORBIDDEN/);
});
test('legacy approved record with only a cut-out is blocked by manual and automatic scheduling',async()=>{
 const created=await createAdvert();const advert=await prisma.advertisement.update({where:{id:created.id},data:{status:'APPROVED',approvedAt:new Date(),approvedByUserId:manager.id}});
 const {createSocialPost}=require('../.test-dist/lib/social-service'),{planAction}=require('../.test-dist/lib/plan-service');const channel=await prisma.socialChannel.findFirstOrThrow();
 await assert.rejects(()=>createSocialPost({idempotencyKey:'missing-final-test',advertisementId:advert.id,caption:'Saw',channelIds:[channel.id],mode:'SCHEDULE',scheduledLocal:'2099-10-10T11:00',timezone:'Africa/Johannesburg',artworkDataUrl:advert.productImage},manager),/FINAL_ARTWORK_MISSING/);
 const plan=await prisma.contentPlan.create({data:{weekStart:new Date('2099-10-01'),status:'PLAN_APPROVED',createdByUserId:staff.id,approvedByUserId:manager.id,items:{create:{advertisementId:advert.id,channelId:channel.id,plannedAt:new Date('2099-10-11T10:00:00Z'),position:0,masterCaption:'Saw',captionState:'READY',status:'READY',reason:'Test'}}},include:{items:true}});
 const result=await planAction(plan.id,'activate',manager);assert.equal(result.scheduled,0);assert.equal(result.blocked,1);
 const item=await prisma.contentPlanItem.findUniqueOrThrow({where:{id:plan.items[0].id}});assert.equal(item.status,'BLOCKED');assert.match(item.warnings,/FINAL_ARTWORK_MISSING/);assert.equal(item.socialPostId,null);
});
test('plan creator cannot self-approve via the API',async()=>{
 actor('MANAGER',manager.id);const plan=await prisma.contentPlan.create({data:{weekStart:new Date(),status:'AWAITING_PLAN_APPROVAL',createdByUserId:manager.id}});
 const r=await route('plans/[id]/action').POST(req({action:'approve'}),params(plan.id));assert.equal(r.status,403);
});
test('draft price corrections append old/new values while original extracted values survive',async()=>{
 const created=await createAdvert();const original={extracted:{nettPrice:{value:'1000',confidence:'HIGH'}},calculatedSellingPrice:1558};await prisma.advertisement.update({where:{id:created.id},data:{pricingAuditJson:JSON.stringify(original)}});
 actor('STAFF',staff.id);for(const sellingPrice of ['1499','1599'])assert.equal((await route('adverts/[id]').PUT(req({...input(),sellingPrice}),params(created.id))).status,200);
 const advert=await prisma.advertisement.findUniqueOrThrow({where:{id:created.id}});assert.deepEqual(JSON.parse(advert.pricingAuditJson),original);
 const logs=await prisma.auditLog.findMany({where:{advertisementId:advert.id,action:'UPDATE_DRAFT'},orderBy:{createdAt:'asc'}});assert.equal(logs.length,2);const a=JSON.parse(logs[0].metadata),b=JSON.parse(logs[1].metadata);
 assert.equal(a.pricingBefore.finalSellingPrice,1299);assert.equal(a.pricingAfter.finalSellingPrice,1499);assert.equal(b.pricingBefore.finalSellingPrice,1499);assert.equal(b.pricingAfter.finalSellingPrice,1599);assert.equal(b.pricingAfter.extracted.nettPrice.value,'1000');assert.equal(logs[1].userId,staff.id);
});

test('PDF corrections retain extraction, specs, power and image history through manual override and draft creation',async()=>{
 actor('STAFF',staff.id);
 const {heuristicPageAnalysis}=require('../.test-dist/lib/pdf-import');
 const created=await route('pdf-imports').POST(req({filename:'saw.pdf',mimeType:'application/pdf',size:1234,pageCount:1}));assert.equal(created.status,201);const imp=await created.json();
 const ctx={params:Promise.resolve({id:imp.id,pageNumber:'1'})};
 let response=await route('pdf-imports/[id]/pages/[pageNumber]/analyze').POST(req({embeddedText:'INGCO\nProduct: Brushless reciprocating saw\nWood: 210 mm\nMetal:12 mm\nBattery and charger sold separately',pagePreviewDataUrl:dataUrl()}),ctx);assert.equal(response.status,200);
 let page=await response.json(),analysis=JSON.parse(page.analysisJson);const original=page.extractedPricingJson;
 analysis.productName.confidence='HIGH';analysis.productName.source='USER';analysis.skuNotFoundAcknowledged=true;
 const review={action:'save',analysis,pricing:{method:'MANUAL',manualFinalSellingPrice:'1299'},selectedImageDataUrl:dataUrl(),processedImageDataUrl:dataUrl(),backgroundRemovalStatus:'COMPLETE'};
 response=await route('pdf-imports/[id]/pages/[pageNumber]').POST(req(review),ctx);assert.equal(response.status,200,await response.clone().text());
 const altered={...review,analysis:{...analysis,productName:{...analysis.productName,value:'Corrected reciprocating saw'}},selectedImageDataUrl:dataUrl(3,1,true),pricing:{method:'MANUAL',manualFinalSellingPrice:'1399'}};
 response=await route('pdf-imports/[id]/pages/[pageNumber]').POST(req(altered),ctx);assert.equal(response.status,200);
 page=await prisma.pdfImportPage.findUniqueOrThrow({where:{id:page.id}});assert.equal(page.extractedPricingJson,original);
 const logs=await prisma.auditLog.findMany({where:{entityId:page.id,action:'PDF_REVIEW_CORRECTION'},orderBy:{createdAt:'asc'}});assert.equal(logs.length,2);const history=JSON.parse(logs[1].metadata);
 assert.equal(history.before.analysis.productName.value,'Brushless reciprocating saw');assert.equal(history.after.analysis.productName.value,'Corrected reciprocating saw');assert.equal(history.before.trace.finalSellingPrice,1299);assert.equal(history.after.trace.finalSellingPrice,1399);assert.equal(history.imageHistory.before.source,dataUrl());assert.equal(history.imageHistory.after.source,dataUrl(3,1,true));assert.equal(history.pageId,page.id);assert.equal(history.userId,staff.id);
 response=await route('pdf-imports/[id]/pages/[pageNumber]').POST(req({...review,action:'approve'}),ctx);assert.equal(response.status,200,await response.clone().text());
 const draft=await route('pdf-imports/[id]/pages/[pageNumber]').POST(req({action:'createDraft'}),ctx);assert.equal(draft.status,201,await draft.clone().text());const ad=await draft.json();
 const advert=await prisma.advertisement.findUniqueOrThrow({where:{id:ad.id}});assert.equal(advert.status,'DRAFT');assert.equal(advert.sku,'Not found');assert.equal(advert.sellingPrice,1299);assert.equal(advert.feature01,'');assert.equal(advert.secondarySpecification,'Metal:12 mm');assert.equal(JSON.parse(advert.powerInclusionJson).batteryIncluded,'NO');assert.equal(await prisma.socialPost.count({where:{advertisementId:advert.id}}),0);
 const duplicate=await route('pdf-imports/[id]/pages/[pageNumber]').POST(req({action:'createDraft'}),ctx);assert.equal((await duplicate.json()).id,ad.id);
});
test('planner schedules the approved artwork even when a PNG product cut-out is present',async()=>{
 const advert=await approvedAdvert();const channel=await prisma.socialChannel.findFirstOrThrow();const plan=await prisma.contentPlan.create({data:{weekStart:new Date('2099-11-01'),status:'PLAN_APPROVED',createdByUserId:staff.id,approvedByUserId:manager.id,items:{create:{advertisementId:advert.id,channelId:channel.id,plannedAt:new Date('2099-11-12T10:00:00Z'),position:0,masterCaption:'Saw',captionState:'READY',status:'READY',reason:'Test'}}},include:{items:true}});
 const result=await require('../.test-dist/lib/plan-service').planAction(plan.id,'activate',manager);assert.equal(result.scheduled,1);assert.equal(result.blocked,0);const item=await prisma.contentPlanItem.findUniqueOrThrow({where:{id:plan.items[0].id}});const post=await prisma.socialPost.findUniqueOrThrow({where:{id:item.socialPostId}});assert.equal(post.finalArtworkData,dataUrl(1080,1350,false));assert.notEqual(post.finalArtworkData,advert.productImage);
});
