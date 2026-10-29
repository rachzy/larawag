'use client';
import { useImperativeHandle, useRef, type CSSProperties, type Ref } from 'react';
import type { SystemInput } from '@larawag/core';
import { useStarSystem, type StarSystemHandle, type StarSystemProps } from './use-star-system.js';

/** Props for `<StarSystem>`. */
export interface StarSystemComponentProps extends StarSystemProps {
  /** The star and planets. Compared by value, so a new object with the same content does not rebuild. */
  system: SystemInput;
  className?: string;
  /** Merged over `width: 100%; height: 100%`. Size the parent to size the view. */
  style?: CSSProperties;
  ref?: Ref<StarSystemHandle>;
}

/** A div that renders a star-system view and fills its parent. */
export function StarSystem({ system, className, style, ref, ...props }: StarSystemComponentProps) {
  const container = useRef<HTMLDivElement>(null);
  const handle = useStarSystem(container, system, props);
  useImperativeHandle(ref, () => handle, [handle]);
  return <div ref={container} className={className} style={{ width: '100%', height: '100%', ...style }} />;
}
