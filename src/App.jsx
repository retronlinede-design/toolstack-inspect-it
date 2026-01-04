import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * ToolStack — Inspect-It — Free inspection checklist
 * Paste into: src/App.jsx
 * Requires: Tailwind v4 configured
 *
 * UI Lock (Check-It master):
 * - bg-neutral-50, text-neutral-800/700
 * - Primary buttons: bg-neutral-700 text-white
 * - Lime accent separators (match “It”)
 * - Normalized Top Actions grid + pinned ? Help
 * - Print preview prints ONLY the preview sheet
 */

const APP_ID = "inspectit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";

// Put your real ToolStack hub URL here (Wix page)
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

// ---------------------------
// safe helpers
// ---------------------------

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function uid(prefix = "id") {
  try {
    if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  } catch {
    // ignore
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ---------------------------
// localStorage safe wrapper
// ---------------------------

const canUseLS = () => {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
};

const lsGet = (k) => {
  if (!canUseLS()) return null;
  try {
    return window.localStorage.getItem(k);
  } catch {
    return null;
  }
};

const lsSet = (k, v) => {
  if (!canUseLS()) return;
  try {
    window.localStorage.setItem(k, v);
  } catch {
    // ignore
  }
};

// ---------------------------
// UI tokens (Check-It master)
// ---------------------------

const inputBase =
  "w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";

const card = "rounded-2xl bg-white border border-neutral-200 shadow-sm";
const cardPad = "p-4";

const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, disabled, title }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`${ACTION_BASE} bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200`}
    >
      {children}
    </button>
  );
}

function SmallButton({ children, onClick, tone = "default", className = "", disabled, title, type = "button" }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-700 hover:bg-neutral-600 text-white border-neutral-700 shadow-sm"
      : tone === "danger"
        ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-sm"
        : "bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200 shadow-sm";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`print:hidden px-3 py-2 rounded-xl text-sm font-medium border transition active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({ title, onClick, tone = "default", children }) {
  const cls =
    tone === "danger"
      ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
      : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`print:hidden h-9 w-9 rounded-xl border shadow-sm flex items-center justify-center transition active:translate-y-[1px] ${cls}`}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function CalendarIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 3v3m8-3v3M4.5 9.5h15M6.5 5.5h11a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------
// Trip-It style date picker (custom mini calendar)
// ---------------------------

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Monday-first (DE-friendly)
const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

function isValidISODate(s) {
  const str = String(s || "");
  if (str.length !== 10) return false;
  if (str[4] !== "-" || str[7] !== "-") return false;
  for (let i = 0; i < 10; i++) {
    if (i === 4 || i === 7) continue;
    if (!isDigit(str[i])) return false;
  }
  return true;
}

function parseISODate(s) {
  if (!isValidISODate(s)) return null;
  const y = Number(String(s).slice(0, 4));
  const m = Number(String(s).slice(5, 7));
  const d = Number(String(s).slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

function toISODate(dt) {
  const y = dt.getFullYear();
  const m = dt.getMonth() + 1;
  const d = dt.getDate();
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function startOfMonth(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

function addMonths(dt, delta) {
  const y = dt.getFullYear();
  const m = dt.getMonth();
  const d = dt.getDate();
  const next = new Date(y, m + delta, 1);
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  return new Date(next.getFullYear(), next.getMonth(), Math.min(d, maxDay));
}

function mondayFirstIndex(jsDay) {
  // JS: Sun=0..Sat=6 -> Mon=0..Sun=6
  return (jsDay + 6) % 7;
}

function buildMonthGrid(viewDate) {
  const first = startOfMonth(viewDate);
  const year = first.getFullYear();
  const month = first.getMonth();
  const firstDow = mondayFirstIndex(first.getDay());

  const start = new Date(year, month, 1 - firstDow);
  const grid = [];

  for (let r = 0; r < 6; r++) {
    const row = [];
    for (let c = 0; c < 7; c++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + r * 7 + c);
      row.push(cell);
    }
    grid.push(row);
  }

  return grid;
}

function DatePicker({ label = "Date", value, onChange }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const selected = useMemo(() => parseISODate(value), [value]);

  const [viewDate, setViewDate] = useState(() => {
    const base = parseISODate(value) || today;
    return startOfMonth(base);
  });

  useEffect(() => {
    const base = parseISODate(value);
    if (!base) return;
    if (!open) setViewDate(startOfMonth(base));
  }, [value, open]);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();

      const vw = window.innerWidth || 0;
      const vh = window.innerHeight || 0;

      const POP_W = 360;
      const POP_H = 360;

      let left = clamp(r.left, 8, Math.max(8, vw - POP_W - 8));
      let top = r.bottom + 8;
      if (top + POP_H > vh - 8) top = Math.max(8, r.top - POP_H - 8);

      setPos({ top, left });
    };

    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const grid = useMemo(() => buildMonthGrid(viewDate), [viewDate]);

  const display = value && isValidISODate(value) ? value : "Select date";

  const sameDay = (a, b) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const inViewMonth = (dt) => dt.getMonth() === viewDate.getMonth() && dt.getFullYear() === viewDate.getFullYear();

  return (
    <div className="text-sm">
      <div className="text-neutral-600 font-medium">{label}</div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition flex items-center justify-between gap-2"
        title="Choose a date"
      >
        <span className={value ? "font-medium" : "text-neutral-500"}>{display}</span>
        <CalendarIcon className="h-5 w-5 text-neutral-600" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Close date picker"
            onClick={() => setOpen(false)}
          />

          <div
            className="fixed z-50 rounded-2xl bg-white border border-neutral-200 shadow-xl p-3"
            style={{ top: pos.top, left: pos.left, width: 360 }}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewDate((d) => startOfMonth(addMonths(d, -1)))}
                className="h-9 w-9 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 flex items-center justify-center"
                aria-label="Previous month"
                title="Previous month"
              >
                <span className="text-lg leading-none">‹</span>
              </button>

              <div className="text-sm font-semibold text-neutral-800">
                {MONTHS[viewDate.getMonth()]} {viewDate.getFullYear()}
              </div>

              <button
                type="button"
                onClick={() => setViewDate((d) => startOfMonth(addMonths(d, 1)))}
                className="h-9 w-9 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 flex items-center justify-center"
                aria-label="Next month"
                title="Next month"
              >
                <span className="text-lg leading-none">›</span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-xs text-neutral-600">
              {DOW.map((d) => (
                <div key={d} className="text-center font-semibold">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-1">
              {grid.flat().map((dt) => {
                const isToday = sameDay(dt, today);
                const isSelected = selected ? sameDay(dt, selected) : false;
                const isInMonth = inViewMonth(dt);

                const base = "h-9 rounded-xl text-sm flex items-center justify-center border transition select-none";

                const cls = isSelected
                  ? "bg-neutral-700 text-white border-neutral-700"
                  : isToday
                    ? "bg-white text-neutral-800 border-[#D5FF00]"
                    : "bg-white text-neutral-800 border-neutral-200 hover:bg-neutral-50";

                const dim = isInMonth ? "" : "opacity-40";

                return (
                  <button
                    key={toISODate(dt)}
                    type="button"
                    className={`${base} ${cls} ${dim}`}
                    onClick={() => {
                      onChange?.(toISODate(dt));
                      setOpen(false);
                    }}
                    title={toISODate(dt)}
                  >
                    {dt.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800"
                onClick={() => {
                  onChange?.(toISODate(today));
                  setOpen(false);
                }}
              >
                Today
              </button>

              <button
                type="button"
                className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------
// Help Pack v1 (ToolStack standard)
// ---------------------------

function HelpModal({ open, onClose, onReset }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 sm:p-8 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden flex flex-col"
      >
        <div className="sticky top-0 z-10 bg-white p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-neutral-800">Help</div>
            <div className="text-sm text-neutral-700 mt-1">How your data is saved + how to keep continuity.</div>
            <div className="mt-3 h-[2px] w-56 rounded-full bg-gradient-to-r from-[#D5FF00]/0 via-[#D5FF00] to-[#D5FF00]/0" />
          </div>
          <button
            type="button"
            className="shrink-0 px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm text-neutral-700 overflow-auto min-h-0">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Autosave (default)</div>
            <div className="mt-1">
              Inspect-It saves automatically in your browser (localStorage) under:
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="font-mono text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1">{KEY}</span>
                <span className="font-mono text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1">{PROFILE_KEY}</span>
              </div>
            </div>
            <div className="text-xs text-neutral-600 mt-2">
              If you clear browser data or switch devices/browsers, your local data won’t follow automatically.
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Best practice (continuity)</div>
            <ul className="mt-2 space-y-2 list-disc pl-5">
              <li>
                Use <span className="font-semibold">Export</span> once a week (or after big updates) to create a backup JSON file.
              </li>
              <li>Store that JSON in a safe place (Google Drive / iCloud / email to yourself / USB).</li>
              <li>
                On a new device/browser, use <span className="font-semibold">Import</span> to restore everything.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Printing / PDF</div>
            <div className="mt-1">
              Use <span className="font-semibold">Preview</span> to check the layout, then <span className="font-semibold">Print / Save PDF</span> and choose “Save as PDF”.
            </div>
            <div className="text-xs text-neutral-600 mt-2">When Preview is open, printing will include only the preview sheet.</div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-800">Privacy</div>
            <div className="mt-1">Inspect-It runs in your browser. There’s no account system here yet, and nothing is uploaded unless you choose to share your exported file.</div>
          </div>

          <div className="text-xs text-neutral-600">Tip: Export once a week (or after big updates) so you always have a clean backup.</div>
        </div>

        <div className="p-4 border-t border-neutral-100 flex items-center justify-between gap-2">
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition"
            onClick={onReset}
          >
            Reset app data
          </button>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 transition"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------
// data model
// ---------------------------

function defaultTemplate() {
  const mkItem = (label) => ({ id: uid("i"), label, condition: "ok" });
  const mkSection = (title, items) => ({
    id: uid("s"),
    title,
    items: items.map(mkItem),
  });

  return {
    name: "Default Inspection",
    sections: [
      mkSection("Entrance / Hall", ["Door & lock", "Walls/paint", "Flooring", "Lights/switches"]),
      mkSection("Living / Bedroom", ["Walls/paint", "Flooring", "Windows/frames", "Heating/radiator", "Curtains/blinds"]),
      mkSection("Kitchen", ["Cabinets/countertop", "Sink & taps", "Appliances (if included)", "Tiles/splashback", "Ventilation"]),
      mkSection("Bathroom", ["Bath/shower", "Tiles/grout", "Toilet", "Sink & taps", "Ventilation"]),
      mkSection("Utilities / Electrical", ["Sockets", "Light fixtures", "Water shutoff", "Smoke detector"]),
      mkSection("Windows / Exterior", ["Windows open/close", "Seals", "Balcony/terrace (if any)", "Mailbox/keys"]),
    ],
  };
}

function loadProfile() {
  return (
    safeParse(lsGet(PROFILE_KEY), null) || {
      org: "",
      user: "",
    }
  );
}

function loadState() {
  const fallback = {
    meta: {
      appId: APP_ID,
      version: APP_VERSION,
      updatedAt: new Date().toISOString(),
    },
    template: defaultTemplate(),
    inspections: [],
  };

  const loaded = safeParse(lsGet(KEY), null);
  if (!loaded || !loaded.template || !Array.isArray(loaded.inspections)) return fallback;

  return {
    ...fallback,
    ...loaded,
    meta: { ...fallback.meta, ...(loaded.meta || {}), appId: APP_ID, version: APP_VERSION },
    template: loaded.template || fallback.template,
    inspections: Array.isArray(loaded.inspections) ? loaded.inspections : [],
  };
}

function saveState(state) {
  const next = {
    ...state,
    meta: { ...(state.meta || {}), appId: APP_ID, version: APP_VERSION, updatedAt: new Date().toISOString() },
  };
  lsSet(KEY, JSON.stringify(next));
  return next;
}

function normalizeTemplate(tpl) {
  const t = tpl || defaultTemplate();
  return {
    ...t,
    sections: Array.isArray(t.sections)
      ? t.sections.map((s) => ({
          id: s?.id || uid("s"),
          title: String(s?.title || "Section"),
          items: Array.isArray(s?.items)
            ? s.items.map((it) => ({
                id: it?.id || uid("i"),
                label: String(it?.label || "Item"),
                condition: it?.condition || "ok",
              }))
            : [],
        }))
      : [],
  };
}

function buildDraftFromTemplate(tpl, { date, inspectionType, propertyLabel, address, occupants, notes }) {
  const t = normalizeTemplate(tpl);
  return {
    date,
    inspectionType,
    propertyLabel: propertyLabel || "",
    address: address || "",
    occupants: occupants || "",
    notes: notes || "",
    sections: (t.sections || []).map((s) => ({
      id: s.id,
      title: s.title,
      items: (s.items || []).map((it) => ({
        id: it.id,
        label: it.label,
        condition: "ok",
        note: "",
        evidenceRef: "",
      })),
    })),
  };
}

const CONDITION_OPTIONS = [
  { key: "ok", label: "OK" },
  { key: "worn", label: "Worn" },
  { key: "damaged", label: "Damaged" },
  { key: "missing", label: "Missing" },
  { key: "n/a", label: "N/A" },
];

function badgeClass(cond) {
  switch (cond) {
    case "damaged":
    case "missing":
      return "bg-red-100 text-red-800 border-red-200";
    case "worn":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "n/a":
      return "bg-neutral-100 text-neutral-700 border-neutral-200";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
}

// ---------------------------
// App
// ---------------------------

export default function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [state, setState] = useState(loadState);

  const [date, setDate] = useState(isoToday());
  const [inspectionType, setInspectionType] = useState("move-in"); // move-in | move-out | periodic
  const [propertyLabel, setPropertyLabel] = useState("");
  const [address, setAddress] = useState("");
  const [occupants, setOccupants] = useState("");
  const [notes, setNotes] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const fileRef = useRef(null);

  // draft
  const [draft, setDraft] = useState(() => {
    const t = loadState().template;
    return buildDraftFromTemplate(t, { date, inspectionType, propertyLabel: "", address: "", occupants: "", notes: "" });
  });

  // persist profile
  useEffect(() => {
    lsSet(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  // ensure state meta + persist once
  useEffect(() => {
    setState((prev) => saveState(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist any state changes
  useEffect(() => {
    lsSet(KEY, JSON.stringify(state));
  }, [state]);

  // keep draft header fields in sync
  useEffect(() => {
    setDraft((d) => ({ ...d, date, inspectionType }));
  }, [date, inspectionType]);

  useEffect(() => {
    setDraft((d) => ({ ...d, propertyLabel, address, occupants, notes }));
  }, [propertyLabel, address, occupants, notes]);

  const totals = useMemo(() => {
    let total = 0;
    let damaged = 0;
    let worn = 0;
    let missing = 0;
    for (const s of draft.sections || []) {
      for (const it of s.items || []) {
        total++;
        if (it.condition === "damaged") damaged++;
        if (it.condition === "worn") worn++;
        if (it.condition === "missing") missing++;
      }
    }
    return { total, damaged, worn, missing };
  }, [draft.sections]);

  function updateItem(sectionId, itemId, patch) {
    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: (s.items || []).map((it) => (it.id !== itemId ? it : { ...it, ...patch })),
            }
      ),
    }));
  }

  // -------- template builder actions (adds sections/items for future + current) --------

  function setTemplateAndPersist(nextTemplate) {
    setState((prev) => saveState({ ...prev, template: normalizeTemplate(nextTemplate) }));
  }

  function addSection() {
    const title = window.prompt("Section title?", "New section");
    if (!title) return;
    const sectionId = uid("s");
    const nextTitle = String(title).trim() || "New section";

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = [...(nextTemplate.sections || []), { id: sectionId, title: nextTitle, items: [] }];
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: [...(d.sections || []), { id: sectionId, title: nextTitle, items: [] }],
    }));
  }

  function renameSection(sectionId) {
    const current = (draft.sections || []).find((s) => s.id === sectionId)?.title || "";
    const title = window.prompt("Rename section", current);
    if (!title) return;

    const nextTitle = String(title).trim() || current;

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).map((s) => (s.id !== sectionId ? s : { ...s, title: nextTitle }));
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) => (s.id !== sectionId ? s : { ...s, title: nextTitle })),
    }));
  }

  function deleteSection(sectionId) {
    const sTitle = (draft.sections || []).find((s) => s.id === sectionId)?.title || "this section";
    const ok = window.confirm(`Delete “${sTitle}”? This removes it from the checklist template too.`);
    if (!ok) return;

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).filter((s) => s.id !== sectionId);
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).filter((s) => s.id !== sectionId),
    }));
  }

  function addItemToSection(sectionId) {
    const label = window.prompt("Item label?", "New item");
    if (!label) return;
    const itemId = uid("i");
    const nextLabel = String(label).trim() || "New item";

    // template
    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            items: [...(s.items || []), { id: itemId, label: nextLabel, condition: "ok" }],
          }
    );
    setTemplateAndPersist(nextTemplate);

    // draft
    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: [...(s.items || []), { id: itemId, label: nextLabel, condition: "ok", note: "", evidenceRef: "" }],
            }
      ),
    }));
  }

  function renameItem(sectionId, itemId) {
    const current = (draft.sections || []).find((s) => s.id === sectionId)?.items?.find((it) => it.id === itemId)?.label;
    const label = window.prompt("Rename item", current || "");
    if (!label) return;
    const nextLabel = String(label).trim() || current || "Item";

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            items: (s.items || []).map((it) => (it.id !== itemId ? it : { ...it, label: nextLabel })),
          }
    );
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: (s.items || []).map((it) => (it.id !== itemId ? it : { ...it, label: nextLabel })),
            }
      ),
    }));
  }

  function deleteItem(sectionId, itemId) {
    const label = (draft.sections || []).find((s) => s.id === sectionId)?.items?.find((it) => it.id === itemId)?.label;
    const ok = window.confirm(`Delete item “${label || "this item"}”? This removes it from the checklist template too.`);
    if (!ok) return;

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).map((s) =>
      s.id !== sectionId
        ? s
        : {
            ...s,
            items: (s.items || []).filter((it) => it.id !== itemId),
          }
    );
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: (s.items || []).filter((it) => it.id !== itemId),
            }
      ),
    }));
  }

  function resetDraft() {
    setPropertyLabel("");
    setAddress("");
    setOccupants("");
    setNotes("");
    setDraft(
      buildDraftFromTemplate(state.template, {
        date,
        inspectionType,
        propertyLabel: "",
        address: "",
        occupants: "",
        notes: "",
      })
    );
  }

  function saveInspection() {
    const ins = {
      id: uid("insp"),
      createdAt: new Date().toISOString(),
      date,
      inspectionType,
      propertyLabel: String(propertyLabel || "").trim(),
      address: String(address || "").trim(),
      occupants: String(occupants || "").trim(),
      notes: String(notes || "").trim(),
      sections: draft.sections,
      summary: totals,
    };

    setState((prev) =>
      saveState({
        ...prev,
        inspections: [ins, ...(prev.inspections || [])],
      })
    );

    resetDraft();
  }

  function deleteInspection(id) {
    setState((prev) =>
      saveState({
        ...prev,
        inspections: (prev.inspections || []).filter((x) => x.id !== id),
      })
    );
  }

  function exportJSON() {
    const payload = {
      meta: { appId: APP_ID, version: APP_VERSION, exportedAt: new Date().toISOString() },
      profile,
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-${APP_ID}-${APP_VERSION}-${isoToday()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onImportPick() {
    fileRef.current?.click();
  }

  async function importJSON(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(String(text || ""));
      const incoming = parsed?.data;

      if (!incoming?.template || !Array.isArray(incoming?.inspections)) throw new Error("Invalid import file");

      setProfile(parsed?.profile || profile);
      setState(saveState({ ...incoming, template: normalizeTemplate(incoming.template) }));
      setDraft(
        buildDraftFromTemplate(incoming.template, {
          date,
          inspectionType,
          propertyLabel,
          address,
          occupants,
          notes,
        })
      );
    } catch (e) {
      alert("Import failed: " + (e?.message || "unknown error"));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const openPreview = () => setPreviewOpen(true);

  const printFromPreview = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 60);
  };

  const resetAppData = () => {
    const ok = window.confirm("Reset Inspect-It data? This clears local storage for this app.");
    if (!ok) return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    const fresh = loadState();
    setState(fresh);
    setPreviewOpen(false);
    setHelpOpen(false);

    setDate(isoToday());
    setInspectionType("move-in");
    setPropertyLabel("");
    setAddress("");
    setOccupants("");
    setNotes("");

    setDraft(
      buildDraftFromTemplate(fresh.template, {
        date: isoToday(),
        inspectionType: "move-in",
        propertyLabel: "",
        address: "",
        occupants: "",
        notes: "",
      })
    );
  };

  // -------- print scoping (print ONLY preview sheet) --------
  const PRINT_SCOPE_CSS = `
    @media print {
      body * { visibility: hidden !important; }
      #inspectit-print-preview, #inspectit-print-preview * { visibility: visible !important; }
      #inspectit-print-preview { position: absolute !important; left: 0; top: 0; width: 100%; }
    }
  `;

  const GLOBAL_CSS = `
    :root { color-scheme: light; }
    @media print {
      body { background: white !important; }
      .print\\:hidden { display: none !important; }
    }
  `;

  // -------- minimal self-tests (non-blocking) --------
  useEffect(() => {
    try {
      const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
      if (!params.get("tests")) return;

      console.group("Inspect-It self-tests");

      console.assert(KEY.includes(APP_ID), "KEY should contain app id");
      console.assert(PROFILE_KEY.includes("profile"), "PROFILE_KEY should look like a shared profile key");

      const a = safeParse('{"x":1}', null);
      console.assert(a && a.x === 1, "safeParse should parse valid JSON");
      const b = safeParse("not-json", { ok: true });
      console.assert(b && b.ok === true, "safeParse should return fallback on invalid JSON");

      const s = loadState();
      console.assert(!!s.template && Array.isArray(s.inspections), "loadState should return a valid shape");

      const t = normalizeTemplate({ sections: [{ title: "A", items: [{ label: "X" }] }] });
      console.assert(t.sections.length === 1, "normalizeTemplate keeps sections");
      console.assert(!!t.sections[0].id, "normalizeTemplate adds section id");
      console.assert(t.sections[0].items.length === 1, "normalizeTemplate keeps items");
      console.assert(!!t.sections[0].items[0].id, "normalizeTemplate adds item id");

      const d = buildDraftFromTemplate(t, { date: "2026-01-04", inspectionType: "move-in", propertyLabel: "", address: "", occupants: "", notes: "" });
      console.assert(d.sections.length === 1 && d.sections[0].items.length === 1, "buildDraftFromTemplate builds same shape");

      console.assert(clamp(5, 0, 10) === 5, "clamp should return within-range number");
      console.assert(clamp(-1, 0, 10) === 0, "clamp should clamp low");
      console.assert(clamp(99, 0, 10) === 10, "clamp should clamp high");

      console.assert(isValidISODate("2026-01-04") === true, "isValidISODate should accept yyyy-mm-dd");
      console.assert(isValidISODate("2026-1-4") === false, "isValidISODate should reject non-padded dates");

      const p = parseISODate("2026-01-04");
      console.assert(!!p && toISODate(p) === "2026-01-04", "parseISODate/toISODate roundtrip");

      const grid = buildMonthGrid(new Date(2026, 0, 1));
      console.assert(Array.isArray(grid) && grid.length === 6 && grid[0].length === 7, "buildMonthGrid should be 6x7");

      console.assert(mondayFirstIndex(0) === 6, "mondayFirstIndex should map Sun(0) to 6");

      console.groupEnd();
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <style>{GLOBAL_CSS}</style>
      {previewOpen ? <style>{PRINT_SCOPE_CSS}</style> : null}

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} onReset={resetAppData} />

      {/* Hidden import input */}
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importJSON(f);
        }}
      />

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-4xl sm:text-5xl font-black tracking-tight text-neutral-700">
              <span>Inspect</span>
              <span className="text-[#D5FF00]">It</span>
            </div>
            <div className="text-sm text-neutral-700">Organised inspection checklist for your new flat or home</div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-[#D5FF00]/0 via-[#D5FF00] to-[#D5FF00]/0" />

            {HUB_URL && HUB_URL !== "https://YOUR-WIX-HUB-URL-HERE" ? (
              <a
                className="mt-3 inline-block text-sm font-semibold text-neutral-800 underline"
                href={HUB_URL}
                target="_blank"
                rel="noreferrer"
              >
                Return to ToolStack hub
              </a>
            ) : null}
          </div>

          {/* Normalized top actions grid + pinned help */}
          <div className="w-full sm:w-[680px]">
            <div className="relative">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 pr-12">
                <ActionButton onClick={openPreview}>Preview</ActionButton>
                <ActionButton onClick={printFromPreview}>Print / Save PDF</ActionButton>
                <ActionButton onClick={exportJSON}>Export</ActionButton>
                <ActionButton onClick={onImportPick}>Import</ActionButton>
                <ActionButton onClick={() => setHelpOpen(true)}>Help</ActionButton>
              </div>

              <button
                type="button"
                title="Help"
                onClick={() => setHelpOpen(true)}
                className="print:hidden absolute right-0 top-0 h-10 w-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 shadow-sm flex items-center justify-center font-bold text-neutral-800"
                aria-label="Help"
              >
                ?
              </button>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-5 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Profile card */}
          <div className={card}>
            <div className={cardPad}>
              <div className="font-semibold text-neutral-800">Profile</div>
              <div className="mt-3 space-y-2">
                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Household / Name (optional)</div>
                  <input
                    className={inputBase}
                    value={profile.org}
                    onChange={(e) => setProfile({ ...profile, org: e.target.value })}
                    placeholder="e.g., Smith Household"
                  />
                </label>
                <label className="block text-sm">
                  <div className="text-neutral-600 font-medium">Prepared by</div>
                  <input
                    className={inputBase}
                    value={profile.user}
                    onChange={(e) => setProfile({ ...profile, user: e.target.value })}
                    placeholder="Your name"
                  />
                </label>
                <div className="pt-2 text-xs text-neutral-600">
                  Stored at <span className="font-mono">{PROFILE_KEY}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Draft card */}
          <div className={`${card} lg:col-span-3`}>
            <div className={cardPad}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-800">New inspection</div>
                  <div className="text-sm text-neutral-600">
                    Items: {totals.total} • Damaged: {totals.damaged} • Worn: {totals.worn} • Missing: {totals.missing}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="w-[220px]">
                    <DatePicker label="Date" value={date} onChange={setDate} />
                  </div>
                  <label className="text-sm w-[220px]">
                    <div className="text-neutral-600 font-medium">Type</div>
                    <select className={inputBase} value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                      <option value="move-in">Move-in</option>
                      <option value="move-out">Move-out</option>
                      <option value="periodic">Periodic</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-neutral-600 font-medium">Property label</div>
                  <input
                    className={inputBase}
                    value={propertyLabel}
                    onChange={(e) => setPropertyLabel(e.target.value)}
                    placeholder="e.g., Room 3 / Flat A"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-neutral-600 font-medium">Occupant(s)</div>
                  <input className={inputBase} value={occupants} onChange={(e) => setOccupants(e.target.value)} placeholder="Names" />
                </label>
                <label className="text-sm md:col-span-2">
                  <div className="text-neutral-600 font-medium">Address</div>
                  <input className={inputBase} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" />
                </label>
              </div>

              <label className="block text-sm mt-3">
                <div className="text-neutral-600 font-medium">General notes</div>
                <textarea
                  className={`${inputBase} min-h-[90px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Context: keys received, meter readings, agreements, etc."
                />
              </label>

              {/* Checklist builder */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-neutral-700">
                  <span className="font-semibold text-neutral-800">Checklist</span>
                  <span className="text-neutral-600"> • Add sections/items if your home has extras (basement, guest bathroom, etc.)</span>
                </div>
                <SmallButton tone="primary" onClick={addSection}>
                  + Add section
                </SmallButton>
              </div>

              {/* Sections */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                {(draft.sections || []).map((s) => (
                  <div key={s.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-neutral-800 truncate">{s.title}</div>
                        <div className="text-xs text-neutral-600">{(s.items || []).length} items</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <SmallButton onClick={() => addItemToSection(s.id)} className="px-2 py-1.5" tone="primary">
                          + Item
                        </SmallButton>
                        <IconButton title="Rename section" onClick={() => renameSection(s.id)}>
                          ✎
                        </IconButton>
                        <IconButton title="Delete section" tone="danger" onClick={() => deleteSection(s.id)}>
                          🗑
                        </IconButton>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {(s.items || []).length === 0 ? (
                        <div className="text-sm text-neutral-600">No items yet — click “+ Item”.</div>
                      ) : null}

                      {(s.items || []).map((it) => (
                        <div key={it.id} className="rounded-2xl bg-white border border-neutral-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-neutral-800 break-words">{it.label}</div>
                              <div className="mt-2 flex items-center gap-2 print:hidden">
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
                                  onClick={() => renameItem(s.id, it.id)}
                                  title="Rename item"
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="text-xs px-2 py-1 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                                  onClick={() => deleteItem(s.id, it.id)}
                                  title="Delete item"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>

                            {/* Condition controls (aligned) */}
                            <div className="flex items-center gap-2 shrink-0">
                              <span className={`inline-flex items-center h-9 text-xs px-2 rounded-full border ${badgeClass(it.condition)}`}>
                                {CONDITION_OPTIONS.find((o) => o.key === it.condition)?.label || "OK"}
                              </span>
                              <select
                                className="h-9 text-sm px-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25"
                                value={it.condition}
                                onChange={(e) => updateItem(s.id, it.id, { condition: e.target.value })}
                              >
                                {CONDITION_OPTIONS.map((o) => (
                                  <option key={o.key} value={o.key}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          {/* Wider note + wrap, evidence under */}
                          <div className="mt-3 space-y-2">
                            <textarea
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25 min-h-[104px] resize-y whitespace-pre-wrap"
                              placeholder="Note (what you see)"
                              value={it.note}
                              onChange={(e) => updateItem(s.id, it.id, { note: e.target.value })}
                            />
                            <input
                              className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25"
                              placeholder="Evidence ref (photo # / file / email)"
                              value={it.evidenceRef}
                              onChange={(e) => updateItem(s.id, it.id, { evidenceRef: e.target.value })}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <SmallButton onClick={resetDraft}>Reset</SmallButton>
                <SmallButton tone="primary" onClick={saveInspection}>
                  Save inspection
                </SmallButton>
              </div>
            </div>
          </div>
        </div>

        {/* Saved inspections */}
        <div className={`mt-4 ${card}`}>
          <div className={cardPad}>
            <div className="font-semibold text-neutral-800">Saved inspections</div>
            {(state.inspections || []).length === 0 ? (
              <div className="mt-2 text-sm text-neutral-600">No saved inspections yet.</div>
            ) : (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-600">
                    <tr className="border-b border-neutral-200">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2">Property</th>
                      <th className="py-2 pr-2">Damaged</th>
                      <th className="py-2 pr-2">Worn</th>
                      <th className="py-2 pr-2">Missing</th>
                      <th className="py-2 pr-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(state.inspections || []).map((x) => (
                      <tr key={x.id} className="border-b border-neutral-200 last:border-b-0">
                        <td className="py-2 pr-2 font-medium text-neutral-800">{x.date}</td>
                        <td className="py-2 pr-2">{x.inspectionType}</td>
                        <td className="py-2 pr-2">{x.propertyLabel || x.address || "-"}</td>
                        <td className="py-2 pr-2">
                          <span
                            className={
                              "text-xs px-2 py-1 rounded-full border " +
                              (x.summary?.damaged
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-emerald-100 text-emerald-800 border-emerald-200")
                            }
                          >
                            {x.summary?.damaged || 0}
                          </span>
                        </td>
                        <td className="py-2 pr-2">{x.summary?.worn || 0}</td>
                        <td className="py-2 pr-2">{x.summary?.missing || 0}</td>
                        <td className="py-2 pr-2 text-right">
                          <button
                            className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800"
                            onClick={() => deleteInspection(x.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Preview modal */}
        {previewOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />

            <div className="relative w-full max-w-5xl">
              <div className="mb-3 rounded-2xl bg-white border border-neutral-200 shadow-sm p-3 flex items-center justify-between gap-3">
                <div className="text-lg font-semibold text-neutral-800">Print preview</div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-800 transition"
                    onClick={() => window.print()}
                  >
                    Print / Save PDF
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-700 bg-neutral-700 text-white hover:bg-neutral-600 transition"
                    onClick={() => setPreviewOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-auto max-h-[80vh]">
                <div id="inspectit-print-preview" className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-bold tracking-tight text-neutral-800">
                        Inspect<span className="text-[#D5FF00]">It</span>
                      </div>
                      <div className="text-sm text-neutral-700">Inspection Report</div>
                      <div className="mt-3 h-[2px] w-72 rounded-full bg-gradient-to-r from-[#D5FF00]/0 via-[#D5FF00] to-[#D5FF00]/0" />
                    </div>
                    <div className="text-sm text-neutral-700">Generated: {new Date().toLocaleString()}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-neutral-600">Prepared by</div>
                      <div className="mt-1 font-semibold text-neutral-800">{profile.user || "-"}</div>
                      <div className="text-xs text-neutral-600 mt-1">{profile.org || "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-neutral-600">Inspection</div>
                      <div className="mt-1">
                        Date: <span className="font-semibold text-neutral-800">{date}</span>
                      </div>
                      <div className="mt-1">
                        Type: <span className="font-semibold text-neutral-800">{inspectionType}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-neutral-600">Property</div>
                      <div className="mt-1">
                        Label: <span className="font-semibold text-neutral-800">{propertyLabel || "-"}</span>
                      </div>
                      <div className="mt-1">
                        Occupants: <span className="font-semibold text-neutral-800">{occupants || "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm">
                    <div className="text-neutral-600">Address</div>
                    <div className="font-semibold text-neutral-800">{address || "-"}</div>
                  </div>

                  {notes ? (
                    <div className="mt-4 text-sm">
                      <div className="font-semibold text-neutral-800">General notes</div>
                      <div className="text-neutral-700 whitespace-pre-wrap">{notes}</div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                    <div className="font-semibold text-neutral-800">Summary</div>
                    <div className="mt-1 text-neutral-700">
                      Items: {totals.total} • Damaged: {totals.damaged} • Worn: {totals.worn} • Missing: {totals.missing}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(draft.sections || []).map((sec) => (
                      <div key={sec.id} className="rounded-2xl border border-neutral-200 p-4">
                        <div className="font-semibold text-neutral-800">{sec.title}</div>
                        <div className="mt-2 space-y-2">
                          {(sec.items || []).map((it) => (
                            <div
                              key={it.id}
                              className="text-sm flex items-start justify-between gap-3 border-t border-neutral-200 pt-2 first:border-t-0 first:pt-0"
                            >
                              <div>
                                <div className="font-medium text-neutral-800">{it.label}</div>
                                {it.note ? <div className="text-neutral-600 whitespace-pre-wrap">{it.note}</div> : null}
                                {it.evidenceRef ? <div className="text-neutral-600">Evidence: {it.evidenceRef}</div> : null}
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full border ${badgeClass(it.condition)}`}>
                                {CONDITION_OPTIONS.find((o) => o.key === it.condition)?.label || "OK"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <div className="text-neutral-600">Tenant</div>
                      <div className="mt-8 border-t border-neutral-200 pt-2">Signature</div>
                    </div>
                    <div>
                      <div className="text-neutral-600">Landlord / Agent</div>
                      <div className="mt-8 border-t border-neutral-200 pt-2">Signature</div>
                    </div>
                  </div>

                  <div className="mt-6 text-xs text-neutral-600">
                    Storage keys: <span className="font-mono">{KEY}</span> • <span className="font-mono">{PROFILE_KEY}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
