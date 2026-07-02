---
pro: 1
id: 01PROARCHSSBEAMNB0000000
title: 简支梁弯矩分析
subtitle: 结构力学 · 均布+集中荷载
default_view: calc
view_hints:
  ssb-params-q:
    calc: { group: moment }
  ssb-params-F:
    calc: { group: moment }
  ssb-params-L:
    calc: { group: moment }
  ssb-params-W:
    calc: { group: moment }
  ssb-compute:
    calc:
      group: moment
      title: 跨中弯矩与应力
      icon: calc
      aside: { label: 抗弯利用率, symbol: ratio_pct, unit: '%' }
  ssb-reaction:
    calc: { title: 支座反力, icon: calc }
  ssb-plot:
    calc: { title: 弯矩图, icon: plot }
  ssb-verify:
    calc: { title: 抗弯强度校核, icon: check }
---

# 简支梁弯矩分析

简支钢梁,均布荷载 q 全跨布置,集中荷载 F 作用于跨中。计算跨中最大弯矩与弯曲应力,并按 Q235 设计强度 f = 215 MPa 校核。

```param {#ssb-params-q name=q control=slider min=0 max=30 step=1 unit=kN/m label="均布荷载 q"}
8
```

```param {#ssb-params-F name=F control=slider min=0 max=100 step=5 unit=kN label="跨中集中荷载 F"}
20
```

```param {#ssb-params-L name=L control=slider min=2 max=12 step=0.5 unit=m label="跨度 L"}
6
```

```param {#ssb-params-W name=W control=select label="截面型号 (抗弯模量 W)"}
value: 481
options:
  - { label: "HN300×150 · W=481 cm³", value: 481 }
  - { label: "HN400×200 · W=1170 cm³", value: 1170 }
  - { label: "HN500×200 · W=1910 cm³", value: 1910 }
```

```rhai {#ssb-compute .cell title="跨中弯矩与应力"}
// M_max = q·L²/8 + F·L/4(跨中集中荷载)
let M_q = q * L^2 / 8.0;
let M_f = F * L / 4.0;
let M_max = M_q + M_f;                       // kN·m
let sigma_b = M_max * 1000.0 / (W * 1e-6);   // Pa
let ratio_pct = sigma_b / 215e6 * 100.0;
quantity(M_max, "kN·m")
```

```rhai {#ssb-reaction .cell title="支座反力"}
// 对称荷载:R_A = R_B = q·L/2 + F/2
let R_A = q * L / 2.0 + F / 2.0;
quantity(R_A, "kN")
```

```rhai {#ssb-plot .cell title="弯矩图"}
let xs = linspace(0.0, L, 25);
let ms = map(xs, |x| q * x * (L - x) / 2.0 + F / 2.0 * min(x, L - x));
plot(xs, ms, "xlabel=x (m);ylabel=M (kN·m)")
```

```rhai {#ssb-verify .cell title="抗弯强度校核"}
check(sigma_b <= 215e6, "通过 · 弯曲应力低于 Q235 设计强度 215 MPa", "未通过 · 弯曲应力超出 215 MPa,建议增大截面")
```
