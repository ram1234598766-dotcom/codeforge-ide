import { parseWorkspaceRoute } from './routes';
interface Env { CODEFORGE_DB: D1Database; CODEFORGE_KV: KVNamespace; ASSETS: Fetcher; SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string; }
interface Fetcher { fetch(request: Request): Promise<Response>; }
interface KVNamespace { get(key: string): Promise<string | null>; put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>; delete(key: string): Promise<void>; }
interface D1Database { prepare(query: string): D1PreparedStatement; }
interface D1PreparedStatement { bind(...values: unknown[]): D1PreparedStatement; first<T = Record<string, unknown>>(): Promise<T | null>; all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>; run(): Promise<unknown>; }
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
async function authenticate(request: Request, env: Env): Promise<string | null> {
 const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
 if (!token || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) return null;
 const res = await fetch(env.SUPABASE_URL + '/auth/v1/user', { headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, authorization: 'Bearer ' + token } });
 if (!res.ok) return null;
 const user = await res.json() as { id?: string };
 return user.id || null;
}
async function api(request: Request, env: Env): Promise<Response> {
 const url = new URL(request.url), path = url.pathname.replace(/\/$/, '');
 if (path === '/api/health' && request.method === 'GET') {
  try { await env.CODEFORGE_DB.prepare('SELECT 1').first(); return reply({ok:true,database:'connected'}); }
  catch { return reply({ok:false,database:'unavailable'},503); }
 }
 const userId = await authenticate(request, env);
 if (!userId) return reply({error:'Authentication required'},401);
 if (path === '/api/workspaces' && request.method === 'GET') {
  const result = await env.CODEFORGE_DB.prepare('SELECT id,name,slug,description,created_at,updated_at FROM workspaces WHERE user_id=? ORDER BY updated_at DESC').bind(userId).all();
  return reply({workspaces:result.results || []});
 }
 if (path === '/api/workspaces' && request.method === 'POST') {
  let body: any; try { body = await request.json(); } catch { return reply({error:'Invalid JSON'},400); }
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 100) return reply({error:'Name must be 1–100 characters'},400);
  const id = crypto.randomUUID(), slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70) + '-' + id.slice(0,8);
  await env.CODEFORGE_DB.prepare('INSERT INTO workspaces(id,user_id,name,slug,description) VALUES(?,?,?,?,?)').bind(id,userId,name,slug,typeof body.description==='string'?body.description.slice(0,500):null).run();
  return reply({workspace:await env.CODEFORGE_DB.prepare('SELECT id,name,slug,description,created_at,updated_at FROM workspaces WHERE id=? AND user_id=?').bind(id,userId).first()},201);
 }
 const route = parseWorkspaceRoute(path);
 if (!route) return reply({error:'Not found'},404);
 const { workspaceId: id, resource } = route;
 const own = await env.CODEFORGE_DB.prepare('SELECT id FROM workspaces WHERE id=? AND user_id=?').bind(id,userId).first();
 if (!own) return reply({error:'Workspace not found'},404);
 if (!resource && request.method === 'PATCH') {
  let body:any; try { body=await request.json(); } catch { return reply({error:'Invalid JSON'},400); }
  const name=typeof body?.name==='string'?body.name.trim():'';
  if(!name || name.length>100) return reply({error:'Name must be 1–100 characters'},400);
  await env.CODEFORGE_DB.prepare("UPDATE workspaces SET name=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(name,id,userId).run();
  return reply({workspace:await env.CODEFORGE_DB.prepare('SELECT id,name,slug,description,created_at,updated_at FROM workspaces WHERE id=? AND user_id=?').bind(id,userId).first()});
 }
 if (!resource && request.method === 'DELETE') {
  await env.CODEFORGE_DB.prepare('DELETE FROM workspaces WHERE id=? AND user_id=?').bind(id,userId).run();
  await env.CODEFORGE_KV.delete('workspace-state:v1:'+userId+':'+id);
  return reply({ok:true});
 }
 const cacheKey = 'workspace-state:v1:'+userId+':'+id;
 if (resource === 'state' && request.method === 'GET') {
  const cached = await env.CODEFORGE_KV.get(cacheKey);
  if (cached !== null) return reply({state:JSON.parse(cached),cached:true});
  const row = await env.CODEFORGE_DB.prepare('SELECT state_json FROM workspace_state WHERE workspace_id=? AND user_id=?').bind(id,userId).first<{state_json:string}>();
  const state = row ? JSON.parse(row.state_json) : {};
  await env.CODEFORGE_KV.put(cacheKey,JSON.stringify(state),{expirationTtl:300});
  return reply({state,cached:false});
 }
 if (resource === 'state' && request.method === 'PUT') {
  let body:any; try { body=await request.json(); } catch { return reply({error:'Invalid JSON'},400); }
  if (!body || !Object.prototype.hasOwnProperty.call(body,'state')) return reply({error:'State is required'},400);
  const value=JSON.stringify(body.state); if(value.length>256000) return reply({error:'State too large'},413);
  await env.CODEFORGE_DB.prepare('INSERT INTO workspace_state(workspace_id,user_id,state_json) VALUES(?,?,?) ON CONFLICT(workspace_id,user_id) DO UPDATE SET state_json=excluded.state_json,updated_at=CURRENT_TIMESTAMP').bind(id,userId,value).run();
  await env.CODEFORGE_KV.put(cacheKey,value,{expirationTtl:300}); return reply({ok:true});
 }
 if (resource === 'files' && request.method === 'GET') {
  const result=await env.CODEFORGE_DB.prepare('SELECT id,path,content,language,created_at,updated_at FROM workspace_files WHERE workspace_id=? AND user_id=? ORDER BY path').bind(id,userId).all();
  return reply({files:result.results || []});
 }
 if (resource === 'files' && request.method === 'PUT') {
  let body:any; try { body=await request.json(); } catch { return reply({error:'Invalid JSON'},400); }
  const filePath=typeof body?.path==='string'?body.path.trim().replace(/^\/+/, ''):'', content=typeof body?.content==='string'?body.content:'';
  if(!filePath || filePath.length>500 || filePath.split('/').some((p:string)=>!p || p==='.' || p==='..')) return reply({error:'Invalid path'},400);
  if(content.length>1000000) return reply({error:'File too large'},413);
  await env.CODEFORGE_DB.prepare('INSERT INTO workspace_files(id,workspace_id,user_id,path,content,language) VALUES(?,?,?,?,?,?) ON CONFLICT(workspace_id,path) DO UPDATE SET content=excluded.content,language=excluded.language,updated_at=CURRENT_TIMESTAMP').bind(crypto.randomUUID(),id,userId,filePath,content,typeof body.language==='string'?body.language.slice(0,40):null).run();
  return reply({ok:true,path:filePath});
 }
 return reply({error:'Method not allowed'},405);
}
export default { async fetch(request: Request, env: Env): Promise<Response> {
 if (new URL(request.url).pathname.startsWith('/api/')) { try { return await api(request,env); } catch (err) { console.error(err); return reply({error:'Internal server error'},500); } }
 return env.ASSETS.fetch(request);
}};
