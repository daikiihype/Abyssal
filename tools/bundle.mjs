// Gera dist/abyssal.html: o jogo inteiro em UM arquivo (JS + sprites + sons embutidos). Sem dependencias.
// Uso: node tools/bundle.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
const mods = {};
const order = [];
function load(name) {
  if (mods[name]) return;
  let src = fs.readFileSync(path.join(www, 'js', name + '.js'), 'utf8');
  mods[name] = { deps: [] };
  src = src.replace(/import\s*(\{[^}]*\}|\*\s*as\s+\w+)\s*from\s*'\.\/(\w+)\.js';?/g, (m, what, dep) => {
    load(dep);
    mods[name].deps.push(dep);
    if (what.startsWith('*')) return `const ${what.replace(/\*\s*as\s+/, '').trim()} = __m_${dep};`;
    const inner = what.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/\s+as\s+/, ': ')).join(', ');
    return `const { ${inner} } = __m_${dep};`;
  });
  const names = [];
  src = src.replace(/export\s+(?:async\s+)?(?:function|const|let|class)\s+(\w+)/g, (m, n) => { names.push(n); return m.replace(/^export\s+/, ''); });
  src = src.replace(/export\s*\{([^}]*)\};?/g, (m, list) => { list.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => { const [a, b] = s.split(/\s+as\s+/); names.push(b ? `${b}: ${a}` : a); }); return ''; });
  mods[name].code = `const __m_${name} = (() => {\n${src}\nreturn { ${[...new Set(names)].join(', ')} };\n})();`;
  order.push(name);
}
load('main');
let js = order.map((n) => mods[n].code).join('\n');
js = js.replace('img.src = src;', 'img.src = (window.__ASSETS && window.__ASSETS[src]) || src;');

const assets = {};
const add = (rel, mime) => { assets[rel] = `data:${mime};base64,` + fs.readFileSync(path.join(www, rel)).toString('base64'); };
for (const f of fs.readdirSync(path.join(www, 'assets/sprites'))) add('assets/sprites/' + f, f.endsWith('.json') ? 'application/json' : 'image/png');
for (const f of fs.readdirSync(path.join(www, 'assets/audio'))) add('assets/audio/' + f, 'audio/wav');

const shim = `window.__ASSETS = ${JSON.stringify(assets)};
(function () {
  const real = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function (u, o) {
    const d = window.__ASSETS[u];
    if (d) {
      const b64 = d.slice(d.indexOf(',') + 1), bin = atob(b64), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return Promise.resolve(new Response(arr, { status: 200 }));
    }
    return real ? real(u, o) : Promise.reject(new Error('fetch indisponivel'));
  };
})();`;

const html = `<title>ABYSSAL</title>
<style>
  :root { --bg: #04101f; --fg: #d9ecff; color-scheme: dark; }
  html, body { height: 100%; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--fg); display: flex; align-items: center; justify-content: center;
    overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; overscroll-behavior: none; }
  #game { image-rendering: pixelated; image-rendering: crisp-edges; display: block; touch-action: none; background: var(--bg); }
  #fatal { position: fixed; inset: 0; background: var(--bg); color: #ff8a7a; font: 13px monospace; padding: 16px; white-space: pre-wrap; }
</style>
<canvas id="game" width="480" height="270" aria-label="ABYSSAL"></canvas>
<div id="fatal" hidden></div>
<script>
${shim}
</script>
<script>
(function () {
${js}
})();
</script>
`;
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'abyssal.html'), html);
console.log('dist/abyssal.html', (html.length / 1024).toFixed(0) + ' KB');
