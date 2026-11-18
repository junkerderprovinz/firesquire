// The way back to All clear goes to the notify helper with "recovery": true, and the helper itself
// lets it through a channel set to failures only. This runs the real helper of the ParleyPort
// release the plugin pins, named by FS_NOTIFY_HELPER, against two webhooks on this machine.
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile, execFileSync } = require('child_process');
const { DIR, ok, done } = require('./lib');

const helper = process.env.FS_NOTIFY_HELPER;
if (!helper) {
  console.log('\n  SKIP  no notify helper given in FS_NOTIFY_HELPER');
  done();
}

const HUB = path.join(DIR, 'firesquire-hub.sh').replace(/\\/g, '/');
const LIB = path.join(DIR, 'include', 'fs_notify.php').replace(/\\/g, '/');
const php = (code, input) => execFileSync('php', ['-r', code], { input: input || '', encoding: 'utf8' });
const event = (report, last) => JSON.parse(php(`require '${LIB}'; echo json_encode(fs_event(json_decode(stream_get_contents(STDIN), true), '${last}', 'en', 'tower'));`, JSON.stringify(report)));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-all-clear-'));
const T = tmp.replace(/\\/g, '/');
fs.mkdirSync(path.join(tmp, 'state'));
const heard = [];
const server = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => { heard.push(req.url); res.end('ok'); });
});

function send(e) {
  heard.length = 0;
  return new Promise((resolve) => {
    execFile('bash', ['-c', `set -u
source "${HUB}"
FORTRESS=/nonexistent; FORTRESS_DIR="${T}/fortress"; NOTIFY="${helper}"; FS_STATE="${T}/state"; FS_RUN="${T}/run"; HERE="${DIR.replace(/\\/g, '/')}"
hub_send '' '${JSON.stringify(e).replace(/'/g, "'\\''")}'`], () => resolve([...heard].sort()));
  });
}

server.listen(0, '127.0.0.1', async () => {
  const at = `http://127.0.0.1:${server.address().port}`;
  fs.writeFileSync(path.join(tmp, 'state', 'notify.json'), JSON.stringify([
    { id: 'f', kind: 'webhook', enabled: true, on: 'failure', webhook: { url: `${at}/failures` } },
    { id: 'a', kind: 'webhook', enabled: true, on: 'always', webhook: { url: `${at}/always` } },
  ]));

  console.log('\nThe way back to All clear');
  const back = event({ verdict: 'GO', checks: [] }, 'NO-GO');
  let got = await send(back);
  ok('a channel set to failures only hears it', got.includes('/failures'), got.join(' '));
  ok('and so does a channel that takes everything, once each', got.join(' ') === '/always /failures', got.join(' '));

  console.log('\nAny other good news');
  got = await send({ kind: 'check.go', severity: 'success', title: 'FireSquire on tower: All clear', body: '' });
  ok('stays off a channel set to failures only', got.join(' ') === '/always', got.join(' '));

  console.log('\nTrouble');
  got = await send(event({ verdict: 'NO-GO', checks: [{ tier: 'critical', id: 'mover', status: 'fail', key: 'mover_running', args: [] }] }, 'GO'));
  ok('reaches both', got.join(' ') === '/always /failures', got.join(' '));

  server.close();
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5 });
  done();
});
