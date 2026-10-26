/* FX browser: immutable source, bounded previews, worker rendering, transactional Apply. */
'use strict';
const FX_UI={session:null,last:'brightness',group:'all',query:'',workerAvailable:typeof Worker!=='undefined'};
window.KanvasFXUI=FX_UI;
const fxValid=s=>FX_UI.session===s&&s.layer===activeL()&&s.artId===S.artId&&s.revision===editRevision&&s.W===S.W&&s.H===S.H;
function fxStop(s){clearTimeout(s.timer);if(s.worker){s.worker.terminate();s.worker=null}s.reject?.(new Error('cancelled'));s.reject=null}
function fxCancel(s){if(FX_UI.session!==s)return;fxStop(s);FX_UI.session=null;previewOn=false;document.body.classList.remove('fx-open');compositeAll()}
function fxScaled(source,max=640){const scale=Math.min(1,max/Math.max(source.width,source.height)),c=mkC(Math.round(source.width*scale),Math.round(source.height*scale));c.getContext('2d').drawImage(source,0,0,c.width,c.height);return {data:c.getContext('2d').getImageData(0,0,c.width,c.height),scale:c.width/source.width}}
function fxMessage(s,data,scale,mask){return {id:s.filter.id,image:{width:data.width,height:data.height,data:new Uint8ClampedArray(data.data)},params:{...s.params},scale,mask:mask?new Uint8ClampedArray(mask.data):null,alphaLock:s.layer.alphaLock,strength:s.strength}}
async function fxRender(s,data,scale,mask){
 const message=fxMessage(s,data,scale,mask);fxStop(s);
 if(FX_UI.workerAvailable){
  try{return await new Promise((resolve,reject)=>{let worker;try{worker=new Worker('fx-worker.js')}catch(_){FX_UI.workerAvailable=false;reject(new Error('worker-unavailable'));return}s.worker=worker;s.reject=reject;
   worker.onmessage=e=>{worker.terminate();if(s.worker===worker){s.worker=null;s.reject=null}e.data.error?reject(new Error(e.data.error)):resolve(e.data.image)};
   worker.onerror=e=>{e.preventDefault();worker.terminate();if(s.worker===worker){s.worker=null;s.reject=null}FX_UI.workerAvailable=false;reject(new Error('worker-unavailable'))};
   const transfer=[message.image.data.buffer];if(message.mask)transfer.push(message.mask.buffer);worker.postMessage(message,transfer);
  })}catch(e){if(e.message==='cancelled')throw e;if(e.message!=='worker-unavailable'&&FX_UI.workerAvailable)throw e}
 }
 // file:// or older WebViews can reject Worker construction. Rendering still works locally.
 await new Promise(resolve=>setTimeout(resolve,0));if(!fxValid(s))throw new Error('cancelled');
 const effect=KanvasFX.run(s.filter.id,data,s.params,scale);return KanvasFX.constrain(data,effect,mask?.data,s.layer.alphaLock,s.strength);
}
function fxStatus(s,message){if(FX_UI.session===s){const el=$('#fxStatus');if(el)el.textContent=message}}
function fxShow(s,result,original=false){if(!fxValid(s))return;const data=original?s.small:result;if(!data)return;
 const c=mkC(data.width,data.height);c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(data.data),data.width,data.height),0,0);
 const preview=$('#fxPreview');if(preview){const x=preview.getContext('2d');x.clearRect(0,0,preview.width,preview.height);const k=Math.min(preview.width/data.width,preview.height/data.height);x.drawImage(c,(preview.width-data.width*k)/2,(preview.height-data.height*k)/2,data.width*k,data.height*k)}
 pc.setTransform(1,0,0,1,0,0);pc.globalCompositeOperation='copy';pc.globalAlpha=1;pc.imageSmoothingEnabled=true;pc.drawImage(c,0,0,S.W,S.H);pc.globalCompositeOperation='source-over';previewOn=true;compositeAll();
}
function fxRequest(s,delay=110){if(!fxValid(s)||s.applying)return;fxStop(s);s.result=null;s.comparing=false;const compare=$('#fxCompare');if(compare){compare.textContent='View original';compare.setAttribute('aria-pressed','false')}const btn=$('#fxApply');if(btn)btn.disabled=true;fxStatus(s,'Rendering preview…');s.timer=setTimeout(async()=>{
 try{const result=await fxRender(s,s.small,s.scale,s.smallMask);if(!fxValid(s))return;s.result=result;fxShow(s,result,s.comparing);fxStatus(s,'Preview · '+s.small.width+' × '+s.small.height+' · Apply renders at full resolution');$('#fxApply').disabled=false}
 catch(e){if(e.message==='cancelled'||!fxValid(s))return;fxStatus(s,'Preview failed. Try a smaller radius or a different effect.');toast('Couldn’t preview this filter. Your layer is unchanged.')}
 },delay)}
function fxDrawTiles(s){const q=FX_UI.query.toLowerCase(),items=KanvasFX.catalog.filter(f=>(FX_UI.group==='all'||f.group===FX_UI.group)&&f.name.toLowerCase().includes(q));
 $('#fxTiles').innerHTML=items.length?items.map(f=>`<button class="fx-tile ${s.filter.id===f.id?'on':''}" data-fx="${f.id}" aria-pressed="${s.filter.id===f.id}"><canvas width="140" height="96" aria-hidden="true"></canvas><span>${esc(f.name)}</span></button>`).join(''):'<p class="note">No matching filters.</p>';
 const thumb=fxScaled(s.thumb,80).data;
 $$('[data-fx]').forEach(button=>{const f=KanvasFX.catalog.find(f=>f.id===button.dataset.fx),c=$('canvas',button),x=c.getContext('2d');try{const o=KanvasFX.run(f.id,thumb,KanvasFX.defaults(f.id),thumb.width/s.W),t=mkC(o.width,o.height);t.getContext('2d').putImageData(new ImageData(o.data,o.width,o.height),0,0);const k=Math.min(c.width/o.width,c.height/o.height);x.drawImage(t,(c.width-o.width*k)/2,(c.height-o.height*k)/2,o.width*k,o.height*k)}catch(_){x.fillStyle='#36333f';x.fillRect(0,0,c.width,c.height)}
  button.onclick=()=>{if(s.applying)return;s.filter=f;s.params=KanvasFX.defaults(f.id);if('color'in s.params)s.params.color=curHex();FX_UI.last=f.id;fxDrawControls(s);fxDrawTiles(s);fxRequest(s,0)}
 });
 $('#fxCount').textContent=items.length+' filters';
}
function fxDrawControls(s){
 $('#fxDescription').textContent=s.filter.description;$('#fxName').textContent=s.filter.name;
 $('#fxParameters').innerHTML=s.filter.params.map(p=>p.type==='color'?`<label class="fx-color"><span>${esc(p.label)}</span><input type="color" data-fxp="${p.key}" value="${s.params[p.key]}" aria-label="${esc(p.label)}"></label>`:`<label class="fx-param"><span>${esc(p.label)}</span><input type="range" data-fxp="${p.key}" aria-label="${esc(p.label)}" min="${p.min}" max="${p.max}" step="${p.step}" value="${s.params[p.key]}"><output data-fxo="${p.key}">${s.params[p.key]}</output></label>`).join('');
 $$('[data-fxp]').forEach(el=>{el.oninput=()=>{if(s.applying)return;s.params[el.dataset.fxp]=el.type==='color'?el.value:+el.value;const out=$(`[data-fxo="${el.dataset.fxp}"]`);if(out)out.textContent=el.value;fxRequest(s)}});
 $('#fxReset').onclick=()=>{if(s.applying)return;s.params=KanvasFX.defaults(s.filter.id);s.strength=1;$('#fxStrength').value=100;$('#fxStrengthOut').textContent='100%';fxDrawControls(s);fxRequest(s,0)};
}
async function fxApply(s){
 if(!fxValid(s)||s.applying||!s.result)return;
 if(s.strength===0){closeSheet();toast('No effect applied');return}
 s.applying=true;$$('#fxParameters input,#fxStrength').forEach(el=>el.disabled=true);$('#fxApply').disabled=true;$('#fxReset').disabled=true;$('#fxSearch').disabled=true;$('#fxQuick').disabled=true;$('#fxCompare').disabled=true;
 fxStatus(s,'Applying at '+S.W+' × '+S.H+'… You can still cancel.');
 try{const result=await fxRender(s,s.original,1,s.mask);if(!fxValid(s))return;
  const L=s.layer,before={r:FULL(),img:s.original,text:s.text};L.ctx.putImageData(new ImageData(new Uint8ClampedArray(result.data),S.W,S.H),0,0);L.text=null;
  pixelHist(L,before,'FX · '+s.filter.name);s.revision=editRevision;closeSheet();renderLayers();toast(s.filter.name+' applied');
 }catch(e){if(e.message==='cancelled'||FX_UI.session!==s)return;s.applying=false;$$('#fxParameters input,#fxStrength').forEach(el=>el.disabled=false);$('#fxApply').disabled=false;$('#fxReset').disabled=false;$('#fxSearch').disabled=false;$('#fxQuick').disabled=false;$('#fxCompare').disabled=false;fxStatus(s,'Couldn’t apply. Your original layer is unchanged.');toast('The filter couldn’t be applied. Try a smaller canvas or less demanding settings.')}
}
function openFX(id){
 if(inGallery)return toast('Open an artwork to use filters.');if(FL)return toast('Finish the transform first');if(ST)endStroke();const L=activeL();if(!L?.visible)return toast('Show this layer before applying a filter.');
 closeSheet();
 const small=fxScaled(L.canvas),mask=S.sel?mc.getImageData(0,0,S.W,S.H):null,smallMask=mask?fxScaled(msk).data:null;
 const filter=KanvasFX.catalog.find(f=>f.id===(id||FX_UI.last))||KanvasFX.catalog[0];
 const s={layer:L,artId:S.artId,W:S.W,H:S.H,revision:editRevision,original:L.ctx.getImageData(0,0,S.W,S.H),text:L.text,small:small.data,scale:small.scale,mask,smallMask,thumb:L.canvas,filter,params:KanvasFX.defaults(filter.id),strength:1,result:null,applying:false,comparing:false,worker:null,reject:null};
 if('color'in s.params)s.params.color=curHex();
 openSheet('fx','FX Studio',`<div class="fx-intro"><span>Finish your artwork with a new perspective.</span><button class="btn sm" id="fxQuick">Quick adjustments</button></div>
 <div class="fx-browser"><div class="fx-library"><input type="text" id="fxSearch" aria-label="Search filters" placeholder="Search ${KanvasFX.catalog.length} filters…" value="${esc(FX_UI.query)}"><div class="fx-categories" aria-label="Filter categories"><button data-fxgroup="all" class="${FX_UI.group==='all'?'on':''}">All</button>${KanvasFX.groups.map(([k,n])=>`<button data-fxgroup="${k}" class="${FX_UI.group===k?'on':''}">${n}</button>`).join('')}</div><div class="fx-library-head"><span id="fxCount"></span><span>Active layer</span></div><div id="fxTiles"></div></div>
 <div class="fx-details"><div class="fx-preview-wrap checker"><canvas id="fxPreview" width="640" height="440" aria-label="Filter preview"></canvas></div><div class="fx-effect-heading"><h3 id="fxName"></h3><button class="btn sm" id="fxCompare" aria-pressed="false">View original</button></div><p class="note" id="fxDescription"></p><div id="fxParameters"></div><label class="fx-param"><span>Mix</span><input type="range" id="fxStrength" aria-label="Filter mix" min="0" max="100" value="100"><output id="fxStrengthOut">100%</output></label><p class="fx-target">${esc(L.name)} · ${S.sel?'Selection only':'Entire active layer'}${L.alphaLock?' · Transparency locked':''}${L.text?' · Applying rasterizes text':''}</p><p class="note fx-status" id="fxStatus" role="status">Preparing preview…</p></div></div>`,{tall:true,onClose:()=>fxCancel(s),foot:`<div class="fx-footer"><button class="btn" id="fxReset">Reset</button><span class="note">Preview first. One undo restores your layer.</span><button class="btn" id="fxCancel">Cancel</button><button class="btn pri" id="fxApply" disabled>${icon('check')}Apply</button></div>`});
 FX_UI.session=s;document.body.classList.add('fx-open');
 $$('[data-fxgroup]').forEach(b=>b.onclick=()=>{if(s.applying)return;FX_UI.group=b.dataset.fxgroup;$$('[data-fxgroup]').forEach(el=>el.classList.toggle('on',el===b));fxDrawTiles(s)});
 $('#fxSearch').oninput=e=>{FX_UI.query=e.target.value;fxDrawTiles(s)};
 $('#fxStrength').oninput=e=>{if(s.applying)return;s.strength=+e.target.value/100;$('#fxStrengthOut').textContent=e.target.value+'%';fxRequest(s)};
 $('#fxCompare').onclick=()=>{if(!s.result||s.applying)return;s.comparing=!s.comparing;$('#fxCompare').textContent=s.comparing?'View effect':'View original';$('#fxCompare').setAttribute('aria-pressed',s.comparing);fxShow(s,s.result,s.comparing)};
 $('#fxCancel').onclick=closeSheet;$('#fxApply').onclick=()=>fxApply(s);$('#fxQuick').onclick=()=>{closeSheet();openLegacyAdjust()};
 fxDrawControls(s);fxDrawTiles(s);fxRequest(s,0);$('#shClose').focus({preventScroll:true});
}
// Escape always cancels, including while the search box is focused or rendering is running.
window.addEventListener('keydown',e=>{if(!FX_UI.session)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeSheet()}else if(e.key==='Tab'){const controls=$$('button:not([disabled]),input:not([disabled]),select:not([disabled])',$('#sheet')).filter(el=>el.offsetParent!==null),first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}},true);
const fxBaseBack=window.kanvasBack;window.kanvasBack=()=>{if(FX_UI.session){closeSheet();return true}return fxBaseBack()};
