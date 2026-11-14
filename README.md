# 聚合搜索 MetaSearch

> **不用重新输入**：在搜索结果页（或任何有搜索框的页面）右侧出现一条竖排引擎栏，点一下就把当前搜索词扔给另一个引擎重搜。

单文件用户脚本，无依赖、无构建、无后端。适配 Tampermonkey / Violentmonkey / 脚本猫（ScriptCat）。

## 它解决什么问题

在 Google 搜完觉得不够，想去 Bing 再搜一次 —— 通常是：复制关键词 → 打开 Bing → 粘贴 → 回车，四步。
这个脚本把它压成一步：**在结果页右侧点一下「Bing」**。

## 搜索词从哪来

按优先级依次尝试，拿到即停：

| 顺序 | 来源 | 说明 |
| --- | --- | --- |
| 1 | 正在输入的搜索框 | 光标在任何搜索框里且已输入内容时，优先用它的值 |
| 2 | URL 查询参数 | `q` / `wd` / `keyword` / `query` / `search_query` / `kw` / `word` / `search`，含 hash 路由里的参数 |
| 3 | 页面上的搜索框 | `input[type=search]`、`name=q/wd/query/keyword`、placeholder 含「搜索 / search」的输入框 |
| 4 | 选中的文字 | 页面上没输入框时，选中一段文字再按 `Alt+S` 也行 |

所以在 Google、百度、Bing、知乎、B站、GitHub 这些站的结果页是自动生效的；在别的地方，只要把词打进页面搜索框，栏会自动跟着出现（边打边更新，250ms 防抖）。

## 位置与宽度：可拖、可预设、带阻力吸附

竖排小窗默认贴在**右边**（结果页右侧通常是留白区，不挡内容），也可以：

- **拖**：按住顶部那行搜索词直接拖走，靠边松手自动吸附
- **⇄**：一键翻到另一边
- **⚙ → 位置**：贴左 / 贴右 / 贴底 / 自由，四个预设，点完立刻生效并记住
- `自由` 就是停在拖到的地方；`贴左/右` 记纵向位置，`贴底` 记横向位置，换显示器/缩放也不会跑偏

### 宽度

固定宽度在窄屏或内容偏右的站点会压住结果，所以宽度也能调，两条路：

- **拖内侧边沿**：鼠标移到竖栏靠页面那一侧的边缘（会出现一道竖线），左右拖即可，120 ~ 420px
- **⚙ → 宽度滑杆**：精确设值，拖动时实时预览

改宽度时会锁住外侧边沿（贴右时固定右边、贴左时固定左边），窗子不会整体位移，不会出现"我把边拖窄了它却跳走了"。

### 为什么要做「阻力」

离边缘 44px 内松手会吸过去，这是常规做法。但只做吸附会有个问题：**贴着边的时候，手一抖就飞出去**。
所以吸附态下再加一道门槛：

- 从吸附状态开始拖，朝「离开边缘」的方向**必须先移动 26px**，小窗才会真正跟手
- 没到 26px 之前，只按 14% 的比例做橡皮筋位移（拖 10px，窗子动 1.4px），松手弹回原处
- 沿边的方向（比如贴右时上下滑）不受限制，可以直接滑到位

结果就是：贴边状态很稳，想拖走时也很明确 —— 不会出现"我明明只想点，它却跑了"。

## 打开方式可切

栏底有个小按钮，写着当前模式，**点一下切换并记住**：

- **本页** —— 在原标签页直接跳转，相当于「换成这个引擎重搜」（默认）
- **新窗** —— 新标签页打开，原来的结果留着对比

不管哪种模式，中键 / `Ctrl`+点击任一引擎都是新标签打开。

## 使用

| 操作 | 说明 |
| --- | --- |
| 点引擎 | 用当前搜索词在该引擎重搜（按当前打开方式） |
| 拖顶部搜索词 | 移动整个小窗，靠边吸附 |
| 拖内侧边沿 | 调整宽度（120~420px） |
| 点 `本页 / 新窗` | 切换打开方式，立即落盘 |
| 点 `⇄` | 贴左 / 贴右互换 |
| 点 `⚙` | 设置：位置预设、宽度、引擎增删改、录制快捷键 |
| 点 `✕` | 收起（本页不再出现） |
| `Alt+S` | 重新读取搜索词并唤回（可改键） |
| `Esc` | 先关设置面板，再收起竖栏 |

当前页面对应的引擎会**灰掉**（不可点），一眼看出"我现在在哪个引擎"。

## 添加自己的引擎

点 `⚙`，一行一个，格式 `名称 | URL`，`%s` 就是搜索词：

```
百度 | https://www.baidu.com/s?wd=%s
Bing | https://www.bing.com/search?q=%s
Google | https://www.google.com/search?q=%s
DuckDuckGo | https://duckduckgo.com/?q=%s
知乎 | https://www.zhihu.com/search?type=content&q=%s
B站 | https://search.bilibili.com/all?keyword=%s
GitHub | https://github.com/search?q=%s
维基 | https://zh.wikipedia.org/w/index.php?search=%s
```

规则很宽松：

- `#` 开头的行是注释，不会被保存
- **不写名称**就直接写 URL，名称自动取域名（`https://x.com/?q=%s` → `x.com`）
- 行序 = 竖栏里的顺序，想换位置就调换行
- 保存时校验：URL 必须以 `http(s)://` 开头、必须含 `%s`，否则拦下并提示是哪一条
- 直接把整段贴给别人，对方粘贴进设置框保存即可

更多模板：

| 站点 | URL 模板 |
| --- | --- |
| 搜狗 | `https://www.sogou.com/web?query=%s` |
| 360 搜索 | `https://www.so.com/s?q=%s` |
| 微博 | `https://s.weibo.com/weibo?q=%s` |
| 豆瓣 | `https://www.douban.com/search?q=%s` |
| MDN | `https://developer.mozilla.org/zh-CN/search?q=%s` |
| YouTube | `https://www.youtube.com/results?search_query=%s` |
| 淘宝 | `https://s.taobao.com/search?q=%s` |
| 公司内网 Confluence | `https://wiki.example.com/dosearchsite.action?queryString=%s` |

## 配置字段

存在 `GM_setValue('metasearch:cfg')` 里，是一份 JSON，方便手动改或分享：

```json
{
  "hotkey": "alt+s",
  "openNew": false,
  "w": 172,
  "pos": { "m": "right", "x": 0.5, "y": 0.5 },
  "engines": [
    { "name": "百度", "url": "https://www.baidu.com/s?wd=%s" },
    { "name": "Bing", "url": "https://www.bing.com/search?q=%s" }
  ]
}
```

| 字段 | 说明 |
| --- | --- |
| `hotkey` | 唤起快捷键，必须带修饰键 |
| `openNew` | `false` 本页跳转 / `true` 新标签打开 |
| `w` | 竖栏宽度 px，120~420 |
| `pos.m` | `left` / `right` / `bottom` / `free` |
| `pos.x` / `pos.y` | 0~1 的比例位置，换分辨率不跑偏 |

## 实现上的取舍

- **不做结果抓取**：不解析各家 SERP 的 HTML，也不发任何网络请求。只负责「把词带过去」，页面加载交给浏览器。改版打不挂、不需要 `@connect` 权限、也不会因为风控被挡。
- **不用 `window.open`**：引擎就是真 `<a href>`，中键、`Ctrl`+点击、右键新标签全都原生可用，也不会触发弹窗拦截。
- **位置用比例存**：`{m, x, y}`，x / y 是 0~1。换分辨率、开侧边栏、页面缩放都不会把窗子甩到屏幕外。
- **Shadow DOM + CSSOM 注入样式**：不受目标站样式污染，也不怕 strict CSP 把 `<style>` 拦掉（老浏览器自动退回 `<style>`）。
- **只在顶层窗口运行**（`@noframes`），不读页面内容；`input` 事件只对搜索框响应，拖拽时会 `stopPropagation`，不干扰页面自己的手势。

## 已知限制

- 少数站点的搜索框是 `contenteditable` 或纯前端自绘的，读不到 `value`；此时用 `Alt+S` 让它改读 URL 参数或选中文字。
- 拖到屏幕正中间也可以，但会挡住内容 —— 这是自由摆放的代价，拖回边上即可。
- 单页应用切换路由时靠 `popstate` / `hashchange` 重读；若某站用纯 `pushState` 且不触发事件，按一下 `Alt+S`。
- 默认快捷键 `Alt+S` 会和少数站点冲突，在设置里录新组合即可。

## 目录结构

```
metasearch.user.js      用户脚本本体（全部逻辑 + 样式，单文件）
demo.html               演示页：模拟搜索结果页 + GM 桩，双击即可看效果
test/dom.test.cjs       jsdom 冒烟测试，56 条断言
LICENSE                 MIT
```

跑测试（可选，需要 node）：

```bash
npm i -D jsdom
node test/dom.test.cjs     # PASS n / FAIL n，非 0 退出码表示失败
```

## 兼容性

- Chrome / Edge / Firefox 109+、Safari 16.4+（Pointer Events + `adoptedStyleSheets`）
- 触屏同样可拖（`touch-action:none`）
- 配置存 `GM_setValue('metasearch:cfg')`，跨站共享、可跟随账号同步；没有 GM API 时退回当前站 `localStorage`

## 安装

仓库：[github.com/wioaa/metasearch](https://github.com/wioaa/metasearch)

| 环境 | 方式 |
| --- | --- |
| Tampermonkey / Violentmonkey | 打开 [raw 安装链接](https://raw.githubusercontent.com/wioaa/metasearch/main/metasearch.user.js)，管理器会弹出安装页 |
| 脚本猫（ScriptCat） | 同上；也可在脚本猫里「导入脚本」粘贴文件内容 |
| 只想看效果 | 下载仓库后双击 `demo.html`，无需安装任何扩展 |

脚本猫发布时，`@match *://*/*` 需要在说明里写清权限用途（注入换引擎竖栏），审核会问。

## 更新日志

### 2.1.1
- 宽度可调：拖竖栏内侧边沿，或在设置里用滑杆（120~420px）
- 改宽度时锁外侧边沿，窗子不会整体位移

### 2.1.0
- 竖排引擎栏：贴屏幕侧边的窄栏，不再横在底部挡内容
- 可拖拽自由摆放；靠边自动吸附
- 吸附阻力：脱离吸附要额外多拖 26px，之前只做橡皮筋位移
- 位置预设（贴左 / 贴右 / 贴底 / 自由）+ `⇄` 一键翻边，位置按比例存储

### 2.0.0
- 改为「接管已有搜索词」：自动读搜索框 / URL 参数 / 选中文字，一键换引擎
- 打开方式可切：本页刷新 / 新标签页
- 引擎配置改为文本编辑（一行一个，支持注释、省略名称、自动取域名）

### 1.0.0
- 首版（已被取代）：自带输入框的聚合搜索面板

## License

[MIT](./LICENSE)
