// Expectations were written from the inspected rule specification in PLAN.md.
const scenarios = [
 ['S01','HTTPS complete headers','headers',true,'HTTPS and six protective header groups; Security Low'],
 ['S02','HTTP without TLS','transport',false,'HTTP observed; Security High'],
 ['S03','HTTPS without CSP','headers',true,'CSP absent, other headers present; Security Low'],
 ['S04','HTTPS without HSTS','headers',true,'HSTS absent, other headers present; Security Low'],
 ['S05','HTTPS without protective headers','headers',true,'All six header groups absent; Security Low'],
 ['S06','Active mixed content','mixed-content',true,'Loopback HTTP script received and executed; visible script attempt gives Security High'],
 ['S07','Browser-blocked mixed content','mixed-content',true,'Non-trustworthy HTTP script attempted; CDP blocked evidence, no server receipt; extension visibility conditional'],
 ['S08','HTTP password form','forms',false,'One explicit HTTP password action; insecurePasswordForms=1; Security High'],
 ['S09','HTTPS form with HTTP action','forms',true,'One explicit HTTP password action; insecurePasswordForms=1; Security High'],
 ['S10','Cross-site local request','network',false,'One cross-site script, unknown entity; Network engine Low'],
 ['S11','24 cross-site local requests','network',false,'24 unique cross-site scripts, unknown entity; Network engine Low'],
 ['S12','External resource and iframe','DOM',false,'One external script and one third-party iframe; Security High from HTTP'],
 ['S13','Hidden iframe','DOM',false,'One hidden iframe; hidden status informational'],
 ['S14','Canvas API','runtime',false,'Canvas export observed; Privacy Low'],
 ['S15','WebGL API','runtime',false,'WebGL hardware query observed if available; Privacy Low'],
 ['S16','Multiple sensitive APIs','runtime',false,'Canvas export and OfflineAudioContext observed; Privacy Moderate'],
 ['S17','Unavailable page inputs','availability',false,'Unsupported about:blank: all five inputs unavailable, all cards unavailable; no HTTP finding'],
 ['S18','Sequential navigation A to B','isolation',false,'A signals observed; after full navigation B has no A forms/runtime/cross-site requests']
].map(([id,name,category,tls,expectation])=>({id,name,category,tls,expectation}));
const protectiveHeaders = {
 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'",
 'Strict-Transport-Security':'max-age=31536000',
 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
 'Permissions-Policy':'camera=(), microphone=()', 'X-Frame-Options':'SAMEORIGIN'
};
function fixture(id, urls) {
 let headers = { ...protectiveHeaders }, body = '', script = '';
 if (id === 'S03') delete headers['Content-Security-Policy'];
 if (id === 'S04') delete headers['Strict-Transport-Security'];
 if (id === 'S05') headers = {};
 // Mixed fixtures omit CSP: it must not be a second cause of blocking.
 if (['S06','S07','S10','S11','S12','A'].includes(id)) headers = {};
 if (['S08','S09','A'].includes(id)) body += `<form action="${urls.http}/submit"><input type="password" autocomplete="off"></form>`;
 const resource = (host,n) => `<script src="${host}/resource/${id}/${n}.js"></script>`;
 if (id === 'S06') body += resource(urls.http,0);
 if (id === 'S07') body += resource(urls.externalHttp,0);
 if (['S10','S11','S12','A'].includes(id)) {
   for (let n=0;n<(id==='S11'?24:1);n++) body += resource(urls.externalHttp,n);
 }
 if (id === 'S12') body += `<iframe src="${urls.externalHttp}/frame/S12"></iframe>`;
 if (id === 'S13') body += '<iframe hidden src="/frame/S13"></iframe>';
 if (['S14','S16','A'].includes(id)) script += `try { document.createElement('canvas').toDataURL(); window.fixtureEvidence.canvas=true; } catch(e) { window.fixtureEvidence.canvasError=e.name; }`;
 if (id === 'S15') script += `try { const gl=document.createElement('canvas').getContext('webgl'); window.fixtureEvidence.webgl=!!gl; if(gl){const ext=gl.getExtension('WEBGL_debug_renderer_info'); window.fixtureEvidence.hardware=!!ext; if(ext) { gl.getParameter(ext.UNMASKED_RENDERER_WEBGL); window.fixtureEvidence.webglCalled=true; }} } catch(e) { window.fixtureEvidence.webglError=e.name; }`;
 if (id === 'S16') script += `try { new OfflineAudioContext(1,1,44100); window.fixtureEvidence.audio=true; } catch(e) { window.fixtureEvidence.audioError=e.name; }`;
 // External script, not unsafe-inline; served by the controlled origin itself.
 if (script) body += `<script src="/api/${id}.js"></script>`;
 return { headers, script: `window.fixtureEvidence={};${script}window.fixtureEvidence.done=true;`,
   html: `<!doctype html><html><head><title>Controlled ${id}</title><link rel="icon" href="data:,"></head><body><h1>${id}</h1>${body}</body></html>` };
}
module.exports = { scenarios, fixture };
