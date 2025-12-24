// Inspect-It (ToolStack) — module-ready MVP
// Purpose: Move-in / move-out inspection checklist with condition + notes + evidence refs
// Paste into: src/App.jsx
// Requires: Tailwind v4 configured (same as other ToolStack apps).

import React, { useEffect, useMemo, useRef, useState } from "react";

const APP_ID = "inspectit";
const APP_VERSION = "v1";
const KEY = `toolstack.${APP_ID}.${APP_VERSION}`;
const PROFILE_KEY = "toolstack.profile.v1";

// Optional: set later
const HUB_URL = "https://YOUR-WIX-HUB-URL-HERE";

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
  return (crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

function loadProfile() {
  return (
    safeParse(localStorage.getItem(PROFILE_KEY), null) || {
      org: "ToolStack",
      user: "",
      language: "EN",
      logo: "",
    }
  );
}

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
      mkSection("Entrance / Hall", [
        "Door & lock",
        "Walls/paint",
        "Flooring",
        "Lights/switches",
      ]),
      mkSection("Living / Bedroom", [
        "Walls/paint",
        "Flooring",
        "Windows/frames",
        "Heating/radiator",
        "Curtains/blinds",
      ]),
      mkSection("Kitchen", [
        "Cabinets/countertop",
        "Sink & taps",
        "Appliances (if included)",
        "Tiles/splashback",
        "Ventilation",
      ]),
      mkSection("Bathroom", [
        "Bath/shower",
        "Tiles/grout",
        "Toilet",
        "Sink & taps",
        "Ventilation",
      ]),
      mkSection("Utilities / Electrical", [
        "Sockets",
        "Light fixtures",
        "Water shutoff",
        "Smoke detector",
      ]),
      mkSection("Windows / Exterior", [
        "Windows open/close",
        "Seals",
        "Balcony/terrace (if any)",
        "Mailbox/keys",
      ]),
    ],
  };
}

function loadState() {
  return (
    safeParse(localStorage.getItem(KEY), null) || {
      meta: { appId: APP_ID, version: APP_VERSION, updatedAt: new Date().toISOString() },
      template: defaultTemplate(),
      inspections: [],
    }
  );
}

function saveState(state) {
  const next = {
    ...state,
    meta: { ...state.meta, updatedAt: new Date().toISOString() },
  };
  localStorage.setItem(KEY, JSON.stringify(next));
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
      return "bg-red-100 text-red-800 border-red-200";
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

export default function App() {
  const [profile, setProfile] = useState(loadProfile());
  const [state, setState] = useState(loadState());

  const [date, setDate] = useState(isoToday());
  const [inspectionType, setInspectionType] = useState("move-in"); // move-in | move-out | periodic
  const [propertyLabel, setPropertyLabel] = useState("");
  const [address, setAddress] = useState("");
  const [occupants, setOccupants] = useState("");
  const [notes, setNotes] = useState("");

  const [previewOpen, setPreviewOpen] = useState(false);
  const importRef = useRef(null);

  // Persist profile
  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  // Persist state
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);

  // Draft inspection
  const [draft, setDraft] = useState(() => {
    const t = state.template;
    return {
      date,
      inspectionType,
      propertyLabel: "",
      address: "",
      occupants: "",
      notes: "",
      sections: t.sections.map((s) => ({
        id: s.id,
        title: s.title,
        items: s.items.map((it) => ({
          id: it.id,
          label: it.label,
          condition: "ok",
          note: "",
          evidenceRef: "",
        })),
      })),
    };
  });

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
    for (const s of draft.sections) {
      for (const it of s.items) {
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
      sections: d.sections.map((s) =>
        s.id !== sectionId
          ? s
          : {
              ...s,
              items: s.items.map((it) => (it.id !== itemId ? it : { ...it, ...patch })),
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
      sections: t.sections.map((s) => ({
        id: s.id,
        title: s.title,
        items: s.items.map((it) => ({
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
    setState((prev) => saveState({ ...prev, inspections: (prev.inspections || []).filter((x) => x.id !== id) }));
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
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result || ""));
        const incoming = parsed?.data;
        if (!incoming?.template || !Array.isArray(incoming?.inspections)) throw new Error("Invalid import file");
        setProfile(parsed?.profile || profile);
        setState(saveState(incoming));
        resetDraft();
      } catch (e) {
        alert("Import failed: " + (e?.message || "unknown error"));
      }
    };
    reader.readAsText(file);
  }

  function printPreview() {
    setPreviewOpen(true);
    setTimeout(() => window.print(), 50);
  }

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

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">Inspect-It</div>
            <div className="text-sm text-neutral-600">
              Module-ready ({moduleManifest.id}.{moduleManifest.version}) • Condition log • Evidence refs • Print/export
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={() => setPreviewOpen(true)}
            >
              Preview
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={printPreview}
            >
              Print / Save PDF
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={exportJSON}
            >
              Export
            </button>
            <button
              className="px-3 py-2 rounded-xl bg-white border border-neutral-200 shadow-sm hover:bg-neutral-50"
              onClick={() => importRef.current?.click()}
            >
              Import
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importJSON(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Profile */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
            <div className="font-semibold">Profile (shared)</div>
            <div className="mt-3 space-y-2">
              <label className="block text-sm">
                <div className="text-neutral-600">Organization</div>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={profile.org}
                  onChange={(e) => setProfile({ ...profile, org: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <div className="text-neutral-600">User</div>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={profile.user}
                  onChange={(e) => setProfile({ ...profile, user: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <div className="text-neutral-600">Language</div>
                <select
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white"
                  value={profile.language}
                  onChange={(e) => setProfile({ ...profile, language: e.target.value })}
                >
                  <option value="EN">EN</option>
                  <option value="DE">DE</option>
                </select>
              </label>
              <div className="pt-2 text-xs text-neutral-500">
                Stored at <span className="font-mono">{PROFILE_KEY}</span>
              </div>
            </div>
          </div>

          {/* Draft */}
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
                  <input
                    type="date"
                    className="mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  <div className="text-neutral-600">Type</div>
                  <select
                    className="mt-1 px-3 py-2 rounded-xl border border-neutral-200 bg-white"
                    value={inspectionType}
                    onChange={(e) => setInspectionType(e.target.value)}
                  >
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
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={propertyLabel}
                  onChange={(e) => setPropertyLabel(e.target.value)}
                  placeholder="e.g., Room 3 / Flat A"
                />
              </label>
              <label className="text-sm">
                <div className="text-neutral-600">Occupant(s)</div>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={occupants}
                  onChange={(e) => setOccupants(e.target.value)}
                  placeholder="Names"
                />
              </label>
              <label className="text-sm md:col-span-2">
                <div className="text-neutral-600">Address</div>
                <input
                  className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City"
                />
              </label>
            </div>

            <label className="block text-sm mt-3">
              <div className="text-neutral-600">General notes</div>
              <textarea
                className="w-full mt-1 px-3 py-2 rounded-xl border border-neutral-200 min-h-[90px]"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Context: keys received, meter readings, agreements, etc."
              />
            </label>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {draft.sections.map((s) => (
                <div key={s.id} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                  <div className="font-semibold">{s.title}</div>
                  <div className="mt-2 space-y-2">
                    {s.items.map((it) => (
                      <div key={it.id} className="rounded-xl bg-white border border-neutral-200 p-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-medium">{it.label}</div>
                          <div className="flex items-center gap-2">
                            <span className={"text-xs px-2 py-1 rounded-full border " + badgeClass(it.condition)}>
                              {CONDITION_OPTIONS.find((o) => o.key === it.condition)?.label || "OK"}
                            </span>
                            <select
                              className="text-sm px-2 py-1 rounded-xl border border-neutral-200 bg-white"
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
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm"
                            placeholder="Note (what you see)"
                            value={it.note}
                            onChange={(e) => updateItem(s.id, it.id, { note: e.target.value })}
                          />
                          <input
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm"
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
              <button
                className="px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50"
                onClick={resetDraft}
              >
                Reset
              </button>

              <button
                className="px-4 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800"
                onClick={saveInspection}
              >
                Save inspection
              </button>
            </div>
          </div>
        </div>

        {/* Saved inspections */}
        <div className="mt-4 bg-white border border-neutral-200 rounded-2xl shadow-sm p-4">
          <div className="font-semibold">Saved inspections</div>
          {state.inspections.length === 0 ? (
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
                  {state.inspections.map((x) => (
                    <tr key={x.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2 font-medium">{x.date}</td>
                      <td className="py-2 pr-2">{x.inspectionType}</td>
                      <td className="py-2 pr-2">{x.propertyLabel || x.address || "-"}</td>
                      <td className="py-2 pr-2">
                        <span className={"text-xs px-2 py-1 rounded-full border " + (x.summary?.damaged ? "bg-red-100 text-red-800 border-red-200" : "bg-emerald-100 text-emerald-800 border-emerald-200")}>
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
        {previewOpen && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-3 z-50">
            <div className="w-full max-w-5xl bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
              <div className="p-3 border-b flex items-center justify-between">
                <div className="font-semibold">Preview — Inspection Report</div>
                <div className="flex gap-2">
                  <button
                    className="px-3 py-2 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50"
                    onClick={printPreview}
                  >
                    Print / Save PDF
                  </button>
                  <button
                    className="px-3 py-2 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800"
                    onClick={() => setPreviewOpen(false)}
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-auto max-h-[80vh]">
                <div className="text-xl font-bold">{profile.org || "ToolStack"}</div>
                <div className="text-sm text-neutral-600">Inspection Report</div>

                <div className="mt-2 text-sm">
                  <div><span className="text-neutral-600">Prepared by:</span> {profile.user || "-"}</div>
                  <div><span className="text-neutral-600">Date:</span> {date}</div>
                  <div><span className="text-neutral-600">Type:</span> {inspectionType}</div>
                  <div><span className="text-neutral-600">Property:</span> {propertyLabel || "-"}</div>
                  <div><span className="text-neutral-600">Address:</span> {address || "-"}</div>
                  <div><span className="text-neutral-600">Occupants:</span> {occupants || "-"}</div>
                  <div><span className="text-neutral-600">Generated:</span> {new Date().toLocaleString()}</div>
                </div>

                {notes && (
                  <div className="mt-4 text-sm">
                    <div className="font-semibold">General notes</div>
                    <div className="text-neutral-700 whitespace-pre-wrap">{notes}</div>
                  </div>
                )}

                <div className="mt-4 rounded-2xl border border-neutral-200 p-3 text-sm">
                  <div className="font-semibold">Summary</div>
                  <div className="mt-1 text-neutral-700">
                    Items: {totals.total} • Damaged: {totals.damaged} • Worn: {totals.worn} • Missing: {totals.missing}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {draft.sections.map((s) => (
                    <div key={s.id} className="rounded-2xl border border-neutral-200 p-3">
                      <div className="font-semibold">{s.title}</div>
                      <div className="mt-2 space-y-2">
                        {s.items.map((it) => (
                          <div key={it.id} className="text-sm flex items-start justify-between gap-3 border-t pt-2 first:border-t-0 first:pt-0">
                            <div>
                              <div className="font-medium">{it.label}</div>
                              {it.note && <div className="text-neutral-600">{it.note}</div>}
                              {it.evidenceRef && <div className="text-neutral-600">Evidence: {it.evidenceRef}</div>}
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
                  Storage key: <span className="font-mono">{KEY}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 text-sm text-neutral-600">
          <a className="underline hover:text-neutral-900" href={HUB_URL} target="_blank" rel="noreferrer">
            Return to ToolStack hub
          </a>
        </div>
      </div>
    </div>
  );
}
