export type Member = { id:string; name:string; email:string; blocked:boolean; admin:boolean };
export type Entry = { id:string; joinedAt:number };
export type Court = { id:number; closed:boolean; players:string[]; startedAt:number|null; endsAt:number|null; nextPlayers?:string[] };
export type State = { members:Member[]; queue:Entry[]; courts:Court[]; updatedAt:number };
export const initialState = ():State => ({ members:[], queue:[], courts:[1,2,3].map(id=>({id,closed:false,players:[],startedAt:null,endsAt:null,nextPlayers:[]})), updatedAt:Date.now() });
export function advance(s:State, now=Date.now()) {
 for(const c of s.courts) {
  c.nextPlayers ??= [];
  if(c.endsAt && c.endsAt<=now){c.players=[];c.startedAt=null;c.endsAt=null;}
 }
 for(const c of s.courts) {
  if(c.closed || c.players.length)continue;
  if(c.nextPlayers!.length===4){c.players=c.nextPlayers!;c.nextPlayers=[];}
  else if(s.queue.length>=4)c.players=s.queue.splice(0,4).map(p=>p.id);
  if(c.players.length===4){c.startedAt=now;c.endsAt=now+1800000;}
 }
 return s;
}
export function applyAction(s:State, action:string, body:any, actor:Member, now=Date.now()) {
 advance(s,now);
 const occupied=(id:string)=>s.queue.some(p=>p.id===id)||s.courts.some(c=>c.players.includes(id)||c.nextPlayers?.includes(id));
 const returnToQueue=(ids:string[])=>{const eligible=ids.filter(id=>!s.members.find(m=>m.id===id)?.blocked);s.queue=[...eligible.map(id=>({id,joinedAt:now})),...s.queue.filter(p=>!eligible.includes(p.id))];};
 if(action==='join') {if(actor.blocked)throw Error('你的预约权限已暂停，请联系管理员。');if(occupied(actor.id))throw Error('你已在队列、场地或已安排的场次中。');s.queue.push({id:actor.id,joinedAt:now});}
 else if(action==='leave'){if(!s.queue.some(p=>p.id===actor.id))throw Error('只有等待队列中的预约可以自行取消；指定场次请联系管理员。');s.queue=s.queue.filter(p=>p.id!==actor.id);}
 else {
  if(!actor.admin)throw Error('需要管理员权限。');
  const c=s.courts.find(c=>c.id===Number(body.court));
  const m=s.members.find(m=>m.id===body.member);
  const remove=(id:string)=>{
   s.queue=s.queue.filter(p=>p.id!==id);
   for(const court of s.courts){
    if(court.players.includes(id)){returnToQueue(court.players.filter(p=>p!==id));court.players=[];court.startedAt=null;court.endsAt=null;}
    if(court.nextPlayers?.includes(id)){returnToQueue(court.nextPlayers.filter(p=>p!==id));court.nextPlayers=[];}
   }
  };
  if(action==='end'||action==='close'||action==='open') {
   if(!c)throw Error('场地不存在。');
   if(action==='close'){returnToQueue([...c.players,...(c.nextPlayers||[])]);c.nextPlayers=[];c.closed=true;}
   if(action==='open')c.closed=false;else{c.players=[];c.startedAt=null;c.endsAt=null;}
  }
  else if(action==='remove'){if(!m)throw Error('学生不存在。');remove(m.id);}
  else if(action==='priority'){const q=s.queue.find(p=>p.id===body.member);if(!q)throw Error('学生已离开队列。');s.queue=[q,...s.queue.filter(p=>p.id!==q.id)];}
  else if(action==='block'){if(!m||m.id===actor.id||m.admin)throw Error('不能暂停自己或管理员。');m.blocked=!m.blocked;if(m.blocked)remove(m.id);}
  else if(action==='rename'){if(!m)throw Error('学生不存在。');const name=String(body.name||'').trim();if(!name||name.length>40)throw Error('姓名须为 1–40 个字符。');m.name=name;}
  else if(action==='role'){if(!m||m.id===actor.id)throw Error('不能更改自己的管理员权限。');m.admin=!m.admin;}
  else if(action==='assign'||action==='plan'||action==='cancel-plan'){
   if(!c||c.closed)throw Error('请选择开放的场地。');
   if(body.expectedStartedAt!==c.startedAt || JSON.stringify(body.expectedPlayers)!==JSON.stringify(c.players) || JSON.stringify(body.expectedNextPlayers)!==JSON.stringify(c.nextPlayers||[]))throw Error('此场地的场次或人员已变化，请关闭窗口后重新安排。');
   if(action==='cancel-plan'){returnToQueue(c.nextPlayers||[]);c.nextPlayers=[];}
   else {
    if(action==='plan'&&c.players.length!==4)throw Error('空场请使用“安排四人开场”。');
    const ids=body.members;
    if(!Array.isArray(ids)||ids.length!==4||new Set(ids).size!==4||!ids.every(id=>typeof id==='string'&&s.members.some(m=>m.id===id&&!m.blocked)))throw Error('请选择四名不同且未被暂停的学生。');
    for(const id of ids)for(const court of s.courts){
     if(court.players.includes(id)&&!(action==='assign'&&court.id===c.id))throw Error('所选学生正在其他场次打球，请先结束其场次或移除该学生。');
     if(court.nextPlayers?.includes(id)&&!(action==='plan'&&court.id===c.id))throw Error('所选学生已被安排到其他场次，请先取消其安排。');
    }
    const old=action==='plan'?(c.nextPlayers||[]):c.players;
    s.queue=s.queue.filter(p=>!ids.includes(p.id));
    returnToQueue(old.filter(id=>!ids.includes(id)));
    if(action==='plan')c.nextPlayers=[...ids];
    else{const wasActive=c.players.length===4;c.players=[...ids];if(!wasActive){c.startedAt=now;c.endsAt=now+1800000;}}
   }
  }
  else throw Error('不支持此操作。');
 }
 s.updatedAt=now;return advance(s,now);
}
