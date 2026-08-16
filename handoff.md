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

## 8. 提交记录（本轮）

| Commit | 说明 |
| --- | --- |
| （见 git log，本轮会话提交） | 界面修复（肤色/头部/猫/屏幕条纹）+ 自动关灯 + 回滚小人尺寸 + 本交接文档 |