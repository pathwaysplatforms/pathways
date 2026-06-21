"use client"

import { GrainGradient } from "@paper-design/shaders-react"

/**
 * Ambient gradient background using Pathways blue tokens.
 * Designed to sit behind light-themed dashboard content at low intensity.
 */
export function GradientBackground() {
  return (
    <div className="absolute inset-0 -z-10">
      <GrainGradient
        style={{ height: "100%", width: "100%" }}
        colorBack="hsl(220, 20%, 97%)"
        softness={0.88}
        intensity={0.22}
        noise={0}
        shape="corners"
        offsetX={0}
        offsetY={0}
        scale={1.2}
        rotation={0}
        speed={0.4}
        colors={["hsl(221, 77%, 47%)", "hsl(231, 64%, 62%)", "hsl(210, 90%, 72%)"]}
      />
    </div>
  )
}
