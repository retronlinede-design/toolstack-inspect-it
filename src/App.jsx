// Inspect-It (ToolStack) — module-ready MVP (Styled v1: neutral + lime accent)
// Paste into: src/App.jsx
// Requires: Tailwind v4 configured (same as other ToolStack apps).

import React, { useEffect, useMemo, useRef, useState } from "react";

const APP_ID = "inspectit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";

// Optional: set later
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
// UI primitives (ToolStack standard)
// ---------------------------

const ACTION_BASE =
  "print:hidden h-10 w-full rounded-xl text-sm font-medium border transition shadow-sm active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center";

function ActionButton({ children, onClick, tone = "default", disabled, title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
      : tone === "danger"
        ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
        : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200";

  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className={`${ACTION_BASE} ${cls}`}>
      {children}
    </button>
  );
}

function ActionFileButton({ children, onFile, accept = "application/json", tone = "primary", title }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900"
      : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200";

  return (
    <label title={title} className={`${ACTION_BASE} ${cls} cursor-pointer`}>
      <span>{children}</span>
      <input type="file" accept={accept} className="hidden" onChange={(e) => onFile?.(e.target.files?.[0] || null)} />
    </label>
  );
}

function SmallButton({ children, onClick, tone = "default", className = "", disabled, title, type = "button" }) {
  const cls =
    tone === "primary"
      ? "bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900 shadow-sm"
      : tone === "danger"
        ? "bg-red-50 hover:bg-red-100 text-red-700 border-red-200 shadow-sm"
        : "bg-white hover:bg-neutral-50 text-neutral-900 border-neutral-200 shadow-sm";

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

const inputBase =
  "w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25 focus:border-neutral-300";

// ---------------------------
// Help Pack v1 (ToolStack standard)
// ---------------------------

function HelpModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl bg-white border border-neutral-200 shadow-xl overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-neutral-900">Help</div>
            <div className="text-sm text-neutral-600 mt-1">How your data is saved + how to keep continuity.</div>
            <div className="mt-3 h-[2px] w-56 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
          </div>
          <button
            type="button"
            className="px-3 py-2 rounded-xl text-sm font-medium border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-900 transition"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-900">Autosave (default)</div>
            <div className="text-sm text-neutral-700 mt-1">
              Inspect-It saves automatically in your browser (localStorage) under:
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="font-mono text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1">{KEY}</span>
                <span className="font-mono text-xs bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1">{PROFILE_KEY}</span>
              </div>
            </div>
            <div className="text-xs text-neutral-500 mt-2">
              If you clear browser data or switch devices/browsers, your local data won’t follow automatically.
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-900">Best practice (continuity)</div>
            <ul className="mt-2 space-y-2 text-sm text-neutral-700 list-disc pl-5">
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
            <div className="font-semibold text-neutral-900">Printing / PDF</div>
            <div className="text-sm text-neutral-700 mt-1">
              Use <span className="font-semibold">Preview</span> to check the layout, then{" "}
              <span className="font-semibold">Print / Save PDF</span> and choose “Save as PDF”.
            </div>
            <div className="text-xs text-neutral-500 mt-2">When Preview is open, printing will include only the preview sheet.</div>
          </div>

          <div className="rounded-2xl border border-neutral-200 p-4">
            <div className="font-semibold text-neutral-900">Privacy</div>
            <div className="text-sm text-neutral-700 mt-1">
              Inspect-It runs in your browser. There’s no account system here yet, and nothing is uploaded unless you choose
              to share your exported file.
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-neutral-100 text-xs text-neutral-500">ToolStack • Help Pack v1</div>
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
      org: "ToolStack",
      user: "",
      language: "EN",
      logo: "",
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

  // draft
  const [draft, setDraft] = useState(() => {
    const t = state.template;
    return {
      date,
      inspectionType,
      propertyLabel: "",
      address: "",
      occupants: "",
      notes: "",
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
  });

  // persist profile/state
  useEffect(() => {
    lsSet(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    // keep meta updated and persist
    setState((prev) => saveState(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // persist any state changes
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

  function resetDraft() {
    const t = state.template;
    setPropertyLabel("");
    setAddress("");
    setOccupants("");
    setNotes("");
    setDraft({
      date,
      inspectionType,
      propertyLabel: "",
      address: "",
      occupants: "",
      notes: "",
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
    });
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
      exportedAt: new Date().toISOString(),
      profile,
      data: state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `toolstack-inspect-it-${APP_VERSION}-${isoToday()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importJSON(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(String(text || ""));
      const incoming = parsed?.data;

      if (!incoming?.template || !Array.isArray(incoming?.inspections)) throw new Error("Invalid import file");

      setProfile(parsed?.profile || profile);
      setState(saveState(incoming));
      resetDraft();
    } catch (e) {
      alert("Import failed: " + (e?.message || "unknown error"));
    }
  }

  // print behavior: if preview is open, print ONLY preview sheet
  const openPreview = () => setPreviewOpen(true);

  const moduleManifest = useMemo(
    () => ({
      id: APP_ID,
      name: "Inspect-It",
      version: APP_VERSION,
      storageKeys: [KEY, PROFILE_KEY],
      exports: ["print", "json"],
    }),
    []
  );

  // minimal self-test (won't block)
  useEffect(() => {
    try {
      console.assert(KEY.includes(APP_ID), "KEY should contain app id");
      console.assert(PROFILE_KEY.includes("profile"), "PROFILE_KEY should look like a shared profile key");
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <style>{`
        :root { color-scheme: light; }
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      {/* When preview is open, print only the preview sheet */}
      {previewOpen ? (
        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #inspect-print-preview, #inspect-print-preview * { visibility: visible !important; }
            #inspect-print-preview { position: absolute !important; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      ) : null}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header + normalized top actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-2xl font-bold tracking-tight">Inspect-It</div>
            <div className="text-sm text-neutral-600">
              Module-ready ({moduleManifest.id}.{moduleManifest.version}) • Condition log • Evidence refs • Print/export
            </div>
            <div className="mt-3 h-[2px] w-80 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />
          </div>

          <div className="w-full sm:w-[520px] lg:w-[620px]">
            <div className="relative">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pr-12">
                <ActionButton onClick={openPreview}>Preview</ActionButton>
                <ActionButton onClick={() => window.print()}>Print / Save PDF</ActionButton>
                <ActionButton onClick={exportJSON}>Export</ActionButton>
                <ActionFileButton onFile={(f) => importJSON(f)} tone="primary">
                  Import
                </ActionFileButton>
              </div>

              <button
                type="button"
                title="Help"
                onClick={() => setHelpOpen(true)}
                className="print:hidden absolute right-0 top-0 h-10 w-10 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 shadow-sm flex items-center justify-center font-bold text-neutral-900"
                aria-label="Help"
              >
                ?
              </button>
            </div>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Profile card */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
            <div className="font-semibold">Profile (shared)</div>
            <div className="mt-3 space-y-2">
              <label className="block text-sm">
                <div className="text-neutral-600">Organization</div>
                <input className={inputBase} value={profile.org} onChange={(e) => setProfile({ ...profile, org: e.target.value })} />
              </label>
              <label className="block text-sm">
                <div className="text-neutral-600">User</div>
                <input className={inputBase} value={profile.user} onChange={(e) => setProfile({ ...profile, user: e.target.value })} />
              </label>
              <label className="block text-sm">
                <div className="text-neutral-600">Language</div>
                <select className={inputBase} value={profile.language} onChange={(e) => setProfile({ ...profile, language: e.target.value })}>
                  <option value="EN">EN</option>
                  <option value="DE">DE</option>
                </select>
              </label>
              <div className="pt-2 text-xs text-neutral-500">
                Stored at <span className="font-mono">{PROFILE_KEY}</span>
              </div>
            </div>
          </div>

          {/* Draft card */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 lg:col-span-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="font-semibold">New inspection</div>
                <div className="text-sm text-neutral-600">
                  Items: {totals.total} • Damaged: {totals.damaged} • Worn: {totals.worn} • Missing: {totals.missing}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <label className="text-sm">
                  <div className="text-neutral-600">Date</div>
                  <input type="date" className={inputBase} value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="text-sm">
                  <div className="text-neutral-600">Type</div>
                  <select className={inputBase} value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                    <option value="move-in">Move-in</option>
                    <option value="move-out">Move-out</option>
                    <option value="periodic">Periodic</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className="text-sm">
                <div className="text-neutral-600">Property label</div>
                <input className={inputBase} value={propertyLabel} onChange={(e) => setPropertyLabel(e.target.value)} placeholder="e.g., Room 3 / Flat A" />
              </label>
              <label className="text-sm">
                <div className="text-neutral-600">Occupant(s)</div>
                <input className={inputBase} value={occupants} onChange={(e) => setOccupants(e.target.value)} placeholder="Names" />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="text-neutral-600">Address</div>
                <input className={inputBase} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, City" />
              </label>
            </div>

            <label className="block text-sm mt-3">
              <div className="text-neutral-600">General notes</div>
              <textarea
                className={`${inputBase} min-h-[90px]`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context: keys received, meter readings, agreements, etc."
              />
            </label>

            {/* Sections */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {(draft.sections || []).map((s) => (
                <div key={s.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="font-semibold">{s.title}</div>
                  <div className="mt-2 space-y-2">
                    {(s.items || []).map((it) => (
                      <div key={it.id} className="rounded-xl bg-white border border-neutral-200 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">{it.label}</div>
                          <div className="flex items-center gap-2">
                            <span className={"text-xs px-2 py-1 rounded-full border " + badgeClass(it.condition)}>
                              {CONDITION_OPTIONS.find((o) => o.key === it.condition)?.label || "OK"}
                            </span>
                            <select
                              className="text-sm px-2 py-1 rounded-xl border border-neutral-200 bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25"
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

                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <input
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-lime-400/25"
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

        {/* Saved inspections */}
        <div className="mt-4 bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
          <div className="font-semibold">Saved inspections</div>
          {(state.inspections || []).length === 0 ? (
            <div className="mt-2 text-sm text-neutral-500">No saved inspections yet.</div>
          ) : (
            <div className="mt-3 overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-600">
                  <tr className="border-b">
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
                    <tr key={x.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 font-medium">{x.date}</td>
                      <td className="py-2 pr-2">{x.inspectionType}</td>
                      <td className="py-2 pr-2">{x.propertyLabel || x.address || "-"}</td>
                      <td className="py-2 pr-2">
                        <span
                          className={
                            "text-xs px-2 py-1 rounded-full border " +
                            (x.summary?.damaged ? "bg-red-100 text-red-800 border-red-200" : "bg-emerald-100 text-emerald-800 border-emerald-200")
                          }
                        >
                          {x.summary?.damaged || 0}
                        </span>
                      </td>
                      <td className="py-2 pr-2">{x.summary?.worn || 0}</td>
                      <td className="py-2 pr-2">{x.summary?.missing || 0}</td>
                      <td className="py-2 pr-2 text-right">
                        <button
                          className="px-3 py-1.5 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50"
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

        {/* Preview modal */}
        {previewOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8">
            <div className="absolute inset-0 bg-black/40" onClick={() => setPreviewOpen(false)} />

            <div className="relative w-full max-w-5xl">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="text-lg font-semibold text-white">Print preview</div>
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/15 text-white transition"
                    onClick={() => window.print()}
                  >
                    Print / Save PDF
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl text-sm font-medium border border-white/40 bg-white/10 hover:bg-white/15 text-white transition"
                    onClick={() => setPreviewOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="rounded-2xl bg-white border border-neutral-200 shadow-lg overflow-auto max-h-[80vh]">
                <div id="inspect-print-preview" className="p-6">
                  <div className="text-xl font-bold">{profile.org || "ToolStack"}</div>
                  <div className="text-sm text-neutral-600">Inspection Report</div>
                  <div className="mt-2 h-[2px] w-72 rounded-full bg-gradient-to-r from-lime-400/0 via-lime-400 to-emerald-400/0" />

                  <div className="mt-3 text-sm">
                    <div>
                      <span className="text-neutral-600">Prepared by:</span> {profile.user || "-"}
                    </div>
                    <div>
                      <span className="text-neutral-600">Date:</span> {date}
                    </div>
                    <div>
                      <span className="text-neutral-600">Type:</span> {inspectionType}
                    </div>
                    <div>
                      <span className="text-neutral-600">Property:</span> {propertyLabel || "-"}
                    </div>
                    <div>
                      <span className="text-neutral-600">Address:</span> {address || "-"}
                    </div>
                    <div>
                      <span className="text-neutral-600">Occupants:</span> {occupants || "-"}
                    </div>
                    <div>
                      <span className="text-neutral-600">Generated:</span> {new Date().toLocaleString()}
                    </div>
                  </div>

                  {notes ? (
                    <div className="mt-4 text-sm">
                      <div className="font-semibold">General notes</div>
                      <div className="text-neutral-700 whitespace-pre-wrap">{notes}</div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-2xl border border-neutral-200 p-3 text-sm">
                    <div className="font-semibold">Summary</div>
                    <div className="mt-1 text-neutral-700">
                      Items: {totals.total} • Damaged: {totals.damaged} • Worn: {totals.worn} • Missing: {totals.missing}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(draft.sections || []).map((s) => (
                      <div key={s.id} className="rounded-2xl border border-neutral-200 p-3">
                        <div className="font-semibold">{s.title}</div>
                        <div className="mt-2 space-y-2">
                          {(s.items || []).map((it) => (
                            <div
                              key={it.id}
                              className="text-sm flex items-start justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0"
                            >
                              <div>
                                <div className="font-medium">{it.label}</div>
                                {it.note ? <div className="text-neutral-600">{it.note}</div> : null}
                                {it.evidenceRef ? <div className="text-neutral-600">Evidence: {it.evidenceRef}</div> : null}
                              </div>
                              <span className={"text-xs px-2 py-1 rounded-full border " + badgeClass(it.condition)}>
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
                      <div className="mt-8 border-t pt-2">Signature</div>
                    </div>
                    <div>
                      <div className="text-neutral-600">Landlord / Agent</div>
                      <div className="mt-8 border-t pt-2">Signature</div>
                    </div>
                  </div>

                  <div className="mt-6 text-xs text-neutral-500">
                    Storage keys: <span className="font-mono">{KEY}</span> • <span className="font-mono">{PROFILE_KEY}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Footer link */}
        <div className="mt-6 text-sm text-neutral-600 print:hidden">
          <a className="underline hover:text-neutral-900" href={HUB_URL} target="_blank" rel="noreferrer">
            Return to ToolStack hub
          </a>
        </div>
      </div>
    </div>
  );
}
