const test = require("node:test");
const assert = require("node:assert/strict");
const { productSchema, productMatchesSearch, productToAdvertSnapshot } = require("../.test-dist/lib/product.js");
const { assertCanSubmit, assertCanReview, approvalActionSchema, ADVERT_STATUSES, AUDIT_ACTIONS } = require("../.test-dist/lib/workflow.js");
const { canEditAdvert, canApproveAdvert, canManageProducts } = require("../.test-dist/lib/user-role.js");

const staff={id:"dev-staff-1",name:"Toolhub Staff",email:"s@t",role:"STAFF"};
const marketing={id:"dev-marketing-1",name:"Toolhub Marketing",email:"m@t",role:"MARKETING"};
const manager={id:"dev-manager-1",name:"Toolhub Manager",email:"g@t",role:"MANAGER"};
const product={id:"p1",sku:"TEST-CIDLI20",barcode:"600123",brand:"INGCO",productName:"20V CORDLESS DRILL KIT",category:"Cordless Tools",primarySpecification:"2 x 2.0Ah BATTERIES + CHARGER",secondarySpecification:"Compact kit",feature01:"20V POWER",feature02:"2 BATTERIES",keyBenefit:"IDEAL FOR DIY & TRADE",normalPrice:2799,currentPrice:2499,websiteUrl:"https://www.toolhub.co.za",originalImageUrl:"data:image/jpeg;base64,a",processedImageUrl:"data:image/png;base64,b",backgroundRemovalStatus:"COMPLETE",active:true};

test("validates product creation and current price",()=>{assert.equal(productSchema.safeParse(product).success,true);assert.equal(productSchema.safeParse({...product,currentPrice:0}).success,false)});
test("product search matches SKU, name, barcode, brand and category",()=>{for(const query of ["cidli","cordless drill","600123","ingco","cordless tools"])assert.equal(productMatchesSearch(product,query),true)});
test("product snapshot copies price and processed image without live linkage",()=>{const snap=productToAdvertSnapshot(product);product.currentPrice=1999;assert.equal(snap.sellingPrice,"2499");assert.equal(snap.processedImageUrl,"data:image/png;base64,b")});
test("role rules allow product work and lock approved adverts",()=>{assert.equal(canManageProducts(staff.role),true);assert.equal(canEditAdvert({status:"APPROVED",createdByUserId:staff.id},staff),false);assert.equal(canEditAdvert({status:"CHANGES_REQUESTED",createdByUserId:staff.id},staff),true)});
test("DRAFT and CHANGES_REQUESTED submit to awaiting approval",()=>{assert.equal(assertCanSubmit({status:"DRAFT",createdByUserId:staff.id},staff),"SUBMIT_FOR_APPROVAL");assert.equal(assertCanSubmit({status:"CHANGES_REQUESTED",createdByUserId:staff.id},staff),"RESUBMIT_FOR_APPROVAL")});
test("invalid states cannot submit",()=>assert.throws(()=>assertCanSubmit({status:"APPROVED",createdByUserId:staff.id},staff),/FORBIDDEN|INVALID_TRANSITION/));
test("manager can approve another user's awaiting advert",()=>assert.equal(assertCanReview({status:"AWAITING_APPROVAL",createdByUserId:staff.id,submittedByUserId:staff.id},"APPROVE",manager),"APPROVED"));
test("awaiting advert can request changes or reject",()=>{assert.equal(assertCanReview({status:"AWAITING_APPROVAL",createdByUserId:staff.id},"REQUEST_CHANGES",manager),"CHANGES_REQUESTED");assert.equal(assertCanReview({status:"AWAITING_APPROVAL",createdByUserId:staff.id},"REJECT",manager),"REJECTED")});
test("staff cannot approve and self approval is blocked",()=>{assert.throws(()=>assertCanReview({status:"AWAITING_APPROVAL",createdByUserId:staff.id},"APPROVE",staff),/FORBIDDEN/);assert.equal(canApproveAdvert({createdByUserId:marketing.id,submittedByUserId:marketing.id},marketing),false);assert.throws(()=>assertCanReview({status:"AWAITING_APPROVAL",createdByUserId:manager.id,submittedByUserId:manager.id},"APPROVE",manager),/SELF_APPROVAL/)});
test("changes and rejection require comments",()=>{assert.equal(approvalActionSchema.safeParse({action:"REQUEST_CHANGES",comment:""}).success,false);assert.equal(approvalActionSchema.safeParse({action:"REJECT",comment:"Incorrect price"}).success,true)});
test("future statuses remain reserved and required audit actions exist",()=>{assert.deepEqual(ADVERT_STATUSES.slice(0,5),["DRAFT","AWAITING_APPROVAL","CHANGES_REQUESTED","APPROVED","REJECTED"]);for(const action of ["SUBMIT_FOR_APPROVAL","REQUEST_CHANGES","APPROVE","REJECT","PRODUCT_CREATE","PRODUCT_UPDATE"])assert.ok(AUDIT_ACTIONS.includes(action))});
