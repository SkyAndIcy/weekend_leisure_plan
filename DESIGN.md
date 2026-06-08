# 周末喵 · 设计说明

> **公网演示地址：** [https://modeling-committee-seventh-mixture.trycloudflare.com](https://modeling-committee-seventh-mixture.trycloudflare.com)

**目标**：将「自然语言 + 出发点」转为 4–6 小时可执行半日行程（玩 → 吃 → 可选加项），支持订座/换店/追问等闭环操作。  
**技术栈**：React 18 + TypeScript + Vite · Supabase Edge Functions · Friday LLM（美团内部）· 高德地图 API  
**推荐模式**：AI 只做语义理解与文案润色；选店、组合、时间轴全部由规则 DAG 完成，避免幻觉店名。

---

## 1. 规划策略

### 1.1 总体流程

| 阶段 | 职责 | 实现 |
|------|------|------|
| 理解 | 话术 → 可计算约束 | 规则解析 **∥** AI 语义并行 → `constraint-pipeline` |
| 召回 | 筛候选 POI | 三池并行（玩/吃/加项）→ 精排 → MMR(λ=0.72) 去重 |
| 推荐 | 定一条行程 | `combo-selector` 玩×吃×加项组合评分 |
| 编排 | 生成时间轴 | `timeline-builder.ts` 按动线模板 |
| 展示 | 摘要 + 行程表 + 追问 | `planToUi` + Edge `chat` 润色，不改已选 POI |

### 1.2 约束理解

- **规则**（`constraints.ts`）：提取场景、出发时刻、最远距离、低脂偏好、商圈、儿童年龄、人数
- **AI 语义**：Friday LLM 补全 JSON 字段，不返回具体店名，避免幻觉
- **融合**（`constraint-pipeline.ts`）：距离硬围栏；软商圈加分；规则与 AI 冲突时收紧规则

### 1.3 召回与推荐

**精排权重**：相关性 35% + 距离 30% + 履约 20% + 商圈匹配 15%；MMR 控制多样性。  
**反馈环**：池空或超时时自动放宽 +2km / +45min 重召回，最多 2 轮。  
**正餐锚定**：午餐 11:00–13:00 / 晚餐 17:00–20:00，落点锚定在窗口内，不随出发时刻顺延。  
**动线模板**：`play_eat`（默认）/ `play_eat_extra`（加项）/ `play_eat_play`（多景点）/ `eat_play`（先吃）。  
**POI 数据**：34 个北京商圈 Mock（含 798 艺术区）；距离为直线 km；无候选时全城兜底。

---

## 2. 前端流程

```
用户发送（须已选出发点）
├─ 改行程请求 → insertPoiIntoItinerary（不重跑 DAG）
├─ 追问       → chat + followUpMemory（锁定已有 POI，候选池防幻觉）
└─ 新规划     → plan DAG → planToUi（全 unbooked）→ chat 润色
```

**预定状态**：初始 `unbooked`，用户手点「立即预定」→ `pending`（待核销），行程 Tab 同步更新。  
**换店**：`poi-swap.ts` 全城随机 + `swapHistory` 栈支持「上一家」回退；换店后高德路线实时刷新。  
**追问**：`resolveLinkedPlanDisplay` 将追问气泡挂锚点行程表，多轮对话共享同一份行程。  
**地图路线**：调用高德驾车路线 API（`/api/amap-route` Vite 代理），替代直线连接，显示真实道路。

---

## 3. 行程 Tab

- **添加**：问小喵点「添加到我的行程」→ `addChatPlanToItineraryTrips` 写入 localStorage
- **同步**：chat 侧预定/换店/删除 → `syncActiveTripDays` 自动反向同步 active trip
- **操作**：支持换店、删除、恢复已删、取消预定、一键安排
- **地图视图**：`LeafletRouteMap` + 高德底图，POI 坐标从 catalog 按名称查找

---

## 4. 异常处理

| 场景 | 策略 | 用户可见 |
|------|------|----------|
| 未设出发点 | 拦截发送 | 提示选位置 |
| AI / Friday 失败 | fail-fast | 语义/配置错误提示 |
| POI 池空 / 超时 | 放宽约束重召回（≤2 轮） | `PlanningError` |
| 满座 | 同池换店 | 时间轴备注排队 |
| chat 润色失败 | 规则摘要兜底 | 行程卡正常保留 |
| 高德路线失败 | 降级为直线连接 | 地图仍可显示 |

---

## 5. 持久化

| Key | 内容 |
|-----|------|
| `weekendmiao_chat_sessions` / `_active_chat_id` | 多会话聊天记录 |
| `weekendmiao_itinerary_trips` | 行程 Tab 数据 |
| `weekendmiao_favorite_trips` / `_saved_guides` | 收藏夹与攻略 |

全部存储于本机 `localStorage`，无账号体系，无跨设备同步。

---

## 6. 快速启动

```bash
# 首次
cp .env.example .env   # 填入 FRIDAY_APP_ID 和 AMAP_KEY
npm install && npm start   # http://localhost:8081

# 内网共
npx vite --host 0.0.0.0 --port 8081
```

**自测路径**：选望京出发 → 「今天下午带5岁孩子玩3小时，别太远，老婆减肥」→ 继续探索追问「加上798」→ 手点预定 → 切行程 Tab 查看地图路线
