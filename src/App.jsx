import { useState, useRef, useEffect, useCallback } from "react";
import {
  User, Lock, Mail, Phone, CreditCard, Calendar,
  Eye, EyeOff, Zap, ShieldCheck, RefreshCw, AlertCircle,
  Waves, Zap as ZapIcon, Map, UtensilsCrossed, Ticket,
  LogOut, Star, Clock, Users, X, QrCode, CheckCircle2,
  Wind, Droplets, TreePine, Tornado, Navigation,
  BadgeCheck, CreditCard as CardIcon, ChevronRight, Lock as LockIcon,
  MessageCircle, Send
} from "lucide-react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const COOLDOWN_MS = 2 * 60 * 60 * 1000;
const VERIFY_CODE = "123456";
const FAST_PASS_PRICES = { nonAffiliate: 120000, A: 35000, B: 55000, C: 85000 };

const ATTRACTIONS = [
  { id: "megatobogan",   name: "Megatobogán",        icon: "megatobogan",  waitMin: 8,  waitMax: 25, time: "~3 min",  color: "#f97316", bg: "#fff7ed" },
  { id: "bosque-lluvia", name: "Bosque de la Lluvia", icon: "bosque",       waitMin: 5,  waitMax: 20, time: "~15 min", color: "#16a34a", bg: "#f0fdf4" },
  { id: "piscina-olas",  name: "Piscina de Olas",     icon: "piscina",      waitMin: 10, waitMax: 40, time: "~20 min", color: "#0284c7", bg: "#f0f9ff" },
  { id: "tornado",       name: "El Tornado",           icon: "tornado",      waitMin: 6,  waitMax: 30, time: "~5 min",  color: "#7c3aed", bg: "#faf5ff" },
  { id: "rio-lento",     name: "Río Lento",            icon: "rio",          waitMin: 2,  waitMax: 15, time: "~25 min", color: "#0891b2", bg: "#ecfeff" },
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
const genCode = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}`;
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
  { id:"entrada",    label:"Entrada / Taquilla",    type:"entrance", x:12, y:78, color:"#f59e0b", iconColor:"#78350f" },
  { id:"megatob",   label:"Megatobogán",            type:"attraction",x:22, y:28, color:"#f97316", iconColor:"#fff" },
  { id:"bosque",    label:"Bosque de la Lluvia",    type:"attraction",x:62, y:20, color:"#16a34a", iconColor:"#fff" },
  { id:"piscola",   label:"Piscina de Olas",        type:"attraction",x:72, y:54, color:"#0284c7", iconColor:"#fff" },
  { id:"tornado",   label:"El Tornado",             type:"attraction",x:40, y:58, color:"#7c3aed", iconColor:"#fff" },
  { id:"riolento",  label:"Río Lento",              type:"attraction",x:18, y:62, color:"#0891b2", iconColor:"#fff" },
  { id:"cascada",   label:"La Cascada",             type:"food",      x:50, y:38, color:"#ea580c", iconColor:"#fff" },
  { id:"rancho",    label:"El Rancho",              type:"food",      x:32, y:72, color:"#b45309", iconColor:"#fff" },
  { id:"pizza",     label:"PizzaLago",              type:"food",      x:80, y:32, color:"#dc2626", iconColor:"#fff" },
  { id:"baño1",     label:"Servicios / Baños",      type:"restroom",  x:55, y:65, color:"#6b7280", iconColor:"#fff" },
  { id:"ayuda",     label:"Punto de Ayuda",         type:"help",      x:30, y:44, color:"#2563eb", iconColor:"#fff" },
];

const PIN_ICONS = {
  entrance:   "🚪",
  attraction: "🎢",
  food:       "🍽",
  restroom:   "🚻",
  help:       "ℹ",
};

const PIN_LABEL_COLOR = {
  entrance:   "bg-amber-100 text-amber-800 border-amber-300",
  attraction: "bg-blue-50 text-brand-700 border-brand-200",
  food:       "bg-orange-50 text-orange-700 border-orange-200",
  restroom:   "bg-gray-100 text-gray-600 border-gray-300",
  help:       "bg-blue-50 text-blue-700 border-blue-200",
};

// ─── MAP TAB ──────────────────────────────────────────────────────────────────
function MapTab() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter]     = useState("all");

  const FILTERS = [
    { id:"all",        label:"Todo" },
    { id:"attraction", label:"Atracciones" },
    { id:"food",       label:"Comida" },
    { id:"restroom",   label:"Servicios" },
    { id:"help",       label:"Ayuda" },
  ];

  const visible = MAP_PINS.filter(p => filter === "all" || p.type === filter || p.type === "entrance");

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="px-4 pt-3 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 no-scrollbar">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border transition-all
              ${filter === f.id
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-500 border-gray-200 hover:border-brand-300"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Map container */}
      <div className="flex-1 mx-4 mb-2 relative overflow-hidden rounded-2xl border-2 border-brand-100 shadow-inner"
           style={{ minHeight: 260 }}>
        {/* SVG illustrated map */}
        <svg viewBox="0 0 100 100" className="w-full h-full" xmlns="http://www.w3.org/2000/svg"
             preserveAspectRatio="xMidYMid slice">
          {/* Sky / water border */}
          <rect width="100" height="100" fill="#bae6fd" />

          {/* Main island shape */}
          <ellipse cx="50" cy="50" rx="44" ry="42" fill="#bbf7d0" />

          {/* Interior grass zones */}
          <ellipse cx="48" cy="46" rx="36" ry="32" fill="#86efac" />

          {/* Central lake / piscina de olas */}
          <ellipse cx="68" cy="54" rx="16" ry="12" fill="#7dd3fc" opacity="0.85" />
          <ellipse cx="68" cy="54" rx="13" ry="9"  fill="#38bdf8" opacity="0.6" />

          {/* Río Lento — winding river */}
          <path d="M10 65 Q20 58 18 62 Q16 68 22 68 Q28 68 26 72 Q22 78 30 80"
                fill="none" stroke="#7dd3fc" strokeWidth="3" strokeLinecap="round" opacity="0.8" />

          {/* Dense tree clusters */}
          <circle cx="60" cy="20" r="9"  fill="#4ade80" opacity="0.7" />
          <circle cx="65" cy="18" r="7"  fill="#22c55e" opacity="0.6" />
          <circle cx="55" cy="22" r="6"  fill="#4ade80" opacity="0.5" />
          <circle cx="22" cy="28" r="5"  fill="#4ade80" opacity="0.5" />
          <circle cx="78" cy="34" r="6"  fill="#4ade80" opacity="0.5" />
          <circle cx="82" cy="30" r="4"  fill="#22c55e" opacity="0.4" />

          {/* Paths / roads */}
          <path d="M12 78 Q22 70 30 65 Q42 58 50 50 Q60 40 62 28"
                fill="none" stroke="#fef9c3" strokeWidth="2.5" strokeDasharray="3,2" opacity="0.9" />
          <path d="M50 50 Q65 50 72 54"
                fill="none" stroke="#fef9c3" strokeWidth="2" strokeDasharray="3,2" opacity="0.8" />
          <path d="M50 50 Q42 56 40 58"
                fill="none" stroke="#fef9c3" strokeWidth="2" strokeDasharray="3,2" opacity="0.8" />
          <path d="M30 65 Q22 64 18 62"
                fill="none" stroke="#fef9c3" strokeWidth="2" strokeDasharray="3,2" opacity="0.7" />

          {/* Entrance road */}
          <rect x="8" y="74" width="8" height="3" rx="1" fill="#fde68a" opacity="0.9" />
          <text x="50" y="97" textAnchor="middle" fontSize="3.5" fill="#0ea5e9" fontWeight="bold" opacity="0.7">
            LAGO TOMINÉ
          </text>
        </svg>

        {/* Pins overlay */}
        {visible.map(pin => (
          <button key={pin.id}
            onClick={() => setSelected(selected?.id === pin.id ? null : pin)}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            className="absolute -translate-x-1/2 -translate-y-full transition-transform active:scale-90">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white text-sm
              ${selected?.id === pin.id ? "scale-125 ring-2 ring-white ring-offset-1" : ""}`}
                 style={{ background: pin.color }}>
              <span style={{ color: pin.iconColor, fontSize: 14 }}>{PIN_ICONS[pin.type]}</span>
            </div>
            <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-transparent mx-auto"
                 style={{ borderTopColor: pin.color }} />
          </button>
        ))}

        {/* Tooltip */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 bg-white rounded-xl shadow-xl border border-gray-100 px-3 py-2.5 flex items-center gap-2 animate-fade-in">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
                 style={{ background: selected.color }}>
              <span style={{ color: selected.iconColor }}>{PIN_ICONS[selected.type]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 text-xs truncate">{selected.label}</p>
              <p className="text-[10px] text-gray-400 capitalize">{selected.type === "attraction" ? "Atracción" : selected.type === "food" ? "Comida" : selected.type === "restroom" ? "Servicios" : selected.type === "entrance" ? "Entrada" : "Ayuda"}</p>
            </div>
            <button onClick={() => setSelected(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="px-4 pb-4 flex-shrink-0">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
          <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mb-2">Leyenda</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { type:"entrance",   label:"Entrada / Salida", color:"#f59e0b" },
              { type:"attraction", label:"Atracciones",      color:"#f97316" },
              { type:"food",       label:"Comida",           color:"#ea580c" },
              { type:"restroom",   label:"Baños / Servicios",color:"#6b7280" },
              { type:"help",       label:"Punto de ayuda",   color:"#2563eb" },
            ].map(l => (
              <div key={l.type} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px]"
                     style={{ background: l.color }}>
                  {PIN_ICONS[l.type]}
                </div>
                <span className="text-[10px] text-gray-600 font-medium">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
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
function Dashboard({ user, reservations, onReserve, onLogout, fastPass, setFastPass, onToast, showFPPopup, onDismissPopup }) {
  const [activeTab, setActiveTab] = useState("atracciones");

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <DashboardHeader user={user} fastPassActive={fastPass?.confirmed} onLogout={onLogout} />

      <div className="flex-1 overflow-hidden flex flex-col min-h-0 relative">
        <div className="flex-1 overflow-y-auto">
          {activeTab === "atracciones" && (
            <AttractionsTab reservations={reservations} onReserve={onReserve} onToast={onToast} />
          )}
          {activeTab === "mapa"     && <MapTab />}
          {activeTab === "comida"   && <FoodTab onToast={onToast} />}
          {activeTab === "fastpass" && (
            <FastPassTab user={user} fastPass={fastPass} setFastPass={setFastPass} onToast={onToast} />
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

  const handleVerified = (userData) => {
    setUser(userData);
    setScreen("dashboard");
    showToast(`¡Bienvenido, ${userData.name.split(" ")[0]}!`, "success");
    setTimeout(() => setShowFPPopup(true), 1000);
  };

  const handleLogout = () => {
    setUser(null); setPendingUser(null);
    setReservations([]); setFastPass(null);
    setShowFPPopup(false); setScreen("login");
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
