/* Kanvas' independent, deterministic raster FX engine. Runs in a Worker or Node. */
(function(root){
'use strict';
const cap=(v,a=0,b=255)=>Math.max(a,Math.min(b,v));
const image=(w,h,d)=>({width:w,height:h,data:d||new Uint8ClampedArray(w*h*4)});
const copy=s=>image(s.width,s.height,new Uint8ClampedArray(s.data));
const lum=(r,g,b)=>r*.2126+g*.7152+b*.0722;
const color=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
const hash=(x,y,seed=1)=>{let n=Math.imul(x+seed*1013,374761393)^Math.imul(y+seed*721,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};
function pixelMap(s,fn){const o=copy(s),d=o.data;for(let i=0;i<d.length;i+=4)fn(d,i,i/4%s.width,Math.floor(i/4/s.width));return o}
function sample(s,x,y,out){
 const W=s.width,H=s.height,d=s.data;if(x<0||y<0||x>W-1||y>H-1){out[0]=out[1]=out[2]=out[3]=0;return out}
 const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(x0+1,W-1),y1=Math.min(y0+1,H-1),fx=x-x0,fy=y-y0;
 let a=0,r=0,g=0,b=0;
 for(let k=0;k<4;k++){const xx=k&1?x1:x0,yy=k&2?y1:y0,w=(k&1?fx:1-fx)*(k&2?fy:1-fy),i=(yy*W+xx)*4,wa=w*d[i+3];a+=wa;r+=d[i]*wa;g+=d[i+1]*wa;b+=d[i+2]*wa}
 out[0]=a?r/a:0;out[1]=a?g/a:0;out[2]=a?b/a:0;out[3]=a;return out;
}
function warp(s,fn){const o=image(s.width,s.height),p=[0,0],rgba=[0,0,0,0];for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){fn(x,y,p);sample(s,p[0],p[1],rgba);o.data.set(rgba,(y*s.width+x)*4)}return o}
function blur(s,r){
 r=Math.round(r);if(r<1)return copy(s);const W=s.width,H=s.height;
 let a=new Uint8ClampedArray(s.data.length),b=new Uint8ClampedArray(a.length);
 for(let i=0;i<a.length;i+=4){const t=s.data[i+3]/255;a[i]=s.data[i]*t;a[i+1]=s.data[i+1]*t;a[i+2]=s.data[i+2]*t;a[i+3]=s.data[i+3]}
 const rad=Math.max(1,Math.round(r*.58)),span=rad*2+1;
 function pass(horizontal){const lines=horizontal?H:W,len=horizontal?W:H,stride=horizontal?4:W*4;
  for(let l=0;l<lines;l++){const base=horizontal?l*W*4:l*4;for(let c=0;c<4;c++){let sum=0;for(let j=-rad;j<=rad;j++)sum+=a[base+cap(j,0,len-1)*stride+c];for(let j=0;j<len;j++){b[base+j*stride+c]=sum/span;sum+=a[base+cap(j+rad+1,0,len-1)*stride+c]-a[base+cap(j-rad,0,len-1)*stride+c]}}}
  const t=a;a=b;b=t;
 }
 for(let k=0;k<3;k++){pass(true);pass(false)}
 for(let i=0;i<a.length;i+=4){const t=a[i+3]/255;if(t){a[i]/=t;a[i+1]/=t;a[i+2]/=t}else a[i]=a[i+1]=a[i+2]=0}return image(W,H,a);
}
function hsl(r,g,b){r/=255;g/=255;b/=255;const hi=Math.max(r,g,b),lo=Math.min(r,g,b),v=hi-lo,l=(hi+lo)/2;let h=0,s=0;if(v){s=v/(1-Math.abs(2*l-1));h=hi===r?((g-b)/v)%6:hi===g?(b-r)/v+2:(r-g)/v+4;h=(h*60+360)%360}return [h,s,l]}
function fromHsl(h,s,l){const a=s*Math.min(l,1-l),f=n=>{const k=(n+h/30)%12;return (l-a*Math.max(-1,Math.min(k-3,9-k,1)))*255};return [f(0),f(8),f(4)]}
function edges(s){const o=copy(s),d=s.data,W=s.width,H=s.height,at=(x,y)=>{const i=(cap(y,0,H-1)*W+cap(x,0,W-1))*4;return lum(d[i],d[i+1],d[i+2])};for(let y=0;y<H;y++)for(let x=0;x<W;x++){const gx=-at(x-1,y-1)+at(x+1,y-1)-2*at(x-1,y)+2*at(x+1,y)-at(x-1,y+1)+at(x+1,y+1),gy=-at(x-1,y-1)-2*at(x,y-1)-at(x+1,y-1)+at(x-1,y+1)+2*at(x,y+1)+at(x+1,y+1),v=cap(Math.hypot(gx,gy));const i=(y*W+x)*4;o.data[i]=o.data[i+1]=o.data[i+2]=v}return o}
function sampleBlur(s,kind,amount,angle,cx,cy){const o=image(s.width,s.height),p=[0,0,0,0],dx=Math.cos(angle),dy=Math.sin(angle),N=12;
 for(let y=0;y<s.height;y++)for(let x=0;x<s.width;x++){let a=0,r=0,g=0,b=0;for(let j=0;j<N;j++){const t=j/(N-1)-.5;let xx=x,yy=y;
  if(kind==='motion'){xx+=dx*t*amount;yy+=dy*t*amount}else if(kind==='zoom'){xx=cx+(x-cx)*(1+t*amount);yy=cy+(y-cy)*(1+t*amount)}else if(kind==='spin'){const q=t*amount,c=Math.cos(q),sn=Math.sin(q);xx=cx+(x-cx)*c-(y-cy)*sn;yy=cy+(x-cx)*sn+(y-cy)*c}else{const q=j*2.399963,rr=Math.sqrt((j+.5)/N)*amount;xx+=Math.cos(q)*rr;yy+=Math.sin(q)*rr}
  sample(s,cap(xx,0,s.width-1),cap(yy,0,s.height-1),p);const pa=p[3];a+=pa;r+=p[0]*pa;g+=p[1]*pa;b+=p[2]*pa;
 }const i=(y*s.width+x)*4;o.data[i]=a?r/a:0;o.data[i+1]=a?g/a:0;o.data[i+2]=a?b/a:0;o.data[i+3]=a/N}return o;
}
function morphAlpha(s,r,dilate){const W=s.width,H=s.height;let a=new Uint8ClampedArray(W*H),b=new Uint8ClampedArray(a.length);for(let j=0;j<a.length;j++)a[j]=s.data[j*4+3];r=Math.max(1,Math.round(r));
 for(const horizontal of [true,false]){const lines=horizontal?H:W,len=horizontal?W:H;for(let l=0;l<lines;l++){let head=0,tail=0;const queue=new Int32Array(len+2*r+1),values=new Uint8ClampedArray(queue.length);const at=i=>i<0||i>=len?0:a[horizontal?l*W+i:i*W+l];for(let j=-r;j<len+r;j++){const v=at(j);while(tail>head&&(dilate?values[tail-1]<=v:values[tail-1]>=v))tail--;queue[tail]=j;values[tail++]=v;while(tail>head&&queue[head]<j-2*r)head++;const out=j-r;if(out>=0&&out<len)b[horizontal?l*W+out:out*W+l]=values[head]}}const t=a;a=b;b=t}return a;
}
function over(r,g,b,a,br,bg,bb,ba){const A=a+ba*(1-a);return [A?(r*a+br*ba*(1-a))/A:0,A?(g*a+bg*ba*(1-a))/A:0,A?(b*a+bb*ba*(1-a))/A:0,A*255]}
function layerStyle(s,id,p,scale){const o=copy(s),W=s.width,H=s.height,d=s.data,c=color(p.color||'#15161a'),rad=Math.max(1,p.radius*scale),angle=p.angle*Math.PI/180,dist=(p.distance||p.radius)*scale;let field,morphCache;
 if(['stroke-outer','stroke-both','bevel-outer','extrude'].includes(id))field=morphAlpha(s,rad,true);
 else if(['stroke-inner','bevel-inner','wet-edge'].includes(id))field=morphAlpha(s,rad,false);
 else field=blur(s,rad).data;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,a=d[i+3]/255;let r=d[i],g=d[i+1],b=d[i+2],A=a;
  if(id.startsWith('stroke')){const outer=id!=='stroke-inner'?field[y*W+x]/255:0;let inner=0;if(id==='stroke-inner')inner=1-field[y*W+x]/255;else if(id==='stroke-both')inner=1-(morphCache||(morphCache=morphAlpha(s,rad,false)))[y*W+x]/255;
   if(outer){const q=over(r,g,b,a,...c,outer);r=q[0];g=q[1];b=q[2];A=q[3]/255}if(inner){const t=cap(inner,0,1);r=r*(1-t)+c[0]*t;g=g*(1-t)+c[1]*t;b=b*(1-t)+c[2]*t}
  }else if(id==='wet-edge'){const edge=cap((d[i+3]-field[y*W+x])/255,0,1)*.8;r*=1-edge;g*=1-edge;b*=1-edge}
  else if(id.startsWith('bevel')){const at=(xx,yy)=>d[(cap(yy,0,H-1)*W+cap(xx,0,W-1))*4+3]/255;const dx=at(x-Math.round(rad),y)-at(x+Math.round(rad),y),dy=at(x,y-Math.round(rad))-at(x,y+Math.round(rad));const v=(dx*Math.cos(angle)+dy*Math.sin(angle))*150;
   if(id==='bevel-outer'){const q=over(r,g,b,a,...c,field[y*W+x]/255);r=q[0]+v;g=q[1]+v;b=q[2]+v;A=q[3]/255}else{r+=v;g+=v;b+=v}
  }else if(id==='extrude'){let ba=0;for(let n=1;n<=16;n++){const xx=Math.round(x-Math.cos(angle)*dist*n/16),yy=Math.round(y-Math.sin(angle)*dist*n/16);if(xx>=0&&yy>=0&&xx<W&&yy<H)ba=Math.max(ba,d[(yy*W+xx)*4+3]/255)}const q=over(r,g,b,a,...c,ba);r=q[0];g=q[1];b=q[2];A=q[3]/255}
  else{let ba=field[i+3]/255;
   if(id==='drop-shadow'){const xx=Math.round(x-Math.cos(angle)*dist),yy=Math.round(y-Math.sin(angle)*dist);ba=xx<0||yy<0||xx>=W||yy>=H?0:field[(yy*W+xx)*4+3]/255}
   if(id==='glow-inner'||id==='satin'){const t=id==='satin'?(Math.sin((x*Math.cos(angle)+y*Math.sin(angle))/rad)*.5+.5)*.6:(1-ba)*.9;r=r*(1-t)+c[0]*t;g=g*(1-t)+c[1]*t;b=b*(1-t)+c[2]*t}
   else{const q=over(r,g,b,a,...c,ba*(id==='drop-shadow'?.75:1));r=q[0];g=q[1];b=q[2];A=q[3]/255}
  }o.data[i]=r;o.data[i+1]=g;o.data[i+2]=b;o.data[i+3]=A*255;
 }return o;
}
function mosaic(s,kind,size,seed){const W=s.width,H=s.height,d=s.data,o=copy(s),step=Math.max(2,size),at=(x,y)=>((cap(Math.round(y),0,H-1)*W+cap(Math.round(x),0,W-1))*4);
 if(kind==='square'){for(let by=0;by<H;by+=step)for(let bx=0;bx<W;bx+=step){let r=0,g=0,b=0,a=0,n=0;for(let y=by;y<Math.min(by+step,H);y++)for(let x=bx;x<Math.min(bx+step,W);x++){const i=(y*W+x)*4,t=d[i+3];a+=t;r+=d[i]*t;g+=d[i+1]*t;b+=d[i+2]*t;n++}const c=[a?r/a:0,a?g/a:0,a?b/a:0,a/n];for(let y=by;y<Math.min(by+step,H);y++)for(let x=bx;x<Math.min(bx+step,W);x++)o.data.set(c,(y*W+x)*4)}return o}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){let sx,sy,dist=0,gap=1;
  if(kind==='crystal'||kind==='stained'){const gx=Math.floor(x/step),gy=Math.floor(y/step);let near=Infinity,second=Infinity;for(let v=-1;v<=1;v++)for(let u=-1;u<=1;u++){const cx=(gx+u+hash(gx+u,gy+v,seed))*step,cy=(gy+v+hash(gx+u,gy+v,seed+5))*step,dd=(x-cx)**2+(y-cy)**2;if(dd<near){second=near;near=dd;sx=cx;sy=cy}else if(dd<second)second=dd}gap=(Math.sqrt(second)-Math.sqrt(near))/step}
  else if(kind==='hex'||kind==='dots-hex'){const row=Math.round(y/(step*.866));let best=Infinity;for(let v=row-1;v<=row+1;v++){const col=Math.round(x/step-(v&1)*.5);for(let u=col-1;u<=col+1;u++){const cx=(u+(v&1)*.5)*step,cy=v*step,dd=(x-cx)**2+(y-cy)**2;if(dd<best){best=dd;sx=cx;sy=cy;dist=Math.sqrt(dd)}}}}
  else if(kind==='triangle'){const bx=Math.floor(x/step)*step,by=Math.floor(y/step)*step;const side=(x-bx)+(y-by)<step?1/3:2/3;sx=bx+step*side;sy=by+step*side}
  else{sx=(Math.floor(x/step)+.5)*step;sy=(Math.floor(y/step)+.5)*step;dist=Math.hypot(x-sx,y-sy)}
  const j=at(sx,sy),i=(y*W+x)*4;let a=d[j+3],r=d[j],g=d[j+1],b=d[j+2];
  if(kind==='stained'&&gap<.05)r=g=b=25;
  if(kind==='pointillize'||kind.startsWith('dots')){const radius=kind==='pointillize'?step*.44:step*.47*Math.sqrt(1-lum(r,g,b)/255);if(dist>radius){r=g=b=255}else if(kind!=='pointillize')r=g=b=0;a=d[i+3]}
  o.data.set([r,g,b,a],i);
 }return o;
}
const P=(key,label,min,max,value,step=1)=>({key,label,min,max,value,step});
const C=(key,label,value)=>({key,label,value,type:'color'});
const radius=P('radius','Radius',1,80,8),angle=P('angle','Angle',-180,180,0),size=P('size','Cell size',2,100,14),fg=C('color','Color','#a28bfa'),bg=C('background','Second color','#15161a'),seed=P('seed','Seed',1,999,17),center=[P('cx','Center X',0,100,50),P('cy','Center Y',0,100,50)];
const groups=[['color','Color adjustment'],['blur','Blur'],['style','Style'],['draw','Draw'],['art','Art'],['pixel','Pixelate'],['transform','Transform'],['frame','Frame']];
const catalog=[];
function add(id,name,group,params,description){catalog.push({id,name,group,params,description})}
add('brightness','Brightness & contrast','color',[P('brightness','Brightness',-100,100,12),P('contrast','Contrast',-100,100,15)],'Adjust light and tonal contrast.');
add('hsl','Hue, saturation & lightness','color',[P('hue','Hue',-180,180,25),P('saturation','Saturation',-100,100,15),P('lightness','Lightness',-100,100,0)],'Shift color while retaining shading.');
add('balance','Color balance','color',[P('red','Red',-100,100,10),P('green','Green',-100,100,0),P('blue','Blue',-100,100,-10)],'Balance red, green and blue channels.');
add('curves','Tone curve','color',[P('shadows','Shadows',0,255,48),P('midtones','Midtones',0,255,128),P('highlights','Highlights',0,255,210)],'Shape a master curve with three tonal control points.');
add('levels','Levels','color',[P('black','Black point',0,254,10),P('white','White point',1,255,245),P('gamma','Gamma',.1,3,1,.05)],'Set input black, white and midtone gamma.');
add('grayscale','Grayscale','color',[],'Convert color to luminance.');
add('threshold','Black & white','color',[P('threshold','Threshold',0,255,128)],'Convert tones to solid black or white.');
add('invert','Invert color','color',[],'Reverse RGB colors without changing transparency.');
add('posterize','Posterize','color',[P('levels','Levels',2,32,5)],'Reduce the number of tones in each channel.');
add('gradient-map','Gradient map','color',[bg,fg],'Map dark and light values to two colors.');
add('recolor','Change drawing color','color',[fg],'Replace nontransparent pixels with one color.');
add('mono','Mono color','color',[fg],'Tint luminance with a single color.');
add('replace','Replace color','color',[C('target','Replace','#ffffff'),fg,P('tolerance','Tolerance',0,255,50)],'Replace pixels near the chosen color.');
add('extract','Extract line drawing','color',[P('threshold','White point',1,255,230)],'Turn light pixels transparent and keep dark strokes.');
add('edges','Find edges','color',[],'Detect luminance edges with a Sobel operator.');
add('sepia','Sepia','color',[],'Apply a warm photographic tone.');
add('gaussian','Gaussian blur','blur',[radius],'Smooth with three separable box passes approximating a Gaussian kernel.');
add('motion','Moving blur','blur',[P('radius','Distance',1,150,25),angle],'Blur in one direction.');
add('zoom','Zooming blur','blur',[P('amount','Amount',1,100,20),...center],'Blur outward from an adjustable center.');
add('spin','Spin blur','blur',[P('amount','Angle',1,90,12),...center],'Average rotated samples around a center.');
add('lens','Lens blur','blur',[radius],'Average disk-distributed samples for a soft lens effect.');
add('unsharp','Unsharp mask','blur',[radius,P('amount','Sharpen',0,300,100)],'Boost detail using a blurred reference.');
add('frost','Frosted glass','blur',[radius,seed],'Scatter nearby source pixels with a repeatable pattern.');
for(const [id,name] of [['stroke-outer','Stroke (outer)'],['stroke-inner','Stroke (inner)'],['stroke-both','Stroke (both)'],['glow-outer','Glow (outer)'],['glow-inner','Glow (inner)'],['bevel-inner','Bevel (inner)'],['bevel-outer','Bevel (outer)'],['wet-edge','Wet edge'],['satin','Satin'],['extrude','Extrude'],['drop-shadow','Drop shadow']])add(id,name,'style',[radius,...(['extrude','drop-shadow'].includes(id)?[P('distance','Distance',1,150,15)]:[]),...(['bevel-inner','bevel-outer','satin','extrude','drop-shadow'].includes(id)?[angle]:[]),...(['wet-edge'].includes(id)?[]:[C('color','Color',id==='drop-shadow'||id.startsWith('stroke')?'#15161a':'#a28bfa')])],'Style the active layer using its transparency.');
add('emboss','Emboss','style',[P('amount','Depth',1,10,2),angle],'Create a raised surface from directional luminance differences.');
add('relief','Relief','style',[P('amount','Depth',1,10,3),angle],'Add directional relief to the original color.');
add('stained','Stained glass','style',[size,seed],'Create irregular glass cells with dark seams.');
add('linear-gradient','Parallel gradation','draw',[fg,bg,angle],'Generate a two-color linear gradient.');
add('radial-gradient','Concentric gradation','draw',[fg,bg,...center],'Generate a radial gradient.');
add('angular-gradient','Radial line gradation','draw',[fg,bg,...center],'Generate an angular gradient.');
add('radial-lines','Radial lines','draw',[fg,P('count','Lines',8,180,60),P('width','Line width',1,20,2),...center],'Generate a burst of rays on transparency.');
add('speed-lines','Speed lines','draw',[fg,P('spacing','Spacing',3,80,14),P('width','Line width',1,20,2),angle,seed],'Generate directional motion lines on transparency.');
add('clouds','Clouds','draw',[fg,bg,P('size','Cloud scale',8,300,90),seed],'Generate smooth layered procedural noise.');
add('aberration','Chromatic aberration','art',[P('radius','Channel shift',1,60,8),angle],'Separate red and blue channels in opposite directions.');
add('glitch','Glitch','art',[P('radius','Displacement',1,100,20),P('size','Band height',2,80,12),seed],'Displace image bands and shift color channels.');
add('noise','Noise','art',[P('amount','Noise',0,100,25),seed],'Add repeatable monochrome film grain.');
add('retro','Retro game','art',[P('size','Pixel size',2,60,6),P('levels','Color levels',2,12,4)],'Combine pixelation and a reduced color palette.');
add('anime','Anime-style background','art',[P('levels','Tones',2,16,5),P('amount','Edge strength',0,100,35)],'Combine simplified colors and visible outlines.');
add('manga','Manga-style background','art',[P('size','Dot spacing',2,40,6),P('amount','Edge strength',0,100,60)],'Combine monochrome halftones and outlines.');
add('chrome','Chrome','art',[P('amount','Bands',1,12,4)],'Create metallic tonal bands from luminance.');
add('bloom','Bloom','art',[radius,P('threshold','Highlight threshold',0,255,170)],'Diffuse bright pixels and screen them over the source.');
add('cross','Cross filter','art',[P('radius','Ray length',1,100,20),P('threshold','Highlight threshold',0,255,190),angle],'Spread highlights into crossing rays.');
add('sheer','Sheer','art',[C('color','Veil color','#f5c6dc'),P('amount','Veil',0,100,25)],'Add a soft colored veil to visible pixels.');
for(const [id,name]of [['square','Square pixelate'],['hex','Hexagonal pixelate'],['triangle','Triangular pixelate'],['crystal','Crystallize'],['pointillize','Pointillize'],['dots-square','Dots (square)'],['dots-hex','Dots (hexagonal)']])add(id,name,'pixel',[size,...(id==='crystal'?[seed]:[])],'Rebuild the picture with a geometric cell pattern.');
for(const[id,name,params]of [
 ['expansion','Expansion',[P('amount','Scale',10,300,120)]],['fisheye','Fisheye lens',[P('amount','Distortion',-100,100,45)]],['sphere','Sphere lens',[P('amount','Strength',0,100,60)]],['wave','Wave',[P('radius','Amplitude',1,100,12),P('size','Wavelength',8,300,80),angle]],['ripple','Ripple',[P('radius','Amplitude',1,80,8),P('size','Wavelength',8,200,40)]],['twirl','Twirl',[P('amount','Rotation',-360,360,90)]],['polar','Polar coordinates',[P('angle','Rotation',-180,180,0)]]])add(id,name,'transform',[...params,...center],'Remap pixels around an adjustable center using alpha-aware bilinear sampling.');
add('table','Table','frame',[fg,P('rows','Rows',1,20,3),P('columns','Columns',1,20,3),P('width','Line width',1,50,3)],'Draw a grid on transparency.');
add('vignette','Blur frame','frame',[C('color','Frame color','#15161a'),P('amount','Strength',0,100,65),P('width','Falloff',1,100,40)],'Darken or tint edges with a soft frame.');
add('border','Solid frame','frame',[fg,P('width','Width',1,150,20)],'Draw a solid border around the image.');
function defaults(id){const f=catalog.find(f=>f.id===id);if(!f)throw Error('Unknown filter');return Object.fromEntries(f.params.map(p=>[p.key,p.value]))}
function run(id,s,params={},scale=1){
 const f=catalog.find(f=>f.id===id);if(!f)throw Error('Unknown filter: '+id);
 const p={...defaults(id),...params};for(const spec of f.params){if(spec.type==='color'){if(!/^#[0-9a-f]{6}$/i.test(p[spec.key]))throw Error('Invalid filter color')}else{if(!Number.isFinite(p[spec.key]))throw Error('Invalid filter value');p[spec.key]=cap(p[spec.key],spec.min,spec.max)}}
 const W=s.width,H=s.height,cx=p.cx/100*(W-1),cy=p.cy/100*(H-1),rad=(p.radius||0)*scale,ang=(p.angle||0)*Math.PI/180;
 if(['brightness','hsl','balance','curves','levels','grayscale','threshold','invert','posterize','gradient-map','recolor','mono','replace','extract','sepia','chrome','noise','sheer'].includes(id)){
 const c=p.color?color(p.color):null,bg=p.background?color(p.background):null,target=p.target?color(p.target):null;
 return pixelMap(s,(d,i,x,y)=>{let r=d[i],g=d[i+1],b=d[i+2],a=d[i+3],l=lum(r,g,b);
  if(id==='brightness'){const q=(100+p.contrast)/100,offset=p.brightness*2.55;r=(r-127.5)*q+127.5+offset;g=(g-127.5)*q+127.5+offset;b=(b-127.5)*q+127.5+offset}
  else if(id==='hsl'){const h=hsl(r,g,b);h[0]=(h[0]+p.hue+360)%360;h[1]=cap(h[1]*(1+p.saturation/100),0,1);h[2]=cap(h[2]+p.lightness/100,0,1);[r,g,b]=fromHsl(...h)}
  else if(id==='balance'){r+=p.red*2.55;g+=p.green*2.55;b+=p.blue*2.55}
  else if(id==='curves'){const ys=[0,p.shadows,p.midtones,p.highlights,255],xs=[0,64,128,192,255],curve=v=>{const j=Math.min(3,Math.floor(v/64)),t=(v-xs[j])/(xs[j+1]-xs[j]);return ys[j]+(ys[j+1]-ys[j])*t};r=curve(r);g=curve(g);b=curve(b)}
  else if(id==='levels'){const span=Math.max(1,p.white-p.black),fn=v=>255*Math.pow(cap((v-p.black)/span,0,1),1/p.gamma);r=fn(r);g=fn(g);b=fn(b)}
  else if(id==='grayscale')r=g=b=l;
  else if(id==='threshold')r=g=b=l>=p.threshold?255:0;
  else if(id==='invert'){r=255-r;g=255-g;b=255-b}
  else if(id==='posterize'){const n=p.levels-1,fn=v=>Math.round(v/255*n)*255/n;r=fn(r);g=fn(g);b=fn(b)}
  else if(id==='gradient-map'){r=bg[0]+(c[0]-bg[0])*l/255;g=bg[1]+(c[1]-bg[1])*l/255;b=bg[2]+(c[2]-bg[2])*l/255}
  else if(id==='recolor')[r,g,b]=c;
  else if(id==='mono'){r=c[0]*l/255;g=c[1]*l/255;b=c[2]*l/255}
  else if(id==='replace'){const distance=Math.hypot(r-target[0],g-target[1],b-target[2])/Math.sqrt(3);if(distance<=p.tolerance)[r,g,b]=c}
  else if(id==='extract'){a*=1-cap(l/p.threshold,0,1);r=g=b=0}
  else if(id==='sepia'){r=d[i]*.393+d[i+1]*.769+d[i+2]*.189;g=d[i]*.349+d[i+1]*.686+d[i+2]*.168;b=d[i]*.272+d[i+1]*.534+d[i+2]*.131}
  else if(id==='chrome')r=g=b=(Math.sin(l/255*Math.PI*p.amount*2)*.5+.5)*255;
  else if(id==='noise'){const n=(hash(x,y,p.seed)-.5)*p.amount*5.1;r+=n;g+=n;b+=n}
  else if(id==='sheer'){const t=p.amount/100;r=r*(1-t)+c[0]*t;g=g*(1-t)+c[1]*t;b=b*(1-t)+c[2]*t}
  d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=a;
 });}
 if(id==='edges')return edges(s);
 if(id==='gaussian')return blur(s,rad);
 if(['motion','zoom','spin','lens'].includes(id))return sampleBlur(s,id,id==='zoom'?p.amount/100:id==='spin'?p.amount*Math.PI/180:rad,ang,cx,cy);
 if(id==='unsharp'){const q=blur(s,rad);return pixelMap(s,(d,i)=>{for(let c=0;c<3;c++)d[i+c]+=(d[i+c]-q.data[i+c])*p.amount/100})}
 if(id==='frost')return warp(s,(x,y,out)=>{out[0]=cap(x+(hash(x,y,p.seed)-.5)*rad*2,0,W-1);out[1]=cap(y+(hash(x,y,p.seed+1)-.5)*rad*2,0,H-1)});
 if(['stroke-outer','stroke-inner','stroke-both','glow-outer','glow-inner','bevel-inner','bevel-outer','wet-edge','satin','extrude','drop-shadow'].includes(id))return layerStyle(s,id,{angle:0,...p},scale);
 if(id==='emboss'||id==='relief'){const d=s.data,step=Math.max(1,Math.round(p.amount*scale)),dx=Math.round(Math.cos(ang)*step),dy=Math.round(Math.sin(ang)*step);return pixelMap(s,(out,i,x,y)=>{const a=(cap(y-dy,0,H-1)*W+cap(x-dx,0,W-1))*4,b=(cap(y+dy,0,H-1)*W+cap(x+dx,0,W-1))*4,v=lum(d[a],d[a+1],d[a+2])-lum(d[b],d[b+1],d[b+2]);for(let k=0;k<3;k++)out[i+k]=(id==='emboss'?128:d[i+k])+v})}
 if(['square','hex','triangle','crystal','pointillize','dots-square','dots-hex','stained'].includes(id))return mosaic(s,id,Math.max(2,Math.round(p.size*scale)),p.seed||1);
 if(id==='retro')return run('posterize',mosaic(s,'square',Math.max(2,Math.round(p.size*scale)),1),{levels:p.levels},scale);
 if(id==='anime'||id==='manga'){const base=id==='anime'?run('posterize',s,{levels:p.levels},scale):mosaic(s,'dots-square',Math.max(2,Math.round(p.size*scale)),1),edge=edges(s);return pixelMap(base,(d,i)=>{const t=edge.data[i]/255*p.amount/100;for(let k=0;k<3;k++)d[i+k]*=1-t})}
 if(id==='aberration'||id==='glitch'){const o=copy(s),d=s.data,rgba=[0,0,0,0];for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,band=Math.floor(y/Math.max(1,p.size*scale)),shift=id==='glitch'?(hash(band,0,p.seed)-.5)*rad*2:0,dx=rad*(id==='glitch'?.3:Math.cos(ang)),dy=id==='glitch'?0:rad*Math.sin(ang);sample(s,cap(x+shift+dx,0,W-1),cap(y+dy,0,H-1),rgba);o.data[i]=rgba[0];sample(s,cap(x+shift,0,W-1),y,rgba);o.data[i+1]=rgba[1];o.data[i+3]=rgba[3];sample(s,cap(x+shift-dx,0,W-1),cap(y-dy,0,H-1),rgba);o.data[i+2]=rgba[2]}return o}
 if(id==='bloom'||id==='cross'){const hi=pixelMap(s,(d,i)=>{const l=lum(d[i],d[i+1],d[i+2]),t=cap((l-p.threshold)/Math.max(1,255-p.threshold),0,1);d[i]*=t;d[i+1]*=t;d[i+2]*=t});let q;
  if(id==='bloom')q=blur(hi,rad);else{const a=sampleBlur(hi,'motion',rad*2,ang,0,0),b=sampleBlur(hi,'motion',rad*2,ang+Math.PI/2,0,0);q=pixelMap(a,(d,i)=>{for(let k=0;k<3;k++)d[i+k]=Math.max(d[i+k],b.data[i+k])})}
  return pixelMap(s,(d,i)=>{for(let k=0;k<3;k++)d[i+k]=255-(255-d[i+k])*(255-q.data[i+k])/255});
 }
 if(f.group==='draw'||f.group==='frame'){
 const c=color(p.color),bg=p.background?color(p.background):[0,0,0],o=image(W,H),size=Math.max(1,(p.size||p.spacing||p.width)*scale),dx=Math.cos(ang),dy=Math.sin(ang);
 function valueNoise(x,y,step,seed){x/=step;y/=step;const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,tx=fx*fx*(3-2*fx),ty=fy*fy*(3-2*fy),a=hash(ix,iy,seed)*(1-tx)+hash(ix+1,iy,seed)*tx,b=hash(ix,iy+1,seed)*(1-tx)+hash(ix+1,iy+1,seed)*tx;return a*(1-ty)+b*ty}
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;let t=0,a=255;
  if(id==='linear-gradient'){const extent=Math.abs(dx)*W+Math.abs(dy)*H;t=cap(((x-W/2)*dx+(y-H/2)*dy)/Math.max(1,extent)+.5,0,1)}
  else if(id==='radial-gradient')t=cap(Math.hypot(x-cx,y-cy)/Math.max(W,H)*2,0,1);
  else if(id==='angular-gradient')t=(Math.atan2(y-cy,x-cx)+Math.PI)/(Math.PI*2);
  else if(id==='clouds'){let weight=0;for(let k=0;k<5;k++){const q=2**-k;t+=valueNoise(x,y,size/2**k,p.seed+k)*q;weight+=q}t/=weight}
  else if(id==='radial-lines'){const theta=Math.atan2(y-cy,x-cx),period=2*Math.PI/p.count,offset=Math.abs(((theta+Math.PI*4+period/2)%period)-period/2),dist=Math.hypot(x-cx,y-cy);a=offset*dist<=p.width*scale/2?255:0}
  else if(id==='speed-lines'){const cross=-x*dy+y*dx,along=x*dx+y*dy,band=Math.floor(cross/size);a=((cross%size+size)%size)<p.width*scale&&hash(Math.floor(along/(size*4)),band,p.seed)>.25?255:0}
  else if(id==='table'){const xx=(x+.5)/(W/p.columns),yy=(y+.5)/(H/p.rows),edge=Math.min((xx%1)*W/p.columns,(1-xx%1)*W/p.columns,(yy%1)*H/p.rows,(1-yy%1)*H/p.rows);a=edge<=p.width*scale/2?255:0}
  else if(id==='border')a=Math.min(x,y,W-1-x,H-1-y)<p.width*scale?255:0;
  else if(id==='vignette'){const norm=Math.max(Math.abs(x-W/2)/(W/2),Math.abs(y-H/2)/(H/2)),fall=p.width/100;t=cap((norm-(1-fall))/fall,0,1);t=t*t*(3-2*t)*p.amount/100;const q=over(c[0],c[1],c[2],t,s.data[i],s.data[i+1],s.data[i+2],s.data[i+3]/255);o.data.set(q,i);continue}
  o.data[i]=c[0]*(1-t)+bg[0]*t;o.data[i+1]=c[1]*(1-t)+bg[1]*t;o.data[i+2]=c[2]*(1-t)+bg[2]*t;o.data[i+3]=a;
 }
 // Lines and frames overlay the original; gradients/clouds generate a replacement.
 if(['radial-lines','speed-lines','table','border'].includes(id))for(let i=0;i<o.data.length;i+=4)o.data.set(over(o.data[i],o.data[i+1],o.data[i+2],o.data[i+3]/255,s.data[i],s.data[i+1],s.data[i+2],s.data[i+3]/255),i);
 return o;
 }
 if(f.group==='transform'){
 const R=Math.max(1,Math.min(W,H)/2);return warp(s,(x,y,out)=>{const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy),theta=Math.atan2(dy,dx);let rr=r,tt=theta;
  if(id==='expansion')rr=r/(p.amount/100);
  else if(id==='fisheye'){const n=r/R;rr=r*(1+p.amount/100*(n*n-1))}
  else if(id==='sphere'&&r<R){const n=r/R;rr=R*Math.asin(cap(n,0,1))/(Math.PI/2)*(p.amount/100)+r*(1-p.amount/100)}
  else if(id==='wave'){out[0]=x+Math.cos(ang)*Math.sin((-x*Math.sin(ang)+y*Math.cos(ang))/Math.max(1,p.size*scale)*Math.PI*2)*rad;out[1]=y+Math.sin(ang)*Math.sin((-x*Math.sin(ang)+y*Math.cos(ang))/Math.max(1,p.size*scale)*Math.PI*2)*rad;return}
  else if(id==='ripple')rr=r+Math.sin(r/Math.max(1,p.size*scale)*Math.PI*2)*rad;
  else if(id==='twirl')tt=theta-p.amount*Math.PI/180*Math.max(0,1-r/R)**2;
  else if(id==='polar'){out[0]=(((theta+ang)/(Math.PI*2)+1.5)%1)*(W-1);out[1]=r/R*(H-1);return}
  out[0]=cx+Math.cos(tt)*rr;out[1]=cy+Math.sin(tt)*rr;
 });}
 throw Error('Filter has no implementation: '+id);
}
function constrain(original,effect,mask,alphaLock,strength=1){const o=copy(original),a=original.data,b=effect.data,d=o.data;for(let i=0;i<d.length;i+=4){let t=cap(strength,0,1)*(mask?mask[i+3]/255:1);if(t===0)continue;const A=a[i+3]/255,B=b[i+3]/255;if(alphaLock){if(!A||!B)continue;for(let c=0;c<3;c++)d[i+c]=a[i+c]*(1-t)+b[i+c]*t;continue}const alpha=A*(1-t)+B*t;for(let c=0;c<3;c++)d[i+c]=alpha?(a[i+c]*A*(1-t)+b[i+c]*B*t)/alpha:0;d[i+3]=alpha*255}return o}
const api={catalog,groups,defaults,run,constrain,image};root.KanvasFX=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
