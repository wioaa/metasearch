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
  t('默认 7 个引擎（= 通用组）', a.$$('.eng').length === 7, a.$$('.eng').length);
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
  t('配置回填 7 行', a.$('#ta').value.split('\n').length === 7, a.$('#ta').value.split('\n').length);
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

  /* ---------- 布局预设 ---------- */
  a.$('[data-a="set"]').click();
  t('默认 3 个预设', a.$$('#presets .pill').length === 3, a.$$('#presets .pill').length);
  a.$('#presets .pill:nth-child(2) b').click();
  t('应用预设改宽度', cfgOf().w === 280, cfgOf().w);
  t('应用预设后宽度标签同步', a.$('#wv').textContent === '280px', a.$('#wv').textContent);
  t('当前预设高亮', a.$$('#presets .pill.on').length === 1, a.$$('#presets .pill.on').length);
  t('预设已落盘', cfgOf().pos.m === 'right' && cfgOf().w === 280);

  setW(200);
  a.$('[data-a="addpreset"]').click();
  t('存当前 → 4 个预设', cfgOf().presets.length === 4, cfgOf().presets.length);
  t('新预设自动命名', cfgOf().presets[3].name === '贴右·200', cfgOf().presets[3].name);
  a.$('[data-a="addpreset"]').click();
  t('同布局不重复存', cfgOf().presets.length === 4);
  a.$$('#presets .pill i')[3].click();
  t('删除预设', cfgOf().presets.length === 3, cfgOf().presets.length);

  /* ---------- 整份配置导出 ---------- */
  a.$('[data-a="expCfg"]').click();
  let dumped = {};
  try { dumped = JSON.parse(a.$('#io').value); } catch (e) {}
  t('导出整份含全部字段',
    ['engines', 'presets', 'w', 'pos', 'hotkey', 'openNew'].every(k => k in dumped),
    Object.keys(dumped).join(','));
  t('导出整份引擎数正确', (dumped.engines || []).length === 2, (dumped.engines || []).length);

  /* ---------- 模板单独导出 ---------- */
  a.$('[data-a="expLayout"]').click();
  let tpl = {};
  try { tpl = JSON.parse(a.$('#io').value); } catch (e) {}
  t('导出模板只有 presets', !tpl.engines && Array.isArray(tpl.presets), Object.keys(tpl).join(','));
  t('模板数量与当前一致', tpl.presets.length === 3, tpl.presets.length);

  /* ---------- 模板单独写入 ---------- */
  a.$('#io').value = JSON.stringify({ presets: [
    { name: 'M1', m: 'left', x: 0.5, y: 0.5, w: 210 },
    { name: 'M2', m: 'bottom', x: 0.3, y: 0.5, w: 150 },
  ] });
  a.$('[data-a="writeLayout"]').click();
  t('写入模板只换预设', cfgOf().presets.length === 2 && cfgOf().engines.length === 2,
    cfgOf().presets.length + '/' + cfgOf().engines.length);
  t('写入模板保留名称', cfgOf().presets[0].name === 'M1', cfgOf().presets[0].name);
  t('写入模板后 UI 刷新', a.$$('#presets .pill').length === 2, a.$$('#presets .pill').length);

  /* ---------- 整份配置写入 ---------- */
  a.$('#io').value = JSON.stringify({
    hotkey: 'ctrl+alt+k', openNew: true, w: 300, pos: { m: 'left', x: 0.5, y: 0.5 },
    presets: [{ name: 'A', m: 'left', x: 0.5, y: 0.5, w: 300 }],
    engines: [{ name: 'X', url: 'https://x.com/?q=%s' }],
  });
  a.$('[data-a="writeCfg"]').click();
  t('写入后宽度生效', cfgOf().w === 300 && a.$('#bar').style.width === '300px', a.$('#bar').style.width);
  t('写入后引擎生效', a.$$('.eng').length === 1, a.$$('.eng').length);
  t('写入后预设生效', cfgOf().presets.length === 1);
  t('写入后快捷键同步', a.$('#hk').value === 'Ctrl+Alt+K', a.$('#hk').value);
  t('写入后已落盘', JSON.parse(a.win.localStorage.getItem('metasearch:cfg')).w === 300);

  a.$('#io').value = '{oops}';
  a.$('[data-a="writeCfg"]').click();
  t('坏 JSON 被拦', a.$('.toast').textContent.includes('JSON') && cfgOf().w === 300, a.$('.toast').textContent);
  a.$('#io').value = JSON.stringify({ presets: [] });
  a.$('[data-a="writeLayout"]').click();
  t('空模板被拦', cfgOf().presets.length === 1);
  a.$('[data-a="cancel"]').click();

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

  /* ---------- 引擎分组：分类气泡 ---------- */
  const gx = boot('https://example.com/search?q=cat');
  const gcfg = () => JSON.parse(gx.win.localStorage.getItem('metasearch:cfg'));
  gx.$('[data-a="set"]').click();
  const names = gx.$$('#groups .bub b').map(n => n.textContent);
  t('默认按用途分组', ['通用', '技术', '社区', '影音', '学术', '购物', '图片'].every(n => names.includes(n)),
    names.join('/'));
  t('不再有国内/国外', !names.includes('国内') && !names.includes('国外'));
  t('气泡带引擎数量角标', gx.$$('#groups .bub .n').length === names.length,
    gx.$$('#groups .bub .n').length);
  t('数量角标与分组一致', gx.$$('#groups .bub .n')[1].textContent === '7',
    gx.$$('#groups .bub .n')[1].textContent);
  t('首次安装就有一组亮着', gx.$$('#groups .bub.on').length === 1
    && gx.$('#groups .bub.on b').textContent === '通用', gx.$('#groups .bub.on b').textContent);

  // 点「技术」气泡 → 整套换成技术类引擎
  const techIdx = names.indexOf('技术');
  gx.$$('#groups .bub')[techIdx].click();
  t('点气泡换整套引擎', gcfg().engines.length === 7 && gcfg().engines[0].name === 'GitHub',
    gcfg().engines.map(e => e.name).join(','));
  t('竖栏同步换成新引擎', gx.$$('.eng').length === 7 && gx.$$('.eng')[0].textContent === 'GitHub',
    gx.$$('.eng')[0].textContent);
  t('换分组不改其它引擎以外的东西', gcfg().w === 172 && gcfg().pos.m === 'right');
  t('当前分组气泡高亮', gx.$$('#groups .bub.on').length === 1
    && gx.$('#groups .bub.on b').textContent === '技术', gx.$('#groups .bub.on b').textContent);
  t('点击后气泡有弹起动画类', gx.$$('#groups .bub')[techIdx].classList.contains('pop'));

  // 竖栏里的引擎逐个弹入
  t('引擎带弹入动画', gx.$$('.eng.pop').length === 7, gx.$$('.eng.pop').length);

  // 搜索词不变
  t('换分组不动搜索词', gx.$('#q').textContent.includes('cat'), gx.$('#q').textContent);

  /* ---------- 自定义分组：存 → 改名 → 删 ---------- */
  gx.$('#ta').value = '甲 | https://a.com/?q=%s\n乙 | https://b.com/?q=%s';
  gx.$('[data-a="save"]').click();
  gx.$('[data-a="set"]').click();
  const before = gcfg().groups.length;
  gx.$('[data-a="addgroup"]').click();
  t('存当前 → 多一组', gcfg().groups.length === before + 1, gcfg().groups.length);
  t('新分组默认名', gcfg().groups[before].name === '自定义 1', gcfg().groups[before].name);
  t('新分组存了当前引擎', gcfg().groups[before].engines.length === 2);
  t('新建后直接进改名状态', gx.$$('#groups .bub b')[before].getAttribute('contenteditable') === 'true');
  gx.$$('#groups .bub b')[before].textContent = '我的常用';
  gx.$$('#groups .bub b')[before].blur();
  t('改名生效并落盘', gcfg().groups[before].name === '我的常用', gcfg().groups[before].name);
  t('改名后气泡文字更新', gx.$$('#groups .bub b')[before].textContent === '我的常用');
  gx.$$('#groups .bub .x')[before].click();
  t('删分组', gcfg().groups.length === before, gcfg().groups.length);

  // 分组可单独导出 / 写入（含引擎 + 分组）
  gx.$('[data-a="expEng"]').click();
  let engDump = {};
  try { engDump = JSON.parse(gx.$('#io').value); } catch (err) {}
  t('导出引擎含 groups', Array.isArray(engDump.engines) && Array.isArray(engDump.groups),
    Object.keys(engDump).join(','));
  gx.$('#io').value = JSON.stringify({ groups: [
    { name: '只要一组', engines: [{ name: 'Z', url: 'https://z.com/?q=%s' }] },
  ] });
  gx.$('[data-a="writeEng"]').click();
  t('写入分组生效', gcfg().groups.length === 1 && gcfg().groups[0].name === '只要一组',
    gcfg().groups.map(x => x.name).join(','));
  t('只写分组不动引擎', gcfg().engines.length === 2 && gcfg().engines[0].name === '甲',
    gcfg().engines.map(x => x.name).join(','));
  t('写入后气泡重绘', gx.$$('#groups .bub').length === 1);

  // 改名状态下的键盘不能误触全局快捷键 / Esc 关面板
  gx.$('[data-a="set"]').click();

  /* ---------- 竖栏里的分组快捷切换（☰）---------- */
  const cy = boot('https://example.com/search?q=dog');
  const ccfg = () => JSON.parse(cy.win.localStorage.getItem('metasearch:cfg'));
  t('默认不展开分组栏', !cy.$('#cats').classList.contains('on'));
  cy.$('[data-a="cats"]').click();
  t('☰ 展开分组栏', cy.$('#cats').classList.contains('on'));
  t('展开后有 7 个分组', cy.$$('#cats .cat').length === 7, cy.$$('#cats .cat').length);
  t('展开状态落盘', ccfg().cats === true);
  t('☰ 按钮显示激活态', cy.$('.catbtn').classList.contains('on'));

  cy.$$('#cats .cat')[2].click();          // 社区
  t('栏内点分组整套换引擎', cy.$$('.eng').length === 6 && cy.$$('.eng')[0].textContent === '知乎',
    cy.$$('.eng').length + '/' + (cy.$$('.eng')[0] || {}).textContent);
  t('栏内当前分组高亮', cy.$$('#cats .cat.on').length === 1
    && cy.$$('#cats .cat.on')[0].textContent === '社区', cy.$$('#cats .cat.on')[0].textContent);
  t('换分组后搜索词不变', cy.$('#q').textContent.includes('dog'), cy.$('#q').textContent);
  t('栏内气泡有弹起动画', cy.$$('#cats .cat')[2].classList.contains('pop'));

  cy.$('[data-a="cats"]').click();
  t('再点 ☰ 收起', !cy.$('#cats').classList.contains('on'));
  t('收起状态也落盘', ccfg().cats === false);

  console.log('PASS ' + ok.length);
  ok.forEach(n => console.log('  ✓ ' + n));
  if (bad.length) {
    console.log('FAIL ' + bad.length);
    bad.forEach(n => console.log('  ✗ ' + n));
    process.exit(1);
  }
  process.exit(0);
})();
