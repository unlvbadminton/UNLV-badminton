import {allowedEmail} from '@/lib/email-policy';
import {config,identity,json,mutate,safeOrigin} from '@/lib/server';
export async function POST(req:Request){
 if(!safeOrigin(req))return json({error:'请求来源无效。'},403);
 try{const b=await req.json() as any;const cfg=config();
 if(b.action==='logout')return new Response('{}',{headers:{'Content-Type':'application/json','Set-Cookie':'club_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});
 if(!cfg.url||!cfg.key)return json({error:'学校邮箱验证码服务尚未配置，请联系组织管理员。'},503);
 const email=String(b.email||'').trim().toLowerCase();if(!allowedEmail(email,cfg.domain,cfg.admins))return json({error:'请使用 @'+cfg.domain+' 学生邮箱，或已授权的管理员邮箱。'},400);
 if(b.action==='send'){
 const r=await fetch(cfg.url+'/auth/v1/otp',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email,create_user:true})});
 if(!r.ok)return json({error:r.status===429?'验证码发送过于频繁，请稍后再试。':'验证码暂时无法发送，请稍后重试。'},r.status===429?429:502);return json({ok:true});}
 if(b.action!=='verify'||!/^\d{6}$/.test(String(b.code)))return json({error:'请输入六位验证码。'},400);
 const name=String(b.name||'').trim();if(!name||name.length>40)return json({error:'请输入 1–40 个字符的显示姓名。'},400);
 const r=await fetch(cfg.url+'/auth/v1/verify',{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify({email,token:b.code,type:'email'})});if(!r.ok)return json({error:'验证码无效或已过期，请重新获取。'},401);
 const result=await r.json() as any;const token=result.access_token;if(!token||!result.user?.email_confirmed_at||result.user.email.toLowerCase()!==email)return json({error:'邮箱验证失败。'},401);
 const s=await mutate(s=>{let m=s.members.find(m=>m.id===result.user.id);if(!m){s.members.push({id:result.user.id,email,name,blocked:false,admin:cfg.admins.includes(email)});}else if(cfg.admins.includes(email))m.admin=true;});
 if(s.members.find(m=>m.id===result.user.id)?.blocked)return json({error:'此账号的预约权限已暂停。'},403);
 const ttl=Math.min(14400,Number(result.expires_in)||3600);
 if(ttl<14340)return json({error:'认证服务尚未启用四小时登录，请联系管理员完成配置。'},503);
 return new Response(JSON.stringify({ok:true}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`club_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${ttl}`}});
 }catch(e){console.error('auth failure',e);return json({error:'登录服务暂不可用，请稍后重试。'},503);}
}
