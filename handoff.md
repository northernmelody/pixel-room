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
- [ ] 地面材质分区
- [ ] 背景墙分层
- [ ] 家具立体感
- [ ] 窗户光斑
- [ ] 深度分层
- [ ] 光影叠加
- [ ] 像素细节
- [ ] 离屏缓存
- [ ] 前后对比截图
- [ ] 推送 GitHub

## 5. 测试方法（无头浏览器 + 像素分析）

- 本地服务：`python -m http.server 8137`（或任意静态服务器）
- 时间调试：`index.html?t=HH:MM`
- 截图：agent-browser（session: pr-eb788c7746bf）
- 像素分析：`node _tools/analyze-png.js <mode> <png>`（ascii/region/lregion/crop/grid）
  - 画布在 1264x569 视口中居中：offset(147.5625, 12)，比例 3.02774 px/逻辑像素
- 画面状态验证：`agent-browser eval "..."` 读取 window.PixelRoom 内部状态
