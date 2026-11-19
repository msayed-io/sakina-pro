import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fromCivilDay, toCivilDay, OCCASIONS } from '../src/services/hijri-calendar';
import { MONTH_START_RJD } from '../src/features/hijri-month/month-starts';
const official=JSON.parse(fs.readFileSync(new URL('./hijri-kacst-fixture.json',import.meta.url),'utf8'));
let count=0;
for(const records of Object.values(official.years) as {h:string,g:string}[][]) for(const row of records){
 const [year,month,day]=row.h.split('-').map(Number), civil=toCivilDay({year,month,day});
 assert.notEqual(civil,null);assert.equal(new Date(civil!*86400000).toISOString().slice(0,10),row.g);assert.deepEqual(fromCivilDay(civil!),{year,month,day});count++;
}
for(let civil=MONTH_START_RJD[0]-40588;civil<MONTH_START_RJD.at(-1)!-40588;civil++){const hijri=fromCivilDay(civil);assert(hijri);assert.equal(toCivilDay(hijri),civil)}
assert.equal(fromCivilDay(MONTH_START_RJD[0]-40589),null);assert.equal(fromCivilDay(MONTH_START_RJD.at(-1)!-40588),null);
assert.equal(toCivilDay({year:1448,month:13,day:1}),null);assert.equal(toCivilDay({year:1448,month:9,day:30}),null);assert.equal(OCCASIONS.length,10);
console.log(`${count} official KACST daily dates PASS; full table daily round-trip PASS; range and invalid dates PASS`);
