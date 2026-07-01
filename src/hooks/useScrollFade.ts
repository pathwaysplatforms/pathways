import { useCallback, useRef, useState } from 'react';

interface ScrollFade<T extends HTMLElement> {
  /** Callback ref to attach to the scrollable container. */
  ref: (node: T | null) => void;
  /** True while the container overflows below the current scroll position. */
  faded: boolean;
}

/**
 * Tracks whether a scroll container has more content below the fold, for a
 * bottom fade cue. Returns a callback ref for the scroll element and a `faded`
 * flag that is true when `scrollHeight > clientHeight` and the user has not yet
 * scrolled to the bottom (within a 4px threshold).
 */
export function useScrollFade<T extends HTMLElement = HTMLDivElement>(): ScrollFade<T> {
  const [faded, setFaded] = useState(false);
  const nodeRef = useRef<T | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const update = useCallback(() => {
    const el = nodeRef.current;
    if (!el) {
      setFaded(false);
      return;
    }
    const overflowing =
      el.scrollHeight > el.clientHeight &&
      el.scrollTop < el.scrollHeight - el.clientHeight - 4;
    setFaded(overflowing);
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      // Tear down listeners on any previously attached node.
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      nodeRef.current = node;
      if (!node) {
        setFaded(false);
        return;
      }
      update();
      node.addEventListener('scroll', update, { passive: true });
      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(node);
      const mutationObserver = new MutationObserver(update);
      mutationObserver.observe(node, { childList: true, subtree: true });
      cleanupRef.current = () => {
        node.removeEventListener('scroll', update);
        resizeObserver.disconnect();
        mutationObserver.disconnect();
      };
    },
    [update],
  );

  return { ref, faded };
}
