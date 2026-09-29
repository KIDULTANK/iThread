import type { Box } from "./floating";

export interface IndexedBox {
  id: string;
  box: Box;
}

/**
 * A tiny uniform-grid index for connector obstacle checks. It is deliberately generic and
 * conservative: queries may return extra boxes, but never omit a box intersecting the rectangle.
 * That keeps bowToClear's exact geometry as the final authority while avoiding an all-nodes scan
 * for every branch on large maps.
 */
export function indexBoxes(
  boxes: readonly IndexedBox[],
  cellSize = 256,
): {
  query: (minX: number, minY: number, maxX: number, maxY: number) => IndexedBox[];
} {
  const size = Math.max(32, cellSize);
  const cells = new Map<string, IndexedBox[]>();
  const cell = (value: number) => Math.floor(value / size);
  const key = (x: number, y: number) => `${x}:${y}`;

  for (const item of boxes) {
    const { box } = item;
    const x0 = cell(box.cx - box.w / 2);
    const x1 = cell(box.cx + box.w / 2);
    const y0 = cell(box.cy - box.h / 2);
    const y1 = cell(box.cy + box.h / 2);
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        const k = key(x, y);
        const bucket = cells.get(k);
        if (bucket) bucket.push(item);
        else cells.set(k, [item]);
      }
    }
  }

  return {
    query(minX, minY, maxX, maxY) {
      const out: IndexedBox[] = [];
      const seen = new Set<string>();
      for (let x = cell(minX); x <= cell(maxX); x++) {
        for (let y = cell(minY); y <= cell(maxY); y++) {
          for (const item of cells.get(key(x, y)) ?? []) {
            if (seen.has(item.id)) continue;
            seen.add(item.id);
            const { box } = item;
            if (
              box.cx + box.w / 2 >= minX &&
              box.cx - box.w / 2 <= maxX &&
              box.cy + box.h / 2 >= minY &&
              box.cy - box.h / 2 <= maxY
            )
              out.push(item);
          }
        }
      }
      return out;
    },
  };
}
