import { randomUUID } from 'node:crypto';
export class AppError extends Error { constructor(code,status=400){super(code);this.code=code;this.status=status;} }
export const assert=(value,code='INVALID_REQUEST',status=400)=>{if(!value)throw new AppError(code,status);};
export async function jsonBody(req,max=100000){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;assert(size<=max,'REQUEST_TOO_LARGE',413);chunks.push(chunk);}try{const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));assert(result&&typeof result==='object'&&!Array.isArray(result));return result;}catch(error){if(error instanceof AppError)throw error;throw new AppError('INVALID_JSON');}}
export function reply(res,value,status=200){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
export function createHub({events,signal,onLeave=()=>{},limit=128}){
 const peers=new Map(),listeners=new Map();let stopped=false;
 function context(req){const c=req.webspeak;assert(c?.apiVersion===2&&typeof c.appId==='string'&&typeof c.self?.id==='string'&&typeof c.self.nickname==='string'&&typeof c.scope?.key==='string','CONTEXT_REQUIRED',403);return c;}
 function peer(req){const c=context(req),p=peers.get(c.appId);assert(p&&p.scope===c.scope.key,'JOIN_REQUIRED',403);p.context=c;return p;}
 function emit(p,event,data){if(!p?.res||p.res.destroyed)return;if(p.res.writableLength>256*1024){p.res.destroy();return;}p.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);}
 function list(scope){return [...peers.values()].filter(p=>p.scope===scope).map(p=>({id:p.id,nickname:p.context.self.nickname}));}
 function broadcast(scope,event,data){for(const p of peers.values())if(p.scope===scope)emit(p,event,data);}
 function remove(id){const p=peers.get(id);if(!p)return;peers.delete(id);p.res.end();onLeave(p);broadcast(p.scope,'members',list(p.scope));}
 function join(req,res){const c=context(req);assert(!stopped,'STOPPED',503);assert(peers.has(c.appId)||peers.size<limit,'ROOM_FULL',429);const old=peers.get(c.appId);if(old){peers.delete(old.id);old.res.end();}
  res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});res.flushHeaders();const p={id:c.appId,scope:c.scope.key,context:c,res,rateAt:Date.now(),requests:0};peers.set(p.id,p);
  res.on('close',()=>{if(peers.get(p.id)===p)remove(p.id);});broadcast(p.scope,'members',list(p.scope));return p;
 }
 function rate(p,max=100){const now=Date.now();if(now-p.rateAt>10000){p.rateAt=now;p.requests=0;}assert(++p.requests<=max,'RATE_LIMIT',429);}
 const left=value=>remove(value?.appId),changed=c=>{const p=peers.get(c?.appId);if(!p)return;if(c.scope.key!==p.scope)remove(p.id);else{p.context=c;broadcast(p.scope,'members',list(p.scope));}};
 events.on('participantLeft',left);events.on('contextChanged',changed);
 const timer=setInterval(()=>{for(const p of peers.values())emit(p,'heartbeat',{now:Date.now()});},10000);timer.unref?.();
 function stop(){if(stopped)return;stopped=true;clearInterval(timer);events.off('participantLeft',left);events.off('contextChanged',changed);for(const id of [...peers.keys()])remove(id);listeners.clear();}
 signal.addEventListener('abort',stop,{once:true});
 return {peers,context,peer,emit,broadcast,list,join,remove,rate,stop,id:()=>randomUUID(),handle:handler=>async(req,res)=>{try{await handler(req,res);}catch(error){if(!res.headersSent)reply(res,{error:error instanceof AppError?error.code:'APPLICATION_FAILED',...(error.snapshot?{snapshot:error.snapshot}:{})},error instanceof AppError?error.status:500);else res.end();}}};
}
