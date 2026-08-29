/** Deterministic SVG cover art generator for blog posts and resources. */

const PALETTES = [
  { bg: "#F2F6F5", shapes: ["#0D4A3A", "#2A5C4E", "#1C3D32", "#E8F0EE"] },
  { bg: "#0D4A3A", shapes: ["#E8F0EE", "#F2F6F5", "#2A5C4E", "#ffffff"] },
  { bg: "#E8F0EE", shapes: ["#0D4A3A", "#2A5C4E", "#1C3D32", "#F2F6F5"] },
  { bg: "#0A0A0A", shapes: ["#0D4A3A", "#2A5C4E", "#E8F0EE", "#F2F6F5"] },
] as const;

/** Returns a deterministic pseudo-random number generator seeded from a string. */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  let s = Math.abs(hash);
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/** Generates a deterministic abstract SVG from a seed string (typically the post slug). */
export function generateCoverSVG(seed: string, width = 800, height = 420): string {
  const rand = seededRandom(seed);
  const palette = PALETTES[Math.floor(rand() * PALETTES.length)];

  const elements: string[] = [];

  elements.push(`<rect width="${width}" height="${height}" fill="${palette.bg}"/>`);

  // Topographic contour lines
  const numContours = 4 + Math.floor(rand() * 4);
  for (let i = 0; i < numContours; i++) {
    const cx = rand() * width;
    const cy = rand() * height;
    const rx = 80 + rand() * 280;
    const ry = 40 + rand() * 140;
    const rotation = rand() * 360;
    const color = palette.shapes[Math.floor(rand() * palette.shapes.length)];
    const opacity = (0.08 + rand() * 0.14).toFixed(2);
    elements.push(
      `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${rotation.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="none" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`
    );
  }

  // Geometric shapes
  const numShapes = 3 + Math.floor(rand() * 4);
  for (let i = 0; i < numShapes; i++) {
    const shapeType = Math.floor(rand() * 3);
    const color = palette.shapes[Math.floor(rand() * palette.shapes.length)];
    const opacity = (0.06 + rand() * 0.18).toFixed(2);
    const size = 40 + rand() * 160;

    if (shapeType === 0) {
      const x = rand() * width;
      const y = rand() * height;
      const rotation = rand() * 45;
      const h = size * (0.4 + rand() * 0.6);
      elements.push(
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${size.toFixed(1)}" height="${h.toFixed(1)}" transform="rotate(${rotation.toFixed(1)} ${(x + size / 2).toFixed(1)} ${(y + size / 2).toFixed(1)})" fill="${color}" opacity="${opacity}" rx="4"/>`
      );
    } else if (shapeType === 1) {
      const cx = rand() * width;
      const cy = rand() * height;
      elements.push(
        `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(size / 2).toFixed(1)}" fill="${color}" opacity="${opacity}"/>`
      );
    } else {
      const x = rand() * width;
      const y = rand() * height;
      const pts = `${x.toFixed(1)},${y.toFixed(1)} ${(x + size).toFixed(1)},${y.toFixed(1)} ${(x + size / 2).toFixed(1)},${(y - size * 0.8).toFixed(1)}`;
      elements.push(`<polygon points="${pts}" fill="${color}" opacity="${opacity}"/>`);
    }
  }

  // Subtle diagonal lines
  const numLines = 3 + Math.floor(rand() * 3);
  for (let i = 0; i < numLines; i++) {
    const x1 = rand() * width;
    const y1 = rand() * height;
    const x2 = x1 + 100 + rand() * 200;
    const y2 = y1 + 60 + rand() * 120;
    const color = palette.shapes[Math.floor(rand() * palette.shapes.length)];
    const opacity = (0.06 + rand() * 0.1).toFixed(2);
    elements.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="1" opacity="${opacity}"/>`
    );
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${elements.join("")}</svg>`;
}

/** Returns a base64 data URI for use in an <img src> attribute. */
export function generateCoverDataURI(seed: string): string {
  const svg = generateCoverSVG(seed);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}
