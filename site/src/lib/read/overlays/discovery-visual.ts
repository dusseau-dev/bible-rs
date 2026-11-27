import type { LessonVisual } from '../discoveries';
export function scale(value: number, min: number, max: number, start: number, end: number): number {
 if (![value, min, max, start, end].every(Number.isFinite)) throw new Error('Invalid coordinate');
 return min === max ? (start + end) / 2 : start + (value - min) * (end - start) / (max - min);
}
export function layoutVisual(v: LessonVisual) {
 if (v.nodes.length < 2 || v.nodes.length > 12) return null;
 const numeric = ['timeline', 'geography', 'quantitative'].includes(v.kind), twoAxes = ['geography', 'quantitative'].includes(v.kind);
 if (numeric && v.nodes.some(n => n.x === null || !Number.isFinite(n.x) || (twoAxes && (n.y === null || !Number.isFinite(n.y))))) return null;
 if (v.nodes.some(n => [n.xLow, n.xHigh, n.yLow, n.yHigh].some(x => x !== null && !Number.isFinite(x)))) return null;
 const xs = v.nodes.flatMap(n => [n.x, n.xLow, n.xHigh].filter((x): x is number => x !== null));
 const ys = v.nodes.flatMap(n => [n.y, n.yLow, n.yHigh].filter((y): y is number => y !== null));
 const xmin = xs.length ? Math.min(...xs) : 0, xmax = xs.length ? Math.max(...xs) : 1;
 const ymin = ys.length ? Math.min(...ys) : 0, ymax = ys.length ? Math.max(...ys) : 1;
 const xScale = (x: number) => scale(x, xmin, xmax, 65, 355), yScale = (y: number) => scale(y, ymin, ymax, 230, 40);
 const points = v.nodes.map((n, i) => ({ id: n.id, number: i + 1,
  x: numeric ? xScale(n.x!) : v.kind === 'structure' ? 210 : 210 + 120 * Math.cos(i * 2 * Math.PI / v.nodes.length - Math.PI / 2),
  y: twoAxes ? yScale(n.y!) : v.kind === 'timeline' ? 130 : v.kind === 'structure' ? scale(i, 0, v.nodes.length - 1, 30, 250) : 140 + 100 * Math.sin(i * 2 * Math.PI / v.nodes.length - Math.PI / 2),
  xLow: n.xLow === null ? null : xScale(n.xLow), xHigh: n.xHigh === null ? null : xScale(n.xHigh), yLow: n.yLow === null ? null : yScale(n.yLow), yHigh: n.yHigh === null ? null : yScale(n.yHigh)
 }));
 return { points, numeric, twoAxes, xmin, xmax, ymin, ymax };
}
