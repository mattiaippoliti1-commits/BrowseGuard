const {test}=require('node:test');
const {cases,runCase}=require('./engine-cases.cjs');
for(const c of cases)test(c.name,()=>runCase(c));
