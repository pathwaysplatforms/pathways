"use client";

import { useEffect, useRef } from "react";

const CITIES = [
  { name: "Toronto",   lat: 43.65,  lon: -79.38  },
  { name: "London",    lat: 51.51,  lon: -0.13   },
  { name: "Paris",     lat: 48.85,  lon: 2.35    },
  { name: "Berlin",    lat: 52.52,  lon: 13.40   },
  { name: "Sydney",    lat: -33.87, lon: 151.21  },
  { name: "Singapore", lat: 1.35,   lon: 103.82  },
  { name: "Tokyo",     lat: 35.68,  lon: 139.69  },
  { name: "Mumbai",    lat: 19.08,  lon: 72.88   },
  { name: "São Paulo", lat: -23.55, lon: -46.63  },
  { name: "New York",  lat: 40.71,  lon: -74.01  },
];

interface Point3D {
  x: number;
  y: number;
  z: number;
}

function latLonToXYZ(lat: number, lon: number): Point3D {
  const theta = (lat * Math.PI) / 180;
  const phi = (lon * Math.PI) / 180;
  return {
    x: Math.cos(theta) * Math.sin(phi),
    y: Math.sin(theta),
    z: Math.cos(theta) * Math.cos(phi),
  };
}

function rotateY(p: Point3D, angle: number): Point3D {
  return {
    x: p.x * Math.cos(angle) + p.z * Math.sin(angle),
    y: p.y,
    z: -p.x * Math.sin(angle) + p.z * Math.cos(angle),
  };
}

/** Interactive dot-mesh globe — orthographic projection, drag-to-rotate, city markers. */
export function GlobeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rawCtx = canvas.getContext("2d");
    if (!rawCtx) return;
    const ctx: CanvasRenderingContext2D = rawCtx;

    const BUFFER = 420;
    canvas.width = BUFFER;
    canvas.height = BUFFER;
    const cx = BUFFER / 2;
    const cy = BUFFER / 2;
    const R = BUFFER * 0.42;

    // Pre-build grid dot positions
    const gridDots: Point3D[] = [];
    for (let lat = -80; lat <= 80; lat += 5) {
      for (let lon = -180; lon < 180; lon += 5) {
        gridDots.push(latLonToXYZ(lat, lon));
      }
    }

    const cityData = CITIES.map((c) => ({ ...c, pos: latLonToXYZ(c.lat, c.lon) }));

    let rotY = 0;
    let velY = 0;
    let autoRotating = true;
    let dragging = false;
    let lastX = 0;
    let frame = 0;
    let rafId = 0;

    function draw() {
      ctx.clearRect(0, 0, BUFFER, BUFFER);

      for (const dot of gridDots) {
        const r = rotateY(dot, rotY);
        if (r.z < -0.1) continue;
        const depth = (r.z + 1) / 2;
        const size = 0.6 + depth * 1.0;
        const alpha = 0.08 + depth * 0.57;
        ctx.beginPath();
        ctx.arc(cx + R * r.x, cy - R * r.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26,26,26,${alpha.toFixed(2)})`;
        ctx.fill();
      }

      for (const city of cityData) {
        const r = rotateY(city.pos, rotY);
        if (r.z < -0.1) continue;
        const sx = cx + R * r.x;
        const sy = cy - R * r.y;

        const ringOpacity = (Math.sin(frame * 0.05) * 0.5 + 0.5) * 0.6;
        const ringR = 6 + Math.sin(frame * 0.05) * 2;
        ctx.beginPath();
        ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(26,86,219,${ringOpacity.toFixed(2)})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = "#1A56DB";
        ctx.fill();

        if (r.z > 0.35) {
          ctx.font = "10px 'Urbanist', sans-serif";
          ctx.fillStyle = "rgba(26,26,26,0.7)";
          ctx.fillText(city.name, sx + 5, sy - 4);
        }
      }

      frame++;
    }

    function tick() {
      if (autoRotating && !dragging) {
        rotY += 0.003;
      } else if (!dragging) {
        velY *= 0.98;
        rotY += velY;
        if (Math.abs(velY) < 0.0002) {
          autoRotating = true;
          velY = 0;
        }
      }
      draw();
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    function onMouseDown(e: MouseEvent) {
      dragging = true;
      autoRotating = false;
      velY = 0;
      lastX = e.clientX;
    }

    function onMouseMove(e: MouseEvent) {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      velY = dx * 0.005;
      rotY += velY;
      lastX = e.clientX;
    }

    function onMouseUp() {
      dragging = false;
    }

    function onTouchStart(e: TouchEvent) {
      dragging = true;
      autoRotating = false;
      velY = 0;
      lastX = e.touches[0].clientX;
    }

    function onTouchMove(e: TouchEvent) {
      if (!dragging) return;
      const dx = e.touches[0].clientX - lastX;
      velY = dx * 0.005;
      rotY += velY;
      lastX = e.touches[0].clientX;
    }

    function onTouchEnd() {
      dragging = false;
    }

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    canvas.addEventListener("touchmove", onTouchMove, { passive: true });
    canvas.addEventListener("touchend", onTouchEnd);

    return () => {
      cancelAnimationFrame(rafId);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ borderRadius: "50%", cursor: "grab", display: "block" }}
      className="w-[280px] h-[280px] md:w-[420px] md:h-[420px]"
    />
  );
}
