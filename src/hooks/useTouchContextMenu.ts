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
  const suppressClick = useRef<{ id: string; until: number } | null>(null);
  const cancel = useCallback(() => {
    if (gesture.current) clearTimeout(gesture.current.timer);
    gesture.current = null;
  }, []);
  useEffect(() => {
    const reset = () => {
      cancel();
      suppressClick.current = null;
    };
    const move = (event: globalThis.PointerEvent) => {
      const current = gesture.current;
      if (
        current &&
        (event.pointerId !== current.pointer ||
          Math.hypot(event.clientX - current.x, event.clientY - current.y) > 10)
      )
        cancel();
    };
    // A second finger or pointer release can land outside this canvas, especially in split-screen.
    window.addEventListener("pointerdown", cancel, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", cancel, true);
    window.addEventListener("pointercancel", cancel, true);
    window.addEventListener("blur", reset);
    window.addEventListener("scroll", cancel, true);
    document.addEventListener("visibilitychange", reset);
    return () => {
      cancel();
      window.removeEventListener("pointerdown", cancel, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", cancel, true);
      window.removeEventListener("pointercancel", cancel, true);
      window.removeEventListener("blur", reset);
      window.removeEventListener("scroll", cancel, true);
      document.removeEventListener("visibilitychange", reset);
    };
  }, [cancel]);
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
          suppressClick.current = { id, until: Date.now() + 800 };
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
    onClickCapture(event: {
      target: EventTarget;
      preventDefault(): void;
      stopPropagation(): void;
    }) {
      const suppressed = suppressClick.current;
      const id =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(".react-flow__node[data-id]")?.dataset.id
          : undefined;
      if (suppressed && Date.now() < suppressed.until && id === suppressed.id) {
        suppressClick.current = null;
        event.preventDefault();
        event.stopPropagation();
      }
    },
  };
}
