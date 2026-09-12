import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../output/avatar/head-v2/',import.meta.url),stateFile=new URL('retexture-task.json',dir);
const key=process.env.MESHY_API_KEY?.trim();if(!key)throw Error('MESHY_API_KEY missing');
const endpoint='https://api.meshy.ai/openapi/v1/retexture';
const api=async(url,body)=>{const r=await fetch(url,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Meshy HTTP ${r.status}; not retried`);return r.json();};
let state;try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const command=process.argv[2];
if(command==='submit'){
 if(state)throw Error('Existing retexture task; use status/download.');
 const model=await readFile(new URL('head-geometry.glb',dir)),image=await readFile(new URL('clean-face.png',dir));
 const parameters={ai_model:'meshy-7',enable_original_uv:false,enable_pbr:true,texture_resolution:'4k',target_formats:['glb']};
 state={status:'SUBMITTING',parameters};await writeFile(stateFile,JSON.stringify(state,null,2),{flag:'wx'});
 const task=await api(endpoint,{...parameters,model_url:`data:application/octet-stream;base64,${model.toString('base64')}`,image_style_url:`data:image/png;base64,${image.toString('base64')}`});
 if(!/^[a-zA-Z0-9-]+$/.test(task.result||''))throw Error('Unconfirmed submission; reconcile before retry');
 state.id=task.result;state.status='PENDING';await writeFile(stateFile,JSON.stringify(state,null,2));console.log('Head texture task submitted:',state.id);
}else if(command==='status'||command==='download'){
 if(!state?.id)throw Error('No task');const task=await api(`${endpoint}/${state.id}`);
 state={...state,status:task.status,progress:task.progress,consumedCredits:task.consumed_credits};await writeFile(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify({status:task.status,progress:task.progress,consumedCredits:task.consumed_credits}));
 if(command==='download'){
  if(task.status!=='SUCCEEDED')throw Error('Not ready');
  for(const [url,name] of [[task.model_urls.glb,'head-clean.glb'],[task.thumbnail_url,'head-clean-preview.png']]){
   if(!url)continue;if(new URL(url).protocol!=='https:')throw Error('HTTPS required');const r=await fetch(url,{signal:AbortSignal.timeout(120000)});if(!r.ok)throw Error(`Download HTTP ${r.status}`);const bytes=Buffer.from(await r.arrayBuffer());if(name.endsWith('.glb')&&bytes.toString('ascii',0,4)!=='glTF')throw Error('Invalid GLB');await writeFile(new URL(name,dir),bytes);console.log('Saved',name,bytes.length);
  }
 }
}else throw Error('Use submit|status|download');
