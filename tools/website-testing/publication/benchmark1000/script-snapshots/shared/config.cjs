const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const defaults = {
  urlsFile: 'websites.txt', output: 'runs/poc', limit: 10, concurrency: 1,
  navigationTimeoutMs: 25000, analysisTimeoutMs: 15000,
  minObserveMs: 3000, quietMs: 1000, maxObserveMs: 10000,
  delayMs: 2000, maxRequests: 5000, headless: true, recycleEvery: 25
};
function readUrls(file, limit) {
  const seen = new Set();
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
      throw Error('Only credential-free HTTP/HTTPS URLs are accepted: ' + raw);
    url.hash = ''; seen.add(url.href);
  }
  const urls = [...seen];
  if (urls.length < limit) throw Error(`Requested ${limit} unique URLs, but only ${urls.length} were supplied. No recycling or invented URLs.`);
  return urls.slice(0, limit);
}
function configFromArgs(args) {
  let configFile; const overrides = {}; let resume = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--resume') { resume = true; continue; }
    if (arg === '--headed') { overrides.headless = false; continue; }
    const key = { '--config': 'config', '--urls': 'urlsFile', '--output': 'output', '--limit': 'limit', '--concurrency': 'concurrency' }[arg];
    if (!key || !args[i + 1]) throw Error('Unknown or incomplete option: ' + arg);
    const value = args[++i];
    if (key === 'config') configFile = path.resolve(value);
    else overrides[key] = ['limit', 'concurrency'].includes(key) ? Number(value) : value;
  }
  const supplied = configFile ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
  for (const key of Object.keys(supplied)) if (!(key in defaults)) throw Error('Unknown configuration key: ' + key);
  const c = { ...defaults, ...supplied, ...overrides };
  for (const key of Object.keys(defaults).filter(k => typeof defaults[k] === 'number')) {
    if (!Number.isSafeInteger(c[key]) || c[key] < 1) throw Error(key + ' must be a positive integer');
  }
  if (typeof c.headless !== 'boolean') throw Error('headless must be boolean');
  if (c.minObserveMs > c.maxObserveMs) throw Error('minObserveMs must be <= maxObserveMs');
  c.urlsFile = path.resolve(c.urlsFile); c.output = path.resolve(c.output);
  const urls = readUrls(c.urlsFile, c.limit);
  const signature = crypto.createHash('sha256').update(JSON.stringify({ config: c, urls })).digest('hex');
  return { config: c, urls, signature, resume };
}
const idFor = url => crypto.createHash('sha256').update(url).digest('hex');
module.exports = { defaults, readUrls, configFromArgs, idFor };
