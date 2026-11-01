export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export type Summary = { median: number; iqr: number; min: number; max: number; n: number; values: number[] };

export function summarize(values: number[]): Summary {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return { median: quantile(v, 0.5), iqr: quantile(v, 0.75) - quantile(v, 0.25), min: v[0] ?? NaN, max: v.at(-1) ?? NaN, n: v.length, values };
}

export function p95(values: number[]) {
  return quantile([...values].sort((a, b) => a - b), 0.95);
}
