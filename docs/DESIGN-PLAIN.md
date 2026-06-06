# 周末本地活动 Agent — 设计说明（≤2 页 · 人话版）

> 正文与 [DESIGN.md](./DESIGN.md) **完全一致**，各节末尾附「人话」；技术细节以 DESIGN.md 为准。

**目标**：将「自然语言 + 出发点」转为 **4–6 小时可执行半日行程**（玩 → 吃 → 可选加项），并完成订座/排队/分享等闭环演示。  
**规划入口**：`shared/planning/` ← 前端 `plan-api.ts` / Edge `plan`  
**推荐模式**：`semantic+dag-recall+combo`（AI 只做语义与文案；选店由规则 DAG 完成）

> **人话**：选好出发点、说清需求，小喵给出下午能走的行程。AI 听懂并写文案，**不选店、不自动订座**；店由规则在北京演示库里定，你在表里自己点「立即预定」。

---

## 1. Planning 策略

### 1.1 总体思路

| 阶段 | 职责 | 实现 |
|------|------|------|
| 理解 | 话术 → 可计算约束 | 规则 **∥** `resolveHome` **∥** AI 语义（并行）→ `constraint-pipeline` |
| 召回 | Mock POI 筛候选 | 三池并行 → 跨池顺路 → 反馈环（≤2 轮） |
| 推荐 | 定一条行程 | `combo-selector` 玩×吃×加项 |
| 编排 | 时间轴 + Mock trace | `build-plan.ts`；**UI 订座仅用户点击** |
| 展示 | 摘要 + 行程表 + 追问 | `planToUi` + Edge `chat`，**不改已选 POI** |

POI：`shared/planning/beijing-zones.ts`（**34 商圈** Mock，含 **798艺术区**）；围栏无候选时全城兜底。距离为直线 km。

> **人话**：五步：听懂 → 捞店 → 定一条线 → 排时间 → 写摘要。表上初始全是「未预定」；数据是北京 Mock，不是实时美团。

### 1.2 约束理解

**规则**（`constraints.ts`）：场景、`departureHour`（默认 14）、`maxDistanceKm`（「别太远」→ 5）、低脂、商圈、`childAge`、`partyTotal`。

**AI 语义**：补全 JSON 字段，**不返回店名**。

**融合**（`constraint-pipeline.ts`）：硬距离围栏；软商圈加分；`durationHours`→分钟预算；「别太远」与 AI 半径冲突时 **收紧规则**。

> **人话**：关键词 + 出发点 + AI 一起算条件。「别太远」听你的；提到某商圈会加分，不会把别的区全删。AI 不给具体店名。

### 1.3 召回（Recall）

三池并行（`recall-pipeline.ts`），每池 Top≈8：围栏 → 场景过滤 → 履约降权 → 精排（相关 35% + 距离 30% + 履约 20% + 商圈 15%）→ MMR(λ=0.72)。`wantExtra=false` 跳过加项池。`cross-link` 玩→吃 3/5/8km 加分。池空/超时 → +2km、+45min 重召回（≤2 轮）。

> **人话**：三类店各约 8 家候选；不顺路、太远的去掉；满座餐厅降分不删。玩得好的附近，餐厅加分。不够就自动放宽再试，最多 2 次。

### 1.4 推荐（Recommend）

Top6 玩 × Top6 吃 × 可选加项；组合分含顺路/时间/多样性；满座同池换店。时间轴由 `timeline-builder.ts` 按 **动线模板** 编排：

| 模板 | 触发示例 | 顺序 |
|------|----------|------|
| `play_eat` / `play_eat_extra` | 默认 / 要加项 | 玩 → 吃 [→ 加项] |
| `play_eat_play` | 玩.*吃.*玩、多个景点 | 玩 → 吃 → 玩 |
| `eat_play` | 先吃、吃完再玩 | 吃 → 玩 |
| `eat_play_play` | 先吃 + 多处玩 | 吃 → 玩 → 玩 |

**正餐时段**：`mealKind` 午餐 **11:00–13:00** / 晚餐 **17:00–20:00**（话术或出发时刻推断），吃饭落点锚定在窗口内，而非紧跟出发时刻顺延。

> **人话**：不只有「先玩再吃」一种了。你说「先玩再吃再玩」「先吃午饭再逛两处」会排对应顺序；第二站「玩」从候选池再挑一家。午饭会落在 **11–13 点**，晚饭在 **17–20 点**，不会下午 2 点出发就把饭排在 4 点当午饭。

### 1.5 场景加权

| 场景 | 召回 | 推荐 |
|------|------|------|
| 家庭亲子 | `family_child`、户外、儿童餐 | 短时、低强度 |
| 朋友小聚 | `friends_social`、分享菜、加项 | 顺路聚餐 |

`scenario=unknown` 默认 `family`。

> **人话**：带娃偏亲子户外；朋友偏聚餐。认不出当家庭，不另提示。

---

## 2. 工具调用链路

### 2.1 链路总览

```text
[AskXiaoTuan] 用户发送（须已选出发点）
    ├─ ① 改行程（isItineraryEditRequest）→ insertPoiIntoItinerary，不重跑 DAG
    ├─ ② 追问（isFollowUpQuery）→ chat + followUpMemory，不重跑 DAG
    └─ ③ 新规划 → plan → planToUi（全 unbooked）→ chat 润色（compact 摘要 + 行程表 + 继续探索）
```

`findPlanAnchorIndex` 优先带 `itinerary` 的助手消息，避免追问抢 `planContext`。

> **人话**：三种发消息：**改表**（加 798）、**追问**（继续探索）、**新规划**（重算）。追问只多一段文字备选，**不重算 DAG**，但界面仍展示锚点那条的行程表/地图（备选需手动「换一个」或说店名改表才写入）。继续探索在行程表**下面**；半日不推荐住宿。

### 2.2 工具清单

| 工具名 | 类型 | 说明 |
|--------|------|------|
| `ai_semantic_extract` | 真实 | Planning 并行理解 |
| `attractions_nearby` / `restaurants_search` | Mock | trace only |
| `queue_status` | Mock | 排队 → 时间轴备注 |
| `hold_table` | Mock | **仅 trace**；行程表不自动「已预定」 |
| `preorder_bundle` / `notify_contact` | Mock | 预购/分享 trace |
| `chat` | 真实 | 润色 / 追问（`CHAT_FOLLOWUP`） |

Mock → `toolTrace`；DAG → `pipelineTrace`、`dagEdges`。

> **人话**：真的只有 AI 听懂和写字。搜店、订座是演示日志；**界面不会自动变已订**，要你点「立即预定」。

### 2.3 新规划成功路径

```text
并行理解 → 召回 → 组合 → [反馈环] → queue_status → hold_table(trace)
→ planToUi(unbooked) → chat → 用户点「立即预定」→ pending
```

**前端分支**：改行程 `itinerary-edit.ts`；追问 `follow-up-context.ts` + `explore-suggestions.ts`（半日不推住宿）；继续探索在行程表下方。

> **人话**：成功路径：算线 → 表全未预定 → 短摘要 → 你手点预定。改行程、追问不会误触发整单重算。

---

## 3. 异常处理

| 层级 | 策略 |
|------|------|
| 理解 | AI 失败 fail-fast |
| 召回/推荐 | 先反馈放宽（≤2 轮），仍失败抛错 |
| 履约 | 满座换店/备注；**不自动标 UI 已订** |
| 展示 | 润色失败仍保留行程卡 |
| 追问/改行程 | 锁定 POI + 候选池；catalog 未匹配则提示 |

| 异常 | 处理 | 用户可见 |
|------|------|----------|
| 未设出发点 | 拦截发送 | 选位置 |
| AI/FRIDAY 失败 | 中止 | 语义/配置错误 |
| 池空/超时 | 放宽后仍失败 | `PlanningError` |
| 满座 | 同池换店 | 备注排队 |
| chat 失败 | 规则摘要兜底 | 润色失败提示 |
| SSE 脏包 | 缓冲重试 | 通常无感 |

**排查**：`toolTrace`、`pipelineTrace`、`dagEdges`、`comboBreakdown`、`M-TraceId`；`.env` 用 `FRIDAY_APP_ID`（勿 `VITE_` 前缀）。

> **人话**：听不懂不凑假行程；没店先放宽。润色挂了表还在。追问别重复、别编店名。排查看 trace / `M-TraceId`；`FRIDAY_APP_ID` 别加 `VITE_` 前缀。

---

## 4. 前端与持久化

**展示顺序**：compact 摘要 → 行程表（删/换/预定）→ 继续探索 → 地图 Tab。餐厅与景点均需手点「立即预定」。

> **人话**：先看短摘要，再改表。点「删除」进下方 **「已移除」**，随时 **加回来**；刷新对话也还在。

**行程统一**：问小喵「添加到我的行程」→ `addChatPlanToItineraryTrips` 写入 `weekendmiao_itinerary_trips`；上/下一家走 `poi-swap.ts`（有序轮播）。

> **人话**：规划可 **加到行程 Tab**，和聊天同源北京库。行程表里 **换一家** 全城均匀随机；**上一家** 真实回退换店栈。地图路线用 **高德中文底图**（Leaflet + GCJ-02 纠偏），出发点→各站连线；时间轴两行排版防溢出。

**侧栏**：真实多会话（新建/切换/删除）；空对话不重复堆「新对话」。

> **人话**：侧栏是真历史，可删可切；不会一连点新建出一排空对话。

| Key | 内容 |
|-----|------|
| `weekendmiao_chat_sessions` / `_active_chat_id` | 聊天会话 |
| `weekendmiao_itinerary_trips` | 行程 Tab |
| `weekendmiao_favorite_trips` / `_saved_guides` | 收藏 |

本机 `localStorage` 持久化；无跨设备账号同步。

> **人话**：聊天、行程、收藏都在本机浏览器；换设备或清缓存会没，还没账号云同步。

| 真 | 假（Demo） |
|----|------------|
| Friday 语义 + chat | 真实 POI/订座 API |
| 规则 DAG + 用户点击预定 | 自动订座、探索静态数据 |

> **人话**：真的：听懂、写字、规则选店、你点预定。假的：真实美团检索、自动订座、探索页静态种草。

---

## 5. 运行（简）

```bash
npm install && npm start   # http://localhost:8081，见 README
```

**自测**：望京 + 带娃半日 → 继续探索追问 →「行程加上798」→ 手点预定。  
**示例**：家庭 —「今天下午带5岁孩子出去3小时，别太远，老婆减肥」；朋友 —「下午想和两男两女朋友玩4小时，附近就行」。

> **人话**：`npm install && npm start`（8081）；`.env` 配 `FRIDAY_APP_ID`，本地 Vite 代理三个接口。上线 deploy `plan` / `recommend` / `chat`。自测覆盖：规划、追问、加 798、手订、删了再加回。
