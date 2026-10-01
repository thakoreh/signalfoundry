"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "./icons";
export function Dialog({
  title,
  onClose,
  children,
  wide = false,
  drawer = false,
  busy = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  drawer?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${drawer ? "drawer" : ""}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="dialog-inner">
        <button
          className="icon-btn dialog-close"
          onClick={onClose}
          aria-label={`Close ${title}`}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
        {children}
      </div>
    </dialog>
  );
}
