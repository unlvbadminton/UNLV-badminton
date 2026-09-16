import { allowedEmail, DEFAULT_ADMIN_EMAIL } from './email-policy';
import { env } from 'cloudflare:workers';
import { initialState, State, advance } from './club';
export const config=()=>{const e=env as any;return {url:String(e.SUPABASE_URL||'').replace(/\/$/,''),key:String(e.SUPABASE_ANON_KEY||''),domain:String(e.SCHOOL_EMAIL_DOMAIN||'unlv.nevada.edu').toLowerCase(),admins:String(e.ADMIN_EMAILS ?? DEFAULT_ADMIN_EMAIL).toLowerCase().split(',').map((s:string)=>s.trim())};};
export function db(){if(!env.DB)throw Error('场地服务暂不可用，请稍后重试。');return env.DB;}
export async function mutate(fn:(s:State)=>void):Promise<State>{
 const d=db();await d.prepare('INSERT OR IGNORE INTO club_state (id,version,data) VALUES (?,0,?)').bind('main',JSON.stringify(initialState())).run();
 for(let i=0;i<8;i++){const row=await d.prepare('SELECT version,data FROM club_state WHERE id=?').bind('main').first<{version:number,data:string}>();if(!row)throw Error('读取失败。');const s=JSON.parse(row.data) as State;advance(s);fn(s);const r=await d.prepare('UPDATE club_state SET version=?,data=? WHERE id=? AND version=?').bind(row.version+1,JSON.stringify(s),'main',row.version).run();if(r.meta.changes===1)return s;}
 throw Error('同时操作人数较多，请重试。');
}
export async function identity(req:Request){
 const token=req.headers.get('cookie')?.match(/(?:^|;\s*)club_session=([^;]+)/)?.[1];if(!token)return null;
 const cfg=config();if(!cfg.url||!cfg.key)return null;
 try {const parts=token.split('.');const payload=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));const now=Date.now()/1000;if(!payload.iat||!payload.exp||now>=payload.exp||now>=payload.iat+14400)return null;
 const res=await fetch(cfg.url+'/auth/v1/user',{headers:{apikey:cfg.key,Authorization:'Bearer '+token}});if(!res.ok)return null;const u=await res.json() as any;if(!u.email_confirmed_at||!u.email||!allowedEmail(u.email,cfg.domain,cfg.admins))return null;return {id:u.id as string,email:u.email.toLowerCase() as string,expiresAt:Math.min(payload.exp,payload.iat+14400)*1000};}catch{return null;}
}
export function safeOrigin(req:Request){return req.headers.get('origin')===new URL(req.url).origin;}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}});}
