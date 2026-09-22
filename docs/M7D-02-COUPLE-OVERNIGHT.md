# M7D-02 — Couple Bedroom, Overnight Stay & Shared Sleep

日期：2026-09-23。生产入口：`/portrait/`。本规范继承并取代 M7D-01 中“晚间活动结束即离开”的旧规则。

## 权威生命周期

`portrait/js/couple.js` 是情侣在场、卧室活动、床、卧室灯光、电视和壁炉状态的唯一领域来源。所有结果仅由北京时间戳计算，不依赖随机数、页面是否经历过到访动画或渲染器内部状态。

```text
AWAY（白天）
→ VISITING（晚间到访与顶层休闲）
→ STAYING_OVERNIGHT（睡前、共同睡眠、共同醒来、离开途中）
→ AWAY（早晨离开后）
```

工作日沿用男主既有 07:20 起床点；共同醒来持续 5 分钟，女友约 07:35 离开。周六早晨 08:30 起床、09:15 离开；周日早晨 08:00 起床、08:45 离开。女友不加入男主完整晨间流程，离开后床立即恢复白天空床状态。

凌晨计算首先解析前一日拥有的留宿周期，因此直接打开或刷新 `01:00`、`03:00`、`04:00` 均会立即重建两人共同睡眠，不要求先观察前一晚。

## 每周睡前轮换

睡眠开始时间复用既有星期作息，而不是建立第二套时间表。

| 星期 | 睡眠开始 | 确定性睡前行为 |
| --- | --- | --- |
| 周一 | 23:00 | `BED_CHAT → SETTLING_TO_SLEEP → SLEEP_TOGETHER` |
| 周二 | 23:00 | `CUDDLE → SETTLING_TO_SLEEP → SLEEP_TOGETHER` |
| 周三 | 23:40 | `SETTLING_TO_SLEEP → SLEEP_TOGETHER` |
| 周四 | 23:00 | `BED_CHAT → KISS_GOODNIGHT（10 秒）→ SETTLING_TO_SLEEP → SLEEP_TOGETHER` |
| 周五 | 次日 00:15 | `CUDDLE → UNDER_BLANKET_INTIMACY → SETTLING_TO_SLEEP → SLEEP_TOGETHER` |
| 周六 | 次日 00:35 | `BED_CHAT → UNDER_BLANKET_INTIMACY → CUDDLE → SLEEP_TOGETHER` |
| 周日 | 23:05 | `BED_CHAT → CUDDLE → SETTLING_TO_SLEEP → SLEEP_TOGETHER` |

每晚在表中行为前先进入 `BED_PREP`。`UNDER_BLANKET_INTIMACY` 只是一种克制的场景状态：灯光变暗、两人靠近并被共享被子遮挡，被子每四秒最多变化一个像素；没有裸体、具体身体动作或循环性性行为动画。状态文字只显示“灯已经关了”。

## 双人床与渲染

原单人侧视床替换为贴后墙的浅 3/4 双人床组合绘制，包含双人床架、床垫、两个枕头、一张共享被子和床脚。床仍处于原卧室区域，不改变顶层正面剖视视角，也不侵占电视、壁炉、吉他和楼梯通道。

床状态为：

- `BED_EMPTY_DAY`
- `BED_READY_NIGHT`
- `BED_OCCUPIED_CHAT`
- `BED_OCCUPIED_CUDDLE`
- `BED_OCCUPIED_INTIMATE`
- `BED_OCCUPIED_SLEEP`
- `BED_OCCUPIED_WAKE`

角色身体先绘制、共享被子后绘制。男主保留光头轮廓与闭眼像素；女友保留紫色短发外轮廓。亲密状态提高被子遮挡，不显示站立腿部。床上占用时不再额外绘制站立人物，避免重复角色和重叠。

卧室灯光复用现有六灯与夜景系统：睡前使用暖床头灯，亲密/安睡准备状态转暗，睡眠关闭顶灯和床头灯，清晨恢复环境光。上床后电视关闭、Switch 空闲；壁炉在休闲结束后仅保留余烬，睡眠时熄灭。

## 状态文字与语义锚点

状态条保留季节前缀，并把卧室阶段映射为“秋夜/冬夜”等夜间文字；共同醒来与离开使用“秋晨/冬晨”。不会在 UI 中直接描述性行为。

新增锚点：`BED_LEFT`、`BED_RIGHT`、`BED_EDGE_LEFT`、`BED_EDGE_RIGHT`、`BED_PILLOW_LEFT`、`BED_PILLOW_RIGHT`、`BED_CENTER`。星期判断和床状态选择都在领域层完成；`scene.js` 只消费最终 `couple.bedState` 与 `couple.lightState`。

## 验证与已知限制

自动化覆盖白天空床、晚间到访、休闲结束后仍在场、每周睡前轮换、10 秒晚安吻、周五/周六抽象亲密状态、凌晨直达与重复重建、共同醒来、工作日和周末离开、双人床绘制计数，以及既有作息/宠物/交互回归。

已知限制：

- 床与睡眠人物是 Canvas 分层像素组合，不是独立可编辑精灵图文件。
- 上床使用既有语义锚点和导航，最后进入床内由状态切换完成；没有为短距离建立新的寻路系统。
- 女友早晨离开仍使用 M7D-01 的现有楼梯折线路径按世界时间插值，不持久化独立 NavigationController。
- 本任务没有情侣早餐、共同淋浴、对话系统、关系进度或玩家触发亲密行为。
