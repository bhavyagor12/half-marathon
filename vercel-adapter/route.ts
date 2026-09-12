/** Vercel serves the application; the existing Sites Worker retains D1/R2 and payment authority. */
const BACKEND='https://slow-club-bhavya.bhavya-gor.chatgpt.site';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
async function proxy(req:Request,{params}:{params:Promise<{path:string[]}>}){
 const {path}=await params;
 const route=path.join('/');
 const allowed=req.method==='GET'?['sponsors','order'].includes(route)||/^logo\/[a-f0-9-]{36}$/.test(route):['checkout','branding','webhooks/dodo'].includes(route);
 if(!allowed)return Response.json({error:'Not found.'},{status:404});
 if(req.method==='POST'&&route!=='webhooks/dodo'&&req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid origin.'},{status:403});
 const headers=new Headers();
 for(const key of ['authorization','content-type','webhook-id','webhook-signature','webhook-timestamp']){const value=req.headers.get(key);if(value)headers.set(key,value);}
 if(req.method==='POST'&&route!=='webhooks/dodo')headers.set('origin',BACKEND);
 let body:Uint8Array|undefined;
 if(req.method==='POST'){
  const max=route==='branding'?2*1024*1024:route==='webhooks/dodo'?256000:6000;
  const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader)while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>max){await reader.cancel();return Response.json({error:'Request too large.'},{status:413});}chunks.push(part.value);}
  body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.length;}
 }
 try{
  const upstream=await fetch(`${BACKEND}/api/${route}`,{method:req.method,headers,body:body as BodyInit|undefined,redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(upstream.status>=300&&upstream.status<400)return Response.json({error:'Sponsorship service is temporarily unavailable.'},{status:503});
  const responseHeaders=new Headers({'X-Content-Type-Options':'nosniff'});
  for(const key of ['content-type','cache-control','content-security-policy']){const value=upstream.headers.get(key);if(value)responseHeaders.set(key,value);}
  return new Response(upstream.body,{status:upstream.status,headers:responseHeaders});
 }catch{return Response.json({error:'Sponsorship service is temporarily unavailable. Please try again.'},{status:503});}
}
export const GET=proxy;
export const POST=proxy;
