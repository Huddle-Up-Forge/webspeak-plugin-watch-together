import {readFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),settings=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const output=path.resolve(root,settings.webspeakPlugin.packagePath);if(!output.startsWith(root+path.sep))throw new Error('Invalid package output');await mkdir(path.dirname(output),{recursive:true});execFileSync(process.execPath,[path.join(root,'scripts/build.mjs'),root,output],{stdio:'inherit'});
