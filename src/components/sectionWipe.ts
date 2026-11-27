import { createContext, useContext } from 'react';
import { scrollToTarget } from '../lib/smoothScroll';

/** Jump to a section by element id, or to the top of the page with `'top'`. */
export type WipeFn = (target: string) => void;

/** Without a provider, jumps happen directly with no wipe animation. */
export const WipeContext = createContext<WipeFn>((target) => {
  if (target === 'top') scrollToTarget(0);
  else {
    const el = document.getElementById(target);
    if (el) scrollToTarget(el);
  }
});

export const useSectionWipe = () => useContext(WipeContext);
