/* Studio shell. Uses Kanvas' existing painting/document commands; no second document model. */
'use strict';
const studioDesktop=()=>matchMedia('(min-width:1050px)').matches;
const studioButton=(id,i,label,cls='ib')=>`<button id="${id}" class="${cls}" title="${label}" aria-label="${label}">${icon(i)}</button>`;
document.body.insertAdjacentHTML('beforeend',`
<header class="studio-head">
 <button class="brand" id="brandHome" aria-label="Kanvas home"><span class="brandmark">K</span>Kanvas <small>Studio</small></button>
 <nav class="studio-menus" aria-label="Application menu">${['File','Edit','Image','Layer','Select','View','Help'].map(n=>`<button data-menu="${n}">${n}</button>`).join('')}</nav>
 <button id="docTitle" title="Rename artwork"></button>
 <div class="head-actions">
  <span id="saveStatus" class="save-status">Saved on device</span>
  ${studioButton('searchAction','help','Find a tool or command (Ctrl+K)')}
  ${studioButton('homeAction','gallery','My Gallery')}
  <button class="btn" id="openProjectAction">${icon('open')}<span>Open</span></button>
  <button class="btn pri" id="newAction">${icon('plus')}<span>New canvas</span></button>
  <span id="editorActions"><button class="btn pri" id="exportAction">${icon('save')}<span>Export</span></button></span>
 </div>
</header>
<nav class="studio-rail" aria-label="Painting tools">
 ${TOOLS.filter(([k])=>!['filter','canvas'].includes(k)).map(([k,n,i])=>`<button data-stool="${k}" title="${n}" aria-label="${n}" aria-pressed="false">${icon(i)}</button>`).join('')}
 <span class="rail-sep"></span>
 ${studioButton('railFilter','fx','Adjustments')}${studioButton('railCanvas','canvas','Canvas settings')}
 <button id="railColor" aria-label="Color picker" title="Color picker"></button>
 <div class="rail-bottom">${studioButton('railFull','resize','Focus mode (Tab)')}${studioButton('railSettings','cog','Settings')}</div>
</nav>
<aside class="studio-inspector" aria-label="Studio panels">
 <section class="inspector-section"><div class="panel-heading">Color <span>Foreground</span></div>
 <div class="compact-color"><input type="color" id="studioColor" aria-label="Foreground color"><input type="text" id="studioHex" aria-label="Foreground hex color" maxlength="7">${studioButton('fullColor','hsbi','Open full color mixer')}</div>
 <div class="studio-palette" id="studioPalette"></div></section>
 <nav class="inspector-tabs" aria-label="Inspector panels">${['Layers','Brushes','History','Navigator'].map((n,i)=>`<button data-panel="${n.toLowerCase()}" class="${i?'':'on'}" aria-pressed="${!i}">${n}</button>`).join('')}</nav>
 <div id="inspectorBody"></div>
</aside>
<footer class="studio-status"><span id="statusDoc"></span><span id="statusLayer"></span><span id="statusHint">Space to pan · Scroll to zoom · Ctrl+K for commands</span><button id="statusZoom" title="Fit canvas"></button></footer>
<div id="commands" hidden role="dialog" aria-modal="true" aria-label="Find a command"><div class="command-box"><div class="command-search">${icon('help')}<input id="commandSearch" aria-label="Search tools and commands" placeholder="Find a tool or command…" autocomplete="off"><kbd>ESC</kbd></div><div class="command-list" id="commandList"></div><div class="command-note">↑ ↓ to navigate · Enter to run · Esc to close</div></div></div>
`);
$('#gallery').insertAdjacentHTML('afterbegin',`<aside class="gallery-side"><div class="sect">Your workspace</div><button class="on" id="sideArt">${icon('gallery')}All artworks</button><button id="sideImport">${icon('open')}Import project</button><button id="sidePhoto">${icon('image')}Import image</button><button id="sideTrash">${icon('trash')}Recently deleted</button><div class="rail-sep"></div><button id="sideBrushes">${icon('qr')}Import brush QR</button><button id="sideSettings">${icon('cog')}Settings</button><p>Kanvas Studio 0.4<br>Made for your next idea.<br>Artworks stay on this device.</p></aside>`);
$('.gh').insertAdjacentHTML('afterend',`<section class="gallery-intro"><p class="eyebrow">A little space. Endless possibilities.</p><h2>Make something<br>only you could make.</h2><p>Your canvas, your brushes, your way. Pick up where you left off or start with a fresh idea.</p><div class="row"><button class="btn pri" id="heroNew">${icon('plus')}Create a canvas</button><button class="btn" id="heroPhoto">${icon('image')}Open an image</button></div></section><div class="gallery-controls"><label for="gallerySearch">Your artworks</label><input type="text" id="gallerySearch" placeholder="Search artworks…" aria-label="Search artworks"><select id="gallerySort" aria-label="Sort artworks"><option value="updated">Recently edited</option><option value="created">Date created</option><option value="name">Name A–Z</option></select></div>`);
$('.gh h1').firstChild.textContent='Your artworks ';
let studioPanel='layers',studioSig='',studioTimer=0,studioEditing=false,studioPrevFocus=null;
const studioSet=(id,text)=>{const el=$('#'+id);if(el&&el.textContent!==text)el.textContent=text};
function studioSchedule(){if(studioTimer)return;studioTimer=setTimeout(()=>{studioTimer=0;studioSync()},100)}
function studioSync(){
 if(!S.layers.length||!activeL())return;
 const hex=curHex(),L=activeL();
 studioSet('docTitle',S.docName);studioSet('statusDoc',`${S.W} × ${S.H} px · RGB`);studioSet('statusLayer',`${L.name} · ${S.layers.length} layers`);studioSet('statusZoom',`${Math.round(S.view.s*100)}%`);
 studioSet('saveStatus',saveState==='error'?'Save failed':saveState==='saving'?'Saving…':dirty?'Unsaved changes':'Saved on device');$('#saveStatus').className='save-status '+(dirty&&saveState==='saved'?'pending':saveState);
 $('#newAction').hidden=!inGallery;$('#openProjectAction').hidden=!inGallery;
 $('#railColor').style.background=hex;
 if(document.activeElement!==$('#studioHex'))$('#studioHex').value=hex;
 if(document.activeElement!==$('#studioColor'))$('#studioColor').value=hex;
 $$('[data-stool]').forEach(b=>{const on=b.dataset.stool===toolKey();b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
 const labels={bBE:S.tool==='eraser'?'Eraser':'Brush',bTool:'Tools',bProp:'Brushes',bColor:'Color',bFull:'Focus',bLayer:'Layers',bBack:'Menu'};
 for(const[id,label]of Object.entries(labels))$('#'+id).dataset.label=label;
 if(!studioDesktop()||inGallery||studioEditing)return;
 const sig=JSON.stringify([studioPanel,S.active,S.layers.map(l=>[l.id,l.name,l.visible,l.opacity,l.blend,l.clip,l.alphaLock]),S.undo.map(e=>e.label),S.redo.map(e=>e.label),S.brushSel,S.tool,S.W,S.H]);
 if(sig!==studioSig){studioSig=sig;studioRenderInspector()}
 if(studioPanel==='navigator')studioNavigator();
}
// Hook the existing UI updates. Expensive inspector work is coalesced and happens after strokes.
const studioBarSync=barSync;barSync=function(){studioBarSync();studioSchedule()};
const studioRender=render;render=function(){studioRender();if(!ST)studioSchedule()};
const studioShowCanvas=showCanvas;showCanvas=function(){studioShowCanvas();studioSig='';studioSync()};
const studioShowGallery=showGallery;showGallery=function(){studioShowGallery();studioSync()};
const studioRenderGallery=renderGallery;renderGallery=function(){studioRenderGallery();$('#gallery').classList.toggle('has-artworks',ARTS.length>0);if(ARTS.length&&!$('#gGrid').querySelector('[data-art]'))$('#gGrid').innerHTML='<p class="search-empty">No artworks match your search.</p>';studioSchedule()};
function galleryViewArts(){const q=$('#gallerySearch').value.trim().toLowerCase(),sort=$('#gallerySort').value;return ARTS.filter(a=>a.name.toLowerCase().includes(q)).slice().sort((a,b)=>sort==='name'?a.name.localeCompare(b.name):sort==='created'?b.created-a.created:b.updated-a.updated)}
$('#gallerySearch').oninput=renderGallery;$('#gallerySort').onchange=renderGallery;
function studioChoosePanel(name){studioPanel=name;studioSig='';$$('[data-panel]').forEach(b=>{b.classList.toggle('on',b.dataset.panel===name);b.setAttribute('aria-pressed',b.dataset.panel===name)});studioSync()}
$$('[data-panel]').forEach(b=>b.onclick=()=>studioChoosePanel(b.dataset.panel));
function studioRenderInspector(){
 const root=$('#inspectorBody'),L=activeL();
 if(studioPanel==='layers'){
 root.innerHTML=`<div class="inspector-actions">${[['add','plus','New layer'],['dup','copy','Duplicate layer'],['photo','image','Import image layer'],['up','arrowu','Raise layer'],['down','arrowd','Lower layer'],['merge','merge','Merge down'],['del','trash','Delete layer'],['more','more','Layer options']].map(([a,i,n])=>`<button data-slact="${a}" title="${n}" aria-label="${n}">${icon(i)}</button>`).join('')}</div><div id="studioLayers">${S.layers.map((l,i)=>({l,i})).reverse().map(({l,i})=>`<div class="studio-layer ${i===S.active?'on':''} ${l.visible?'':'off'}" data-sl="${i}" role="button" tabindex="0" aria-label="Select ${esc(l.name)}" aria-pressed="${i===S.active}"><canvas class="thumb checker" width="76" height="84" data-sth="${i}"></canvas><span class="layer-name"><b>${l.clip?'<span class="clip-mark">↳ </span>':''}${esc(l.name)}</b><small>${pct(l.opacity)} · ${BLENDS.find(([v])=>v===l.blend)?.[1]||'Normal'}${l.alphaLock?' · α':''}${l.text?' · Text':''}</small></span><button class="ib" data-seye="${i}" aria-label="${l.visible?'Hide':'Show'} ${esc(l.name)}">${icon(l.visible?'eye':'eyeoff')}</button></div>`).join('')}</div><div class="layer-props"><select id="studioBlend" aria-label="Layer blend mode">${BLENDS.map(([v,n])=>`<option value="${v}" ${v===L.blend?'selected':''}>${n}</option>`).join('')}</select><label>Opacity <input type="range" id="studioOpacity" aria-label="Layer opacity" min="0" max="1" step=".01" value="${L.opacity}"><output id="studioOpacityOut">${pct(L.opacity)}</output></label><div class="layer-toggles"><button id="studioAlpha" class="${L.alphaLock?'on':''}" aria-pressed="${L.alphaLock}">α Lock transparency</button><button id="studioClip" class="${L.clip?'on':''}" aria-pressed="${L.clip}">↳ Clip to layer below</button></div></div>`;
 $$('[data-sth]',root).forEach(c=>{const k=Math.min(c.width/S.W,c.height/S.H);c.getContext('2d').drawImage(S.layers[+c.dataset.sth].canvas,(c.width-S.W*k)/2,(c.height-S.H*k)/2,S.W*k,S.H*k)});
 $$('[data-slact]',root).forEach(b=>b.onclick=()=>{if(FL)return toast('Finish the transform first');const k=b.dataset.slact;if(k==='up'||k==='down')moveLayer(k==='up'?1:-1);else layerAct(k);studioSchedule()});
 $$('[data-sl]',root).forEach(row=>{const select=()=>{if(FL)return toast('Finish the transform first');S.active=+row.dataset.sl;renderLayers();renderOpts();studioSchedule()};row.onclick=e=>{if(!e.target.closest('[data-seye]'))select()};row.onkeydown=e=>{if(e.target===row&&(e.key==='Enter'||e.key===' ')){e.preventDefault();select()}};row.ondblclick=()=>{select();openLayerMore()}});
 $$('[data-seye]',root).forEach(b=>b.onclick=()=>{if(FL)return toast('Finish the transform first');const l=S.layers[+b.dataset.seye],from=l.visible;l.visible=!from;propHist(l,'visible',from,l.visible);compositeAll();renderLayers()});
 $('#studioBlend').onchange=e=>studioProp('blend',e.target.value);
 let opacityBefore=L.opacity;const op=$('#studioOpacity');op.oninput=()=>{studioEditing=true;L.opacity=+op.value;studioSet('studioOpacityOut',pct(L.opacity));compositeAll()};op.onchange=()=>{propHist(L,'opacity',opacityBefore,L.opacity);opacityBefore=L.opacity;studioEditing=false;studioSig='';studioSchedule()};op.onblur=()=>{studioEditing=false;studioSchedule()};
 $('#studioAlpha').onclick=()=>studioProp('alphaLock',!L.alphaLock);$('#studioClip').onclick=()=>S.active?studioProp('clip',!L.clip):toast('The bottom layer has no layer below to clip to.');
 }else if(studioPanel==='brushes'){
 const current=brushFor(S.tool==='eraser'?'eraser':'brush');root.innerHTML=`<div class="inspector-actions"><button id="studioBrushSettings" aria-label="Brush settings" title="Brush settings">${icon('cog')}</button><button id="studioBrushImport" aria-label="Import ibisPaint brush" title="Import ibisPaint brush">${icon('qr')}</button></div>${S.brushes.map(b=>`<button class="studio-brush ${b.id===current.id?'on':''}" data-sbrush="${esc(b.id)}" aria-pressed="${b.id===current.id}"><canvas width="200" height="70"></canvas><span>${esc(b.name)}</span></button>`).join('')}`;
 $$('[data-sbrush]',root).forEach(b=>{const brush=S.brushes.find(x=>x.id===b.dataset.sbrush);drawBrushPreview(brush,$('canvas',b),true);b.onclick=()=>{const t=S.tool==='eraser'?'eraser':'brush';S.brushSel[t]=brush.id;savePrefs();setTool(t);studioSig='';studioSchedule()}});$('#studioBrushSettings').onclick=()=>openBrushSettings(current,true);$('#studioBrushImport').onclick=openIbis;
 }else if(studioPanel==='history'){
 const n=S.undo.length;root.innerHTML=`<div class="inspector-actions"><button id="historyUndo" aria-label="Undo" ${!n?'disabled':''}>${icon('undo')}</button><button id="historyRedo" aria-label="Redo" ${!S.redo.length?'disabled':''}>${icon('redo')}</button></div><button class="history-item ${n===0?'current':''}" data-history="0">${icon('open')}Session start</button>${S.undo.map((e,i)=>`<button class="history-item ${i===n-1?'current':''}" data-history="${i+1}">${icon('brush')}${esc(e.label)}</button>`).join('')}${S.redo.slice().reverse().map((e,i)=>`<button class="history-item future" data-history="${n+i+1}">${icon('redo')}${esc(e.label)}</button>`).join('')}<p class="note" style="padding:14px">History is kept for this editing session. Click an earlier step to undo to it.</p>`;
 $('#historyUndo').onclick=undo;$('#historyRedo').onclick=redo;$$('[data-history]',root).forEach(b=>b.onclick=()=>{if(FL||ST)return toast('Finish the current action first');const target=+b.dataset.history;while(S.undo.length>target)undo();while(S.undo.length<target&&S.redo.length)redo();studioSchedule()});
 }else{
 root.innerHTML=`<div class="nav-wrap"><canvas id="studioNav" width="540" height="460" aria-label="Canvas navigator"></canvas><p>Click the preview to center that part of your canvas. The purple frame shows your current view.</p><div class="nav-buttons"><button id="navFit">Fit canvas</button><button id="nav100">100%</button><button id="navLeft">−15°</button><button id="navRight">+15°</button><button id="navReset">Reset rotation</button></div></div>`;
 $('#navFit').onclick=fitView;$('#nav100').onclick=()=>studioZoom(1);$('#navLeft').onclick=()=>studioRotate(-15);$('#navRight').onclick=()=>studioRotate(15);$('#navReset').onclick=()=>studioRotate(-S.view.rot);
 $('#studioNav').onpointerdown=e=>{const c=e.currentTarget,r=c.getBoundingClientRect(),k=Math.min(c.width/S.W,c.height/S.H),x=((e.clientX-r.left)*c.width/r.width-(c.width-S.W*k)/2)/k,y=((e.clientY-r.top)*c.height/r.height-(c.height-S.H*k)/2)/k;studioCenter(clamp(x,0,S.W),clamp(y,0,S.H));};studioNavigator();
 }
}
function studioProp(key,value){if(FL)return toast('Finish the transform first');const L=activeL(),from=L[key];L[key]=value;propHist(L,key,from,value);compositeAll();renderLayers();studioSchedule()}
function studioCenter(x,y){const p=toScr(x,y);S.view.x+=VW/2-p.x;S.view.y+=VH/2-p.y;req()}
function studioZoom(scale){const p=toDoc(VW/2,VH/2);S.view.s=clamp(scale,.05,32);studioCenter(p.x,p.y)}
function studioRotate(delta){const p=toDoc(VW/2,VH/2);S.view.rot+=delta;studioCenter(p.x,p.y)}
function studioNavigator(){const c=$('#studioNav');if(!c)return;const x=c.getContext('2d'),k=Math.min(c.width/S.W,c.height/S.H),ox=(c.width-S.W*k)/2,oy=(c.height-S.H*k)/2;x.clearRect(0,0,c.width,c.height);x.fillStyle='#fff';x.fillRect(ox,oy,S.W*k,S.H*k);x.drawImage(comp,ox,oy,S.W*k,S.H*k);x.save();x.beginPath();x.rect(ox,oy,S.W*k,S.H*k);x.clip();x.beginPath();[[0,0],[VW,0],[VW,VH],[0,VH]].forEach(([sx,sy],i)=>{const p=toDoc(sx,sy);i?x.lineTo(ox+p.x*k,oy+p.y*k):x.moveTo(ox+p.x*k,oy+p.y*k)});x.closePath();x.strokeStyle='#a28bfa';x.lineWidth=3;x.stroke();x.restore()}
function studioColorSet(h){if(!setHex(h))return false;savePrefs();studioSchedule();return true}
$('#studioColor').oninput=e=>studioColorSet(e.target.value);$('#studioHex').onchange=e=>{if(!studioColorSet(e.target.value)){toast('Use a six-digit hex color, such as #a28bfa');e.target.value=curHex()}};
$('#studioPalette').innerHTML=['#17171f','#ffffff','#a28bfa','#ed9ab8','#e5b77c','#b9ce9b','#83bac8','#7a91cd'].map(h=>`<button style="background:${h}" data-scolor="${h}" aria-label="Set color ${h}"></button>`).join('');$$('[data-scolor]').forEach(b=>b.onclick=()=>studioColorSet(b.dataset.scolor));
function studioRename(){openSheet('rename','Rename artwork',`<label>Artwork title<input type="text" id="renameTitle" maxlength="60" value="${esc(S.docName)}"></label><button class="btn pri" id="renameDone">Save title</button>`);$('#renameDone').onclick=()=>{const name=$('#renameTitle').value.trim();if(!name)return;S.docName=name;markDirty();closeSheet();studioSchedule()};$('#renameTitle').focus()}
function studioExport(){openSheet('export','Export artwork',`<p class="note">${S.W} × ${S.H} px · ${S.layers.length} layers</p><button class="item" id="exportPNG">${icon('image')}<span class="nm">PNG image</span><span class="sub">With transparency</span></button><button class="item" id="exportJPG">${icon('image')}<span class="nm">JPEG image</span><span class="sub">White background</span></button><button class="item" id="exportProject">${icon('layers')}<span class="nm">Kanvas project</span><span class="sub">All editable layers</span></button><p class="note">Keep a project backup to reopen your layers later. Projects are saved as .json files.</p>`);$('#exportPNG').onclick=()=>exportImage('png');$('#exportJPG').onclick=()=>exportImage('jpg');$('#exportProject').onclick=()=>FL?toast('Finish the transform first'):saveProject()}
async function studioSave(){if(ST)endStroke();if(FL)await applyTransform();await saveDoc();studioSync();toast(dirty?'Save failed. Export a project backup.':'Saved on this device')}
const studioActions={brandHome:goGallery,homeAction:goGallery,newAction:openNew,heroNew:openNew,heroPhoto:()=>$('#fileNewPic').click(),openProjectAction:()=>$('#fileProj').click(),sideImport:()=>$('#fileProj').click(),sidePhoto:()=>$('#fileNewPic').click(),sideTrash:openTrash,sideBrushes:openIbis,sideSettings:openSettings,sideArt:()=>{$('#gallerySearch').value='';renderGallery()},railFilter:openAdjust,railCanvas:openCanvas,railColor:openColor,fullColor:openColor,railFull:()=>setFull(true),railSettings:openSettings,exportAction:studioExport,docTitle:studioRename,statusZoom:fitView,searchAction:()=>studioCommands()};
for(const[id,fn]of Object.entries(studioActions))$('#'+id).onclick=fn;
$$('[data-stool]').forEach(b=>b.onclick=()=>pickTool(b.dataset.stool));
function studioCommandItems(){return[
 ['New canvas','plus',openNew,'Ctrl+N'],['Open project','open',()=>$('#fileProj').click(),'Ctrl+O'],['Import image as new canvas','image',()=>$('#fileNewPic').click()],['Recently deleted','trash',openTrash],['Settings','cog',openSettings],['Import ibisPaint brush QR','qr',openIbis],
 ...inGallery?[]:[
 ['Save artwork on this device','save',studioSave,'Ctrl+S'],['Export artwork or project','save',studioExport,'Ctrl+Shift+S'],['Back to gallery','gallery',goGallery],['Rename artwork','edit',studioRename],['Undo','undo',undo,'Ctrl+Z'],['Redo','redo',redo,'Ctrl+Shift+Z'],
 ...KanvasFX.catalog.map(f=>['FX: '+f.name,'fx',()=>openFX(f.id)]),
 ...TOOLS.map(([k,n,i])=>[n,i,()=>pickTool(k),({brush:'B',eraser:'E',move:'V',lasso:'L',fill:'G',text:'T',picker:'I'})[k]]),
 ['New layer','plus',()=>layerAct('add')],['Duplicate layer','copy',()=>layerAct('dup')],['Layer options / rename layer','layers',openLayerMore],['Merge layer down','merge',()=>layerAct('merge')],['Select all','rect',selectAll,'Ctrl+A'],['Deselect','newsel',deselect,'Ctrl+D'],['Invert selection','invert',invertSel],['Fit canvas','resize',fitView,'Ctrl+0'],['Actual size (100%)','resize',()=>studioZoom(1),'Ctrl+1'],['Focus mode','resize',()=>setFull(!document.body.classList.contains('full')),'Tab'],['Color mixer','hsbi',openColor],['Brush library','brush',openBrushes],['Show layers','layers',()=>studioDesktop()?studioChoosePanel('layers'):openLayers()],...(studioDesktop()?[['History','undo',()=>studioChoosePanel('history')],['Navigator','move',()=>studioChoosePanel('navigator')]]:[]),['Flip canvas horizontally','fliph',CANVAS_OPS.fliph],['Rotate canvas right','rotr',CANVAS_OPS.rotr],['Canvas size','canvas',openCanvasSize],['Resize image','resize',openResize]
 ]]}
let studioCommandsList=[];
function studioCommands(q=''){closePop();studioPrevFocus=document.activeElement;$('#commands').hidden=false;$('#commandSearch').value=q;studioFilterCommands();$('#commandSearch').focus()}
function studioCloseCommands(){if($('#commands').hidden)return;$('#commands').hidden=true;studioPrevFocus?.focus()}
function studioFilterCommands(){const q=$('#commandSearch').value.trim().toLowerCase();studioCommandsList=studioCommandItems().filter(([n])=>n.toLowerCase().includes(q));$('#commandList').innerHTML=studioCommandsList.map(([n,i,fn,key],j)=>`<button data-command="${j}">${icon(i)}<span>${n}</span>${key?`<kbd>${key}</kbd>`:''}</button>`).join('')||'<p class="note" style="padding:18px">No matching commands.</p>';$$('[data-command]').forEach(b=>b.onclick=()=>{const fn=studioCommandsList[+b.dataset.command][2];studioCloseCommands();fn()})}
$('#commandSearch').oninput=studioFilterCommands;$('#commands').onclick=e=>{if(e.target===$('#commands'))studioCloseCommands()};
$('#commands').addEventListener('keydown',e=>{const buttons=$$('[data-command]'),idx=buttons.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();studioCloseCommands()}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();buttons[(idx+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus()}else if(e.key==='Enter'&&document.activeElement===$('#commandSearch')){e.preventDefault();buttons[0]?.click()}else if(e.key==='Tab'){e.preventDefault();const items=[$('#commandSearch'),...buttons],i=items.indexOf(document.activeElement);items[(i+(e.shiftKey?-1:1)+items.length)%items.length]?.focus()}});
$$('[data-menu]').forEach(b=>b.onclick=()=>{const group=b.dataset.menu,items=studioCommandItems(),matches={File:/canvas$|project|Export|Save artwork|Back to gallery|Rename artwork|Import image/,Edit:/^Undo$|^Redo$|Settings|^Focus/,Image:/Flip canvas|Rotate canvas|Canvas size|Resize image|^Filter$/,Layer:/layer/i,Select:/selection|Select all|Deselect|Lasso|Wand/,View:/Fit canvas|Actual size|Navigator|Focus|History|Color mixer|Brush library|Show layers/,Help:/Settings/};const list=items.filter(([n])=>matches[group].test(n));openPop('studioMenu',`<div class="plist menu">${list.map(([n,i],j)=>`<button class="mi" data-menu-command="${j}">${icon(i)}${n}</button>`).join('')}</div>`,b,'down');$$('[data-menu-command]').forEach(el=>el.onclick=()=>{closePop();list[+el.dataset.menuCommand][2]()})});
// Mouse/keyboard navigation supplements the existing touch pinch/twist gestures.
let studioSpace=false,studioPan=null;
window.addEventListener('keydown',e=>{
 if(window.KanvasFXUI?.session){if(!e.target.closest?.('#sheet')||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k')){if(e.key==='Escape')closeSheet();e.preventDefault();e.stopImmediatePropagation()}else e.stopPropagation();return}
 if(!$('#commands').hidden)return;
 const input=e.target.closest?.('input,textarea,select,[contenteditable]'),mod=e.ctrlKey||e.metaKey,k=e.key.toLowerCase();
 if(mod&&k==='k'){e.preventDefault();studioCommands();return}if(input)return;
 if(mod&&['s','o','n'].includes(k)){e.preventDefault();if(k==='s'){if(!inGallery)e.shiftKey?studioExport():studioSave()}else if(k==='o')$('#fileProj').click();else openNew();return}
 if(inGallery)return;
 if(mod&&k==='a'){e.preventDefault();selectAll()}else if(mod&&k==='d'){e.preventDefault();deselect()}else if(mod&&k==='0'){e.preventDefault();fitView()}else if(mod&&k==='1'){e.preventDefault();studioZoom(1)}else if(mod&&k==='y'){e.preventDefault();redo()}else if(e.key===' '){e.preventDefault();studioSpace=true;view.style.cursor='grab'}else if(e.key==='Tab'){e.preventDefault();setFull(!document.body.classList.contains('full'))}else if(k==='['||k===']'){e.preventDefault();if(painting(S.tool)){const b=brushFor(S.tool);b.size=nudgeSize(b.size,k==='['?-1:1);saveBrushes();renderOpts()}}
},true);
window.addEventListener('keyup',e=>{if(e.key===' '){studioSpace=false;if(!studioPan)view.style.cursor=''}});
window.addEventListener('blur',()=>{studioSpace=false;studioPan=null;view.style.cursor=''});
view.addEventListener('pointerdown',e=>{if((studioSpace||e.button===1)&&!ST){e.preventDefault();e.stopImmediatePropagation();studioPan={id:e.pointerId,x:e.clientX,y:e.clientY,vx:S.view.x,vy:S.view.y};view.setPointerCapture(e.pointerId);view.style.cursor='grabbing'}},true);
view.addEventListener('pointermove',e=>{if(!studioPan||e.pointerId!==studioPan.id)return;e.preventDefault();e.stopImmediatePropagation();S.view.x=studioPan.vx+e.clientX-studioPan.x;S.view.y=studioPan.vy+e.clientY-studioPan.y;req()},true);
for(const event of ['pointerup','pointercancel'])view.addEventListener(event,e=>{if(!studioPan||e.pointerId!==studioPan.id)return;e.preventDefault();e.stopImmediatePropagation();studioPan=null;view.style.cursor=studioSpace?'grab':''},true);
const studioBack=window.kanvasBack;window.kanvasBack=()=>{if(!$('#commands').hidden){studioCloseCommands();return true}return studioBack()};
matchMedia('(min-width:1050px)').addEventListener('change',()=>{studioSig='';studioSchedule()});
setInterval(()=>{if(!document.hidden)studioSchedule()},1000);
studioSchedule();
// A true-size cursor gives mouse and pen users a visible brush footprint.
$('#stage').insertAdjacentHTML('beforeend','<div id="brushCursor" hidden></div>');
view.addEventListener('pointermove',e=>{const c=$('#brushCursor');if(e.pointerType==='touch'||!painting(S.tool)||studioPan||studioSpace){c.hidden=true;return}const r=view.getBoundingClientRect(),size=Math.max(3,brushFor(S.tool).size*S.view.s);c.hidden=false;c.style.left=(e.clientX-r.left)+'px';c.style.top=(e.clientY-r.top)+'px';c.style.width=c.style.height=size+'px'});
view.addEventListener('pointerleave',()=>{$('#brushCursor').hidden=true});
// Serialize document transitions so double-clicks and import decoding cannot replace each other.
let studioTransitioning=false;
function studioTransition(fn){return async function(...args){if(studioTransitioning)return;if(ST)endStroke();studioTransitioning=true;document.body.classList.add('doc-loading');try{return await fn(...args)}finally{studioTransitioning=false;document.body.classList.remove('doc-loading');studioSchedule()}}}
openArt=studioTransition(openArt);createArt=studioTransition(createArt);
window.addEventListener('keydown',e=>{if(studioTransitioning){e.preventDefault();e.stopImmediatePropagation()}},true);
