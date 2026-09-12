const test=require('node:test');const assert=require('node:assert/strict');const {deflateSync}=require('node:zlib');const {hasTransparentPng}=require('../.test-dist/lib/png-transparency');
function png(alpha){return require('./png-fixture.cjs').dataUrl(2,1,alpha===0)}
test('review rejects painted/opaque or invalid PNG and accepts real visible alpha',()=>{assert.equal(hasTransparentPng(png(0)),true);assert.equal(hasTransparentPng(png(255)),false);assert.equal(hasTransparentPng('data:image/png;base64,AAAA'),false);assert.equal(hasTransparentPng('data:image/jpeg;base64,AAAA'),false);});
