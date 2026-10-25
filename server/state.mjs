import { assert } from './transport.mjs';
export const positionAt=(state,now=Date.now())=>Math.max(0,state.position+(state.playing?Math.max(0,now-state.updatedAt)/1000*state.rate:0));
export function sourceUrl(value){assert(typeof value==='string'&&value.length<=4096,'INVALID_URL');let url;try{url=new URL(value);}catch{assert(false,'INVALID_URL');}assert(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password,'INVALID_URL');return url.href;}
export function nextState(previous,action,now){const state={...previous,position:positionAt(previous,now),updatedAt:now,revision:previous.revision+1};
 switch(action.kind){case 'source':state.source=sourceUrl(action.url);state.playing=false;state.position=0;break;
 case 'play':assert(state.source,'NO_VIDEO');if(action.position!==undefined){assert(Number.isFinite(action.position)&&action.position>=0&&action.position<=604800,'INVALID_POSITION');state.position=action.position;}state.playing=true;break;
 case 'pause':if(action.position!==undefined){assert(Number.isFinite(action.position)&&action.position>=0&&action.position<=604800,'INVALID_POSITION');state.position=action.position;}state.playing=false;break;
 case 'seek':assert(Number.isFinite(action.position)&&action.position>=0&&action.position<=604800,'INVALID_POSITION');state.position=action.position;break;
 case 'rate':assert([.25,.5,.75,1,1.25,1.5,2].includes(action.rate),'INVALID_RATE');state.rate=action.rate;break;
 default:assert(false,'INVALID_ACTION');}return state;
}
