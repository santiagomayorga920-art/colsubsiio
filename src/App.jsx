import { useState, useRef } from "react";
import {
  User, Lock, Mail, Phone, CreditCard, Calendar,
  Eye, EyeOff, ChevronRight, Zap, ShieldCheck,
  RefreshCw, AlertCircle, Waves
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

// ─── LOGO SVG (fiel al logo oficial) ─────────────────────────────────────────
function PiscilagoLogo({ size = "md" }) {
  const w = size === "lg" ? 200 : size === "sm" ? 110 : 150;
  return (
    <div style={{ width: w }} className="mx-auto select-none">
      <svg viewBox="0 0 240 130" xmlns="http://www.w3.org/2000/svg" className="w-full">
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

// ─── LOGIN SCREEN ─────────────────────────────────────────────────────────────
function LoginScreen({ onSubmit }) {
  const [tab, setTab]     = useState("register");
  const [form, setForm]   = useState({ name: "", doc: "", email: "", phone: "", dob: "", password: "" });
  const [errors, setErrors] = useState({});
  const f = (k) => (v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    const e = {};
    if (tab === "register") {
      if (form.name.trim().split(/\s+/).filter(Boolean).length < 2)
        e.name = "Ingresa nombre y apellido (mínimo 2 palabras)";
      const doc = form.doc.replace(/\D/g, "");
      if (doc.length < 8 || doc.length > 10)
        e.doc = "La cédula debe tener entre 8 y 10 dígitos";
      if (!form.phone.trim())
        e.phone = "Teléfono requerido";
      if (!form.dob)
        e.dob = "Fecha de nacimiento requerida";
      else if (calcAge(form.dob) < 6)
        e.dob = "El visitante debe tener al menos 6 años";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
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
          <PiscilagoLogo size="lg" />
          <p className="text-center text-brand-300 text-xs font-medium mt-3 tracking-widest uppercase">
            Tu aventura acuática
          </p>
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
              <Field label="Cédula de ciudadanía" placeholder="1234567890" value={form.doc}
                onChange={f("doc")} error={errors.doc} icon={CreditCard}
                type="tel" extra={{ inputMode: "numeric" }} />
              <Field label="Teléfono celular" placeholder="300 123 4567" value={form.phone}
                onChange={f("phone")} error={errors.phone} icon={Phone} type="tel" />
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
          <PiscilagoLogo size="lg" />
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

// ─── PHASE 2 PLACEHOLDER DASHBOARD ────────────────────────────────────────────
function DashboardPlaceholder({ user, onLogout }) {
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-brand-900 px-4 pt-8 pb-4">
        <div className="flex items-center justify-between mb-4">
          <PiscilagoLogo size="sm" />
          <button onClick={onLogout} className="text-xs text-brand-300 font-semibold">
            Salir
          </button>
        </div>
        <div className="bg-white/10 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-400 flex items-center justify-center font-black text-brand-900 text-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white/60 text-xs">Bienvenido</p>
            <p className="text-white font-bold text-sm">{user.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-4">
        <div className="w-20 h-20 rounded-3xl bg-brand-50 flex items-center justify-center">
          <Waves size={36} className="text-brand-500" strokeWidth={1.5} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">¡Registro exitoso! 🎉</h2>
          <p className="text-gray-500 text-sm mt-1">
            <span className="font-semibold text-brand-600">Fase 2</span> en construcción —{" "}
            Atracciones, Mapa, Comida y Fast Pass llegan pronto.
          </p>
        </div>
        <div className="w-full space-y-2 mt-2">
          {["🎢 Atracciones", "🗺️ Mapa del Parque", "🍔 Comida", "⚡ Fast Pass"].map(item => (
            <div key={item} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-100 shadow-sm">
              <span className="text-base">{item.split(" ")[0]}</span>
              <span className="text-sm font-semibold text-gray-700">{item.split(" ").slice(1).join(" ")}</span>
              <span className="ml-auto text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Próximamente</span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom nav placeholder */}
      <div className="bg-white border-t border-gray-100 px-2 py-2 flex justify-around flex-shrink-0">
        {[["🎢","Atracciones"],["🗺️","Mapa"],["🍔","Comida"],["⚡","Fast Pass"]].map(([ic, lb]) => (
          <div key={lb} className="flex flex-col items-center gap-0.5 px-3 py-1.5 text-gray-300">
            <span className="text-xl grayscale opacity-40">{ic}</span>
            <span className="text-[9px] font-semibold">{lb}</span>
          </div>
        ))}
      </div>
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

  const handleVerified = (userData) => {
    setUser(userData);
    setScreen("dashboard");
    showToast(`¡Bienvenido, ${userData.name.split(" ")[0]}!`, "success");
  };

  const handleLogout = () => {
    setUser(null);
    setPendingUser(null);
    setScreen("login");
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
          {screen === "dashboard" && <DashboardPlaceholder user={user} onLogout={handleLogout} />}
        </div>
      </div>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

// Re-export data/helpers for future phases
export { ATTRACTIONS, RESTAURANTS, FP_MATRIX, FAST_PASS_PRICES, COOLDOWN_MS, VERIFY_CODE,
         fmtCountdown, fmtCOP, calcAge, getFPCategory, getTimeSlot, randWait, genCode,
         PiscilagoLogo, SimQR, Toast, Field };
