const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static("public"));
app.get("/health", (_, res) => res.json({ ok: true, app: "Kitti Online" }));

const rooms = new Map();
const suits = ["♠", "♥", "♦", "♣"];
const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
const value = Object.fromEntries(ranks.map((r,i)=>[r,i+2]));

function deck() {
  const d = [];
  for (const s of suits) for (const r of ranks) d.push({ r, s, id: r+s });
  for (let i=d.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
  return d;
}
function roomCode(){ return crypto.randomBytes(3).toString("hex").toUpperCase(); }
function sortVals(cards){ return cards.map(c=>value[c.r]).sort((a,b)=>b-a); }
function sameSuit(c){ return c.every(x=>x.s===c[0].s); }
function counts(c){ const m={}; c.forEach(x=>m[x.r]=(m[x.r]||0)+1); return Object.values(m).sort((a,b)=>b-a); }
function isRun(vals){
  const a=[...vals].sort((x,y)=>x-y);
  return a[1]===a[0]+1 && a[2]===a[1]+1;
}
function evalHand(c){
  const vals=sortVals(c), desc=[...vals].sort((a,b)=>b-a), ss=sameSuit(c);
  const cs=counts(c);
  const is235=vals.includes(2)&&vals.includes(3)&&vals.includes(5);
  const isAKQ=vals.includes(14)&&vals.includes(13)&&vals.includes(12);
  const isA23=vals.includes(14)&&vals.includes(2)&&vals.includes(3);
  // Lower category number is stronger. Special pure sequences outrank ordinary pure runs.
  if(cs[0]===3) return {cat:1, tie:desc, label:"Trail"};
  if(ss && is235) return {cat:2,tie:desc,label:"Pure 2-3-5"};
  if(ss && isAKQ) return {cat:3,tie:desc,label:"Pure A-K-Q"};
  if(ss && isA23) return {cat:4,tie:desc,label:"Pure A-2-3"};
  if(ss && isRun(vals)) return {cat:5,tie:desc,label:"Pure sequence"};
  if(is235) return {cat:6,tie:desc,label:"2-3-5"};
  if(isAKQ) return {cat:7,tie:desc,label:"A-K-Q"};
  if(isA23) return {cat:8,tie:desc,label:"A-2-3"};
  if(ss) return {cat:9,tie:desc,label:"Colour"};
  if(cs[0]===2) return {cat:10,tie:desc,label:"Pair"};
  return {cat:11,tie:desc,label:"High card"};
}
function compare(a,b){
  const x=evalHand(a), y=evalHand(b);
  if(x.cat!==y.cat) return x.cat<y.cat?1:-1;
  for(let i=0;i<Math.max(x.tie.length,y.tie.length);i++){
    if((x.tie[i]||0)!==(y.tie[i]||0)) return (x.tie[i]||0)>(y.tie[i]||0)?1:-1;
  }
  return 0;
}
function publicRoom(room){
  return {code:room.code, phase:room.phase, players:room.players.map(p=>({id:p.id,name:p.name,ready:p.ready,roundWins:p.roundWins,connected:p.connected})),
    round:room.round, starter:room.starter, plays:room.plays.map(x=>({playerId:x.playerId,cards:x.cards,handName:x.handName})),
    winner:room.winner, message:room.message};
}
function sendRoom(room){
  io.to(room.code).emit("room:update", publicRoom(room));
  room.players.forEach(p=>io.to(p.id).emit("private:hand",{hand:p.hand||[],discarded:p.discarded||false,groups:p.groups||[]}));
}
function fail(socket,msg){ socket.emit("notice",msg); }
function startGame(room){
  if(room.players.length!==4) return;
  const d=deck();
  room.players.forEach(p=>{p.hand=d.splice(0,13);p.discarded=false;p.groups=[];p.roundWins=0;p.ready=false;});
  room.phase="discard"; room.round=1; room.starter=0; room.plays=[]; room.winner=null;
  room.message="Arrange your cards, then discard one card face down.";
  sendRoom(room);
}
io.on("connection",socket=>{
  socket.on("room:create",({name})=>{
    const code=roomCode();
    const room={code,players:[],phase:"lobby",round:0,starter:0,plays:[],winner:null,message:"Waiting for four players."};
    rooms.set(code,room); join(room,name||"Player",socket);
  });
  socket.on("room:join",({code,name})=>{
    const room=rooms.get(String(code||"").toUpperCase());
    if(!room) return fail(socket,"Room code not found.");
    if(room.players.length>=4) return fail(socket,"This room already has four players.");
    if(room.phase!=="lobby") return fail(socket,"This game has already started.");
    join(room,name||"Player",socket);
  });
  function join(room,name,s){
    s.join(room.code);
    room.players.push({id:s.id,name:String(name).slice(0,18),ready:false,roundWins:0,connected:true,hand:[],groups:[]});
    room.message=`${room.players.length}/4 players joined.`;
    sendRoom(room);
    if(room.players.length===4) startGame(room);
  }
  socket.on("game:discard",({cardId})=>{
    const room=findRoom(socket.id); if(!room||room.phase!=="discard") return;
    const p=room.players.find(x=>x.id===socket.id);
    const idx=p.hand.findIndex(c=>c.id===cardId); if(idx<0) return;
    p.hand.splice(idx,1); p.discarded=true;
    if(room.players.every(x=>x.discarded)){
      room.phase="arrange"; room.message="Arrange your 12 cards into four groups of three.";
    }
    sendRoom(room);
  });
  socket.on("game:arrange",({groups})=>{
    const room=findRoom(socket.id); if(!room||room.phase!=="arrange") return;
    const p=room.players.find(x=>x.id===socket.id);
    if(!Array.isArray(groups)||groups.length!==4||groups.some(g=>!Array.isArray(g)||g.length!==3)) return fail(socket,"You need exactly four groups of three cards.");
    const ids=groups.flat();
    if(new Set(ids).size!==12||p.hand.length!==12||!ids.every(id=>p.hand.some(c=>c.id===id))) return fail(socket,"Each of your 12 cards must be used exactly once.");
    p.groups=groups.map(g=>g.map(id=>p.hand.find(c=>c.id===id)));
    p.ready=true;
    if(room.players.every(x=>x.ready)){
      room.phase="playing"; room.round=1; room.starter=0; room.plays=[];
      room.message=`Round 1. ${room.players[room.starter].name} starts.`;
    } else room.message="Waiting for the other players to finish arranging.";
    sendRoom(room);
  });
  socket.on("game:play",({groupIndex})=>{
    const room=findRoom(socket.id); if(!room||room.phase!=="playing") return;
    const p=room.players.find(x=>x.id===socket.id);
    if(room.plays.some(x=>x.playerId===socket.id)) return fail(socket,"You have already played this round.");
    const expected=room.players[(room.starter+room.plays.length)%4];
    if(expected.id!==socket.id) return fail(socket,`It's ${expected.name}'s turn.`);
    if(!Number.isInteger(groupIndex)||groupIndex<0||groupIndex>3||!p.groups[groupIndex]) return;
    const cards=p.groups[groupIndex];
    room.plays.push({playerId:p.id,cards,handName:evalHand(cards).label,groupIndex});
    if(room.plays.length===4){
      let best=0;
      for(let i=1;i<4;i++){
        const cmp=compare(room.plays[i].cards,room.plays[best].cards);
        if(cmp>0 || cmp===0) best=i; // exact tie: later player wins
      }
      const winningPlay=room.plays[best];
      const winner=room.players.find(x=>x.id===winningPlay.playerId);
      winner.roundWins++;
      room.winner=winner.id;
      room.message=`${winner.name} wins round ${room.round} with ${winningPlay.handName}!`;
      room.phase="roundResult";
      sendRoom(room);
    } else {
      room.message=`${p.name} played.`;
      sendRoom(room);
    }
  });
  socket.on("game:next",()=>{
    const room=findRoom(socket.id); if(!room||room.phase!=="roundResult") return;
    if(room.players.some(p=>p.roundWins>=3)){
      room.phase="finished";
      const champ=room.players.find(p=>p.roundWins>=3);
      room.message=`${champ.name} wins the game!`;
    } else if(room.round>=4){
      room.phase="finished";
      const top=Math.max(...room.players.map(p=>p.roundWins));
      const winners=room.players.filter(p=>p.roundWins===top);
      room.message=winners.length===1?`${winners[0].name} wins the game!`:`Game over: tied between ${winners.map(p=>p.name).join(", ")}.`;
    } else {
      room.round++;
      room.starter=room.players.findIndex(p=>p.id===room.winner);
      room.plays=[]; room.winner=null; room.phase="playing";
      room.message=`Round ${room.round}. ${room.players[room.starter].name} starts.`;
    }
    sendRoom(room);
  });
  socket.on("rtc:signal",({to,data})=>io.to(to).emit("rtc:signal",{from:socket.id,data}));
  socket.on("disconnect",()=>{
    const room=findRoom(socket.id); if(!room)return;
    const p=room.players.find(x=>x.id===socket.id); if(p)p.connected=false;
    room.message=`${p?.name||"A player"} disconnected. They can refresh and rejoin is not enabled in this starter build.`;
    sendRoom(room);
  });
});
function findRoom(id){return [...rooms.values()].find(r=>r.players.some(p=>p.id===id));}
const port=process.env.PORT||3000;
server.listen(port,()=>console.log(`Kitti Online listening on ${port}`));
