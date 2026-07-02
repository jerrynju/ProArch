# 能力台账、验证漏斗与自进化循环规范 (v0.1)

> 配套文档:《Cell 数据模型 v0.1》《Kernel 协议 v0.1》《Action/Agent v0.1》。
> 本文档定义开发侧的自动化能力生产系统("进化循环"),其产出为经验证的
> domain package 版本;循环运行于 CI/NAS,不运行于用户设备。
>
> 三条核心原则:
> 1. **验证器是系统的重心,生成器只是候选来源** —— 一切正确性判定由
>    确定性验证器给出,LLM 永不担任裁判。
> 2. **确定性步骤绝不使用 LLM** —— 文档解析、向量比对、报告、调度全是普通代码;
>    LLM 只出现在"写实现"与"读错误改实现"两点。
> 3. **进化循环 = 产品自身 agent 基础设施的反身复用** —— 循环执行器就是
>    Part B Orchestrator 对 headless kernel 跑批,不另建系统。

---

## 1. 可行域与目标

### 1.1 功能面三层分类

| 层 | 内容 | 可自动验证性 | 循环覆盖 |
|----|------|--------------|----------|
| L1 公式/算法层 | 链路预算、级联噪声、S/Y/Z/ABCD 转换、滤波器综合、匹配网络、传输线参数… | 高:闭式解/标准算法,输入输出关系明确 | **目标域** |
| L2 求解器层 | 谐波平衡、EM 仿真、大规模非线性求解 | 低:验证本身是研究课题 | 排除,人工开发或明确放弃 |
| L3 交互/工程层 | UI、性能、格式互通 | 不适用 | 排除 |

目标定义:**参考工具箱 L1 函数面的自动化覆盖率**,预期 60–80%。
每个能力项在 ledger 中显式标注 `tier`,L2/L3 条目只登记不进循环
(保留其存在用于差距度量与人工排期)。

### 1.2 知识产权边界(硬约束)

- 参考文档**只用于勘探能力清单**:提取函数名、签名结构、参数语义、适用条件,
  转写为自有结构化规格。文档正文文字不进入任何产出物,不做翻译搬运。
- 实现全部原创:算法依据公开教材/标准/论文(规格中登记 `references`,
  如 Pozar、IEEE 标准编号),不参考任何反编译或泄露源码。
- 黄金向量由**自有授权的参考软件**在本方环境运行产生,属自有测试数据。
- ledger 每条目含 `ip_review: pending | cleared` 字段;
  未 cleared 的条目不得进入发布包。

---

## 2. Capability Ledger(能力台账)

系统的脊柱。存储形态:git 仓库中每能力项一个目录,
机读索引 `ledger.jsonl` 由 CI 从目录生成(git 即历史与审计)。

```
ledger/
├── ledger.jsonl                      # CI 生成的机读索引
└── rf/
    └── cascade_nf/
        ├── entry.yaml                # 台账记录(下述 schema)
        ├── capability.qnb.md         # 规格+实现+测试,标准 notebook!
        ├── vectors/
        │   ├── golden.arrow          # 黄金向量(参考软件产出)
        │   └── gen_script.m          # 采样脚本(供内网复跑/追加)
        └── runs/                     # 循环运行记录(append-only)
            └── 2026-07-02T10-31.json
```

### 2.1 entry.yaml schema

```rust
#[derive(Serialize, Deserialize)]
pub struct LedgerEntry {
    pub id: String,                   // "rf.cascade_nf"
    pub tier: Tier,                   // l1 | l2 | l3
    pub status: CapStatus,
    pub signature: SigSpec,           // 见 2.2
    pub source_ref: SourceRef,        // 勘探来源(工具箱名+函数名,非文档正文)
    pub references: Vec<String>,      // 实现依据:教材/标准/论文
    pub ip_review: IpReview,          // pending | cleared
    pub priority: u32,                // 排序依据,见 §7 飞轮
    pub verification: VerificationPlan,   // 该项启用哪些漏斗关卡,见 §4
    pub cost: CostRecord,             // 累计 token/美元/轮次,见 §6
    #[serde(default)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Serialize, Deserialize)]
pub enum CapStatus {
    Scouted,        // 勘探:仅有名称与来源
    Specified,      // 已规格:签名+量纲+语义+参考文献完备(进入循环的门槛)
    Implemented,    // 有候选实现,漏斗未全过
    Verified,       // 漏斗全过
    Hardened,       // 加固:性质测试扩充+模糊采样过+人工抽检过(发布门槛)
    Blocked { reason: String },       // 循环放弃,转人工队列
    Rejected { reason: String },      // 明确不做(L2/IP/低价值)
}
```

### 2.2 SigSpec —— 机器可执行的签名规格

签名规格必须**强到足以自动生成测试**,这是"已规格"状态的实质标准:

```rust
#[derive(Serialize, Deserialize)]
pub struct SigSpec {
    pub name: String,                             // Rhai 内的函数名
    pub params: Vec<ParamSpec>,
    pub returns: Vec<ReturnSpec>,
    /// 数学语义的一句话规格 + 关键方程(自有转写,LaTeX)
    pub semantics: String,
    /// 定义域约束,机器可检查,如 "nf_db >= 0", "len(gains)==len(nfs)"
    pub domain: Vec<Constraint>,
    /// 该函数参与的蜕变关系(性质测试的声明来源,见 §4.3)
    pub properties: Vec<PropertyRef>,
}

#[derive(Serialize, Deserialize)]
pub struct ParamSpec {
    pub name: String,
    pub ty: TypeTag,                  // scalar | quantity | array | matrix | complex…
    pub dimension: Option<String>,    // 量纲表达式:"dB", "Hz", "Ω", "1"
    pub range: Option<(f64, f64)>,    // 采样域(黄金向量与模糊测试共用)
}
```

`dimension` 与 `range` 同时服务三方:量纲检查关卡、MATLAB 采样脚本生成、
后期模糊测试——**一份规格,三处复用**,这是规格投入的回报所在。

### 2.3 capability.qnb.md —— 能力项即笔记本

复用数据模型规范的全部机制,无新格式:

```markdown
---
qnb: 1
title: 级联噪声系数
packages: [{ core: "^1" }]
ledger: { id: rf.cascade_nf }        # frontmatter extra 字段,ledger 反向链接
---

# 规格                                ← Markdown cell:语义、方程、参考文献
```rhai {#impl .cell}
fn cascade_nf(gains, nfs) { ... }     ← 实现 cell(循环的改写对象)
```
```rhai {#test-golden .cell}
assert_vectors("vectors/golden.arrow", cascade_nf, tol_rel=1e-9)
```
```rhai {#test-props .cell}
prop_associative(cascade_nf, samples=200)   ← 性质测试 cell
```
```

好处:循环产物**人可直接打开审阅**(就是一个普通笔记本);Verified 条目
可一键收编为该 domain package 的源文件与文档;agent 的读写走标准协议,
零新增工具。

---

## 3. 流水线总览

```
┌─────────┐   ┌──────────┐   ┌───────────────┐   ┌──────────┐   ┌─────────┐
│ 勘探     │──▶│ 规格化    │──▶│ 向量生成(内网) │──▶│ 进化循环  │──▶│ 收编发布 │
│ 解析器   │   │ 廉价LLM   │   │ MATLAB批跑     │   │ agent×漏斗│   │ CI签名   │
│ (零LLM)  │   │ +人工抽检 │   │ (零LLM)       │   │           │   │ (零LLM)  │
└─────────┘   └──────────┘   └───────────────┘   └──────────┘   └─────────┘
      Scouted        Specified                     Implemented→Verified   Hardened
```

- **勘探(零 LLM)**:工具箱文档为结构化 HTML,函数清单/签名骨架用解析器提取。
- **规格化(廉价 LLM + 人工抽检)**:LLM 将签名骨架扩写为 SigSpec 草稿
  (量纲标注、domain 约束、性质候选),按批人工抽检 10–20% 后置 Specified。
  这是全流程**唯一需要系统性人工介入**的关口——规格错则后续全错,
  这里的人力投入回报最高。
- **向量生成(零 LLM,内网)**:循环外网侧为每个 Specified 条目生成
  `gen_script.m`(可模板化,LLM 仅在非平凡采样时介入);脚本经 git 桥
  进内网,MATLAB 批跑产出 golden.arrow,同桥回传。批处理、异步、
  可积攒——天然适配网络隔离的工作环境。
- **进化循环**:见 §5。
- **收编发布**:Verified→Hardened 门槛见 §4.5;CI 将 Hardened 条目的实现
  cell 收编进 domain package 源码,黄金向量与性质测试进包的回归测试集,
  签名发布。**回归防护是循环的副产品,非额外负担。**

---

## 4. 验证漏斗

关卡按成本升序排列,前关不过不进后关。每关产出结构化 `GateReport`
(pass/fail + 机读失败明细),失败明细即修复循环的反馈信号。

### 4.1 G0 静态关(零成本)

- Rhai 解析通过;符号引用闭合(只允许 core 原语与本条目内定义)。
- **量纲检查**:以 SigSpec 的 dimension 标注为边界条件,对实现做量纲传播
  检查。LLM 数值代码的最大错误类(单位混淆、log/线性域混算)在此拦截,
  不消耗任何数值执行。量纲代数在此兑现第二次红利。
- 禁止模式扫描:无 IO、无全局状态、无超限循环结构(headless 安全)。

### 4.2 G1 黄金向量关

```rust
pub struct VectorGate {
    pub tol_rel: f64,                 // 默认 1e-9(闭式解)/ 1e-6(迭代算法)
    pub tol_abs: f64,                 // 零值附近兜底
    pub coverage: VectorCoverage,     // 常规网格 + 边界值 + 奇异邻域
}
```

- 比对普通代码实现;失败报告含:失败点参数、期望/实际、相对误差分布
  直方图摘要——**误差模式(整体偏移 vs 边界发散 vs 符号翻转)是给 LLM
  的高价值修复线索**,报告生成器应显式分类。
- 边界值(0、极大、退化输入)单列子集,权重高于内点。

### 4.3 G2 性质关(不依赖参考实现)

蜕变关系测试,抓黄金向量覆盖不到的区域。性质在 SigSpec 中声明,
测试执行器按声明实例化(随机采样在 ParamSpec.range 内):

| 性质类别 | 示例 |
|----------|------|
| 代数律 | 级联噪声系数结合律;ABCD 矩阵级联=矩阵乘 |
| 物理不变量 | 无源网络 ‖S‖≤1;互易网络 S21=S12;能量守恒 |
| 退化极限 | 单级级联=恒等;损耗→0 的极限行为 |
| 逆运算闭环 | s2y(y2s(x)) ≈ x;dB↔线性往返 |
| 单调/对称性 | 路径损耗对距离单调增 |

性质库随 domain package 沉淀为可复用断言原语(`prop_associative`、
`prop_passive`…),新条目声明即用。

### 4.4 G3 双实现共识(可选,高价值条目)

对 `priority` 高的条目,以不同提示/不同廉价模型独立生成第二实现,
在扩展采样域上比对;分歧点即使双双"通过"G1 也标记为疑点进人工队列。
成本约为单实现 2 倍,只对标记条目启用。

### 4.5 Verified → Hardened(发布门槛)

- 模糊采样:在 domain 约束边界附近做 10× 密度随机采样过 G2;
- 性能预算:典型输入下运行时间 < 条目声明上限(移动端预算);
- 人工抽检:每批次(如 50 条)抽 10% 人工读实现代码;
- `ip_review = cleared`。

---

## 5. 进化循环(agent 侧)

### 5.1 架构:Part B 的反身复用

```
Loop Runner (CI 上的普通程序,零 LLM)
   │ 按 ledger 调度,每条目发起:
   ▼
AgentPrompt{ scope=Notebook(capability.qnb.md), mode=auto, budget=... }
   ▼
Orchestrator ──标准协议──▶ headless kernel(加载 core+性质库)
```

对 Part B 的全部增量(依 §8 非破坏规则):

1. `AgentPrompt` 增加可选 `budget: TurnBudget { max_tool_calls, max_tokens,
   max_wallclock, model_tier }` —— 交互场景缺省不填。
2. 新增能力 `"headless"`:kernel 无 UI 客户端运行,事件流落盘为
   `runs/*.json`(即 GateReport + 完整 op journal,审计轨迹白得)。
3. Loop Runner 与 kernel 间新增一个便捷 Request
   `RunGates { entries: Vec<GateId> }` → `Reply::GateReports`,
   将漏斗执行收为一次调用(内部即依序执行测试 cell)。

**循环体 = 既有自我修正循环**(Part B §B4):
`读 GateReport → update_cell(#impl) → RunGates → 再读`,无新工具。

### 5.2 模型分层与升级策略

```rust
pub struct EscalationPolicy {
    pub tiers: Vec<ModelTier>,        // [haiku级/本地开源, 中档, (人工)]
    pub rounds_per_tier: u32,         // 默认 4:同层连续失败 4 轮升级
    pub stall_detector: StallRule,    // 连续 2 轮 GateReport 失败集无变化
                                      // ⇒ 提前升级(避免原地打转烧钱)
    pub hard_budget_usd: f64,         // 条目硬预算,超支 ⇒ Blocked
}
```

- 上下文纪律(廉价模型可用的前提):每轮 prompt = SigSpec + core 原语 API
  摘要(一页)+ 当前实现 + **最近一次** GateReport 的失败明细(截断至
  失败模式摘要 + 至多 5 个代表性失败点)。不注入历史轮次全文,
  不注入文档,不注入无关函数。目标 < 8K token/轮。
- 规格化阶段与实现阶段允许配置不同 tier 序列(规格化更依赖理解,
  可从中档起步;实现阶段验证器兜底,从最廉价起步)。
- 全部 LLM 调用经统一网关记账,按 `entry.id × tier × stage` 维度
  写回 `CostRecord`。

### 5.3 失败出口

条目进入 Blocked 的条件(任一):硬预算超支;最高自动 tier 用尽;
G3 分歧无法消解;量纲检查揭示 SigSpec 本身矛盾(此时回退条目至
Specified 并标记规格缺陷,进规格返工队列而非实现返工)。
Blocked ≠ 失败,是**人工注意力的精确路由**——你只审机器搞不定的残差。

---

## 6. 成本模型与度量

北极星指标:**$/Verified-capability**(每通过验证条目的全成本,
含升级轮次与规格化摊销)。辅助指标:

| 指标 | 用途 |
|------|------|
| 首过率(tier-0 一轮过 G0–G2 比例) | 衡量规格质量与原语库 API 友好度 |
| 平均轮次 @ tier | 升级策略调参 |
| Blocked 率及原因分布 | 可行域边界的实测修正 |
| 规格缺陷率(G 阶段回退比例) | 决定规格化阶段人工抽检比例 |

预算判断依据(启动前用 §9 试点实测校准):若 tier-0 条目均值落在
数万 token 内、首过率 > 40%,则千函数级 toolbox 的 L1 覆盖属
"个人可负担"量级;否则优先优化原语库 API 与规格模板,而非升级模型——
**首过率低的第一嫌疑人永远是规格与 API,不是模型智力**。

---

## 7. 飞轮:优先级的闭环

`priority` 的输入源,按权重合成:

1. **用户端能力缺口上报**:kernel 对 `undefined_symbol` 类 EvalError 中
   命中 ledger Scouted/Specified 条目名的,匿名计数上报(仅函数名+次数,
   不含任何笔记本内容;用户可关);
2. 依赖拓扑:被其他条目 SigSpec 引用的基础函数优先;
3. 领域专家(你)的手工置顶。

由此闭环:用户遇到缺失函数 → 缺口进 ledger → 循环补齐 → 包更新推送
→ 用户端"进化感"。**端上永不自改代码**;可靠性来自每个发布函数携带
其黄金向量与性质测试的事实。

---

## 8. 工程可靠性清单

- 循环全程产物入 git(entry、qnb、vectors、runs),任何 Verified 状态
  可精确复现:实现 hash + 向量 hash + 引擎版本三元组入 entry。
- 引擎/原语库升级 ⇒ CI 对全量 Hardened 条目重跑 G1/G2(廉价,纯计算),
  语义回归即时暴露。
- GateReport 与 op journal 使每个函数"为什么被认为是对的"全程可追溯——
  这是面向审查(以及未来面向你的领导汇报)的关键资产。

---

## 附:启动试点(先于任何基建投入)

目的:实测 $/capability 与首过率,校准 §6 预算判断。范围刻意小:

1. 手选 RF Toolbox 中 10 个 L1 函数,难度梯度:3 个平凡(单位转换类)、
   4 个中等(级联/转换类)、3 个较难(含迭代或矩阵运算);
2. 手写 10 份 entry.yaml + SigSpec(顺便固化规格模板);
3. 内网 MATLAB 手跑向量脚本,git 桥回传;
4. 漏斗只实现 G0(量纲)+ G1(向量),G2 选 2–3 个现成性质;
5. Loop Runner 用最简脚本 + Haiku 级模型,rounds_per_tier=4,
   记录每条目 token/轮次/结果;
6. 产出:一页实测报告(首过率、均值成本、失败模式分类)。

试点通过判据:≥7/10 条目在 tier-0/1 内达 Verified,均值成本
在可接受范围。达标则按本规范铺基建;不达标则数据会指明短板在
规格模板、原语 API 还是模型层——按 §6 结论,先修前两者。
