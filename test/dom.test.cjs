const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const code = fs.readFileSync(path.join(__dirname, '..', 'metasearch.user.js'), 'utf8');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ok = [];
const bad = [];
const t = (name, cond, extra = '') => (cond ? ok : bad).push(name + (extra ? ' → ' + extra : ''));

function boot(url, html = '<body></body>', before) {
  const dom = new JSDOM(`<!doctype html><html>${html}</html>`, { runScripts: 'outside-only', url });
  const win = dom.window;
  win.GM_getValue = (k, d) => { const v = win.localStorage.getItem(k); return v === null ? d : v; };
  win.GM_setValue = (k, v) => win.localStorage.setItem(k, v);
  win.GM_registerMenuCommand = () => {};
  if (before) before(win);
  win.eval(code);
  const root = win.document.getElementById('metasearch-host').shadowRoot;
  return {
    win, doc: win.document, root,
    $: s => root.querySelector(s),
    $$: s => Array.from(root.querySelectorAll(s)),
    hit: (key, mods = {}) => win.document.dispatchEvent(
      new win.KeyboardEvent('keydown', Object.assign({ key, bubbles: true }, mods))),
  };
}

(async () => {
  /* ---------- 读搜索词：URL 参数 ---------- */
  const a = boot('https://example.com/search?q=hello%20world');
  t('URL 里的 q 被读到', a.$('#bar').classList.contains('on'));
  t('搜索词显示在栏里', a.$('#q').textContent.includes('hello world'), a.$('#q').textContent);
  t('默认 8 个引擎', a.$$('.eng').length === 8, a.$$('.eng').length);
  t('默认本页模式', a.$('.mode').textContent === '本页');
  t('链接拼接 + 编码正确',
    a.$$('.eng')[0].getAttribute('href') === 'https://www.baidu.com/s?wd=hello%20world',
    a.$$('.eng')[0].getAttribute('href'));
  t('本页模式不带 target', !a.$$('.eng')[0].getAttribute('target'));

  /* ---------- 本页 / 新窗 可切 ---------- */
  a.$('[data-a="mode"]').click();
  t('切到新窗后 target=_blank', a.$('.mode').textContent === '新窗' && a.$$('.eng')[0].getAttribute('target') === '_blank');
  t('打开方式已落盘', JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).openNew === true);
  a.$('[data-a="mode"]').click();
  t('再点回到本页', a.$('.mode').textContent === '本页' && !a.$$('.eng')[0].getAttribute('target'));

  /* ---------- 收起 / Alt+S 唤回 ---------- */
  a.$('[data-a="hide"]').click();
  t('✕ 收起栏', !a.$('#bar').classList.contains('on'));
  a.hit('s', { altKey: true });
  t('Alt+S 唤回', a.$('#bar').classList.contains('on'));

  /* ---------- 位置：默认贴右 ---------- */
  const pos = el => ({ l: parseFloat(el.style.left) || 0, t: parseFloat(el.style.top) || 0 });
  // jsdom 无布局：railSize 退回 172×320，视口 1024×768 → 贴右=1024-172-10
  const SNAP_R = 1024 - 172 - 10;
  t('默认贴在右边', Math.abs(pos(a.$('#bar')).l - SNAP_R) <= 1, pos(a.$('#bar')).l);
  t('竖直方向居中', Math.abs(pos(a.$('#bar')).t - 224) <= 1, pos(a.$('#bar')).t);

  /* ---------- 吸附阻力：没拖够不脱离 ---------- */
  const evt = (ctx, type, x, y) =>
    ctx.$('#bar').dispatchEvent(new ctx.win.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  const dragTo = (ctx, x0, y0, path) => {
    evt(ctx, 'pointerdown', x0, y0);
    path.forEach(p => evt(ctx, 'pointermove', p[0], p[1]));
    const last = path[path.length - 1] || [x0, y0];
    evt(ctx, 'pointerup', last[0], last[1]);
  };

  dragTo(a, 900, 300, [[890, 300]]); // 反向只挪了 10px < 26px 阈值
  t('阻力：小位移不脱离', Math.abs(pos(a.$('#bar')).l - SNAP_R) <= 3, pos(a.$('#bar')).l);
  t('阻力：松手弹回原位', Math.abs(pos(a.$('#bar')).l - SNAP_R) <= 1, pos(a.$('#bar')).l);
  t('阻力：位置模式没变', JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).pos.m === 'right');

  /* ---------- 拖够距离后脱离并跟随 ---------- */
  dragTo(a, 900, 300, [[800, 300], [700, 300]]);
  const afterDrag = pos(a.$('#bar')).l;
  t('拖够 100px 后脱离吸附', afterDrag < SNAP_R - 50, afterDrag);
  t('脱离后变成自由位置',
    JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).pos.m === 'free',
    JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).pos.m);

  /* ---------- 预设位置 ---------- */
  a.$('[data-a="set"]').click();
  t('预设按钮有 4 个', a.$$('#posRow .btn').length === 4);
  a.$('#posRow [data-m="left"]').click();
  t('预设贴左生效', Math.abs(pos(a.$('#bar')).l - 10) <= 1, pos(a.$('#bar')).l);
  t('预设已落盘', JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).pos.m === 'left');
  t('当前预设高亮', a.$('#posRow .btn.on').dataset.m === 'left');
  a.$('#posRow [data-m="bottom"]').click();
  t('预设贴底生效', pos(a.$('#bar')).l > 10 && pos(a.$('#bar')).t > 300, JSON.stringify(pos(a.$('#bar'))));
  a.$('#posRow [data-m="right"]').click();
  t('贴右回到右边', Math.abs(pos(a.$('#bar')).l - SNAP_R) <= 1);
  a.$('[data-a="cancel"]').click();

  /* ---------- ⇄ 翻边 ---------- */
  a.$('[data-a="flip"]').click();
  t('⇄ 翻到左边', Math.abs(pos(a.$('#bar')).l - 10) <= 1, pos(a.$('#bar')).l);
  a.$('[data-a="flip"]').click();
  t('再翻回右边', Math.abs(pos(a.$('#bar')).l - SNAP_R) <= 1);

  /* ---------- 宽度：滑杆 ---------- */
  const cfgOf = () => JSON.parse(a.win.localStorage.getItem('metasearch:cfg'));
  const setW = v => {
    a.$('#wr').value = String(v);
    a.$('#wr').dispatchEvent(new a.win.Event('input', { bubbles: true }));
  };
  setW(260);
  t('滑杆能改宽度', a.$('#bar').style.width === '260px', a.$('#bar').style.width);
  t('宽度已落盘', cfgOf().w === 260, cfgOf().w);
  t('贴右时右边沿不动', Math.abs(pos(a.$('#bar')).l - (1024 - 260 - 10)) <= 1, pos(a.$('#bar')).l);
  t('宽度数字同步', a.$('#wv').textContent === '260px', a.$('#wv').textContent);
  setW(9999);
  t('超上限被夹到 420', a.$('#bar').style.width === '420px', a.$('#bar').style.width);
  setW(10);
  t('低于下限被夹到 120', a.$('#bar').style.width === '120px', a.$('#bar').style.width);

  /* ---------- 宽度：拖内侧边沿 ---------- */
  setW(260);
  const g = a.$('.grip');
  const ge = (type, x, y) => g.dispatchEvent(new a.win.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }));
  ge('pointerdown', 760, 300);
  ge('pointermove', 700, 300);   // 向左拖 60 → 宽 260+60
  t('拖边沿变宽', a.$('#bar').style.width === '320px', a.$('#bar').style.width);
  t('右边沿保持不动', pos(a.$('#bar')).l + 320 === 1014, pos(a.$('#bar')).l);
  ge('pointerup', 700, 300);
  t('拖完宽度落盘', cfgOf().w === 320, cfgOf().w);
  t('拖完右边沿仍是 1014', Math.abs((pos(a.$('#bar')).l + 320) - 1014) <= 1, pos(a.$('#bar')).l);
  setW(172);

  /* ---------- 设置：增删改引擎 ---------- */
  a.$('[data-a="set"]').click();
  t('设置面板打开', a.$('#panel').classList.contains('on'));
  t('配置回填 8 行', a.$('#ta').value.split('\n').length === 8, a.$('#ta').value.split('\n').length);
  t('快捷键回填 Alt+S', a.$('#hk').value === 'Alt+S', a.$('#hk').value);

  a.$('#ta').value = '# 注释行会被忽略\nhttps://x.com/?q=%s\nBing | https://bing.com/search?q=%s';
  a.$('[data-a="save"]').click();
  t('保存后剩 2 个引擎', a.$$('.eng').length === 2, a.$$('.eng').length);
  t('不写名称时用域名', a.$$('.eng')[0].textContent === 'x.com', a.$$('.eng')[0].textContent);
  t('注释行没进配置',
    JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).engines.every(e => !e.name.includes('#') && !e.url.includes('#')));
  t('保存后关闭面板', !a.$('#panel').classList.contains('on'));

  /* ---------- 非法配置拦截 ---------- */
  a.$('[data-a="set"]').click();
  a.$('#ta').value = '坏引擎 | https://x.com/search';
  a.$('[data-a="save"]').click();
  t('缺 %s 时拦截保存',
    a.$('.toast').textContent.includes('%s') && a.$$('.eng').length === 2,
    a.$('.toast').textContent);
  a.$('#ta').value = '不是网址';
  a.$('[data-a="save"]').click();
  t('非 http 行被过滤后报错', a.$('.toast').textContent.includes('合法引擎'), a.$('.toast').textContent);
  a.$('[data-a="cancel"]').click();
  t('取消不写配置', a.$$('.eng').length === 2);

  /* ---------- 当前引擎高亮 ---------- */
  const b = boot('https://www.baidu.com/s?wd=jsdom%20test');
  t('当前引擎只有一个高亮', b.$$('.eng.cur').length === 1, b.$$('.eng.cur').length);
  t('高亮的是百度', b.$$('.eng.cur')[0].textContent === '百度', b.$$('.eng.cur')[0].textContent);
  t('当前引擎不是链接', b.$('.eng.cur').tagName === 'SPAN');

  /* ---------- 搜索框内容优先于 URL 参数 ---------- */
  const c = boot('https://example.com/search?q=old', '<body><input type="search" name="q" value="typed-new"></body>');
  t('搜索框内容优先', c.$('#q').textContent.includes('typed-new'), c.$('#q').textContent);

  /* ---------- 边打字边更新 ---------- */
  const inp = c.doc.querySelector('input');
  inp.value = 'live-edit';
  inp.dispatchEvent(new c.win.Event('input', { bubbles: true }));
  await sleep(400);
  t('输入时实时跟随', c.$('#q').textContent.includes('live-edit'), c.$('#q').textContent);
  t('输入后链接同步更新', c.$$('.eng')[0].getAttribute('href').includes('live-edit'));

  /* ---------- 选中文字兜底 ---------- */
  const d = boot('https://example.com/article', '<body><p>一些正文</p></body>', win => {
    win.getSelection = () => ({ toString: () => '  选中的词  ' });
  });
  t('没搜索框时用选中文字', d.$('#bar').classList.contains('on') && d.$('#q').textContent.includes('选中的词'),
    d.$('#q').textContent);

  /* ---------- 完全没词 ---------- */
  const e = boot('https://example.com/plain');
  t('无搜索词不显示', !e.$('#bar').classList.contains('on'));
  e.hit('s', { altKey: true });
  t('无词时给提示', e.$('.toast').textContent.includes('没读到'), e.$('.toast').textContent);
  e.hit('Escape');
  t('Esc 不影响正常页面', !e.$('#bar').classList.contains('on'));

  console.log('PASS ' + ok.length);
  ok.forEach(n => console.log('  ✓ ' + n));
  if (bad.length) {
    console.log('FAIL ' + bad.length);
    bad.forEach(n => console.log('  ✗ ' + n));
    process.exit(1);
  }
  process.exit(0);
})();
