const { readFileSync, statSync, writeFileSync } = require("node:fs");

function validBounds(value) {
  return (
    value &&
    ["x", "y", "width", "height"].every((key) => Number.isSafeInteger(value[key])) &&
    value.width > 0 &&
    value.height > 0
  );
}

function restoreWindowState(saved, workAreas, primary) {
  const areas = workAreas.filter(validBounds);
  const fallback = validBounds(primary)
    ? primary
    : (areas[0] ?? { x: 0, y: 0, width: 1440, height: 900 });
  const bounds = validBounds(saved?.bounds) ? saved.bounds : null;
  const overlap = (area) =>
    bounds
      ? Math.max(
          0,
          Math.min(area.x + area.width, bounds.x + bounds.width) - Math.max(area.x, bounds.x),
        ) *
        Math.max(
          0,
          Math.min(area.y + area.height, bounds.y + bounds.height) - Math.max(area.y, bounds.y),
        )
      : 0;
  const matching = areas.reduce(
    (best, area) => (overlap(area) > overlap(best) ? area : best),
    fallback,
  );
  const area = overlap(matching) > 0 ? matching : fallback;
  const width = Math.min(area.width, Math.max(960, bounds?.width ?? 1440));
  const height = Math.min(area.height, Math.max(640, bounds?.height ?? 900));
  const position =
    bounds && overlap(area) > 0
      ? bounds
      : {
          x: area.x + Math.round((area.width - width) / 2),
          y: area.y + Math.round((area.height - height) / 2),
        };
  return {
    bounds: {
      x: Math.max(area.x, Math.min(position.x, area.x + area.width - width)),
      y: Math.max(area.y, Math.min(position.y, area.y + area.height - height)),
      width,
      height,
    },
    maximized: saved?.maximized === true,
  };
}

function readWindowState(filePath) {
  try {
    if (statSync(filePath).size > 8192) return null;
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function rememberWindowState(window, filePath, restored) {
  let maximized = restored.maximized;
  window.on("maximize", () => {
    maximized = true;
  });
  window.on("unmaximize", () => {
    maximized = false;
  });
  // Only a tiny preference record is written at close, not on every resize/move event.
  window.on("close", () => {
    try {
      const bounds = window.getNormalBounds();
      if (validBounds(bounds))
        writeFileSync(filePath, JSON.stringify({ bounds, maximized }), "utf8");
    } catch {
      // A read-only or corrupt preference must never prevent the app from opening or closing.
    }
  });
}

module.exports = { restoreWindowState, readWindowState, rememberWindowState };
