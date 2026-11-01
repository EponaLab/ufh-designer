import { useEffect, useRef, useState } from 'react';
import { MIN_ROOM_SIZE } from '../constants';
import { sideLength, sideMidpoint, type Side } from '../lib/geometry';
import type { Room, Viewport } from '../types';

const MAX_LENGTH = 100;

interface LengthEditorProps {
  room: Room;
  side: Side;
  viewport: Viewport;
  /** Called with the new length in meters (already validated and rounded to cm). */
  onCommit: (length: number) => void;
  onClose: () => void;
}

/** Parse "4.5" or "4,5" (locale decimal comma) into meters, or null if invalid/out of range. */
function parseLength(text: string): number | null {
  const n = parseFloat(text.trim().replace(',', '.'));
  if (!Number.isFinite(n) || n < MIN_ROOM_SIZE || n > MAX_LENGTH) return null;
  return Math.round(n * 100) / 100;
}

/** Inline field on a room side for typing its exact length. Enter/blur applies, Escape cancels. */
export function LengthEditor({ room, side, viewport, onCommit, onClose }: LengthEditorProps) {
  const [text, setText] = useState(() => sideLength(room, side).toFixed(2));
  const inputRef = useRef<HTMLInputElement>(null);
  const doneRef = useRef(false);
  const valid = parseLength(text) !== null;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (apply: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const length = parseLength(text);
    if (apply && length !== null) onCommit(length);
    onClose();
  };

  const pos = sideMidpoint(room, side, viewport);

  return (
    <label className={`length-editor${valid ? '' : ' is-invalid'}`} style={{ left: pos.x, top: pos.y }}>
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={text}
        aria-label={`${side === 'n' || side === 's' ? 'Width' : 'Height'} of ${room.name} (m)`}
        aria-invalid={!valid}
        title={`${MIN_ROOM_SIZE}–${MAX_LENGTH} m · Enter to apply, Esc to cancel`}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') finish(true);
          else if (e.key === 'Escape') finish(false);
        }}
        onBlur={() => finish(true)}
      />
      <span aria-hidden="true">m</span>
    </label>
  );
}
