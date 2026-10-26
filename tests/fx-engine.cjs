const assert=require('node:assert/strict');
const FX=require('../web/fx-engine.js');
const fixture=FX.image(40,32);
for(let y=0;y<32;y++)for(let x=0;x<40;x++){const i=(y*40+x)*4;fixture.data.set([x*6,y*8,(x+y)*3,x>6&&x<33&&y>4&&y<28?200:0],i)}
const pristine=new Uint8ClampedArray(fixture.data);
for(const f of FX.catalog){const a=FX.run(f.id,fixture),b=FX.run(f.id,fixture);assert.equal(a.width,40,f.id);assert.equal(a.height,32,f.id);assert.equal(a.data.length,40*32*4,f.id);assert.ok(a.data instanceof Uint8ClampedArray,f.id);assert.deepEqual(a.data,b.data,`${f.id}: nondeterministic`);assert.deepEqual(fixture.data,pristine,`${f.id}: mutated source`)}
assert.equal(FX.catalog.length,new Set(FX.catalog.map(f=>f.id)).size);
assert.equal(FX.groups.length,8);
console.log(`PASS all ${FX.catalog.length} filters render deterministically without mutating their source`);
const source=FX.image(2,1,new Uint8ClampedArray([10,20,30,255,60,70,80,128]));
assert.deepEqual([...FX.run('invert',source).data],[245,235,225,255,195,185,175,128]);
assert.deepEqual(FX.constrain(source,FX.run('invert',source),null,false,0).data,source.data);
const mask=new Uint8ClampedArray([0,0,0,255,0,0,0,0]);const selected=FX.constrain(source,FX.run('invert',source),mask,false,1);
assert.deepEqual([...selected.data.slice(0,4)],[245,235,225,255]);assert.deepEqual(selected.data.slice(4),source.data.slice(4));
const transparent=FX.image(1,1,new Uint8ClampedArray([20,30,40,0])),opaque=FX.image(1,1,new Uint8ClampedArray([255,0,0,255]));
assert.deepEqual(FX.constrain(transparent,opaque,null,true,1).data,transparent.data);
const locked=FX.constrain(source,FX.run('border',source),null,true,1);assert.equal(locked.data[3],255);assert.equal(locked.data[7],128);
const mix=FX.constrain(opaque,FX.image(1,1),null,false,.5);assert.equal(mix.data[0],255);assert.equal(mix.data[3],128);
const impulse=FX.image(15,15);impulse.data.set([255,0,0,255],(7*15+7)*4);const blurred=FX.run('gaussian',impulse,{radius:3});
for(let i=0;i<blurred.data.length;i+=4)if(blurred.data[i+3]){assert.ok(blurred.data[i]>245,'blur must preserve premultiplied red');assert.equal(blurred.data[i+1],0);assert.equal(blurred.data[i+2],0)}
assert.throws(()=>FX.run('unimplemented',source));assert.throws(()=>FX.run('recolor',source,{color:'invalid'}));
console.log('PASS known pixel values, selection isolation, alpha lock, mix, premultiplied blur and invalid parameters');
