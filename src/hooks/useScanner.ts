import { useEffect, useState } from 'react';
import { createScanner, type Scanner } from '../lib/scanner';

/** One scanner (and at most one worker) per mounted component, stopped on unmount. */
export function useScanner(): Scanner {
  const [scanner] = useState(createScanner);
  useEffect(() => () => scanner.dispose(), [scanner]);
  return scanner;
}
