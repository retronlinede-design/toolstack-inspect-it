import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";

import headingImage from "./assets/inspectit-heading.png";

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
// Photo storage foundation (IndexedDB helpers)
// ---------------------------

const PHOTOS_DB_NAME = "toolstack.inspectit.photos";
const PHOTOS_STORE_NAME = "photos";

function openPhotosDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PHOTOS_DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE_NAME)) {
        db.createObjectStore(PHOTOS_STORE_NAME, { keyPath: "id" });
      }
    };
  });
}

async function savePhotoBlob(storageKey, blob, mimeType) {
  const db = await openPhotosDb();
  const transaction = db.transaction([PHOTOS_STORE_NAME], "readwrite");
  const store = transaction.objectStore(PHOTOS_STORE_NAME);
  const record = {
    id: storageKey,
    blob,
    mimeType,
    createdAt: new Date()
  };
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getPhotoBlob(storageKey) {
  const db = await openPhotosDb();
  const transaction = db.transaction([PHOTOS_STORE_NAME], "readonly");
  const store = transaction.objectStore(PHOTOS_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.get(storageKey);
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = () => reject(request.error);
  });
}

async function deletePhotoBlob(storageKey) {
  const db = await openPhotosDb();
  const transaction = db.transaction([PHOTOS_STORE_NAME], "readwrite");
  const store = transaction.objectStore(PHOTOS_STORE_NAME);
  return new Promise((resolve, reject) => {
    const request = store.delete(storageKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Sanitize filename for safe download
function sanitizeFilename(str) {
  return String(str)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-_\.]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------
// Image compression helper
// ---------------------------

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculate new dimensions (max width 1600px)
      const maxWidth = 1600;
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      
      // Draw and compress
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', 0.75);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
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
  "w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 bg-white focus:outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500 transition-colors font-medium";

const card = "rounded-xl bg-white border border-neutral-200 shadow-sm";
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
      ? "bg-neutral-600 text-white border-transparent hover:bg-neutral-500"
      : tone === "danger"
        ? "bg-white text-red-600 border-red-200 hover:bg-red-50"
        : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`print:hidden px-4 py-2 rounded-lg text-sm font-medium border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({ title, onClick, tone = "default", children }) {
  const cls =
    tone === "danger"
      ? "text-red-600 hover:bg-red-50 border-red-200"
      : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-800 border-neutral-200";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`print:hidden h-10 w-10 rounded-lg border transition-all flex items-center justify-center font-medium ${cls}`}
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

function EyeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function PencilIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function TrashIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function HomeIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function FileTextIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" x2="8" y1="13" y2="13"/>
      <line x1="16" x2="8" y1="17" y2="17"/>
      <line x1="10" x2="8" y1="9" y2="9"/>
    </svg>
  );
}

function ArchiveIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="5" x="2" y="3" rx="1"/>
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/>
      <path d="M10 12h4"/>
    </svg>
  );
}

function ChevronDownIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon({ className = "" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// ---------------------------
// Item normalization helper
// ---------------------------

function normalizeItem(it) {
  return { ...it, photos: it.photos || [] };
}

// ---------------------------
// Trip-It style date picker (custom mini calendar)
// ---------------------------

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

function t_fmt(str, ...args) {
  return str.replace(/{(\d+)}/g, (match, number) => typeof args[number] !== 'undefined' ? args[number] : match);
}

function DatePicker({ label = "Date", value, onChange, language = "en" }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const today = useMemo(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

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

  const display = value && isValidISODate(value) ? value : t("selectDate");

  const sameDay = (a, b) => {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  };

  const inViewMonth = (dt) => dt.getMonth() === viewDate.getMonth() && dt.getFullYear() === viewDate.getFullYear();

  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(language, { month: 'long' }));
  }, [language]);

  const dowNames = useMemo(() => {
    // Jan 4 2021 was a Monday
    return Array.from({ length: 7 }, (_, i) => new Date(2021, 0, 4 + i).toLocaleString(language, { weekday: 'short' }));
  }, [language]);

  return (
    <div className="text-sm">
      <div className="text-neutral-600 font-medium">{label}</div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-1 px-3 py-2 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 transition flex items-center justify-between gap-2 font-medium"
        title={t("chooseDate")}
      >
        <span className={value ? "font-medium" : "text-neutral-500"}>{display}</span>
        <CalendarIcon className="h-5 w-5 text-neutral-600" />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label={t("closeDatePicker")}
            onClick={() => setOpen(false)}
          />

          <div
            className="fixed z-50 rounded-xl bg-white border border-neutral-200 shadow-xl p-4"
            style={{ top: pos.top, left: pos.left, width: 340 }}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewDate((d) => startOfMonth(addMonths(d, -1)))}
                className="h-8 w-8 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 flex items-center justify-center transition-all"
                aria-label={t("previousMonth")}
                title={t("previousMonth")}
              >
                <span className="text-lg leading-none">‹</span>
              </button>

              <div className="text-sm font-semibold text-neutral-800">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </div>

              <button
                type="button"
                onClick={() => setViewDate((d) => startOfMonth(addMonths(d, 1)))}
                className="h-8 w-8 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 flex items-center justify-center transition-all"
                aria-label={t("nextMonth")}
                title={t("nextMonth")}
              >
                <span className="text-lg leading-none">›</span>
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-xs text-neutral-600">
              {dowNames.map((d) => (
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

                const base = "h-9 rounded-lg text-sm font-medium flex items-center justify-center border transition select-none";

                const cls = isSelected
                  ? "bg-neutral-600 text-white border-transparent"
                  : isToday
                    ? "bg-white text-neutral-800 border-neutral-300 font-bold"
                    : "bg-white text-neutral-700 border-transparent hover:bg-neutral-100";

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
                className="px-3 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700"
                onClick={() => {
                  onChange?.(toISODate(today));
                  setOpen(false);
                }}
              >
                {t("today")}
              </button>

              <button
                type="button"
                className="px-3 py-2 rounded-lg text-sm font-medium border border-transparent bg-neutral-600 text-white hover:bg-neutral-500"
                onClick={() => setOpen(false)}
              >
                {t("close")}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function AutoTextarea({ value, onChange, placeholder, className }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + 2 + "px";
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={2}
      className={`${className} font-medium`}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
    />
  );
}

// ---------------------------
// Help Pack v1 (ToolStack standard)
// ---------------------------

const TRANSLATIONS = {
  en: {
    profile: "Profile",
    household: "Household / Name",
    preparedBy: "Prepared by",
    newInspection: "New inspection",
    items: "Items",
    damaged: "Damaged",
    worn: "Worn",
    missing: "Missing",
    date: "Date",
    type: "Type",
    propertyLabel: "Property label",
    occupants: "Occupant(s)",
    address: "Address",
    generalNotes: "General notes",
    checklist: "Checklist",
    addSection: "Add section",
    savedInspections: "Saved inspections",
    noSavedInspections: "No saved inspections yet.",
    action: "Action",
    view: "View",
    edit: "Edit",
    delete: "Delete",
    printSavePdf: "Print / Save PDF",
    printPreview: "Print Preview",
    checkIt: "Check it before you ink it!",
    generated: "Generated",
    inspection: "Inspection",
    property: "Property",
    label: "Label",
    summary: "Summary",
    tenant: "Tenant",
    landlord: "Landlord / Agent",
    signature: "Signature",
    storageKeys: "Storage keys",
    helpInfo: "Help & Info",
    keepSafe: "Keep your data safe & sound!",
    localStorageMagic: "Local Storage Magic",
    localStorageDesc: "Inspect-It saves automatically in your browser. If you clear cookies or switch devices, your data won't follow you!",
    dontLoseStuff: "Don't Lose Your Stuff",
    export: "Export",
    import: "Import",
    printingPdf: "Printing / PDF",
    privacy: "Privacy",
    resetData: "Reset Data",
    gotIt: "Got it!",
    importExport: "Import / Export",
    saveLoadData: "Save or load your checklist data.",
    exportToFile: "Export to File",
    exportDesc: "Export all your data (profile, template, and saved inspections) into a single JSON file. Keep this file as a backup.",
    exportJson: "Export to JSON",
    importFromFile: "Import from File",
    importDesc: "Import data from a previously exported JSON file. This will overwrite your current data.",
    importJson: "Import from JSON",
    done: "Done",
    addSectionTitle: "Add Section",
    sectionTitle: "Section Title",
    addItemTitle: "Add Item",
    itemLabel: "Item Label",
    renameItemTitle: "Rename Item",
    renameSectionTitle: "Rename Section",
    deleteSectionTitle: "Delete Section",
    deleteItemTitle: "Delete Item",
    resetAppData: "Reset App Data",
    resetDesc: "Reset Inspect-It data? This clears local storage for this app.",
    reset: "Reset",
    cancel: "Cancel",
    confirm: "Confirm",
    save: "Save",
    saveInspection: "Save inspection",
    checklistHint: "• Add sections/items if your home has extras (basement, guest bathroom, etc.)",
    contextHint: "Context: keys received, meter readings, agreements, etc. (what you see)",
    selectDate: "Select date",
    moveIn: "Move-in",
    moveOut: "Move-out",
    periodic: "Periodic",
    condition_ok: "OK",
    condition_worn: "Worn",
    condition_damaged: "Damaged",
    condition_missing: "Missing",
    condition_na: "N/A",
    rename: "Rename",
    evidenceRef: "Evidence ref (photo # / file / email)",
    notePlaceholder: "Note (what you see)",
    printingPdfDesc: 'Hit Preview then Print. Choose "Save as PDF" to keep a digital copy.',
    privacyDesc: "No servers, no accounts. Your data lives right here in your browser.",
    continuityDesc1: "Use Export regularly to create a JSON backup.",
    continuityDesc2: "Save that file somewhere safe (Cloud, USB, Email).",
    continuityDesc3: "Use Import to restore on new devices.",
    today: "Today",
    close: "Close",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    chooseDate: "Choose a date",
    closeDatePicker: "Close date picker",
    aboutTitle: "About InspectIt",
    aboutText: "InspectIt is a local-first property inspection tool designed to help you record structured inspection notes, condition details, and generate clean print-ready reports. It runs entirely in your browser with no accounts, no cloud storage, and no automatic data sharing.",
    howWorksTitle: "How InspectIt Works",
    howWorksText: "InspectIt follows a structured workflow:",
    step1Title: "Create Inspection Profile",
    step1Text: "Enter property or inspection details.",
    step2Title: "Add Inspection Sections",
    step2Text: "Organise inspection categories (e.g., Rooms, Exterior, Utilities, Condition Areas).",
    step3Title: "Record Findings",
    step3Text: "Add notes, condition descriptions, and relevant details for each section.",
    step4Title: "Review Overview",
    step4Text: "Confirm entries and inspection completeness.",
    step5Title: "Preview & Print",
    step5Text: "Generate a clean, print-ready inspection report.",
    step6Title: "Export a Backup",
    step6Text: "Export a JSON backup regularly, especially after major updates.",
    dataPrivacyTitle: "Your Data & Privacy",
    dataPrivacyText: "Your data is saved locally in this browser using secure local storage. This means:",
    dataPrivacyList1: "Your data stays on this device",
    dataPrivacyList2: "Clearing browser data can remove inspection records",
    dataPrivacyList3: "Incognito/private mode will not retain data",
    dataPrivacyList4: "Data does not automatically sync across devices",
    backupRestoreTitle: "Backup & Restore",
    backupRestoreText1: "Export downloads a JSON backup of your current InspectIt data.",
    backupRestoreText2: "Import restores a previously exported JSON file and replaces current app data.",
    backupRestoreRoutine: "Recommended routine:",
    backupRestoreList1: "Export weekly",
    backupRestoreList2: "Export after major edits",
    backupRestoreList3: "Store backups in two locations (e.g., Downloads + Drive/USB)",
    buttonsExplainedTitle: "Buttons Explained",
    buttonPreview: "Preview – Opens the print-ready inspection report.",
    buttonPrint: "Print / Save PDF – Prints only the preview sheet. Choose “Save as PDF” to create a file.",
    buttonExport: "Export – Downloads a JSON backup file.",
    buttonImport: "Import – Restores data from a JSON backup file.",
    storageKeysTitle: "Storage Keys (Advanced)",
    appDataKey: "App data key:",
    sharedProfileKey: "Shared profile key:",
    notesLimitationsTitle: "Notes / Limitations",
    limitationsList1: "InspectIt is an inspection documentation tool. Reports depend on the accuracy of the information entered.",
    limitationsList2: "Use Export regularly to avoid data loss.",
    supportTitle: "Support / Feedback",
    supportText: "If something breaks, include: device + browser + steps to reproduce + expected vs actual behaviour.",
    exportPackTitle: "Export Pack",
    exportPackSubtitle: "Save, share, or back up your data.",
    pdfPrintTitle: "PDF & Print",
    createEmailDraft: "Create Email Draft",
    jsonBackupTitle: "JSON Backup",
    downloadJson: "Download JSON",
    importWarning: "Warning: Import replaces current app data. Export first if unsure.",
    emailSubject: "InspectIt Export Pack",
    emailBody: "Attached: PDF export from InspectIt (please attach the downloaded PDF file).\n\nExports are generated locally on your device. No data is uploaded automatically.",
    newSectionDefault: "New section",
    sectionDefault: "Section",
    newItemDefault: "New item",
    itemDefault: "Item",
    thisSection: "this section",
    thisItem: "this item",
    deleteSectionConfirm: "Delete “{0}”? This removes it from the checklist template too.",
    deleteItemConfirm: "Delete item “{0}”? This removes it from the checklist template too.",
    importFailed: "Import failed: ",
    resetAppDataTitle: "Reset App Data",
    resetAppDataMessage: "Reset Inspect-It data? This clears local storage for this app.",
    noItemsYet: "No items yet — click “+ Item”.",
    evidencePrefix: "Evidence: ",
    inspectionReport: "Inspection Report",
    unknownError: "Unknown error",
    placeholderSection: "e.g., Garage, Guest Room...",
    placeholderItem: "e.g., Ceiling light, Radiator...",
    inspectorName: "Inspector Name",
    organization: "Organization"
  },
  de: {
    profile: "Profil",
    household: "Haushalt / Name",
    preparedBy: "Erstellt von",
    newInspection: "Neue Inspektion",
    items: "Elemente",
    damaged: "Beschädigt",
    worn: "Abgenutzt",
    missing: "Fehlend",
    date: "Datum",
    type: "Typ",
    propertyLabel: "Objektbezeichnung",
    occupants: "Bewohner",
    address: "Adresse",
    generalNotes: "Allgemeine Notizen",
    checklist: "Checkliste",
    addSection: "Abschnitt hinzufügen",
    savedInspections: "Gespeicherte Inspektionen",
    noSavedInspections: "Noch keine gespeicherten Inspektionen.",
    action: "Aktion",
    view: "Ansehen",
    edit: "Bearbeiten",
    delete: "Löschen",
    printSavePdf: "Drucken / PDF speichern",
    printPreview: "Druckvorschau",
    checkIt: "Überprüfen Sie es, bevor Sie es drucken!",
    generated: "Erstellt",
    inspection: "Inspektion",
    property: "Immobilie",
    label: "Bezeichnung",
    summary: "Zusammenfassung",
    tenant: "Mieter",
    landlord: "Vermieter / Makler",
    signature: "Unterschrift",
    storageKeys: "Speicherschlüssel",
    helpInfo: "Hilfe & Info",
    keepSafe: "Halten Sie Ihre Daten sicher!",
    localStorageMagic: "Lokaler Speicher",
    localStorageDesc: "Inspect-It speichert automatisch in Ihrem Browser. Wenn Sie Cookies löschen oder das Gerät wechseln, folgen Ihre Daten nicht!",
    dontLoseStuff: "Verlieren Sie Ihre Daten nicht",
    export: "Exportieren",
    import: "Importieren",
    printingPdf: "Drucken / PDF",
    privacy: "Datenschutz",
    resetData: "Daten zurücksetzen",
    gotIt: "Verstanden!",
    importExport: "Import / Export",
    saveLoadData: "Speichern oder laden Sie Ihre Checklistendaten.",
    exportToFile: "In Datei exportieren",
    exportDesc: "Exportieren Sie alle Ihre Daten (Profil, Vorlage und gespeicherte Inspektionen) in eine einzige JSON-Datei. Bewahren Sie diese Datei als Backup auf.",
    exportJson: "Als JSON exportieren",
    importFromFile: "Aus Datei importieren",
    importDesc: "Importieren Sie Daten aus einer zuvor exportierten JSON-Datei. Dies überschreibt Ihre aktuellen Daten.",
    importJson: "Aus JSON importieren",
    done: "Fertig",
    addSectionTitle: "Abschnitt hinzufügen",
    sectionTitle: "Abschnittstitel",
    addItemTitle: "Element hinzufügen",
    itemLabel: "Elementbezeichnung",
    renameItemTitle: "Element umbenennen",
    renameSectionTitle: "Abschnitt umbenennen",
    deleteSectionTitle: "Abschnitt löschen",
    deleteItemTitle: "Element löschen",
    resetAppData: "App-Daten zurücksetzen",
    resetDesc: "Inspect-It-Daten zurücksetzen? Dies löscht den lokalen Speicher für diese App.",
    reset: "Zurücksetzen",
    cancel: "Abbrechen",
    confirm: "Bestätigen",
    save: "Speichern",
    saveInspection: "Inspektion speichern",
    checklistHint: "• Fügen Sie Abschnitte/Elemente hinzu, wenn Ihr Zuhause Extras hat (Keller, Gästebad usw.)",
    contextHint: "Kontext: Schlüsselübergabe, Zählerstände, Vereinbarungen usw. (was Sie sehen)",
    selectDate: "Datum wählen",
    moveIn: "Einzug",
    moveOut: "Auszug",
    periodic: "Periodisch",
    condition_ok: "OK",
    condition_worn: "Abgenutzt",
    condition_damaged: "Beschädigt",
    condition_missing: "Fehlend",
    condition_na: "N/A",
    rename: "Umbenennen",
    evidenceRef: "Beweisreferenz (Foto Nr. / Datei / E-Mail)",
    notePlaceholder: "Notiz (was Sie sehen)",
    printingPdfDesc: 'Klicken Sie auf Vorschau und dann auf Drucken. Wählen Sie "Als PDF speichern", um eine digitale Kopie zu behalten.',
    privacyDesc: "Keine Server, keine Konten. Ihre Daten bleiben direkt hier in Ihrem Browser.",
    continuityDesc1: "Nutzen Sie regelmäßig Export, um ein JSON-Backup zu erstellen.",
    continuityDesc2: "Speichern Sie die Datei sicher (Cloud, USB, E-Mail).",
    continuityDesc3: "Nutzen Sie Import, um Daten auf neuen Geräten wiederherzustellen.",
    today: "Heute",
    close: "Schließen",
    previousMonth: "Vorheriger Monat",
    nextMonth: "Nächster Monat",
    chooseDate: "Datum wählen",
    closeDatePicker: "Datumsauswahl schließen",
    aboutTitle: "Über InspectIt",
    aboutText: "InspectIt ist ein 'Local-First' Inspektionstool, das Ihnen hilft, strukturierte Notizen und Zustandsdetails zu erfassen und saubere Berichte zu erstellen. Es läuft vollständig in Ihrem Browser – ohne Accounts, ohne Cloud und ohne automatische Datenspeicherung.",
    howWorksTitle: "Wie InspectIt funktioniert",
    howWorksText: "InspectIt folgt einem strukturierten Ablauf:",
    step1Title: "Inspektionsprofil erstellen",
    step1Text: "Geben Sie Immobilien- oder Inspektionsdetails ein.",
    step2Title: "Inspektionsabschnitte hinzufügen",
    step2Text: "Organisieren Sie Kategorien (z. B. Räume, Außenbereich, Versorgung).",
    step3Title: "Ergebnisse erfassen",
    step3Text: "Fügen Sie Notizen, Zustandsbeschreibungen und Details hinzu.",
    step4Title: "Übersicht prüfen",
    step4Text: "Bestätigen Sie Einträge und Vollständigkeit.",
    step5Title: "Vorschau & Drucken",
    step5Text: "Erstellen Sie einen sauberen, druckfertigen Bericht.",
    step6Title: "Backup exportieren",
    step6Text: "Exportieren Sie regelmäßig ein JSON-Backup.",
    dataPrivacyTitle: "Ihre Daten & Datenschutz",
    dataPrivacyText: "Ihre Daten werden lokal in diesem Browser gespeichert. Das bedeutet:",
    dataPrivacyList1: "Ihre Daten bleiben auf diesem Gerät",
    dataPrivacyList2: "Das Löschen von Browserdaten kann Datensätze entfernen",
    dataPrivacyList3: "Inkognito/Privatmodus speichert keine Daten",
    dataPrivacyList4: "Daten werden nicht automatisch synchronisiert",
    backupRestoreTitle: "Backup & Wiederherstellung",
    backupRestoreText1: "Export lädt ein JSON-Backup Ihrer aktuellen Daten herunter.",
    backupRestoreText2: "Import stellt eine zuvor exportierte Datei wieder her und ersetzt aktuelle Daten.",
    backupRestoreRoutine: "Empfohlene Routine:",
    backupRestoreList1: "Wöchentlich exportieren",
    backupRestoreList2: "Nach größeren Änderungen exportieren",
    backupRestoreList3: "Backups an zwei Orten speichern (Cloud, USB, E-Mail)",
    buttonsExplainedTitle: "Tasten erklärt",
    buttonPreview: "Vorschau – Öffnet den druckfertigen Bericht.",
    buttonPrint: "Drucken / PDF – Druckt nur die Vorschau. Wählen Sie 'Als PDF speichern'.",
    buttonExport: "Export – Lädt ein JSON-Backup herunter.",
    buttonImport: "Import – Stellt Daten aus einem Backup wieder her.",
    storageKeysTitle: "Speicherschlüssel (Erweitert)",
    appDataKey: "App-Daten-Schlüssel:",
    sharedProfileKey: "Geteilter Profil-Schlüssel:",
    notesLimitationsTitle: "Hinweise / Einschränkungen",
    limitationsList1: "InspectIt ist ein Dokumentationstool. Berichte hängen von der Genauigkeit der Eingaben ab.",
    limitationsList2: "Nutzen Sie Export regelmäßig, um Datenverlust zu vermeiden.",
    supportTitle: "Support / Feedback",
    supportText: "Wenn etwas nicht funktioniert, geben Sie bitte Gerät + Browser + Schritte zur Reproduktion an.",
    exportPackTitle: "Export-Paket",
    exportPackSubtitle: "Speichern, teilen oder sichern Sie Ihre Daten.",
    pdfPrintTitle: "PDF & Drucken",
    createEmailDraft: "E-Mail-Entwurf erstellen",
    jsonBackupTitle: "JSON-Backup",
    downloadJson: "JSON herunterladen",
    importWarning: "Warnung: Import ersetzt aktuelle App-Daten. Exportieren Sie zuerst, wenn Sie unsicher sind.",
    emailSubject: "InspectIt Export-Paket",
    emailBody: "Anbei: PDF-Export von InspectIt (bitte die heruntergeladene PDF-Datei anhängen).\n\nExporte werden lokal auf Ihrem Gerät erstellt. Es werden keine Daten automatisch hochgeladen.",
    newSectionDefault: "Neuer Abschnitt",
    sectionDefault: "Abschnitt",
    newItemDefault: "Neues Element",
    itemDefault: "Element",
    thisSection: "diesen Abschnitt",
    thisItem: "dieses Element",
    deleteSectionConfirm: "“{0}” löschen? Dies entfernt es auch aus der Vorlage.",
    deleteItemConfirm: "Element “{0}” löschen? Dies entfernt es auch aus der Vorlage.",
    importFailed: "Import fehlgeschlagen: ",
    resetAppDataTitle: "App-Daten zurücksetzen",
    resetAppDataMessage: "Inspect-It-Daten zurücksetzen? Dies löscht den lokalen Speicher für diese App.",
    noItemsYet: "Noch keine Elemente — klicke “+ Element”." ,
    evidencePrefix: "Beweis: ",
    inspectionReport: "Inspektionsbericht",
    unknownError: "Unbekannter Fehler",
    placeholderSection: "z.B. Garage, Gästezimmer...",
    placeholderItem: "z.B. Deckenleuchte, Heizkörper...",
    inspectorName: "Name des Prüfers",
    organization: "Organisation"
  }
};

function HelpModal({ open, onClose, onReset, language = "en" }) {
  if (!open) return null;
  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-neutral-800/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-neutral-50 p-6 border-b border-neutral-200 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-neutral-800 tracking-tight">
              {t("helpInfo")}
            </h2>
            <p className="text-neutral-600 mt-1 text-sm">
              {t("keepSafe")}
            </p>
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center text-neutral-500 hover:text-neutral-800 transition-all"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 bg-white">
          {/* 1) About InspectIt */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("aboutTitle")}</h3>
            <p className="text-sm text-neutral-700 leading-relaxed">{t("aboutText")}</p>
          </div>

          {/* 2) How InspectIt Works */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("howWorksTitle")}</h3>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">{t("howWorksText")}</p>
            <ol className="text-sm text-neutral-700 space-y-2 list-decimal list-inside">
              <li>
                <strong>{t("step1Title")}</strong>
                <br />
                {t("step1Text")}
              </li>
              <li>
                <strong>{t("step2Title")}</strong>
                <br />
                {t("step2Text")}
              </li>
              <li>
                <strong>{t("step3Title")}</strong>
                <br />
                {t("step3Text")}
              </li>
              <li>
                <strong>{t("step4Title")}</strong>
                <br />
                {t("step4Text")}
              </li>
              <li>
                <strong>{t("step5Title")}</strong>
                <br />
                {t("step5Text")}
              </li>
              <li>
                <strong>{t("step6Title")}</strong>
                <br />
                {t("step6Text")}
              </li>
            </ol>
          </div>

          {/* 3) Your Data & Privacy */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("dataPrivacyTitle")}</h3>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">{t("dataPrivacyText")}</p>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>{t("dataPrivacyList1")}</li>
              <li>{t("dataPrivacyList2")}</li>
              <li>{t("dataPrivacyList3")}</li>
              <li>{t("dataPrivacyList4")}</li>
            </ul>
          </div>

          {/* 4) Backup & Restore */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("backupRestoreTitle")}</h3>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">{t("backupRestoreText1")}</p>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">{t("backupRestoreText2")}</p>
            <p className="text-sm text-neutral-700 leading-relaxed">{t("backupRestoreRoutine")}</p>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>{t("backupRestoreList1")}</li>
              <li>{t("backupRestoreList2")}</li>
              <li>{t("backupRestoreList3")}</li>
            </ul>
          </div>

          {/* 5) Buttons Explained */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("buttonsExplainedTitle")}</h3>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>{t("buttonPreview")}</li>
              <li>{t("buttonPrint")}</li>
              <li>{t("buttonExport")}</li>
              <li>{t("buttonImport")}</li>
            </ul>
          </div>

          {/* 6) Storage Keys (Advanced) */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("storageKeysTitle")}</h3>
            <p className="text-sm text-neutral-700 leading-relaxed">{t("appDataKey")} <code className="font-mono text-xs bg-white border border-neutral-300 rounded px-2 py-1">{KEY}</code></p>
            <p className="text-sm text-neutral-700 leading-relaxed mt-1">{t("sharedProfileKey")} <code className="font-mono text-xs bg-white border border-neutral-300 rounded px-2 py-1">{PROFILE_KEY}</code></p>
          </div>

          {/* 7) Notes / Limitations */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("notesLimitationsTitle")}</h3>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>{t("limitationsList1")}</li>
              <li>{t("limitationsList2")}</li>
              <li>Photos are stored locally in this browser and are not included in JSON backups. However, you can download an Inspection Pack (ZIP) for each inspection, which includes the inspection data and all its photos.</li>
            </ul>
          </div>

          {/* 8) Support / Feedback */}
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("supportTitle")}</h3>
            <p className="text-sm text-neutral-700 leading-relaxed">{t("supportText")}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between gap-4">
          <button
            type="button"
            className="px-4 py-2 rounded-lg text-sm font-medium border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            onClick={onReset}
          >
            {t("resetData")}
          </button>
          <button
            type="button"
            className="px-6 py-2 rounded-lg text-sm font-medium bg-neutral-600 text-white hover:bg-neutral-500 transition-all"
            onClick={onClose}
          >
            {t("gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = "Confirm", isDanger = false, language = "en" }) {
  if (!open) return null;
  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden">
      <div className="absolute inset-0 bg-neutral-800/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <h3 className="font-bold text-lg text-neutral-800 tracking-tight">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-neutral-200 bg-white flex items-center justify-center hover:bg-neutral-50 text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <div className="p-5">
          <div className="text-sm text-neutral-700">{message}</div>

          <div className="mt-6 flex justify-end gap-3">
            <SmallButton onClick={onClose}>{t("cancel")}</SmallButton>
            <SmallButton tone={isDanger ? "danger" : "primary"} onClick={onConfirm}>
              {confirmLabel}
            </SmallButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputModal({ open, onClose, onSubmit, title, inputLabel, placeholder, initialValue = "", submitLabel = "Save", language = "en" }) {
  const [value, setValue] = useState(initialValue);
  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  useEffect(() => {
    if (open) setValue(initialValue);
  }, [open, initialValue]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden">
      <div className="absolute inset-0 bg-neutral-800/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden transform transition-all">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
          <h3 className="font-bold text-lg text-neutral-800 tracking-tight">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border border-neutral-200 bg-white flex items-center justify-center hover:bg-neutral-50 text-neutral-500 hover:text-neutral-800 transition-colors"
          >
            ✕
          </button>
        </div>
        
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim()) onSubmit(value.trim());
          }}
          className="p-5"
        >
          <label className="block">
            <div className="text-sm font-bold text-neutral-800 mb-1">{inputLabel}</div>
            <input
              autoFocus
              type="text"
              className={inputBase}
              placeholder={placeholder}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <SmallButton onClick={onClose}>{t("cancel")}</SmallButton>
            <SmallButton tone="primary" type="submit" disabled={!value.trim()}>
              {submitLabel}
            </SmallButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportExportModal({ open, onClose, onImport, onExport, onPrint, language = "en" }) {
  if (!open) return null;
  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  const emailSubject = encodeURIComponent(`${t("emailSubject")} – ${new Date().toISOString().slice(0, 10)}`);
  const emailBody = encodeURIComponent(t("emailBody"));
  const mailtoLink = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-neutral-800/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-neutral-50 p-6 border-b border-neutral-200 flex items-start justify-between gap-4">
          <div>
            <img
              src={headingImage}
              alt="Inspect-It"
              className="h-24 w-auto"
            />
          </div>
          <button
            type="button"
            className="h-8 w-8 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-800 flex items-center justify-center transition-all"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-neutral-700 overflow-auto min-h-0 bg-white">
          
          {/* PDF & Print Section */}
          <div className="group relative bg-neutral-50 border border-neutral-200 rounded-xl p-5 hover:bg-indigo-50 transition-colors">
             <div className="absolute -top-3 -left-3 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              PDF
            </div>
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("pdfPrintTitle")}</h3>
            <div className="flex flex-col gap-2 mt-4">
                <button type="button" className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors" onClick={onPrint}>
                    {t("printSavePdf")}
                </button>
                <a href={mailtoLink} className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 transition-colors block">
                    {t("createEmailDraft")}
                </a>
            </div>
          </div>

          {/* JSON Backup Section */}
          <div className="group relative bg-neutral-50 border border-neutral-200 rounded-xl p-5 hover:bg-emerald-50 transition-colors">
            <div className="absolute -top-3 -right-3 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full">
              JSON
            </div>
            <h3 className="font-bold text-lg text-neutral-800 mb-2">{t("jsonBackupTitle")}</h3>
            <div className="flex flex-col gap-2 mt-4">
              <button type="button" className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium bg-neutral-600 text-white hover:bg-neutral-500 transition-all" onClick={onExport}>
                {t("downloadJson")}
              </button>
              <div className="pt-2 border-t border-neutral-200 mt-2">
                  <button type="button" className="w-full text-left px-4 py-2 rounded-lg text-sm font-medium border border-neutral-200 text-neutral-700 bg-white hover:bg-emerald-50 hover:border-emerald-200 transition-colors" onClick={onImport}>
                    {t("importJson")}
                  </button>
                  <p className="text-xs text-neutral-500 mt-2 px-1">
                    {t("importWarning")}
                  </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-2">
          <button type="button" className="px-6 py-2 rounded-lg text-sm font-medium bg-neutral-600 text-white hover:bg-neutral-500 transition-all" onClick={onClose}>
            {t("done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoViewerModal({ open, url, caption, onClose }) {
  if (!open || !url) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm transition-opacity"
      onClick={onClose}
    >
      <div 
        className="relative max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl p-4 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <img src={url} alt={caption || "Inspection photo"} className="block max-w-full max-h-[calc(90vh-100px)] object-contain rounded" />
        {caption && <p className="text-center text-neutral-700 font-medium">{caption}</p>}
        <button
          type="button"
          className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-white shadow-lg hover:bg-neutral-100 flex items-center justify-center text-neutral-600 hover:text-neutral-900 transition-colors"
          onClick={onClose}
          aria-label="Close photo viewer"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------------------------
// data model
// ---------------------------

const TEMPLATES = {
  en: [
    { title: "Entrance / Hall", items: ["Door & lock", "Walls/paint", "Flooring", "Lights/switches"] },
    { title: "Living / Bedroom", items: ["Walls/paint", "Flooring", "Windows/frames", "Heating/radiator", "Curtains/blinds"] },
    { title: "Kitchen", items: ["Cabinets/countertop", "Sink & taps", "Appliances (if included)", "Tiles/splashback", "Ventilation"] },
    { title: "Bathroom", items: ["Bath/shower", "Tiles/grout", "Toilet", "Sink & taps", "Ventilation"] },
    { title: "Utilities / Electrical", items: ["Sockets", "Light fixtures", "Water shutoff", "Smoke detector"] },
    { title: "Windows / Exterior", items: ["Windows open/close", "Seals", "Balcony/terrace (if any)", "Mailbox/keys"] },
  ],
  de: [
    { title: "Eingang / Flur", items: ["Tür & Schloss", "Wände/Anstrich", "Bodenbelag", "Licht/Schalter"] },
    { title: "Wohnen / Schlafzimmer", items: ["Wände/Anstrich", "Bodenbelag", "Fenster/Rahmen", "Heizung/Heizkörper", "Vorhänge/Jalousien"] },
    { title: "Küche", items: ["Schränke/Arbeitsplatte", "Spüle & Armaturen", "Geräte (falls vorhanden)", "Fliesen/Spritzschutz", "Lüftung"] },
    { title: "Badezimmer", items: ["Bad/Dusche", "Fliesen/Fugen", "Toilette", "Waschbecken & Armaturen", "Lüftung"] },
    { title: "Versorgung / Elektrik", items: ["Steckdosen", "Beleuchtung", "Wasserabsperrung", "Rauchmelder"] },
    { title: "Fenster / Außenbereich", items: ["Fenster öffnen/schließen", "Dichtungen", "Balkon/Terrasse (falls vorh.)", "Briefkasten/Schlüssel"] },
  ]
};

function translateContent(data, targetLang) {
  const sourceLang = targetLang === "en" ? "de" : "en";
  const sourceTpl = TEMPLATES[sourceLang];
  const targetTpl = TEMPLATES[targetLang];

  if (!sourceTpl || !targetTpl) return data.sections;

  return (data.sections || []).map((s) => {
    let nextTitle = s.title;
    let targetSec = null;
    let sourceSecItems = [];

    // Find section by title in source language
    const sourceSecIndex = sourceTpl.findIndex((x) => x.title === s.title);
    if (sourceSecIndex !== -1) {
      targetSec = targetTpl[sourceSecIndex];
      if (targetSec) {
        nextTitle = targetSec.title;
        sourceSecItems = sourceTpl[sourceSecIndex].items;
      }
    }

    const nextItems = (s.items || []).map((it) => {
      let nextLabel = it.label;
      if (targetSec && sourceSecItems.length > 0) {
        const itemIndex = sourceSecItems.indexOf(it.label);
        if (itemIndex !== -1 && targetSec.items[itemIndex]) {
          nextLabel = targetSec.items[itemIndex];
        }
      }
      return { ...it, label: nextLabel };
    });

    return { ...s, title: nextTitle, items: nextItems };
  });
}

function defaultTemplate(lang = "en") {
  const mkItem = (label) => ({ id: uid("i"), label, condition: "ok" });
  const mkSection = (title, items) => ({
    id: uid("s"),
    title,
    items: items.map(mkItem),
  });

  const sections = TEMPLATES[lang] || TEMPLATES.en;

  return {
    name: "Default Inspection",
    sections: sections.map(s => mkSection(s.title, s.items)),
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
        photos: [],
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
      return "bg-red-500 text-white border-transparent";
    case "worn":
      return "bg-amber-100 text-amber-800 border-transparent";
    case "n/a":
      return "bg-neutral-100 text-neutral-500 border-transparent";
    default:
      return "bg-emerald-100 text-emerald-800 border-transparent";
  }
}

// ---------------------------
// App
// ---------------------------

export default function App() {
  const [profile, setProfile] = useState(loadProfile);
  const [state, setState] = useState(loadState);
  const [language, setLanguage] = useState("en");

  const [date, setDate] = useState(isoToday());
  const [inspectionType, setInspectionType] = useState("move-in"); // move-in | move-out | periodic
  const [propertyLabel, setPropertyLabel] = useState("");
  const [address, setAddress] = useState("");
  const [occupants, setOccupants] = useState("");
  const [notes, setNotes] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [addItemState, setAddItemState] = useState({ open: false, sectionId: null });
  const [renameItemState, setRenameItemState] = useState({ open: false, sectionId: null, itemId: null, initialValue: "" });
  const [editingSectionId, setEditingSectionId] = useState(null);
  const [deleteSectionState, setDeleteSectionState] = useState({ open: false, sectionId: null });
  const [deleteItemState, setDeleteItemState] = useState({ open: false, sectionId: null, itemId: null });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);
  const [photoViewerState, setPhotoViewerState] = useState({ open: false, url: null, caption: "" });
  const [collapsedSections, setCollapsedSections] = useState(new Set());

  const fileRef = useRef(null);

  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  // Auto-translate content when language toggles
  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      sections: translateContent(prev, language),
    }));

    setState((prev) => {
      const nextTemplate = {
        ...prev.template,
        sections: translateContent(prev.template, language),
      };
      return saveState({ ...prev, template: nextTemplate });
    });
  }, [language]);

  // draft
  const [draft, setDraft] = useState(() => {
    const t = loadState().template;
    return buildDraftFromTemplate(t, { date, inspectionType, propertyLabel: "", address: "", occupants: "", notes: "" });
  });

  // total photos helper
  const totalPhotos = useMemo(() =>
    draft.sections.flatMap(s => s.items).reduce((sum, it) => sum + (it.photos?.length || 0), 0),
    [draft]
  );

  // photo URLs for thumbnails
  const [photoURLs, setPhotoURLs] = useState({});
  useEffect(() => {
    const load = async () => {
      const newURLs = {};
      for (const s of draft.sections) {
        for (const it of s.items) {
          for (const p of it.photos) {
            if (!photoURLs[p.id]) {
              const blob = await getPhotoBlob(p.storageKey);
              if (blob) newURLs[p.id] = URL.createObjectURL(blob);
            } else {
              newURLs[p.id] = photoURLs[p.id];
            }
          }
        }
      }
      // revoke old ones not in new
      Object.keys(photoURLs).forEach(id => {
        if (!newURLs[id]) URL.revokeObjectURL(photoURLs[id]);
      });
      setPhotoURLs(newURLs);
    };
    load();
  }, [draft]);

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

  function onAddSectionSubmit(title) {
    const sectionId = uid("s");
    const nextTitle = String(title).trim() || t("newSectionDefault");

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = [...(nextTemplate.sections || []), { id: sectionId, title: nextTitle, items: [] }];
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: [...(d.sections || []), { id: sectionId, title: nextTitle, items: [] }],
    }));
    setAddSectionOpen(false);
  }

  function toggleSection(sectionId) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }

  function finishEditingSection(sectionId, newTitle) {
    const nextTitle = String(newTitle).trim();
    if (!nextTitle) {
      setEditingSectionId(null);
      return;
    }

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).map((s) => (s.id !== sectionId ? s : { ...s, title: nextTitle }));
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) => (s.id !== sectionId ? s : { ...s, title: nextTitle })),
    }));
    setEditingSectionId(null);
  }

  function openDeleteSection(sectionId) {
    setDeleteSectionState({ open: true, sectionId });
  }

  function onDeleteSectionConfirm() {
    const { sectionId } = deleteSectionState;
    if (!sectionId) return;
    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).filter((s) => s.id !== sectionId);
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).filter((s) => s.id !== sectionId),
    }));
    setDeleteSectionState({ open: false, sectionId: null });
  }

  function openAddItem(sectionId) {
    setAddItemState({ open: true, sectionId });
  }

  function onAddItemSubmit(label) {
    const { sectionId } = addItemState;
    if (!sectionId) return;
    const itemId = uid("i");
    const nextLabel = String(label).trim() || t("newItemDefault");

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
              items: [...(s.items || []), { id: itemId, label: nextLabel, condition: "ok", note: "", evidenceRef: "", photos: [] }],
            }
      ),
    }));
  }

  function openRenameItem(sectionId, itemId) {
    const current = (draft.sections || []).find((s) => s.id === sectionId)?.items?.find((it) => it.id === itemId)?.label || "";
    setRenameItemState({ open: true, sectionId, itemId, initialValue: current });
  }

  function onRenameItemSubmit(label) {
    const { sectionId, itemId, initialValue } = renameItemState;
    if (!sectionId || !itemId) return;
    const nextLabel = String(label).trim() || initialValue || t("itemDefault");

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
    setRenameItemState({ open: false, sectionId: null, itemId: null, initialValue: "" });
  }

  function openDeleteItem(sectionId, itemId) {
    setDeleteItemState({ open: true, sectionId, itemId });
  }

  function onDeleteItemConfirm() {
    const { sectionId, itemId } = deleteItemState;
    if (!sectionId || !itemId) return;
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
    setDeleteItemState({ open: false, sectionId: null, itemId: null });
  }

  function loadInspection(id, shouldScroll = true) {
    const ins = state.inspections.find((x) => x.id === id);
    if (!ins) return;

    setDate(ins.date);
    setInspectionType(ins.inspectionType);
    setPropertyLabel(ins.propertyLabel);
    setAddress(ins.address);
    setOccupants(ins.occupants);
    setNotes(ins.notes);
    
    setDraft({
      date: ins.date,
      inspectionType: ins.inspectionType,
      propertyLabel: ins.propertyLabel,
      address: ins.address,
      occupants: ins.occupants,
      notes: ins.notes,
      sections: JSON.parse(JSON.stringify(ins.sections)).map(s => ({
        ...s,
        items: s.items.map(normalizeItem)
      })),
    });
    
    if (shouldScroll) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function onViewInspection(id) {
    loadInspection(id, false);
    setPreviewOpen(true);
  }

  // photo handlers
  function addPhotoMetaToItem(itemId, photoMeta) {
    const item = draft.sections.flatMap(s => s.items).find(it => it.id === itemId);
    if (!item || item.photos.length >= 3 || totalPhotos >= 20) return false;
    setDraft(d => ({
      ...d,
      sections: d.sections.map(s => ({
        ...s,
        items: s.items.map(it =>
          it.id === itemId ? { ...it, photos: [...it.photos, photoMeta] } : it
        )
      }))
    }));
    return true;
  }

  function updatePhotoCaption(itemId, photoId, caption) {
    setDraft(d => ({
      ...d,
      sections: d.sections.map(s => ({
        ...s,
        items: s.items.map(it =>
          it.id === itemId ? { ...it, photos: it.photos.map(p => p.id === photoId ? { ...p, caption } : p) } : it
        )
      }))
    }));
  }

  function removePhotoMetaFromItem(itemId, photoId) {
    if (photoURLs[photoId]) {
      URL.revokeObjectURL(photoURLs[photoId]);
      setPhotoURLs(prev => {
        const next = { ...prev };
        delete next[photoId];
        return next;
      });
    }
    setDraft(d => ({
      ...d,
      sections: d.sections.map(s => ({
        ...s,
        items: s.items.map(it =>
          it.id === itemId ? { ...it, photos: it.photos.filter(p => p.id !== photoId) } : it
        )
      }))
    }));
  }

  async function handlePhotoUpload(sectionId, itemId, file) {
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      const photoId = uid("p");
      const storageKey = `photo-${photoId}`;
      await savePhotoBlob(storageKey, compressed, file.type);
      const photoMeta = {
        id: photoId,
        storageKey,
        name: file.name,
        caption: "",
        createdAt: new Date()
      };
      addPhotoMetaToItem(itemId, photoMeta);
    } catch (err) {
      console.error("Photo upload failed:", err);
    }
  }

  async function downloadPhoto(itemLabel, photoMeta, photoIndex) {
    try {
      const blob = await getPhotoBlob(photoMeta.storageKey);
      if (!blob) {
        console.warn("Photo blob not found:", photoMeta.storageKey);
        return;
      }
      const url = URL.createObjectURL(blob);
      const sanitizedItem = sanitizeFilename(itemLabel);
      const ext = blob.type === "image/jpeg" ? "jpg" : "png";
      const filename = `inspectit-${sanitizedItem}-${photoIndex + 1}.${ext}`;
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Photo download failed:", err);
    }
  }

  async function downloadAllPhotos() {
    const allPhotos = [];
    for (const sec of draft.sections) {
      for (const it of sec.items) {
        for (let idx = 0; idx < it.photos.length; idx++) {
          allPhotos.push({ item: it, photo: it.photos[idx], itemIndex: allPhotos.filter(p => p.item.id === it.id).length });
        }
      }
    }
    if (allPhotos.length === 0) {
      console.warn("No photos to download");
      return;
    }
    let downloadCount = 0;
    for (const { item, photo, itemIndex } of allPhotos) {
      try {
        const blob = await getPhotoBlob(photo.storageKey);
        if (!blob) {
          console.warn("Photo blob not found:", photo.storageKey);
          continue;
        }
        const url = URL.createObjectURL(blob);
        const sanitizedItem = sanitizeFilename(item.label);
        const ext = blob.type === "image/jpeg" ? "jpg" : "png";
        const filename = `inspectit-${sanitizeFilename(propertyLabel||"inspection")}-${sanitizedItem}-${itemIndex + 1}.${ext}`;
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        downloadCount++;
      } catch (err) {
        console.error("Photo download failed:", err);
      }
    }
  }

  async function downloadInspectionPack(inspection) {
    try {
      const zip = new JSZip();
      const photoMap = {};
      let totalPhotos = 0;

      // Create inspection.json content
      const inspectionExport = {
        id: inspection.id,
        createdAt: inspection.createdAt,
        date: inspection.date,
        inspectionType: inspection.inspectionType,
        propertyLabel: inspection.propertyLabel,
        address: inspection.address,
        occupants: inspection.occupants,
        notes: inspection.notes,
        items: []
      };

      // Process sections and items
      for (const sec of inspection.sections) {
        for (const item of sec.items) {
          const itemPhotos = [];
          const itemPhotoCount = item.photos?.length || 0;
          
          // Process photos for this item
          for (let idx = 0; idx < itemPhotoCount; idx++) {
            const photo = item.photos[idx];
            try {
              const blob = await getPhotoBlob(photo.storageKey);
              if (blob) {
                const sanitizedItem = sanitizeFilename(item.label);
                const ext = blob.type === "image/jpeg" ? "jpg" : "png";
                const photoFilename = `${sanitizedItem}-${idx + 1}.${ext}`;
                zip.folder("photos").file(photoFilename, blob);
                totalPhotos++;
                
                itemPhotos.push({
                  id: photo.id,
                  name: photo.name,
                  caption: photo.caption || "",
                  createdAt: photo.createdAt,
                  exportedFilename: photoFilename
                });
              }
            } catch (err) {
              console.warn("Failed to include photo in pack:", photo.storageKey, err);
            }
          }
          
          inspectionExport.items.push({
            id: item.id,
            label: item.label,
            condition: item.condition,
            note: item.note || "",
            evidenceRef: item.evidenceRef || "",
            photoCount: itemPhotoCount,
            photos: itemPhotos
          });
        }
      }

      // Add inspection.json to the zip
      zip.file("inspection.json", JSON.stringify(inspectionExport, null, 2));

      // Generate zip blob and download
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const sanitizedProp = sanitizeFilename(inspection.propertyLabel || inspection.address || "inspection");
      const filename = `inspectit-${sanitizedProp}-pack.zip`;
      
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Inspection pack download failed:", err);
    }
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
      alert(t("importFailed") + (e?.message || t("unknownError")));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const openPreview = () => setPreviewOpen(true);

  const printFromPreview = () => {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 60);
  };

  const openResetConfirm = () => {
    setResetConfirmOpen(true);
  };

  const performReset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // ignore
    }
    
    // Re-initialize with the CURRENT language template
    const freshTemplate = defaultTemplate(language);
    const fresh = {
      meta: {
        appId: APP_ID,
        version: APP_VERSION,
        updatedAt: new Date().toISOString(),
      },
      template: freshTemplate,
      inspections: [],
    };

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
      buildDraftFromTemplate(freshTemplate, {
        date: isoToday(),
        inspectionType: "move-in",
        propertyLabel: "",
        address: "",
        occupants: "",
        notes: "",
      })
    );
    setResetConfirmOpen(false);
  };

  // -------- print scoping (print ONLY preview sheet) --------
  const PRINT_SCOPE_CSS = `
    @media print {
      @page { margin: 10mm; }
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

  const deleteSectionTitle = useMemo(() => {
    if (!deleteSectionState.sectionId) return "";
    return (draft.sections || []).find((s) => s.id === deleteSectionState.sectionId)?.title || t("thisSection");
  }, [deleteSectionState.sectionId, draft.sections]);

  const deleteItemLabel = useMemo(() => {
    if (!deleteItemState.sectionId || !deleteItemState.itemId) return "";
    return (draft.sections || []).find((s) => s.id === deleteItemState.sectionId)?.items?.find((it) => it.id === deleteItemState.itemId)?.label || t("thisItem");
  }, [deleteItemState.sectionId, deleteItemState.itemId, draft.sections]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <style>{GLOBAL_CSS}</style>
      {previewOpen ? <style>{PRINT_SCOPE_CSS}</style> : null}

      <ImportExportModal
        open={importExportOpen}
        language={language}
        onClose={() => setImportExportOpen(false)}
        onPrint={() => {
          printFromPreview();
          setImportExportOpen(false);
        }}
        onExport={() => {
          exportJSON();
          setImportExportOpen(false);
        }}
        onImport={() => {
          onImportPick();
          setImportExportOpen(false);
        }}
      />
      <InputModal
        open={addSectionOpen}
        language={language}
        onClose={() => setAddSectionOpen(false)}
        onSubmit={onAddSectionSubmit}
        title={t("addSectionTitle")}
        inputLabel={t("sectionTitle")}
        placeholder={t("placeholderSection")}
        submitLabel={t("addSection")}
      />
      <InputModal
        open={addItemState.open}
        language={language}
        onClose={() => setAddItemState({ ...addItemState, open: false })}
        onSubmit={onAddItemSubmit}
        title={t("addItemTitle")}
        inputLabel={t("itemLabel")}
        placeholder={t("placeholderItem")}
        submitLabel={t("addItemTitle")}
      />
      <InputModal
        open={renameItemState.open}
        language={language}
        onClose={() => setRenameItemState({ ...renameItemState, open: false })}
        onSubmit={onRenameItemSubmit}
        title={t("renameItemTitle")}
        inputLabel={t("itemLabel")}
        initialValue={renameItemState.initialValue}
        submitLabel={t("save")}
      />
      <ConfirmModal
        open={deleteSectionState.open}
        language={language}
        onClose={() => setDeleteSectionState({ ...deleteSectionState, open: false })}
        onConfirm={onDeleteSectionConfirm}
        title={t("deleteSectionTitle")}
        message={t_fmt(t("deleteSectionConfirm"), deleteSectionTitle)}
        confirmLabel={t("delete")}
        isDanger
      />
      <ConfirmModal
        open={deleteItemState.open}
        language={language}
        onClose={() => setDeleteItemState({ ...deleteItemState, open: false })}
        onConfirm={onDeleteItemConfirm}
        title={t("deleteItemTitle")}
        message={t_fmt(t("deleteItemConfirm"), deleteItemLabel)}
        confirmLabel={t("delete")}
        isDanger
      />
      <ConfirmModal
        open={resetConfirmOpen}
        language={language}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={performReset}
        title={t("resetAppDataTitle")}
        message={t("resetAppDataMessage")}
        confirmLabel={t("reset")}
        isDanger
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} onReset={openResetConfirm} language={language} />
      <PhotoViewerModal
        open={photoViewerState.open}
        url={photoViewerState.url}
        caption={photoViewerState.caption}
        onClose={() => setPhotoViewerState({ open: false, url: null, caption: "" })}
      />

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between print:hidden">
          <div>
            <div className="flex justify-center items-center">
              <img
                src={headingImage}
                alt="Inspect-It"
                className="w-full max-w-md h-auto select-none"
              />
            </div>
          </div>

          {/* Normalized top actions grid + pinned help */}
          <div className="flex items-center gap-3">
            <a
              href={HUB_URL}
              target="_blank"
              rel="noreferrer"
              title="ToolStack Hub"
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-sm hover:shadow ${(!HUB_URL || HUB_URL === "https://YOUR-WIX-HUB-URL-HERE") ? "pointer-events-none opacity-50" : ""}`}
            >
              <HomeIcon className="h-5 w-5" />
              <span>Hub</span>
            </a>
            <button type="button" onClick={openPreview} title="Preview" className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-sm hover:shadow">
              <FileTextIcon className="h-5 w-5" />
              <span>Preview</span>
            </button>
            <button type="button" onClick={() => setImportExportOpen(true)} title="Import / Export" className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 shadow-sm hover:shadow">
              <ArchiveIcon className="h-5 w-5" />
              <span>Export</span>
            </button>

            <button
              type="button"
              title="Help"
              onClick={() => setHelpOpen(true)}
              className="print:hidden h-14 w-14 rounded-full bg-neutral-600 text-white shadow-lg hover:shadow-xl hover:bg-neutral-500 transition-all flex items-center justify-center font-bold text-2xl"
              className="print:hidden h-10 w-10 rounded-lg bg-neutral-600 text-white shadow hover:bg-neutral-500 transition-all flex items-center justify-center font-bold text-lg"
              aria-label="Help"
            >
              ?
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="flex flex-col gap-4 print:hidden">
          {/* Draft card */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <div className="flex items-center rounded-lg border border-neutral-200 bg-white shadow-sm p-1 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-3 py-1 rounded-lg transition ${
                    language === "en" ? "bg-neutral-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("de")}
                  className={`px-3 py-1 rounded-lg transition ${
                    language === "de" ? "bg-neutral-600 text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  DE
                </button>
              </div>
            </div>

            <div className={card}>
              <div className={cardPad}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <div className="font-semibold text-neutral-800">{t("newInspection")}</div>
                  <div className="text-sm text-neutral-600">
                    {t("items")}: {totals.total} • {t("damaged")}: {totals.damaged} • {t("worn")}: {totals.worn} • {t("missing")}: {totals.missing}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="w-[220px]">
                    <DatePicker label={t("date")} value={date} onChange={setDate} language={language} />
                  </div>
                  <label className="text-sm w-[220px]">
                    <div className="text-neutral-600 font-medium">{t("type")}</div>
                    <select className={inputBase} value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                      <option value="move-in">{t("moveIn")}</option>
                      <option value="move-out">{t("moveOut")}</option>
                      <option value="periodic">{t("periodic")}</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-neutral-600 font-medium">{t("inspectorName")}</div>
                  <input
                    className={inputBase}
                    value={profile.user || ""}
                    onChange={(e) => setProfile(p => ({ ...p, user: e.target.value }))}
                    placeholder="e.g. John Doe"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-neutral-600 font-medium">{t("organization")}</div>
                  <input
                    className={inputBase}
                    value={profile.org || ""}
                    onChange={(e) => setProfile(p => ({ ...p, org: e.target.value }))}
                    placeholder="e.g. Acme Corp"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-neutral-600 font-medium">{t("propertyLabel")}</div>
                  <input
                    className={inputBase}
                    value={propertyLabel}
                    onChange={(e) => setPropertyLabel(e.target.value)}
                    placeholder="e.g., Room 3 / Flat A"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-neutral-600 font-medium">{t("occupants")}</div>
                  <input className={inputBase} value={occupants} onChange={(e) => setOccupants(e.target.value)} placeholder="Names" />
                </label>
                <label className="text-sm md:col-span-2">
                  <div className="text-neutral-600 font-medium">{t("address")}</div>
                  <input className={inputBase} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" />
                </label>
              </div>

              <label className="block text-sm mt-3">
                <div className="text-neutral-600 font-medium">{t("generalNotes")}</div>
                <textarea
                  className={`${inputBase} min-h-[90px]`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("contextHint")}
                />
              </label>
              </div>
            </div>

            <div className={`${card} mt-3`}>
              <div className={cardPad}>
                {/* Checklist builder */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-neutral-700">
                    <span className="font-semibold text-neutral-800">{t("checklist")}</span>
                    <span className="text-neutral-600"> {t("checklistHint")}</span>
                  </div>
                  <SmallButton tone="primary" onClick={() => setAddSectionOpen(true)}>
                    + {t("addSection")}
                  </SmallButton>
                </div>

                {/* Sections */}
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(draft.sections || []).map((s, index) => {
                    const isCollapsed = collapsedSections.has(s.id);
                    const stats = s.items.reduce((acc, item) => {
                      acc[item.condition] = (acc[item.condition] || 0) + 1;
                      return acc;
                    }, { ok: 0, worn: 0, damaged: 0, missing: 0, "n/a": 0 });
                    const totalItems = s.items.length;

                    return (
                    <div
                      key={s.id}
                      className="rounded-xl border border-neutral-200 p-4 bg-neutral-50 hover:border-neutral-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => toggleSection(s.id)}
                          className="mt-1 text-neutral-400 hover:text-neutral-700 transition-colors"
                          title={isCollapsed ? "Expand" : "Collapse"}
                        >
                          {isCollapsed ? <ChevronRightIcon className="h-5 w-5" /> : <ChevronDownIcon className="h-5 w-5" />}
                        </button>
                        <div className="min-w-0 flex-1 group">
                          {editingSectionId === s.id ? (
                            <input
                              autoFocus
                              className="font-bold text-neutral-800 w-full bg-white border border-neutral-300 rounded-lg px-2 py-1 -ml-2 outline-none focus:ring-2 focus:ring-neutral-200"
                              defaultValue={s.title}
                              onBlur={(e) => finishEditingSection(s.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") finishEditingSection(s.id, e.currentTarget.value);
                                if (e.key === "Escape") setEditingSectionId(null);
                              }}
                            />
                          ) : (
                            <div
                              onClick={() => setEditingSectionId(s.id)}
                              className="font-bold text-neutral-800 truncate cursor-pointer rounded-lg px-2 py-1 -ml-2 border border-transparent hover:border-neutral-300 hover:bg-white hover:shadow-sm transition-all"
                              title={t("renameSectionTitle")}
                            >
                              {s.title}
                            </div>
                          )}
                          <div className="text-xs text-neutral-600">{(s.items || []).length} {t("items")}</div>

                          {totalItems > 0 && (
                            <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                              {stats.ok > 0 && <div style={{ width: `${(stats.ok / totalItems) * 100}%` }} className="bg-emerald-400" />}
                              {stats.worn > 0 && <div style={{ width: `${(stats.worn / totalItems) * 100}%` }} className="bg-amber-400" />}
                              {(stats.damaged + stats.missing) > 0 && <div style={{ width: `${((stats.damaged + stats.missing) / totalItems) * 100}%` }} className="bg-red-500" />}
                              {stats["n/a"] > 0 && <div style={{ width: `${(stats["n/a"] / totalItems) * 100}%` }} className="bg-neutral-300" />}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <SmallButton onClick={() => openAddItem(s.id)} className="px-2 py-1.5" tone="primary">
                            + Item
                          </SmallButton>
                          <IconButton title="Delete section" tone="danger" onClick={() => openDeleteSection(s.id)}>
                            🗑
                          </IconButton>
                        </div>
                      </div>

                      {!isCollapsed && (
                      <div className="mt-3 space-y-2">
                        {(s.items || []).length === 0 ? (
                          <div className="text-sm text-neutral-600">{t("noItemsYet")}</div>
                        ) : null}

                        {(s.items || []).map((it) => (
                          <div key={it.id} className="rounded-lg bg-white border border-neutral-200 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-neutral-800 break-words">{it.label}</div>
                                <div className="mt-2 flex items-center gap-2 print:hidden">
                                  <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600"
                                    onClick={() => openRenameItem(s.id, it.id)}
                                    title="Rename item"
                                  >
                                    {t("rename")}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded border border-red-100 bg-red-50 hover:bg-red-100 text-red-700"
                                    onClick={() => openDeleteItem(s.id, it.id)}
                                    title="Delete item"
                                  >
                                    {t("delete")}
                                  </button>
                                </div>
                              </div>

                              {/* Condition controls (aligned) */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center h-8 text-xs px-2 rounded-full font-medium border ${badgeClass(it.condition)}`}>
                                  {t(`condition_${it.condition}`) || "OK"}
                                </span>
                                <select
                                  className="h-8 text-sm px-2 rounded-lg border border-neutral-200 bg-white focus:outline-none focus:border-neutral-400 font-medium"
                                  value={it.condition}
                                  onChange={(e) => updateItem(s.id, it.id, { condition: e.target.value })}
                                >
                                  {CONDITION_OPTIONS.map((o) => (
                                    <option key={o.key} value={o.key}>
                                      {t(`condition_${o.key}`)}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Wider note + wrap, evidence under */}
                            <div className="mt-3 space-y-2">
                              <AutoTextarea
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:border-neutral-400 resize-none overflow-hidden whitespace-pre-wrap font-medium"
                                placeholder={t("notePlaceholder")}
                                value={it.note}
                                onChange={(e) => updateItem(s.id, it.id, { note: e.target.value })}
                              />
                              <input
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:border-neutral-400 font-medium"
                                placeholder={t("evidenceRef")}
                                value={it.evidenceRef}
                                onChange={(e) => updateItem(s.id, it.id, { evidenceRef: e.target.value })}
                              />
                              <div className="flex items-center gap-2">
                                <input
                                  id={`photo-${it.id}`}
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => handlePhotoUpload(s.id, it.id, e.target.files[0])}
                                  hidden
                                />
                                <label
                                  htmlFor={`photo-${it.id}`}
                                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                                    it.photos.length >= 3 || totalPhotos >= 20
                                      ? "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed"
                                      : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 cursor-pointer"
                                  }`}
                                >
                                  Add Photo ({it.photos.length}/3)
                                </label>
                              </div>
                            </div>

                            {/* Photos */}
                            {it.photos.length > 0 && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {it.photos.map((p, idx) => (
                                  <div key={p.id} className="flex flex-col items-center">
                                    <img
                                      src={photoURLs[p.id]}
                                      alt={p.name}
                                      className="w-16 h-16 object-cover rounded border border-neutral-200 cursor-pointer hover:opacity-80 transition-opacity"
                                      onClick={() => {
                                        if (photoURLs[p.id]) {
                                          setPhotoViewerState({ open: true, url: photoURLs[p.id], caption: p.caption });
                                        }
                                      }}
                                    />
                                    <input
                                      className="w-full mt-1 px-2 py-1 text-xs rounded border border-neutral-200 bg-white focus:outline-none focus:border-neutral-400"
                                      value={p.caption}
                                      onChange={(e) => updatePhotoCaption(it.id, p.id, e.target.value)}
                                      placeholder="Caption"
                                    />
                                    <div className="w-full flex gap-1 mt-1">
                                      <button
                                        className="flex-1 text-xs px-2 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700"
                                        onClick={() => downloadPhoto(it.label, p, idx)}
                                      >
                                        Download
                                      </button>
                                      <button
                                        className="flex-1 text-xs px-2 py-1 rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700"
                                        onClick={async () => {
                                          await deletePhotoBlob(p.storageKey);
                                          removePhotoMetaFromItem(it.id, p.id);
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      )}
                    </div>
                  );})}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <SmallButton onClick={resetDraft}>{t("reset")}</SmallButton>
                  <div className="flex gap-2">
                    <SmallButton onClick={downloadAllPhotos} className="flex items-center gap-2" title="Download photos from this inspection">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                      <span>Download Photos</span>
                    </SmallButton>
                    <SmallButton tone="primary" onClick={saveInspection}>
                      {t("saveInspection")}
                    </SmallButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Saved inspections */}
        <div className={`mt-4 ${card} print:hidden`}>
          <div className={cardPad}>
            <div className="font-semibold text-neutral-800">{t("savedInspections")}</div>
            {(state.inspections || []).length === 0 ? (
              <div className="mt-2 text-sm text-neutral-600">{t("noSavedInspections")}</div>
            ) : (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-600">
                    <tr className="border-b border-neutral-200">
                      <th className="py-2 pr-2">{t("date")}</th>
                      <th className="py-2 pr-2">{t("type")}</th>
                      <th className="py-2 pr-2">{t("property")}</th>
                      <th className="py-2 pr-2">{t("damaged")}</th>
                      <th className="py-2 pr-2">{t("worn")}</th>
                      <th className="py-2 pr-2">{t("missing")}</th>
                      <th className="py-2 pr-2 text-right">{t("action")}</th>
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
                              "text-xs px-2 py-1 rounded-full font-medium border " +
                              (x.summary?.damaged
                                ? "bg-red-500 text-white"
                                : "bg-emerald-100 text-emerald-800")
                            }
                          >
                            {x.summary?.damaged || 0}
                          </span>
                        </td>
                        <td className="py-2 pr-2">{x.summary?.worn || 0}</td>
                        <td className="py-2 pr-2">{x.summary?.missing || 0}</td>
                        <td className="py-2 pr-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-all"
                              onClick={() => onViewInspection(x.id)}
                              title={t("view")}
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-all"
                              onClick={() => loadInspection(x.id)}
                              title={t("edit")}
                            >
                              <PencilIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-600 transition-all"
                              onClick={() => downloadInspectionPack(x)}
                              title="Download inspection pack"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            </button>
                            <button
                              type="button"
                              className="h-8 w-8 flex items-center justify-center rounded-lg border border-red-200 bg-white hover:bg-red-50 text-red-600 transition-all"
                              onClick={() => deleteInspection(x.id)}
                              title={t("delete")}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:block print:p-0 print:static">
            <div className="absolute inset-0 bg-neutral-800/60 backdrop-blur-sm transition-opacity print:hidden" onClick={() => setPreviewOpen(false)} />

            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden print:overflow-visible print:static flex flex-col print:border-none print:shadow-none print:max-h-none">
              {/* Header */}
              <div className="bg-neutral-50 p-6 border-b border-neutral-200 flex items-start justify-end gap-4 print:hidden">
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-500 hover:text-neutral-800 flex items-center justify-center transition-all"
                  onClick={() => setPreviewOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-white print:overflow-visible">
                <div id="inspectit-print-preview" className="p-8 print:p-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <img
                        src={headingImage}
                        alt="Inspect-It"
                        className="h-40 w-auto"
                      />
                    </div>
                    <div className="text-sm text-neutral-700">{t("generated")}: {new Date().toLocaleString(language)}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-neutral-600">{t("preparedBy")}</div>
                      <div className="mt-1 font-semibold text-neutral-800">{profile.user || "-"}</div>
                      <div className="text-xs text-neutral-600 mt-1">{profile.org || "-"}</div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-neutral-600">{t("inspection")}</div>
                      <div className="mt-1">
                        {t("date")}: <span className="font-semibold text-neutral-800">{date}</span>
                      </div>
                      <div className="mt-1">
                        {t("type")}: <span className="font-semibold text-neutral-800">{inspectionType}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-200 p-4">
                      <div className="text-neutral-600">{t("property")}</div>
                      <div className="mt-1">
                        {t("label")}: <span className="font-semibold text-neutral-800">{propertyLabel || "-"}</span>
                      </div>
                      <div className="mt-1">
                        {t("occupants")}: <span className="font-semibold text-neutral-800">{occupants || "-"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-sm">
                    <div className="text-neutral-600">{t("address")}</div>
                    <div className="font-semibold text-neutral-800">{address || "-"}</div>
                  </div>

                  {notes ? (
                    <div className="mt-4 text-sm">
                      <div className="font-semibold text-neutral-800">{t("generalNotes")}</div>
                      <div className="text-neutral-700 whitespace-pre-wrap">{notes}</div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm">
                    <div className="font-semibold text-neutral-800">{t("summary")}</div>
                    <div className="mt-1 text-neutral-700">
                      {t("items")}: {totals.total} • {t("damaged")}: {totals.damaged} • {t("worn")}: {totals.worn} • {t("missing")}: {totals.missing}
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
                                {it.evidenceRef ? <div className="text-neutral-600">{t("evidencePrefix")}{it.evidenceRef}</div> : null}
                                {it.photos.length > 0 && (
                                  <div className="mt-2 grid grid-cols-2 gap-1">
                                    {it.photos.map((p, idx) => (
                                      <div key={p.id} className="flex flex-col">
                                        {photoURLs[p.id] && (
                                          <img
                                            src={photoURLs[p.id]}
                                            alt={p.name}
                                            className="max-w-24 max-h-24 object-cover border border-neutral-200 cursor-pointer"
                                            onClick={() => downloadPhoto(it.label, p, idx)}
                                            title="Click to download"
                                          />
                                        )}
                                        {p.caption && <div className="text-xs text-neutral-600 mt-1">{p.caption}</div>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full border ${badgeClass(it.condition)}`}>
                                {t(`condition_${it.condition}`) || "OK"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
                    <div>
                      <div className="text-neutral-600">{t("tenant")}</div>
                      <div className="mt-8 border-t border-neutral-200 pt-2">{t("signature")}</div>
                    </div>
                    <div>
                      <div className="text-neutral-600">{t("landlord")}</div>
                      <div className="mt-8 border-t border-neutral-200 pt-2">{t("signature")}</div>
                    </div>
                  </div>

                  <div className="mt-6 text-xs text-neutral-600">
                    {t("storageKeys")}: <span className="font-mono">{KEY}</span> • <span className="font-mono">{PROFILE_KEY}</span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end gap-4 print:hidden">
                <button
                  type="button"
                  className="px-6 py-2 rounded-lg text-sm font-medium bg-neutral-600 text-white hover:bg-neutral-500 transition-all"
                  onClick={() => window.print()}
                >
                  {t("printSavePdf")}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
