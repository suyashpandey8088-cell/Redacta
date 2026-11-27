import { useMemo } from 'react';
import { lineStarts } from '../lib/pii';

export interface TextLayout {
  text: string;
  starts: number[];
  /** Longest line, in characters — sizes the horizontal scroll range. */
  maxColumns: number;
}

export function useTextLayout(text: string): TextLayout {
  return useMemo(() => {
    const starts = lineStarts(text);
    let maxColumns = 0;
    for (let i = 0; i < starts.length; i++) {
      const end = i + 1 < starts.length ? starts[i + 1] - 1 : text.length;
      if (end - starts[i] > maxColumns) maxColumns = end - starts[i];
    }
    return { text, starts, maxColumns };
  }, [text]);
}
