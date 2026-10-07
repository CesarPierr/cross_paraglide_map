/** Small raster toolbox working on row-major Float32 grids. */

/** One separable box-blur pass of radius r (window 2r+1), edges clamped. */
function boxBlurPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const tmp = new Float32Array(w * h);
  const inv = 1 / (2 * r + 1);
  // Horizontal: running sum with clamped edges, split to keep the hot loop branch-free.
  for (let j = 0; j < h; j++) {
    const row = j * w;
    const first = src[row];
    const last = src[row + w - 1];
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += k < 0 ? first : src[row + Math.min(w - 1, k)];
    for (let i = 0; i < w; i++) {
      tmp[row + i] = acc * inv;
      const ia = i + r + 1;
      const is = i - r;
      acc += (ia < w ? src[row + ia] : last) - (is > 0 ? src[row + is] : first);
    }
  }
  // Vertical, row by row with per-column running sums (cache friendly).
  const acc = new Float32Array(w);
  for (let k = -r; k <= r; k++) {
    const row = Math.min(h - 1, Math.max(0, k)) * w;
    for (let i = 0; i < w; i++) acc[i] += tmp[row + i];
  }
  for (let j = 0; j < h; j++) {
    const out = j * w;
    const add = Math.min(h - 1, j + r + 1) * w;
    const sub = Math.max(0, j - r) * w;
    for (let i = 0; i < w; i++) {
      dst[out + i] = acc[i] * inv;
      acc[i] += tmp[add + i] - tmp[sub + i];
    }
  }
}

/** Approximate Gaussian blur (three box passes). `radius` is the box radius in cells. */
export function blur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
  const out = new Float32Array(src);
  if (radius < 1) return out;
  const r = Math.max(1, Math.round(radius / Math.sqrt(3)));
  boxBlurPass(out, out, w, h, r);
  boxBlurPass(out, out, w, h, r);
  boxBlurPass(out, out, w, h, r);
  return out;
}

/** Running max (or min) over a 1D window using a monotonic deque. */
function extremumPass(src: Float32Array, dst: Float32Array, n: number, stride: number, offset: number, r: number, isMax: boolean, deque: Int32Array): void {
  let head = 0;
  let tail = 0;
  // Prime with the first r elements.
  let next = 0;
  for (let i = 0; i < n; i++) {
    const hi = Math.min(n - 1, i + r);
    while (next <= hi) {
      const val = src[offset + next * stride];
      if (isMax) while (tail > head && val >= src[offset + deque[tail - 1] * stride]) tail--;
      else while (tail > head && val <= src[offset + deque[tail - 1] * stride]) tail--;
      deque[tail++] = next;
      next++;
    }
    while (deque[head] < i - r) head++;
    dst[offset + i * stride] = src[offset + deque[head] * stride];
  }
}

function transpose(src: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  const B = 32;
  for (let j0 = 0; j0 < h; j0 += B) {
    for (let i0 = 0; i0 < w; i0 += B) {
      const j1 = Math.min(h, j0 + B);
      const i1 = Math.min(w, i0 + B);
      for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) out[i * h + j] = src[j * w + i];
    }
  }
  return out;
}

/** Square max or min filter of radius r (window 2r+1). */
export function extremumFilter(src: Float32Array, w: number, h: number, r: number, isMax: boolean): Float32Array {
  const tmp = new Float32Array(w * h);
  const deque = new Int32Array(Math.max(w, h) + 1);
  for (let j = 0; j < h; j++) extremumPass(src, tmp, w, 1, j * w, r, isMax, deque);
  const t = transpose(tmp, w, h);
  const t2 = new Float32Array(w * h);
  for (let i = 0; i < w; i++) extremumPass(t, t2, h, 1, i * h, r, isMax, deque);
  return transpose(t2, h, w);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
