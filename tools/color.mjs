// Colour maths for the Readout dev tools. No dependencies.
// sRGB hex <-> linear RGB <-> OKLab / OKLCH (Ottosson 2020), WCAG 2 contrast,
// and colour-vision-deficiency simulation (Machado, Oliveira and Fernandes 2009,
// severity 1.0, applied in linear RGB).

export function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('Bad hex colour: ' + hex);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function rgbToHex(rgb) {
  return '#' + rgb.map((c) => {
    const v = Math.round(Math.min(1, Math.max(0, c)) * 255);
    return v.toString(16).padStart(2, '0');
  }).join('');
}

export const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
export const toGamma = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}

export function oklabToLinear([L, a, b]) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

export const hexToLinear = (hex) => hexToRgb(hex).map(toLinear);
export const linearToHex = (lin) => rgbToHex(lin.map(toGamma));
export const hexToOklab = (hex) => linearToOklab(hexToLinear(hex));

export function hexToOklch(hex) {
  const [L, a, b] = hexToOklab(hex);
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H };
}

function inGamut(lin) {
  const e = 1e-5;
  return lin.every((c) => c >= -e && c <= 1 + e);
}

// Largest chroma that stays inside sRGB at this lightness and hue.
export function maxChroma(L, H) {
  let lo = 0;
  let hi = 0.4;
  const hr = (H * Math.PI) / 180;
  for (let i = 0; i < 28; i += 1) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklabToLinear([L, mid * Math.cos(hr), mid * Math.sin(hr)]))) lo = mid;
    else hi = mid;
  }
  return lo;
}

// OKLCH to hex. Chroma is reduced until the colour fits sRGB (hue and lightness are kept).
export function oklchToHex(L, C, H) {
  const c = Math.min(C, maxChroma(L, H));
  const hr = (H * Math.PI) / 180;
  return linearToHex(oklabToLinear([L, c * Math.cos(hr), c * Math.sin(hr)]));
}

// WCAG 2 relative luminance and contrast ratio.
export function luminance(hex) {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Machado, Oliveira and Fernandes (2009), severity 1.0.
const CVD = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.303900],
  ],
};

export function simulateLinear(lin, kind) {
  const m = CVD[kind];
  if (!m) throw new Error('Unknown deficiency: ' + kind);
  return m.map((row) => Math.min(1, Math.max(0, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])));
}

export const simulate = (hex, kind) => linearToHex(simulateLinear(hexToLinear(hex), kind));

// Colour difference: Euclidean distance in OKLab, times 100.
export function deltaE(a, b, kind) {
  const la = kind ? simulateLinear(hexToLinear(a), kind) : hexToLinear(a);
  const lb = kind ? simulateLinear(hexToLinear(b), kind) : hexToLinear(b);
  const x = linearToOklab(la);
  const y = linearToOklab(lb);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 100;
}

// Worst case across the two common deficiencies.
export const cvdDeltaE = (a, b) => Math.min(deltaE(a, b, 'protan'), deltaE(a, b, 'deutan'));
