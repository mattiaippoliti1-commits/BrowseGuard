const fs = require('node:fs');
const path = require('node:path');
function atomicJson(file, value) {
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(temp, file);
}
function redact(value) {
  if (typeof value === 'string') return value.replace(/https?:\/\/[^\s<>"']+/g, raw => {
    try { const u = new URL(raw); u.username = ''; u.password = ''; u.search = ''; u.hash = ''; return u.href; }
    catch { return '[invalid URL]'; }
  });
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, redact(v)]));
  return value;
}
function recordsIn(output) {
  return fs.readdirSync(path.join(output, 'records')).filter(f => /^[a-f0-9]{64}\.json$/.test(f)).sort();
}
module.exports = { atomicJson, redact, recordsIn };
