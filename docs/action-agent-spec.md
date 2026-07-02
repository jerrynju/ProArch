# Action Registry 与 Agent 子协议规范 (v0.1)

> 配套文档:《Cell 数据模型与 Notebook 文件格式规范 v0.1》《Kernel 消息协议规范 v0.1》。
> 本文档为两者的增量扩展,不修改既有不变量。
>
> 两条核心原则:
> 1. **Action 是声明式注册表,三视图只是它的投影** —— 与 cell 模型的
>    view-agnostic 原则同构。
> 2. **Agent 是 kernel 的对等客户端** —— 只说标准协议,无特殊后门;
>    一切 agent 行为可观察、可审批、可整轮撤销。

---

# Part A:Action Registry

## A1. 数据模型

Registry 驻留在 **Flutter UI 层**(action 过滤所需状态——DagSnapshot、CellStatus、
EvalError、当前视图、选区——全部已在 UI 侧,过滤零协议往返)。声明本身跨语言
(内置 action 编在 Dart 里;domain package 贡献的 action 以 JSON 随能力集下发),
故以 serde/JSON 定义:

```rust
#[derive(Serialize, Deserialize)]
pub struct ActionDecl {
    /// 命名空间化 ID:内置 "cell.*" / "nb.*" / "view.*" / "agent.*";
    /// domain package 为 "pkg.<name>.*",如 "pkg.rf.plot_smith"
    pub id: String,
    pub title: String,               // i18n key,UI 侧解析
    pub icon: String,                // 图标名(内置图标集)
    pub when: Applicability,
    /// 0–100,受限空间(Feed 卡片)按此截断;同分按 id 稳定排序
    pub priority: u8,
    pub invoke: Invocation,
    /// 分组:primary | edit | insert | ai | export | danger
    pub group: ActionGroup,
    #[serde(default)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}
```

### A1.1 Applicability —— 受限谓词语言

刻意不用表达式字符串(避免在 UI 里嵌一个解释器),用可 AND 的字段集合,
每个字段缺省 = 不限制:

```rust
#[derive(Serialize, Deserialize, Default)]
pub struct Applicability {
    pub views:       Option<Vec<ViewMode>>,        // feed | read | calc
    pub cell_kinds:  Option<Vec<CellKindTag>>,     // markdown | code | param | data
    pub eval_states: Option<Vec<CellStateTag>>,    // ok | errored | stale | running | blocked
    /// 输出中存在指定 MIME(前缀匹配),如 "application/vnd.apache.arrow"
    pub has_output_mime: Option<Vec<String>>,
    /// 依赖 create_session 能力集,如 "agent"、"pkg.rf"
    pub requires_capability: Option<Vec<String>>,
    pub selection: Option<SelectionKind>,          // single_cell | multi_cell | notebook
}
```

语义:所有出现的字段取 AND;字段内列表取 OR。表达力不足时宁可增加结构化
字段(小步演进,serde 未知字段兼容),也不引入表达式语言。

### A1.2 Invocation —— 四种执行通路

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Invocation {
    /// 纯前端:折叠/复制/切换 view_hint/进入卡片编辑。不产生协议消息
    UiLocal { command: String, args: serde_json::Value },

    /// 映射到既有协议 Request 的模板。占位符:{cell_id} {selection} {param_name}
    Protocol { request: RequestTemplate },

    /// 插入模板 cell(经 InsertCell 请求落地)。
    /// 占位符从上下文解析:{var} = 选中 cell 的首个 defines 符号
    InsertSnippet { kind: CellKindTag, template: String },

    /// 触发 agent 轮次,见 Part B。prompt 模板 + 上下文范围 + 执行模式
    Agent {
        prompt_template: String,      // "解释 cell {cell_id} 的错误并修复"
        scope: ContextScope,          // 见 B3.1
        mode: AgentMode,              // auto | propose,缺省 propose
    },
}
```

`Invocation::Agent` 使"AI 快捷操作"与普通按钮同属一套注册/过滤/排布机制——
**不存在第二个扩展体系**。

## A2. 三视图投影策略

| 视图 | 呈现 | 截断规则 |
|------|------|----------|
| **Feed** | 卡片底部 action 条 | `group=primary` 且 priority 前 2–3 项;其余入 "⋯" 溢出面板;`danger` 组永不直接外露 |
| **Calc** | cell 悬浮工具条 + 全局斜杠命令面板 | 工具条按 group 分段全量展示;`/` 面板可模糊搜索全部适用 action(含 Agent 类) |
| **Read** | 极简 | 仅 `view.*` 导航/折叠类 + 溢出菜单;编辑类 action 在 Read 模式的 Applicability 中默认排除 |

规则:视图差异**只允许**体现在呈现策略与 `Applicability.views` 字段,不允许
出现"仅为某视图注册的私有 action 机制"。

## A3. Domain package 的 action 贡献

package manifest 增加 `actions: Vec<ActionDecl>` 节。分发路径:

```
create_session → Reply::NotebookOpened 携带
  capabilities: ["agent", "arrow", "pkg.rf@1.2", ...]
  package_actions: Vec<ActionDecl>       // 已按已装包合并
```

约束:

- package 只能注册 `InsertSnippet` 与 `Agent` 两类 Invocation
  (`UiLocal`/`Protocol` 保留给内置,防止包获得任意 UI/协议能力)。
- id 必须落在 `pkg.<自身名>.*` 命名空间,越界注册被 kernel 拒绝。
- 卸载包 / 打开未装该包的 notebook 时,相关 action 因
  `requires_capability` 不满足而自然消失,无需清理逻辑。

## A4. 内置 action 基线(节选,示意谓词写法)

| id | when(简写) | invoke |
|----|------------|--------|
| `cell.execute` | code∣param, calc∣feed | Protocol: ExecuteCell |
| `cell.interrupt` | state=running | Protocol: Interrupt{generation} |
| `cell.fix_error` | state=errored, cap=agent | Agent: "修复该错误", scope=cell_with_upstream, propose |
| `cell.explain` | code, cap=agent | Agent: "解释这段计算", scope=cell, auto(只读轮次) |
| `param.sweep` | kind=param | InsertSnippet: 扫频绘图模板 |
| `data.export` | has_mime=arrow | UiLocal: 导出 CSV/Arrow |
| `pkg.rf.plot_smith` | has_mime=vnd.qnb.rf.sparams, cap=pkg.rf | InsertSnippet |

---

# Part B:Agent 子协议

## B1. 架构位置

```
Flutter UI ── AgentPrompt/AgentEvent ──┐
                                       ▼
                    ┌─────────────────────────────┐
                    │ Agent Orchestrator (Rust核心) │──── LLM API (出网)
                    │  · 上下文组装 (scope → prompt) │
                    │  · 工具循环 (tool-use loop)    │
                    └──────────┬──────────────────┘
                               │ 标准 Request/Event(与 UI 同一协议、同一 session)
                               ▼
                            Kernel
```

不变量:

- **Orchestrator 与 UI 是 kernel 的两个对等客户端**,共享 session。agent 对
  notebook 的每一次修改都以标准协议消息发生,因此天然出现在事件流里,
  所有视图自动同步——不存在 agent 专用的状态同步路径。
- **Agent 的工具集 = 既有 Request 的白名单子集**,见 B4。kernel 不为 agent
  暴露任何 UI 不可达的能力。
- LLM 网络调用只发生在 Orchestrator;kernel 与 UI 均不出网。离线/无 key 时
  `capabilities` 不含 `"agent"`,全部 AI action 自然隐没(A1.1 谓词兜底)。

## B2. 协议增量总览(相对协议规范 v0.1 的全部改动)

1. `Envelope` 增加 `origin: Origin { User, Agent { turn_id: Ulid }, System }`。
2. 新增 iopub 事件 `CellsChanged`(结构编辑广播,同时补齐分屏多视图同步)。
3. 新增 Request:`AgentPrompt` / `AgentAbort` / `ResolvePending`;
   新增 Event:`AgentEvent`。
4. kernel 增加 **op journal**(操作日志)与 **pending 变更层**。

以上均为增量(新枚举变体 + 新可选字段),按协议规范 §8 属非破坏变更,
`protocol` 版本不变,通过能力集 `"agent"`、`"pending"`、`"journal"` 协商。

## B3. 消息定义

```rust
// ---- Requests ----
AgentPrompt {
    turn_id: Ulid,                    // 客户端生成,贯穿整轮
    text: String,                     // 已渲染的最终 prompt(模板在 UI 侧展开)
    scope: ContextScope,
    mode: AgentMode,                  // auto | propose
    /// 只读轮次:工具白名单退化为 {Inspect, ReadCell, ReadEvents},
    /// 用于"解释"类 action,无副作用、无需审批
    read_only: bool,
},
AgentAbort { turn_id: Ulid },
/// 审批 propose 模式的 pending 变更
ResolvePending {
    turn_id: Ulid,
    decision: PendingDecision,        // accept_all | reject_all
                                      // | partial { accept: Vec<Ulid> }  (按 cell)
},

// ---- Events ----
AgentEvent {
    turn_id: Ulid,
    kind: AgentEventKind,
},
enum AgentEventKind {
    Delta       { text: String },                 // 对话流式文本
    ToolCall    { call_id: Ulid, tool: String, summary: String },  // 人可读摘要
    ToolResult  { call_id: Ulid, ok: bool, summary: String },
    /// propose 模式:pending 变更集就绪,等待 ResolvePending
    PendingReady { ops: Vec<CellOp>, shadow_generation: Option<u64> },
    Done        { outcome: TurnOutcome },          // completed | aborted | error{msg}
}

CellsChanged {
    origin: Origin,
    ops: Vec<CellOp>,
    /// true = pending 层变更(尚未落盘,渲染为高亮/虚线态)
    pending: bool,
}
enum CellOp {
    Insert { after: Option<Ulid>, cell: Cell },
    Update { cell_id: Ulid, source: String },
    Delete { cell_id: Ulid },
    SetParamValue { cell_id: Ulid, value: ParamValue },
}
```

### B3.1 ContextScope —— 上下文注入范围

```rust
enum ContextScope {
    Cell        { id: Ulid },                 // 该 cell 源码
    Subgraph    { id: Ulid, up: bool, down: bool },  // DAG 上/下游闭包
    Selection   { ids: Vec<Ulid> },
    Notebook,                                 // 全文(markdown 方言原文)
}
```

组装规则(Orchestrator 内实现,声明于此以固定语义):

- 基底 = notebook frontmatter(title/packages)+ scope 内 cell 的**磁盘格式原文**
  (markdown 方言本身即 LLM 最优上下文,复用数据模型规范 §4)。
- scope 内 errored cell 自动附带结构化 `EvalError`(message/span/hint/related)。
- scope 内 cell 的最新输出附 `text/plain` 表示(截断至阈值);Arrow 大数据
  只附 schema + 形状 + 头几行,不注入原始数据。
- 已装 package 只注入函数名清单;详细签名/用例由 agent 通过 `Inspect`
  工具按需拉取(manifest 的 `llm_docs` 节),避免上下文膨胀。

## B4. Agent 工具白名单

| 工具 | 映射 | read_only 轮次 |
|------|------|:---:|
| `read_cell(id)` / `read_notebook()` | 规范化模型 → 磁盘格式文本 | ✓ |
| `inspect(symbol)` | Request::Inspect(含 package llm_docs) | ✓ |
| `read_output(cell_id)` | 最新 DisplayData 的 text/plain | ✓ |
| `insert_cell / update_cell / delete_cell / set_param` | 对应 Request,origin=Agent | ✗ |
| `execute(cell_id)` | Request::ExecuteCell | ✗ |
| `wait_result(generation)` | 订阅事件流至 PlanFinished,返回各 cell 状态+错误 | ✗ |

自我修正循环 = `update_cell → execute → wait_result → 读 EvalError → 再修`,
全部走标准协议;`EvalError` 的 span/hint/related 即现成的反馈信号。
Orchestrator 强制:每轮工具调用上限(默认 12)、每轮墙钟超时、
`AgentAbort`/`Interrupt` 双通道可停。

## B5. Propose 模式与影子求值

`mode=propose` 时,agent 的写工具不直接落到 notebook,而进入 **pending 层**:

```
notebook (真实层)
   └── pending overlay (turn_id 隔离): Vec<CellOp>
```

- kernel 以 overlay 视图跑一个**影子 generation**(复用既有 generation 机制,
  符号表从真实层快照 fork——`im::HashMap` 快照零成本,协议规范 §6 已铺垫)。
  UI 收到 `PendingReady{shadow_generation}` 后,以"变更后结果"形态渲染
  pending cell 的输出:**用户看到的是改完之后曲线长什么样,而非文本 diff**。
- 影子 generation 的事件照常携带 generation 号,UI 按 pending 态样式渲染;
  真实层同时保持可交互(用户仍可拖真实层滑块,两代互不干扰)。
- `ResolvePending`:
  - `accept_all` → overlay ops 按序应用到真实层,发 `CellsChanged{pending:false}`,
    触发正常重算;影子代废弃。
  - `reject_all` → overlay 丢弃,发反向 `CellsChanged` 清除 UI pending 态。
  - `partial` → 接受子集;kernel 对被拒 ops 的依赖闭包做一致性检查,
    若接受集引用了被拒 cell 定义的符号,应答 `Err{InconsistentPartialAccept}`
    并指出冲突对,由 UI 引导用户重新选择。
- 同一 session 同时至多一个未决 pending 轮次(简化模型;新 AgentPrompt
  在有未决 pending 时应答 `Err{PendingUnresolved}`)。

## B6. Op Journal 与整轮撤销

kernel 维护 append-only 操作日志:

```rust
struct JournalEntry {
    seq: u64,
    origin: Origin,                   // 含 turn_id
    op: CellOp,
    inverse: CellOp,                  // 记录时同步构造逆操作
    ts: DateTime<Utc>,
}
```

- **整轮撤销**:`undo_turn(turn_id)` = 该 turn 的全部 entry 逆序应用 inverse。
  若其后已有更新的用户编辑触碰同一 cell,标记冲突、降级为逐 cell 确认。
- 通用 undo/redo(用户编辑)顺手获得:同一 journal,按 origin=User 过滤。
- journal 随 session 存续,不入 notebook 文件;崩溃恢复场景可选持久化到
  `cache/journal.log`(与输出缓存同级,git 忽略)。

## B7. UI 呈现约定

- 对话面板是**视图无关的全局组件**(抽屉/底部面板),三视图共用;工具条上的
  Agent 类 action 只是带预填 prompt 的入口。
- `origin=Agent` 的 `CellsChanged`:pending 态用虚线框+主题强调色;已接受的
  agent 变更保留角标若干秒,点击可跳转该 turn 的对话记录与 `undo_turn` 入口。
- `ToolCall/ToolResult` 的 summary 在对话流中渲染为可折叠步骤条
  ("正在执行 cell C2… ✓ 3ms"),保证 agent 行为全程可观察。

---

## 附:一次 "修复此错误" 的完整消息序列 (propose 模式)

```
UI → AgentPrompt{turn=T, scope=Subgraph{C2,up}, mode=propose}     (req id=A)
K  → Reply::Ok                                                     (parent=A)
K  → AgentEvent{T, Delta "该错误因 dBm 与 Hz 直接相加…"}
K  → AgentEvent{T, ToolCall  {c1, inspect("fspl"), "查询 fspl 签名"}}
K  → AgentEvent{T, ToolResult{c1, ok}}
K  → AgentEvent{T, ToolCall  {c2, update_cell(C2), "修正单位换算"}}
K  → CellsChanged{origin=Agent{T}, ops=[Update C2], pending=true}
K  → PlanStarted{gen=57(shadow), cells=[C2, C3]}                   // 影子求值
K  → CellStatus{57, C2, ok(2ms)} … DisplayData{57, C3, …}
K  → PlanFinished{57, completed}
K  → AgentEvent{T, PendingReady{ops, shadow_generation=57}}
K  → AgentEvent{T, Done{completed}}
UI → ResolvePending{T, accept_all}                                 (用户确认)
K  → CellsChanged{origin=Agent{T}, ops=[Update C2], pending=false}
K  → PlanStarted{gen=58, …}                                        // 真实层重算
```
