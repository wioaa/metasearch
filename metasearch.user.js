// ==UserScript==
// @name         聚合搜索 MetaSearch
// @name:en      MetaSearch - Quick Engine Switcher
// @namespace    https://github.com/wioaa/metasearch
// @version      2.1.1
// @description  自动读取当前页面的搜索词（搜索框内容 / URL 参数），一键换成别的搜索引擎；竖栏可拖拽、靠边吸附、位置与宽度都可调
// @description:en Grab the query already typed on the page and re-run it on another engine. A draggable side rail that snaps to edges.
// @author       wioaa
// @license      MIT
// @match        *://*/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @run-at       document-end
// @noframes
// @homepageURL  https://github.com/wioaa/metasearch
// @supportURL   https://github.com/wioaa/metasearch/issues
// ==/UserScript==

(() => {
  'use strict';
  if (window.top !== window.self) return;

  /* ================= 配置 ================= */
  const KEY = 'metasearch:cfg';
  const DEFAULTS = {
    hotkey: 'alt+s',
    openNew: false,   // false = 本窗口刷新切换，true = 新标签页打开
    w: 172,           // 竖栏宽度 px
    // 位置：m = left | right | bottom | free；x / y 是 0~1 的比例，换分辨率也不跑偏
    pos: { m: 'right', x: 0.5, y: 0.5 },
    engines: [        // %s 就是搜索词；数组顺序 = 竖栏顺序
      { name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
      { name: 'Bing', url: 'https://www.bing.com/search?q=%s' },
      { name: 'Google', url: 'https://www.google.com/search?q=%s' },
      { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
      { name: '知乎', url: 'https://www.zhihu.com/search?type=content&q=%s' },
      { name: 'B站', url: 'https://search.bilibili.com/all?keyword=%s' },
      { name: 'GitHub', url: 'https://github.com/search?q=%s' },
      { name: '维基', url: 'https://zh.wikipedia.org/w/index.php?search=%s' },
    ],
  };

  /* ================= 存储 ================= */
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  let fresh = false;

  function load() {
    let raw = '';
    try { raw = hasGM ? GM_getValue(KEY, '') : localStorage.getItem(KEY) || ''; } catch (e) {}
    fresh = !raw;
    let got = {};
    try { got = raw ? JSON.parse(raw) : {}; } catch (e) {}
    const cfg = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), got);
    cfg.engines = (Array.isArray(cfg.engines) ? cfg.engines : [])
      .map(e => ({ name: String(e.name || ''), url: String(e.url || '') }))
      .filter(e => e.name && e.url);
    if (!cfg.engines.length) cfg.engines = DEFAULTS.engines.slice();
    if (!cfg.hotkey) cfg.hotkey = DEFAULTS.hotkey;
    cfg.openNew = !!cfg.openNew;
    cfg.w = Math.min(420, Math.max(120, Number(cfg.w) || 172));
    const m = ['left', 'right', 'bottom', 'free'].includes(cfg.pos && cfg.pos.m) ? cfg.pos.m : 'right';
    cfg.pos = {
      m,
      x: Math.min(1, Math.max(0, Number(cfg.pos && cfg.pos.x) || 0.5)),
      y: Math.min(1, Math.max(0, Number(cfg.pos && cfg.pos.y) || 0.5)),
    };
    return cfg;
  }

  function save(c) {
    const s = JSON.stringify(c);
    try { hasGM ? GM_setValue(KEY, s) : localStorage.setItem(KEY, s); } catch (e) {}
  }

  /* ================= 样式 ================= */
  const CSS = `
:host{all:initial}
*,*::before,*::after{box-sizing:border-box}
.rail{position:fixed;left:0;top:0;z-index:2147483647;display:none;flex-direction:column;width:172px;max-height:86vh;padding:8px;background:rgba(20,23,29,.94);backdrop-filter:blur(12px);border:1px solid #2e3340;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.4);font:13px/1.4 -apple-system,"Segoe UI",system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#e6e8eb;touch-action:none;cursor:grab}
.rail.on{display:flex}
.rail.drag{cursor:grabbing;user-select:none}
.rail.snap{transition:left .18s cubic-bezier(.2,.85,.3,1),top .18s cubic-bezier(.2,.85,.3,1)}
.grip{position:absolute;top:0;bottom:0;left:-1px;width:8px;cursor:ew-resize;border-radius:12px 0 0 12px;z-index:2}
.rail.dock-left .grip{left:auto;right:-1px;border-radius:0 12px 12px 0}
.grip::after{content:'';position:absolute;top:50%;left:2px;width:2px;height:34px;margin-top:-17px;background:#4a5462;border-radius:2px;opacity:0;transition:opacity .15s}
.rail.dock-left .grip::after{left:auto;right:2px}
.rail:hover .grip::after,.rail.drag .grip::after{opacity:1}
.q{font-size:11.5px;line-height:1.5;color:#8b929c;padding:1px 4px 7px;margin-bottom:7px;border-bottom:1px solid #262b34;max-height:2.9em;overflow:hidden;word-break:break-word}
.q b{color:#fff;font-weight:600}
.list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;margin:0 -2px;padding:0 2px}
.list::-webkit-scrollbar{width:5px}
.list::-webkit-scrollbar-thumb{background:#39404c;border-radius:3px}
.eng{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;color:#dfe3e9;text-decoration:none;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-weight:400;border:1px solid transparent}
.eng:hover{background:#2b323d;border-color:#3b4350;color:#fff}
.eng.cur{opacity:.4;cursor:default;background:transparent;border-color:transparent}
.eng.cur:hover{background:transparent;border-color:transparent;color:#dfe3e9}
.dot{width:6px;height:6px;border-radius:50%;flex:none}
.foot{display:flex;align-items:center;gap:3px;margin-top:7px;padding-top:7px;border-top:1px solid #262b34}
.mode{flex:1;height:24px;padding:0 6px;border-radius:7px;border:1px solid #333a45;background:#1d222a;color:#9aa1ab;cursor:pointer;font-size:11.5px;line-height:1;font-family:inherit}
.mode:hover{background:#2a313c;border-color:#4a5462;color:#fff}
.ic{width:24px;height:24px;flex:none;border:0;border-radius:7px;background:transparent;color:#8b929c;cursor:pointer;font-size:13px;line-height:1;padding:0;font-family:inherit}
.ic:hover{background:#2a313c;color:#fff}
.panel{position:fixed;left:0;top:0;z-index:2147483647;display:none;width:min(400px,calc(100vw - 24px));background:#15171c;border:1px solid #2a2e36;border-radius:13px;padding:13px;box-shadow:0 18px 50px rgba(0,0,0,.55);font:13px/1.6 -apple-system,"Segoe UI",system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#e6e8eb}
.panel.on{display:block}
.lbl{font-size:12px;color:#8b929c;margin:0 0 7px}
.panel textarea{width:100%;height:168px;resize:vertical;background:#0f1115;border:1px solid #2a2e36;border-radius:8px;color:#e6e8eb;padding:8px 10px;font:12px/1.7 ui-monospace,SFMono-Regular,monospace;outline:0}
.panel textarea:focus{border-color:#4c8dff}
.row{display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap}
#hk{width:126px;background:#0f1115;border:1px solid #2a2e36;border-radius:8px;color:#cfd6df;padding:5px 9px;font:12px ui-monospace,monospace;outline:0;cursor:pointer}
#wr{flex:1;min-width:0;margin:0;height:16px;accent-color:#2f6bff;cursor:pointer}
#wv{color:#dfe3e9;font-variant-numeric:tabular-nums}
.sp{flex:1}
.btn{border:1px solid #2f343d;background:#1b1f26;color:#dfe3e9;border-radius:8px;padding:5px 14px;font-size:12.5px;cursor:pointer;font-family:inherit}
.btn:hover{background:#242832}
.btn.sm{padding:4px 11px;font-size:12px}
.btn.on{background:#2f6bff;border-color:#2f6bff;color:#fff}
.btn.pri{background:#2f6bff;border-color:#2f6bff;color:#fff}
.btn.pri:hover{background:#4179ff}
.tip{font-size:11.5px;color:#6b7280;margin-top:8px;line-height:1.7}
.toast{position:fixed;left:50%;bottom:22px;transform:translate(-50%,8px);z-index:2147483647;background:#242832;border:1px solid #363c47;color:#e6e8eb;padding:7px 14px;border-radius:999px;font-size:12.5px;opacity:0;transition:.22s;pointer-events:none;font-family:-apple-system,"PingFang SC",sans-serif}
.toast.on{opacity:1;transform:translate(-50%,0)}
@media (max-width:640px){.rail{width:152px}}
`;

  const HTML = `
<div class="rail" id="bar">
  <div class="grip" data-grip title="拖动调整宽度"></div>
  <div class="q" id="q"></div>
  <div class="list" id="engs"></div>
  <div class="foot">
    <button class="mode" data-a="mode" title="点击切换：本页刷新 / 新标签打开">本页</button>
    <button class="ic" data-a="flip" title="翻到另一边">⇄</button>
    <button class="ic" data-a="set" title="设置">⚙</button>
    <button class="ic" data-a="hide" title="收起（Alt+S 再唤出）">✕</button>
  </div>
</div>
<div class="panel" id="panel">
  <div class="lbl">位置</div>
  <div class="row" id="posRow">
    <button class="btn sm" data-a="pos" data-m="left">贴左</button>
    <button class="btn sm" data-a="pos" data-m="right">贴右</button>
    <button class="btn sm" data-a="pos" data-m="bottom">贴底</button>
    <button class="btn sm" data-a="pos" data-m="free">自由</button>
  </div>
  <div class="lbl" style="margin-top:12px">宽度 <span id="wv">172px</span>（也可以直接拖竖栏内侧边沿）</div>
  <div class="row" style="margin-top:0"><input type="range" id="wr" min="120" max="420" step="10"></div>
  <div class="lbl" style="margin-top:12px">每行一个引擎：<b>名称 | URL</b>（%s = 搜索词；不写名称就用域名）</div>
  <textarea id="ta" spellcheck="false" placeholder="百度 | https://www.baidu.com/s?wd=%s"></textarea>
  <div class="row">
    <span class="lbl" style="margin:0">快捷键</span>
    <input id="hk" readonly>
    <span class="sp"></span>
    <button class="btn" data-a="cancel">取消</button>
    <button class="btn pri" data-a="save">保存</button>
  </div>
  <div class="tip">拖住顶部搜索词可移动整个小窗；靠边会吸附，吸附后要往反方向多拖一段才拽得动。点引擎=切换，中键/Ctrl+点击=新标签。</div>
</div>
<div class="toast"></div>
`;

  /* ================= 挂载 ================= */
  const host = document.createElement('div');
  host.id = 'metasearch-host';
  (document.body || document.documentElement).appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = HTML;
  try {
    if (typeof CSSStyleSheet === 'function' && root.adoptedStyleSheets !== undefined) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(CSS);
      root.adoptedStyleSheets = [sheet];
    } else throw new Error('no adoptedStyleSheets');
  } catch (e) {
    const st = document.createElement('style');
    st.textContent = CSS;
    root.prepend(st);
  }

  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));

  let cfg = load();
  let dismissed = false;
  let lastQ = '';
  let toastTimer = 0;
  let drag = null;
  let grip = null;

  /* ================= 工具 ================= */
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const buildUrl = (tpl, q) => tpl.replace(/%s/g, encodeURIComponent(q));
  const hostOf = u => { try { return new URL(u.replace(/%s/g, '')).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
  const hkText = s => s.split('+').map(p => p ? p[0].toUpperCase() + p.slice(1) : p).join('+');
  const hue = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const px = (el, k) => parseFloat(el.style[k]) || 0;

  function parseHotkey(s) {
    const p = String(s || '').toLowerCase().split('+').map(x => x.trim()).filter(Boolean);
    return {
      key: p.length > 1 ? p[p.length - 1] : '',
      alt: p.includes('alt'), ctrl: p.includes('ctrl'),
      shift: p.includes('shift'), meta: p.includes('meta'),
    };
  }

  function toast(msg) {
    const el = $('.toast');
    el.textContent = msg;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
  }

  /* ================= 认搜索词 =================
     优先级：正在输入的搜索框 > URL 查询参数 > 页面上的搜索框 > 选中文字 */
  const PKEYS = ['q', 'wd', 'keyword', 'query', 'search_query', 'kw', 'word', 'search'];
  const badQ = s => !s || s.length > 200 || /^\d{1,4}$/.test(s);

  function isSearchBox(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    const t = (el.type || 'text').toLowerCase();
    if (t !== 'search' && t !== 'text') return false;
    return t === 'search'
      || /^(q|wd|query|keyword|kw|word|search)$/i.test(el.name || '')
      || /搜索|检索|search/i.test((el.placeholder || '') + (el.id || '') + (el.getAttribute('class') || ''));
  }

  function fromUrl() {
    const pools = [location.search];
    const i = location.hash.indexOf('?');
    if (i > -1) pools.push(location.hash.slice(i));
    for (const p of pools) {
      let sp;
      try { sp = new URLSearchParams(p); } catch (e) { continue; }
      for (const k of PKEYS) {
        const v = (sp.get(k) || '').trim();
        if (!badQ(v)) return v;
      }
    }
    return '';
  }

  const INPUT_SEL = ['input[type=search]', 'input[name=q]', 'input[name=wd]', 'input[name=query]',
    'input[name=keyword]', '#kw', 'input[placeholder*="搜索"]', 'input[placeholder*="search" i]'];

  function fromInput() {
    const ae = document.activeElement;
    if (isSearchBox(ae) && ae.value.trim()) return ae.value.trim();
    for (const s of INPUT_SEL) {
      let el;
      try { el = document.querySelector(s); } catch (e) { continue; }
      if (el && el.value && el.value.trim()) return el.value.trim();
    }
    return '';
  }

  function detect() {
    const q = fromInput() || fromUrl();
    if (q) return q;
    const sel = String(window.getSelection ? window.getSelection() : '').trim();
    return sel && sel.length <= 80 ? sel : '';
  }

  /* ================= 位置：贴边 / 自由 + 吸附 + 宽度 ================= */
  const M = 10;       // 离屏幕边缘的间距
  const DETACH = 26;  // 吸附状态下要往反方向多拖这么多像素才脱离
  const SNAP = 44;    // 松手时离边缘小于这个距离就吸过去
  const MIN_W = 120, MAX_W = 420;

  function railSize() {
    const el = $('#bar');
    return { w: el.offsetWidth || cfg.w || 172, h: el.offsetHeight || 320 };
  }

  function applyPos() {
    const el = $('#bar');
    if (!el.classList.contains('on')) return;
    el.style.width = cfg.w + 'px';
    el.classList.toggle('dock-left', cfg.pos.m === 'left');
    const { w, h } = railSize();
    const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    const ax = Math.max(0, vw - w - 2 * M), ay = Math.max(0, vh - h - 2 * M);
    const p = cfg.pos;
    let left, top;
    if (p.m === 'right') { left = vw - w - M; top = M + p.y * ay; }
    else if (p.m === 'left') { left = M; top = M + p.y * ay; }
    else if (p.m === 'bottom') { left = M + p.x * ax; top = vh - h - M; }
    else { left = M + p.x * ax; top = M + p.y * ay; }
    el.style.left = Math.round(clamp(left, M, Math.max(M, vw - w - M))) + 'px';
    el.style.top = Math.round(clamp(top, M, Math.max(M, vh - h - M))) + 'px';
  }

  // 把当前 left/top 折算回比例并存盘（换分辨率后才不会跑偏）
  function commitGeom(m) {
    const el = $('#bar');
    const { w, h } = railSize();
    const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    const ax = Math.max(1, vw - w - 2 * M), ay = Math.max(1, vh - h - 2 * M);
    const left = px(el, 'left'), top = px(el, 'top');
    cfg.pos = { m: m || cfg.pos.m, x: clamp((left - M) / ax, 0, 1), y: clamp((top - M) / ay, 0, 1) };
    save(cfg);
    settle();
  }

  function setWidth(v, persist) {
    const vw = window.innerWidth || 1024;
    const cap = Math.max(MIN_W, Math.min(MAX_W, vw - 2 * M));
    cfg.w = Math.round(clamp(Number(v) || 172, MIN_W, cap));
    $('#bar').style.width = cfg.w + 'px';
    $('#wv').textContent = cfg.w + 'px';
    $('#wr').value = cfg.w;
    if (persist !== false) save(cfg);
    commitGeom(cfg.pos.m);
    placePanel();
  }

  // 设置面板贴着竖栏放，放不下就换边
  function placePanel() {
    const panel = $('#panel'), rail = $('#bar');
    const { w } = railSize();
    const pw = panel.offsetWidth || 400, ph = panel.offsetHeight || 340;
    const rl = px(rail, 'left'), rt = px(rail, 'top');
    let left = rl - pw - 10;
    if (left < 8) left = rl + w + 10;
    if (left + pw > window.innerWidth - 8) left = Math.max(8, window.innerWidth - pw - 8);
    const top = clamp(rt, 8, Math.max(8, window.innerHeight - ph - 8));
    panel.style.left = Math.round(left) + 'px';
    panel.style.top = Math.round(top) + 'px';
  }

  function settle() {
    $('#bar').classList.add('snap');
    applyPos();
  }

  /* ---- 拖拽：吸附态有「阻力」，多拖一段才脱离 ---- */
  function onDown(e) {
    if (e.button) return;
    if (e.target.closest('[data-grip],a,button,input,textarea')) return;
    const el = $('#bar');
    const l = px(el, 'left'), t = px(el, 'top');
    drag = {
      offX: e.clientX - l, offY: e.clientY - t,
      sx: e.clientX, sy: e.clientY,
      m: cfg.pos.m, stuck: cfg.pos.m !== 'free',
      baseLeft: l, baseTop: t,
    };
    el.classList.remove('snap');
    el.classList.add('drag');
    try { el.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    e.stopPropagation();
  }

  function onMove(e) {
    if (!drag) return;
    e.stopPropagation();
    const el = $('#bar');
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;

    if (drag.stuck) {
      // out = 朝「离开吸附边」的方向走了多少像素
      const out = drag.m === 'right' ? -dx : drag.m === 'left' ? dx : -dy;
      if (out < DETACH) {
        // 没到阈值：离开方向只做阻尼位移（橡皮筋感），沿边方向可以滑动
        const k = 0.14;
        if (drag.m === 'bottom') {
          el.style.left = Math.round(drag.baseLeft + dx) + 'px';
          el.style.top = Math.round(drag.baseTop + Math.min(0, dy) * k) + 'px';
        } else {
          const ddx = drag.m === 'right' ? Math.min(0, dx) : Math.max(0, dx);
          el.style.left = Math.round(drag.baseLeft + ddx * k) + 'px';
          el.style.top = Math.round(drag.baseTop + dy) + 'px';
        }
        return;
      }
      // 够远了：脱离吸附，从现在的位置接着跟手
      drag.stuck = false;
      drag.offX = e.clientX - px(el, 'left');
      drag.offY = e.clientY - px(el, 'top');
    }

    el.style.left = Math.round(e.clientX - drag.offX) + 'px';
    el.style.top = Math.round(e.clientY - drag.offY) + 'px';
  }

  function onUp() {
    if (!drag) return;
    $('#bar').classList.remove('drag');

    const { w, h } = railSize();
    const vw = window.innerWidth || 1024, vh = window.innerHeight || 768;
    const left = px($('#bar'), 'left'), top = px($('#bar'), 'top');
    const d = { l: left, r: vw - (left + w), b: vh - (top + h) };
    const min = Math.min(d.l, d.r, d.b);
    const m = min <= SNAP ? (min === d.l ? 'left' : min === d.r ? 'right' : 'bottom') : 'free';

    drag = null;
    commitGeom(m);
  }

  /* ---- 宽度：拖内侧边沿 ---- */
  function onGripDown(e) {
    if (e.button) return;
    const el = $('#bar');
    grip = { sx: e.clientX, w0: railSize().w, l0: px(el, 'left'), m: cfg.pos.m };
    el.classList.remove('snap');
    el.classList.add('drag');
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    e.preventDefault();
    e.stopPropagation();
  }

  function onGripMove(e) {
    if (!grip) return;
    const el = $('#bar');
    const vw = window.innerWidth || 1024;
    const cap = Math.max(MIN_W, Math.min(MAX_W, vw - 2 * M));
    const dx = e.clientX - grip.sx;
    const w = Math.round(clamp(grip.m === 'left' ? grip.w0 + dx : grip.w0 - dx, MIN_W, cap));
    el.style.width = w + 'px';
    // 贴左时右边沿在动；其余情况锁住右边沿、左边沿跟着指针走（面板不会整体位移）
    el.style.left = Math.round(grip.m === 'left' ? grip.l0 : grip.l0 + (grip.w0 - w)) + 'px';
    $('#wv').textContent = w + 'px';
    $('#wr').value = w;
    e.preventDefault();
    e.stopPropagation();
  }

  function onGripUp() {
    if (!grip) return;
    $('#bar').classList.remove('drag');
    cfg.w = Math.round(parseFloat($('#bar').style.width) || cfg.w);
    grip = null;
    save(cfg);
    commitGeom(cfg.pos.m);
    placePanel();
  }

  /* ================= 渲染 ================= */
  function syncHk() {
    $('#hk').value = hkText(cfg.hotkey);
    $('#hk').dataset.v = cfg.hotkey;
  }

  function renderBar(q) {
    lastQ = q;
    $('#q').innerHTML = `“<b>${esc(q.length > 40 ? q.slice(0, 40) + '…' : q)}</b>”`;
    $('.mode').textContent = cfg.openNew ? '新窗' : '本页';
    const here = location.hostname.replace(/^www\./, '');
    const tgt = cfg.openNew ? ' target="_blank" rel="noopener noreferrer"' : '';
    $('#engs').innerHTML = cfg.engines.map(e => {
      const dot = `<i class="dot" style="background:hsl(${hue(e.name)} 72% 62%)"></i>`;
      if (hostOf(e.url) === here) return `<span class="eng cur" title="当前引擎">${dot}${esc(e.name)}</span>`;
      return `<a class="eng" href="${esc(buildUrl(e.url, q))}"${tgt} title="${esc(e.url)}">${dot}${esc(e.name)}</a>`;
    }).join('');
  }

  function refresh() {
    const q = detect();
    if (!q) { lastQ = ''; $('#bar').classList.remove('on'); return; }
    renderBar(q);
    if (!dismissed) {
      $('#bar').classList.add('on');
      applyPos();
      if ($('#panel').classList.contains('on')) placePanel();
    }
  }

  /* ================= 设置 ================= */
  function serialize(list) {
    return list.map(e => `${e.name} | ${e.url}`).join('\n');
  }

  function parseEngines(text) {
    const out = [];
    text.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line[0] === '#') return;
      const i = line.indexOf('|');
      let name = i > -1 ? line.slice(0, i).trim() : '';
      const url = (i > -1 ? line.slice(i + 1) : line).trim();
      if (!url || !/^https?:\/\//i.test(url)) return;
      if (!name) name = hostOf(url) || '未命名';
      out.push({ name, url });
    });
    return out;
  }

  function markPos() {
    $$('#posRow .btn').forEach(b => b.classList.toggle('on', b.dataset.m === cfg.pos.m));
  }

  function openPanel() {
    $('#ta').value = serialize(cfg.engines);
    $('#wv').textContent = cfg.w + 'px';
    $('#wr').value = cfg.w;
    syncHk();
    markPos();
    $('#panel').classList.add('on');
    placePanel();
  }
  const closePanel = () => $('#panel').classList.remove('on');

  function saveSettings() {
    const list = parseEngines($('#ta').value);
    if (!list.length) return toast('至少保留一个合法引擎（http/https 开头）');
    const bad = list.find(e => !/%s/.test(e.url));
    if (bad) return toast(`「${bad.name}」的 URL 缺少 %s 占位符`);
    const hk = $('#hk').dataset.v || '';
    if (hk) {
      if (!parseHotkey(hk).key) return toast('快捷键要带一个普通键，比如 Alt+S');
      cfg.hotkey = hk;
    }
    cfg.engines = list;
    save(cfg);
    closePanel();
    refresh();
    toast('已保存');
  }

  /* ================= 事件 ================= */
  root.addEventListener('click', ev => {
    const el = ev.target.closest('[data-a]');
    if (!el) return;
    const a = el.dataset.a;

    if (a === 'hide') { dismissed = true; closePanel(); $('#bar').classList.remove('on'); return; }
    if (a === 'mode') {
      cfg.openNew = !cfg.openNew;
      save(cfg);
      if (lastQ) renderBar(lastQ);
      return toast(cfg.openNew ? '已改为：新标签打开' : '已改为：本页刷新');
    }
    if (a === 'flip') {
      cfg.pos = Object.assign({}, cfg.pos, { m: cfg.pos.m === 'right' ? 'left' : 'right' });
      save(cfg);
      settle();
      markPos();
      placePanel();
      return;
    }
    if (a === 'pos') {
      cfg.pos = Object.assign({}, cfg.pos, { m: el.dataset.m });
      save(cfg);
      settle();
      markPos();
      placePanel();
      return;
    }
    if (a === 'set') return $('#panel').classList.contains('on') ? closePanel() : openPanel();
    if (a === 'cancel') return closePanel();
    if (a === 'save') return saveSettings();
  });

  $('#hk').addEventListener('keydown', e => {
    if (e.key === 'Tab') return;
    e.preventDefault();
    const mods = [];
    if (e.ctrlKey) mods.push('ctrl');
    if (e.altKey) mods.push('alt');
    if (e.shiftKey) mods.push('shift');
    if (e.metaKey) mods.push('meta');
    const k = e.key.toLowerCase();
    if (['control', 'alt', 'shift', 'meta'].includes(k)) return;
    if (!mods.length) return toast('请至少带一个修饰键，比如 Alt');
    const v = mods.concat(k).join('+');
    $('#hk').value = hkText(v);
    $('#hk').dataset.v = v;
  });

  const rail = $('#bar');
  rail.addEventListener('pointerdown', onDown);
  rail.addEventListener('pointermove', onMove);
  rail.addEventListener('pointerup', onUp);
  rail.addEventListener('pointercancel', onUp);

  const gripEl = $('.grip');
  gripEl.addEventListener('pointerdown', onGripDown);
  gripEl.addEventListener('pointermove', onGripMove);
  gripEl.addEventListener('pointerup', onGripUp);
  gripEl.addEventListener('pointercancel', onGripUp);

  $('#wr').addEventListener('input', e => setWidth(e.target.value));

  // 边打字边跟着变
  let typeTimer = 0;
  document.addEventListener('input', e => {
    if (!isSearchBox(e.target)) return;
    clearTimeout(typeTimer);
    typeTimer = setTimeout(() => { dismissed = false; refresh(); }, 250);
  }, true);

  window.addEventListener('popstate', () => { dismissed = false; refresh(); });
  window.addEventListener('hashchange', () => refresh());
  window.addEventListener('resize', () => {
    applyPos();
    if ($('#panel').classList.contains('on')) placePanel();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if ($('#panel').classList.contains('on')) { closePanel(); return; }
      if ($('#bar').classList.contains('on')) { dismissed = true; $('#bar').classList.remove('on'); }
      return;
    }
    if (e.composedPath().includes($('#hk'))) return;
    const hk = parseHotkey(cfg.hotkey);
    if (!hk.key || e.key.toLowerCase() !== hk.key) return;
    if (hk.alt !== e.altKey || hk.ctrl !== e.ctrlKey || hk.shift !== e.shiftKey || hk.meta !== e.metaKey) return;
    e.preventDefault(); e.stopPropagation();
    dismissed = false;
    refresh();
    if (!$('#bar').classList.contains('on')) toast('没读到搜索词：先在搜索框输入，或选中要搜的文字');
  }, true);

  if (typeof GM_registerMenuCommand === 'function') {
    GM_registerMenuCommand('重新读取搜索词', () => { dismissed = false; refresh(); });
    GM_registerMenuCommand('引擎设置', openPanel);
  }

  /* ================= 启动 ================= */
  syncHk();
  $('#bar').style.width = cfg.w + 'px';
  $('#wv').textContent = cfg.w + 'px';
  $('#wr').value = cfg.w;
  refresh();
  if (fresh) {
    save(cfg);
    setTimeout(() => toast(`按 ${hkText(cfg.hotkey)} 重新读取搜索词`), 1200);
  }
})();
