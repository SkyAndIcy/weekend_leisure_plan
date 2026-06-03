# 周末本地活动 Agent — 设计说明（技术版 + 人话说明）

> 纯技术版（无说明）见 [DESIGN.md](./DESIGN.md)

**目标**：将「自然语言 + 出发点」转为 **4–6 小时可执行半日行程**（玩 → 吃 → 可选加项），并完成订座/排队/分享等闭环演示。  
**代码入口**：`src/lib/recommendation/planner.ts` → `pipeline/dag-orchestrator.ts`  
**推荐模式**：`semantic+dag-recall+combo`（AI 只做语义；选店由规则 DAG 完成）

> **人话**：你说一句话并选好出发点，系统给出一份下午能照着走的行程（先玩、再吃、可选第三段），并演示订座、排队、分享。大模型只负责「听懂」和「写好文案」，具体选哪家店由本地规则引擎在演示店铺库里完成。

---

## 1. Planning 策略

### 1.1 总体思路

| 阶段 | 职责 | 实现 |
|------|------|------|
| 理解 | 把用户话术变成可计算约束 | 规则正则 **∥** `resolveHome(出发点)` **∥** AI 语义（`dag-orchestrator` 内 `Promise.all` 并行）→ 汇聚融合 |
| 召回 | 从 Mock POI 目录筛候选 | 三池并行（景点 / 餐厅 / 加项?）→ 跨池顺路加权 |
| 推荐 | 定一条完整行程 | 玩×吃×加项 组合搜索 + 顺路/时间/多样性打分 |
| 编排 | 可执行时间轴 + 履约 | 固定缓冲 + Mock 工具链 |
| 展示 | 杂志风文案 | Edge `chat` 润色，**不得改已选 POI** |

数据现状：POI 来自 `src/data/poi-catalog.ts`（北京 Mock）；距离为直线 km，生产可换 LBS / 美团检索 API。

> **人话**：整条链路分五步——听懂需求、从库里捞候选、试组合定一条、排时间表并用 Mock 模拟排队/订座/预购（演示闭环，非真实下单）、最后用 AI 润色展示。店铺目前是北京的演示数据，距离按直线公里算，以后可接真实定位和美团检索/履约 API。

### 1.2 约束理解（Planning 输入）

**规则 baseline**（`constraints.ts`）：场景（家庭/朋友）、`departureHour`（默认 14）、`maxDistanceKm`（默认 8，「别太远」→ 5）、低脂、商圈词、`childAge`、`partyTotal`。

**AI 语义**（Edge `recommend`，必选）：补全/修正 `scenario`、`departureHour`、`maxDistanceKm`、`durationHours`、`wantExtra`、`intentSummary` 等 JSON 字段，**不返回店名、不选店**。

**融合与裁决**（`constraint-pipeline.ts`）：

- **硬约束**：`hardMaxDistanceKm`，超出地理围栏直接剔除。  
- **软约束**：`softLocationBlocks`，命中商圈只加分。  
- **时间预算**：`durationHours` → `timeBudgetMin`（分钟区间）。  
- **冲突**：用户强调「别太远」而 AI 半径更大时，**采用更紧规则距离**。

> **人话**：输入分三路同时跑——正则抓关键词、出发点定圆心、云端 AI 补语义，最后合成一套条件。规则管默认（如下午 2 点走、最远 8km）；AI 只补 JSON 字段，不给店名。太远的一律不要；提到某商圈只加分不硬删；你说玩 3 小时会换成分钟预算。若你说「别太远」而 AI 给了更大范围，以更紧的规则距离为准。

### 1.3 召回策略（Recall）

三池 **并行** 执行相同子流程（`recall-pipeline.ts`），每池产出约 **Top 8** 候选：

1. **地理围栏**：距离 ≤ 硬上限 + 2km 缓冲。  
2. **场景意图**：相关分低于门槛（家庭/朋友 35）且非加项类 → 剔除。  
3. **可履约**：满座餐厅不删，在精排「履约」维降权。  
4. **多目标精排**：相关 35% + 距离 30% + 履约 20% + 商圈 15%。  
5. **MMR 多样性**：λ=0.72，避免候选扎堆同一商圈。

**条件分支**：`wantExtra=false` 时 **跳过加项池**。

**跨池联动**（`cross-link.ts`）：用景点 Top3 作锚点，按玩→吃距离 3/5/8km 梯度给餐厅池加分并重排。

**反馈环**（DAG，最多 2 轮）：若后续推荐判定 `empty_pool` 或 `time_overflow`，则距离 +2km、时间上限 +45min 后 **重新并行召回**。

> **人话**：景点、餐厅、加项三类店并行筛，每类大约留 8 家。太远或与场景不搭的去掉；满座餐厅不删，只在「能不能订上」上降分；打分兼顾相关、距离、履约、商圈，并避免全挤同一商圈。不要第三段就只筛玩和吃。用玩得好的前几名当锚点，离玩越近的餐厅加分越高。若后面发现候选太少或时间排不下，自动放宽距离和时间再捞一轮，最多 2 次。

### 1.4 推荐策略（Recommend）

在召回候选上做 **联合组合优选**（`combo-selector.ts`）：

- 搜索空间：约 Top6 玩 × Top6 吃 × (Top4 加项 | 无加项)。  
- **组合分** = 0.42×玩 + 0.38×吃 + 0.12×加项 − 顺路罚分 − 时间罚分 + 跨商圈多样性奖。  
- **满座护栏**：最优餐厅 `tablesLeft===0` 时，在同池换有座候选并重算。  

输出：`comboBreakdown`、最终 `timeline`（玩 → +20min → 吃 → +15min → 加项）。

> **人话**：在候选里试「哪家玩 + 哪家吃 + 要不要加项」，按组合总分选最好的一条（顺路、能否在你说的小时内走完、商圈别太单一）。首选餐厅满座就同池换一家有座的。定稿后时间轴是：玩 → 路上 20 分钟 → 吃 → 路上 15 分钟 → 加项。

### 1.5 场景化加权（摘要）

| 场景 | 召回偏向 | 推荐侧重 |
|------|----------|----------|
| 家庭亲子 | `family_child`、`outdoor`、低脂/儿童餐 | 时长贴合、低强度动线 |
| 朋友小聚 | `friends_social`、`share_plates`、展览/citywalk | 社交氛围、顺路聚餐 |

> **人话**：家庭更偏亲子、户外、低脂；朋友更偏社交、分享菜、展览或 citywalk。场景识别不出来时默认按家庭处理，不单独提示。

---

## 2. 工具调用链路

### 2.1 链路总览

```text
[前端] 用户发送
    │
    ├─► Edge recommend (Friday/Lovable)     … ai_semantic_extract（仅语义 JSON）
    │
    ├─► DAG 本地编排（`runPlanningDag`）     … 召回 + 组合推荐（无真实 HTTP 检索）
    │       ├─ mock: attractions_nearby      … 约束汇聚后，记录检索意图（trace）
    │       ├─ 并行召回 → mock: restaurants_search … 每轮召回后（含反馈重试轮）
    │       └─ 跨池联动 → 组合评估 → [反馈环] → 履约修补（满座换店）
    │
    ├─► planner 定稿后 Mock 履约（`buildWeekendPlan`）
    │       ├─ queue_status(餐厅)
    │       ├─ hold_table(餐厅, 人数)
    │       ├─ [preorder_bundle]             … 家庭且话术含蛋糕/鲜花/生日
    │       └─ notify_contact(分享文案)
    │
    └─► Edge chat (Friday/Lovable)           … 流式润色文案；行程卡/地图用 planToUi
```

> **人话**：用户发送后，先调云端 AI 只理解语义；本地 DAG 负责筛店和选组合（其中的「搜景点/搜餐厅」是 Mock，只记日志、不改变规则选店结果）；定稿后由 `mock-tools` 模拟排队、订座、预购并生成分享句（不调用真实餐厅接口）；最后云端 AI 润色文案，行程卡和地图仍用规则结果，不能改已选店铺。

### 2.2 工具清单与触发条件

| 工具名 | 类型 | 触发时机 | 输入要点 | 输出/作用 |
|--------|------|----------|----------|-----------|
| `ai_semantic_extract` | 真实 Edge | Planning 开始，与规则/地理并行 | `userText`、`location`、`ruleHints` | 语义 JSON；写入 `toolTrace` |
| `attractions_nearby` | Mock | 约束汇聚后 | 圆心 lat/lng、`radius_km` | trace only |
| `restaurants_search` | Mock | 并行召回后 | `scenario`、`low_cal`、`party` | trace only |
| `queue_status` | Mock | 餐厅定稿后 | `place_id` | `queueMin` → 时间轴备注 |
| `hold_table` | Mock | 排队后 | `party` | `MockBooking`；满座则 queued |
| `preorder_bundle` | Mock | 家庭 + 关键词 | 送达餐厅 | 预购单 trace |
| `notify_contact` | Mock | 时间轴生成后 | 一句话行程摘要 | 分享文案 |
| `chat/completions` | 真实 Edge | Planning 成功后 | `planContext` + 对话历史 | 流式 Markdown；**不改 POI** |

所有 Mock 调用结果追加至 `WeekendPlan.toolTrace`；DAG 节点与有向边分别记入 `pipelineTrace`、`dagEdges`。

> **人话**：真调用的只有 AI 语义和 AI 文案；其余是演示「能办成事」。Mock 结果都记在 `toolTrace` 里，DAG 步骤记在 `pipelineTrace` 和 `dagEdges` 里，方便排查。

### 2.3 成功路径时序

```text
并行理解（规则 ∥ resolveHome ∥ Edge recommend）
  → 约束汇聚 → attractions_nearby
  → 并行召回 → restaurants_search → 跨池联动 → 组合评估
  → [可选] 反馈放宽重召回（再次 restaurants_search + 跨池 + 组合，最多 2 轮）
  → 履约修补（满座换店，finalizeCombo）
  → planner：时间轴 → queue_status → hold_table → [preorder_bundle] → notify_contact
  → planToUi + chat 润色
```

> **人话**：正常成功时就是「并行听懂 → 捞候选 → 试组合（必要时放宽重试）→ 满座换店定稿 → 排时间轴并走 Mock 履约 → 出行程卡再润色文案」。

---

## 3. 异常处理机制

### 3.1 分层处理原则

| 层级 | 策略 |
|------|------|
| 理解层 | AI 语义失败 **fail-fast**，不降级纯规则行程 |
| 召回/推荐层 | 池空/时间超标 **先反馈放宽重试**（≤2 轮），仍失败再抛错 |
| 履约层 | 满座、排队 **组合内换店 / 备注**，不中断整单 |
| 展示层 | 规划与润色分离；润色失败仍展示 `planToUi` 行程卡 + 规则兜底文案 |

> **人话**：四句话——听不懂 AI 就整单失败，不凑假行程；候选不够或时间太紧先自动放宽再试；满座就换店或备注，不中断；文案 AI 挂了行程卡照样有。

### 3.2 异常对照表

| 异常 | 检测 | 处理 | 用户可见 |
|------|------|------|----------|
| 未设置出发点 | 前端 `hasLocation` 为 false | 拦截发送，弹位置选择 | 提示先选位置（须 `located`/`manual`/坐标/地址） |
| AI 语义失败 | `recommend` 非 2xx / JSON 无效 | 中止 Planning | `AI 语义理解失败：…`（`AiSemanticError`） |
| FRIDAY 未配置 | Edge 450/451 等 | 同上 | 部署/配置提示 |
| 场景未知 | `scenario=unknown` | 默认 `family` | 无单独提示 |
| 约束冲突（就近 vs AI 半径） | 规则关键词 + AI km | 收紧硬距离，写 DAG 日志 | 无 |
| 加项不需要 | `wantExtra=false` | 跳过加项池与加项组合 | 时间轴两段 |
| 召回池空 | 玩或吃候选为 0 | 反馈环放宽 → 重召回；仍空则 `throw` | 通用失败文案 |
| 组合时间超标 | `timePenalty > 25` | 反馈环放宽 → 重召回；可降级选用当前最优 | 正常出卡或失败 |
| 最优餐厅满座 | `tablesLeft===0` | 同池换有座餐厅 | 时间轴注明订座/排队 |
| 无加项候选 | 加项池空 | 组合不含加项 | 两段行程 |
| chat 润色失败 | 流式请求失败 | 保留 `planToUi` 行程卡；正文用 `summary`+`notifyText` 兜底 | 提示「润色失败，已展示规则引擎行程」 |
| 对话 SSE 脏包 | JSON 解析失败 | 缓冲重试下一行 | 通常无感 |

> **人话**：没选出发点不让发；AI 或 Key 有问题直接失败；池空或时间太紧先放宽再试；满座换店；不要加项或加项池空就两段行程；润色失败仍看行程卡；流式偶发脏包一般用户无感。

### 3.3 可观测与排查

- **业务**：`toolTrace`（工具级）、`pipelineTrace` + `dagEdges`（DAG 级）、`comboBreakdown`（推荐级）。  
- **LLM**：`M-TraceId` / `biz_session_id`（`friday-trace.ts` → Edge）。  
- **配置**：`FRIDAY_APP_ID` 优先，否则 `LOVABLE_API_KEY`；密钥勿入库。

> **人话**：出问题先看 `toolTrace`（每个工具干了啥）、`pipelineTrace`/`dagEdges`（DAG 走到哪）、`comboBreakdown`（为啥选这条组合）；大模型调用看 `M-TraceId`；配置优先用 `FRIDAY_APP_ID`，别把密钥提交 Git。

---

## 4. 运行（简）

```bash
npm install && npm start
# 见 README：.env 与 supabase functions deploy
```

**示例话术**：家庭 —「今天下午带5岁孩子出去3小时，别太远，老婆减肥」；朋友 —「下午想和两男两女朋友玩4小时，附近就行」。

> **人话**：本地 `npm install && npm start` 即可跑前端；云端 Edge 需按 README 配 `.env` 并 `deploy recommend` 与 `chat`。可用上面两句话术自测家庭和朋友场景。
