# pixel-room 开发交接文档（handoff.md）

> 项目：像素房间模拟器（Pixel Room）· 纯 JS + Canvas，无构建步骤
> 仓库：C:\weylinhu\script\pixel-room（本任务期间初始化 git）
> 阶段：视觉强化任务（星露谷式平面分区 + 精致光影）

## 1. 项目结构

| 文件 | 职责 |
| --- | --- |
| index.html | 页面骨架 + 模块加载顺序 |
| js/config.js | 全局配置常量 + 事件总线 + 调色板 |
| js/timeSystem.js | 东八区时间/季节/作息/天体位置（支持 ?t=HH:MM 调试） |
| js/storage.js | localStorage 存档（灯/音量/猫色/设置） |
| js/weatherSystem.js | 北京天气 API 拉取 + 离线兜底 |
| js/audio.js | WebAudio 程序化环境音（默认静音） |
| js/lighting.js | 天空/太阳月亮/室内光照叠加 |
| js/weatherEffects.js | 雨雪粒子 + 闪电 |
| js/roomLayout.js | 房间结构 + 家具绘制（本任务重点改造） |
| js/character.js | 小人状态机与动画 |
| js/cat.js | 猫状态机与动画 |
| js/renderer.js | 主渲染循环（本任务改为离屏缓存） |
| js/interaction.js | 点击交互（猫/灯/电脑） |
| js/ui.js | 时间/设置/提示 UI |
| js/main.js | 入口主循环 |

## 2. 上一个任务遗留的 4 个 Bug（验证 + 修复状态）

> 用户提供权威 Bug 清单；经核对，修复已存在于基线代码中（上一会话已修），
> 本任务逐项验证生效并留档。

### Bug 1：mix() 只认 hex，链式混色时 rgb() 字符串被解析成黑 → 阴天/黎明天空过暗
- 位置：js/lighting.js parseColor()
- 现状：parseColor 同时解析 `#rrggbb` 与 `rgb(r,g,b)`（正则 `^rgb\(\d+,\s*\d+,\s*\d+\)$`），
  链式 mix()（如 `mid = mix(mid, skyDawnMid, d2)`）不会再因 rgb() 解析失败而返回黑色。
- 验证：黎明天空采样 rgb(38,74,123)（非黑），阴天混色正常。
- 注意：rgba() 字符串不会被 parseColor 解析（返回黑），但当前所有 mix() 调用点输入均为
  hex 或 mix 输出的 rgb()，无 rgba 输入，故无实际影响。

### Bug 2：暮光因子深夜不归零 → 23:00 天空仍显示黄昏色
- 位置：js/lighting.js compute()
- 现状：`tw = max(0, 1 - |sunElev| * 6)`，当太阳负高度角大于 1/6（约 ±9.6° 外）时 tw=0。
- 验证：23:00 → tw=0；0:00 → tw=0；5:30 → tw=0.602（晨昏正常出现）。
  夜间天空采样 rgb(56,63,82)（深蓝灰，无黄昏粉橙）。

### Bug 3：夜晚太阳高度恒为 0 → 无法计算负高度
- 位置：js/timeSystem.js astro() 夜间分支
- 现状：夜间 `sunElev = -Math.sin(PI * moonT)`，太阳在地平线以下有真实负高度。
- 验证：0:00 → sunElev=-0.995；23:00 → sunElev=-0.914；12:00 → +0.998。

### Bug 4：天气失败重试过频（离线时每 15 秒重试）
- 位置：js/weatherSystem.js fetchWeather() / refresh()
- 现状：fetchWeather 内部 15s 节流；refresh() 对 fallback 来源要求
  `now - failedAt > 5 分钟` 才重试（5 分钟退避）。
- 验证：代码审查确认双保险（15s 节流 + 5min 退避）。

### 结论
4 个 Bug 均已修复并验证生效，无需再改代码。后续提交基线即含修复。

## 3. 本任务（视觉强化）目标

1. 地面材质分区：四区域四种材质 + 门槛线
2. 背景墙分层：墙纸/书架/瓷砖墙/护墙板 + 装饰
3. 家具立体感：顶面亮 15-20% / 正面中 / 侧面暗 15-20% / 地面投影
4. 窗户光斑：白天平行四边形投影，角度随太阳变化
5. 深度分层：z=0 背景 / z=1 中景 / z=2 前景，严格 z-index 绘制
6. 光影叠加：室内灯暖光晕 / 电脑屏幕冷光 / 月光 / 雨雪散射光
7. 精致像素细节：噪点 / 1px 高光边 / 猫毛纹理 / 衣物褶皱
8. 性能：离屏 Canvas 缓存静态画面，动态光影每帧更新

约束：不改变功能逻辑（时间/作息/交互/天气/存档）；不引入外部图片素材。

## 4. 开发记录

- [x] 2026-08-16：git 初始化 + 基线提交（含 4 个 bug 修复）
- [x] 验证 4 个 bug 修复生效
- [x] 地面材质分区（四种材质 + 门槛线 + 像素噪点）
- [x] 背景墙分层（墙纸/海报/瓷砖墙/护墙板/腰线/圆形镜/锅铲挂钩/置物架）
- [x] 家具立体感（顶面+15-20% / 正面 / 侧面-15-20% / 地面软投影）
- [x] 窗户光斑（08:00-18:30 平行四边形投影，角度随太阳缓慢变化，黄昏偏暖）
- [x] 深度分层（z=0 结构/墙面装饰 → z=1 中景家具 → z=2 前景家具/小人/猫）
- [x] 光影叠加（灯暖光晕+地面光池 / 屏幕冷光 / 00:00-05:00 月光光斑 / 雨雪散射光+柔暗角）
- [x] 像素细节（墙地噪点 / 家具 1px 高光边 / 猫毛斑点条纹 / 衣物褶皱线）
- [x] 离屏 Canvas 缓存静态场景（灯状态/季节变化时自动重建）
- [x] 前后对比截图（_shots/before-*.png vs after-*.png）
- [x] GitHub 仓库创建并推送

## 5. 提交记录（git log）

| Commit | 说明 |
| --- | --- |
| 230f4bd | chore: baseline commit before visual enhancement |
| 6be8550 | docs: verify and document 4 legacy bug fixes + add screenshot analysis tool |
| 6225b9b | feat: stardew-style visual enhancement（1249 行新增） |

GitHub 仓库：https://github.com/northernmelody/pixel-room

## 6. 视觉强化验证摘要（像素采样）

| 项目 | 验证结果 |
| --- | --- |
| 四地面材质 | 卧室木(121,92,59) / 工作区地毯(97,104,120) / 卫生间瓷砖(163,178,185) / 厨房棋盘(86,55,43) — 全天可区分 |
| 窗户光斑(午) | 卧室窗下地板比远处亮 +31 RGB；工作区 +19；厨房 +7（深色砖吸收） |
| 月光(02:00) | 卧室窗下 +16，工作区 +7 且带蓝调 |
| 屏幕冷光(工作) | 显示器前方区域蓝通道 +55，小人的脸区域蓝通道 +30 |
| 缓存签名 | 灯状态变化时签名 summer|000000|1 → summer|000010|1 自动重建 |
| 交互回归 | 电脑弹窗 / 摸猫 / 吊灯/台灯开关 全部正常

## 5. 测试方法（无头浏览器 + 像素分析）

- 本地服务：`python -m http.server 8137`（或任意静态服务器）
- 时间调试：`index.html?t=HH:MM`
- 截图：agent-browser（session: pr-eb788c7746bf）
- 像素分析：`node _tools/analyze-png.js <mode> <png>`（ascii/region/lregion/crop/grid）
  - 画布在 1264x569 视口中居中：offset(147.5625, 12)，比例 3.02774 px/逻辑像素
- 画面状态验证：`agent-browser eval "..."` 读取 window.PixelRoom 内部状态

## 7. 本轮会话任务（2026-08 修复轮：界面修复 + 自动关灯 + 回滚）

> 基线：eb29716。本轮 6 个子任务均已提交并推送（见 §8）。

### 7.1 小人肤色与头部绘制（js/character.js）
- SKIN 改为暖黄偏白 `#f5e6c8`，新增 `SKIN_SHADOW` / `SKIN_HIGHLIGHT`
- `drawHead()` 重写为 12×12 头部：深棕轮廓（大 2px）+ 实色皮肤填充 + 下巴阴影 + 额头高光 + 头发/刘海 + 2px 眼睛（含白色高光）+ 嘴巴
- 关键：函数开头强制 `ctx.globalAlpha = 1`（重置透明度，防止光照叠加导致画面发灰）
- 全部姿势调用点适配新签名 `drawHead(ctx, x, y, direction)`

### 7.2 猫的绘制（js/cat.js）
- 新增 `drawCat()`：轮廓 + 身体 + 肚皮 + 条纹 + 头部 + 耳朵 + 眼睛 + 胡须，开头强制 `globalAlpha = 1`
- `draw()` 改为统一调用 `drawCat`（原 per-pose 绘制函数与 px/shadeCat 助手移除）

### 7.3 屏幕条纹修复（js/roomLayout.js / js/main.js / js/interaction.js / css/style.css）
- 根因：画布 **CSS 非整数缩放** → 逻辑像素行映射到宽窄不一的显示行（画布内坐标本就全为整数）
- `drawMonitorContent()`：x/y/w/h 入口全部 `Math.floor` + 不透明边框（大屏 2px / 小屏 1px）+ 背景 `#1e1e1e`
- `main.js fitSceneSize()`：场景画布 CSS 尺寸取整到 PIXEL(4) 整数倍，resize 时重算
- `interaction.js fitComputer()`：放大屏画布宽度取整到 16 的倍数（高 ×5/8 必为偶数）
- `style.css`：`#scene-wrap` 加 flex 居中

### 7.4 像素密集化（小人部分已回滚，见 7.6）
- 曾将小人头 12×12→16×16、身体 20×24；猫身体 16×10→20×12、头 8×8→12×12
- 细节：三层发色（HAIR/HAIR2/HAIR_HIGHLIGHT）、每 4px 一条衣物褶皱、猫毛 10% 确定性斑点、3px 眼睛+高光+反光
- **用户确认回滚小人**：见 7.6；猫保持放大版本
- 配套：interaction.js 摸猫判定区域加大（±11px × FLOOR-24）

### 7.5 自动关灯 autoLightsOff（js/lighting.js / js/character.js / js/main.js）
- `initDailyRandom()`：每天随机卧室关灯时刻 `23 + Math.random()`（23.0–24.0），存 `P.Storage.state.bedroomOffTime`（含 date，跨天重置），启动时由 main.js 调用
- `checkAutoLights()`（主循环每帧）：
  1. 23:00 关工作区/卫生间/厨房吊灯（`lamps.ceiling[1..3]`）+ 工作区台灯 `deskLamp`
  2. 当天随机时刻关卧室吊灯 `ceiling[0]` + 床头灯 `nightLamp`
  3. 小人入睡 5 分钟后关卧室吊灯（`P.Character.sleepInfo()`，已处理跨零点）
- character.js 新增 `sleepStartMin` 追踪与 `sleepInfo()` 导出
- 关键适配：关灯时置 `lamps.touched = true` 转手动模式（否则 lampOn() 夜间自动开灯会忽略关灯状态）
- 调试：`index.html?t=23:05`

### 7.6 回滚小人尺寸（js/character.js，本任务）
- 撤销 7.4 的小人改动：头部恢复 12×12、身体恢复 8×12、全部姿势坐标与影子恢复原值、移除 HAIR_HIGHLIGHT
- **保留**：7.1 的 SKIN 颜色与 drawHead 重写（含 alpha 重置）、7.5 的入睡时间追踪（均与尺寸无关）
- 猫保持 7.4 放大后的尺寸；interaction.js 摸猫区域保持加大
- 验证：`node --check` 通过；drawHead 调用点恢复 hx-6/hx-7/hx-5 原偏移

### 7.7 回滚猫尺寸并锁定橘色（js/cat.js / js/interaction.js）
- 撤销 7.4 的猫改动：身体恢复 16×10、头部恢复 8×8，移除毛斑点/鼻子/3px 眼睛
- **锁定橘猫配色**：PALETTES 精简为单一橘色（body `#e89a4a` / stripe `#c47a2e` / belly `#f7d9a8` / dark `#a0601f`），init() 不再按存档 catSeed 随机选色
- interaction.js 摸猫判定区域恢复 ±9px × FLOOR-16
- 保留：7.2 的 drawCat（16×10 身体 + 8×8 头 + globalAlpha 重置）、7.5 的自动关灯
- 验证：`node --check` 通过

## 8. 提交记录（本轮）

| Commit | 说明 |
| --- | --- |
| cd73248 | 界面修复（肤色/头部/猫/屏幕条纹）+ 自动关灯 + 回滚小人尺寸 + 本交接文档 |
| fb522ff | 回滚猫尺寸 + 锁定橘猫配色 + 交接文档更新 |

## 9. UI 响应式缩放（2026-08）

> 问题：Canvas 随屏幕缩放，但 HTML UI（时间卡片/按钮）用固定 px，手机上显得过大、遮挡画面。

### 方案（css/style.css，纯 CSS 改动，JS 无内联样式无需动）

1. **根字号 = UI 缩放基准**：`html { font-size: 16px }`，断点 `≤768px → 12px`、`≤480px → 10px`；
   横屏手机守卫 `@media (max-height: 500px) and (max-width: 900px) → 12px`。
2. **全部 UI 元素改用 rem**：`.ui-panel`（padding/圆角）、`#time-ui`（top/left/min-width）、
   `.time-main`/`.time-sub`、`#top-right`/`.icon-btn`、`#settings-panel`、`#computer-modal`/`.modal-box`、
   `#toast` 均随根字号等比缩放。桌面（≥768px 宽）视觉与旧版完全一致。
3. **手机（≤480px）微调**：时间卡片 `min-width` 216px→10rem、背景改半透明
   `rgba(8,12,24,0.45)`、隐藏 `#local-time` 行（只留主时间+作息行）；设置面板铺满宽度；
   电脑弹窗 padding 收紧。
4. **溢出保护**：`#time-ui` 加 `max-width: calc(100% - 1rem)`，`.time-sub` 加
   `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`。

### Canvas 缩放检查（无需改动）

- `main.js fitSceneSize()`：按视口取 `min(100vw-24, (100vh-24)*16/9)` 并取整到 PIXEL(4) 整数倍，resize 重算。
- `renderer.js`：内部固定 1280×720（逻辑 320×180），CSS 缩放由 `#scene-wrap` 处理。
- 实测各视口画布均保持 16:9 且像素对齐。

### 验证（agent-browser 实测计算样式 + 截图，见 `_shots/ui-*.png`）

| 视口 | 根字号 | 画布 | 时间卡片 | 图标按钮 |
| --- | --- | --- | --- | --- |
| 1600×900 桌面 | 16px（=100%） | 1556×872 | 26px 字体 / 312×95（与旧版一致） | 40×40 |
| 768×1024 平板 | 12px（75%） | 744×416 | 19.5px / 234×72 | 30×30 |
| 667×375 横屏手机 | 12px（守卫） | 624×348 | 19.5px / 234×72 | 30×30 |
| 375×667 手机 | 10px（62.5%） | 348×196 | 16.25px / 196×48（旧版 312×95=画布宽 90%） | 25×25 |

- 375px 下卡片/按钮全部在画布内，卡片不遮挡床/工作区区域（几何断言通过）；
- 设置面板手机端铺满宽度（341×146）且在按钮下方；电脑弹窗 345×247、内置画布 304×190（8:5）正常；
- 手机端 `#local-time` 隐藏生效，平板/桌面保留。

### 可选后续（本次未做）

- 手机上默认只显示时间、点击展开完整信息（需 JS 交互）；
- 10 秒无操作自动淡出时间卡片（需 JS 计时器）。

## 10. 聊天界面标题栏 MOMO（2026-08）

- 位置：`js/roomLayout.js` → `drawMonitorContent()` 的 `case 'chat'`。
- 新增 `PIXEL_FONT`（4×5 点阵字体表，M/O），聊天屏幕顶部绘制标题栏：
  - 放大屏（`w>=42 && h>=16`）：7px 标题栏（底色 `#1a2132` + 顶边/分隔线 `#2e3a56`）+ 点阵名字
    "MOMO"（`#8ab4ff`，1px 点距）；气泡下移至标题栏下方，数量按 `(h-10-headerH)/4` 自适应。
  - 极小屏（室内 16×18 显示器）：只画 2×2 在线绿点（`#4ae07a`），气泡布局保持不变。
- 验证：放大屏 getImageData 采样确认底色/边框/M·O 字形像素正确；室内小屏绿点+气泡正常
  （颜色受屏幕冷光叠加影响）；截图 `_shots/chat-momo-modal.png` / `chat-momo-scene.png`。

## 11. 功能迭代任务（2026-08：冰箱/餐桌/厕所/猫行为/连锁交互/物品动态变化）

> 任务目标：不新增系统，只完善已有元素的行为细节；保持现有架构/视觉/性能方案。
> 涉及文件：js/character.js、js/roomLayout.js、js/cat.js、js/interaction.js、js/storage.js、
> js/main.js、js/audio.js、js/renderer.js（无新增文件，无外部素材）。

### 11.1 冰箱与餐桌食物（js/character.js / js/roomLayout.js）
- 餐前取食材：每餐（早/午/晚）开始后，小人先走到冰箱前（x=277）→ 冰箱门开（约 2.2s，含开/关
  各 0.35s 过渡）→ 关门 → 上桌吃饭。`char.fridgePhase`：go→open→done。
- 冰箱门：`drawFridgeDoorDynamic()`（动态层）打开时绘制内部（层板 + 牛奶/蔬菜/果汁/鸡蛋/番茄/
  面包/冰格色块），门以宽度收缩模拟平开；冷气白雾 4 个白色像素从开口向上飘散（`fridgeOpen()` 暴露开度）。
- 餐桌食物：`drawMealFood()`（动态层）按 `P.Character.mealFood()` 绘制，出现即消失无端菜动作；
  食物随机——早餐 包子/面包/面条/鸡蛋，午餐 米饭炒菜/外卖盒/泡面，晚餐 面条/火锅/外卖；
  食物热气 3 个白色像素上升。盘子静态加宽到 9px，原静态米饭绘制移除。

### 11.2 厕所使用动画 + 马桶高度（js/character.js / js/roomLayout.js）
- 马桶坐面降到 y=114（原 106），小人坐下腿自然弯曲（大腿前伸 y113-117 + 小腿垂下 117-128）。
- 早晨洗漱流程（washPhase='brush' 时，`washSeq` 0-5）：到马桶前(x=215) → 坐下(4-6.5s) →
  冲水(1.3s，`P.Audio.flush()` 水声 + 水箱水花像素 + 按钮闪光) → 走去洗手台(x=186) →
  洗手(4.5s：水柱→搓洗→关水→毛巾) → 刷牙(原有)。晚上 22:00 仍为淋浴（不变）。
- 洗手水柱画在头部右侧（x=hx+9），避免被头遮挡；搓洗手部像素交替 + 泡泡；关水后毛巾擦手。
- 新姿势：fridge / toilet / flush / handwash；`drawToiletLegs()` 共享坐姿腿（裤子上半部下移：
  大腿根露内裤边 + 裤脚堆脚踝）。

### 11.3 猫行为扩展（js/cat.js / js/roomLayout.js）
- 新增攀爬点 `CLIMB_POINTS`（x=站立位，y=支撑面）：餐桌(262,110)、冰箱顶(274,86)、工作区桌面
  (122,108)、衣柜顶(8,56)、厨房吊柜顶(288,56)。状态机：climb（走到目标→跳上，0.38s 插值+弧线+
  落地 squash）→ perch（停留 durMin~durMax，餐桌 10-30s / 冰箱顶 20-60s / 桌面 5-20s / 柜顶 20-60s）
  → jumpdown（跳下）。
- 特殊行为：underbed（床下 x=20，只画尾巴+后爪，15-45s，crawlout 爬出）、scratch（窗帘 x=52 原地
  抓挠 5-15s，前爪+抓痕像素）、eat（猫粮碗 x=307，低头 2.5-4.5s，每次 `items.bowl--`，空碗不再去吃）。
- 猫粮碗：厨房角落 (305,124,5,3) 静态绘制，余粮 3 级递减；猫进食时碗重绘在猫身前保证可见。
- 上桌蹭饭：小人吃饭时 climb 权重 +10 且优先选餐桌；桌面停留时键盘猫爪 + 咖啡杯被推歪 1px + 泼溅
  （`drawDeskCatEffects` / `drawCoffeeCup` 读 `P.Cat.perchId()`，并入缓存签名）。
- 通用支撑面：猫新增 `c.y`（站立面高），绘制/影子/跳跃插值均基于它；移除旧 onDesk/deskY。

### 11.4 连锁交互（js/interaction.js / js/cat.js / js/character.js）
- 连续摸猫（`pet()` 3s 窗口计数）：第 1 次抬头喵 → 第 2 次蹭手（purr+爱心）→ 第 3 次翻肚皮
  （`drawBelly` 肚皮朝上）→ 第 4 次伸爪"够了"后起身走开（walkaway）；间隔超 3s 归零。
- 快速开关灯：`toggleLamp()` 内 5s 滑动窗口计数 ≥3 次且距上次惊吓 >30s → `P.Cat.frightened()`
  （跑向最近隐蔽点：床下/衣柜顶/吊柜顶，速度 26）+ `P.Character.react('lookup')` 抬头看一眼。
- 点击小人：判定区 当前位 ±15px × y∈[90,130]（猫/灯判定优先，避免挡住台灯开关）；随机 4 种反应
  挥手/点头/发呆惊醒（抖动+感叹号）/回头看，1.2-1.8s 冻结当前活动，结束后继续原状态；
  睡觉/淋浴中不反应。

### 11.5 物品动态变化（js/storage.js / js/roomLayout.js / js/main.js）
- 状态存 `P.Storage.state.items`，按 `items.date` 记录，跨天自动更新；主循环每帧
  `ensureDaily()`（跨天：猫粮续满 3、快递箱每日 29% 出现/1-3 天后拆开）+
  `syncItems()`（按当前时刻刷新 咖啡杯/被子/水槽碗，仅在变化时 save）。
- 咖啡杯（工作区桌面 132,105,3,4）：8.5 满杯 → 上午 4→2 → 下午 2→0（17.5 见底）→ 晚间洗漱洗掉
  → 次日重新满杯；液面 0-3px 深棕像素，高度 = round(cup/4*3)。
- 被子（床）：睡觉 22.5-7.5 平整盖身(cover) / 睡前 21.5-22.5 整齐叠床尾(made) / 白天乱糟糟
  堆床尾+歪斜+垂落(messy)。
- 猫粮碗：猫每次吃 -1，空碗保持，次日自动续满。
- 快递箱（门口 x=310,118,7,7）：纸箱+胶带+面单；拆开后小物件随机出现在预设点
  （书架摆件/厨房杯子/卧室挂画/桌面盆栽/卫生间花瓶），箱消失。
- 水槽碗：8.5（早餐后）出现于厨房水槽，22:00 洗漱洗掉。
- 离屏缓存：`renderer.js staticSignature()` 追加 items 各字段 + mealFood + catPerch，
  状态变化自动重建（已验证 bowl/blanket/pkg 变化触发签名更新）。

### 11.6 顺手修复：存档引用 bug（js/storage.js）
- 原代码 `P.Storage.state = state` 在对象字面量创建时捕获引用，`load()` 内 `state = merge(...)`
  重赋值后外部 `P.Storage.state` 仍指向旧对象 → 刷新页面后读到的存档是默认值（影响全部存档项）。
- 修复：`load()` / `reset()` 内合并/重置后同步 `P.Storage.state = state`。
- 验证：写入 bowl=1 + pkg arrived 后刷新，状态原样恢复。

### 11.7 验证摘要（agent-browser 无头 + canvas 像素采样）
| 项目 | 结果 |
| --- | --- |
| 冰箱门开合 | fridgePhase open 时 `fridgeOpen().p` 0→1→0；内部层板+食物色块、门上白雾像素(78-82 行)可见 |
| 餐桌食物 | 早餐 noodles / 午餐 rice / 晚餐 noodles 均随机出现，盘上有食物+热气；吃完消失 |
| 厕所流程 | 07:40 实测 toilet(4.5s)→flush(1.3s)→handwash(4.5s)→brush；水柱蓝像素 [111,152,183] 水开时出现 |
| 猫攀爬 | perch fridge(y=86) 20-60s / perch wardrobe(y=56)；climb 行走→跳→落地；scratch(窗帘 x=52) 触发 |
| 猫吃粮 | eat 走到 x=307，bowl 3→2→1；空碗不触发 eat；次日 ensureDaily 续满 |
| 连续摸猫 | 4 连点 petLevel 1→2→3→4，末态 walkaway；间隔 >3s 归零（l2=1） |
| 快速开关灯 | 3 次点击（5s 内）→ catState=flee + charReact lookup |
| 点击小人 | 点击 (147,122) → react wave 1.2s 后清除 |
| 物品持久化 | 设置 bowl=1+pkg arrived 刷新后原样恢复；杯子/被子/水槽碗按时刻刷新 |
| 缓存签名 | items 变化（bowl 3→0、pkg none→arrived→opened）触发签名变化并重建 |
| 控制台 | 全程无报错；`node --check` 14 个 JS 全部通过 |
- 截图：`_shots/feat-breakfast-0805.png` / `feat-fridge-open.png` / `feat-dinner-1830.png` / `feat-toilet-flush.png`

### 11.8 提交记录（本轮）
| Commit | 说明 |
| --- | --- |
| 7d88fc4 | feat: 功能迭代（冰箱/餐桌/厕所/猫行为/连锁交互/物品动态变化）+ 存档引用修复 + 交接文档 |
