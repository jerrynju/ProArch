---
pro: 1
id: 01PROARCHRCTRANNB0000000
title: RC 电路暂态响应
subtitle: 电路仿真 · circuit 域包
packages:
  - circuit: "^1.0"
default_view: calc
view_hints:
  rc-params-R: { calc: { group: transient } }
  rc-params-C: { calc: { group: transient } }
  rc-params-V0: { calc: { group: transient } }
  rc-params-treq: { calc: { group: transient } }
  rc-compute: { calc: { group: transient, title: 时间常数, icon: calc, aside: { label: 截止频率, symbol: fc, unit: Hz } } }
  rc-plot: { calc: { title: 充电曲线, icon: plot } }
  rc-verify: { calc: { title: 建立时间校核, icon: check } }
---

# RC 电路暂态响应

一阶 RC 充电电路,阶跃输入 V₀。计算时间常数 τ = R·C 与低通截止频率,并按 3τ (≈95%) 校核建立时间是否满足要求。`tau_rc` / `vc_step` 由 circuit 域包提供。

```param {#rc-params-R name=R control=slider min=1 max=100 step=1 unit=kΩ label="电阻 R"}
10
```

```param {#rc-params-C name=C control=slider min=0.1 max=10 step=0.1 unit=µF label="电容 C"}
1
```

```param {#rc-params-V0 name=V0 control=slider min=1 max=24 step=1 unit=V label="阶跃电压 V₀"}
5
```

```param {#rc-params-treq name=t_req control=slider min=10 max=200 step=10 unit=ms label="要求建立时间"}
50
```

```rhai {#rc-compute .cell title="时间常数"}
// τ = R·C,3τ 时电压达到约 95% V₀
let tau_s = tau_rc(R * 1000.0, C * 1e-6);
let tau_ms = tau_s * 1000.0;
let t_settle = 3.0 * tau_ms;
let fc = fc_rc(R * 1000.0, C * 1e-6);
quantity(tau_ms, "ms")
```

```rhai {#rc-plot .cell title="充电曲线"}
let ts = linspace(0.0, 5.0 * tau_ms, 30);
let vs = map(ts, |t| vc_step(V0, t / 1000.0, tau_s));
plot(ts, vs, "xlabel=t (ms);ylabel=v_C (V)")
```

```rhai {#rc-verify .cell title="建立时间校核"}
check(t_settle <= t_req, "通过 · 3τ 建立时间满足要求", "未通过 · 建立时间超出要求,建议减小 R 或 C")
```
