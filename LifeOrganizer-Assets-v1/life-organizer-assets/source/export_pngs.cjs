/* Deterministic SVG raster export; set NODE_PATH to a directory containing sharp. */
const fs=require('fs'),path=require('path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'..');
function write(rel,data){const p=path.join(root,rel);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,data);return p;}
async function render(rel,width,height,output,fit='contain'){
 let s=sharp(path.join(root,rel),{density:300}).resize({width,height,fit,background:{r:0,g:0,b:0,alpha:0}}).png();
 write(output,await s.toBuffer());
}
function masterSvg(color,white=false){const g=JSON.parse(fs.readFileSync(root+'/source/brand-geometry.json','utf8'));const w=600,x=(2732-w)/2,y=(2732-552)/2;return '<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732"><rect width="2732" height="2732" fill="'+color+'"/><g transform="translate('+x+' '+y+')"><path fill="'+(white?'#FFFFFF':g.colors.rose)+'" d="'+g.leftPath+'"/><path fill="'+(white?'#FFFFFF':g.colors.gold)+'" d="'+g.rightPath+'"/></g></svg>';}
(async()=>{
 for(const variant of ['color','plum','white']){
  for(const n of [512,1024,2048])await render('brand/mark-'+variant+'.svg',n,n,'png/mark-'+variant+'-'+n+'.png');
 }
 await render('brand/logo-stacked-color.svg',2400,2240,'png/logo-stacked-color-2400.png');
 await render('brand/logo-stacked-plum.svg',2400,2240,'png/logo-stacked-plum-2400.png');
 await render('brand/logo-stacked-white.svg',2400,2240,'png/logo-stacked-white-2400.png');
 await render('brand/logo-horizontal-color.svg',3000,760,'png/logo-horizontal-color-3000.png');
 await render('brand/logo-horizontal-white.svg',3000,760,'png/logo-horizontal-white-3000.png');
 await render('brand/splash-icon.svg',864,864,'png/splash-icon-864.png');
 await render('brand/splash-icon-white.svg',864,864,'png/splash-icon-white-864.png');
 await render('brand/wordmark-plum.svg',2400,undefined,'png/wordmark-plum-2400.png');
 await render('brand/wordmark-white.svg',2400,undefined,'png/wordmark-white-2400.png');
 await render('brand/app-icon-square.svg',1024,1024,'capacitor-source/icon-only.png');
 await render('brand/adaptive-foreground.svg',1024,1024,'capacitor-source/icon-foreground.png');
 await render('brand/adaptive-background.svg',1024,1024,'capacitor-source/icon-background.png');
 for(const [name,color,white] of [['light','#F8F6F3',false],['dark','#34102E',true]]){
  const data=masterSvg(color,white);write('source/splash-'+name+'-master.svg',data);
  write('capacitor-source/splash'+(white?'-dark':'')+'.png',await sharp(Buffer.from(data)).png().toBuffer());
 }
 // Browser favicon and PWA references; no service worker or app manifest is added.
 for(const n of [16,32,48])await render('brand/app-icon-square.svg',n,n,'web/favicon-'+n+'.png');
 fs.copyFileSync(root+'/brand/app-icon-square.svg',root+'/web/favicon.svg');
 for(const n of [192,512]){
  await render('brand/app-icon-square.svg',n,n,'web/icon-'+n+'.png');
  await render('brand/pwa-maskable.svg',n,n,'web/icon-maskable-'+n+'.png');
 }
 for(const name of ['notes','memories','gym','shopping','calendar','little-plans'])await render('chapters/'+name+'-color.svg',128,128,'png/chapter-'+name+'-128.png');
 for(const name of ['notes','memories','gym'])await render('empty-states/'+name+'.svg',768,576,'png/empty-'+name+'-768.png');
 // Legacy launchers: 48dp density scale. These are fallbacks, not adaptive foreground layers.
 for(const [density,n] of [['mdpi',48],['hdpi',72],['xhdpi',96],['xxhdpi',144],['xxxhdpi',192]]){
  await render('brand/app-icon-square.svg',n,n,'android-res/mipmap-'+density+'/lo_launcher.png');
  const img=await sharp(root+'/android-res/mipmap-'+density+'/lo_launcher.png').ensureAlpha().toBuffer();
  const mask=Buffer.from('<svg width="'+n+'" height="'+n+'"><circle cx="'+n/2+'" cy="'+n/2+'" r="'+n/2+'" fill="white"/></svg>');
  write('android-res/mipmap-'+density+'/lo_launcher_round.png',await sharp(img).composite([{input:mask,blend:'dest-in'}]).png().toBuffer());
 }
 // Notification files are all-white alpha glyphs at the usual 24dp density sizes.
 for(const [density,n] of [['mdpi',24],['hdpi',36],['xhdpi',48],['xxhdpi',72],['xxxhdpi',96]])await render('brand/notification-white.svg',n,n,'android-res/drawable-'+density+'/lo_notification.png');
 // Previews ONLY: illustrate launcher masks. Adaptive resources remain unmasked.
 const combined=await sharp(root+'/capacitor-source/icon-background.png').composite([{input:root+'/capacitor-source/icon-foreground.png'}]).png().toBuffer();
 const crop=await sharp(combined).extract({left:171,top:171,width:682,height:682}).resize(512,512).png().toBuffer();
 for(const shape of ['circle','rounded']){
  const mask=Buffer.from('<svg width="512" height="512">'+(shape==='circle'?'<circle cx="256" cy="256" r="256" fill="white"/>':'<rect width="512" height="512" rx="112" fill="white"/>')+'</svg>');
  write('previews/launcher-'+shape+'.png',await sharp(crop).composite([{input:mask,blend:'dest-in'}]).png().toBuffer());
 }
 const files=[];function walk(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())walk(p);else if(/\.(svg|png|xml)$/.test(f.name))files.push(p);}}walk(root);
 const manifest=[];for(const p of files){const rel=path.relative(root,p).replaceAll(path.sep,'/');let metadata={};if(p.endsWith('.png')){const m=await sharp(p).metadata();metadata={width:m.width,height:m.height,hasAlpha:m.hasAlpha};}manifest.push({file:rel,bytes:fs.statSync(p).size,...metadata});}
 write('ASSET-MANIFEST.json',JSON.stringify({version:'1.0',created:'2026-10-13',app:'Life Organizer',assets:manifest},null,2));
 console.log('Exported',manifest.length,'SVG, PNG and XML assets.');
})().catch(e=>{console.error(e);process.exit(1)});
