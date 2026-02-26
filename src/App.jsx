import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import hubIcon from "./assets/hub_tag.png";
import previewIcon from "./assets/preview_tag.png";
import exportIcon from "./assets/export_tag.png";
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
  "w-full mt-1 px-3 py-2 rounded-xl border-2 border-neutral-900 bg-white focus:outline-none focus:bg-[#D5FF00]/10 transition-colors font-medium";

const card = "rounded-2xl bg-white border-2 border-neutral-900 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]";
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
      className={`${ACTION_BASE} bg-white hover:bg-[#D5FF00] text-neutral-700 border-neutral-200`}
    >
      {children}
    </button>
  );
}

function SmallButton({ children, onClick, tone = "default", className = "", disabled, title, type = "button" }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 text-[#D5FF00] border-neutral-900 hover:bg-neutral-800"
      : tone === "danger"
        ? "bg-red-100 text-red-900 border-neutral-900 hover:bg-red-200"
        : "bg-white text-neutral-900 border-neutral-900 hover:bg-[#D5FF00]";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`print:hidden px-4 py-2 rounded-xl text-sm font-bold border-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed ${cls} ${className}`}
    >
      {children}
    </button>
  );
}

function IconButton({ title, onClick, tone = "default", children }) {
  const cls =
    tone === "danger"
      ? "bg-red-100 text-red-900 hover:bg-red-200"
      : "bg-white text-neutral-900 hover:bg-[#D5FF00]";
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`print:hidden h-10 w-10 rounded-xl border-2 border-neutral-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center font-bold ${cls}`}
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

function DatePicker({ label = "Date", value, onChange, language = "en" }) {
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

  const monthNames = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString(language, { month: 'long' }));
  }, [language]);

  const dowNames = useMemo(() => {
    // Jan 4 2021 was a Monday
    return Array.from({ length: 7 }, (_, i) => new Date(2021, 0, 4 + i).toLocaleString(language, { weekday: 'short' }));
  }, [language]);

  const t_today = language === "de" ? "Heute" : "Today";
  const t_close = language === "de" ? "Schließen" : "Close";

  return (
    <div className="text-sm">
      <div className="text-neutral-600 font-medium">{label}</div>

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="w-full mt-1 px-3 py-2 rounded-xl border-2 border-neutral-900 bg-white hover:bg-[#D5FF00] text-neutral-800 transition flex items-center justify-between gap-2 font-medium"
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
            className="fixed z-50 rounded-2xl bg-white border-2 border-neutral-900 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] p-4"
            style={{ top: pos.top, left: pos.left, width: 340 }}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setViewDate((d) => startOfMonth(addMonths(d, -1)))}
                className="h-9 w-9 rounded-xl border-2 border-neutral-900 bg-white hover:bg-[#D5FF00] text-neutral-800 flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all"
                aria-label="Previous month"
                title="Previous month"
              >
                <span className="text-lg leading-none">‹</span>
              </button>

              <div className="text-sm font-semibold text-neutral-800">
                {monthNames[viewDate.getMonth()]} {viewDate.getFullYear()}
              </div>

              <button
                type="button"
                onClick={() => setViewDate((d) => startOfMonth(addMonths(d, 1)))}
                className="h-9 w-9 rounded-xl border-2 border-neutral-900 bg-white hover:bg-[#D5FF00] text-neutral-800 flex items-center justify-center font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all"
                aria-label="Next month"
                title="Next month"
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

                const base = "h-9 rounded-xl text-sm font-bold flex items-center justify-center border-2 transition select-none";

                const cls = isSelected
                  ? "bg-neutral-900 text-[#D5FF00] border-neutral-900"
                  : isToday
                    ? "bg-white text-neutral-900 border-[#D5FF00] shadow-[2px_2px_0px_0px_rgba(213,255,0,1)]"
                    : "bg-white text-neutral-900 border-neutral-900 hover:bg-[#D5FF00]";

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
                className="px-3 py-2 rounded-xl text-sm font-bold border-2 border-neutral-900 bg-white hover:bg-[#D5FF00] text-neutral-900"
                onClick={() => {
                  onChange?.(toISODate(today));
                  setOpen(false);
                }}
              >
                {t_today}
              </button>

              <button
                type="button"
                className="px-3 py-2 rounded-xl text-sm font-bold border-2 border-neutral-900 bg-neutral-900 text-[#D5FF00] hover:bg-neutral-800"
                onClick={() => setOpen(false)}
              >
                {t_close}
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
    contextHint: "Context: keys received, meter readings, agreements, etc.",
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
    continuityDesc3: "Use Import to restore on new devices."
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
    contextHint: "Kontext: Schlüsselübergabe, Zählerstände, Vereinbarungen usw.",
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
    continuityDesc3: "Nutzen Sie Import, um Daten auf neuen Geräten wiederherzustellen."
  }
};

function HelpModal({ open, onClose, onReset, language = "en" }) {
  if (!open) return null;
  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-2xl max-h-[85vh] bg-white border-4 border-neutral-900 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col"
      >
        {/* Funky Header */}
        <div className="bg-[#D5FF00] p-6 border-b-4 border-neutral-900 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-neutral-900 tracking-tight uppercase transform -rotate-1">
              {t("helpInfo")}
            </h2>
            <p className="text-neutral-900 font-bold mt-1 text-sm">
              {t("keepSafe")}
            </p>
          </div>
          <button
            type="button"
            className="h-10 w-10 rounded-xl bg-white border-2 border-neutral-900 hover:bg-neutral-900 hover:text-[#D5FF00] flex items-center justify-center font-black text-xl transition-all active:translate-y-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 bg-white">
          {/* 1) About InspectIt */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">About InspectIt</h3>
            <p className="text-sm text-neutral-700 leading-relaxed">
              InspectIt is a local-first property inspection tool designed to help you record structured inspection
              notes, condition details, and generate clean print-ready reports. It runs entirely in your browser with
              no accounts, no cloud storage, and no automatic data sharing.
            </p>
          </div>

          {/* 2) How InspectIt Works */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">How InspectIt Works</h3>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">InspectIt follows a structured workflow:</p>
            <ol className="text-sm text-neutral-700 space-y-2 list-decimal list-inside">
              <li>
                <strong>Create Inspection Profile</strong>
                <br />
                Enter property or inspection details.
              </li>
              <li>
                <strong>Add Inspection Sections</strong>
                <br />
                Organise inspection categories (e.g., Rooms, Exterior, Utilities, Condition Areas).
              </li>
              <li>
                <strong>Record Findings</strong>
                <br />
                Add notes, condition descriptions, and relevant details for each section.
              </li>
              <li>
                <strong>Review Overview</strong>
                <br />
                Confirm entries and inspection completeness.
              </li>
              <li>
                <strong>Preview & Print</strong>
                <br />
                Generate a clean, print-ready inspection report.
              </li>
              <li>
                <strong>Export a Backup</strong>
                <br />
                Export a JSON backup regularly, especially after major updates.
              </li>
            </ol>
          </div>

          {/* 3) Your Data & Privacy */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">Your Data & Privacy</h3>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">
              Your data is saved locally in this browser using secure local storage. This means:
            </p>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>Your data stays on this device</li>
              <li>Clearing browser data can remove inspection records</li>
              <li>Incognito/private mode will not retain data</li>
              <li>Data does not automatically sync across devices</li>
            </ul>
          </div>

          {/* 4) Backup & Restore */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">Backup & Restore</h3>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">
              <strong>Export</strong> downloads a JSON backup of your current InspectIt data.
            </p>
            <p className="text-sm text-neutral-700 leading-relaxed mb-2">
              <strong>Import</strong> restores a previously exported JSON file and replaces current app data.
            </p>
            <p className="text-sm text-neutral-700 leading-relaxed">Recommended routine:</p>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>Export weekly</li>
              <li>Export after major edits</li>
              <li>Store backups in two locations (e.g., Downloads + Drive/USB)</li>
            </ul>
          </div>

          {/* 5) Buttons Explained */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">Buttons Explained</h3>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li><strong>Preview</strong> – Opens the print-ready inspection report.</li>
              <li><strong>Print / Save PDF</strong> – Prints only the preview sheet. Choose “Save as PDF” to create a file.</li>
              <li><strong>Export</strong> – Downloads a JSON backup file.</li>
              <li><strong>Import</strong> – Restores data from a JSON backup file.</li>
            </ul>
          </div>

          {/* 6) Storage Keys (Advanced) */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">Storage Keys (Advanced)</h3>
            <p className="text-sm text-neutral-700 leading-relaxed">App data key: <code className="font-mono text-xs bg-white border border-neutral-300 rounded px-2 py-1">{KEY}</code></p>
            <p className="text-sm text-neutral-700 leading-relaxed mt-1">Shared profile key: <code className="font-mono text-xs bg-white border border-neutral-300 rounded px-2 py-1">{PROFILE_KEY}</code></p>
          </div>

          {/* 7) Notes / Limitations */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">Notes / Limitations</h3>
            <ul className="text-sm text-neutral-700 space-y-2 list-disc list-inside">
              <li>InspectIt is an inspection documentation tool. Reports depend on the accuracy of the information entered.</li>
              <li>Use Export regularly to avoid data loss.</li>
            </ul>
          </div>

          {/* 8) Support / Feedback */}
          <div className="bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5">
            <h3 className="font-bold text-lg text-neutral-900 mb-2">Support / Feedback</h3>
            <p className="text-sm text-neutral-700 leading-relaxed">
              If something breaks, include: device + browser + steps to reproduce + expected vs actual behaviour.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-4 border-neutral-900 bg-neutral-100 flex items-center justify-between gap-4">
          <button
            type="button"
            className="px-4 py-2 rounded-xl text-sm font-bold border-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-500 transition-colors"
            onClick={onReset}
          >
            {t("resetData")}
          </button>
          <button
            type="button"
            className="px-6 py-2 rounded-xl text-sm font-bold border-2 border-neutral-900 bg-neutral-900 text-[#D5FF00] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all"
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white border-4 border-neutral-900 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden transform transition-all">
        <div className="px-5 py-4 border-b-4 border-neutral-900 flex items-center justify-between bg-[#D5FF00]">
          <h3 className="font-black text-xl text-neutral-900 uppercase tracking-tight transform -rotate-1">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border-2 border-neutral-900 bg-white flex items-center justify-center hover:bg-neutral-900 hover:text-[#D5FF00] text-neutral-900 font-bold transition-colors"
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
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-white border-4 border-neutral-900 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden transform transition-all">
        <div className="px-5 py-4 border-b-4 border-neutral-900 flex items-center justify-between bg-[#D5FF00]">
          <h3 className="font-black text-xl text-neutral-900 uppercase tracking-tight transform -rotate-1">{title}</h3>
          <button 
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg border-2 border-neutral-900 bg-white flex items-center justify-center hover:bg-neutral-900 hover:text-[#D5FF00] text-neutral-900 font-bold transition-colors"
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
            <div className="text-sm font-bold text-neutral-900 mb-1">{inputLabel}</div>
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

function ImportExportModal({ open, onClose, onImport, onExport, language = "en" }) {
  if (!open) return null;
  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg max-h-[85vh] bg-white border-4 border-neutral-900 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-[#D5FF00] p-6 border-b-4 border-neutral-900 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-3xl font-black text-neutral-900 tracking-tight uppercase transform -rotate-1">
              {t("importExport")}
            </h2>
            <p className="text-neutral-900 font-bold mt-1 text-sm">{t("saveLoadData")}</p>
          </div>
          <button
            type="button"
            className="h-10 w-10 rounded-xl bg-white border-2 border-neutral-900 hover:bg-neutral-900 hover:text-[#D5FF00] flex items-center justify-center font-black text-xl transition-all active:translate-y-1"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-sm text-neutral-700 overflow-auto min-h-0 bg-white">
          <div className="group relative bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5 hover:bg-green-50 transition-colors">
            <div className="absolute -top-3 -left-3 bg-green-400 text-neutral-900 border-2 border-neutral-900 text-xs font-bold px-3 py-1 rounded-full transform -rotate-3 group-hover:rotate-0 transition-transform">
              SAVE
            </div>
            <h3 className="font-bold text-lg text-neutral-900 mb-2">{t("exportToFile")}</h3>
            <p className="leading-relaxed">
              {t("exportDesc")}
            </p>
            <div className="mt-5">
              <button type="button" className="px-4 py-2 rounded-xl text-sm font-bold border-2 border-neutral-900 bg-neutral-900 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-green-500 hover:border-green-600 hover:text-white active:translate-y-1 active:shadow-sm transition-all" onClick={onExport}>
                {t("exportJson")}
              </button>
            </div>
          </div>

          <div className="group relative bg-neutral-50 border-2 border-neutral-900 rounded-2xl p-5 hover:bg-cyan-50 transition-colors">
            <div className="absolute -top-3 -right-3 bg-cyan-400 text-neutral-900 border-2 border-neutral-900 text-xs font-bold px-3 py-1 rounded-full transform rotate-2 group-hover:rotate-0 transition-transform">
              LOAD
            </div>
            <h3 className="font-bold text-lg text-neutral-900 mb-2">{t("importFromFile")}</h3>
            <p className="leading-relaxed">
              {t("importDesc")}
            </p>
            <div className="mt-5">
              <button type="button" className="px-4 py-2 rounded-xl text-sm font-bold border-2 border-neutral-200 text-neutral-700 bg-white hover:bg-cyan-100 hover:border-cyan-400 transition-colors" onClick={onImport}>
                {t("importJson")}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t-4 border-neutral-900 bg-neutral-100 flex items-center justify-end gap-2">
          <button type="button" className="px-6 py-2 rounded-xl text-sm font-bold border-2 border-neutral-900 bg-neutral-900 text-[#D5FF00] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all" onClick={onClose}>
            {t("done")}
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
      return "bg-red-500 text-white border-neutral-900";
    case "worn":
      return "bg-amber-300 text-neutral-900 border-neutral-900";
    case "n/a":
      return "bg-neutral-200 text-neutral-500 border-neutral-900";
    default:
      return "bg-emerald-300 text-neutral-900 border-neutral-900";
  }
}

const SECTION_BG_COLORS = [
  "bg-cyan-100",
  "bg-rose-100",
  "bg-amber-100",
  "bg-violet-100",
  "bg-lime-100",
  "bg-sky-100",
];

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
  const [renameSectionState, setRenameSectionState] = useState({ open: false, sectionId: null, initialValue: "" });
  const [deleteSectionState, setDeleteSectionState] = useState({ open: false, sectionId: null });
  const [deleteItemState, setDeleteItemState] = useState({ open: false, sectionId: null, itemId: null });
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [importExportOpen, setImportExportOpen] = useState(false);

  const fileRef = useRef(null);

  const t = (key) => TRANSLATIONS[language]?.[key] || TRANSLATIONS["en"][key] || key;

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

  function onAddSectionSubmit(title) {
    const sectionId = uid("s");
    const nextTitle = String(title).trim() || "New section";

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = [...(nextTemplate.sections || []), { id: sectionId, title: nextTitle, items: [] }];
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: [...(d.sections || []), { id: sectionId, title: nextTitle, items: [] }],
    }));
    setAddSectionOpen(false);
  }

  function openRenameSection(sectionId) {
    const current = (draft.sections || []).find((s) => s.id === sectionId)?.title || "";
    setRenameSectionState({ open: true, sectionId, initialValue: current });
  }

  function onRenameSectionSubmit(title) {
    const { sectionId, initialValue } = renameSectionState;
    if (!sectionId) return;
    const nextTitle = String(title).trim() || initialValue || "Section";

    const nextTemplate = normalizeTemplate(state.template);
    nextTemplate.sections = (nextTemplate.sections || []).map((s) => (s.id !== sectionId ? s : { ...s, title: nextTitle }));
    setTemplateAndPersist(nextTemplate);

    setDraft((d) => ({
      ...d,
      sections: (d.sections || []).map((s) => (s.id !== sectionId ? s : { ...s, title: nextTitle })),
    }));
    setRenameSectionState({ open: false, sectionId: null, initialValue: "" });
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

  function openRenameItem(sectionId, itemId) {
    const current = (draft.sections || []).find((s) => s.id === sectionId)?.items?.find((it) => it.id === itemId)?.label || "";
    setRenameItemState({ open: true, sectionId, itemId, initialValue: current });
  }

  function onRenameItemSubmit(label) {
    const { sectionId, itemId, initialValue } = renameItemState;
    if (!sectionId || !itemId) return;
    const nextLabel = String(label).trim() || initialValue || "Item";

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

  const openResetConfirm = () => {
    setResetConfirmOpen(true);
  };

  const performReset = () => {
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
    setResetConfirmOpen(false);
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

  const deleteSectionTitle = useMemo(() => {
    if (!deleteSectionState.sectionId) return "";
    return (draft.sections || []).find((s) => s.id === deleteSectionState.sectionId)?.title || "this section";
  }, [deleteSectionState.sectionId, draft.sections]);

  const deleteItemLabel = useMemo(() => {
    if (!deleteItemState.sectionId || !deleteItemState.itemId) return "";
    return (draft.sections || []).find((s) => s.id === deleteItemState.sectionId)?.items?.find((it) => it.id === deleteItemState.itemId)?.label || "this item";
  }, [deleteItemState.sectionId, deleteItemState.itemId, draft.sections]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-800">
      <style>{GLOBAL_CSS}</style>
      {previewOpen ? <style>{PRINT_SCOPE_CSS}</style> : null}

      <ImportExportModal
        open={importExportOpen}
        language={language}
        onClose={() => setImportExportOpen(false)}
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
        placeholder="e.g., Garage, Guest Room..."
        submitLabel={t("addSection")}
      />
      <InputModal
        open={addItemState.open}
        language={language}
        onClose={() => setAddItemState({ ...addItemState, open: false })}
        onSubmit={onAddItemSubmit}
        title={t("addItemTitle")}
        inputLabel={t("itemLabel")}
        placeholder="e.g., Ceiling light, Radiator..."
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
      <InputModal
        open={renameSectionState.open}
        language={language}
        onClose={() => setRenameSectionState({ ...renameSectionState, open: false })}
        onSubmit={onRenameSectionSubmit}
        title={t("renameSectionTitle")}
        inputLabel={t("sectionTitle")}
        initialValue={renameSectionState.initialValue}
        submitLabel={t("save")}
      />
      <ConfirmModal
        open={deleteSectionState.open}
        language={language}
        onClose={() => setDeleteSectionState({ ...deleteSectionState, open: false })}
        onConfirm={onDeleteSectionConfirm}
        title={t("deleteSectionTitle")}
        message={language === 'de' ? `“${deleteSectionTitle}” löschen? Dies entfernt es auch aus der Checklistenvorlage.` : `Delete “${deleteSectionTitle}”? This removes it from the checklist template too.`}
        confirmLabel={t("delete")}
        isDanger
      />
      <ConfirmModal
        open={deleteItemState.open}
        language={language}
        onClose={() => setDeleteItemState({ ...deleteItemState, open: false })}
        onConfirm={onDeleteItemConfirm}
        title={t("deleteItemTitle")}
        message={language === 'de' ? `Element “${deleteItemLabel}” löschen? Dies entfernt es auch aus der Checklistenvorlage.` : `Delete item “${deleteItemLabel}”? This removes it from the checklist template too.`}
        confirmLabel={t("delete")}
        isDanger
      />
      <ConfirmModal
        open={resetConfirmOpen}
        language={language}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={performReset}
        title="Reset App Data"
        message="Reset Inspect-It data? This clears local storage for this app."
        confirmLabel="Reset"
        isDanger
      />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} onReset={openResetConfirm} language={language} />

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
              className={`${(!HUB_URL || HUB_URL === "https://YOUR-WIX-HUB-URL-HERE") && "pointer-events-none opacity-50"}`}
            >
              <img
                src={hubIcon}
                alt="Hub"
                className="h-20 w-auto hover:scale-105 transition-transform duration-200"
              />
            </a>
            <button type="button" onClick={openPreview} title="Preview">
              <img
                src={previewIcon}
                alt="Preview"
                className="h-20 w-auto hover:scale-105 transition-transform duration-200"
              />
            </button>
            <button type="button" onClick={() => setImportExportOpen(true)} title="Import / Export">
              <img
                src={exportIcon}
                alt="Export"
                className="h-20 w-auto hover:scale-105 transition-transform duration-200"
              />
            </button>

            <button
              type="button"
              title="Help"
              onClick={() => setHelpOpen(true)}
              className="print:hidden h-14 w-14 rounded-xl border-2 border-neutral-900 bg-[#D5FF00] text-neutral-900 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] active:translate-y-[3px] active:shadow-none transition-all flex items-center justify-center font-black text-2xl"
              aria-label="Help"
            >
              ?
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="flex flex-col gap-4">
          {/* Draft card */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <div className="flex items-center rounded-xl border-2 border-neutral-900 bg-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-1 text-sm font-bold">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-3 py-1 rounded-lg transition ${
                    language === "en" ? "bg-neutral-900 text-[#D5FF00]" : "text-neutral-900 hover:bg-[#D5FF00]"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("de")}
                  className={`px-3 py-1 rounded-lg transition ${
                    language === "de" ? "bg-neutral-900 text-[#D5FF00]" : "text-neutral-900 hover:bg-[#D5FF00]"
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

            <div className={`${card} mt-3 shadow-[5px_5px_0px_0px_rgba(0,0,0,1)]`}>
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
                  {(draft.sections || []).map((s, index) => (
                    <div
                      key={s.id}
                      className={`rounded-2xl border-2 border-neutral-900 p-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] ${SECTION_BG_COLORS[index % SECTION_BG_COLORS.length]}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-neutral-800 truncate">{s.title}</div>
                          <div className="text-xs text-neutral-600">{(s.items || []).length} {t("items")}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <SmallButton onClick={() => openAddItem(s.id)} className="px-2 py-1.5" tone="primary">
                            + Item
                          </SmallButton>
                          <IconButton title="Rename section" onClick={() => openRenameSection(s.id)}>
                            ✎
                          </IconButton>
                          <IconButton title="Delete section" tone="danger" onClick={() => openDeleteSection(s.id)}>
                            🗑
                          </IconButton>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {(s.items || []).length === 0 ? (
                          <div className="text-sm text-neutral-600">No items yet — click “+ Item”.</div>
                        ) : null}

                        {(s.items || []).map((it) => (
                          <div key={it.id} className="rounded-2xl bg-white border-2 border-neutral-900 p-3 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-neutral-800 break-words">{it.label}</div>
                                <div className="mt-2 flex items-center gap-2 print:hidden">
                                  <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded-lg border-2 border-neutral-900 bg-white hover:bg-[#D5FF00] text-neutral-900 font-bold"
                                    onClick={() => openRenameItem(s.id, it.id)}
                                    title="Rename item"
                                  >
                                    {t("rename")}
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs px-2 py-1 rounded-lg border-2 border-neutral-900 bg-red-100 hover:bg-red-200 text-red-900 font-bold"
                                    onClick={() => openDeleteItem(s.id, it.id)}
                                    title="Delete item"
                                  >
                                    {t("delete")}
                                  </button>
                                </div>
                              </div>

                              {/* Condition controls (aligned) */}
                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`inline-flex items-center h-9 text-xs px-2 rounded-full border-2 font-bold ${badgeClass(it.condition)}`}>
                                  {t(`condition_${it.condition}`) || "OK"}
                                </span>
                                <select
                                  className="h-9 text-sm px-2 rounded-xl border-2 border-neutral-900 bg-white focus:outline-none focus:bg-[#D5FF00]/10 font-bold"
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
                                className="w-full px-3 py-2 rounded-xl border-2 border-neutral-900 text-sm bg-white focus:outline-none focus:bg-[#D5FF00]/10 resize-none overflow-hidden whitespace-pre-wrap font-medium"
                                placeholder={t("notePlaceholder")}
                                value={it.note}
                                onChange={(e) => updateItem(s.id, it.id, { note: e.target.value })}
                              />
                              <input
                                className="w-full px-3 py-2 rounded-xl border-2 border-neutral-900 text-sm bg-white focus:outline-none focus:bg-[#D5FF00]/10 font-medium"
                                placeholder={t("evidenceRef")}
                                value={it.evidenceRef}
                                onChange={(e) => updateItem(s.id, it.id, { evidenceRef: e.target.value })}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <SmallButton onClick={resetDraft}>{t("reset")}</SmallButton>
                  <SmallButton tone="primary" onClick={saveInspection}>
                    {t("saveInspection")}
                  </SmallButton>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Saved inspections */}
        <div className={`mt-4 ${card}`}>
          <div className={cardPad}>
            <div className="font-semibold text-neutral-800">{t("savedInspections")}</div>
            {(state.inspections || []).length === 0 ? (
              <div className="mt-2 text-sm text-neutral-600">{t("noSavedInspections")}</div>
            ) : (
              <div className="mt-3 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-neutral-600">
                    <tr className="border-b-2 border-neutral-900">
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
                              "text-xs px-2 py-1 rounded-full border-2 font-bold " +
                              (x.summary?.damaged
                                ? "bg-red-500 text-white border-neutral-900"
                                : "bg-emerald-300 text-neutral-900 border-neutral-900")
                            }
                          >
                            {x.summary?.damaged || 0}
                          </span>
                        </td>
                        <td className="py-2 pr-2">{x.summary?.worn || 0}</td>
                        <td className="py-2 pr-2">{x.summary?.missing || 0}</td>
                        <td className="py-2 pr-2 text-right">
                          <button
                            className="px-3 py-1.5 rounded-xl bg-white border-2 border-neutral-900 hover:bg-[#D5FF00] text-neutral-900 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:shadow-none active:translate-y-[2px] transition-all"
                            onClick={() => deleteInspection(x.id)}
                          >
                            {t("delete")}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:static">
            <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity" onClick={() => setPreviewOpen(false)} />

            <div className="relative w-full max-w-5xl max-h-[90vh] bg-white border-4 border-neutral-900 rounded-[2rem] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden print:overflow-visible print:static flex flex-col">
              {/* Header */}
              <div className="bg-[#D5FF00] p-6 border-b-4 border-neutral-900 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-black text-neutral-900 tracking-tight uppercase transform -rotate-1">
                    {t("printPreview")}
                  </h2>
                  <p className="text-neutral-900 font-bold mt-1 text-sm">{t("checkIt")}</p>
                </div>
                <button
                  type="button"
                  className="h-10 w-10 rounded-xl bg-white border-2 border-neutral-900 hover:bg-neutral-900 hover:text-[#D5FF00] flex items-center justify-center font-black text-xl transition-all active:translate-y-1"
                  onClick={() => setPreviewOpen(false)}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-white">
                <div id="inspectit-print-preview" className="p-8">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <img
                        src={headingImage}
                        alt="Inspect-It"
                        className="h-16 w-auto"
                      />
                      <div className="text-sm text-neutral-700 mt-1">{t("inspection")} Report</div>
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
                                {it.evidenceRef ? <div className="text-neutral-600">Evidence: {it.evidenceRef}</div> : null}
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
              <div className="p-4 border-t-4 border-neutral-900 bg-neutral-100 flex items-center justify-end gap-4">
                <button
                  type="button"
                  className="px-6 py-2 rounded-xl text-sm font-bold border-2 border-neutral-900 bg-neutral-900 text-[#D5FF00] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all"
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
