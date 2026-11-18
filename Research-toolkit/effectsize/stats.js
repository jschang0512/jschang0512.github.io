/* Effect sizes & sample size — the arithmetic, kept apart from the page so it can be checked on its own.
 * Every function returns plain numbers (or null when the inputs cannot give an answer). References are on the page. */
(function (root) {
  'use strict';

  /* ---------- distributions ---------- */
  // Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf, |error| < 1.5e-7)
  function pnorm(z) {
    const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
    const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
    return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
  }
  // Standard normal quantile (Acklam's algorithm, relative error < 1.15e-9)
  function qnorm(p) {
    if (!(p > 0 && p < 1)) return NaN;
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const lo = 0.02425, hi = 1 - lo;
    let q, r;
    if (p < lo) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > hi) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  // log Γ (Lanczos)
  function lgamma(x) {
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5, ser = 1.000000000190015;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (let j = 0; j < 6; j++) ser += g[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  // Regularised incomplete beta I_x(a, b) by continued fraction (Numerical Recipes 6.4)
  function ibeta(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    const cf = (x, a, b) => {
      const FPMIN = 1e-300;
      let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
      if (Math.abs(d) < FPMIN) d = FPMIN;
      d = 1 / d; let h = d;
      for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d; h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN; c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN; d = 1 / d;
        const del = d * c; h *= del;
        if (Math.abs(del - 1) < 3e-14) break;
      }
      return h;
    };
    return x < (a + 1) / (a + b + 2) ? bt * cf(x, a, b) / a : 1 - bt * cf(1 - x, b, a) / b;
  }
  // Student t CDF and quantile (quantile by bisection on the CDF; df may be fractional)
  function pt(t, df) {
    const x = df / (df + t * t);
    const tail = 0.5 * ibeta(x, df / 2, 0.5);
    return t >= 0 ? 1 - tail : tail;
  }
  function qt(p, df) {
    if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
    if (df > 1e6) return qnorm(p);
    let lo = -1e3, hi = 1e3;
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (pt(mid, df) < p) lo = mid; else hi = mid; if (hi - lo < 1e-12) break; }
    return (lo + hi) / 2;
  }

  /* ---------- sample size ---------- */
  // Two independent proportions, two-sided α, normal approximation (Fleiss, Levin & Paik 2003, eq. 4.14),
  // optional continuity correction (eq. 4.15). k = n2 / n1. Returns per-group n before rounding and dropout.
  function nTwoProportions({ p1, p2, alpha = 0.05, power = 0.8, k = 1, cc = false }) {
    if (!(p1 > 0 && p1 < 1 && p2 > 0 && p2 < 1) || p1 === p2 || !(k > 0)) return null;
    const za = qnorm(1 - alpha / 2), zb = qnorm(power);
    const pbar = (p1 + k * p2) / (1 + k), qbar = 1 - pbar, d = Math.abs(p1 - p2);
    let n1 = Math.pow(za * Math.sqrt(pbar * qbar * (1 + 1 / k)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2) / k), 2) / (d * d);
    if (cc) n1 = (n1 / 4) * Math.pow(1 + Math.sqrt(1 + (2 * (k + 1)) / (k * n1 * d)), 2);
    return { n1, n2: k * n1 };
  }
  // Two independent means, two-sided α. Solves n with t quantiles on n1 + n2 − 2 df (iterated from the normal answer),
  // which matches the exact noncentral-t answer to within one participant for usual designs.
  function nTwoMeans({ diff, sd, alpha = 0.05, power = 0.8, k = 1 }) {
    if (!(sd > 0) || !diff || !(k > 0)) return null;
    const d = Math.abs(diff) / sd, f = 1 + 1 / k;
    let n1 = f * Math.pow(qnorm(1 - alpha / 2) + qnorm(power), 2) / (d * d);
    const nNormal = n1;
    for (let i = 0; i < 50; i++) {
      const df = Math.max(1, n1 * (1 + k) - 2);
      const next = f * Math.pow(qt(1 - alpha / 2, df) + qt(power, df), 2) / (d * d);
      if (Math.abs(next - n1) < 1e-9) { n1 = next; break; }
      n1 = next;
    }
    return { n1, n2: k * n1, nNormal, d };
  }
  function inflate(n, dropout) { return dropout > 0 && dropout < 1 ? n / (1 - dropout) : n; }

  /* ---------- number needed to treat ---------- */
  // ARD = risk(control) − risk(treated); positive = treatment lowers the risk of the (unwanted) outcome.
  // CI for NNT: 1 / CI of ARD (Altman 1998). When the ARD interval spans 0 the NNT interval runs through infinity.
  function nntFromArd(ard, lo, hi) {
    const r = { ard, lo, hi, nnt: ard === 0 ? Infinity : 1 / Math.abs(ard), benefit: ard > 0 };
    if (lo != null && hi != null) {
      r.spansZero = lo < 0 && hi > 0;
      // the two ends of the ARD interval, each turned into NNTB (ARD > 0) or NNTH (ARD < 0)
      r.ends = [lo, hi].map((x) => ({ value: x === 0 ? Infinity : 1 / Math.abs(x), benefit: x > 0 }));
    }
    return r;
  }
  function nntFromCounts({ e1, n1, e0, n0, level = 0.95 }) {
    // group 1 = treated / exposed, group 0 = control
    if (![e1, n1, e0, n0].every((v) => Number.isFinite(v)) || n1 <= 0 || n0 <= 0 || e1 < 0 || e0 < 0 || e1 > n1 || e0 > n0) return null;
    const p1 = e1 / n1, p0 = e0 / n0, ard = p0 - p1;
    const se = Math.sqrt(p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0), z = qnorm(1 - (1 - level) / 2);
    return Object.assign(nntFromArd(ard, ard - z * se, ard + z * se), { p1, p0, se });
  }
  // From a ratio and the control-group risk (CER). For RR: ARD = CER(1 − RR). For OR: treated risk = OR·CER / (1 − CER + OR·CER).
  // For HR: S0 = 1 − CER is the control survival at the time point; treated survival = S0^HR (Altman & Andersen 1999).
  function treatedRisk(type, ratio, cer) {
    if (type === 'RR') return cer * ratio;
    if (type === 'OR') return (ratio * cer) / (1 - cer + ratio * cer);
    if (type === 'HR') return 1 - Math.pow(1 - cer, ratio);
    return NaN;
  }
  function nntFromRatio({ type, est, lo, hi, cer }) {
    if (!(est > 0) || !(cer > 0 && cer < 1)) return null;
    const ard = (x) => cer - treatedRisk(type, x, cer);
    const r = nntFromArd(ard(est), lo > 0 && hi > 0 ? ard(hi) : null, lo > 0 && hi > 0 ? ard(lo) : null);
    r.treated = treatedRisk(type, est, cer);
    return r;
  }

  /* ---------- odds ratio → risk ratio ---------- */
  // Zhang & Yu 1998: RR = OR / (1 − P0 + P0·OR), P0 = outcome risk in the reference group. Applied to each CI limit as well.
  function orToRr(or, p0) { return or > 0 && p0 >= 0 && p0 < 1 ? or / (1 - p0 + p0 * or) : null; }

  /* ---------- confidence interval → standard error ---------- */
  // Ratio measures on the log scale; differences on the natural scale (Cochrane Handbook 6.3.1–6.3.2).
  function seFromCi({ ratio, est, lo, hi, level = 0.95, n }) {
    if (!(lo < hi)) return null;
    if (ratio && !(lo > 0 && hi > 0)) return null;
    const z = qnorm(1 - (1 - level) / 2);
    const L = ratio ? Math.log(lo) : lo, U = ratio ? Math.log(hi) : hi;
    const se = (U - L) / (2 * z);
    const centre = est != null ? (ratio ? (est > 0 ? Math.log(est) : NaN) : est) : (L + U) / 2;
    const zStat = centre / se;
    const p = 2 * (1 - pnorm(Math.abs(zStat)));
    const out = { se, centre, z: zStat, p, symmetric: est != null ? Math.abs((centre - L) - (U - centre)) / (U - L) : 0 };
    // SD of a single group's mean from the CI of that mean: SD = √n · (U − L) / (2 · t) with t on n − 1 df (Handbook 6.5.2.2)
    if (!ratio && n > 1) out.sd = Math.sqrt(n) * (U - L) / (2 * qt(1 - (1 - level) / 2, n - 1));
    return out;
  }

  const ES = { pnorm, qnorm, pt, qt, ibeta, nTwoProportions, nTwoMeans, inflate, nntFromCounts, nntFromRatio, nntFromArd, treatedRisk, orToRr, seFromCi };
  if (typeof module !== 'undefined' && module.exports) module.exports = ES; else root.ES = ES;
})(typeof window !== 'undefined' ? window : globalThis);
