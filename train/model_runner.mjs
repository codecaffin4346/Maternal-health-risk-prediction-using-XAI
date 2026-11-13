// Evaluate the actual shipped prediction function; expose its trees for independent parity checks.
import {readFileSync} from 'node:fs';
const source = readFileSync(process.argv[2] || new URL('../js/model.js',import.meta.url),'utf8');
const model = await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport { TREES as auditTrees };').toString('base64'));
const chunks=[];
for await(const chunk of process.stdin) chunks.push(chunk);
const request=JSON.parse(Buffer.concat(chunks).toString('utf8'));
if(!Array.isArray(request.inputs)) throw new Error('inputs must be an array');
for(const input of request.inputs) if(input.length!==6 || !input.every(Number.isFinite)) throw new Error('Six finite measurements required');
process.stdout.write(JSON.stringify({
 predictions:request.inputs.map(input=> {const result=model.predict(input); return {riskClass:result.riskClass,probs:result.probs};}),
 ranges:model.FEATURE_RANGES,stats:model.DATASET_STATS,
 trees:request.includeTrees ? model.auditTrees : undefined,
}));
