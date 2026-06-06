# 周末喵 · 设计说明

> **内网演示地址：** http://10.29.82.126:8081  
> **公网演示地址：** https://payments-citysearch-pdas-christina.trycloudflare.com

**目标**：将「自然语言 + 出发点」转为 4–6 小时可执行半日行程（玩 → 吃 → 可选加项），支持订座/换店/追问等闭环操作。

---

## 1. 规划策略

| 阶段 | 职责 | 实现 |
|------|------|------|
| 理解 | 话术 → 约束 | 规则解析 + AI 语义并行 → `constraint-pipeline` |
| 召回 | 筛候选 POI | 三池并行 → 精排 → MMR 去重 |
| 推荐 | 定行程 | `combo-selector` 玩×吃×加项 |
| 编排 | 时间轴 | `timeline-builder.ts` 按动线模板 |
| 展示 | 摘要 + 行程表 + 追问 | `planToUi` + `chat` 润色 |

POI 数据：34 个北京商圈 Mock；距离为直线 km；无候选时全城兜底。

---

## 2. 前端流程

```
用户发送
├─ 改行程 → insertPoiIntoItinerary（不重跑 DAG）
├─ 追问   → chat + followUpMemory（不重跑 DAG）
└─ 新规划 → plan → planToUi → chat 润色
```

- **预定**：全部 `unbooked`，用户手动点击「立即预定」变 `pending`
- **换店**：全城随机 + `swapHistory` 栈支持「上一家」回退
- **行程 Tab**：`addChatPlanToItineraryTrips` 写入 localStorage，支持取消预定、地图视图

---

## 3. 持久化

| Key | 内容 |
|-----|------|
| `weekendmiao_chat_sessions` | 聊天会话 |
| `weekendmiao_itinerary_trips` | 行程 Tab |
| `weekendmiao_favorite_trips` | 收藏 |

本机 localStorage，无账号同步。

---

## 4. 快速启动

```bash
npm install && npm start   # http://localhost:8081
```

**自测示例**：「今天下午带5岁孩子在望京玩3小时，别太远，老婆减肥」
