import assert from 'node:assert/strict';import test from 'node:test';import {fixture} from './fixture.mjs';
test('watch state supports play, seek, rate, late joining, CAS conflicts and durable paused restart',async t=>{
 const f=await fixture(t,'watch-together');const a=await f.stream('a'),initial=await a.wait('state');const source=await(await f.call('a','/action',{kind:'source',url:'https://media.example/video.mp4',revision:initial.state.revision})).json();assert.equal(source.state.source,'https://media.example/video.mp4');
 const played=await(await f.call('a','/action',{kind:'play',revision:source.state.revision})).json();assert.equal(played.state.playing,true);
 const b=await f.stream('b'),late=await b.wait('state');assert.equal(late.state.revision,played.state.revision);assert.equal(late.state.playing,true);
 const stale=await f.call('b','/action',{kind:'pause',revision:0});assert.equal(stale.status,409);assert.equal((await stale.json()).snapshot.state.revision,played.state.revision);
 const results=await Promise.all([f.call('a','/action',{kind:'seek',position:20,revision:played.state.revision}),f.call('b','/action',{kind:'rate',rate:2,revision:played.state.revision})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const current=await results.find(r=>r.status===200).json();
 const seeked=await(await f.call('a','/action',{kind:'seek',position:42,revision:current.state.revision})).json();const speed=await(await f.call('b','/action',{kind:'rate',rate:1.5,revision:seeked.state.revision})).json();assert.equal(speed.state.rate,1.5);
 await f.restart();const restored=await(await f.stream('a')).wait('state');assert.equal(restored.state.playing,false);assert.equal(restored.state.rate,1.5);assert.ok(restored.state.position>=42);assert.equal(restored.state.source,'https://media.example/video.mp4');const ended=await(await f.call('a','/action',{kind:'pause',position:30,revision:restored.state.revision})).json();const replay=await(await f.call('a','/action',{kind:'play',position:0,revision:ended.state.revision})).json();assert.equal(replay.state.position,0);assert.equal(replay.state.playing,true);
});
test('watch host mode enforces ownership, handoff, takeover on departure and scope isolation',async t=>{
 const f=await fixture(t,'watch-together',{publicConfig:{control:'host'}}),a=await f.stream('a'),b=await f.stream('b'),x=await f.stream('x');const state=await a.wait('state');assert.equal(state.host,'app-a');assert.equal((await f.call('b','/action',{kind:'seek',position:1,revision:0})).status,403);
 const handoff=await f.call('a','/action',{kind:'handoff',to:'app-b',revision:0});assert.equal(handoff.status,200);assert.equal((await handoff.json()).host,'app-b');assert.equal((await f.call('a','/action',{kind:'seek',position:1,revision:0})).status,403);
 assert.equal((await f.call('b','/action',{kind:'source',url:'https://media.example/private.mp4',revision:0})).status,200);assert.equal(x.received.some(e=>e.event==='state'&&e.data.state.source.includes('private')),false);
 await b.close();const host=await a.wait('state',s=>s.host==='app-a'&&s.state.revision===1);assert.equal(host.host,'app-a');
});
test('watch rejects nonmedia URL schemes, credentials, nonfinite seeks and unapproved speeds',async t=>{
 const f=await fixture(t,'watch-together');await f.stream('a');for(const body of [{kind:'source',url:'javascript:alert(1)'},{kind:'source',url:'https://user:secret@media.example/video.mp4'},{kind:'source',url:'file:///secret'},{kind:'seek',position:-1},{kind:'rate',rate:100}])assert.equal((await f.call('a','/action',{...body,revision:0})).status,400);
});
