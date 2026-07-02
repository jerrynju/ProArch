# Kernel 消息协议规范 (v0.1)

> 设计原则:传输无关(今天走 flutter_rust_bridge 进程内通道,明天同一套消息走
> WebSocket 到桌面/云端 kernel,前端零改动);控制面与数据面分离;
> 一切长操作可取消、可观察。

---

## 1. 分层与传输

```
Flutter UI
   │  Dart structs (FRB 生成)
   ▼
┌──────────────────────────────────────┐
│ Transport 层                          │
│  • Local: FRB v2 (StreamSink 事件流)  │
│  • Remote: WebSocket + JSON/MsgPack   │  ← 后期,同一套消息定义
├──────────────────────────────────────┤
│ Protocol 层: Envelope + 消息枚举       │  ← 本文档
├──────────────────────────────────────┤
│ Kernel: DAG 调度器 + Rhai 求值器       │
└──────────────────────────────────────┘
```

通道模型(仿 Jupyter 但简化为两条):

- **control/shell(请求-应答)**:UI → kernel 的请求,每个请求恰好一个终结应答。
- **iopub(事件广播)**:kernel → UI 的单向事件流,FRB 下即一个 `StreamSink<Event>`。同一 kernel 的多个视图(如分屏 Feed+Calc)共享订阅。

本地传输下,请求应答走 FRB 的 async fn(天然一一对应),事件走 StreamSink;远程传输下两者复用一条 WebSocket,靠 Envelope 区分。

## 2. Envelope

```rust
#[derive(Serialize, Deserialize)]
pub struct Envelope<T> {
    pub msg_id: Ulid,
    /// 事件所响应的请求 id;自发事件(如后台重算)为 None
    pub parent_id: Option<Ulid>,
    pub session: SessionId,          // 一个打开的 notebook = 一个 session
    pub protocol: u32,               // 协议版本,当前 = 1
    pub ts: DateTime<Utc>,
    pub body: T,                     // Request / Reply / Event
}
```

`parent_id` 是 UI 侧关联的唯一依据:滑块连续拖动产生多个请求时,UI 用它丢弃过期响应。

## 3. 请求与应答 (control 通道)

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Request {
    // ---- 生命周期 ----
    OpenNotebook   { path: String },                  // → NotebookOpened
    CloseNotebook  {},
    ResetKernel    {},                                // 清空符号表,全量 Stale

    // ---- 编辑与求值 ----
    /// 源码变更。kernel 重分析 + 更新 DAG,是否自动重算由 policy 决定
    UpdateCell     { cell_id: Ulid, source: String },
    InsertCell     { after: Option<Ulid>, cell: Cell },
    DeleteCell     { cell_id: Ulid },
    /// 显式执行(reactive 模式下通常不需要,保留给 manual policy)
    ExecuteCell    { cell_id: Ulid },
    /// 参数热更新 —— 高频路径,见 §5
    SetParam       { cell_id: Ulid, value: ParamValue },

    // ---- 控制 ----
    /// 取消:目标为某次执行代 (generation) 或全部
    Interrupt      { generation: Option<u64> },
    /// 求值策略: reactive(默认) | manual
    SetPolicy      { policy: EvalPolicy },

    // ---- 编辑器服务 ----
    Complete       { cell_id: Ulid, source: String, cursor: usize },
    Inspect        { symbol: String },                // 文档/签名/当前值摘要
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Reply {
    Ok             {},
    NotebookOpened { notebook: Notebook, dag: DagSnapshot },
    Completions    { items: Vec<CompletionItem> },
    Inspection     { markdown: String },
    Err            { error: KernelError },            // 请求本身失败(非 cell 求值错误)
}
```

要点:

- **UpdateCell / SetParam 的应答只确认"已接受"**,真正的执行进展全部走事件流。请求-应答保持毫秒级返回,UI 永不阻塞等计算。
- **执行代 (generation)**:kernel 维护单调递增的 u64,每次触发重算(源码变更、参数变更、显式执行)分配新 generation。这是取消与过期丢弃的统一机制,见 §6。

## 4. 事件 (iopub 通道)

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "ev", rename_all = "snake_case")]
pub enum Event {
    /// kernel 整体状态,驱动全局 busy 指示
    Status        { state: KernelState },             // idle | busy | resetting

    /// DAG 拓扑变更(UpdateCell/Insert/Delete 之后)。
    /// UI 据此渲染依赖高亮、错误标记(重复定义/环)
    DagUpdated    { snapshot: DagSnapshot },

    /// 一次重算的开始:宣告本 generation 将要重算哪些 cell 及顺序。
    /// UI 立即把这些 cell 置灰/标记 Stale —— 响应式体验的关键
    PlanStarted   { generation: u64, cells: Vec<Ulid> },

    CellStatus    { generation: u64, cell_id: Ulid, state: CellState },
                  // queued | running | ok{ms} | errored | cancelled | blocked{by}

    /// 执行期日志/进度(print 输出、迭代进度)
    Stream        { generation: u64, cell_id: Ulid, name: StreamName, text: String },
    Progress      { generation: u64, cell_id: Ulid, done: u64, total: Option<u64> },

    /// 计算结果,MIME 多表示,见 §5
    DisplayData   { generation: u64, cell_id: Ulid, data: MimeBundle },

    /// cell 级求值错误(结构化,可定位)
    CellError     { generation: u64, cell_id: Ulid, error: EvalError },

    PlanFinished  { generation: u64, outcome: PlanOutcome },  // completed | cancelled | aborted
}
```

UI 的消费逻辑非常机械:`PlanStarted` 置灰 → `CellStatus` 逐个点亮 → `DisplayData` 填充输出 → 收到更高 generation 的 `PlanStarted` 时,旧 generation 的一切后续事件直接丢弃。

## 5. 数据面:MimeBundle 与大数据传输

```rust
#[derive(Serialize, Deserialize)]
pub struct MimeBundle {
    /// 同一结果的多种表示,UI 按视图能力择优;key = MIME type
    pub reprs: BTreeMap<String, Repr>,
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "enc", rename_all = "snake_case")]
pub enum Repr {
    /// 小载荷 (< 64 KiB):内联
    Inline { data: serde_json::Value },
    Text   { text: String },
    /// 大载荷:引用 kernel 侧 buffer,零拷贝提取
    Buffer { buffer_id: u64, len: u64, mime: String },
}
```

约定的 MIME 类型:

| MIME | 用途 | 典型 Repr |
|------|------|-----------|
| `text/plain` | 兜底文本表示(任何结果必有) | Text |
| `text/markdown` | 富文本结果(带单位的标量、公式) | Text |
| `application/vnd.qnb.quantity+json` | 带量纲标量 `{value, unit}` | Inline |
| `application/vnd.apache.arrow.stream` | 表格 / 数组 / 曲线数据 | Buffer |
| `application/vnd.qnb.plot+json` | 图表描述(声明式 spec,Flutter 端渲染) | Inline |
| `image/png` | 兜底位图(导出/远程降级用) | Buffer |

关键决策:

- **图表走声明式 spec + Arrow 数据,不传像素**。`plot+json` 只描述"这是折线图,x=freq, y=path_loss,对数轴",数据列引用同 bundle 内的 Arrow buffer。Flutter 端用 fl_chart / CustomPaint 渲染,天然获得主题适配、手势缩放、动态重绘。
- **Buffer 提取是独立的 FRB 调用** `take_buffer(buffer_id) -> ZeroCopyBuffer<Vec<u8>>`,与事件流解耦:事件保持轻小,大数据按需拉取(Feed 模式滚动到卡片时才取)。buffer 由 kernel 持有,LRU 淘汰,`take` 后转移所有权。远程传输下同一 buffer_id 语义映射为 HTTP range / 二进制帧。
- **每个结果必有 `text/plain`**,保证 Read 模式、日志、无渲染器场景永远有东西可显示。

### SetParam 热路径(滑块拖动)

- **合并语义 (coalescing)**:kernel 对每个 param 只保留最新待处理值;新 SetParam 到达时,若上一 generation 仍在跑同一 param 的下游,立即发 `Interrupt(该 generation)` 并以新值开新 generation。UI 侧无需节流,协议层保证"最终一致于最后一个值"。
- 下游 cell 的重算若 < ~30 ms,可获得连续拖动的实时曲线;超过则 UI 依 `CellStatus` 显示 spinner,松手收敛。

## 6. 取消、崩溃与可靠性

```rust
pub struct KernelError { pub kind: ErrorKind, pub message: String }

#[derive(Serialize, Deserialize)]
pub struct EvalError {
    pub kind: EvalErrorKind,   // syntax | undefined_symbol | type | dimension |
                               // runtime | panic | multiple_definition | circular
    pub message: String,       // 人话,面向用户
    pub span: Option<Span>,    // { start: usize, end: usize } 源码内偏移,编辑器高亮
    pub hint: Option<String>,  // 修复建议,如 "dBm 与 Hz 不能相加,是否想用 dB?"
    pub related: Vec<Ulid>,    // 关联 cell(重复定义的另一方、环上成员)
}
```

- **取消实现**:每个 generation 一个 `CancellationToken`;Rhai 求值通过 `Engine::on_progress` 回调检查(每 N 条指令),核心库的长循环原语(FFT、扫频、优化迭代)在内层循环显式检查。取消到达 → 当前 cell 发 `cancelled`,未开始的发 `cancelled`,已完成的结果保留有效。
- **panic 隔离**:所有 cell 求值入口 `catch_unwind`;panic → `EvalError{kind: Panic}` + 该 cell 下游 `blocked`,符号表回滚到该 cell 执行前快照(符号表用持久化数据结构 `im::HashMap`,快照零成本)。kernel 进程/线程不死,App 不崩。
- **单线程求值 + 多线程原语**:符号表单写者(求值循环单线程,免锁、语义简单),重计算原语内部用 rayon 并行。DAG 的独立分支并行求值留作 v2 优化,协议已兼容(CellStatus 天然乱序)。
- **超时**:`SetPolicy` 可配 per-cell 软超时,超时不杀,发 `Progress` 停滞告警,由用户决定 Interrupt。

## 7. FRB 落地映射(本地传输)

```rust
// api.rs —— flutter_rust_bridge v2 导出面,总共只需 4 个函数
pub async fn kernel_request(session: SessionId, req_json: Vec<u8>) -> Vec<u8>;
pub fn kernel_events(session: SessionId, sink: StreamSink<Vec<u8>>);
pub fn take_buffer(session: SessionId, buffer_id: u64) -> ZeroCopyBuffer<Vec<u8>>;
pub async fn create_session(notebook_path: String) -> SessionId;
```

消息体用 serde 序列化(本地可用 bincode/postcard,远程 JSON),**FRB 导出面刻意窄化为字节通道**:协议演进(加消息、加字段)不触发 FRB 重新生成绑定,Dart 侧用同一份 schema 生成的模型解码(可用 `serde_reflection` 或手写 codegen 保证两端一致)。

## 8. 版本协商与扩展点

- `create_session` 应答携带 kernel 的 `protocol` 版本与能力集 `capabilities: Vec<String>`(如 `"arrow"`, `"cancel"`, `"complete"`);UI 按能力降级。
- 新增 Request/Event 变体 = 非破坏变更(serde 未知 tag → 应答 `Err{Unsupported}` / 事件跳过);字段删除或语义变更才递增 `protocol`。
- domain package 的自定义结果类型一律通过新 MIME type 扩展(`application/vnd.qnb.rf.smith-chart+json`),协议本身不为任何 domain 特化。

---

## 附:一次滑块拖动的完整消息序列

```
UI → SetParam{cell=P, value=9.6GHz}          (req id=A)
K  → Reply::Ok                                (parent=A)
K  → Status{busy}
K  → PlanStarted{gen=42, cells=[C1, C2]}      (parent=A)
K  → CellStatus{gen=42, C1, running}
K  → DisplayData{gen=42, C1, {text/plain, quantity+json}}
K  → CellStatus{gen=42, C1, ok(3ms)}
K  → CellStatus{gen=42, C2, running}
UI → SetParam{cell=P, value=9.7GHz}          (req id=B, 用户还在拖)
K  → Interrupt 内部触发: CellStatus{gen=42, C2, cancelled}
K  → PlanFinished{gen=42, cancelled}
K  → PlanStarted{gen=43, cells=[C1, C2]}      (parent=B)
...
K  → PlanFinished{gen=43, completed}
K  → Status{idle}
```
