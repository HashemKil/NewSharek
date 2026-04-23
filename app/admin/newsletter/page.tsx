"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type CarouselItem = {
  label: string;
  title: string;
  body: string;
  image: string;
  url: string | null;
};

const EMPTY_ITEM: CarouselItem = {
  label: "",
  title: "",
  body: "",
  image: "",
  url: "",
};

const inputCls =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#1e3a8a] focus:bg-white focus:ring-2 focus:ring-[#1e3a8a]/10";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
      {children}
    </label>
  );
}

function AlertBox({
  type,
  children,
}: {
  type: "error" | "success";
  children: React.ReactNode;
}) {
  const cls =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-600"
      : "border-green-200 bg-green-50 text-green-700";
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>
      {children}
    </div>
  );
}

export default function AdminNewsletterPage() {
  const [items, setItems] = useState<CarouselItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CarouselItem>(EMPTY_ITEM);
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState<CarouselItem>(EMPTY_ITEM);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_carousel")
        .single();

      if (!err && data?.value) {
        setItems(data.value as CarouselItem[]);
      }
      setLoading(false);
    };
    load();
  }, []);

  // ── Persist helper ────────────────────────────────────────────────────────
  const persist = async (next: CarouselItem[]) => {
    setSaving(true);
    setError("");
    setSuccess("");
    const { error: err } = await supabase
      .from("site_settings")
      .upsert({ key: "homepage_carousel", value: next, updated_at: new Date().toISOString() });

    if (err) {
      setError(err.message);
    } else {
      setItems(next);
      setSuccess("Carousel updated successfully.");
      setTimeout(() => setSuccess(""), 3000);
    }
    setSaving(false);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDelete = (idx: number) => {
    const next = items.filter((_, i) => i !== idx);
    persist(next);
  };

  const handleMove = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    persist(next);
  };

  const startEdit = (idx: number) => {
    setEditIndex(idx);
    setEditForm({ ...items[idx] });
  };

  const handleSaveEdit = () => {
    if (editIndex === null) return;
    const next = items.map((item, i) =>
      i === editIndex ? { ...editForm, url: editForm.url || null } : item
    );
    persist(next).then(() => setEditIndex(null));
  };

  const handleAdd = () => {
    const next = [
      ...items,
      { ...addForm, url: addForm.url || null },
    ];
    persist(next).then(() => {
      setShowAdd(false);
      setAddForm(EMPTY_ITEM);
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-6 py-8 lg:px-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Newsletter / Carousel
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage the hero carousel shown on the homepage.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[#1e3a8a] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1e40af] disabled:opacity-60"
        >
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add slide
        </button>
      </div>

      {error && <AlertBox type="error">{error}</AlertBox>}
      {success && (
        <div className="mb-4">
          <AlertBox type="success">{success}</AlertBox>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-slate-200" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <svg width="36" height="36" fill="none" stroke="#94a3b8" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
          <p className="text-sm font-medium text-slate-500">No carousel slides yet.</p>
          <p className="text-xs text-slate-400">Click "Add slide" to create the first one.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              {/* Edit mode */}
              {editIndex === idx ? (
                <div className="p-6">
                  <p className="mb-4 text-sm font-semibold text-slate-700">
                    Editing slide {idx + 1}
                  </p>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Label (badge text)</Label>
                      <input
                        type="text"
                        value={editForm.label}
                        onChange={(e) =>
                          setEditForm({ ...editForm, label: e.target.value })
                        }
                        placeholder="e.g. Club updates"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <Label>Link URL (optional)</Label>
                      <input
                        type="url"
                        value={editForm.url ?? ""}
                        onChange={(e) =>
                          setEditForm({ ...editForm, url: e.target.value })
                        }
                        placeholder="https://..."
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Title</Label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) =>
                          setEditForm({ ...editForm, title: e.target.value })
                        }
                        placeholder="Slide headline"
                        className={inputCls}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Body text</Label>
                      <textarea
                        rows={3}
                        value={editForm.body}
                        onChange={(e) =>
                          setEditForm({ ...editForm, body: e.target.value })
                        }
                        placeholder="Short description shown below the title"
                        className={`${inputCls} resize-none`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Background image URL</Label>
                      <input
                        type="url"
                        value={editForm.image}
                        onChange={(e) =>
                          setEditForm({ ...editForm, image: e.target.value })
                        }
                        placeholder="https://images.unsplash.com/..."
                        className={inputCls}
                      />
                      {editForm.image && (
                        <div
                          className="mt-2 h-24 w-full rounded-xl bg-cover bg-center"
                          style={{ backgroundImage: `url(${editForm.image})` }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      onClick={() => setEditIndex(null)}
                      className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-start gap-4 p-5">
                  {/* Preview thumbnail */}
                  <div
                    className="h-20 w-32 flex-shrink-0 rounded-xl bg-cover bg-center bg-slate-200"
                    style={
                      item.image ? { backgroundImage: `url(${item.image})` } : {}
                    }
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eef3ff] px-2.5 py-0.5 text-xs font-semibold text-[#1e3a8a]">
                        {item.label || "No label"}
                      </span>
                      <span className="text-xs text-slate-400">
                        Slide {idx + 1} of {items.length}
                      </span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900 truncate">
                      {item.title || "No title"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                      {item.body || "No body text"}
                    </p>
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 block text-xs text-[#1e3a8a] hover:underline truncate"
                      >
                        {item.url}
                      </a>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button
                      onClick={() => handleMove(idx, -1)}
                      disabled={idx === 0 || saving}
                      title="Move up"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M18 15l-6-6-6 6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleMove(idx, 1)}
                      disabled={idx === items.length - 1 || saving}
                      title="Move down"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    <button
                      onClick={() => startEdit(idx)}
                      title="Edit"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-[#1e3a8a]"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(idx)}
                      disabled={saving}
                      title="Delete"
                      className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                    >
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6M14 11v6M9 6V4h6v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add slide panel */}
      {showAdd && (
        <div className="mt-6 rounded-2xl border border-[#1e3a8a]/20 bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm font-semibold text-slate-700">New slide</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Label (badge text)</Label>
              <input
                type="text"
                value={addForm.label}
                onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
                placeholder="e.g. Club updates"
                className={inputCls}
              />
            </div>
            <div>
              <Label>Link URL (optional)</Label>
              <input
                type="url"
                value={addForm.url ?? ""}
                onChange={(e) => setAddForm({ ...addForm, url: e.target.value })}
                placeholder="https://..."
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Title</Label>
              <input
                type="text"
                value={addForm.title}
                onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                placeholder="Slide headline"
                className={inputCls}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Body text</Label>
              <textarea
                rows={3}
                value={addForm.body}
                onChange={(e) => setAddForm({ ...addForm, body: e.target.value })}
                placeholder="Short description"
                className={`${inputCls} resize-none`}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Background image URL</Label>
              <input
                type="url"
                value={addForm.image}
                onChange={(e) => setAddForm({ ...addForm, image: e.target.value })}
                placeholder="https://images.unsplash.com/..."
                className={inputCls}
              />
              {addForm.image && (
                <div
                  className="mt-2 h-24 w-full rounded-xl bg-cover bg-center"
                  style={{ backgroundImage: `url(${addForm.image})` }}
                />
              )}
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleAdd}
              disabled={saving || !addForm.title}
              className="rounded-xl bg-[#1e3a8a] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1e40af] disabled:opacity-60"
            >
              {saving ? "Adding…" : "Add slide"}
            </button>
            <button
              onClick={() => { setShowAdd(false); setAddForm(EMPTY_ITEM); }}
              className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
