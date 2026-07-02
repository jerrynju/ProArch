# ProArch · 工程笔记本

移动优先的工程计算笔记本:Markdown 文档、响应式计算、AI Agent 三位一体。
本仓库实现 Claude Design 交付的 Material 3 设计稿(工程笔记本),并落地四份
架构规范的 v0.1:Cell 数据模型、`.pro.md` 磁盘格式、Kernel 消息协议、
Action Registry 与 Agent 子协议。

技术栈:React + TypeScript + Vite(移动优先 Web)。`src/core/` 完全不依赖
框架,为后续 Flutter UI + Rust kernel 移植保留边界。

## 运行

```bash
npm install
npm run dev          # http://127.0.0.1:5173(建议以 412×892 移动视口打开)
npm test             # 20 个单元测试(解析器 / DAG / kernel 黄金值 / agent)
npm run e2e          # 9 个 Playwright 场景(需 Chromium;可用 CHROMIUM_PATH 指定)
npm run build        # tsc + vite 产物
```

## 演示笔记本(多领域)

| 文件 | 领域 | 说明 |
|------|------|------|
| `notebooks/cantilever-beam.pro.md` | 结构力学 | 悬臂梁挠度:δ=F·L³/3EI、L/250 校核、挠度曲线、一个故意出错的应力校核单元(演示错误态与 Agent 修复) |
| `notebooks/rf-link-budget.pro.md` | 射频通信 | X 波段链路预算:`fspl` 由 **rf 域包** 提供(`packages: [rf]` 未声明时该函数不可用),接收功率-距离曲线、链路余量校核 |

侧边栏项目树(结构分析 / 射频通信 / 电路仿真)演示多项目、多领域组织;
两本笔记本均为真实 `.pro.md` 文档,由 kernel 解析并驱动全部 UI。

## `.pro.md` 格式

规范《Cell 数据模型》§4 的实现,magic 为 `pro: 1`:

```markdown
---
pro: 1
title: 悬臂梁挠度分析
packages: []
default_view: calc
view_hints:
  beam-compute: { calc: { group: deflection, title: 挠度计算 } }
---

# 标题与自由 Markdown 即 markdown cell

```rhai {#beam-compute .cell}
let delta_mm = F * 1000.0 * L^3 / (3.0 * (E*1e9) * (I*1e-8)) * 1000.0;
quantity(delta_mm, "mm")
```

```param {#beam-params-F name=F control=slider min=1 max=50 step=1 unit=kN}
10
```
```

- 输出永不入库;param 当前值是文档状态,随文件保存。
- 未知 block 解析为 Unknown cell 并原样回写(不丢数据)。
- 缺失 ID 由解析器生成 ULID 回填。

## 架构 ↔ 规范对照

| 规范 | 实现 |
|------|------|
| Cell 数据模型(Notebook/Cell/CellKind/ViewHints) | `src/core/model/types.ts` |
| `.pro.md` 解析 / 序列化 | `src/core/promd/` |
| Rhai 子集求值器(let、闭包、单位字面量、数组) | `src/core/kernel/lang.ts` |
| DAG 规则 R1–R4、失效闭包 | `src/core/kernel/dag.ts` |
| Kernel 协议(Request/Reply/Event、MimeBundle、EvalError) | `src/core/kernel/protocol.ts` |
| 会话:generation、事件流、pending 影子层、op journal + undo_turn | `src/core/kernel/kernel.ts` |
| 域包(rf:fspl/dB 换算等 + llm docs) | `src/core/packages/rf.ts` |
| Action Registry(Applicability AND/OR 谓词、内置基线、包贡献) | `src/core/actions/registry.ts` |
| Agent 子协议(轮次事件、propose/pending、脚本化编排器) | `src/core/agent/orchestrator.ts` |
| 三视图 = 同一卡片派生的投影 | `src/app/derive.ts` + `views/` |

Agent 当前为**脚本化实现**:轮次状态机、工具调用事件、pending 影子求值、
按项接受/拒绝、整轮撤销全部真实;仅"模型"是读取 kernel 实时状态的确定性
脚本(`orchestrator.ts` 单文件可替换为真实 LLM 接入)。

## 设计还原

设计稿:Claude Design《Engineering Notebook.dc.html》(Material 3,zh-CN)。
颜色/圆角/排版 token 逐值取自设计(`src/app/theme.ts`);四种模式
(工作台 / Calc / Feed / Read)、抽屉五个子视图、Agents/Artifacts 底部面板、
ActionStack(单元/插入/AI 三页签 + 模板画廊 + 对话模式)、待确认变更审阅
均按设计实现。设计稿中的 Android 机身与状态栏属于原型机框,不在产品内。
E2E 运行后 `test-results/shots/` 内有 19 张各状态截图。
