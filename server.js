const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const crypto=require("crypto");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static("public"));
app.get("/health",(_,res)=>res.json({ok:true,app:"Kitti Online"}));
const rooms=new Map(), suits=["♠","♥","♦","♣"], ranks=["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const val=Object.fromEntries(ranks.map((r,i)=>[r,i+2]));
function deck(){const d=[];for(const s of suits)for(const r of ranks)d.push({r,s,id:r+s});for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}return d;}
function code(){return crypto.randomBytes(3).toString("hex").toUpperCase();}
function evalHand(c){
 const v=c.map(x=>val[x.r]).sort((a,b)=>b-a), same=c.every(x=>x.s===c[0].s), cnt={};c.forEach(x=>cnt[x.r]=(cnt[x.r]||0)+1);
 const counts=Object.values(cnt).sort((a,b)=>b-a), has=(...a)=>a.every(x=>v.includes(x)), run=[...v].sort((a,b)=>a-b).every((x,i,a)=>i===0||x===a[i-1]+1);
 let cat=11,label="High card";
 if(counts[0]===3){cat=1;label="Trail";}
 else if(same&&has(2,3,5)){cat=2;label="Pure 2-3-5";}
 else if(same&&has(12,13,14)){cat=3;label="Pure A-K-Q";}
 else if(same&&has(2,3,14)){cat=4;label="Pure A-2-3";}
 else if(same&&run){cat=5;label="Pure sequence";}
 else if(has(2,3,5)){cat=6;label="2-3-5";}
 else if(has(12,13,14)){cat=7;label="A-K-Q";}
 else if(has(2,3,14)){cat=8;label="A-2-3";}
 else if(same){cat=9;label="Colour";}
 else if(counts[0]===2){cat=10;label="Pair";}
 return {cat,tie:v,label};
}
function compare(a,b){const x=evalHand(a),y=evalHand(b);if(x.cat!==y.cat)return x.cat<y.cat?1:-1;for(let i=0;i<3;i++)if(x.tie[i]!==y.tie[i])return x.tie[i]>y.tie[i]?1:-1;return 0;}
function orderGroups(cards){const combos=[];for(let i=0;i<cards.length;i++)for(let j=i+1;j<cards.length;j++)for(let k=j+1;k<cards.length;k++)combos.push([cards[i],cards[j],cards[k]]);
 // Greedy strongest-first, removing used cards; randomize ties to avoid predictable bot patterns.
 const remaining=[...cards], out=[];
 while(out.length<4){let best=null;for(let i=0;i<remaining.length;i++)for(let j=i+1;j<remaining.length;j++)for(let k=j+1;k<remaining.length;k++){const g=[remaining[i],remaining[j],remaining[k]];if(!best||compare(g,best)>0)best=g;}
 out.push(best);const ids=new Set(best.map(c=>c.id));for(let i=remaining.length-1;i>=0;i--)if(ids.has(remaining[i].id))remaining.splice(i,1);}
 return out;
}
function pub(r){return {code:r.code,phase:r.phase,hostId:r.hostId,players:r.players.map(p=>({id:p.id,name:p.name,bot:!!p.bot,ready:!!p.ready,roundWins:p.roundWins||0,connected:p.connected!==false})),readyCount:r.players.filter(p=>p.ready).length,round:r.round,starter:r.starter,plays:r.plays.map(x=>({playerId:x.playerId,cards:x.cards,handName:x.handName,groupIndex:x.groupIndex})),winner:r.winner,message:r.message,activity:r.activity||{}};}
function send(r){io.to(r.code).emit("room:update",pub(r));for(const p of r.players)if(!p.bot&&p.id)io.to(p.id).emit("private:hand",{hand:p.ready?[]:(p.hand||[]),groups:p.groups||[]});}
function notice(s,m){s.emit("notice",m);}
function find(id){return [...rooms.values()].find(r=>r.players.some(p=>p.id===id));}
function arrangeBot(p){p.groups=orderGroups(p.hand);p.usedIds=new Set(p.groups.flat().map(c=>c.id));p.ready=true;}
function start(r){
 if(r.players.filter(p=>!p.bot).length<2)return false;
 const d=deck();for(const p of r.players){p.hand=d.splice(0,13);p.groups=[];p.ready=!!p.bot;p.roundWins=0;p.discardedCard=null;if(p.bot)arrangeBot(p);}
 r.phase="arrange";r.round=1;r.starter=0;r.plays=[];r.winner=null;r.message="Arrange 4 groups of 3 cards. Your 13th card is automatically kept out of play.";
 if(r.players.every(p=>p.ready))beginPlay(r);else send(r);return true;
}
function beginPlay(r){r.phase="playing";r.round=1;r.starter=0;r.plays=[];r.message=`All ready. Round 1 — ${r.players[r.starter].name} starts.`;send(r);botTurn(r);}
function botTurn(r){
 if(r.phase!=="playing")return;
 const p=r.players[(r.starter+r.plays.length)%4];if(!p?.bot)return;
 setTimeout(()=>{if(r.phase!=="playing")return;const idx=p.groups.findIndex((g,i)=>!r.plays.some(x=>x.playerId===p.id&&x.groupIndex===i));if(idx<0)return;play(r,p,idx);},900);
}
function play(r,p,idx){
 if(r.plays.some(x=>x.playerId===p.id))return;
 const cards=p.groups[idx];if(!cards)return;
 r.plays.push({playerId:p.id,cards,handName:evalHand(cards).label,groupIndex:idx});
 if(r.plays.length===4){let best=0;for(let i=1;i<4;i++){const c=compare(r.plays[i].cards,r.plays[best].cards);if(c>=0)best=i;}
 const w=r.players.find(x=>x.id===r.plays[best].playerId);w.roundWins++;r.winner=w.id;r.phase="roundResult";r.message=`${w.name} wins Round ${r.round} with ${r.plays[best].handName}.`;send(r);
 }else{r.message=`${p.name} played. Waiting for the next player.`;send(r);botTurn(r);}
}
io.on("connection",s=>{
 s.on("room:create",({name})=>{const c=code(),r={code:c,hostId:s.id,players:[],phase:"lobby",round:0,starter:0,plays:[],winner:null,message:"Invite friends. The host can start with at least 2 human players.",activity:{}};rooms.set(c,r);join(r,name||"Player",s);});
 s.on("room:join",({code:c,name})=>{const r=rooms.get(String(c||"").toUpperCase());if(!r)return notice(s,"Room code not found.");if(r.phase!=="lobby")return notice(s,"This game has already started.");if(r.players.length>=4)return notice(s,"This room is full.");join(r,name||"Player",s);});
 function join(r,name,so){so.join(r.code);r.players.push({id:so.id,name:String(name).slice(0,18),bot:false,ready:false,roundWins:0,connected:true,hand:[],groups:[]});r.message=`${r.players.length}/4 human players in the lobby.`;send(r);}
 s.on("game:start",()=>{const r=find(s.id);if(!r||r.hostId!==s.id||r.phase!=="lobby")return notice(s,"Only the host can start from the lobby.");const humans=r.players.filter(p=>!p.bot).length;if(humans<2)return notice(s,"At least 2 human players are required.");while(r.players.length<4){const n=r.players.length+1;r.players.push({id:`bot-${r.code}-${n}`,name:`Bot ${n}`,bot:true,ready:true,connected:true,roundWins:0,hand:[],groups:[]});}start(r);});
 s.on("game:arrange",({groups})=>{const r=find(s.id);if(!r||r.phase!=="arrange")return;const p=r.players.find(x=>x.id===s.id);if(!p||p.ready)return notice(s,"Press Unready before editing.");
 if(!Array.isArray(groups)||groups.length!==4||groups.some(g=>!Array.isArray(g)||g.length!==3))return notice(s,"Each round must contain exactly 3 cards.");
 const ids=groups.flat();if(new Set(ids).size!==12||!ids.every(id=>p.hand.some(c=>c.id===id)))return notice(s,"Use 12 different cards from your hand. Your remaining card is automatically set aside.");
 const gs=groups.map(g=>g.map(id=>p.hand.find(c=>c.id===id)));for(let i=0;i<3;i++)if(compare(gs[i],gs[i+1])<0)return notice(s,`Round ${i+1} is weaker than Round ${i+2}. Arrange strongest to weakest.`);
 p.groups=gs;p.ready=true;r.message=`${p.name} is ready (${r.players.filter(x=>x.ready).length}/4).`;if(r.players.every(x=>x.ready)){beginPlay(r);}else send(r);
 });
 s.on("game:unready",()=>{const r=find(s.id);if(!r||r.phase!=="arrange")return;const p=r.players.find(x=>x.id===s.id);if(p){p.ready=false;r.message=`${p.name} is editing their cards again.`;send(r);}});
 s.on("game:activity",({count})=>{const r=find(s.id);if(!r||r.phase!=="arrange")return;r.activity[s.id]={count:Math.max(0,Math.min(13,Number(count)||0))};io.to(r.code).emit("room:update",pub(r));});
 s.on("room:kick",({playerId})=>{const r=find(s.id);if(!r||r.hostId!==s.id||r.phase!=="lobby")return notice(s,"Only the host can kick players in the lobby.");const p=r.players.find(x=>x.id===playerId&&!x.bot);if(!p||p.id===r.hostId)return;io.to(p.id).emit("notice","The host removed you from the room.");io.sockets.sockets.get(p.id)?.leave(r.code);r.players=r.players.filter(x=>x.id!==playerId);send(r);});
 s.on("game:play",({groupIndex})=>{const r=find(s.id);if(!r||r.phase!=="playing")return;const p=r.players.find(x=>x.id===s.id);if(!p)return;if(r.plays.some(x=>x.playerId===p.id))return notice(s,"You already played this round.");const expected=r.players[(r.starter+r.plays.length)%4];if(expected.id!==p.id)return notice(s,`It's ${expected.name}'s turn.`);if(!Number.isInteger(groupIndex)||groupIndex<0||groupIndex>3)return;play(r,p,groupIndex);});
 s.on("game:next",()=>{const r=find(s.id);if(!r||r.phase!=="roundResult"||r.hostId!==s.id)return notice(s,"Only the host can continue.");if(r.players.some(p=>p.roundWins>=3)){r.phase="finished";const w=r.players.find(p=>p.roundWins>=3);r.message=`${w.name} wins the game!`;}else if(r.round>=4){r.phase="finished";const top=Math.max(...r.players.map(p=>p.roundWins)),w=r.players.filter(p=>p.roundWins===top);r.message=w.length===1?`${w[0].name} wins the game!`:`Game tied: ${w.map(x=>x.name).join(", ")}.`;}else{r.round++;r.starter=r.players.findIndex(p=>p.id===r.winner);r.plays=[];r.winner=null;r.phase="playing";r.message=`Round ${r.round}. ${r.players[r.starter].name} starts.`;send(r);botTurn(r);}});
 s.on("rtc:signal",({to,data})=>{if(typeof to==="string"&&data)io.to(to).emit("rtc:signal",{from:s.id,data});});
 s.on("disconnect",()=>{const r=find(s.id);if(!r)return;const p=r.players.find(x=>x.id===s.id);if(p){p.connected=false;r.message=`${p.name} disconnected. Refreshing does not restore the same seat yet.`;send(r);}});
});
const port=process.env.PORT||3000;server.listen(port,()=>console.log(`Kitti Online listening on ${port}`));
