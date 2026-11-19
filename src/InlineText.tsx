import { createElement, useLayoutEffect, useRef, type KeyboardEvent } from "react";

import { cleanEditedText } from "./inlineTextModel";
export type { TextTarget } from "./inlineTextModel";

/**
 * Text that is written right where it stands in the editor (contenteditable, plain text only).
 * Outside the editor (or without `onCommit`) it renders as normal text. The DOM owns the text while the
 * field has focus, so a re-render never moves the caret; the value is committed on blur, Enter (single
 * line) or Cmd/Ctrl+Enter, Escape restores the original.
 */
export function InlineText({
  as = "p",
  value,
  onCommit,
  multiline = true,
  className,
  placeholder,
  label,
}: {
  as?: "p" | "h1" | "h2" | "blockquote" | "span";
  value: string;
  onCommit?: (next: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  label?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const editable = !!onCommit;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !editable) return;
    if (el.ownerDocument.activeElement === el) return; // typing: the DOM is the source of truth
    if (el.innerText !== value) el.innerText = value;
  }, [value, editable]);
  if (!editable) return createElement(as, { className }, value);
  const commit = () => {
    const el = ref.current;
    if (!el) return;
    const next = cleanEditedText(el.innerText, multiline);
    if (next !== value) onCommit(next);
    else if (el.innerText !== value) el.innerText = value;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const el = e.currentTarget;
    // Typing belongs to the text: no module shortcuts (delete, arrows, variants) while writing.
    if (!((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s")) e.stopPropagation();
    if (e.key === "Escape") {
      e.preventDefault();
      el.innerText = value;
      el.blur();
    } else if (e.key === "Enter" && (!multiline || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      el.blur();
    }
  };
  return createElement(as, {
    ref,
    className: `${className ?? ""} inline-text`.trim(),
    contentEditable: "plaintext-only",
    suppressContentEditableWarning: true,
    spellCheck: true,
    role: "textbox",
    "aria-multiline": multiline,
    "aria-label": label,
    "data-placeholder": placeholder,
    onKeyDown,
    onBlur: commit,
    onPaste: (e: React.ClipboardEvent<HTMLElement>) => {
      // Older engines ignore plaintext-only: paste text, never markup.
      e.preventDefault();
      const text = e.clipboardData.getData("text/plain");
      e.currentTarget.ownerDocument.execCommand("insertText", false, text);
    },
  });
}
