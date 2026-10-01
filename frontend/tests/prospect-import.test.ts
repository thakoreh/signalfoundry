import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProspectImport } from '../lib/prospect-import.ts';

test('imports CSV website column without treating company names or contacts as domains',()=>{
  assert.deepEqual(parseProspectImport('Company,Website,Email\n"LOW/CODE, Agency",https://www.lowcode.agency/,sales@example.com\nAirtable,airtable.com,\n').domains,['www.lowcode.agency','airtable.com']);
});
test('normalizes and deduplicates pasted domains and removes URL paths',()=>{
  assert.deepEqual(parseProspectImport('HTTPS://AIRTABLE.COM/about\nairtable.com\nxray.tech').domains,['airtable.com','xray.tech']);
});
test('rejects private addresses credentials active schemes and malformed input',()=>{
  const result=parseProspectImport('localhost\n127.0.0.1\nhttps://user:pass@company.com\njavascript:alert(1)\nexample.com');
  assert.deepEqual(result.domains,['example.com']); assert.equal(result.rejected,4);
});
test('rejects oversized input and unsupported CSV headers rather than silently importing',()=>{
  assert.throws(()=>parseProspectImport('x'.repeat(100001)),/100 KB/);
  assert.throws(()=>parseProspectImport('Company,Email\nAirtable,contact@example.com'),/website|domain/i);
});
test('handles BOM and escaped quotes in CSV and fails on unterminated fields',()=>{
 assert.deepEqual(parseProspectImport('\ufeffCompany,Domain\n"Company ""name""",example.com').domains,['example.com']);
 assert.throws(()=>parseProspectImport('Company,Domain\n"unfinished,example.com'),/CSV/i);
});
