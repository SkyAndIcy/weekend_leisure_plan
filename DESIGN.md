# 周末喵 · 设计说明

> **内网演示地址：** http://10.29.82.126:8081  
> **公网演示地址：** https://payments-citysearch-pdas-christina.trycloudflare.com

**目标**：将「自然语言 + 出发点」转为 4–6 小时可执行半日行程（玩 → 吃 → 可选加项），支持订座/换店/追问等闭环操作。  
**技术栈**：React 18 + TypeScript + Vite · Supabase Edge Functions · Friday LLM（美团内部）· 高德地图

---

## 1. 规划策略

| 阶段 | 职责 | 实现 |
|------|------|------|
| 理解 | 话术 → 可计算约束 | 规则解析 **∥** AI 语义并行 → `constraint-pipeline` |
| 召回 | 筛候选 POI | 三池并行（玩/吃/加项）→ 精排 → MMR(λ=0.72) 去重 |
| 推荐 | 定一条行程 | `combo-selector` 玩×吃×加项组合评分 |
| 编排 | 生成时间轴 | `timeline-builder.ts` 按动线模板（`play_eat` / `eat_play` 等） |
| 展示 | 摘要 + 行程表 + 追问 | `planToUi` + Edge `chat` 润色，不改已选 POI |

**约束理解**：规则提取场景/距离/人数/低脂/商圈/儿童年龄；AI 语义补全 JSON 字段（不返回店名）；二者冲突时收紧规则。  
**召回精排**：相关性 35% + 距离 30% + 履约 20% + 商圈匹配 15%；池空时自动放宽半径 +2km 重召回（≤2 轮）。  
**正餐锚定**：午餐 11:00–13:00 / 晚餐 17:00–20:00，落点锚定在窗口内，不随出发时刻顺延。  
**POI 数据**：34 个北京商圈 Mock（含 798 艺术区）；距离为直线 km；无候选时全城兜底。

---

## 2. 前端流程

```
用户发送（须已选出发点）
├─ 改行程请求 → insertPoiIntoItinerary（不重跑 DAG）
├─ 追问       → chat + followUpMemory（锁定已有 POI，不重跑 DAG）
└─ 新规划     → plan DAG → planToUi（全 unbooked）→ chat 润色
```

- **预定**：全部初始为 `unbooked`，用户手动点击「立即预定」变 `pending`（待核销）
- **换店**：全城随机 + `swapHistory` 栈支持「上一家」回退；高德路线 API 实时更新地图
- **追问**：通过 `resolveLinkedPlanDisplay` 挂锚点行程表，追问气泡共享同一份行程
- **行程 Tab**：`addChatPlanToItineraryTrips` 写入 localStorage；支持取消预定、地图视图（LeafletRouteMap + 高德路线）

---

## 3. 异常处理

| 场景 | 策略 |
|------|------|
| 未设出发点 | 拦截发送，提示选位置 |
| AI / Friday 失败 | fail-fast，提示配置错误 |
| POI 池空 / 超时 | 放宽约束重召回（≤2 轮），仍失败抛 `PlanningError` |
| 满座 | 同池换店，时间轴备注排队 |
| chat 润色失败 | 规则摘要兜底，行程卡保留 |

---

## 4. 持久化

| Key | 内容 |
|-----|------|
| `weekendmiao_chat_sessions` | 多会话聊天记录 |
| `weekendmiao_itinerary_trips` | 行程 Tab 数据 |
| `weekendmiao_favorite_trips` | 收藏夹 |

全部存储于本机 `localStorage`，无账号体系，无跨设备同步。

---

## 5. 快速启动

```bash
npm install && npm start   # http://localhost:8081
```

**自测示例**：「今天下午带5岁孩子在望京玩3小时，别太远，老婆减肥」→ 追问「帮我加上798」→ 手点预定
