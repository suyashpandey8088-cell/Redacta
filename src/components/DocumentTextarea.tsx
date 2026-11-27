import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type TextareaHTMLAttributes } from 'react';

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'onChange'> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * A textarea for whole documents. React keeps a controlled textarea's
 * `defaultValue` (its entire text content) in sync on every render, which
 * rewrites megabytes of DOM text per keystroke on a large file. Here the DOM
 * owns the value: it is written only when the text changes from outside
 * (opening a file, clearing, indenting), never echoed back after typing.
 */
export const DocumentTextarea = forwardRef<HTMLTextAreaElement, Props>(function DocumentTextarea(
  { value, onValueChange, ...rest },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  /** The last value this textarea reported, so typed text is never written back. */
  const reported = useRef<string | null>(null);
  useImperativeHandle(ref, () => innerRef.current as HTMLTextAreaElement, []);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (el && value !== reported.current) {
      el.value = value;
      reported.current = value;
    }
  }, [value]);

  return (
    <textarea
      ref={innerRef}
      {...rest}
      onChange={(e) => {
        const next = e.currentTarget.value;
        reported.current = next;
        onValueChange(next);
      }}
    />
  );
});
