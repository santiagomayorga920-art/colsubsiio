import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  User, Lock, Mail, Phone, CreditCard, Calendar,
  Eye, EyeOff, Zap, ShieldCheck, RefreshCw, AlertCircle,
  Waves, Zap as ZapIcon, Map, UtensilsCrossed, Ticket,
  LogOut, Star, Clock, Users, X, QrCode, CheckCircle2,
  Wind, Droplets, TreePine, Tornado, Navigation,
  BadgeCheck, CreditCard as CardIcon, ChevronRight, Lock as LockIcon,
  MessageCircle, Send,
  MapPin, HelpCircle, ArrowLeft, Minus, Plus, ShoppingCart,
  ZoomIn, ZoomOut, Timer, Utensils, Toilet,
  UserCircle2
} from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COOLDOWN_MS       = 2 * 60 * 60 * 1000;
const GROUP_COOLDOWN_MS = 45 * 60 * 1000;
const VERIFY_CODE = "123456";
const FAST_PASS_PRICES = { nonAffiliate: 120000, A: 35000, B: 55000, C: 85000 };

const ATTRACTIONS = [
  { id: "megatobogan",   name: "Megatobogán",        icon: "megatobogan",  waitMin: 8,  waitMax: 25, time: "~3 min",  color: "#f97316", bg: "#fff7ed", minAge: 12, capacity: 6 },
  { id: "bosque-lluvia", name: "Bosque de la Lluvia", icon: "bosque",       waitMin: 5,  waitMax: 20, time: "~15 min", color: "#16a34a", bg: "#f0fdf4", minAge:  5, capacity: 10 },
  { id: "piscina-olas",  name: "Piscina de Olas",     icon: "piscina",      waitMin: 10, waitMax: 40, time: "~20 min", color: "#0284c7", bg: "#f0f9ff", minAge:  3, capacity:  8 },
  { id: "tornado",       name: "El Tornado",           icon: "tornado",      waitMin: 6,  waitMax: 30, time: "~5 min",  color: "#7c3aed", bg: "#faf5ff", minAge: 14, capacity:  4 },
  { id: "rio-lento",     name: "Río Lento",            icon: "rio",          waitMin: 2,  waitMax: 15, time: "~25 min", color: "#0891b2", bg: "#ecfeff", minAge:  5, capacity:  8 },
];

const RESTAURANTS = [
  {
    id: "cascada", name: "La Cascada",  desc: "Snacks, helados y bebidas",
    items: [
      { id: "c1", name: "Helado Artesanal",     price: 8500 },
      { id: "c2", name: "Empanadas (x3)",        price: 11000 },
      { id: "c3", name: "Jugo Natural Grande",   price: 9000 },
      { id: "c4", name: "Malteada Tropical",     price: 13500 },
    ],
  },
  {
    id: "rancho", name: "El Rancho", desc: "Parrilla y carnes a la brasa",
    items: [
      { id: "r1", name: "Bandeja Paisa",         price: 28000 },
      { id: "r2", name: "Costillas BBQ",         price: 35000 },
      { id: "r3", name: "Chorizo con Arepa",     price: 16500 },
      { id: "r4", name: "Chicharrón Especial",   price: 18000 },
    ],
  },
  {
    id: "pizzalago", name: "PizzaLago", desc: "Pizzas artesanales y pastas",
    items: [
      { id: "p1", name: "Pizza Pepperoni",       price: 24000 },
      { id: "p2", name: "Pasta Bolognesa",       price: 19000 },
      { id: "p3", name: "Pan de Ajo",            price: 7500 },
    ],
  },
];

const FP_MATRIX = {
  "10-12": { megatobogan: "A", tornado: "A", "bosque-lluvia": "B", "rio-lento": "B", "piscina-olas": "C" },
  "12-14": { megatobogan: "B", tornado: "B", "bosque-lluvia": "C", "rio-lento": "C", "piscina-olas": "A" },
  "14-16": { megatobogan: "C", tornado: "C", "bosque-lluvia": "A", "rio-lento": "A", "piscina-olas": "B" },
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmtCountdown = (ms) => {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => String(n).padStart(2, "0")).join(":");
};
const fmtCOP = (n) => `$${n.toLocaleString("es-CO")}`;
const calcAge = (dob) => {
  if (!dob) return null;
  const birth = new Date(dob), today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() - birth.getMonth() < 0 ||
     (today.getMonth() - birth.getMonth() === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};
const getFPCategory = (cedula) => {
  const n = parseInt(cedula.replace(/\D/g, ""), 10);
  if (isNaN(n) || cedula.replace(/\D/g, "").length < 8) return null;
  if (n % 2 === 0) return "A";
  return n < 50000000 ? "B" : "C";
};
const getTimeSlot = () => {
  const h = new Date().getHours();
  if (h >= 10 && h < 12) return "10-12";
  if (h >= 12 && h < 14) return "12-14";
  if (h >= 14 && h < 16) return "14-16";
  return null;
};
const randWait = () => Math.floor(Math.random() * 35) + 3;
const genCode  = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
const isCooldownFree = (cooldownUntil) => !cooldownUntil || Date.now() >= cooldownUntil;
const mkCompanion = ({ name, age }) => ({
  id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  name,
  age: Number(age),
  avatarInitial: name.trim().charAt(0).toUpperCase(),
  cooldownUntil: null,
  status: "available",          // "available" | "cooldown" | "inUse"
});
const getFPAccessible = (category) => {
  const slot = getTimeSlot();
  if (!slot || !category || category === "nonAffiliate") return [];
  return Object.entries(FP_MATRIX[slot])
    .filter(([, cat]) => cat === category)
    .map(([id]) => id);
};

// ─── LOGO SVG — solo para pantallas Login/Verify ─────────────────────────────
function PiscilagoLogo({ size = "md" }) {
  const w = size === "lg" ? 200 : size === "sm" ? 110 : 150;
  return (
    <div style={{ width: w }} className="mx-auto select-none">
      <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg"
           className="w-full" style={{ aspectRatio: "240/130" }}>
        <defs>
          <path id="arcT2" d="M 28 100 A 92 92 0 0 1 212 100" />
          <path id="arcB2" d="M 22 108 A 98 98 0 0 0 218 108" />
        </defs>
        <circle cx="120" cy="72" r="108" fill="none" stroke="#1a56db" strokeWidth="2.5" />
        <text fontSize="10.5" fill="#1a56db" fontFamily="Inter,Arial,sans-serif" fontWeight="800" letterSpacing="2">
          <textPath href="#arcT2" startOffset="5%">PARQUE ACUÁTICO  y</textPath>
        </text>
        <text x="150" y="43" fontSize="11.5" fill="#1a56db" fontFamily="Inter,Arial,sans-serif" fontWeight="700" textAnchor="middle">Colsubsidio</text>
        <text x="14" y="97" fontSize="54" fill="#1a56db" fontFamily="Inter,Arial Black,Impact,sans-serif" fontWeight="900" letterSpacing="-1">PISC</text>
        <polygon points="118,40 118,67 135,67" fill="#F59E0B" />
        <polygon points="118,69 118,97 135,69" fill="#F59E0B" />
        <text x="136" y="97" fontSize="54" fill="#1a56db" fontFamily="Inter,Arial Black,Impact,sans-serif" fontWeight="900" letterSpacing="-1">LAGO</text>
        <text fontSize="10.5" fill="#1a56db" fontFamily="Inter,Arial,sans-serif" fontWeight="800" letterSpacing="2">
          <textPath href="#arcB2" startOffset="7%">DE CONSERVACIÓN</textPath>
        </text>
      </svg>
    </div>
  );
}

// ─── HEADER WORDMARK (CSS puro, sin distorsión) ──────────────────────────────
function PiscilagoWordmark() {
  return (
    <div className="select-none flex flex-col items-start">
      {/* PARQUE ACUÁTICO y Colsubsidio */}
      <p className="text-brand-300 text-[8px] font-semibold tracking-widest uppercase leading-none mb-0.5">
        Parque Acuático · <span className="text-gold-300">Colsubsidio</span>
      </p>
      {/* PISC ◆ LAGO */}
      <div className="flex items-center gap-0.5 leading-none">
        <span className="text-white font-black text-[22px] tracking-tight">PISC</span>
        {/* K / flecha dorada */}
        <svg width="12" height="26" viewBox="0 0 12 26" className="flex-shrink-0 mx-0.5">
          <polygon points="0,0 0,13 11,13" fill="#F59E0B" />
          <polygon points="0,13 0,26 11,13" fill="#F59E0B" />
        </svg>
        <span className="text-white font-black text-[22px] tracking-tight">LAGO</span>
      </div>
    </div>
  );
}

// ─── SIMULATED QR ─────────────────────────────────────────────────────────────
function SimQR({ seed = 42, size = 7 }) {
  const cells = Array.from({ length: size * size }, (_, i) => {
    const v = ((seed * 31 + i * 17 + i * i * 3) % 13);
    return v < 7;
  });
  const corners = [0,1,size,size+1, size-2,size-1,size*2-2,size*2-1,
                   size*(size-2),size*(size-2)+1,size*(size-1),size*(size-1)+1];
  corners.forEach(c => { if (c < cells.length) cells[c] = true; });
  return (
    <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {cells.map((on, i) => (
        <div key={i} className={`w-5 h-5 rounded-sm ${on ? "bg-brand-800" : "bg-white border border-brand-100"}`} />
      ))}
    </div>
  );
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ msg, type = "success", onClose }) {
  const colors = {
    success: "border-l-emerald-500 bg-white",
    error:   "border-l-red-500 bg-white",
    info:    "border-l-brand-500 bg-white",
  };
  const icons = { success: "✓", error: "✕", info: "i" };
  const iconColors = { success: "bg-emerald-500", error: "bg-red-500", info: "bg-brand-500" };
  return (
    <div className="fixed top-4 left-1/2 z-[200] animate-toast-in pointer-events-none"
         style={{ transform: "translateX(-50%)", width: "calc(100% - 32px)", maxWidth: 340 }}>
      <div className={`flex items-center gap-3 rounded-2xl border-l-4 shadow-xl px-4 py-3 ${colors[type]}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0 ${iconColors[type]}`}>
          {icons[type]}
        </div>
        <p className="text-sm font-semibold text-gray-800 flex-1">{msg}</p>
        <button onClick={onClose} className="text-gray-400 text-xs font-bold pointer-events-auto">✕</button>
      </div>
    </div>
  );
}

// ─── FIELD ────────────────────────────────────────────────────────────────────
function Field({ label, placeholder, value, onChange, error, icon: Icon, type = "text", extra }) {
  const [show, setShow] = useState(false);
  const isPass = type === "password";
  return (
    <div className="space-y-1">
      {label && <label className="text-xs font-semibold text-gray-500 tracking-wide">{label}</label>}
      <div className={`flex items-center gap-2.5 border rounded-xl px-3.5 py-3 transition-all
        ${error ? "border-red-300 bg-red-50 ring-1 ring-red-200" : "border-gray-200 bg-gray-50 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-brand-100"}`}>
        {Icon && <Icon size={15} className={error ? "text-red-400" : "text-gray-400"} strokeWidth={2} />}
        <input
          type={isPass ? (show ? "text" : "password") : type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(extra || {})}
          className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder-gray-300 font-medium"
        />
        {isPass && (
          <button type="button" onClick={() => setShow(s => !s)} className="text-gray-400">
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-1.5">
          <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
          <p className="text-red-500 text-xs font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}

// ─── TYPOGRAPHIC WORDMARK (Login / Verify header) ────────────────────────────
function LoginWordmark() {
  return (
    <div className="select-none flex flex-col items-center">
      <p className="text-brand-300 text-[10px] font-semibold tracking-[0.25em] uppercase leading-none mb-1">
        PARQUE ACUÁTICO Y
      </p>
      <h1 className="text-white font-black text-[48px] leading-none tracking-tight">
        PISCILAGO
      </h1>
      <p className="text-brand-200 text-[13px] font-medium tracking-widest mt-1 opacity-80">
        Colsubsidio
      </p>
    </div>
  );
}

// ─── DOC TYPE CONFIG ──────────────────────────────────────────────────────────
const DOC_TYPES = [
  { value: "CC",        label: "CC – Cédula de Ciudadanía" },
  { value: "TI",        label: "TI – Tarjeta de Identidad" },
  { value: "CE",        label: "CE – Cédula de Extranjería" },
  { value: "Pasaporte", label: "Pasaporte" },
];
const DOC_RULES = {
  CC:        { pattern: /^\d{6,10}$/, msg: "CC: 6–10 dígitos" },
  TI:        { pattern: /^\d{10,11}$/, msg: "TI: 10–11 dígitos" },
  CE:        { pattern: /^\d{6,7}$/, msg: "CE: 6–7 dígitos" },
  Pasaporte: { pattern: /^[A-Za-z0-9]{8,9}$/, msg: "Pasaporte: 8–9 caracteres alfanuméricos" },
};

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onSubmit }) {
  const [tab, setTab]     = useState("register");
  const [form, setForm]   = useState({ name: "", docType: "CC", doc: "", email: "", phone: "", dob: "", password: "" });
  const [errors, setErrors] = useState({});
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (tab === "register") {
      // Name: at least 2 words
      if (form.name.trim().split(/\s+/).filter(Boolean).length < 2)
        e.name = "Ingresa nombre y apellido (mínimo 2 palabras)";

      // Document: per-type rules
      const docVal = form.doc.trim();
      const rule = DOC_RULES[form.docType];
      if (!docVal) {
        e.doc = "Número de documento requerido";
      } else if (!rule.pattern.test(docVal)) {
        e.doc = rule.msg;
      }

      // Phone: exactly 10 digits, starts with 3
      const phone = form.phone.replace(/\s/g, "");
      if (!/^\d{10}$/.test(phone))
        e.phone = "Ingresa 10 dígitos (ej. 3001234567)";
      else if (!phone.startsWith("3"))
        e.phone = "El número debe comenzar con 3";

      // Date of birth
      if (!form.dob)
        e.dob = "Fecha de nacimiento requerida";
      else if (calcAge(form.dob) < 6)
        e.dob = "El visitante debe tener al menos 6 años";
    }

    // Email: strict regex
    if (!/^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(form.email))
      e.email = "Correo electrónico inválido";

    if (tab === "login" && !form.password)
      e.password = "Contraseña requerida";

    return e;
  };

  const handle = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    onSubmit({ ...form, tab });
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="relative bg-brand-900 flex-shrink-0" style={{ paddingTop: "48px", paddingBottom: "52px" }}>
        {/* Decorative circles */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-brand-700 opacity-40" />
        <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-brand-800 opacity-50" />
        <div className="absolute top-8 left-1/2 -translate-x-1/2 w-24 h-24 rounded-full bg-brand-700 opacity-20" />
        <div className="relative z-10 px-6">
          <LoginWordmark />
        </div>
      </div>

      {/* Card */}
      <div className="relative -mt-6 flex-1 mx-4 bg-white rounded-3xl shadow-xl overflow-y-auto">
        {/* Tabs */}
        <div className="flex border-b border-gray-100 mx-5 pt-5">
          {[["register", "Registrarse"], ["login", "Iniciar sesión"]].map(([t, lbl]) => (
            <button
              key={t}
              onClick={() => { setTab(t); setErrors({}); }}
              className={`flex-1 pb-3 text-sm font-semibold transition-colors
                ${tab === t ? "text-brand-600 border-b-2 border-brand-600" : "text-gray-400"}`}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="px-5 py-4 space-y-3.5 pb-8">
          {tab === "register" && (
            <>
              <Field label="Nombre completo" placeholder="Juan Pérez García" value={form.name}
                onChange={f("name")} error={errors.name} icon={User} />

              {/* Document type selector + number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 tracking-wide">Tipo de documento</label>
                <div className="flex items-center gap-2.5 border rounded-xl px-3.5 py-3 border-gray-200 bg-gray-50 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-1 focus-within:ring-brand-100 transition-all">
                  <CreditCard size={15} className="text-gray-400 flex-shrink-0" strokeWidth={2} />
                  <select
                    value={form.docType}
                    onChange={e => setForm(p => ({ ...p, docType: e.target.value, doc: "" }))}
                    className="flex-1 bg-transparent text-sm text-gray-800 outline-none font-medium appearance-none"
                  >
                    {DOC_TYPES.map(dt => (
                      <option key={dt.value} value={dt.value}>{dt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Field
                label="Número de documento"
                placeholder={
                  form.docType === "CC"        ? "6–10 dígitos" :
                  form.docType === "TI"        ? "10–11 dígitos" :
                  form.docType === "CE"        ? "6–7 dígitos" :
                  "8–9 caracteres"
                }
                value={form.doc}
                onChange={v => setForm(p => ({ ...p, doc: form.docType === "Pasaporte" ? v : v.replace(/\D/g, "") }))}
                error={errors.doc}
                icon={CreditCard}
                type={form.docType === "Pasaporte" ? "text" : "tel"}
                extra={form.docType !== "Pasaporte" ? { inputMode: "numeric" } : {}}
              />

              <Field label="Teléfono celular" placeholder="3001234567" value={form.phone}
                onChange={v => setForm(p => ({ ...p, phone: v.replace(/\D/g, "") }))}
                error={errors.phone} icon={Phone} type="tel"
                extra={{ inputMode: "numeric", maxLength: 10 }} />

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 tracking-wide">Fecha de nacimiento</label>
                <div className={`flex items-center gap-2.5 border rounded-xl px-3.5 py-3 transition-all
                  ${errors.dob ? "border-red-300 bg-red-50 ring-1 ring-red-200" : "border-gray-200 bg-gray-50 focus-within:border-brand-400 focus-within:bg-white"}`}>
                  <Calendar size={15} className={errors.dob ? "text-red-400" : "text-gray-400"} strokeWidth={2} />
                  <input type="date" value={form.dob}
                    onChange={e => setForm(p => ({ ...p, dob: e.target.value }))}
                    max={new Date().toISOString().split("T")[0]}
                    className="flex-1 bg-transparent text-sm text-gray-800 outline-none font-medium" />
                </div>
                {errors.dob && (
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={12} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-500 text-xs font-medium">{errors.dob}</p>
                  </div>
                )}
              </div>
            </>
          )}
          <Field label="Correo electrónico" placeholder="correo@ejemplo.com" value={form.email}
            onChange={f("email")} error={errors.email} icon={Mail} type="email" />
          {tab === "login" && (
            <Field label="Contraseña" placeholder="••••••••" value={form.password}
              onChange={f("password")} error={errors.password} icon={Lock} type="password" />
          )}

          <button
            onClick={handle}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold text-sm py-4 rounded-2xl shadow-lg shadow-brand-200 transition-all mt-2"
          >
            {tab === "register" ? (
              <><ShieldCheck size={16} strokeWidth={2.5} /> Crear cuenta y continuar</>
            ) : (
              <><Lock size={16} strokeWidth={2.5} /> Iniciar sesión</>
            )}
          </button>

          {tab === "register" && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
              <Zap size={14} className="text-amber-500 flex-shrink-0 mt-0.5" strokeWidth={2.5} />
              <p className="text-xs text-amber-700 font-medium leading-relaxed">
                Afiliados Colsubsidio obtienen <strong>Fast Pass desde {fmtCOP(FAST_PASS_PRICES.A)} COP</strong>
              </p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400 pb-2">
            Al continuar aceptas los{" "}
            <span className="text-brand-500 font-semibold">Términos y Condiciones</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── VERIFY SCREEN ────────────────────────────────────────────────────────────
function VerifyScreen({ pending, onVerified }) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [err, setErr]       = useState("");
  const [resent, setResent] = useState(false);
  const refs = useRef([]);

  const onChange = (i, v) => {
    if (!/^\d?$/.test(v)) return;
    const next = [...digits]; next[i] = v; setDigits(next);
    if (v && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const code = digits.join("");

  const verify = () => {
    if (code === VERIFY_CODE) {
      onVerified(pending);
    } else {
      setErr("Código incorrecto. Usa 123456 para esta demo.");
      setDigits(["", "", "", "", "", ""]);
      refs.current[0]?.focus();
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      {/* Header */}
      <div className="relative bg-brand-900 flex-shrink-0" style={{ paddingTop: "48px", paddingBottom: "52px" }}>
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-brand-700 opacity-40" />
        <div className="absolute -bottom-16 -left-10 w-40 h-40 rounded-full bg-brand-800 opacity-50" />
        <div className="relative z-10 px-6">
          <LoginWordmark />
        </div>
      </div>

      <div className="relative -mt-6 flex-1 mx-4 bg-white rounded-3xl shadow-xl overflow-y-auto px-5 py-6 space-y-5">
        {/* Icon */}
        <div className="flex flex-col items-center text-center pt-2">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mb-3">
            <ShieldCheck size={32} className="text-brand-600" strokeWidth={1.5} />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Verificación 2FA</h2>
          <p className="text-gray-500 text-sm mt-1 leading-relaxed">
            Enviamos un código de 6 dígitos a{" "}
            <strong className="text-brand-600">{pending.email}</strong>
          </p>
        </div>

        {/* OTP inputs */}
        <div className="flex justify-center gap-2">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => (refs.current[i] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => onChange(i, e.target.value)}
              onKeyDown={e => onKey(i, e)}
              className={`w-11 h-14 text-center text-2xl font-bold border-2 rounded-xl outline-none transition-all
                ${d ? "border-brand-500 bg-brand-50 text-brand-800" : "border-gray-200 bg-gray-50 text-gray-800"}
                focus:border-brand-500 focus:bg-brand-50`}
            />
          ))}
        </div>

        {err && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-3">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-xs font-medium">{err}</p>
          </div>
        )}

        {/* Demo hint */}
        <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3">
          <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-white text-xs font-black flex-shrink-0">!</div>
          <p className="text-xs text-amber-700 font-medium">
            Código de demo: <span className="font-mono font-black text-amber-900 text-sm">123456</span>
          </p>
        </div>

        <button
          onClick={verify}
          disabled={code.length < 6}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-200 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <ShieldCheck size={16} strokeWidth={2.5} /> Verificar y entrar
        </button>

        <button
          onClick={() => setResent(true)}
          className="w-full flex items-center justify-center gap-2 text-brand-500 text-sm font-semibold py-2"
        >
          <RefreshCw size={14} strokeWidth={2.5} />
          {resent ? "Código reenviado ✓" : "Reenviar código"}
        </button>
      </div>
    </div>
  );
}

// ─── TAB PLACEHOLDER ──────────────────────────────────────────────────────────
function TabPlaceholder({ icon: Icon, label }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center">
        <Icon size={28} className="text-brand-400" strokeWidth={1.5} />
      </div>
      <p className="text-sm font-semibold text-gray-500">
        <span className="text-brand-600 font-bold">{label}</span> en desarrollo
      </p>
      <p className="text-xs text-gray-400">Disponible en la próxima fase</p>
    </div>
  );
}

// ─── BOTTOM TAB BAR ───────────────────────────────────────────────────────────
const TABS = [
  { id: "atracciones", label: "Atracciones", Icon: Ticket },
  { id: "mapa",        label: "Mapa",         Icon: Map },
  { id: "comida",      label: "Comida",        Icon: UtensilsCrossed },
  { id: "fastpass",    label: "Fast Pass",     Icon: ZapIcon },
  { id: "perfil",      label: "Perfil",        Icon: UserCircle2 },
];

function BottomNav({ active, onSelect }) {
  return (
    <div className="bg-white border-t border-gray-100 flex-shrink-0"
         style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
      <div className="flex justify-around px-1 py-1.5">
        {TABS.map(({ id, label, Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all
                ${isActive ? "bg-brand-50" : "hover:bg-gray-50"}`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.8}
                className={isActive ? "text-brand-600" : "text-gray-400"}
              />
              <span className={`text-[9px] font-bold tracking-wide
                ${isActive ? "text-brand-600" : "text-gray-400"}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── DASHBOARD HEADER ─────────────────────────────────────────────────────────
function DashboardHeader({ user, fastPassActive, onLogout }) {
  const firstName = user.name.split(" ")[0];
  const initial   = firstName.charAt(0).toUpperCase();
  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? "Buenos días" : hour < 18 ? "Buenas tardes" : "Buenas noches";
  return (
    <div className="bg-brand-900 px-4 pt-7 pb-4 flex-shrink-0 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-brand-700 opacity-30 pointer-events-none" />
      <div className="absolute top-2 right-24 w-16 h-16 rounded-full bg-gold-400 opacity-10 pointer-events-none" />

      {/* Top row: wordmark + logout */}
      <div className="relative flex items-center justify-between mb-3">
        <PiscilagoWordmark />
        <button
          onClick={onLogout}
          className="flex items-center gap-1.5 text-brand-300 hover:text-white text-xs font-semibold transition-colors flex-shrink-0"
        >
          <LogOut size={13} strokeWidth={2} /> Salir
        </button>
      </div>

      {/* User card */}
      <div className="relative bg-white/10 backdrop-blur-sm rounded-2xl px-4 py-3 flex items-center gap-3">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-full bg-gold-400 flex items-center justify-center
                        font-black text-brand-900 text-lg flex-shrink-0 shadow-md">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/60 text-[11px] font-medium">{greeting}</p>
          <p className="text-white font-bold text-base truncate leading-tight">{user.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <Star size={10} className="text-gold-400" fill="#F59E0B" />
              <span className="text-gold-300 text-[10px] font-semibold">150 pts</span>
            </div>
            <span className="text-white/20 text-[10px]">•</span>
            <div className="flex items-center gap-1">
              <Clock size={10} className="text-white/50" />
              <span className="text-white/50 text-[10px]">Franja 10:00–12:00</span>
            </div>
          </div>
        </div>
        {fastPassActive && (
          <div className="bg-gold-400 text-brand-900 text-[9px] font-black px-2 py-1
                          rounded-full tracking-wide flex-shrink-0">
            ⚡ FP
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FAST PASS: POPUP ─────────────────────────────────────────────────────────
function FastPassPopup({ userName, onActivate, onDismiss }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center animate-fade-in p-0">
      <div className="bg-white w-full max-w-sm rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden">
        {/* Hero */}
        <div className="relative bg-brand-900 px-5 pt-8 pb-10 overflow-hidden text-center">
          <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-brand-700 opacity-40" />
          <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-gold-400 opacity-15" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gold-400 flex items-center justify-center mx-auto mb-3 shadow-lg">
              <ZapIcon size={28} className="text-brand-900" strokeWidth={2.5} />
            </div>
            <h2 className="text-white font-black text-2xl">Fast Pass</h2>
            <p className="text-brand-300 text-sm mt-1">Acceso prioritario · Sin filas</p>
          </div>
        </div>
        {/* Content */}
        <div className="px-5 py-5 space-y-3 -mt-5">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-4">
            <p className="font-bold text-gray-900 text-sm mb-2">
              ¡Hola, <span className="text-brand-600">{userName?.split(" ")[0]}</span>! 👋
            </p>
            <p className="text-gray-500 text-xs leading-relaxed">
              Activa el <strong>Fast Pass</strong> y salta las filas en todas las atracciones.
              Afiliados Colsubsidio desde <strong className="text-brand-600">{fmtCOP(FAST_PASS_PRICES.A)}</strong>.
            </p>
            <div className="flex gap-2 mt-3">
              {["Sin filas","Prioridad total","Todo el día"].map(b => (
                <div key={b} className="flex-1 bg-brand-50 rounded-xl py-2 text-center">
                  <p className="text-[10px] font-bold text-brand-700">{b}</p>
                </div>
              ))}
            </div>
          </div>
          <button onClick={onActivate}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-200">
            <ZapIcon size={16} strokeWidth={2.5} /> Activar Fast Pass
          </button>
          <button onClick={onDismiss} className="w-full text-gray-400 text-xs py-2 font-medium">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FAST PASS: PAYMENT SIM ───────────────────────────────────────────────────
function PaymentSim({ price, onPaid }) {
  const [paying, setPaying] = useState(false);
  const [done, setDone]     = useState(false);
  const run = () => {
    setPaying(true);
    setTimeout(() => { setPaying(false); setDone(true); }, 2000);
  };
  if (done) return (
    <button onClick={onPaid}
      className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm transition-all">
      <CheckCircle2 size={16} strokeWidth={2.5} /> Confirmar Fast Pass
    </button>
  );
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <p className="font-bold text-gray-800 text-sm flex items-center gap-2">
        <CardIcon size={15} className="text-gray-400" strokeWidth={2} /> Pago simulado
      </p>
      <div className="border border-gray-200 rounded-xl px-3 py-2.5 flex items-center gap-2 bg-gray-50">
        <CardIcon size={14} className="text-gray-400" strokeWidth={2} />
        <span className="text-sm text-gray-400 font-mono tracking-widest">**** **** **** 4242</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm text-gray-400 font-mono">12/27</div>
        <div className="border border-gray-200 rounded-xl px-3 py-2.5 bg-gray-50 text-sm text-gray-400 font-mono">•••</div>
      </div>
      <button onClick={run} disabled={paying}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-3.5 rounded-2xl text-sm transition-all disabled:opacity-60">
        {paying ? "Procesando…" : `Pagar ${fmtCOP(price)}`}
      </button>
    </div>
  );
}

// ─── FAST PASS: CONFIRMED CARD ────────────────────────────────────────────────
function FastPassConfirmed({ user, fastPass, setQr }) {
  const slot       = getTimeSlot();
  const accessible = getFPAccessible(fastPass.category);
  const isAffiliate = fastPass.category !== "nonAffiliate";
  const CAT_STYLE  = {
    A: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", badge: "bg-emerald-500" },
    B: { bg: "bg-brand-50",   border: "border-brand-300",   text: "text-brand-700",   badge: "bg-brand-500" },
    C: { bg: "bg-purple-50",  border: "border-purple-300",  text: "text-purple-700",  badge: "bg-purple-500" },
    nonAffiliate: { bg: "bg-gray-50", border: "border-gray-200", text: "text-gray-700", badge: "bg-gray-500" },
  };
  const s = CAT_STYLE[fastPass.category] || CAT_STYLE.nonAffiliate;
  const seed = fastPass.price + fastPass.category.charCodeAt(0);

  return (
    <div className="px-4 py-4 space-y-3 pb-8">
      {/* Badge */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs px-4 py-1.5 rounded-full">
          <CheckCircle2 size={13} strokeWidth={2.5} /> Fast Pass Activo
        </div>
      </div>

      {/* Category card */}
      <div className={`${s.bg} border-2 ${s.border} rounded-2xl p-4`}>
        <div className="flex items-center justify-between mb-2">
          <p className={`text-xs font-semibold ${s.text} opacity-70`}>
            {isAffiliate ? "Afiliado Colsubsidio" : "No Afiliado"}
          </p>
          {isAffiliate && (
            <div className={`${s.badge} text-white text-[10px] font-black px-2.5 py-1 rounded-full`}>
              CAT {fastPass.category}
            </div>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className={`font-black text-3xl ${s.text}`}>
              {isAffiliate ? `Categoría ${fastPass.category}` : "Sin categoría"}
            </p>
            <p className={`text-xs ${s.text} opacity-60 mt-0.5`}>{user.name}</p>
          </div>
          <p className={`font-black text-xl ${s.text}`}>{fmtCOP(fastPass.price)}</p>
        </div>
      </div>

      {/* Time matrix */}
      {isAffiliate && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-bold text-gray-800 text-sm">Acceso rápido por franja</p>
            {slot
              ? <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-1 rounded-lg">{slot.replace("-",":00–")}:00</span>
              : <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-lg">Fuera de horario</span>
            }
          </div>
          <div className="space-y-2">
            {ATTRACTIONS.map(a => {
              const Icon    = ATTR_ICON[a.id] || Waves;
              const enabled = slot && accessible.includes(a.id);
              return (
                <button key={a.id} disabled={!enabled}
                  onClick={() => enabled && setQr({
                    title: `Fast Pass · ${a.name}`,
                    subtitle: "Muestra en la entrada prioritaria",
                    code: genCode("FP"),
                  })}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all
                    ${enabled
                      ? "border-emerald-200 bg-emerald-50 active:scale-[0.98]"
                      : "border-gray-100 bg-gray-50 opacity-50"}`}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                       style={{ background: a.bg }}>
                    <Icon size={16} strokeWidth={1.8} style={{ color: a.color }} />
                  </div>
                  <span className={`flex-1 text-xs font-bold text-left ${enabled ? "text-emerald-800" : "text-gray-400"}`}>
                    {a.name}
                  </span>
                  {enabled
                    ? <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 px-2 py-1 rounded-lg">⚡ Acceso</span>
                    : <LockIcon size={12} className="text-gray-300" strokeWidth={2} />
                  }
                </button>
              );
            })}
          </div>
          {!slot && (
            <p className="text-xs text-gray-400 text-center mt-3">
              El Fast Pass funciona de 10:00 a 16:00
            </p>
          )}
        </div>
      )}

      {/* QR simulado */}
      <div className="bg-white rounded-2xl border border-dashed border-brand-200 p-5 flex flex-col items-center gap-3">
        <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: "repeat(7,1fr)" }}>
          {Array.from({ length: 49 }, (_, i) => {
            const corners = [0,1,7,8,5,6,12,13,35,36,42,43,40,41,47,48];
            return corners.includes(i) || ((seed * 31 + i * 17 + i * i) % 13) < 7;
          }).map((on, i) => (
            <div key={i} className={`w-4 h-4 rounded-[2px] ${on ? "bg-brand-900" : "bg-white"}`} />
          ))}
        </div>
        <p className="text-[10px] text-gray-400 font-medium">Muestra en cada atracción prioritaria</p>
      </div>
    </div>
  );
}

// ─── FAST PASS TAB ────────────────────────────────────────────────────────────
function FastPassTab({ user, fastPass, setFastPass, onToast }) {
  const [step, setStep]     = useState(fastPass?.step || "intro");
  const [cedula, setCedula] = useState(user.doc || "");
  const [qr, setQr]         = useState(null);

  useEffect(() => {
    if (fastPass?.confirmed) setStep("confirmed");
    else if (fastPass?.step)  setStep(fastPass.step);
  }, [fastPass]);

  const go = (s, extra = {}) => {
    setStep(s);
    setFastPass(p => ({ ...p, step: s, ...extra }));
  };

  const confirm = (category, price) => {
    setFastPass({ confirmed: true, category, price, step: "confirmed" });
    setStep("confirmed");
    onToast("¡Fast Pass activado!", "success");
  };

  const cat = getFPCategory(cedula);
  const CAT_COLOR = { A:"text-emerald-700", B:"text-brand-700", C:"text-purple-700" };
  const CAT_BG    = { A:"bg-emerald-50 border-emerald-200", B:"bg-brand-50 border-brand-200", C:"bg-purple-50 border-purple-200" };

  if (step === "confirmed")
    return (
      <>
        <FastPassConfirmed user={user} fastPass={fastPass} setQr={setQr} />
        {qr && <QRModal {...qr} onClose={() => setQr(null)} />}
      </>
    );

  // ── INTRO ────────────────────────────────────────────────────────────────────
  if (step === "intro") return (
    <div className="px-4 py-6 space-y-4">
      <div className="text-center">
        <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <ZapIcon size={30} className="text-brand-600" strokeWidth={1.8} />
        </div>
        <h2 className="text-xl font-black text-gray-900">Fast Pass Piscilago</h2>
        <p className="text-gray-500 text-sm mt-1">Evita las filas y disfruta más</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-center">
        <p className="text-xs text-amber-700 font-medium">
          💛 Afiliados Colsubsidio desde <strong>{fmtCOP(FAST_PASS_PRICES.A)}</strong> · No afiliados {fmtCOP(FAST_PASS_PRICES.nonAffiliate)}
        </p>
      </div>
      <button onClick={() => go("affiliate-check")}
        className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-200">
        <ZapIcon size={16} strokeWidth={2.5} /> Obtener Fast Pass
      </button>
    </div>
  );

  // ── AFFILIATE CHECK ───────────────────────────────────────────────────────────
  if (step === "affiliate-check") return (
    <div className="px-4 py-6 space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <BadgeCheck size={26} className="text-brand-600" strokeWidth={1.8} />
        </div>
        <h2 className="text-lg font-black text-gray-900">¿Eres afiliado a Colsubsidio?</h2>
        <p className="text-gray-500 text-xs mt-1">Los afiliados obtienen hasta 70% de descuento</p>
      </div>
      <button onClick={() => go("cedula-input")}
        className="w-full flex items-center gap-3 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 px-5 rounded-2xl text-sm transition-all shadow-lg shadow-brand-200">
        <CheckCircle2 size={18} strokeWidth={2.5} />
        <span className="flex-1 text-left">Sí, soy afiliado Colsubsidio</span>
        <ChevronRight size={16} strokeWidth={2.5} />
      </button>
      <button onClick={() => go("non-affiliate")}
        className="w-full flex items-center gap-3 bg-white border-2 border-gray-200 hover:border-gray-300 active:scale-[0.98] text-gray-700 font-bold py-4 px-5 rounded-2xl text-sm transition-all">
        <X size={18} strokeWidth={2.5} className="text-gray-400" />
        <span className="flex-1 text-left">No, no soy afiliado</span>
        <ChevronRight size={16} strokeWidth={2.5} className="text-gray-300" />
      </button>
    </div>
  );

  // ── CEDULA INPUT ──────────────────────────────────────────────────────────────
  if (step === "cedula-input") return (
    <div className="px-4 py-6 space-y-4">
      <div className="text-center">
        <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <CreditCard size={26} className="text-brand-600" strokeWidth={1.8} />
        </div>
        <h2 className="text-lg font-black text-gray-900">Verifica tu afiliación</h2>
        <p className="text-gray-500 text-xs mt-1">Ingresa tu cédula para asignar categoría</p>
      </div>
      <Field label="Número de cédula" placeholder="Ej. 1045234567" value={cedula}
        onChange={setCedula} icon={CreditCard} type="tel" extra={{ inputMode:"numeric" }} />
      {cat && (
        <div className={`border-2 rounded-2xl p-4 text-center ${CAT_BG[cat]}`}>
          <p className={`text-xs font-semibold ${CAT_COLOR[cat]} opacity-70 mb-1`}>Tu categoría asignada</p>
          <p className={`font-black text-5xl ${CAT_COLOR[cat]}`}>CAT {cat}</p>
          <p className={`font-black text-2xl ${CAT_COLOR[cat]} mt-1`}>{fmtCOP(FAST_PASS_PRICES[cat])}</p>
        </div>
      )}
      <div className="bg-gray-50 rounded-xl px-4 py-3 text-center text-xs text-gray-400">
        Par → Cat A · Impar &lt;50M → Cat B · Impar ≥50M → Cat C
      </div>
      {cat && (
        <button onClick={() => go("affiliate-payment", { category: cat, price: FAST_PASS_PRICES[cat] })}
          className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-200">
          Continuar al pago <ChevronRight size={16} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );

  // ── NON-AFFILIATE PAYMENT ─────────────────────────────────────────────────────
  if (step === "non-affiliate") return (
    <div className="px-4 py-6 space-y-4">
      <div className="bg-gray-50 rounded-2xl p-5 text-center border border-gray-200">
        <p className="text-gray-500 text-xs font-medium mb-1">Fast Pass — No Afiliado</p>
        <p className="font-black text-4xl text-gray-900">{fmtCOP(FAST_PASS_PRICES.nonAffiliate)}</p>
        <p className="text-xs text-gray-400 mt-1">Acceso prioritario todo el día</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 font-medium text-center">
          💡 Afíliate a Colsubsidio y ahorra hasta 70%
        </p>
      </div>
      <PaymentSim price={FAST_PASS_PRICES.nonAffiliate} onPaid={() => confirm("nonAffiliate", FAST_PASS_PRICES.nonAffiliate)} />
    </div>
  );

  // ── AFFILIATE PAYMENT ─────────────────────────────────────────────────────────
  if (step === "affiliate-payment") {
    const { category, price } = fastPass || {};
    return (
      <div className="px-4 py-6 space-y-4">
        <div className="bg-brand-900 rounded-2xl p-5 text-center relative overflow-hidden">
          <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-brand-700 opacity-40" />
          <p className="text-brand-300 text-xs font-medium mb-1">Categoría {category} · Afiliado</p>
          <p className="text-white font-black text-4xl relative">{fmtCOP(price)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2">
          <p className="font-bold text-gray-800 text-sm mb-3">Resumen del pedido</p>
          {[
            ["Titular", user.name],
            ["Categoría", `CAT ${category}`],
            ["Tipo", "Fast Pass · Todo el día"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between text-sm">
              <span className="text-gray-400 font-medium">{k}</span>
              <span className="text-gray-900 font-bold">{v}</span>
            </div>
          ))}
          <div className="border-t border-dashed border-gray-200 pt-2 flex justify-between">
            <span className="font-black text-gray-900">Total</span>
            <span className="font-black text-brand-700 text-base">{fmtCOP(price)}</span>
          </div>
        </div>
        <PaymentSim price={price} onPaid={() => confirm(category, price)} />
      </div>
    );
  }

  return null;
}

// ─── MAP DATA ─────────────────────────────────────────────────────────────────
const MAP_PINS = [
  { id:"entrada",  label:"Entrada / Taquilla",   type:"entrance",   x:12, y:78, Icon:MapPin,          color:"#f59e0b", attrId:null,            restId:null },
  { id:"megatob",  label:"Megatobogán",           type:"attraction", x:22, y:28, Icon:Waves,           color:"#1d4ed8", attrId:"megatobogan",   restId:null },
  { id:"bosque",   label:"Bosque de la Lluvia",   type:"attraction", x:62, y:20, Icon:TreePine,        color:"#16a34a", attrId:"bosque-lluvia", restId:null },
  { id:"piscola",  label:"Piscina de Olas",       type:"attraction", x:72, y:54, Icon:Droplets,        color:"#0284c7", attrId:"piscina-olas",  restId:null },
  { id:"tornado",  label:"El Tornado",            type:"attraction", x:40, y:58, Icon:Tornado,         color:"#7c3aed", attrId:"tornado",       restId:null },
  { id:"riolento", label:"Río Lento",             type:"attraction", x:18, y:62, Icon:Navigation,      color:"#0891b2", attrId:"rio-lento",     restId:null },
  { id:"cascada",  label:"La Cascada",            type:"food",       x:50, y:38, Icon:UtensilsCrossed, color:"#ea580c", attrId:null,            restId:"cascada" },
  { id:"rancho",   label:"El Rancho",             type:"food",       x:32, y:72, Icon:UtensilsCrossed, color:"#b45309", attrId:null,            restId:"rancho" },
  { id:"pizza",    label:"PizzaLago",             type:"food",       x:80, y:32, Icon:UtensilsCrossed, color:"#dc2626", attrId:null,            restId:"pizzalago" },
  { id:"baño1",    label:"Servicios / Baños",     type:"restroom",   x:55, y:65, Icon:Users,           color:"#6b7280", attrId:null,            restId:null },
  { id:"ayuda",    label:"Punto de Ayuda",        type:"help",       x:30, y:44, Icon:HelpCircle,      color:"#2563eb", attrId:null,            restId:null },
];

const TYPE_LABEL = {
  entrance:"Entrada", attraction:"Atracción", food:"Restaurante", restroom:"Servicios", help:"Ayuda",
};

const MAP_TIME_SLOTS = [
  { id:"10-12", label:"10:00 – 12:00 hs" },
  { id:"12-14", label:"12:00 – 14:00 hs" },
  { id:"14-16", label:"14:00 – 16:00 hs" },
];

// ─── COOLDOWN MINI TIMER ──────────────────────────────────────────────────────
function CooldownMini({ cooldownUntil }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  const minsLeft = Math.max(0, Math.ceil((cooldownUntil - now) / 60000));
  return (
    <span className="text-[10px] font-bold text-amber-600 tabular-nums">
      {minsLeft > 0 ? `${minsLeft} min` : "Listo"}
    </span>
  );
}

// ─── CAPACITY VISUALIZER ──────────────────────────────────────────────────────
function CapacityBar({ capacity, selected, color }) {
  const overflow   = Math.max(0, selected - capacity);
  const filled     = Math.min(selected, capacity);
  const turnsNeeded = overflow > 0 ? Math.ceil(selected / capacity) : 1;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1 flex-wrap">
        {Array.from({ length: capacity }).map((_, i) => (
          <div
            key={i}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200"
            style={{
              background: i < filled ? color + "dd" : "#f3f4f6",
              border: `2px solid ${i < filled ? color : "#e5e7eb"}`,
            }}
          >
            {i < filled ? (
              <User size={12} strokeWidth={2.5} className="text-white" />
            ) : (
              <div className="w-3 h-3 rounded-sm border border-gray-300" />
            )}
          </div>
        ))}
        {overflow > 0 && (
          <div className="h-7 px-2 rounded-lg bg-amber-100 border-2 border-amber-300 flex items-center justify-center">
            <span className="text-[10px] font-black text-amber-700">+{overflow}</span>
          </div>
        )}
      </div>
      {turnsNeeded > 1 && (
        <p className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
          <ZapIcon size={9} strokeWidth={2.5} />
          {turnsNeeded} turnos consecutivos — tu familia irá junta en el flujo
        </p>
      )}
    </div>
  );
}

// ─── MAP BOOKING MODAL ────────────────────────────────────────────────────────
function MapBookingModal({ pin, onConfirm, onClose, user, companions, userCooldown, onGroupReserve }) {
  const [slot,       setSlot]      = useState(null);
  const [btnState,   setBtnState]  = useState("idle"); // idle | loading | done
  const [assignedTurns, setAssignedTurns] = useState([]); // populated on confirm
  const attr = ATTRACTIONS.find(a => a.id === pin.attrId);
  const { Icon } = pin;

  const allPeople = [
    {
      id: "user",
      name: user?.name ?? "Tú",
      age: user?.dob ? (calcAge(user.dob) ?? 0) : 18,
      avatarInitial: user?.name?.charAt(0).toUpperCase() ?? "U",
      cooldownUntil: userCooldown,
      isUser: true,
    },
    ...(companions ?? []),
  ];

  const getStatus = (p) => {
    if (attr && p.age < attr.minAge)
      return { eligible: false, kind: "age",     reason: `Edad mínima ${attr.minAge} años` };
    if (!isCooldownFree(p.cooldownUntil))
      return { eligible: false, kind: "cooldown", reason: "Tiempo frío activo" };
    return { eligible: true, kind: null, reason: null };
  };

  // selectedCompanions: array of selected person IDs (string[])
  // Initialised with all eligible people pre-selected
  const [selectedCompanions, setSelectedCompanions] = useState(
    () => allPeople.filter(p => getStatus(p).eligible).map(p => p.id)
  );

  const toggle = (id) =>
    setSelectedCompanions(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const selectedCount = selectedCompanions.length;
  const canConfirm    = !!slot && selectedCount > 0 && btnState === "idle";

  const handleConfirm = () => {
    if (!canConfirm) return;
    setBtnState("loading");
    setTimeout(() => {
      const people = allPeople.filter(p => selectedCompanions.includes(p.id));
      let result;
      if (onGroupReserve) {
        result = onGroupReserve({ attr, people });
      } else {
        // Fallback when no onGroupReserve provided (e.g. non-attraction pins)
        result = { ok: true, turns: [{ turnNumber: 101, people }], eligible: people, blocked: [] };
      }
      if (result.ok) {
        setAssignedTurns(result.turns);
        setBtnState("done");
        setTimeout(() => {
          onConfirm({ pin, slot, turns: result.turns, eligible: result.eligible, blocked: result.blocked });
        }, 800);
      } else {
        setBtnState("idle");
      }
    }, 900);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-40 flex items-end animate-fade-in" onClick={onClose}>
      <div
        className="bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                 style={{ background: pin.color + "22" }}>
              <Icon size={22} style={{ color: pin.color }} strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-gray-900 text-base leading-tight">{pin.label}</p>
              {attr && (
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Clock size={9} strokeWidth={2} /> {attr.waitMin}–{attr.waitMax} min espera
                  </span>
                  <span className="text-gray-200">·</span>
                  <span className="text-[10px] text-gray-400">+{attr.minAge} años</span>
                </div>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 hover:bg-gray-200 flex items-center justify-center transition-all active:scale-90 flex-shrink-0"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* Capacity visualizer */}
          {attr && (
            <div className="bg-gray-50 rounded-2xl px-4 py-3">
              <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">
                Capacidad · {selectedCount}/{attr.capacity} seleccionados
              </p>
              <CapacityBar capacity={attr.capacity} selected={selectedCount} color={pin.color} />
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">

          {/* ¿Quién va? */}
          <div className="px-5 pt-4 pb-3">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">
              ¿Quién va?
            </p>
            <div className="space-y-2">
              {allPeople.map(person => {
                const { eligible, kind, reason } = getStatus(person);
                const checked = selectedCompanions.includes(person.id) && eligible;
                const bg = person.isUser ? "#1d4ed8" : avatarColor(person.id);
                return (
                  <button
                    key={person.id}
                    disabled={!eligible || btnState !== "idle"}
                    onClick={() => eligible && btnState === "idle" && toggle(person.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all duration-200
                      ${!eligible
                        ? "border-gray-100 bg-gray-50 cursor-not-allowed"
                        : checked
                          ? "border-brand-400 bg-brand-50 shadow-sm shadow-brand-100 active:scale-[0.985]"
                          : "border-gray-200 bg-white hover:border-gray-300 active:scale-[0.985]"}`}
                  >
                    {/* Avatar with status overlay */}
                    <div className="relative flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white text-sm shadow-sm transition-all
                          ${!eligible ? "opacity-40" : ""}`}
                        style={{ background: bg }}
                      >
                        {person.avatarInitial}
                      </div>
                      {/* Status badge overlay */}
                      {!eligible && (
                        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center
                          ${kind === "age" ? "bg-red-400" : "bg-amber-400"}`}>
                          {kind === "age"
                            ? <LockIcon size={9} className="text-white" strokeWidth={2.5} />
                            : <Timer size={9} className="text-white" strokeWidth={2.5} />
                          }
                        </div>
                      )}
                      {/* Selected ring */}
                      {checked && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-brand-600 border-2 border-white flex items-center justify-center">
                          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                            <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold leading-tight ${!eligible ? "text-gray-400" : "text-gray-900"}`}>
                        {person.isUser ? "Tú" : person.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-gray-400 font-medium">{person.age} años</span>
                        {!eligible && kind === "age" && (
                          <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full">
                            {reason}
                          </span>
                        )}
                        {!eligible && kind === "cooldown" && (
                          <span className="flex items-center gap-1 bg-amber-50 px-1.5 py-0.5 rounded-full">
                            <Timer size={8} className="text-amber-500" strokeWidth={2.5} />
                            <CooldownMini cooldownUntil={person.cooldownUntil} />
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Circular selector */}
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200
                      ${!eligible
                        ? "border-gray-200 bg-gray-100"
                        : checked
                          ? "bg-brand-600 border-brand-600 shadow-sm"
                          : "border-gray-300 bg-white"}`}>
                      {checked && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horario */}
          <div className="px-5 pt-1 pb-5">
            <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">
              Selecciona un horario
            </p>
            <div className="space-y-2">
              {MAP_TIME_SLOTS.map(s => (
                <button key={s.id} onClick={() => btnState === "idle" && setSlot(s.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all active:scale-[0.985]
                    ${slot === s.id
                      ? "border-brand-500 bg-brand-50"
                      : "border-gray-200 bg-white hover:border-gray-300"}`}>
                  <Timer size={15} strokeWidth={2}
                         className={slot === s.id ? "text-brand-500" : "text-gray-400"} />
                  <span className={`font-semibold text-sm flex-1 text-left ${slot === s.id ? "text-brand-700" : "text-gray-700"}`}>
                    {s.label}
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                    ${slot === s.id ? "bg-brand-600 border-brand-600" : "border-gray-300"}`}>
                    {slot === s.id && (
                      <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                        <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* ── Sticky footer: counter + CTA ── */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-5 pt-3 pb-7 space-y-3">

          {/* Counter bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${selectedCount > 0 ? "bg-brand-500" : "bg-gray-300"}`} />
              <span className="text-xs font-bold text-gray-700">
                Seleccionados:
                <span className={`ml-1 tabular-nums ${selectedCount > 0 ? "text-brand-700" : "text-gray-400"}`}>
                  {selectedCount}
                </span>
              </span>
            </div>
            {attr && (
              <span className="text-xs font-semibold text-gray-400">
                Capacidad máx:
                <span className="ml-1 font-black text-gray-700">{attr.capacity}</span>
              </span>
            )}
          </div>

          {/* Turns preview chip — appears when group exceeds capacity */}
          {attr && selectedCount > attr.capacity && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 animate-fade-in">
              <ZapIcon size={11} className="text-amber-500 flex-shrink-0" strokeWidth={2.5} />
              <p className="text-xs text-amber-700 font-semibold">
                {Math.ceil(selectedCount / attr.capacity)} turnos consecutivos · tu familia irá junta en el flujo
              </p>
            </div>
          )}

          {/* Slot missing reminder */}
          {selectedCount > 0 && !slot && btnState === "idle" && (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 animate-fade-in">
              <Timer size={11} className="text-gray-400 flex-shrink-0" strokeWidth={2} />
              <p className="text-xs text-gray-500 font-medium">Elige un horario para continuar</p>
            </div>
          )}

          {/* CTA button */}
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className={`w-full flex items-center justify-center gap-2 font-black py-4 rounded-2xl text-sm transition-all duration-300
              ${btnState === "done"
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-200 scale-[1.01]"
                : btnState === "loading"
                  ? "bg-brand-500 text-white shadow-lg shadow-brand-200 cursor-wait"
                  : canConfirm
                    ? "bg-brand-600 hover:bg-brand-700 active:scale-[0.97] active:bg-brand-800 text-white shadow-lg shadow-brand-300/50"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}
          >
            {btnState === "loading" && (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            )}
            {btnState === "done" && (
              <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
                <path d="M1 7L6 12L17 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {btnState === "idle" && <QrCode size={16} strokeWidth={2.5} />}
            <span>
              {btnState === "loading" && "Asignando turnos…"}
              {btnState === "done" && assignedTurns.length > 0 && (
                assignedTurns.length === 1
                  ? `¡Turno #${assignedTurns[0].turnNumber} asignado!`
                  : `Tus turnos: ${assignedTurns.map(t => `#${t.turnNumber}`).join(", ")}`
              )}
              {btnState === "done" && assignedTurns.length === 0 && "¡Reserva confirmada!"}
              {btnState === "idle" && (
                selectedCount > 0
                  ? `Reservar para ${selectedCount} persona${selectedCount > 1 ? "s" : ""}`
                  : "Selecciona al menos 1 persona"
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAP MENU MODAL ───────────────────────────────────────────────────────────
function MapMenuModal({ pin, onConfirm, onClose }) {
  const [cart, setCart] = useState({});
  const rest = RESTAURANTS.find(r => r.id === pin.restId);
  if (!rest) return null;

  const add = (item) =>
    setCart(p => ({ ...p, [item.id]: { ...item, qty: (p[item.id]?.qty || 0) + 1 } }));
  const sub = (item) =>
    setCart(p => {
      const qty = (p[item.id]?.qty || 1) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[item.id]; return n; }
      return { ...p, [item.id]: { ...item, qty } };
    });

  const items = Object.values(cart);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end animate-fade-in" onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up flex flex-col"
           style={{ maxHeight: "80vh" }} onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        <div className="px-5 pt-2 pb-4 flex items-center gap-3 border-b border-gray-100 flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: pin.color + "22" }}>
            <UtensilsCrossed size={22} style={{ color: pin.color }} strokeWidth={1.8} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-black text-gray-900 text-base leading-tight">{rest.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rest.desc}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {rest.items.map(item => {
            const qty = cart[item.id]?.qty || 0;
            return (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                  <p className="text-xs font-bold text-brand-600 mt-0.5">{fmtCOP(item.price)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {qty > 0 && (
                    <>
                      <button onClick={() => sub(item)}
                        className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-500 flex items-center justify-center active:scale-95 transition-all">
                        <Minus size={12} strokeWidth={2.5} />
                      </button>
                      <span className="text-sm font-black text-gray-900 w-4 text-center">{qty}</span>
                    </>
                  )}
                  <button onClick={() => add(item)}
                    className="w-7 h-7 rounded-lg bg-brand-600 text-white flex items-center justify-center active:scale-95 transition-all shadow-sm">
                    <Plus size={12} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-500">
              <ShoppingCart size={14} strokeWidth={2} />
              <span className="text-sm font-semibold">{count} ítem{count !== 1 ? "s" : ""}</span>
            </div>
            <span className="font-black text-brand-700 text-base">
              {total > 0 ? fmtCOP(total) : "—"}
            </span>
          </div>
          <button
            onClick={() => count > 0 && onConfirm({ pin, items, total })}
            disabled={count === 0}
            className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            <QrCode size={16} strokeWidth={2.5} />
            Confirmar pedido{count > 0 ? ` · ${fmtCOP(total)}` : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── FAST PASS TICKET ────────────────────────────────────────────────────────
const MODAL_BG = "#07102b";

function FastPassTicket({ turn, turnIndex, totalTurns, pin, slotLabel, code, multiTurn }) {
  const seed  = (code + turn.turnNumber).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  // 9×9 QR grid — more realistic than 7×7
  const cells = Array.from({ length: 81 }, (_, i) => {
    const corners = [
      0,1,2,9,10,11,18,19,20,
      6,7,8,15,16,17,24,25,26,
      54,55,56,63,64,65,72,73,74,
      60,61,62,69,70,71,78,79,80,
    ];
    return corners.includes(i) || ((seed * 31 + i * 17 + i * i * 3) % 11) < 6;
  });
  const { Icon } = pin;

  return (
    <div
      className="animate-ticket-reveal mx-4 rounded-3xl overflow-hidden shadow-2xl"
      style={{ animationDelay: `${turnIndex * 120}ms`, boxShadow: "0 24px 60px rgba(0,0,0,0.55)" }}
    >
      {/* ── Gradient header ── */}
      <div
        className="px-5 pt-6 pb-7 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a3a8f 0%, #0f2166 60%, #0a1855 100%)" }}
      >
        {/* Decorative blobs */}
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-10 -left-6 w-28 h-28 rounded-full bg-white/5 pointer-events-none" />

        {/* Brand strip */}
        <div className="relative flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Zap size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <p className="text-white/60 text-[8px] font-black tracking-[0.2em] uppercase leading-none">
                PISCILAGO
              </p>
              <p className="text-white text-[9px] font-bold tracking-widest uppercase leading-none mt-0.5">
                FAST PASS
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {multiTurn && (
              <span className="text-[9px] font-black text-white/60 bg-white/10 px-2 py-1 rounded-full tracking-wide">
                {turnIndex + 1} / {totalTurns}
              </span>
            )}
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
              <Icon size={16} className="text-white" strokeWidth={1.8} />
            </div>
          </div>
        </div>

        {/* Attraction name */}
        <p className="relative text-white/60 text-[10px] font-black tracking-[0.18em] uppercase mb-1">
          Atracción
        </p>
        <p className="relative text-white font-black text-[22px] leading-tight mb-4">
          {pin.label}
        </p>

        {/* Turno + slot row */}
        <div className="relative flex items-end justify-between">
          <div>
            <p className="text-white/50 text-[9px] font-bold tracking-widest uppercase mb-0.5">
              Turno asignado
            </p>
            <p className="text-white font-black text-[44px] leading-none tabular-nums"
               style={{ textShadow: "0 2px 20px rgba(255,255,255,0.15)" }}>
              #{turn.turnNumber}
            </p>
          </div>
          {slotLabel && (
            <div className="text-right pb-1">
              <p className="text-white/50 text-[9px] font-bold tracking-widest uppercase mb-0.5">
                Horario
              </p>
              <p className="text-white font-bold text-sm">{slotLabel}</p>
              <p className="text-white/50 text-[10px] font-medium mt-0.5">
                {new Date().toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Ticket tear separator ── */}
      <div className="relative flex items-center" style={{ height: "28px", background: "white" }}>
        {/* Left notch */}
        <div
          className="absolute z-10 w-11 h-11 rounded-full pointer-events-none"
          style={{ left: "-22px", top: "50%", transform: "translateY(-50%)", background: MODAL_BG }}
        />
        {/* Right notch */}
        <div
          className="absolute z-10 w-11 h-11 rounded-full pointer-events-none"
          style={{ right: "-22px", top: "50%", transform: "translateY(-50%)", background: MODAL_BG }}
        />
        {/* Dashed line */}
        <div className="absolute left-5 right-5 top-1/2 -translate-y-1/2 border-t-2 border-dashed border-gray-200 z-0" />
      </div>

      {/* ── White ticket body ── */}
      <div className="bg-white px-5 pt-3 pb-6 flex flex-col items-center gap-4">
        {/* QR with reveal animation */}
        <div className="animate-zoom-in">
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="inline-grid gap-[3px]" style={{ gridTemplateColumns: "repeat(9, 1fr)" }}>
              {cells.map((on, i) => (
                <div
                  key={i}
                  className={`w-[18px] h-[18px] rounded-[3px] ${on ? "bg-gray-900" : "bg-white"}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Code */}
        <p className="font-mono text-[11px] font-black text-gray-300 tracking-[0.22em]">{code}</p>

        {/* Group members row */}
        <div className="w-full">
          <p className="text-[9px] font-black text-gray-400 tracking-[0.18em] uppercase text-center mb-2.5">
            {turn.people.length} participante{turn.people.length !== 1 ? "s" : ""}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {turn.people.map(p => (
              <div key={p.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-xl px-2.5 py-1.5">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center font-black text-white text-[9px] flex-shrink-0"
                  style={{ background: p.id === "user" ? "#1d4ed8" : avatarColor(p.id) }}
                >
                  {p.avatarInitial ?? p.name?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-gray-700">
                  {p.isUser ? "Tú" : p.name.split(" ")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Instruction strip */}
        <div className="w-full flex items-center gap-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 size={14} className="text-white" strokeWidth={2.5} />
          </div>
          <p className="text-xs text-emerald-700 font-semibold leading-tight">
            Muestra este pase al operario en la entrada prioritaria de la atracción
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── MAP REDEMPTION SHEET ────────────────────────────────────────────────────
function MapRedemptionSheet({ data, onClose }) {
  const { pin, slot, items, total, turns, eligible, blocked } = data;
  const isAttraction = !!turns && turns.length > 0;
  const slotLabel    = MAP_TIME_SLOTS.find(s => s.id === slot)?.label;
  const [code]       = useState(() => genCode(isAttraction ? "RES" : "FD"));
  const hasBlocked   = blocked && blocked.length > 0;
  const multiTurn    = isAttraction && turns.length > 1;

  // ── Restaurant order sheet (unchanged style, lighter redesign) ──
  if (!isAttraction) {
    const seed  = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
    const cells = Array.from({ length: 49 }, (_, i) => {
      const corners = [0,1,7,8,5,6,12,13,35,36,42,43,40,41,47,48];
      return corners.includes(i) || ((seed * 31 + i * 17 + i * i) % 13) < 7;
    });
    const { Icon } = pin;
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-end animate-fade-in" onClick={onClose}>
        <div className="bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up overflow-hidden"
             style={{ maxHeight: "85vh" }} onClick={e => e.stopPropagation()}>
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>
          <div className="overflow-y-auto">
            <div className="px-5 pt-3 pb-4 flex items-center gap-3 border-b border-gray-100">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={26} className="text-emerald-500" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-gray-900 text-base">Pedido confirmado</p>
                <p className="text-xs text-emerald-600 font-semibold mt-0.5">{pin.label}</p>
              </div>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                   style={{ background: pin.color + "22" }}>
                <Icon size={17} style={{ color: pin.color }} strokeWidth={2} />
              </div>
            </div>
            <div className="px-5 pt-5 pb-3 flex flex-col items-center gap-3">
              <div className="animate-zoom-in bg-gray-50 border-2 border-gray-100 rounded-2xl p-4">
                <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
                  {cells.map((on, i) => (
                    <div key={i} className={`w-5 h-5 rounded-[3px] ${on ? "bg-gray-900" : "bg-white"}`} />
                  ))}
                </div>
              </div>
              <p className="font-mono text-xs font-black text-gray-300 tracking-widest">{code}</p>
            </div>
            <div className="mx-5 mb-3 bg-gray-50 rounded-2xl px-4 py-3 space-y-2">
              {items?.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">{item.name} × {item.qty}</span>
                  <span className="font-bold text-gray-900">{fmtCOP(item.price * item.qty)}</span>
                </div>
              ))}
              {total > 0 && (
                <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2">
                  <span className="font-black text-gray-900">Total</span>
                  <span className="font-black text-brand-700">{fmtCOP(total)}</span>
                </div>
              )}
            </div>
            <div className="mx-5 mb-4 flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
              <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-white text-[10px] font-black flex-shrink-0">!</div>
              <p className="text-xs text-amber-700 font-medium">
                Presenta este QR en caja del restaurante para reclamar tu pedido.
              </p>
            </div>
            <div className="px-5 pb-7">
              <button onClick={onClose}
                className="w-full bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-200">
                Volver al Mapa
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Attraction Fast Pass experience ──
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col animate-fade-in"
      style={{ background: MODAL_BG }}
    >
      {/* Top bar */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 pt-safe pt-4 pb-3">
        <div>
          <p className="text-white/40 text-[9px] font-black tracking-[0.2em] uppercase">
            Reserva confirmada
          </p>
          <p className="text-white font-black text-base leading-tight">Tu Fast Pass</p>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-xl bg-white/10 text-white/70 hover:bg-white/20 flex items-center justify-center transition-all active:scale-90"
        >
          <X size={16} strokeWidth={2.5} />
        </button>
      </div>

      {/* Multi-turn notice */}
      {multiTurn && (
        <div className="mx-5 mb-3 flex items-center gap-2.5 bg-white/10 rounded-2xl px-4 py-2.5 animate-fade-in flex-shrink-0">
          <Users size={13} className="text-white/70 flex-shrink-0" strokeWidth={2.5} />
          <p className="text-xs text-white/80 font-semibold">
            Tu grupo fue dividido en <strong className="text-white">{turns.length} turnos consecutivos</strong> para mantenerlos juntos en el flujo
          </p>
        </div>
      )}

      {/* Scrollable ticket stack */}
      <div className="flex-1 overflow-y-auto pb-6 space-y-4">
        {turns.map((turn, ti) => (
          <FastPassTicket
            key={ti}
            turn={turn}
            turnIndex={ti}
            totalTurns={turns.length}
            pin={pin}
            slotLabel={slotLabel}
            code={`${code}-${ti + 1}`}
            multiTurn={multiTurn}
          />
        ))}

        {/* Blocked members */}
        {hasBlocked && (
          <div className="mx-4 bg-white/10 rounded-2xl px-4 py-3 animate-fade-in">
            <p className="text-[9px] font-black text-white/50 tracking-[0.15em] uppercase mb-2.5">
              No incluidos en esta reserva
            </p>
            <div className="space-y-2">
              {blocked.map(p => (
                <div key={p.id} className="flex items-center gap-2.5">
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center font-black text-white text-[10px] opacity-50"
                    style={{ background: p.id === "user" ? "#1d4ed8" : avatarColor(p.id) }}
                  >
                    {p.avatarInitial ?? p.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-white/60 flex-1 truncate">
                    {p.isUser ? "Tú" : p.name}
                  </span>
                  <span className="text-[10px] text-amber-400 font-semibold">{p.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cooldown reminder */}
        <div className="mx-4 bg-amber-400/15 border border-amber-400/25 rounded-2xl px-4 py-3 animate-fade-in">
          <p className="text-xs text-amber-300 font-semibold leading-relaxed">
            <span className="font-black">⏱ 45 min de tiempo frío</span> aplicado a todos los participantes confirmados.
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="flex-shrink-0 px-5 pb-safe pb-6 pt-3"
           style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-100 active:scale-[0.97] text-brand-900 font-black py-4 rounded-2xl text-sm transition-all shadow-lg"
        >
          <MapPin size={15} strokeWidth={2.5} />
          Volver al Mapa
        </button>
      </div>
    </div>
  );
}

// ─── MAP TAB ──────────────────────────────────────────────────────────────────
const MAP_IMG_SRC = import.meta.env.BASE_URL + "assets/mapa_detallado.jpg";
const SCALE_MIN = 0.8;
const SCALE_MAX = 4;

function MapTab({ user, companions, userCooldown, onGroupReserve }) {
  const [scale, setScale]     = useState(1);
  const [offset, setOffset]   = useState({ x: 0, y: 0 });
  const [imgOk, setImgOk]     = useState(true);
  const [filter, setFilter]   = useState("all");
  const [selected, setSelected] = useState(null);
  const [modal, setModal]       = useState(null);
  const [redemption, setRedemption] = useState(null);

  const dragging = useRef(false);
  const lastPos  = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e) => {
    dragging.current = true;
    lastPos.current  = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(p => ({ x: p.x + dx, y: p.y + dy }));
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  const zoom = (delta) =>
    setScale(s => Math.min(SCALE_MAX, Math.max(SCALE_MIN, +(s + delta).toFixed(2))));

  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); setSelected(null); };

  const handlePin = useCallback((e, pin) => {
    e.stopPropagation();
    setSelected(p => p?.id === pin.id ? null : pin);
  }, []);

  const FILTERS = [
    { id:"all", label:"Todo" },
    { id:"attraction", label:"Atracciones" },
    { id:"food", label:"Comida" },
    { id:"restroom", label:"Servicios" },
  ];

  const visible = MAP_PINS.filter(
    p => filter === "all" || p.type === filter || p.type === "entrance"
  );

  const handleConfirm = (data) => {
    setModal(null);
    setSelected(null);
    setRedemption(data);
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Filter chips */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 no-scrollbar">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => { setFilter(f.id); setSelected(null); }}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filter === f.id
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-brand-300"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Map viewport */}
      <div
        className="flex-1 mx-4 mb-2 rounded-2xl overflow-hidden border-2 border-brand-100 shadow-inner bg-sky-100 cursor-grab active:cursor-grabbing relative"
        style={{ minHeight: 280, touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* Transformable layer — image + pins move together */}
        <div style={{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: "50% 50%",
          width: "100%", height: "100%",
          position: "relative", willChange: "transform",
        }}>
          {imgOk ? (
            <img src={MAP_IMG_SRC} alt="Mapa Piscilago" draggable={false}
                 onError={() => setImgOk(false)}
                 className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full"
                 xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
              <rect width="100" height="100" fill="#bae6fd" />
              <ellipse cx="50" cy="50" rx="44" ry="42" fill="#bbf7d0" />
              <ellipse cx="48" cy="46" rx="36" ry="32" fill="#86efac" />
              <ellipse cx="68" cy="54" rx="16" ry="12" fill="#7dd3fc" opacity="0.85" />
              <ellipse cx="68" cy="54" rx="13" ry="9"  fill="#38bdf8" opacity="0.6" />
              <path d="M10 65 Q20 58 18 62 Q16 68 22 68 Q28 68 26 72 Q22 78 30 80"
                    fill="none" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
              <circle cx="60" cy="20" r="9" fill="#4ade80" opacity="0.7" />
              <circle cx="65" cy="18" r="7" fill="#22c55e" opacity="0.6" />
              <circle cx="55" cy="22" r="6" fill="#4ade80" opacity="0.5" />
              <circle cx="22" cy="28" r="5" fill="#4ade80" opacity="0.5" />
              <circle cx="78" cy="34" r="6" fill="#4ade80" opacity="0.5" />
              <circle cx="82" cy="30" r="4" fill="#22c55e" opacity="0.4" />
              <path d="M12 78 Q22 70 30 65 Q42 58 50 50 Q60 40 62 28"
                    fill="none" stroke="#fef9c3" strokeWidth="2.5" strokeDasharray="3,2" opacity="0.9" />
              <path d="M50 50 Q65 50 72 54" fill="none" stroke="#fef9c3" strokeWidth="2" strokeDasharray="3,2" opacity="0.8" />
              <path d="M50 50 Q42 56 40 58" fill="none" stroke="#fef9c3" strokeWidth="2" strokeDasharray="3,2" opacity="0.8" />
              <rect x="8" y="74" width="8" height="3" rx="1" fill="#fde68a" opacity="0.9" />
              <text x="50" y="97" textAnchor="middle" fontSize="3.5" fill="#0ea5e9" fontWeight="bold" opacity="0.7">
                LAGO TOMINÉ
              </text>
            </svg>
          )}

          {/* Pins — inside transform so they move with the map */}
          {visible.map(pin => {
            const { Icon } = pin;
            const isSelected = selected?.id === pin.id;
            return (
              <button
                key={pin.id}
                onPointerDown={e => e.stopPropagation()}
                onClick={e => handlePin(e, pin)}
                style={{ left: `${pin.x}%`, top: `${pin.y}%`, position: "absolute" }}
                className="transform -translate-x-1/2 -translate-y-full active:scale-90 transition-transform z-10"
              >
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-all
                    ${isSelected ? "scale-125 ring-2 ring-offset-1" : ""}`}
                  style={{
                    background: pin.color,
                    ringColor: pin.color,
                  }}
                >
                  <Icon size={16} color="#fff" strokeWidth={2} />
                </div>
                <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent mx-auto"
                     style={{ borderTopColor: pin.color }} />
              </button>
            );
          })}
        </div>

        {/* Zoom controls */}
        <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
          {[
            { action: () => zoom(0.3),  Icon: ZoomIn  },
            { action: () => zoom(-0.3), Icon: ZoomOut },
            { action: reset,            Icon: Map     },
          ].map(({ action, Icon }, i) => (
            <button key={i}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); action(); }}
              className="w-8 h-8 bg-white/90 rounded-lg shadow-md flex items-center justify-center text-gray-700 active:scale-95 transition-all border border-gray-200">
              <Icon size={14} strokeWidth={2} />
            </button>
          ))}
        </div>

        {/* Scale badge */}
        <div className="absolute bottom-3 right-3 bg-black/40 text-white text-[10px] font-bold px-2 py-1 rounded-lg z-20 pointer-events-none">
          {Math.round(scale * 100)}%
        </div>

        {/* Pin info card — bottom overlay */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-14 bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2.5 flex items-center gap-2.5 animate-fade-in z-20">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                 style={{ background: selected.color + "22" }}>
              <selected.Icon size={17} style={{ color: selected.color }} strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-xs truncate">{selected.label}</p>
              <p className="text-[10px] text-gray-400 font-medium">{TYPE_LABEL[selected.type]}</p>
            </div>
            {selected.type === "attraction" && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setModal("book"); }}
                className="flex-shrink-0 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition-all">
                Reservar
              </button>
            )}
            {selected.type === "food" && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); setModal("menu"); }}
                className="flex-shrink-0 bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg active:scale-95 transition-all">
                Ver Menú
              </button>
            )}
            <button
              onPointerDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); setSelected(null); }}
              className="text-gray-400 flex-shrink-0">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-gray-400 pb-3 font-medium">
        Toca un pin · Arrastra para mover · Usa los botones para hacer zoom
      </p>

      {modal === "book" && selected && (
        <MapBookingModal
          pin={selected}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
          user={user}
          companions={companions}
          userCooldown={userCooldown}
          onGroupReserve={onGroupReserve}
        />
      )}
      {modal === "menu" && selected && (
        <MapMenuModal
          pin={selected}
          onConfirm={handleConfirm}
          onClose={() => setModal(null)}
        />
      )}
      {redemption && (
        <MapRedemptionSheet
          data={redemption}
          onClose={() => setRedemption(null)}
        />
      )}
    </div>
  );
}

// ─── FOOD TAB ─────────────────────────────────────────────────────────────────
const REST_ICONS = { cascada:"🌊", rancho:"🔥", pizzalago:"🍕" };

function FoodTab({ onToast }) {
  const [cart, setCart]       = useState({});
  const [open, setOpen]       = useState(null);
  const [paying, setPaying]   = useState(false);
  const [qr, setQr]           = useState(null);

  const add = (item) =>
    setCart(p => ({ ...p, [item.id]: { ...item, qty: (p[item.id]?.qty || 0) + 1 } }));
  const sub = (item) =>
    setCart(p => {
      const qty = (p[item.id]?.qty || 1) - 1;
      if (qty <= 0) { const n = { ...p }; delete n[item.id]; return n; }
      return { ...p, [item.id]: { ...item, qty } };
    });

  const cartItems  = Object.values(cart);
  const itemCount  = cartItems.reduce((s, i) => s + i.qty, 0);
  const total      = cartItems.reduce((s, i) => s + i.price * i.qty, 0);

  const checkout = () => {
    setPaying(true);
    setTimeout(() => {
      setPaying(false);
      const code = genCode("FD");
      setQr({ title:"Pedido confirmado", subtitle:"Presenta en caja del restaurante", code });
      setCart({});
      onToast("¡Ganaste 50 pts Piscilago! 🌟", "success");
    }, 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-3">
        <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-0.5">
          Restaurantes
        </p>

        {RESTAURANTS.map(rest => (
          <div key={rest.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Restaurant header */}
            <button
              onClick={() => setOpen(open === rest.id ? null : rest.id)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center text-2xl flex-shrink-0">
                {REST_ICONS[rest.id]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{rest.name}</p>
                <p className="text-xs text-gray-400 truncate">{rest.desc}</p>
              </div>
              <div className={`text-gray-400 transition-transform ${open === rest.id ? "rotate-180" : ""}`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </button>

            {/* Menu items */}
            {open === rest.id && (
              <div className="border-t border-gray-100 divide-y divide-gray-50">
                {rest.items.map(item => {
                  const qty = cart[item.id]?.qty || 0;
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{item.name}</p>
                        <p className="text-xs font-bold text-brand-600 mt-0.5">{fmtCOP(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {qty > 0 ? (
                          <>
                            <button onClick={() => sub(item)}
                              className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 text-red-500 font-black text-sm flex items-center justify-center active:scale-95 transition-all">
                              −
                            </button>
                            <span className="text-sm font-black text-gray-900 w-4 text-center">{qty}</span>
                          </>
                        ) : null}
                        <button onClick={() => add(item)}
                          className="w-7 h-7 rounded-lg bg-brand-600 text-white font-black text-sm flex items-center justify-center active:scale-95 transition-all shadow-sm">
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Floating cart */}
      {itemCount > 0 && !qr && (
        <div className="absolute bottom-16 left-4 right-4 z-20">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            {/* Cart summary */}
            <div className="px-4 py-3 space-y-1.5 max-h-36 overflow-y-auto">
              {cartItems.map(item => (
                <div key={item.id} className="flex justify-between text-xs">
                  <span className="text-gray-600 font-medium">{item.name} × {item.qty}</span>
                  <span className="font-bold text-gray-900">{fmtCOP(item.price * item.qty)}</span>
                </div>
              ))}
              <div className="border-t border-dashed border-gray-200 pt-1.5 flex justify-between">
                <span className="font-black text-gray-900 text-sm">Total</span>
                <span className="font-black text-brand-700 text-sm">{fmtCOP(total)}</span>
              </div>
            </div>
            {/* Checkout button */}
            <button onClick={checkout} disabled={paying}
              className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-3.5 text-sm transition-all disabled:opacity-60">
              {paying
                ? <><span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Procesando…</>
                : <><UtensilsCrossed size={15} strokeWidth={2.5} /> Confirmar pedido · {fmtCOP(total)}</>
              }
            </button>
          </div>
        </div>
      )}

      {qr && <QRModal {...qr} onClose={() => setQr(null)} />}
    </div>
  );
}

// ─── HELP BOT ─────────────────────────────────────────────────────────────────
const BOT_CHIPS = [
  {
    label: "Horarios",
    reply: "El parque abre de Lunes a Viernes 9am–5pm y fines de semana 8am–6pm. El Fast Pass está disponible de 10am a 4pm en franjas de 2 horas.",
  },
  {
    label: "Info Fast Pass",
    reply: "El Fast Pass te da acceso prioritario según tu categoría (A, B o C) y la franja horaria activa. Afiliados Colsubsidio desde $35.000. No afiliados $120.000.",
  },
  {
    label: "Uso de QR",
    reply: "Muestra el código QR al operario en la entrada de cada atracción. Para Fast Pass, dirígete a la fila prioritaria. Los códigos son válidos solo el día de emisión.",
  },
];

function HelpBot() {
  const [open, setOpen]       = useState(false);
  const [msgs, setMsgs]       = useState([
    { from: "bot", text: "¡Hola! 👋 Soy el asistente de Piscilago. ¿En qué puedo ayudarte hoy?" },
  ]);
  const bottomRef = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, open]);

  const handleChip = (chip) => {
    setMsgs(p => [
      ...p,
      { from: "user", text: chip.label },
      { from: "bot",  text: chip.reply },
    ]);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-20 right-4 z-30 w-13 h-13 w-[52px] h-[52px] rounded-full bg-brand-600 hover:bg-brand-700 shadow-xl shadow-brand-300 flex items-center justify-center transition-all active:scale-95 hover:scale-105"
      >
        <MessageCircle size={22} className="text-white" strokeWidth={2} />
      </button>

      {/* Chat modal */}
      {open && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end animate-fade-in"
             onClick={() => setOpen(false)}>
          <div className="bg-white w-full max-w-sm mx-auto rounded-t-3xl shadow-2xl flex flex-col animate-slide-up"
               style={{ maxHeight: "75vh" }}
               onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
                <MessageCircle size={18} className="text-white" strokeWidth={2} />
              </div>
              <div className="flex-1">
                <p className="font-bold text-gray-900 text-sm">Asistente Piscilago</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] text-emerald-600 font-semibold">En línea</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {msgs.map((m, i) => (
                <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                  {m.from === "bot" && (
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                      <MessageCircle size={13} className="text-brand-600" strokeWidth={2} />
                    </div>
                  )}
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed
                    ${m.from === "bot"
                      ? "bg-gray-100 text-gray-800 rounded-tl-none"
                      : "bg-brand-600 text-white rounded-tr-none"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Quick chips */}
            <div className="px-4 pt-3 pb-5 border-t border-gray-100 flex-shrink-0 space-y-2">
              <p className="text-[10px] font-bold text-gray-400 tracking-wide uppercase">
                Preguntas frecuentes
              </p>
              <div className="flex flex-wrap gap-2">
                {BOT_CHIPS.map(chip => (
                  <button key={chip.label} onClick={() => handleChip(chip)}
                    className="flex items-center gap-1.5 bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all hover:bg-brand-100">
                    <Send size={10} strokeWidth={2.5} />
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
// ─── PROFILE TAB ──────────────────────────────────────────────────────────────
const AVATAR_PALETTE = ["#1d4ed8","#7c3aed","#0891b2","#16a34a","#ea580c","#dc2626","#b45309"];
const avatarColor = (id) =>
  AVATAR_PALETTE[id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_PALETTE.length];

/* ── CooldownBar: live progress strip for companions in cooldown ── */
function CooldownBar({ cooldownUntil }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(id);
  }, []);
  const total   = GROUP_COOLDOWN_MS;
  const elapsed = now - (cooldownUntil - total);
  const pct     = Math.min(100, Math.max(0, (elapsed / total) * 100));
  const minsLeft = Math.ceil((cooldownUntil - now) / 60000);
  return (
    <div className="mt-2">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold text-amber-500 tracking-wide uppercase">Tiempo frío</span>
        <span className="text-[9px] font-semibold text-amber-400">{minsLeft > 0 ? `${minsLeft} min` : "Listo"}</span>
      </div>
      <div className="h-1 rounded-full bg-amber-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-amber-400 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ProfileTab({ user, companions, userCooldown, onAddCompanion, onRemoveCompanion }) {
  const [showAdd,    setShowAdd]    = useState(false);
  const [form,       setForm]       = useState({ name: "", dob: "" });
  const [errs,       setErrs]       = useState({});
  const [removingId, setRemovingId] = useState(null);

  const MAX_MEMBERS = 10;
  const canAdd = companions.length < MAX_MEMBERS;

  const submit = () => {
    const e = {};
    const trimmed = form.name.trim();
    if (!trimmed)            e.name = "Nombre requerido";
    else if (trimmed.length < 2) e.name = "Mínimo 2 caracteres";
    if (!form.dob)           e.dob  = "Fecha de nacimiento requerida";
    else {
      const age = calcAge(form.dob);
      if (age === null || age < 0) e.dob = "Fecha inválida";
      else if (age > 110)          e.dob = "Fecha inválida";
    }
    setErrs(e);
    if (Object.keys(e).length) return;
    onAddCompanion({ name: trimmed, age: calcAge(form.dob) });
    setForm({ name: "", dob: "" });
    setErrs({});
    setShowAdd(false);
  };

  const handleRemove = (id) => {
    setRemovingId(id);
    setTimeout(() => {
      onRemoveCompanion(id);
      setRemovingId(null);
    }, 260);
  };

  const closeAdd = () => { setShowAdd(false); setForm({ name:"", dob:"" }); setErrs({}); };
  const previewAge = form.dob ? calcAge(form.dob) : null;
  const leaderFree = isCooldownFree(userCooldown);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 space-y-4">

        {/* ── Leader card ── */}
        <div className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 rounded-3xl overflow-hidden relative shadow-xl">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-12 -left-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="relative px-5 pt-5 pb-5 flex items-center gap-4">
            {/* Avatar ring */}
            <div className={`p-0.5 rounded-2xl flex-shrink-0 ${leaderFree ? "bg-emerald-400" : "bg-amber-400"}`}>
              <div className="w-[58px] h-[58px] rounded-[14px] bg-brand-900 flex items-center justify-center font-black text-white text-2xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-white font-black text-[17px] leading-tight truncate">{user.name}</p>
                <span className="text-[9px] font-black tracking-widest text-brand-300 bg-white/10 px-2 py-0.5 rounded-full uppercase flex-shrink-0">
                  Líder
                </span>
              </div>
              <p className="text-brand-300 text-xs font-medium mt-0.5 truncate">{user.email}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className="bg-white/10 text-brand-200 text-[10px] font-bold px-2.5 py-1 rounded-full">
                  {user.docType} · {user.doc.slice(0,3)}···{user.doc.slice(-2)}
                </span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 ${
                  leaderFree
                    ? "bg-emerald-500/25 text-emerald-300"
                    : "bg-amber-400/25 text-amber-300"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full inline-block ${leaderFree ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {leaderFree ? "Disponible" : "Tiempo frío"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Mi Familia header ── */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="font-black text-gray-900 text-[15px] flex items-center gap-2">
              Mi Familia
              <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {companions.length}/{MAX_MEMBERS}
              </span>
            </p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">
              {companions.length === 0
                ? "Sin acompañantes registrados"
                : `${companions.length} acompañante${companions.length !== 1 ? "s" : ""} en tu grupo`}
            </p>
          </div>
          {canAdd && (
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-md shadow-brand-200/60 transition-all"
            >
              <Plus size={13} strokeWidth={2.5} /> Añadir
            </button>
          )}
        </div>

        {/* ── Capacity reached notice ── */}
        {!canAdd && (
          <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3 animate-fade-in">
            <AlertCircle size={15} className="text-amber-500 flex-shrink-0" strokeWidth={2} />
            <p className="text-xs text-amber-700 font-semibold">Capacidad máxima alcanzada (10 miembros)</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {companions.length === 0 && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full border-2 border-dashed border-gray-200 hover:border-brand-300 rounded-3xl px-5 py-9 flex flex-col items-center gap-3 text-center transition-all active:scale-[0.98] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 group-hover:bg-brand-50 group-hover:border-brand-100 flex items-center justify-center transition-all">
              <Users size={24} className="text-gray-300 group-hover:text-brand-400 transition-colors" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-400 group-hover:text-gray-600 transition-colors">
                Agrega tu grupo familiar
              </p>
              <p className="text-[11px] text-gray-300 leading-relaxed mt-1 max-w-[200px] mx-auto">
                Los acompañantes comparten tiempo de espera al reservar atracciones juntos.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-brand-600 text-xs font-bold mt-1">
              <Plus size={12} strokeWidth={2.5} /> Añadir primer acompañante
            </span>
          </button>
        )}

        {/* ── Companion cards ── */}
        {companions.length > 0 && (
          <div className="space-y-2.5">
            {companions.map((c, idx) => {
              const free    = isCooldownFree(c.cooldownUntil);
              const bg      = avatarColor(c.id);
              const exiting = removingId === c.id;
              return (
                <div
                  key={c.id}
                  className={`bg-white rounded-2xl border shadow-sm px-4 py-3.5 flex items-start gap-3.5 transition-all
                    ${exiting
                      ? "animate-pop-out border-red-100"
                      : "border-gray-100 animate-slide-in-right"}`}
                  style={!exiting ? { animationDelay: `${idx * 40}ms`, animationFillMode: "both" } : undefined}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center font-black text-white text-base shadow-sm"
                      style={{ background: bg }}
                    >
                      {c.avatarInitial}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${free ? "bg-emerald-400" : "bg-amber-400"}`} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-gray-900 text-sm leading-tight truncate">{c.name}</p>
                      <span className="text-[10px] text-gray-400 font-medium flex-shrink-0">{c.age} años</span>
                    </div>
                    {!free && c.cooldownUntil
                      ? <CooldownBar cooldownUntil={c.cooldownUntil} />
                      : (
                        <p className="text-[10px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                          Disponible
                        </p>
                      )
                    }
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => handleRemove(c.id)}
                    disabled={!!removingId}
                    className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-red-50 hover:text-red-400 text-gray-400 flex items-center justify-center transition-all active:scale-90 flex-shrink-0 mt-0.5 disabled:opacity-40"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add companion bottom sheet ── */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/60 z-40 flex items-end animate-fade-in"
          onClick={closeAdd}
        >
          <div
            className="bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up px-5 pt-2 pb-safe"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-gray-200 rounded-full" />
            </div>

            {/* Sheet header */}
            <div className="flex items-center justify-between pt-2 pb-5">
              <div>
                <p className="font-black text-gray-900 text-[18px]">Nuevo miembro</p>
                <p className="text-[11px] text-gray-400 font-medium mt-0.5">
                  {MAX_MEMBERS - companions.length} lugar{MAX_MEMBERS - companions.length !== 1 ? "es" : ""} disponible{MAX_MEMBERS - companions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={closeAdd}
                className="w-8 h-8 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-all active:scale-90"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            <div className="space-y-3.5 pb-6">
              {/* Name field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 tracking-wide uppercase">
                  Nombre completo
                </label>
                <div className={`flex items-center gap-2.5 border-2 rounded-2xl px-4 py-3.5 transition-all
                  ${errs.name
                    ? "border-red-300 bg-red-50"
                    : "border-gray-100 bg-gray-50 focus-within:border-brand-400 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-brand-100"}`}>
                  <User size={15} className={`flex-shrink-0 ${errs.name ? "text-red-400" : "text-gray-400"}`} strokeWidth={2} />
                  <input
                    type="text"
                    placeholder="Ej. María García"
                    value={form.name}
                    onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setErrs(p => ({ ...p, name: undefined })); }}
                    maxLength={60}
                    className="flex-1 bg-transparent text-sm text-gray-900 outline-none font-medium placeholder:text-gray-300"
                    autoFocus
                  />
                  {form.name.length > 0 && (
                    <span className="text-[10px] text-gray-300 font-medium flex-shrink-0">{form.name.length}/60</span>
                  )}
                </div>
                {errs.name && (
                  <div className="flex items-center gap-1.5 animate-fade-in">
                    <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-500 text-xs font-semibold">{errs.name}</p>
                  </div>
                )}
              </div>

              {/* DOB field */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 tracking-wide uppercase">
                  Fecha de nacimiento
                </label>
                <div className={`flex items-center gap-2.5 border-2 rounded-2xl px-4 py-3.5 transition-all
                  ${errs.dob
                    ? "border-red-300 bg-red-50"
                    : "border-gray-100 bg-gray-50 focus-within:border-brand-400 focus-within:bg-white focus-within:shadow-sm focus-within:shadow-brand-100"}`}>
                  <Calendar size={15} className={`flex-shrink-0 ${errs.dob ? "text-red-400" : "text-gray-400"}`} strokeWidth={2} />
                  <input
                    type="date"
                    value={form.dob}
                    onChange={e => { setForm(p => ({ ...p, dob: e.target.value })); setErrs(p => ({ ...p, dob: undefined })); }}
                    max={new Date().toISOString().split("T")[0]}
                    className="flex-1 bg-transparent text-sm text-gray-800 outline-none font-medium"
                  />
                </div>
                {errs.dob && (
                  <div className="flex items-center gap-1.5 animate-fade-in">
                    <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-500 text-xs font-semibold">{errs.dob}</p>
                  </div>
                )}
              </div>

              {/* Age preview chip */}
              {previewAge !== null && previewAge >= 0 && previewAge <= 110 && (
                <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3 animate-fade-in">
                  <CheckCircle2 size={14} className="text-brand-500 flex-shrink-0" strokeWidth={2.5} />
                  <div>
                    <p className="text-xs text-brand-700 font-bold">{previewAge} años</p>
                    {previewAge < 3 && (
                      <p className="text-[10px] text-brand-400 mt-0.5">Solo podrá acceder a áreas para bebés</p>
                    )}
                  </div>
                </div>
              )}

              {/* CTA */}
              <button
                onClick={submit}
                className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 active:scale-[0.97] active:bg-brand-800 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-lg shadow-brand-300/40"
              >
                <Plus size={16} strokeWidth={2.5} /> Añadir al grupo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Dashboard({ user, reservations, onReserve, onLogout, fastPass, setFastPass, onToast, showFPPopup, onDismissPopup,
                     companions, userCooldown, onAddCompanion, onRemoveCompanion, onApplyUserCooldown, onApplyCompanionCooldown,
                     onGroupReserve }) {
  const [activeTab, setActiveTab] = useState("atracciones");

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <DashboardHeader user={user} fastPassActive={fastPass?.confirmed} onLogout={onLogout} />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        <div className="flex-1 overflow-y-auto">
          {activeTab === "atracciones" && (
            <AttractionsTab reservations={reservations} onReserve={onReserve} onToast={onToast} />
          )}
          {activeTab === "mapa"     && <MapTab user={user} companions={companions} userCooldown={userCooldown} onGroupReserve={onGroupReserve} />}
          {activeTab === "comida"   && <FoodTab onToast={onToast} />}
          {activeTab === "fastpass" && (
            <FastPassTab user={user} fastPass={fastPass} setFastPass={setFastPass} onToast={onToast} />
          )}
          {activeTab === "perfil" && (
            <ProfileTab
              user={user}
              companions={companions}
              userCooldown={userCooldown}
              onAddCompanion={onAddCompanion}
              onRemoveCompanion={onRemoveCompanion}
            />
          )}
        </div>
        <BottomNav active={activeTab} onSelect={setActiveTab} />
      </div>

      {/* HelpBot FAB — visible en todas las tabs */}
      <HelpBot />

      {showFPPopup && !fastPass?.confirmed && (
        <FastPassPopup
          userName={user.name}
          onActivate={() => { onDismissPopup(); setActiveTab("fastpass"); }}
          onDismiss={onDismissPopup}
        />
      )}
    </div>
  );
}

// ─── ATTRACTION ICON MAP ──────────────────────────────────────────────────────
const ATTR_ICON = {
  megatobogan:   Waves,
  "bosque-lluvia": TreePine,
  "piscina-olas":  Droplets,
  tornado:         Tornado,
  "rio-lento":     Navigation,
};

// ─── useCooldown ──────────────────────────────────────────────────────────────
function useCooldown(reservation) {
  const [rem, setRem] = useState(0);
  useEffect(() => {
    if (!reservation) { setRem(0); return; }
    const tick = () => setRem(Math.max(0, COOLDOWN_MS - (Date.now() - reservation.ts)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [reservation]);
  return rem;
}

// ─── QR MODAL ─────────────────────────────────────────────────────────────────
function QRModal({ title, subtitle, code, onClose }) {
  const seed = code.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const cells = Array.from({ length: 49 }, (_, i) => {
    const corners = [0,1,7,8, 5,6,12,13, 35,36,42,43, 40,41,47,48];
    return corners.includes(i) || ((seed * 31 + i * 17 + i * i) % 13) < 7;
  });
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-5 animate-fade-in"
         onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xs animate-pop-in overflow-hidden"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-brand-900 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode size={18} className="text-gold-400" strokeWidth={2} />
            <span className="text-white font-bold text-sm">{title}</span>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {/* QR grid */}
        <div className="px-5 py-5 flex flex-col items-center gap-4">
          <div className="bg-brand-50 border-2 border-brand-100 rounded-2xl p-4">
            <div className="inline-grid gap-0.5" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {cells.map((on, i) => (
                <div key={i}
                  className={`w-5 h-5 rounded-[3px] ${on ? "bg-brand-900" : "bg-white"}`} />
              ))}
            </div>
          </div>
          <div className="text-center space-y-1">
            <p className="font-mono text-xs font-bold text-gray-500 tracking-widest">{code}</p>
            <p className="text-xs text-gray-400">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 w-full">
            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" strokeWidth={2.5} />
            <p className="text-xs text-emerald-700 font-semibold">Reserva confirmada · Válido hoy</p>
          </div>
          <button onClick={onClose}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-2xl text-sm transition-colors active:scale-[0.98]">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DETAIL MODAL ─────────────────────────────────────────────────────────────
function DetailModal({ attraction: a, reservation, waiting, onReserve, onClose }) {
  const rem = useCooldown(reservation);
  const cooling = reservation && rem > 0;
  const Icon = ATTR_ICON[a.id] || Waves;
  return (
    <div className="fixed inset-0 bg-black/50 z-40 flex items-end animate-fade-in"
         onClick={onClose}>
      <div className="bg-white w-full rounded-t-3xl shadow-2xl animate-slide-up"
           onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>
        {/* Icon + title */}
        <div className="px-5 pt-2 pb-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
               style={{ background: a.bg }}>
            <Icon size={28} strokeWidth={1.8} style={{ color: a.color }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{a.name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">Fila virtual · Cupo garantizado</p>
          </div>
        </div>
        {/* Stats row */}
        <div className="mx-5 grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Duración", value: a.time, sub: "estimado" },
            { label: "En espera", value: waiting, sub: "personas" },
            { label: "Estado", value: cooling ? "Frío" : "Libre", sub: cooling ? "cooldown" : "disponible" },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] text-gray-400 font-semibold">{s.label}</p>
              <p className="font-bold text-gray-900 text-base leading-tight">{s.value}</p>
              <p className="text-[9px] text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>
        {/* Action */}
        <div className="px-5 pb-8">
          {cooling ? (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4 text-center">
              <p className="text-xs text-amber-600 font-semibold mb-1">Tiempo frío activo</p>
              <p className="font-mono text-2xl font-black text-amber-700">{fmtCountdown(rem)}</p>
              <p className="text-[10px] text-gray-400 mt-1">
                Reservaste a las {new Date(reservation.ts).toLocaleTimeString("es-CO",{hour:"2-digit",minute:"2-digit"})}
              </p>
            </div>
          ) : (
            <button
              onClick={() => { onReserve(a); onClose(); }}
              className="w-full bg-brand-600 hover:bg-brand-700 active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-base transition-all shadow-lg shadow-brand-200">
              Reservar Fila Virtual
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ATTRACTION CARD ──────────────────────────────────────────────────────────
function AttractionCard({ attraction: a, reservation, waiting, onReserve, onDetail }) {
  const rem = useCooldown(reservation);
  const cooling = reservation && rem > 0;
  const pct = reservation ? Math.min(100, ((Date.now() - reservation.ts) / COOLDOWN_MS) * 100) : 0;
  const Icon = ATTR_ICON[a.id] || Waves;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Color accent bar */}
      <div className="h-1 w-full" style={{ background: a.color }} />
      <div className="p-4 flex items-center gap-3">
        {/* Icon */}
        <button
          onClick={() => onDetail(a)}
          className="w-13 h-13 w-[52px] h-[52px] rounded-xl flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
          style={{ background: a.bg }}>
          <Icon size={24} strokeWidth={1.8} style={{ color: a.color }} />
        </button>
        {/* Info */}
        <div className="flex-1 min-w-0" onClick={() => onDetail(a)}>
          <p className="font-bold text-gray-900 text-sm leading-tight">{a.name}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Clock size={10} strokeWidth={2} /> {a.time}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Users size={10} strokeWidth={2} /> {waiting} esperando
            </span>
          </div>
          {/* Cooldown progress bar */}
          {cooling && (
            <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-full">
              <div className="h-full bg-amber-400 rounded-full transition-all"
                   style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {/* Action */}
        <div className="flex-shrink-0">
          {cooling ? (
            <div className="text-center min-w-[72px]">
              <p className="text-[9px] font-bold text-amber-500 mb-0.5">COOLDOWN</p>
              <p className="font-mono text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                {fmtCountdown(rem)}
              </p>
            </div>
          ) : (
            <button
              onClick={() => onReserve(a)}
              className="bg-brand-600 hover:bg-brand-700 active:scale-95 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl shadow-sm shadow-brand-200 transition-all">
              Reservar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ATTRACTIONS TAB ──────────────────────────────────────────────────────────
function AttractionsTab({ reservations, onReserve, onToast }) {
  const [detail, setDetail] = useState(null);
  const [qr, setQr]         = useState(null);
  const [waitCounts]        = useState(() =>
    Object.fromEntries(ATTRACTIONS.map(a => [a.id, Math.floor(Math.random() * (a.waitMax - a.waitMin + 1)) + a.waitMin]))
  );

  const handleReserve = useCallback((attr) => {
    const ok = onReserve(attr);
    if (ok) {
      const code = `VQ-${attr.id.slice(0,3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      setQr({ title: `Fila: ${attr.name}`, subtitle: "Preséntalo en la entrada de la atracción", code });
      onToast(`¡Turno reservado en ${attr.name}!`, "success");
    }
  }, [onReserve, onToast]);

  const coolingCount = ATTRACTIONS.filter(a => {
    const res = [...reservations].filter(r => r.attractionId === a.id).sort((x,y) => y.ts - x.ts)[0];
    return res && (COOLDOWN_MS - (Date.now() - res.ts)) > 0;
  }).length;

  return (
    <div className="px-4 py-4 space-y-3 pb-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Reservas",     value: reservations.length, color: "text-brand-600" },
          { label: "Disponibles",  value: ATTRACTIONS.length - coolingCount, color: "text-emerald-600" },
          { label: "En cooldown",  value: coolingCount, color: "text-amber-500" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-2.5 text-center shadow-sm border border-gray-100">
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-gray-400 text-[9px] font-semibold leading-tight mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-center gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2.5">
        <Clock size={13} className="text-amber-500 flex-shrink-0" strokeWidth={2.5} />
        <p className="text-xs text-amber-700 font-medium">
          <span className="font-bold">Cooldown de 2h</span> entre reservas por atracción
        </p>
      </div>

      <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase px-0.5">
        Atracciones disponibles
      </p>

      {ATTRACTIONS.map(a => {
        const res = [...reservations].filter(r => r.attractionId === a.id).sort((x,y) => y.ts - x.ts)[0];
        return (
          <AttractionCard
            key={a.id}
            attraction={a}
            reservation={res}
            waiting={waitCounts[a.id]}
            onReserve={handleReserve}
            onDetail={setDetail}
          />
        );
      })}

      {detail && (
        <DetailModal
          attraction={detail}
          reservation={[...reservations].filter(r => r.attractionId === detail.id).sort((x,y) => y.ts - x.ts)[0]}
          waiting={waitCounts[detail.id]}
          onReserve={handleReserve}
          onClose={() => setDetail(null)}
        />
      )}
      {qr && <QRModal {...qr} onClose={() => setQr(null)} />}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]           = useState("login");
  const [pendingUser, setPendingUser] = useState(null);
  const [user, setUser]               = useState(null);
  const [toast, setToast]             = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const handleFormSubmit = (formData) => {
    setPendingUser({ ...formData, isAdult: calcAge(formData.dob) >= 18 });
    setScreen("verify");
  };

  const [reservations, setReservations] = useState([]);
  const [fastPass, setFastPass]         = useState(null);
  const [showFPPopup, setShowFPPopup]   = useState(false);
  const [companions, setCompanions]     = useState([]);
  const [userCooldown, setUserCooldown] = useState(null);
  // Global turn counter — seeds from a realistic mid-session value so turns
  // start around 100-150 and increment sequentially across all reservations.
  const [turnCounter, setTurnCounter]   = useState(() => 100 + Math.floor(Math.random() * 50));

  // myGroup: unified view of leader + companions (max 10 members total)
  const myGroup = useMemo(() => ({
    leader: {
      id: "user",
      name: user?.name ?? "Tú",
      age: user?.dob ? (calcAge(user.dob) ?? 18) : 18,
      avatarInitial: user?.name?.charAt(0).toUpperCase() ?? "U",
      cooldownUntil: userCooldown,
      status: isCooldownFree(userCooldown) ? "available" : "cooldown",
      isUser: true,
    },
    members: companions.slice(0, 10).map(c => ({
      ...c,
      status: isCooldownFree(c.cooldownUntil) ? "available" : "cooldown",
    })),
    get all() { return [this.leader, ...this.members]; },
  }), [user, userCooldown, companions]);

  // isAvailable: returns true if the person with the given id is not in cooldown
  const isAvailable = useCallback((personId) => {
    if (personId === "user") return isCooldownFree(userCooldown);
    const companion = companions.find(c => c.id === personId);
    return companion ? isCooldownFree(companion.cooldownUntil) : false;
  }, [userCooldown, companions]);

  const addCompanion = useCallback((data) => {
    setCompanions(prev => prev.length >= 10 ? prev : [...prev, mkCompanion(data)]);
  }, []);

  const removeCompanion = useCallback((id) => {
    setCompanions(prev => prev.filter(c => c.id !== id));
  }, []);

  const applyUserCooldown = useCallback(() => {
    setUserCooldown(Date.now() + COOLDOWN_MS);
  }, []);

  const applyCompanionCooldown = useCallback((id) => {
    setCompanions(prev =>
      prev.map(c => c.id === id ? { ...c, cooldownUntil: Date.now() + COOLDOWN_MS, status: "cooldown" } : c)
    );
  }, []);

  const handleVerified = (userData) => {
    setUser(userData);
    setScreen("dashboard");
    showToast(`¡Bienvenido, ${userData.name.split(" ")[0]}!`, "success");
    setTimeout(() => setShowFPPopup(true), 1000);
  };

  const handleLogout = () => {
    setUser(null); setPendingUser(null);
    setReservations([]); setFastPass(null);
    setShowFPPopup(false);
    setCompanions([]); setUserCooldown(null);
    setScreen("login");
  };

  const handleReserve = (attr) => {
    const now = Date.now();
    const last = [...reservations]
      .filter(r => r.attractionId === attr.id)
      .sort((a, b) => b.ts - a.ts)[0];
    if (last && (COOLDOWN_MS - (now - last.ts)) > 0) return false;
    setReservations(prev => [...prev, { attractionId: attr.id, ts: now }]);
    return true;
  };

  /**
   * handleGroupReserve({ attr, people })
   *
   * people: Array<{ id, name, age, cooldownUntil }>
   *   - use id "user" for the account holder
   *   - use companion id (c-…) for each companion
   *
   * Returns:
   *   { ok, turns, eligible, blocked }
   *   turns: [{ turnNumber, people[] }, ...]
   *   blocked: [{ ...person, reason }]
   */
  const handleGroupReserve = useCallback(({ attr, people }) => {
    const now = Date.now();
    const eligible = [];
    const blocked  = [];

    for (const person of people) {
      if (person.age < attr.minAge) {
        blocked.push({ ...person, reason: `Edad mínima ${attr.minAge} años` });
      } else if (!isCooldownFree(person.cooldownUntil)) {
        blocked.push({ ...person, reason: "En tiempo de espera (45 min)" });
      } else {
        eligible.push(person);
      }
    }

    if (eligible.length === 0) {
      return { ok: false, turns: [], eligible, blocked };
    }

    // Split into consecutive turns using the global sequential counter
    const cap = attr.capacity ?? 8;
    const turns = [];
    let nextTurn;
    setTurnCounter(prev => {
      nextTurn = prev;
      return prev + Math.ceil(eligible.length / cap); // advance counter by number of turns consumed
    });
    // nextTurn is set synchronously by the setter callback above
    for (let i = 0; i < eligible.length; i += cap) {
      turns.push({
        turnNumber: nextTurn + Math.floor(i / cap),
        people: eligible.slice(i, i + cap),
      });
    }

    // Apply 45-min cooldown to all eligible members
    const until = now + GROUP_COOLDOWN_MS;
    if (eligible.find(p => p.id === "user")) {
      setUserCooldown(until);
    }
    const companionIds = eligible.filter(p => p.id !== "user").map(p => p.id);
    if (companionIds.length) {
      setCompanions(prev =>
        prev.map(c => companionIds.includes(c.id) ? { ...c, cooldownUntil: until } : c)
      );
    }

    // Persist reservation with turns so QR screen can read them
    setReservations(prev => [
      ...prev,
      {
        id: genCode("RV"),
        attractionId: attr.id,
        attractionName: attr.name,
        ts: now,
        groupTurns: turns,
        eligible,
        blocked,
      },
    ]);

    return { ok: true, turns, eligible, blocked };
  }, [setTurnCounter, setUserCooldown, setCompanions, setReservations]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-brand-950 p-4"
         style={{ background: "linear-gradient(135deg, #0a1e4f 0%, #1a56db 60%, #0891b2 100%)" }}>

      {/* Phone frame */}
      <div className="relative w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
           style={{ height: "87vh", maxHeight: "800px" }}>

        {/* Status bar */}
        <div className="bg-brand-950 px-5 py-1.5 flex justify-between items-center flex-shrink-0">
          <span className="text-white text-[10px] font-bold tracking-wide">9:41</span>
          <div className="w-16 h-3.5 bg-black rounded-full mx-auto" />
          <div className="flex items-center gap-1 text-white text-[9px]">
            <span>▲▲▲</span>
            <span>■</span>
          </div>
        </div>

        <div style={{ height: "calc(100% - 28px)" }} className="overflow-hidden">
          {screen === "login"     && <LoginScreen onSubmit={handleFormSubmit} />}
          {screen === "verify"    && <VerifyScreen pending={pendingUser} onVerified={handleVerified} />}
          {screen === "dashboard" && (
            <Dashboard
              user={user}
              reservations={reservations}
              onReserve={handleReserve}
              onLogout={handleLogout}
              fastPass={fastPass}
              setFastPass={setFastPass}
              onToast={showToast}
              showFPPopup={showFPPopup}
              onDismissPopup={() => setShowFPPopup(false)}
              companions={companions}
              userCooldown={userCooldown}
              onAddCompanion={addCompanion}
              onRemoveCompanion={removeCompanion}
              onApplyUserCooldown={applyUserCooldown}
              onApplyCompanionCooldown={applyCompanionCooldown}
              onGroupReserve={handleGroupReserve}
            />
          )}
        </div>
      </div>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

export { ATTRACTIONS, RESTAURANTS, FP_MATRIX, FAST_PASS_PRICES, COOLDOWN_MS, VERIFY_CODE,
         fmtCountdown, fmtCOP, calcAge, getFPCategory, getTimeSlot, randWait, genCode,
         PiscilagoLogo, SimQR, Toast, Field };
