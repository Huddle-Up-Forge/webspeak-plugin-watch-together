import {readFile,writeFile,rename,unlink} from 'node:fs/promises';import path from 'node:path';import {createHash,randomUUID} from 'node:crypto';
import {createHub,assert,jsonBody,reply,AppError} from './transport.mjs';import {positionAt,nextState,sourceUrl} from './state.mjs';
export default async function activate({dataDir,events,signal,publicConfig={}}){
 const rooms=new Map(),hostOnly=publicConfig?.control==='host';let stopped=false;
 const hub=createHub({events,signal,onLeave:p=>{const pending=rooms.get(p.scope);if(pending)void pending.then(room=>{if(room.host===p.id){room.host=hub.list(p.scope)[0]?.id??null;publish(room);}}).catch(()=>{});}});
 async function room(scope){assert(!stopped,'STOPPED',503);if(!rooms.has(scope)){assert(rooms.size<64,'ROOM_LIMIT',429);const pending=(async()=>{const filename=path.join(dataDir,createHash('sha256').update(scope).digest('hex')+'.json');let state={revision:0,source:'',position:0,playing:false,rate:1,updatedAt:Date.now()};try{const saved=JSON.parse(await readFile(filename,'utf8'));assert(saved.version===1&&Number.isSafeInteger(saved.state.revision)&&saved.state.revision>=0);if(saved.state.source)sourceUrl(saved.state.source);assert(Number.isFinite(saved.state.position)&&saved.state.position>=0&&[.25,.5,.75,1,1.25,1.5,2].includes(saved.state.rate));state={...state,...saved.state,playing:false,updatedAt:Date.now()};}catch(error){if(error?.code!=='ENOENT')throw new AppError('ROOM_DATA_INVALID',500);}return {scope,filename,state,host:null,queue:Promise.resolve(),lastUsed:Date.now()};})();rooms.set(scope,pending);pending.catch(()=>rooms.delete(scope));}const result=await rooms.get(scope);result.lastUsed=Date.now();return result;}
 function snapshot(r){return {state:r.state,now:Date.now(),host:r.host,hostOnly,members:hub.list(r.scope)};}
 function publish(r){hub.broadcast(r.scope,'state',snapshot(r));}
 async function persist(r,state){const temporary=r.filename+'.'+randomUUID()+'.tmp';try{await writeFile(temporary,JSON.stringify({version:1,state}),{flag:'wx',mode:0o600});await rename(temporary,r.filename);}finally{await unlink(temporary).catch(()=>{});}}
 const timer=setInterval(()=>{for(const [scope,pending]of rooms)void pending.then(r=>{if(!hub.list(scope).length&&Date.now()-r.lastUsed>1800000)rooms.delete(scope);}).catch(()=>{});},60000);timer.unref?.();
 return {handle:hub.handle(async(req,res)=>{
  const route=new URL(req.url,'http://app.local').pathname,c=hub.context(req);
  if(req.method==='GET'&&route==='/clock'){reply(res,{now:Date.now()});return;}
  if(req.method==='GET'&&route==='/events'){const r=await room(c.scope.key),p=hub.join(req,res);if(!r.host)r.host=p.id;hub.emit(p,'hello',{self:p.id});publish(r);return;}
  assert(req.method==='POST'&&route==='/action','NOT_FOUND',404);const p=hub.peer(req);hub.rate(p,50);const body=await jsonBody(req,10000),r=await room(p.scope);
  const action=r.queue.then(async()=>{assert(hub.peers.get(p.id)===p,'JOIN_REQUIRED',403);assert(!hostOnly||r.host===p.id,'HOST_ONLY',403);
   if(body.revision!==r.state.revision){const error=new AppError('STATE_CHANGED',409);error.snapshot=snapshot(r);throw error;}
   if(body.kind==='handoff'){assert(r.host===p.id,'HOST_ONLY',403);assert(hub.peers.get(body.to)?.scope===p.scope,'PEER_UNAVAILABLE',404);r.host=body.to;publish(r);return snapshot(r);}
   const next=nextState(r.state,body,Date.now());await persist(r,next);r.state=next;publish(r);return snapshot(r);
  });r.queue=action.catch(()=>{});reply(res,await action);
 }),async stop(){stopped=true;clearInterval(timer);hub.stop();for(const pending of rooms.values()){const r=await pending.catch(()=>null);if(r){await r.queue;const paused={...r.state,position:positionAt(r.state),playing:false,updatedAt:Date.now()};await persist(r,paused).catch(()=>{});}}rooms.clear();}};
}
