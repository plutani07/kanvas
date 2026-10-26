'use strict';
importScripts('fx-engine.js');
self.onmessage=e=>{const {id,image,params,scale,mask,alphaLock,strength}=e.data;try{const effect=KanvasFX.run(id,image,params,scale),result=KanvasFX.constrain(image,effect,mask,alphaLock,strength);self.postMessage({image:result},[result.data.buffer])}catch(error){self.postMessage({error:error.message||'Filter failed'})}};
