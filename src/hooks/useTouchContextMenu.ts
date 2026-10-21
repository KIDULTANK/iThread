import { type PointerEvent, useCallback, useEffect, useRef } from "react";

/** Long-press a topic without stealing scroll, drag, pinch, button or text-edit gestures. */
export function useTouchContextMenu(open: (id: string, x: number, y: number) => void) {
  const callback = useRef(open);
  callback.current = open;
  const gesture = useRef<{
    pointer: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(0);
  const cancel = useCallback(() => {
    if (gesture.current) clearTimeout(gesture.current.timer);
    gesture.current = null;
  }, []);
  useEffect(() => cancel, [cancel]);
  return {
    onPointerDownCapture(event: PointerEvent<HTMLElement>) {
      cancel();
      if (event.pointerType !== "touch" || !event.isPrimary || !(event.target instanceof Element))
        return;
      if (event.target.closest("button,input,textarea,a,[contenteditable=true]")) return;
      const id = event.target.closest<HTMLElement>(".react-flow__node[data-id]")?.dataset.id;
      if (!id) return;
      const { clientX: x, clientY: y, pointerId: pointer } = event;
      gesture.current = {
        pointer,
        x,
        y,
        timer: setTimeout(() => {
          gesture.current = null;
          suppressClick.current = Date.now() + 800;
          callback.current(id, x, y);
        }, 550),
      };
    },
    onPointerMoveCapture(event: PointerEvent<HTMLElement>) {
      const current = gesture.current;
      if (
        current &&
        (event.pointerId !== current.pointer ||
          Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10)
      )
        cancel();
    },
    onPointerUpCapture: cancel,
    onPointerCancelCapture: cancel,
    onClickCapture(event: { preventDefault(): void; stopPropagation(): void }) {
      if (Date.now() < suppressClick.current) {
        suppressClick.current = 0;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
