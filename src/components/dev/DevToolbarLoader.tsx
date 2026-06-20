'use client';

import dynamic from 'next/dynamic';

const DevToolbar = dynamic(() => import('./DevToolbar'), { ssr: false });

/** Client-side wrapper required by Next 15: ssr:false is only allowed in Client Components. */
export function DevToolbarLoader() {
  return <DevToolbar />;
}
