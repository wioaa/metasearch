// ==UserScript==
// @name         聚合搜索 MetaSearch
// @name:en      MetaSearch - Quick Engine Switcher
// @namespace    https://github.com/wioaa/metasearch
// @version      2.3.1
// @description  自动读取当前页面的搜索词（搜索框内容 / URL 参数），一键换成别的搜索引擎；竖栏可拖拽、靠边吸附，引擎按用途分组（通用/技术/社区/影音/学术/购物/图片）一点即换，竖栏 ☰ 可就地切组，可自建气泡分组并整套导入导出
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
  const MODES = ['left', 'right', 'bottom', 'free'];
  const PNAME = { left: '贴左', right: '贴右', bottom: '贴底', free: '自由' };
  const DEFAULTS = {
    hotkey: 'alt+s',
    openNew: false,   // false = 本窗口刷新切换，true = 新标签页打开
    cats: false,      // 竖栏里是否展开「引擎分组」快捷切换
    w: 172,           // 竖栏宽度 px
    // 位置：m = left | right | bottom | free；x / y 是 0~1 的比例，换分辨率也不跑偏
    pos: { m: 'right', x: 0.5, y: 0.5 },
    // 布局预设：一键切换「位置 + 宽度」，可自己增删
    presets: [
      { name: '贴右·窄', m: 'right', x: 0.5, y: 0.5, w: 160 },
      { name: '贴右·宽', m: 'right', x: 0.5, y: 0.5, w: 280 },
      { name: '贴左·中', m: 'left', x: 0.5, y: 0.5, w: 200 },
    ],
    // 引擎分组：按「你拿它干什么」分，而不是按国内/国外
    groups: [
      { name: '通用', engines: [
        { name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
        { name: 'Bing', url: 'https://cn.bing.com/search?q=%s' },
        { name: 'Google', url: 'https://www.google.com/search?q=%s' },
        { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
        { name: '搜狗', url: 'https://www.sogou.com/web?query=%s' },
        { name: '360', url: 'https://www.so.com/s?q=%s' },
        { name: 'Yandex', url: 'https://yandex.com/search/?text=%s' },
      ] },
      { name: '技术', engines: [
        { name: 'GitHub', url: 'https://github.com/search?q=%s' },
        { name: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=%s' },
        { name: 'MDN', url: 'https://developer.mozilla.org/zh-CN/search?q=%s' },
        { name: 'npm', url: 'https://www.npmjs.com/search?q=%s' },
        { name: '掘金', url: 'https://juejin.cn/search?query=%s' },
        { name: 'CSDN', url: 'https://so.csdn.net/so/search?q=%s' },
        { name: 'Hacker News', url: 'https://hn.algolia.com/?q=%s' },
      ] },
      { name: '社区', engines: [
        { name: '知乎', url: 'https://www.zhihu.com/search?type=content&q=%s' },
        { name: '微博', url: 'https://s.weibo.com/weibo?q=%s' },
        { name: '豆瓣', url: 'https://www.douban.com/search?q=%s' },
        { name: 'V2EX', url: 'https://www.v2ex.com/search?q=%s' },
        { name: '贴吧', url: 'https://tieba.baidu.com/f/search/res?qw=%s' },
        { name: 'Reddit', url: 'https://www.reddit.com/search/?q=%s' },
      ] },
      { name: '影音', engines: [
        { name: 'B站', url: 'https://search.bilibili.com/all?keyword=%s' },
        { name: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
        { name: '网易云音乐', url: 'https://music.163.com/#/search/m/?s=%s' },
        { name: '腾讯视频', url: 'https://v.qq.com/x/search/?q=%s' },
        { name: '优酷', url: 'https://so.youku.com/search_video/q_%s' },
        { name: '豆瓣电影', url: 'https://search.douban.com/movie/subject_search?search_text=%s' },
      ] },
      { name: '学术', engines: [
        { name: '谷歌学术', url: 'https://scholar.google.com/scholar?q=%s' },
        { name: 'arXiv', url: 'https://arxiv.org/search/?query=%s&searchtype=all' },
        { name: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=%s' },
        { name: 'Semantic Scholar', url: 'https://www.semanticscholar.org/search?q=%s' },
        { name: '知网', url: 'https://kns.cnki.net/kns8s/defaultresult/index?kw=%s' },
      ] },
      { name: '购物', engines: [
        { name: '淘宝', url: 'https://s.taobao.com/search?q=%s' },
        { name: '京东', url: 'https://search.jd.com/Search?keyword=%s' },
        { name: '1688', url: 'https://s.1688.com/selloffer/offer_search.htm?keywords=%s' },
        { name: '亚马逊', url: 'https://www.amazon.cn/s?k=%s' },
        { name: '什么值得买', url: 'https://search.smzdm.com/?c=home&s=%s' },
      ] },
      { name: '图片', engines: [
        { name: '百度图片', url: 'https://image.baidu.com/search/index?tn=baiduimage&word=%s' },
        { name: '必应图片', url: 'https://www.bing.com/images/search?q=%s' },
        { name: 'Google 图片', url: 'https://www.google.com/search?tbm=isch&q=%s' },
        { name: 'Unsplash', url: 'https://unsplash.com/s/photos/%s' },
        { name: 'Pinterest', url: 'https://www.pinterest.com/search/pins/?q=%s' },
      ] },
    ],
    // 首次装上时的引擎列表 = 「通用」那一组，这样一打开就有一组是亮的，看得懂这排气泡在干嘛
    engines: [
      { name: '百度', url: 'https://www.baidu.com/s?wd=%s' },
      { name: 'Bing', url: 'https://cn.bing.com/search?q=%s' },
      { name: 'Google', url: 'https://www.google.com/search?q=%s' },
      { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s' },
      { name: '搜狗', url: 'https://www.sogou.com/web?query=%s' },
      { name: '360', url: 'https://www.so.com/s?q=%s' },
      { name: 'Yandex', url: 'https://yandex.com/search/?text=%s' },
    ],
  };

  /* ================= 存储 ================= */
  const hasGM = typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
  let fresh = false;

  const clamp01 = (v, d) => { const n = Number(v); return isFinite(n) ? Math.min(1, Math.max(0, n)) : d; };
  const clampW = v => Math.min(420, Math.max(120, Math.round(Number(v) || 172)));

  // 把任意来源（存储 / 导入的 JSON）整理成合法配置
  function normalize(got) {
    const hadPresets = Array.isArray(got && got.presets); // 明确写了空数组 = 用户确实不要预设
    const hadGroups = Array.isArray(got && got.groups);
    const cfg = Object.assign(JSON.parse(JSON.stringify(DEFAULTS)), got || {});
    cfg.engines = cleanEngines(cfg.engines);
    if (!cfg.engines.length) cfg.engines = JSON.parse(JSON.stringify(DEFAULTS.engines));
    if (!cfg.hotkey) cfg.hotkey = DEFAULTS.hotkey;
    cfg.openNew = !!cfg.openNew;
    cfg.cats = !!cfg.cats;
    cfg.w = clampW(cfg.w);
    cfg.pos = {
      m: MODES.includes(cfg.pos && cfg.pos.m) ? cfg.pos.m : 'right',
      x: clamp01(cfg.pos && cfg.pos.x, 0.5),
      y: clamp01(cfg.pos && cfg.pos.y, 0.5),
    };
    cfg.presets = (Array.isArray(cfg.presets) ? cfg.presets : []).map(p => {
      const m = MODES.includes(p && p.m) ? p.m : 'right';
      const w = clampW(p && p.w);
      return {
        name: String((p && p.name) || '').slice(0, 16) || `${PNAME[m]}·${w}`,
        m, x: clamp01(p && p.x, 0.5), y: clamp01(p && p.y, 0.5), w,
      };
    }).slice(0, 8);
    if (!cfg.presets.length && !hadPresets) cfg.presets = JSON.parse(JSON.stringify(DEFAULTS.presets));
    cfg.groups = (Array.isArray(cfg.groups) ? cfg.groups : []).map(g => ({
      name: String((g && g.name) || '').slice(0, 16) || '引擎组',
      engines: cleanEngines(g && g.engines).slice(0, 30),
    })).filter(g => g.engines.length).slice(0, 10);
    if (!cfg.groups.length && !hadGroups) cfg.groups = JSON.parse(JSON.stringify(DEFAULTS.groups));
    return cfg;
  }

  function cleanEngines(list) {
    return (Array.isArray(list) ? list : [])
      .map(e => ({ name: String(e.name || ''), url: String(e.url || '') }))
      .filter(e => e.name && e.url);
  }

  function load() {
    let raw = '';
    try { raw = hasGM ? GM_getValue(KEY, '') : localStorage.getItem(KEY) || ''; } catch (e) {}
    fresh = !raw;
    let got = {};
    try { got = raw ? JSON.parse(raw) : {}; } catch (e) {}
    return normalize(got);
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
.q{font-size:11.5px;line-height:1.5;color:#8b929c;padding:1px 27px 7px 4px;margin-bottom:7px;border-bottom:1px solid #262b34;max-height:2.9em;overflow:hidden;word-break:break-word}
.q b{color:#fff;font-weight:600}
.list{display:flex;flex-direction:column;gap:2px;overflow-y:auto;margin:0 -2px;padding:0 2px}
.list::-webkit-scrollbar{width:5px}
.list::-webkit-scrollbar-thumb{background:#39404c;border-radius:3px}
.eng{display:flex;align-items:center;gap:7px;padding:5px 8px;border-radius:7px;color:#dfe3e9;text-decoration:none;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;font-weight:400;border:1px solid transparent}
.eng:hover{background:#2b323d;border-color:#3b4350;color:#fff}
.eng.cur{opacity:.4;cursor:default;background:transparent;border-color:transparent}
.eng.cur:hover{background:transparent;border-color:transparent;color:#dfe3e9}
.dot{width:6px;height:6px;border-radius:50%;flex:none}
/* 竖栏里的分组快捷切换：右上角 ☰ 展开一排小气泡 */
.catbtn{position:absolute;top:3px;right:3px;z-index:3;width:22px;height:22px;padding:0;border:0;border-radius:6px;background:transparent;color:#9aa1ab;font-size:13px;line-height:1;cursor:pointer;font-family:inherit;opacity:.9}
.catbtn:hover{background:#2a313c;color:#fff;opacity:1}
.catbtn.on{color:#7fb0ff;opacity:1;background:rgba(47,107,255,.14)}
.cats{display:none;flex-wrap:wrap;gap:4px;margin-top:7px;padding-top:7px;border-top:1px solid #262b34;max-height:28vh;overflow-y:auto}
.cats.on{display:flex}
.cats::-webkit-scrollbar{width:5px}
.cats::-webkit-scrollbar-thumb{background:#39404c;border-radius:3px}
.cat{flex:none;padding:3px 9px;border-radius:999px;border:1px solid #333a45;background:#1b1f26;color:#cfd6df;font-size:11.5px;line-height:1.45;cursor:pointer;font-family:inherit;white-space:nowrap;transition:transform .14s,border-color .14s,background .14s,color .14s}
.cat:hover{transform:translateY(-1px);border-color:#4d5866;color:#fff}
.cat.on{border-color:#2f6bff;background:#22386a;color:#fff}
.cat.pop{animation:catPop .4s cubic-bezier(.2,.9,.3,1.5)}
@keyframes catPop{0%{transform:none}34%{transform:translateY(-5px) scale(1.12)}68%{transform:translateY(1px) scale(.97)}100%{transform:none}}
.foot{display:flex;align-items:center;gap:2px;margin-top:7px;padding-top:7px;border-top:1px solid #262b34}
.mode{flex:1 1 auto;min-width:0;height:24px;padding:0 4px;white-space:nowrap;overflow:hidden;border-radius:7px;border:1px solid #333a45;background:#1d222a;color:#9aa1ab;cursor:pointer;font-size:11.5px;line-height:1;font-family:inherit}
.mode:hover{background:#2a313c;border-color:#4a5462;color:#fff}
.ic{width:21px;height:21px;flex:none;border:0;border-radius:7px;background:transparent;color:#8b929c;cursor:pointer;font-size:13px;line-height:1;padding:0;font-family:inherit}
.ic:hover{background:#2a313c;color:#fff}
.panel{position:fixed;left:0;top:0;z-index:2147483647;display:none;width:min(408px,calc(100vw - 24px));max-height:min(82vh,780px);overflow-y:auto;background:#15171c;border:1px solid #2a2e36;border-radius:13px;padding:13px;box-shadow:0 18px 50px rgba(0,0,0,.55);font:13px/1.6 -apple-system,"Segoe UI",system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#e6e8eb}
.panel.on{display:block}
.panel::-webkit-scrollbar{width:8px}
.panel::-webkit-scrollbar-thumb{background:#39404c;border-radius:4px}
.lbl{font-size:12px;color:#8b929c;margin:0 0 7px;display:flex;align-items:center;gap:8px;justify-content:space-between}
.lbl .btn{padding:2px 8px;font-size:11.5px}
.pill{display:inline-flex;align-items:center;gap:1px;border:1px solid #333a45;border-radius:999px;background:#1b1f26;padding:2px 3px 2px 9px;font-size:12px;color:#dfe3e9;line-height:1.7}
.pill.on{border-color:#2f6bff;background:#1a2b52;color:#fff}
.pill b{font-weight:400;cursor:pointer}
.pill i{font-style:normal;color:#7c828c;cursor:pointer;font-size:11px;padding:0 4px;border-radius:6px}
.pill i:hover{color:#ff8585;background:#2a2f39}
/* 引擎分组气泡：点一下整组替换，带弹起反馈 */
.bubs{display:flex;flex-wrap:wrap;gap:7px;padding:2px 0 4px}
.bub{position:relative;display:inline-flex;align-items:center;gap:5px;padding:5px 9px 5px 12px;border-radius:999px;border:1px solid #343b47;background:linear-gradient(180deg,#212630,#191d24);color:#dfe3e9;font-size:12.5px;line-height:1.2;cursor:pointer;user-select:none;white-space:nowrap;transition:transform .16s cubic-bezier(.2,.9,.3,1.4),border-color .16s,background .16s,box-shadow .16s,color .16s}
.bub:hover{transform:translateY(-2px);border-color:#4d5866;box-shadow:0 6px 16px rgba(0,0,0,.4)}
.bub:active{transform:translateY(0) scale(.95)}
.bub.on{border-color:#2f6bff;background:linear-gradient(180deg,#27467f,#1b2c52);color:#fff;box-shadow:0 5px 16px rgba(47,107,255,.32);transform:translateY(-2px)}
.bub .n{font-style:normal;font-size:10.5px;color:#8b929c;background:#0d1015;border-radius:999px;padding:1px 5px;min-width:15px;text-align:center;font-variant-numeric:tabular-nums}
.bub.on .n{color:#cfe0ff;background:rgba(255,255,255,.14)}
.bub .pen,.bub .x{font-style:normal;color:#77808c;font-size:11px;padding:0 1px;visibility:hidden}
.bub:hover .pen,.bub:hover .x{visibility:visible}
.bub .pen:hover{color:#8fbcff}
.bub .x:hover{color:#ff8585}
.bub b{font-weight:400;outline:0;cursor:pointer}
.bub b[contenteditable="true"]{cursor:text;border-bottom:1px dashed #6f7b8b;padding-bottom:1px}
.bub.pop{animation:bubPop .44s cubic-bezier(.2,.9,.3,1.5)}
@keyframes bubPop{0%{transform:translateY(0) scale(1)}34%{transform:translateY(-8px) scale(1.14)}66%{transform:translateY(-1px) scale(.97)}100%{transform:translateY(-2px) scale(1)}}
.eng.pop{animation:engPop .36s cubic-bezier(.2,.9,.3,1.5) both}
@keyframes engPop{0%{opacity:0;transform:translateY(9px) scale(.93)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.bub,.bub.pop,.eng.pop{animation:none;transition:none}}
.panel textarea{width:100%;resize:vertical;background:#0f1115;border:1px solid #2a2e36;border-radius:8px;color:#e6e8eb;padding:8px 10px;font:12px/1.7 ui-monospace,SFMono-Regular,monospace;outline:0}
.panel textarea:focus{border-color:#4c8dff}
#ta{height:142px}
#io{height:76px;margin-top:6px}
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
  <button class="catbtn" data-a="cats" title="引擎分组（点开可整组切换）">☰</button>
  <div class="q" id="q"></div>
  <div class="list" id="engs"></div>
  <div class="cats" id="cats"></div>
  <div class="foot">
    <button class="mode" data-a="mode" title="点击切换：本页刷新 / 新标签打开">本页</button>
    <button class="ic" data-a="flip" title="翻到另一边">⇄</button>
    <button class="ic" data-a="set" title="设置">⚙</button>
    <button class="ic" data-a="hide" title="收起（Alt+S 再唤出）">✕</button>
  </div>
</div>
<div class="panel" id="panel">
  <div class="lbl"><span>位置</span></div>
  <div class="row" style="margin-top:0" id="posRow">
    <button class="btn sm" data-a="pos" data-m="left">贴左</button>
    <button class="btn sm" data-a="pos" data-m="right">贴右</button>
    <button class="btn sm" data-a="pos" data-m="bottom">贴底</button>
    <button class="btn sm" data-a="pos" data-m="free">自由</button>
  </div>

  <div class="lbl" style="margin-top:12px"><span>宽度 <span id="wv">172px</span></span><span class="tip" style="margin:0">拖内侧边沿也行</span></div>
  <div class="row" style="margin-top:0"><input type="range" id="wr" min="120" max="420" step="10"></div>

  <div class="lbl" style="margin-top:12px"><span>布局预设</span><button class="btn sm" data-a="addpreset" title="把当前位置 + 宽度存成一个预设">＋ 存当前</button></div>
  <div class="row" style="margin-top:0" id="presets"></div>

  <div class="lbl" style="margin-top:12px"><span>引擎分组</span><button class="btn sm" data-a="addgroup" title="把当前引擎列表存成一组">＋ 存当前</button></div>
  <div class="bubs" id="groups"></div>

  <div class="lbl" style="margin-top:12px"><span>搜索引擎</span><span class="tip" style="margin:0">名称 | URL，%s = 搜索词</span></div>
  <textarea id="ta" spellcheck="false" placeholder="百度 | https://www.baidu.com/s?wd=%s"></textarea>

  <div class="lbl" style="margin-top:12px"><span>快捷键</span><span class="tip" style="margin:0">点输入框后按组合键</span></div>
  <div class="row" style="margin-top:0"><input id="hk" readonly></div>

  <div class="lbl" style="margin-top:12px"><span>配置备份</span><span class="tip" style="margin:0">整份 / 布局 / 引擎</span></div>
  <div class="row" style="margin-top:0">
    <button class="btn sm" data-a="expCfg">导出整份</button>
    <button class="btn sm" data-a="expLayout">导出布局</button>
    <button class="btn sm" data-a="expEng">导出引擎</button>
    <button class="btn sm" data-a="impFile">导入文件</button>
    <input type="file" id="impFile" accept=".json,application/json" style="display:none">
  </div>
  <textarea id="io" spellcheck="false" placeholder="「导出」会把 JSON 放到这里；也可以粘贴别人的配置/模板，再点下面「写入」"></textarea>
  <div class="row" style="margin-top:6px">
    <button class="btn sm" data-a="writeCfg">写入配置</button>
    <button class="btn sm" data-a="writeLayout">写入布局</button>
    <button class="btn sm" data-a="writeEng">写入引擎</button>
  </div>

  <div class="row" style="margin-top:14px;justify-content:flex-end">
    <button class="btn" data-a="cancel">取消</button>
    <button class="btn pri" data-a="save">保存</button>
  </div>
  <div class="tip">拖住顶部搜索词可移动小窗，靠边吸附；吸附后要往反方向多拖一段才拽得动。点引擎=切换，中键 / Ctrl+点击=新标签。</div>
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
  let popEngines = false;   // 换分组后让竖栏里的引擎逐个弹入

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
    const pop = popEngines;
    popEngines = false;
    $('#engs').innerHTML = cfg.engines.map((e, i) => {
      const cls = pop ? ' eng pop' : '';
      const sty = pop ? ` style="animation-delay:${Math.min(i * 26, 260)}ms"` : '';
      const dot = `<i class="dot" style="background:hsl(${hue(e.name)} 72% 62%)"></i>`;
      if (hostOf(e.url) === here) return `<span class="eng cur${cls}"${sty} title="当前引擎">${dot}${esc(e.name)}</span>`;
      return `<a class="eng${cls}"${sty} href="${esc(buildUrl(e.url, q))}"${tgt} title="${esc(e.url)}">${dot}${esc(e.name)}</a>`;
    }).join('');
  }

  function refresh() {
    const q = detect();
    renderCats();   // 分组气泡跟配置走，与有没有搜索词无关
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

  /* ---- 布局预设 ---- */
  const sameGeom = p => p.m === cfg.pos.m && p.w === cfg.w
    && Math.abs(p.x - cfg.pos.x) < 0.005 && Math.abs(p.y - cfg.pos.y) < 0.005;

  function renderPresets() {
    const box = $('#presets');
    if (!cfg.presets.length) {
      box.innerHTML = '<span class="tip" style="margin:0">还没有预设，点右上「＋ 存当前」存一个</span>';
      return;
    }
    box.innerHTML = cfg.presets.map((p, i) =>
      `<span class="pill${sameGeom(p) ? ' on' : ''}" title="${PNAME[p.m]} · ${p.w}px">` +
      `<b data-a="preset" data-i="${i}">${esc(p.name)}</b>` +
      `<i data-a="delpreset" data-i="${i}" title="删除这个预设">✕</i></span>`).join('');
  }

  function applyPreset(i) {
    const p = cfg.presets[i];
    if (!p) return;
    cfg.pos = { m: p.m, x: p.x, y: p.y };
    cfg.w = p.w;
    save(cfg);
    $('#wv').textContent = cfg.w + 'px';
    $('#wr').value = cfg.w;
    settle();
    markPos();
    renderPresets();
    placePanel();
  }

  function addPreset() {
    if (cfg.presets.length >= 8) return toast('预设最多 8 个');
    if (cfg.presets.some(sameGeom)) return toast('这个布局已经存过了');
    cfg.presets.push({ name: `${PNAME[cfg.pos.m]}·${cfg.w}`, m: cfg.pos.m, x: cfg.pos.x, y: cfg.pos.y, w: cfg.w });
    save(cfg);
    renderPresets();
    toast('已存为预设');
  }

  function delPreset(i) {
    if (!cfg.presets[i]) return;
    cfg.presets.splice(i, 1);
    save(cfg);
    renderPresets();
    toast('已删除预设');
  }

  /* ---- 引擎分组（按用途成套换引擎，气泡点一下就换）---- */
  const sameEngines = g => g.engines.length === cfg.engines.length
    && g.engines.every((e, i) => e.name === cfg.engines[i].name && e.url === cfg.engines[i].url);

  function renderGroups() {
    const box = $('#groups');
    if (!cfg.groups.length) {
      box.innerHTML = '<span class="tip" style="margin:0">还没有分组，点右上「＋ 存当前」把现在的引擎存成一组</span>';
      return;
    }
    box.innerHTML = cfg.groups.map((g, i) =>
      `<span class="bub${sameEngines(g) ? ' on' : ''}" data-a="group" data-i="${i}" title="${esc(g.name)}：${g.engines.length} 个引擎，点一下整套切换">` +
      `<b data-a="group" data-i="${i}">${esc(g.name)}</b>` +
      `<i class="n">${g.engines.length}</i>` +
      `<i class="pen" data-a="rname" data-i="${i}" title="重命名">✎</i>` +
      `<i class="x" data-a="delgroup" data-i="${i}" title="删除这组">✕</i></span>`).join('');
  }

  // 气泡“弹一下”：先移除类、强制重排，动画才能重播
  function popBubble(i) {
    const el = $$('#groups .bub')[i];
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 470);
  }

  function applyGroup(i) {
    const g = cfg.groups[i];
    if (!g) return;
    cfg.engines = JSON.parse(JSON.stringify(g.engines));
    save(cfg);
    $('#ta').value = serialize(cfg.engines);
    renderGroups();
    renderCats();
    popEngines = true;   // 竖栏里的引擎逐个弹入
    refresh();           // 注意：refresh 里还会再 renderCats 一次，所以弹出动画必须放在它后面
    popBubble(i);
    popCat(i);
    if ($('#panel').classList.contains('on')) placePanel();
    toast(`已切到「${g.name}」· ${cfg.engines.length} 个引擎`);
  }

  // 用属性判断而不是 isContentEditable：后者在部分环境（jsdom）里未实现
  const isEditing = el => !!el && el.getAttribute && el.getAttribute('contenteditable') === 'true';

  function renameGroup(i, b) {
    if (!cfg.groups[i] || !b || isEditing(b)) return;
    const old = cfg.groups[i].name;
    b.setAttribute('contenteditable', 'true');
    b.focus();
    try {
      const r = document.createRange();
      r.selectNodeContents(b);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    } catch (e) {}
    const done = () => {
      if (!isEditing(b)) return;
      b.setAttribute('contenteditable', 'false');
      const v = b.textContent.replace(/\s+/g, ' ').trim().slice(0, 12);
      cfg.groups[i].name = v || old;
      b.textContent = cfg.groups[i].name;
      save(cfg);
      renderCats();
      // 这里不重绘整排：一旦重绘，刚被点到的其它气泡会被换掉，紧接着的 click 就丢了
    };
    b.addEventListener('blur', done, { once: true });
    b.addEventListener('keydown', ev => {
      if (ev.key === 'Enter') { ev.preventDefault(); b.blur(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); b.textContent = old; b.blur(); }
      ev.stopPropagation();
    });
  }

  function addGroup() {
    if (cfg.groups.length >= 10) return toast('分组最多 10 组');
    if (cfg.groups.some(sameEngines)) return toast('当前引擎列表已经存过了');
    const used = new Set(cfg.groups.map(g => g.name));
    let n = 1;
    while (used.has(`自定义 ${n}`)) n++;
    cfg.groups.push({ name: `自定义 ${n}`, engines: JSON.parse(JSON.stringify(cfg.engines)) });
    save(cfg);
    renderGroups();
    renderCats();
    popBubble(cfg.groups.length - 1);
    const b = $$('#groups .bub b')[cfg.groups.length - 1];
    if (b) renameGroup(cfg.groups.length - 1, b);
  }

  function delGroup(i) {
    if (!cfg.groups[i]) return;
    const name = cfg.groups[i].name;
    cfg.groups.splice(i, 1);
    if (!cfg.groups.length) cfg.cats = false;   // 一组不剩就把展开状态也收掉
    save(cfg);
    renderGroups();
    renderCats();
    toast(`已删除分组「${name}」`);
  }

  /* ---- 竖栏里的分组快捷切换 ---- */
  function renderCats() {
    const box = $('#cats');
    box.innerHTML = cfg.groups.map((g, i) =>
      `<button class="cat${sameEngines(g) ? ' on' : ''}" data-a="cat" data-i="${i}" ` +
      `title="${esc(g.name)}：${g.engines.length} 个引擎">${esc(g.name)}</button>`).join('');
    box.classList.toggle('on', !!cfg.cats && cfg.groups.length > 0);
    $('.catbtn').classList.toggle('on', !!cfg.cats);
  }

  function toggleCats() {
    if (!cfg.cats && !cfg.groups.length) return toast('还没有分组：⚙ 里「引擎分组」可以存一组');
    cfg.cats = !cfg.cats;
    save(cfg);
    renderCats();
    applyPos();
  }

  function popCat(i) {
    const el = $$('#cats .cat')[i];
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 420);
  }

  /* ---- 导出 / 写入 ---- */
  function downloadJson(name, text) {
    try {
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (e) { /* 环境不支持下载时，内容已经放进文本框了 */ }
  }

  function exportCfg() {
    const json = JSON.stringify({
      kind: 'config', v: 2, hotkey: cfg.hotkey, openNew: cfg.openNew, w: cfg.w,
      pos: cfg.pos, presets: cfg.presets, groups: cfg.groups, engines: cfg.engines,
    }, null, 2);
    $('#io').value = json;
    downloadJson('metasearch-config.json', json);
    toast(`已导出整份：${cfg.engines.length} 引擎 / ${cfg.presets.length} 布局 / ${cfg.groups.length} 引擎预设`);
  }

  function exportLayout() {
    const json = JSON.stringify({ kind: 'layout', presets: cfg.presets }, null, 2);
    $('#io').value = json;
    downloadJson('metasearch-layout.json', json);
    toast(`已导出 ${cfg.presets.length} 个布局预设`);
  }

  function exportEngines() {
    const json = JSON.stringify({ kind: 'engines', engines: cfg.engines, groups: cfg.groups }, null, 2);
    $('#io').value = json;
    downloadJson('metasearch-engines.json', json);
    toast(`已导出 ${cfg.engines.length} 个引擎 + ${cfg.groups.length} 组预设`);
  }

  function writeConfig(o) {
    if (!o || !Array.isArray(o.engines)) return toast('这份 JSON 里没有 engines 数组');
    cfg = normalize(o);
    save(cfg);
    syncHk();
    $('#wv').textContent = cfg.w + 'px';
    $('#wr').value = cfg.w;
    $('#ta').value = serialize(cfg.engines);
    $('#io').value = '';
    markPos();
    renderPresets();
    renderGroups();
    settle();
    refresh();
    toast(`已写入：${cfg.engines.length} 个引擎、${cfg.presets.length} 个布局、${cfg.groups.length} 组预设`);
  }

  function writeLayout(o) {
    const arr = Array.isArray(o) ? o : (o && Array.isArray(o.presets) ? o.presets : null);
    if (!arr) return toast('没找到 presets 数组');
    if (!arr.length) return toast('这份布局模板里没有预设');
    const next = normalize(Object.assign({}, cfg, { presets: arr })).presets;
    cfg.presets = next;
    save(cfg);
    renderPresets();
    toast(`已写入 ${next.length} 个布局预设`);
  }

  function writeEngines(o) {
    const engs = Array.isArray(o) ? o : (o && Array.isArray(o.engines) ? o.engines : null);
    const groups = Array.isArray(o) ? null : (o && Array.isArray(o.groups) ? o.groups : null);
    if (!engs && !groups) return toast('没找到 engines / groups');
    if (engs && !cleanEngines(engs).length) return toast('这份引擎列表是空的');
    const next = normalize(Object.assign({}, cfg, engs ? { engines: engs } : {}, groups ? { groups } : {}));
    if (engs) cfg.engines = next.engines;
    if (groups) cfg.groups = next.groups;
    save(cfg);
    $('#ta').value = serialize(cfg.engines);
    renderGroups();
    refresh();
    toast(`已写入 ${engs ? cfg.engines.length + ' 个引擎' : ''}${engs && groups ? '，' : ''}${groups ? cfg.groups.length + ' 组预设' : ''}`);
  }

  // 认一下粘进来/导入的 JSON 是哪一类
  function kindOf(o) {
    if (!o || Array.isArray(o)) return '';
    if (o.kind === 'config' || o.kind === 'layout' || o.kind === 'engines') return o.kind;
    if (Array.isArray(o.engines) && (o.pos || o.hotkey || o.presets)) return 'config';
    if (Array.isArray(o.engines)) return 'engines';
    if (Array.isArray(o.presets)) return 'layout';
    if (Array.isArray(o.groups)) return 'engines';
    return '';
  }

  function writeFromText(kind) {
    const t = $('#io').value.trim();
    if (!t) return toast('先把 JSON 粘进上面的框');
    let o;
    try { o = JSON.parse(t); } catch (e) { return toast('JSON 解析失败'); }
    const k = kind || kindOf(o);
    if (k === 'config') return writeConfig(o);
    if (k === 'layout') return writeLayout(o);
    if (k === 'engines') return writeEngines(o);
    return toast('认不出这份 JSON 是哪一类');
  }

  function openPanel() {
    $('#ta').value = serialize(cfg.engines);
    $('#io').value = '';
    $('#wv').textContent = cfg.w + 'px';
    $('#wr').value = cfg.w;
    syncHk();
    markPos();
    renderPresets();
    renderGroups();
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
    if (hk && !parseHotkey(hk).key) return toast('快捷键要带一个普通键，比如 Alt+S');
    // 位置 / 宽度 / 预设是即时生效的，这里只覆盖引擎和快捷键，别把刚调好的布局冲掉
    const next = JSON.parse(JSON.stringify(cfg));
    next.engines = list;
    if (hk) next.hotkey = hk;
    cfg = next;
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
    if (a === 'cats') return toggleCats();
    if (a === 'cat') return applyGroup(+el.dataset.i);
    if (a === 'set') return $('#panel').classList.contains('on') ? closePanel() : openPanel();
    if (a === 'cancel') return closePanel();
    if (a === 'save') return saveSettings();
    if (a === 'addpreset') return addPreset();
    if (a === 'preset') return applyPreset(+el.dataset.i);
    if (a === 'delpreset') return delPreset(+el.dataset.i);
    if (a === 'addgroup') return addGroup();
    if (a === 'group') {
      const b = el.tagName === 'B' ? el : el.querySelector('b');
      if (isEditing(el) || isEditing(b)) return;   // 正在改名，别把分组切走
      return applyGroup(+el.dataset.i);
    }
    if (a === 'rname') return renameGroup(+el.dataset.i, el.parentElement.querySelector('b'));
    if (a === 'delgroup') return delGroup(+el.dataset.i);
    if (a === 'expCfg') return exportCfg();
    if (a === 'expLayout') return exportLayout();
    if (a === 'expEng') return exportEngines();
    if (a === 'impFile') return $('#impFile').click();
    if (a === 'writeCfg') return writeFromText('config');
    if (a === 'writeLayout') return writeFromText('layout');
    if (a === 'writeEng') return writeFromText('engines');
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

  // 导入文件：有 engines 就整份写入，否则只当预设模板
  $('#impFile').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      const text = String(fr.result || '');
      $('#io').value = text;
      let o;
      try { o = JSON.parse(text); } catch (err) { return toast('这个文件不是合法 JSON'); }
      const k = kindOf(o);
      if (!k) return toast('认不出这份 JSON 是哪一类');
      writeFromText(k);
    };
    fr.readAsText(f);
    e.target.value = '';
  });

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
    const path = e.composedPath ? e.composedPath() : [];
    // 正在给分组改名：键盘全交给那个可编辑元素（capture 阶段先放过，别抢 Esc）
    if (path.some(n => isEditing(n))) return;
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
