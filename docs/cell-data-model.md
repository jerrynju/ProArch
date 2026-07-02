# Cell 数据模型与 Notebook 文件格式规范 (v0.1)

> 设计原则:视图无关(view-agnostic)、依赖关系由 kernel 推导而非手工维护、
> 磁盘格式对 git / Obsidian / LLM 友好。

---

## 1. 分层总览

```
┌─────────────────────────────────────────────┐
│  磁盘格式 (Markdown + fenced blocks)          │  ← git-friendly, 人可读
├─────────────────────────────────────────────┤
│  规范化模型 (Notebook / Cell, serde structs)  │  ← 前后端共享的唯一真相
├─────────────────────────────────────────────┤
│  派生状态 (DAG / EvalState / Outputs)         │  ← kernel 运行时推导,不入库*
└─────────────────────────────────────────────┘
```

\* 例外:outputs 可选缓存到 sidecar 文件,用于离线预览,见 §6。

核心不变量:

1. **三种视图 (Feed / Read / Calc) 只是规范化模型的渲染投影**,不允许任何视图私有的数据字段进入 Cell 核心结构;视图相关信息全部隔离在 `view_hints` 中。
2. **依赖关系不持久化**。kernel 加载 notebook 时解析每个 code cell 的 Rhai AST,提取 `defines` / `references` 符号集合,重建 DAG。手工维护的依赖必然腐烂。
3. **Cell ID 是稳定标识**(ULID),重排、编辑源码都不改变 ID;跨 cell 引用、输出缓存、协作合并都锚定在 ID 上。

---

## 2. 规范化模型 (Rust)

```rust
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct Notebook {
    pub format_version: u32,          // 磁盘格式版本,当前 = 1
    pub id: Ulid,
    pub metadata: NotebookMeta,
    pub cells: Vec<Cell>,             // 文档顺序;执行顺序由 DAG 决定
}

#[derive(Serialize, Deserialize)]
pub struct NotebookMeta {
    pub title: String,
    pub packages: Vec<PackageReq>,    // domain package 依赖声明
    pub default_view: ViewMode,       // feed | read | calc
    pub created: DateTime<Utc>,
    pub modified: DateTime<Utc>,
    #[serde(default)]
    pub extra: serde_json::Map<String, serde_json::Value>, // 前向兼容
}

#[derive(Serialize, Deserialize)]
pub struct PackageReq {
    pub name: String,                 // e.g. "rf"
    pub version: semver::VersionReq,  // e.g. "^1.2"
}

#[derive(Serialize, Deserialize)]
pub struct Cell {
    pub id: Ulid,
    pub kind: CellKind,
    #[serde(default)]
    pub view_hints: ViewHints,
    #[serde(default)]
    pub tags: Vec<String>,
}
```

### 2.1 CellKind —— 内容即类型

```rust
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum CellKind {
    /// 富文本,CommonMark + 数学扩展 ($...$)
    Markdown { source: String },

    /// Rhai 代码,kernel 求值单元
    Code {
        source: String,
        /// 语言标识,预留多语言可能;当前恒为 "rhai"
        lang: String,
    },

    /// 交互参数:定义一个变量 + 一个控件。
    /// 这是 Feed 模式"拖滑块看曲线"的基础,也是 DAG 的叶子输入节点。
    Param {
        /// 绑定的变量名,进入全局符号表,等价于一个 defines = {name} 的 code cell
        name: String,
        control: ControlSpec,
        /// 当前值(持久化,这是唯一"输出入库"的 cell 类型)
        value: ParamValue,
    },

    /// 内嵌数据:小表格内联,大数据引用附件
    Data {
        name: String,                 // 绑定变量名
        payload: DataPayload,
    },
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ControlSpec {
    Slider  { min: f64, max: f64, step: f64, unit: Option<String>, log_scale: bool },
    Number  { min: Option<f64>, max: Option<f64>, unit: Option<String> },
    Select  { options: Vec<(String, ParamValue)> },
    Toggle,
    Text,
}

#[derive(Serialize, Deserialize)]
#[serde(untagged)]
pub enum ParamValue {
    Number(f64),
    Bool(bool),
    Text(String),
    /// 带单位量,与引擎量纲系统对接: { "value": 10.0, "unit": "dBm" }
    Quantity { value: f64, unit: String },
}

#[derive(Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DataPayload {
    /// 小数据(< 32 KiB)直接内联为 Arrow IPC 的 base64,或 CSV 文本
    InlineCsv { text: String },
    /// 大数据引用 notebook 附件目录中的 .arrow 文件
    ArrowFile { path: String },       // 相对路径,如 "assets/s21.arrow"
}
```

设计说明:

- **Param 是独立 CellKind 而非 code cell 的注解**。它是三个视图交互差异最大的元素(Feed 里是卡片上的控件,Calc 里是行内滑块,Read 里退化为显示值),独立建模让渲染器各取所需;对 kernel 而言它退化为一个平凡节点:`defines = {name}, references = ∅`。
- **`value` 持久化在 Param cell 中**——参数是文档状态的一部分(用户调好的链路预算参数应该随文件保存),这与"计算输出不入库"不矛盾。
- **Data cell 解决"数据从哪来"**:实测 S 参数、噪声数据等,以 Arrow 文件为附件,变量名进符号表,下游 cell 直接引用。

### 2.2 ViewHints —— 视图私有信息的隔离区

```rust
#[derive(Serialize, Deserialize, Default)]
pub struct ViewHints {
    pub feed: Option<FeedHints>,
    pub read: Option<ReadHints>,
    pub calc: Option<CalcHints>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct FeedHints {
    /// 该 cell 是否作为独立卡片出现;None = 由启发式决定
    pub card: Option<bool>,
    /// 同一卡片聚合:相同 group 的连续 cell 合并为一张卡
    pub group: Option<String>,
    pub cover: bool,                  // 是否作为 notebook 封面卡
}

#[derive(Serialize, Deserialize, Default)]
pub struct ReadHints {
    pub collapsed: bool,              // Read 模式默认折叠代码
    pub hide_output: bool,
}

#[derive(Serialize, Deserialize, Default)]
pub struct CalcHints {
    pub hide_source: bool,            // 只展示输出(演示模式)
    pub pinned: bool,                 // 固定在侧栏(仪表盘式)
}
```

规则:**任何 hint 缺失时视图必须有合理默认行为**。一个从未在 Feed 模式打开过的 notebook,启发式规则(如:每个 Markdown 标题 + 其后内容为一卡;Param + 其下游首个图表为一卡)必须能产出可用的卡片流。hints 是覆盖,不是必需。

---

## 3. 依赖模型与求值语义 (Pluto 式响应式)

kernel 对每个 Code/Param/Data cell 维护派生元数据:

```rust
pub struct CellAnalysis {
    pub defines: BTreeSet<Symbol>,     // 顶层绑定: let x = ...; fn f() {...}
    pub references: BTreeSet<Symbol>,  // 引用的外部符号(排除自身 defines 与内置库)
    pub syntax_error: Option<Diag>,    // 解析失败时 defines/references 为空
}
```

DAG 构建规则(与 Pluto.jl 一致,规则少且可预测):

| # | 规则 | 违反时行为 |
|---|------|-----------|
| R1 | 每个符号在整个 notebook 中**至多被一个 cell 定义** | 冲突的所有 cell 标记 `MultipleDefinition` 错误,均不执行 |
| R2 | 边:cell A 引用符号 s 且 cell B 定义 s ⇒ B → A | — |
| R3 | DAG 不允许环 | 环上所有 cell 标记 `CircularDependency`,不执行 |
| R4 | cell 内部允许局部变量遮蔽,只有顶层绑定进入全局符号表 | — |

增量求值:cell 源码变更 ⇒ 重新分析该 cell ⇒ diff 其 `defines`/`references` ⇒ 更新 DAG ⇒ 失效集合 = 该 cell + 其传递下游 ⇒ 按拓扑序重算。Param 值变更是特例:DAG 不变,失效集合 = 该 Param 的传递下游(这是滑块交互的热路径,见协议文档 §5)。

求值状态机(每 cell):

```
          源码/上游变更
   Ok ──────────────────▶ Stale ──▶ Queued ──▶ Running ──▶ Ok
                                                  │
                                                  ├──▶ Errored(自身错误)
                                                  └──▶ Cancelled
   上游 Errored ⇒ 下游标记 Blocked(不执行,显示"上游错误")
```

---

## 4. 磁盘格式:Markdown 方言

单文件 notebook = `*.qnb.md`(quantitative notebook);带附件时为目录:

```
link-budget.qnb/
├── notebook.md
└── assets/
    └── s21.arrow
```

### 4.1 文件结构

```markdown
---
qnb: 1
id: 01J8ZXQ0V6EXAMPLE0000000
title: X 波段链路预算
packages:
  - rf: "^1.0"
default_view: calc
---

# 链路预算分析

自由段落是 Markdown cell,无需任何标记。cell 边界 = 标题或 fenced block。

```rhai {#01J8ZXQ1 .cell}
let pt = 30.0 `dBm`;
let path_loss = fspl(10 `km`, 9.4 `GHz`);
let pr = pt - path_loss + 35 `dB`;   // 收发天线增益合计
```

```param {#01J8ZXQ2 name=freq control=slider min=8 max=12 step=0.1 unit=GHz}
9.4
```

```data {#01J8ZXQ3 name=s21 src=assets/s21.arrow}
```
```

### 4.2 解析规则

1. YAML frontmatter → `NotebookMeta`;`qnb: 1` 为格式版本兼 magic。
2. fenced block 的 info string 采用 pandoc 属性语法:`语言 {#id 键=值 ...}`。
   - `rhai {#id}` → Code cell;`param {...}` → Param(块体为当前值);`data {...}` → Data。
3. fenced block 之间的所有 Markdown 文本按标题(`#`/`##`...)切分为 Markdown cell。
4. **ID 缺失时由解析器生成 ULID 并回写文件**(保证外部编辑器新增的 cell 也获得稳定 ID)。
5. 未知 block 类型 / 未知属性:保留原文、cell 标记为 `Unknown`,渲染为只读——**读旧版软件写不出的文件时绝不丢数据**。

这个格式的红利:Obsidian / VS Code / GitHub 直接可读可 diff,Read 模式的渲染器几乎等于一个标准 Markdown 渲染器,LLM agent 可以直接生成与修改 notebook。

---

## 5. view_hints 的磁盘表示

hints 不污染正文,统一放 frontmatter,按 cell ID 索引:

```yaml
view_hints:
  01J8ZXQ1: { calc: { hide_source: true } }
  01J8ZXQ2: { feed: { card: true, group: "budget" } }
```

---

## 6. 输出缓存 (sidecar,可选)

`notebook.md` 永不包含计算输出(保持 diff 干净)。可选生成 `cache/outputs.arrow`(按 cell ID 索引的最近一次 display data + 源码 hash),用途:打开文件秒出上次结果、无 kernel 环境下的只读分享。缓存校验:源码 hash 或引擎版本不匹配 ⇒ 丢弃并标记 Stale。`.gitignore` 默认忽略 `cache/`。

---

## 7. 前向兼容清单

- 所有 struct 顶层保留 `extra: Map<String, Value>`(serde flatten),未知字段读入后原样写回。
- `format_version` 只在**破坏性**变更时递增;新增 CellKind / ControlSpec 变体属非破坏变更,旧版本按 §4.2 规则 5 降级为只读 Unknown cell。
- Symbol 命名空间预留 `pkg::name` 形式,为 domain package 导出符号做准备。
