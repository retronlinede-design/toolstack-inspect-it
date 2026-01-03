// ToolStack UI v1 — shared components (copy into each app)
// Put this file at: src/toolstack-ui.jsx

import React from "react";

export function cx(...xs) {
  return xs.filter(Boolean).join(" ");
}

export function Container({ children }) {
  return <div className="ts-container">{children}</div>;
}

export function TopBar({ title, subtitle, right }) {
  return (
    <div className="ts-topbar">
      <div>
        <div className="ts-title">{title}</div>
        {subtitle ? <div className="ts-subtitle">{subtitle}</div> : null}
        <div className="ts-accent-line mt-3" />
      </div>
      <div className="flex flex-wrap gap-2 justify-end ts-no-print">{right}</div>
    </div>
  );
}

export function Card({ children, className }) {
  return <div className={cx("ts-card ts-card-pad", className)}>{children}</div>;
}

export function SectionTitle({ children }) {
  return <div className="ts-section-title">{children}</div>;
}

export function Button({ variant = "default", className, ...props }) {
  const v =
    variant === "primary"
      ? "ts-btn ts-btn-primary"
      : variant === "accent"
      ? "ts-btn ts-btn-accent"
      : variant === "danger"
      ? "ts-btn ts-btn-danger"
      : "ts-btn";
  return <button className={cx(v, className)} {...props} />;
}

export function Field({ label, help, children }) {
  return (
    <label className="ts-field-label">
      <div className="ts-muted">{label}</div>
      {children}
      {help ? <div className="ts-field-help mt-1">{help}</div> : null}
    </label>
  );
}

export function Input(props) {
  return <input className={cx("ts-input", props.className)} {...props} />;
}

export function Select(props) {
  return <select className={cx("ts-select", props.className)} {...props} />;
}

export function Textarea(props) {
  return <textarea className={cx("ts-textarea", props.className)} {...props} />;
}

export function Badge({ kind = "ok", children }) {
  const k =
    kind === "bad"
      ? "ts-badge ts-badge-bad"
      : kind === "warn"
      ? "ts-badge ts-badge-warn"
      : kind === "na"
      ? "ts-badge ts-badge-na"
      : "ts-badge ts-badge-ok";
  return <span className={k}>{children}</span>;
}

export function Modal({ open, title, actions, onClose, children }) {
  if (!open) return null;
  return (
    <div className="ts-modal-overlay">
      <div className="ts-modal">
        <div className="ts-modal-head">
          <div className="font-semibold">{title}</div>
          <div className="flex gap-2">
            {actions}
            <Button variant="primary" onClick={onClose}>Close</Button>
          </div>
        </div>
        <div className="ts-modal-body">{children}</div>
      </div>
    </div>
  );
}
