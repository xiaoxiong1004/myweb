import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
process.chdir(root);
const entry=fs.readFileSync('index.html','utf8');
for(const ref of [...entry.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1].split('?')[0])) assert(fs.existsSync(ref),'Missing entry resource: '+ref);
for(const file of ['app.js','fabric.js','media.js','review.js']) new vm.Script(fs.readFileSync(file,'utf8'),{filename:file});
const context={window:{}};vm.runInNewContext(fs.readFileSync('media.js','utf8'),context);
const hashes=JSON.parse(fs.readFileSync('asset-hashes.json','utf8'));
for(const src of Object.values(context.window.MEDIA)){
 assert(!/^(?:https?:|file:|[A-Za-z]:)/.test(src),'Asset must be relative: '+src);
 const data=fs.readFileSync(src);assert.equal(crypto.createHash('sha256').update(data).digest('hex'),hashes[src],'Changed image: '+src);
 assert(data.length<25*1024*1024,'Image exceeds GitHub browser upload size: '+src);
}
for(const file of ['app.js','fabric.js','style.css'])assert(!/localhost|127\.0\.0\.1|file:\/\//.test(fs.readFileSync(file,'utf8')),'Local-only resource in '+file);
fs.mkdirSync('dist',{recursive:true});
for(const file of ['index.html','style.css','app.js','fabric.js','media.js','review.js'])fs.copyFileSync(file,path.join('dist',file));
for(const dir of ['assets','vendor'])fs.cpSync(dir,path.join('dist',dir),{recursive:true});
console.log('Build passed: scripts valid; entry paths valid; '+Object.keys(hashes).length+' images verified byte-for-byte. Static output: dist/');
