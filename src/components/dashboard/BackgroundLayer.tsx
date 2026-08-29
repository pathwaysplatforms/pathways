'use client';

import { useEffect, useState } from 'react';
import { GrainGradient } from '@paper-design/shaders-react';
import { useShouldReduceMotion } from '@/hooks/useReducedMotion';

/**
 * Static CSS approximation of the shader palette. Used during first paint and as
 * the reduced-motion / low-memory fallback so no WebGL context is ever created.
 */
const STATIC_GRADIENT =
  'radial-gradient(circle at 0% 0%, hsla(221, 77%, 47%, 0.22), transparent 55%),' +
  'radial-gradient(circle at 100% 0%, hsla(231, 64%, 62%, 0.20), transparent 55%),' +
  'radial-gradient(circle at 100% 100%, hsla(210, 90%, 72%, 0.22), transparent 55%),' +
  'radial-gradient(circle at 0% 100%, hsla(221, 77%, 47%, 0.16), transparent 55%),' +
  'hsl(220, 20%, 97%)';

/**
 * Fixed, full-viewport ambient background at z-index 0. Renders the animated
 * WebGL grain-gradient shader for full-motion clients and a static CSS gradient
 * under reduced-motion / low-memory conditions (shader never mounts). Never
 * transformed, so it stays perfectly still while the plane slides.
 */
export function BackgroundLayer() {
  const shouldReduce = useShouldReduceMotion();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => setMounted(true), []);

  // Pause the shader's rAF loop while the tab is hidden (speed 0 stops it).
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Static gradient during SSR/first paint; the shader only mounts once we know
  // the client allows full motion — under reduce/low-memory it never mounts.
  const useShader = mounted && !shouldReduce;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        background: useShader ? undefined : STATIC_GRADIENT,
      }}
    >
      {useShader && (
        <GrainGradient
          style={{ height: '100%', width: '100%' }}
          colorBack="hsl(220, 20%, 97%)"
          softness={0.88}
          intensity={0.22}
          noise={0}
          shape="corners"
          offsetX={0}
          offsetY={0}
          scale={1.2}
          rotation={0}
          speed={visible ? 0.4 : 0}
          colors={['hsl(221, 77%, 47%)', 'hsl(231, 64%, 62%)', 'hsl(210, 90%, 72%)']}
        />
      )}
    </div>
  );
}
