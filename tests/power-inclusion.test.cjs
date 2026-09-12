const {test}=require('node:test');const assert=require('node:assert/strict');
const {detectPowerInclusion:detect,powerStatement:statement,emptyPower,reviewPower}=require('../.test-dist/lib/power-inclusion.js');
for(const [text,battery,charger,display] of [
 ['Battery and charger sold separately','NO','NO','BATTERY & CHARGER SOLD SEPARATELY'],
 ['Battery and charger included','YES','YES','BATTERY + CHARGER INCLUDED'],
 ['Battery included','YES','NOT_STATED','BATTERY INCLUDED'],
 ['Charger included','NOT_STATED','YES','CHARGER INCLUDED'],
 ['2 x 2.0Ah batteries + charger','YES','YES','2 × 2.0Ah BATTERIES + CHARGER INCLUDED'],
 ['Bare tool only','NO','NO','BARE TOOL ONLY'],
 ['20V reciprocating saw. Wood: 210 mm','NOT_STATED','NOT_STATED',''],
 ['Battery and charger may be included','NOT_STATED','NOT_STATED',''],
])test(text,()=>{const p=detect(text);assert.equal(p.batteryIncluded,battery);assert.equal(p.chargerIncluded,charger);assert.equal(statement(p),display);if(display)assert.equal(p.inclusionSourceText,text);});
test('quantity and capacity are retained',()=>{const p=detect('2 x 2.0Ah batteries + charger');assert.equal(p.batteryQuantity,2);assert.equal(p.batteryCapacity,'2.0Ah');});
test('contradictory statements require confirmation',()=>{const p=detect('Battery included\nBattery sold separately');assert.equal(p.accessoryCondition,'UNCLEAR');assert.equal(statement(p),'');});
test('unknown inclusion never defaults to exclusion',()=>{assert.equal(statement(emptyPower()),'');assert.equal(statement(detect('Battery platform compatible')), '');});
test('unconfirmed edits are suppressed; explicit confirmation records user and keeps evidence',()=>{const original=detect('Battery and charger sold separately');const edit={...original,batteryIncluded:'YES',chargerIncluded:'YES',accessoryCondition:'STATED'};let p=reviewPower(original,edit,'reviewer');assert.equal(statement(p),'');p=reviewPower(original,{...edit,manuallyConfirmed:true,inclusionSourceText:'tampered'},'reviewer');assert.equal(statement(p),'BATTERY + CHARGER INCLUDED');assert.equal(p.confirmedByUserId,'reviewer');assert.equal(p.inclusionSourceText,original.inclusionSourceText);assert.equal(original.batteryIncluded,'NO');});
test('one product cannot supply another product default',()=>{detect('Battery and charger sold separately');assert.deepEqual(detect('Spanner set'),emptyPower());});

test("capacity is never confused with battery quantity",()=>{const p=detect("2.0Ah battery included");assert.equal(p.batteryQuantity,null);assert.equal(p.batteryCapacity,"2.0Ah");assert.equal(statement(p),"2.0Ah BATTERY INCLUDED");});
