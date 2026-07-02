---
pro: 1
id: 01PROARCHSTRESSNB0000000
title: 应力校核清单
subtitle: 通用校核 · 压弯组合
default_view: calc
view_hints:
  sc-params-N: { calc: { group: stress } }
  sc-params-M: { calc: { group: stress } }
  sc-params-A: { calc: { group: stress } }
  sc-params-W: { calc: { group: stress } }
  sc-params-f: { calc: { group: stress } }
  sc-compute:
    calc:
      group: stress
      title: 组合应力计算
      icon: calc
      aside: { label: 强度利用率, symbol: usage_pct, unit: '%' }
  sc-plot: { calc: { title: 应力构成, icon: plot } }
  sc-verify-n: { calc: { title: 轴向应力校核, icon: check } }
  sc-verify-m: { calc: { title: 弯曲应力校核, icon: check } }
  sc-verify-total: { calc: { title: 组合应力校核, icon: check } }
---

# 应力校核清单

压弯构件通用校核模板:输入轴力 N、弯矩 M 与截面特性,按线弹性叠加 σ = N/A + M/W 逐项校核轴向、弯曲与组合应力。

```param {#sc-params-N name=N control=slider min=0 max=500 step=10 unit=kN label="轴力 N"}
120
```

```param {#sc-params-M name=M control=slider min=0 max=200 step=5 unit=kN·m label="弯矩 M"}
45
```

```param {#sc-params-A name=A control=slider min=10 max=300 step=2 unit=cm² label="截面面积 A"}
76
```

```param {#sc-params-W name=W control=slider min=100 max=3000 step=10 unit=cm³ label="抗弯模量 W"}
481
```

```param {#sc-params-f name=f control=select label="材料 (设计强度 f)"}
value: 215
options:
  - { label: "Q235 · f=215 MPa", value: 215 }
  - { label: "Q355 · f=305 MPa", value: 305 }
  - { label: "Q420 · f=360 MPa", value: 360 }
```

```rhai {#sc-compute .cell title="组合应力计算"}
// σ = N/A + M/W(压弯组合,线弹性叠加)
let sigma_n = N * 1000.0 / (A * 1e-4);       // Pa
let sigma_m = M * 1000.0 / (W * 1e-6);       // Pa
let sigma_total = sigma_n + sigma_m;
let usage_pct = sigma_total / (f * 1e6) * 100.0;
quantity(sigma_total / 1e6, "MPa")
```

```rhai {#sc-plot .cell title="应力构成"}
plot([1.0, 2.0, 3.0], [sigma_n / 1e6, sigma_m / 1e6, sigma_total / 1e6], "type=bar;xlabel=1 轴向 · 2 弯曲 · 3 组合;ylabel=σ (MPa)")
```

```rhai {#sc-verify-n .cell title="轴向应力校核"}
check(sigma_n <= f * 1e6, "通过 · 轴向应力低于设计强度", "未通过 · 轴向应力超限")
```

```rhai {#sc-verify-m .cell title="弯曲应力校核"}
check(sigma_m <= f * 1e6, "通过 · 弯曲应力低于设计强度", "未通过 · 弯曲应力超限,建议增大 W")
```

```rhai {#sc-verify-total .cell title="组合应力校核"}
check(sigma_total <= f * 1e6, "通过 · 组合应力低于设计强度", "未通过 · 组合应力超限,建议增大截面或提高材质")
```
