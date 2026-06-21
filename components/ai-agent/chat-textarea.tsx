"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";

interface ChatTextareaProps {
  placeholder: string;
  disabled?: boolean;
  onHeightAdjust?: (el: HTMLTextAreaElement) => void;
  onEnterPress?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextChange?: (text: string) => void;
}

export interface ChatTextareaHandle {
  reset: () => void;
}

export const ChatTextarea = forwardRef<ChatTextareaHandle, ChatTextareaProps>(
  function ChatTextarea({ placeholder, disabled, onHeightAdjust, onEnterPress, onTextChange }, ref) {
    const [text, setText] = useState("");
    const elRef = useRef<HTMLTextAreaElement>(null);

    useImperativeHandle(ref, () => ({
      reset() {
        setText("");
        if (elRef.current) {
          elRef.current.style.height = "auto";
        }
      },
    }));

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        setText(val);
        onTextChange?.(val);
        if (elRef.current) {
          elRef.current.style.height = "auto";
          elRef.current.style.height = `${Math.min(elRef.current.scrollHeight, 160)}px`;
        }
        if (elRef.current) {
          onHeightAdjust?.(elRef.current);
        }
      },
      [onTextChange, onHeightAdjust],
    );

    return (
      <textarea
        ref={elRef}
        value={text}
        onChange={handleChange}
        onKeyDown={onEnterPress}
        placeholder={placeholder}
        disabled={disabled}
        rows={4}
        className="max-h-64 min-h-[120px] flex-1 resize-none bg-transparent text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500 disabled:opacity-50"
      />
    );
  },
);
