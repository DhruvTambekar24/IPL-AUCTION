import { useEffect, useRef } from "react";

// Inspired by Wind / Flow Field by Dorian Baffier (Kokonut UI, MIT).
const BASE_PARTICLES = 260;
const MAX_DPR = 2;

const createParticle = (width, height) => ({
  x: Math.random() * width,
  y: Math.random() * height,
  life: Math.random() * 5,
  speed: 0.7 + Math.random() * 0.7,
});

function FlowField({
  className = "",
  density = 0.5,
  speed = 0.6,
  interactive = true,
}) {
  const rootRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!root || !canvas || !context) return undefined;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const isStatic = reducedMotion || speed <= 0;
    const bounds = { width: 0, height: 0 };
    const pointer = { x: 0, y: 0, active: false, gust: 0 };
    let particles = [];
    let frameId = 0;
    let previousTime = 0;
    let elapsed = 0;
    let visible = false;
    let isOnScreen = false;
    let color = getComputedStyle(canvas).color;

    const drawStill = () => {
      context.clearRect(0, 0, bounds.width, bounds.height);
      context.strokeStyle = color;
      context.lineWidth = 1;
      for (let row = 0; row < 18; row += 1) {
        const path = new Path2D();
        const y = (row / 17) * bounds.height;
        for (let step = 0; step < 26; step += 1) {
          const x = (step / 25) * bounds.width;
          const bend = Math.sin(x / 175 + row * 0.35) * 12;
          if (step === 0) path.moveTo(x, y + bend);
          else path.lineTo(x, y + bend);
        }
        context.globalAlpha = 0.12 + (row % 4) * 0.035;
        context.stroke(path);
      }
      context.globalAlpha = 1;
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const oldWidth = bounds.width;
      const oldHeight = bounds.height;
      bounds.width = rect.width;
      bounds.height = rect.height;
      canvas.width = Math.round(bounds.width * dpr);
      canvas.height = Math.round(bounds.height * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (isStatic) {
        drawStill();
        return;
      }

      const count = Math.max(
        0,
        Math.min(
          420,
          Math.round(
            BASE_PARTICLES *
              Math.max(0, density) *
              Math.min(1, bounds.width / 680),
          ),
        ),
      );
      if (particles.length !== count) {
        particles = Array.from({ length: count }, () =>
          createParticle(bounds.width, bounds.height),
        );
      } else if (oldWidth > 0 && oldHeight > 0) {
        const scaleX = bounds.width / oldWidth;
        const scaleY = bounds.height / oldHeight;
        particles.forEach((particle) => {
          particle.x *= scaleX;
          particle.y *= scaleY;
        });
      }
      context.clearRect(0, 0, bounds.width, bounds.height);
    };

    const updatePointer = (event) => {
      if (!interactive || (event.pointerType === "touch" && !event.buttons)) {
        return;
      }
      const rect = root.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      pointer.active =
        x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      if (pointer.active) {
        pointer.x = x;
        pointer.y = y;
      }
    };

    const onPointerDown = (event) => {
      if (!interactive || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      if (
        target?.closest(
          "a, button, input, textarea, select, label, [role='button']",
        )
      ) {
        return;
      }
      updatePointer(event);
      if (pointer.active) pointer.gust = performance.now();
    };

    const onPointerUp = (event) => {
      if (event.pointerType === "touch") pointer.active = false;
    };

    const onPointerOut = (event) => {
      if (!event.relatedTarget) pointer.active = false;
    };

    const onVisibilityChange = () => {
      visible = document.visibilityState === "visible" && isOnScreen;
      start();
    };

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isOnScreen = entry.isIntersecting;
      onVisibilityChange();
    });

    const start = () => {
      if (!isStatic && visible && !frameId) {
        previousTime = 0;
        frameId = requestAnimationFrame(render);
      }
    };

    const render = (now) => {
      frameId = 0;
      if (!visible) return;
      frameId = requestAnimationFrame(render);

      const delta = previousTime
        ? Math.min((now - previousTime) / 1000, 0.04)
        : 1 / 60;
      previousTime = now;
      elapsed += delta * speed;

      context.globalCompositeOperation = "destination-out";
      context.globalAlpha = 0.12;
      context.fillRect(0, 0, bounds.width, bounds.height);
      context.globalCompositeOperation = "source-over";

      const paths = [new Path2D(), new Path2D(), new Path2D()];
      particles.forEach((particle, index) => {
        const x = particle.x;
        const y = particle.y;
        let angle =
          Math.sin(y / 155 + elapsed * 0.45) * 0.44 +
          Math.sin(x / 230 - elapsed * 0.35) * 0.2;
        let push = 0;

        if (pointer.active) {
          const dx = x - pointer.x;
          const dy = y - pointer.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 105 && distance > 0.1) {
            const strength = (1 - distance / 105) * 1.4;
            angle += Math.atan2(dy, dx) + Math.PI / 2;
            push = strength;
          }
        }

        if (pointer.gust) {
          const gustAge = (now - pointer.gust) / 1000;
          if (gustAge > 1.1) {
            pointer.gust = 0;
          } else {
            const distance = Math.hypot(
              x - pointer.x,
              y - pointer.y,
            );
            const ring = Math.abs(distance - gustAge * 300);
            push += Math.exp(-(ring * ring) / 1800) * (1 - gustAge / 1.1);
          }
        }

        const velocity = 24 + push * 48;
        const nextX = x + Math.cos(angle) * velocity * particle.speed * delta;
        const nextY = y + Math.sin(angle) * velocity * particle.speed * delta;
        particle.x =
          nextX < 0 ? bounds.width : nextX > bounds.width ? 0 : nextX;
        particle.y =
          nextY < 0 ? bounds.height : nextY > bounds.height ? 0 : nextY;
        particle.life += delta;
        if (particle.life > 6) {
          Object.assign(particle, createParticle(bounds.width, bounds.height));
        }

        const path = paths[index % paths.length];
        if (Math.abs(particle.x - x) < 40 && Math.abs(particle.y - y) < 40) {
          path.moveTo(x, y);
          path.lineTo(particle.x, particle.y);
        }
      });

      context.strokeStyle = color;
      context.lineWidth = 1;
      paths.forEach((path, index) => {
        context.globalAlpha = 0.12 + index * 0.09;
        context.stroke(path);
      });
      context.globalAlpha = 1;
    };

    resize();
    intersectionObserver.observe(root);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pointermove", updatePointer, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("pointercancel", onPointerUp, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(root);

    return () => {
      cancelAnimationFrame(frameId);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pointermove", updatePointer);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      document.removeEventListener("pointerout", onPointerOut);
    };
  }, [density, interactive, speed]);

  return (
    <div
      ref={rootRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

export default FlowField;
