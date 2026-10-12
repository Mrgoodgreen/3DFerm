const marks: [string, number][] = [];
const enabled = import.meta.env.DEV || location.search.includes('prof');

/** Boot timing marks, exposed as window.__marks for profiling. */
export function mark(name: string) {
  if (!enabled) return;
  marks.push([name, Math.round(performance.now())]);
  (window as unknown as { __marks: [string, number][] }).__marks = marks;
}
