import { afterEach, beforeEach, describe, expect, it } from "vitest";
import OrbitControl from "../orbitcontrol.jsx";

// jsdom has no PointerEvent, so build one from MouseEvent plus a pointerId.
function pointer(type, id, x, y) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true });
  Object.defineProperty(event, "pointerId", { value: id });
  return event;
}

const camera = { position: { set() {} }, lookAt() {} };

describe("OrbitControl", () => {
  let canvas, control;

  beforeEach(() => {
    canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    control = OrbitControl(camera, { current: false });
    control.init(canvas);
  });

  afterEach(() => {
    control.dispose();
    canvas.remove();
  });

  it("disables browser touch scrolling on the canvas so touch drags rotate the globe", () => {
    expect(canvas.style.touchAction).toBe("none");
  });

  it("rotates on a one-finger / mouse drag", () => {
    canvas.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    canvas.dispatchEvent(pointer("pointermove", 1, 150, 120));
    expect(control.targetTheta).toBeCloseTo(-0.5);
    expect(control.targetPhi).toBeCloseTo(Math.PI / 2 + 0.2);
    expect(control.isDragging).toBe(true);

    canvas.dispatchEvent(pointer("pointerup", 1, 150, 120));
    expect(control.isDragging).toBe(false);
  });

  it("zooms in when two fingers spread apart and out when they pinch together", () => {
    canvas.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    canvas.dispatchEvent(pointer("pointerdown", 2, 200, 100)); // 100px apart
    canvas.dispatchEvent(pointer("pointermove", 2, 250, 100)); // 150px apart
    const zoomedIn = control.targetDistance;
    expect(zoomedIn).toBeCloseTo(2);   // 3 * 100/150, clamped at minDistance 2

    canvas.dispatchEvent(pointer("pointermove", 2, 125, 100)); // 25px apart
    expect(control.targetDistance).toBeGreaterThan(zoomedIn);
    // a pinch must not also rotate the globe
    expect(control.targetTheta).toBe(0);
  });

  it("zooms with the mouse wheel and stays within limits", () => {
    for (let i = 0; i < 500; i++) canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 1, cancelable: true }));
    expect(control.targetDistance).toBe(control.maxDistance);
    for (let i = 0; i < 500; i++) canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: -1, cancelable: true }));
    expect(control.targetDistance).toBe(control.minDistance);
  });

  it("only listens on the canvas, so dragging inside a popup doesn't spin the globe", () => {
    window.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    window.dispatchEvent(pointer("pointermove", 1, 300, 300));
    expect(control.targetTheta).toBe(0);
    expect(control.isDragging).toBe(false);
  });

  it("stops reacting after dispose(), so unmounting leaves no listeners behind", () => {
    control.dispose();
    canvas.dispatchEvent(pointer("pointerdown", 1, 100, 100));
    canvas.dispatchEvent(pointer("pointermove", 1, 300, 300));
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 1, cancelable: true }));
    expect(control.targetTheta).toBe(0);
    expect(control.targetDistance).toBe(3);
  });

  it("pauses auto-rotation while a popup is open", () => {
    const popup = { current: true };
    const paused = OrbitControl(camera, popup);
    paused.update();
    expect(paused.targetTheta).toBe(0);
    popup.current = false;
    paused.update();
    expect(paused.targetTheta).toBeGreaterThan(0);
  });
});
