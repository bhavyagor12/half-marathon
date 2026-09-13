import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const stage=new URL('../.vercel-next/',import.meta.url);
await rm(stage,{recursive:true,force:true});
await mkdir(new URL('lib/',stage),{recursive:true});
// Stage only the Next.js app: UI plus the Supabase-backed API routes. Legacy Cloudflare Worker/Sites files stay out of the build.
await cp(new URL('../app/',import.meta.url),new URL('app/',stage),{recursive:true,filter:source=>!source.endsWith('chatgpt-auth.ts')});
for(const file of ['config.ts','avatar.mjs','server.ts','refunds.ts','refund-math.ts','wallet.ts','stats.ts'])await cp(new URL(`../lib/${file}`,import.meta.url),new URL(`lib/${file}`,stage));
await cp(new URL('../public/',import.meta.url),new URL('public/',stage),{recursive:true});
await cp(new URL('../postcss.config.mjs',import.meta.url),new URL('postcss.config.mjs',stage));
await writeFile(new URL('package.json',stage),JSON.stringify({name:'slow-club-vercel',private:true,type:'module'}));
await writeFile(new URL('tsconfig.json',stage),JSON.stringify({compilerOptions:{allowJs:true,target:'ES2017',lib:['dom','dom.iterable','esnext'],strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,module:'esnext',moduleResolution:'bundler',resolveJsonModule:true,isolatedModules:true,jsx:'react-jsx',plugins:[{name:'next'}],paths:{'@/*':['./*']}},include:['next-env.d.ts','**/*.ts','**/*.tsx','.next/types/**/*.ts'],exclude:['node_modules']}));
await writeFile(new URL('next.config.mjs',stage),`import path from 'node:path';\nexport default {outputFileTracingRoot:path.resolve(process.cwd()),async redirects(){return [{source:'/:path*',has:[{type:'host',value:'www.sponsormyslowrun.com'}],destination:'https://sponsormyslowrun.com/:path*',permanent:true}]},async headers(){return [{source:'/(.*)',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},{key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=()'}]}]}};\n`);
const result=spawnSync(process.execPath,['node_modules/next/dist/bin/next','build','.vercel-next','--webpack'],{stdio:'inherit',env:process.env});
process.exit(result.status??1);
