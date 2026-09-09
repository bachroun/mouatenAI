import React, { useState, useEffect, useRef, useCallback } from "react";
import { Camera, MapPin, Sparkles, X, Plus, Clock, Loader2, ImageOff, Users } from "lucide-react";
import { supabase } from "./supabaseClient";

/* ---------- Design tokens (Horizon Tunisie) ----------
  Ink:         #241C15
  Sand (bg):   #F5F0E6
  Card:        #FFFDF8
  Horizon green (header): #1F5D3D
  Gold accent: #C9A227
  Clean green: #2C7A4B
  Amber:       #D98E2B
  Alert red:   #A32638
------------------------------------- */

const STATUS = {
  DIRTY: "dirty",
  PARTIAL: "partial",
  CLEAN: "clean",
};

const STATUS_META = {
  [STATUS.DIRTY]: { label: "Pas encore nettoyé", color: "#A32638", bg: "#FBEAEC" },
  [STATUS.PARTIAL]: { label: "Partiellement nettoyé", color: "#B5701F", bg: "#FBF1E1" },
  [STATUS.CLEAN]: { label: "Nettoyé", color: "#2F5F44", bg: "#E9F2EA" },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function resizeImage(dataUrl, maxWidth = 900) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width);
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

// Simulation locale d'un aperçu "nettoyé" — pas une retouche IA générative réelle.
function generateCleanPreview(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.filter = "brightness(1.12) contrast(1.08) saturate(1.15)";
      ctx.drawImage(img, 0, 0);
      ctx.filter = "none";
      const grad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width * 0.2,
        canvas.width / 2, canvas.height / 2, canvas.width * 0.75
      );
      grad.addColorStop(0, "rgba(255,255,255,0)");
      grad.addColorStop(1, "rgba(36,28,21,0.14)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = dataUrl;
  });
}

function StatusPills({ current, onChange, size = "sm" }) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div className="flex flex-wrap gap-1.5">
      {Object.entries(STATUS_META).map(([key, meta]) => {
        const active = current === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={`${pad} rounded-full border font-medium transition-colors`}
            style={
              active
                ? { backgroundColor: meta.color, borderColor: meta.color, color: "#FFFDF8" }
                : { backgroundColor: meta.bg, borderColor: meta.bg, color: meta.color }
            }
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

function ReportCard({ report, onStatusChange }) {
  const meta = STATUS_META[report.status];
  return (
    <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: "#FFFDF8", borderColor: "#E4D7B8" }}>
      <div className="grid grid-cols-2">
        <div className="relative">
          <img src={report.photo_before} alt="Avant" className="w-full h-40 object-cover" />
          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "rgba(36,28,21,0.7)", color: "#FFFDF8" }}>
            Avant
          </span>
        </div>
        <div className="relative">
          <img src={report.photo_after} alt="Aperçu propre" className="w-full h-40 object-cover" />
          <span className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1" style={{ backgroundColor: "rgba(63,122,85,0.85)", color: "#FFFDF8" }}>
            <Sparkles size={10} /> Aperçu IA
          </span>
        </div>
      </div>

      <div className="p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-sm" style={{ color: "#5C5041" }}>
          <MapPin size={14} style={{ color: "#1F5D3D" }} />
          <span className="truncate">{report.location_label}</span>
        </div>

        {report.description && (
          <p className="text-sm leading-snug" style={{ color: "#241C15" }}>{report.description}</p>
        )}

        <div className="flex items-center justify-between text-xs" style={{ color: "#8A7C64" }}>
          <span className="flex items-center gap-1"><Clock size={12} /> {timeAgo(report.created_at)}</span>
          <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: meta.bg, color: meta.color }}>
            {meta.label}
          </span>
        </div>

        <div className="pt-1">
          <StatusPills current={report.status} onChange={(s) => onStatusChange(report.id, s)} />
        </div>
      </div>
    </div>
  );
}

function NewReportSheet({ onClose, onPublish }) {
  const fileRef = useRef(null);
  const [photoRaw, setPhotoRaw] = useState(null);
  const [photoAfter, setPhotoAfter] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const resized = await resizeImage(reader.result);
      setPhotoRaw(resized);
      setPhotoAfter(null);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!photoRaw) return;
    setGenerating(true);
    const preview = await generateCleanPreview(photoRaw);
    setPhotoAfter(preview);
    setGenerating(false);
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setLocationLabel((v) => v || "Position indisponible — décrivez le lieu");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ lat: latitude, lng: longitude });
        setLocationLabel((v) => v || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
        setLocating(false);
      },
      () => {
        setLocationLabel((v) => v || "Position refusée — décrivez le lieu");
        setLocating(false);
      },
      { timeout: 8000 }
    );
  };

  const canPublish = photoRaw && locationLabel.trim().length > 0 && !publishing;

  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center" style={{ backgroundColor: "rgba(36,28,21,0.45)" }}>
      <div className="w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto" style={{ backgroundColor: "#F5F0E6" }}>
        <div className="flex items-center justify-between px-4 pt-4 pb-2 sticky top-0" style={{ backgroundColor: "#F5F0E6" }}>
          <h2 className="text-lg font-semibold" style={{ color: "#241C15", fontFamily: "Georgia, 'Times New Roman', serif" }}>
            Nouveau signalement
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full" style={{ color: "#5C5041" }}>
            <X size={20} />
          </button>
        </div>

        <div className="px-4 pb-6 space-y-4">
          <div>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            {!photoRaw ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2"
                style={{ borderColor: "#C9BB99", color: "#5C5041" }}
              >
                <Camera size={26} />
                <span className="text-sm font-medium">Prendre ou choisir une photo</span>
              </button>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <img src={photoRaw} alt="Avant" className="w-full h-32 object-cover rounded-lg" />
                    <p className="text-[11px] text-center mt-1" style={{ color: "#8A7C64" }}>Avant</p>
                  </div>
                  <div>
                    {photoAfter ? (
                      <img src={photoAfter} alt="Aperçu propre" className="w-full h-32 object-cover rounded-lg" />
                    ) : (
                      <div className="w-full h-32 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#E4D7B8" }}>
                        {generating ? (
                          <Loader2 size={20} className="animate-spin" style={{ color: "#1F5D3D" }} />
                        ) : (
                          <ImageOff size={20} style={{ color: "#B3A585" }} />
                        )}
                      </div>
                    )}
                    <p className="text-[11px] text-center mt-1" style={{ color: "#8A7C64" }}>Aperçu IA</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 text-sm font-medium rounded-lg py-2 flex items-center justify-center gap-1.5"
                    style={{ backgroundColor: "#1F5D3D", color: "#F5F0E6" }}
                  >
                    <Sparkles size={15} />
                    {photoAfter ? "Régénérer l'aperçu" : "Générer un aperçu propre"}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="text-sm font-medium rounded-lg px-3 py-2"
                    style={{ backgroundColor: "#E4D7B8", color: "#241C15" }}
                  >
                    Changer
                  </button>
                </div>
                <p className="text-[11px] leading-snug" style={{ color: "#8A7C64" }}>
                  Cet aperçu est une simulation visuelle générée localement, pas une retouche IA générative réelle — utile pour visualiser l'objectif, pas comme preuve.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                value={locationLabel}
                onChange={(e) => setLocationLabel(e.target.value)}
                placeholder="Lieu (rue, quartier...)"
                className="flex-1 text-sm rounded-lg px-3 py-2 border outline-none"
                style={{ borderColor: "#D8CBA8", backgroundColor: "#FFFDF8", color: "#241C15" }}
              />
              <button
                onClick={handleLocate}
                className="rounded-lg px-3 flex items-center gap-1.5 text-sm font-medium"
                style={{ backgroundColor: "#E4D7B8", color: "#241C15" }}
              >
                {locating ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
                GPS
              </button>
            </div>
            {coords && (
              <p className="text-[11px]" style={{ color: "#8A7C64" }}>
                Position captée : {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}
          </div>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez le dépôt (type de déchets, urgence...)"
            rows={3}
            className="w-full text-sm rounded-lg px-3 py-2 border outline-none resize-none"
            style={{ borderColor: "#D8CBA8", backgroundColor: "#FFFDF8", color: "#241C15" }}
          />

          <button
            disabled={!canPublish}
            onClick={async () => {
              setPublishing(true);
              await onPublish({
                photo_before: photoRaw,
                photo_after: photoAfter || photoRaw,
                location_label: locationLabel.trim(),
                lat: coords?.lat ?? null,
                lng: coords?.lng ?? null,
                description: description.trim(),
              });
              setPublishing(false);
            }}
            className="w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              backgroundColor: canPublish ? "#C9A227" : "#E4D8B8",
              color: "#241C15",
            }}
          >
            {publishing && <Loader2 size={15} className="animate-spin" />}
            Publier dans la communauté
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (err) {
      setError("Impossible de charger les signalements. Vérifiez la configuration Supabase.");
    } else {
      setReports(data || []);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadReports();

    // Rafraîchissement en temps réel : les autres utilisateurs voient les nouveaux
    // signalements et changements de statut sans recharger la page.
    const channel = supabase
      .channel("reports-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
        loadReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadReports]);

  const handlePublish = async (data) => {
    const id = uid();
    const now = Date.now();
    const { error: err } = await supabase.from("reports").insert({
      id,
      ...data,
      status: STATUS.DIRTY,
      created_at: now,
      updated_at: now,
    });
    if (err) {
      setError("La publication a échoué. Réessayez.");
    } else {
      setShowNew(false);
      loadReports();
    }
  };

  const handleStatusChange = async (id, status) => {
    setReports((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    const { error: err } = await supabase
      .from("reports")
      .update({ status, updated_at: Date.now() })
      .eq("id", id);
    if (err) setError("La mise à jour du statut n'a pas pu être enregistrée.");
  };

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#F5F0E6", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="sticky top-0 z-10 px-4 pt-4 pb-3" style={{ backgroundColor: "#1F5D3D" }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "#F5F0E6", fontFamily: "Georgia, 'Times New Roman', serif" }}>
              MouwatenAI
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "#BFE0CC" }}>Horizon Tunisie — Signaler un lieu, mobiliser le quartier</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold"
            style={{ backgroundColor: "#C9A227", color: "#241C15" }}
          >
            <Plus size={16} />
            Signaler
          </button>
        </div>

        <div className="flex gap-1.5 mt-3 overflow-x-auto pb-0.5">
          {[
            { key: "all", label: "Tous" },
            { key: STATUS.DIRTY, label: STATUS_META[STATUS.DIRTY].label },
            { key: STATUS.PARTIAL, label: STATUS_META[STATUS.PARTIAL].label },
            { key: STATUS.CLEAN, label: STATUS_META[STATUS.CLEAN].label },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className="whitespace-nowrap text-xs font-medium px-3 py-1.5 rounded-full border"
              style={
                filter === f.key
                  ? { backgroundColor: "#F5F0E6", color: "#1F5D3D", borderColor: "#F5F0E6" }
                  : { backgroundColor: "transparent", color: "#BFE0CC", borderColor: "#3E8A63" }
              }
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-3">
        <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: "#EAE0C4", color: "#6B5D45" }}>
          <Users size={14} className="mt-0.5 shrink-0" />
          <span>Les signalements, photos et statuts sont visibles par tous les utilisateurs de l'application.</span>
        </div>
      </div>

      {error && (
        <div className="mx-4 mt-2 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: "#FBEAEC", color: "#A32638" }}>
          {error}
        </div>
      )}

      <div className="px-4 py-4 space-y-3 max-w-md mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2" style={{ color: "#8A7C64" }}>
            <Loader2 size={22} className="animate-spin" />
            <span className="text-sm">Chargement des signalements...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-center px-6" style={{ color: "#8A7C64" }}>
            <ImageOff size={26} />
            <p className="text-sm">
              {reports.length === 0
                ? "Aucun signalement pour l'instant. Soyez le premier à signaler un lieu à nettoyer."
                : "Aucun signalement dans cette catégorie."}
            </p>
          </div>
        ) : (
          filtered.map((r) => <ReportCard key={r.id} report={r} onStatusChange={handleStatusChange} />)
        )}
      </div>

      {showNew && <NewReportSheet onClose={() => setShowNew(false)} onPublish={handlePublish} />}
    </div>
  );
}
