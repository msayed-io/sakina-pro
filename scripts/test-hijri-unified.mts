import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fromCivilDay, localCivilDay, toCivilDay, hijriForDate, upcomingHijriOccasions, formatDaysRemaining, getHijriOffset, setHijriOffset, subscribeHijriOffset, type HijriOffset } from '../src/services/hijri-calendar';
process.env.TZ='Africa/Cairo';
const fixture=JSON.parse(fs.readFileSync(new URL('./hijri-kacst-fixture.json',import.meta.url),'utf8'));
const all=(Object.values(fixture.years) as {h:string,g:string}[][]).flat(), byG=new Map(all.map(x=>[x.g,x.h]));
const date = (iso:string) => { const [y,m,d]=iso.split('-').map(Number); return new Date(y,m-1,d,12); };
let checked=0, officialComparisons=0;
for(const record of all) for(const offset of [-2,-1,0,1,2] as HijriOffset[]){
 const now=date(record.g), civil=localCivilDay(now), shifted=new Date((civil+offset)*86400000).toISOString().slice(0,10), expected=byG.get(shifted);
 if(expected) { officialComparisons++; const h=hijriForDate(now,offset); assert(h); assert.equal(`${h.year}-${String(h.month).padStart(2,'0')}-${String(h.day).padStart(2,'0')}`,expected); }
 const snapshot=upcomingHijriOccasions(now,offset);assert.deepEqual(snapshot.today,hijriForDate(now,offset));assert(snapshot.today);
 for(const e of snapshot.upcoming){assert.equal(e.year,snapshot.today.year);assert(e.days>=0);assert.equal(e.days,e.civil-civil);assert.deepEqual(fromCivilDay(e.civil+offset),{year:e.year,month:e.month,day:e.day});assert.equal(toCivilDay({year:e.year,month:e.month,day:e.day}),e.civil+offset)}
 assert(snapshot.upcoming.every((e,i,a)=>i===0||a[i-1].civil<=e.civil));checked++;
}
assert.deepEqual(upcomingHijriOccasions(date('2027-05-17'),0).upcoming,[]);
assert.deepEqual(hijriForDate(date('2027-06-04'),2),{year:1449,month:1,day:1});
assert.deepEqual(hijriForDate(date('2027-06-06'),-2),{year:1448,month:12,day:29});
assert.equal(upcomingHijriOccasions(date('2027-06-04'),2).upcoming[0].days,0);
assert.equal(localCivilDay(date('2027-04-30'))-localCivilDay(date('2027-04-29')),1);
process.env.TZ='America/New_York';
assert.equal(localCivilDay(date('2027-03-15'))-localCivilDay(date('2027-03-14')),1);
assert.equal(localCivilDay(date('2027-11-08'))-localCivilDay(date('2027-11-07')),1);
process.env.TZ='Africa/Cairo';
assert.deepEqual([0,1,2,3,10,11,86].map(formatDaysRemaining),['اليوم','غداً','بعد غد','بعد ٣ أيام','بعد ١٠ أيام','بعد ١١ يوماً','بعد ٨٦ يوماً']);
for(const bad of [-3,3,1.5,NaN])assert.throws(()=>setHijriOffset(bad),RangeError);
let changes=0;const unsubscribe=subscribeHijriOffset(()=>changes++);for(const x of [1,2,-2,-1,0] as HijriOffset[]){setHijriOffset(x);assert.equal(getHijriOffset(),x)}assert.equal(changes,5);unsubscribe();setHijriOffset(1);assert.equal(changes,5);setHijriOffset(0);
console.log(`${checked} offset combinations, ${officialComparisons} official-date comparisons, current-year filtering, day differences, year boundary, DST, formatting and offset notifications: PASS`);
