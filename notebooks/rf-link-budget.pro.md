---
pro: 1
id: 01PROARCHRFLINKNB0000000
title: X 波段链路预算
subtitle: 射频通信 · rf 域包
packages:
  - rf: "^1.0"
default_view: calc
view_hints:
  rf-params-pt: { calc: { group: budget } }
  rf-params-freq: { calc: { group: budget } }
  rf-params-dist: { calc: { group: budget } }
  rf-params-gain: { calc: { group: budget } }
  rf-compute: { calc: { group: budget, title: 链路预算, icon: calc } }
  rf-plot: { calc: { title: 接收功率-距离曲线, icon: plot } }
  rf-verify: { calc: { title: 链路余量校核, icon: check } }
---

# X 波段链路预算

点对点微波链路,自由空间传播模型。计算接收功率并核查链路余量是否满足灵敏度要求(-90 dBm)。`fspl` 由 rf 域包提供。

```param {#rf-params-pt name=Pt control=slider min=0 max=40 step=1 unit=dBm label="发射功率 Pt"}
30
```

```param {#rf-params-freq name=freq control=slider min=8 max=12 step=0.1 unit=GHz label="频率 f"}
9.4
```

```param {#rf-params-dist name=dist control=slider min=1 max=50 step=1 unit=km label="链路距离 d"}
10
```

```param {#rf-params-gain name=Gsum control=slider min=0 max=60 step=1 unit=dB label="收发天线增益合计"}
35
```

```rhai {#rf-compute .cell title="链路预算"}
// Pr = Pt − FSPL(d, f) + G,灵敏度取 -90 dBm
let path_loss = fspl(dist * 1000.0, freq * 1e9);
let Pr = Pt - path_loss + Gsum;
let sensitivity = -90.0;
let margin = Pr - sensitivity;
quantity(Pr, "dBm")
```

```rhai {#rf-plot .cell title="接收功率-距离曲线"}
let ds = linspace(1.0, 50.0, 25);
let prs = map(ds, |d| Pt - fspl(d * 1000.0, freq * 1e9) + Gsum);
plot(ds, prs, "xlabel=距离 (km);ylabel=Pr (dBm);ref=-90")
```

```rhai {#rf-verify .cell title="链路余量校核"}
check(margin >= 10.0, "通过 · 链路余量 ≥ 10 dB", "未通过 · 链路余量不足 10 dB")
```
