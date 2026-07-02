---
pro: 1
id: 01PROARCHBEAMNB000000000
title: 悬臂梁挠度分析
subtitle: 结构力学 · 矩形截面钢梁
packages: []
default_view: calc
view_hints:
  beam-params-F: { calc: { group: deflection } }
  beam-params-L: { calc: { group: deflection } }
  beam-params-I: { calc: { group: deflection } }
  beam-params-E: { calc: { group: deflection } }
  beam-compute: { calc: { group: deflection, title: 挠度计算, icon: calc } }
  beam-plot: { calc: { title: 挠度曲线, icon: plot } }
  beam-verify: { calc: { title: 规范校核, icon: check } }
  beam-material: { calc: { title: 材料应力校核, icon: check } }
  beam-table: { calc: { title: 荷载工况对照表, icon: table, placeholder: true } }
  beam-sim: { calc: { title: 动态响应仿真, icon: wave, placeholder: true } }
---

# 悬臂梁挠度分析

矩形截面钢梁,端部集中荷载工况。计算最大挠度并核查是否满足 L/250 限值。

```param {#beam-params-F name=F control=slider min=1 max=50 step=1 unit=kN label="端部荷载 F"}
10
```

```param {#beam-params-L name=L control=slider min=0.5 max=5 step=0.1 unit=m label="梁长 L"}
2
```

```param {#beam-params-I name=I control=slider min=200 max=5000 step=50 unit=cm⁴ label="截面惯性矩 I"}
2000
```

```param {#beam-params-E name=E control=select label="材料 (弹性模量 E)"}
value: 200
options:
  - { label: 钢 200GPa, value: 200 }
  - { label: 铝 69GPa, value: 69 }
  - { label: 木 12GPa, value: 12 }
```

```rhai {#beam-compute .cell title="挠度计算"}
// δ_max = F·L³ / (3·E·I)
let F_N = F * 1000.0;        // kN → N
let E_Pa = E * 1e9;          // GPa → Pa
let I_m4 = I * 1e-8;         // cm⁴ → m⁴
let delta_m = F_N * L^3 / (3.0 * E_Pa * I_m4);
let delta_mm = delta_m * 1000.0;
let allowable_mm = L * 1000.0 / 250.0;
quantity(delta_mm, "mm")
```

```rhai {#beam-plot .cell title="挠度曲线"}
let xs = linspace(0.0, L, 24);
let ys = map(xs, |x| (F * 1000.0) * x^2 * (3.0*L - x) / (6.0 * (E * 1e9) * (I * 1e-8)) * 1000.0);
plot(xs, ys, "xlabel=x (m);ylabel=挠度 (mm)")
```

```rhai {#beam-verify .cell title="规范校核"}
check(delta_mm <= allowable_mm, "通过 · 满足 L/250 限值", "未通过 · 超出 L/250 限值")
```

```rhai {#beam-material .cell title="材料应力校核"}
let sigma = F * 1000.0 * L / (I_section * 1e-6);
check(sigma <= 235e6, "应力满足 Q235 限值", "应力超限,建议增大截面")
```

```placeholder {#beam-table kind=table}
荷载工况对照表 · 即将支持
```

```placeholder {#beam-sim kind=simulation}
动态响应仿真 · 即将支持
```
