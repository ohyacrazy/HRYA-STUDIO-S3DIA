import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, Users, UserX, Shield, BarChart2, Settings,
  LogOut, Menu, Gamepad2, Bell, Check, Trash2, X,
  Crown, Swords, Unlock, AlertTriangle, KeyRound, Zap,
  Activity, ChevronRight
} from 'lucide-react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Banned from './pages/Banned';
import Security from './pages/Security';
import Analytics from './pages/Analytics';
import Games from './pages/Games';
import Setup from './pages/Setup';
import { API } from './lib/api';

type Page = 'dashboard' | 'players' | 'banned' | 'security' | 'analytics' | 'games' | 'setup';

const NAV: { id: Page; label: string; icon: React.ElementType; accent?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, accent: '#6c3ce1' },
  { id: 'players',   label: 'Players',   icon: Users,           accent: '#00d4ff' },
  { id: 'banned',    label: 'Banned',    icon: UserX,           accent: '#ff2d55' },
  { id: 'security',  label: 'Security',  icon: Shield,          accent: '#ff6b2b' },
  { id: 'analytics', label: 'Analytics', icon: BarChart2,       accent: '#8b5cf6' },
  { id: 'games',     label: 'Games',     icon: Gamepad2,        accent: '#00d4ff' },
  { id: 'setup',     label: 'Setup',     icon: Settings,        accent: '#64748b' },
];

const DOVE_LOGO = `${import.meta.env.BASE_URL}https://plain-weur-prod-public.komododecks.com/202606/24/B2pLpgAMoJOibhac9Jlk/image.png`;
const STORAGE_KEY = 'hrya_auth_v2';

function loadStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { authed: false, owner: '' };
    const obj = JSON.parse(raw);
    if (obj.expires && Date.now() > obj.expires) { localStorage.removeItem(STORAGE_KEY); return { authed: false, owner: '' }; }
    return { authed: true, owner: obj.owner || '' };
  } catch { return { authed: false, owner: '' }; }
}
function saveAuth(owner: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ authed: true, owner, expires: Date.now() + 7 * 86400 * 1000 }));
}
function clearAuth() { localStorage.removeItem(STORAGE_KEY); }

/* ── Intro ─────────────────────────────────────────────────────────────── */
function IntroScreen() {
  const [visible, setVisible] = useState(true);
  useEffect(() => { const t = setTimeout(() => setVisible(false), 2700); return () => clearTimeout(t); }, []);
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center intro-overlay pointer-events-none overflow-hidden"
      style={{ background: '#030812' }}>
      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-40" />
      {/* Radial glow */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(108,60,225,0.18) 0%, rgba(0,212,255,0.06) 50%, transparent 70%)' }} />
      </div>
      {/* Particles */}
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="absolute rounded-full"
          style={{
            width: Math.random() * 3 + 1, height: Math.random() * 3 + 1,
            background: i % 3 === 0 ? '#6c3ce1' : i % 3 === 1 ? '#00d4ff' : '#8b5cf6',
            left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`,
            opacity: Math.random() * 0.6 + 0.2,
            animation: `particleRise ${2 + Math.random() * 3}s ease-out ${Math.random() * 1.5}s both`,
          }} />
      ))}
      <div className="relative z-10 text-center">
        <div className="intro-logo mb-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto shadow-2xl purple-pulse"
            style={{ border: '1.5px solid rgba(108,60,225,0.5)' }}>
            <img src={DOVE_LOGO} alt="HRYA" className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>
        <div className="intro-text">
          <h1 className="text-5xl font-black tracking-wider uppercase gradient-text"
            style={{ fontFamily: 'Exo 2, sans-serif' }}>HRYA</h1>
          <p className="text-slate-500 text-xs mt-2 tracking-[0.4em] uppercase">Admin Panel · v2.0</p>
          <div className="flex items-center justify-center gap-1.5 mt-5">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="h-0.5 rounded-full"
                style={{
                  width: i === 2 ? 24 : 8,
                  background: i === 2 ? '#6c3ce1' : '#1a2a45',
                  animation: `pulseSlow 1.2s ease-in-out ${i * 0.15}s infinite`,
                }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Lockdown Modal ─────────────────────────────────────────────────────── */
function LockdownModal({ mode, onClose, onSuccess }: { mode: 'activate' | 'deactivate'; onClose: () => void; onSuccess: () => void }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const ivRef = useRef<ReturnType<typeof setInterval>>();
  const isActivate = mode === 'activate';

  useEffect(() => {
    API.generate2FA(isActivate ? 'emergency-lockdown' : 'restore-lockdown')
      .then(() => { setSent(true); setSending(false); })
      .catch(() => { setErr('Failed to send code to Discord.'); setSending(false); });
    ivRef.current = setInterval(() => {
      setCountdown(c => { if (c <= 1) { clearInterval(ivRef.current); onClose(); return 0; } return c - 1; });
    }, 1000);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, []);

  async function verify() {
    if (!code.trim() || loading) return;
    setLoading(true); setErr('');
    try {
      const res = await API.verify2FA(code.trim());
      if (res.success) { clearInterval(ivRef.current); onSuccess(); }
      else { setErr('Invalid or expired code.'); setCode(''); }
    } catch { setErr('Verification failed.'); }
    setLoading(false);
  }

  const pct = (countdown / 60) * 100;
  const r = 20; const circ = 2 * Math.PI * r;
  const accent = isActivate ? '#ff2d55' : '#00ff88';
  const accentDim = isActivate ? 'rgba(255,45,85,0.15)' : 'rgba(0,255,136,0.12)';
  const accentBorder = isActivate ? 'rgba(255,45,85,0.35)' : 'rgba(0,255,136,0.3)';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(3,8,18,0.95)', backdropFilter: 'blur(12px)' }}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden animate-in"
        style={{ background: '#0a1220', border: `1.5px solid ${accentBorder}`, boxShadow: `0 0 60px ${accent}30, 0 25px 80px rgba(0,0,0,0.8)` }}>
        {/* Header */}
        <div className="px-6 pt-6 pb-5 flex items-center gap-4"
          style={{ borderBottom: `1px solid ${accentBorder}30`, background: `linear-gradient(135deg, ${accentDim}, transparent)` }}>
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: accentDim, border: `1.5px solid ${accentBorder}` }}>
            {isActivate ? <Swords size={20} style={{ color: accent }} /> : <Unlock size={20} style={{ color: accent }} />}
          </div>
          <div className="flex-1">
            <h2 className="font-black text-lg text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>
              {isActivate ? 'Emergency Lockdown' : 'Restore Operations'}
            </h2>
            <p className="text-slate-500 text-xs mt-0.5">Discord verification required</p>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* What happens */}
          <div className="rounded-xl p-4 space-y-2 text-sm" style={{ background: `${accentDim}`, border: `1px solid ${accentBorder}` }}>
            {(isActivate ? ['Kick ALL active players', 'Shutdown ALL game servers', 'Block all new joins', 'Log out all sessions'] :
              ['Restore all game access', 'Allow players to join', 'Re-enable all games', 'Resume normal operations']
            ).map(t => (
              <div key={t} className="flex items-center gap-2" style={{ color: '#94a3b8' }}>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accent }} />{t}
              </div>
            ))}
          </div>

          {/* Discord status */}
          <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#060c18', border: '1px solid #1a2a45' }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.3)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
            </div>
            <div className="flex-1">
              {sending ? <p className="text-slate-400 text-sm">Sending code to Discord...</p>
                : sent ? <p className="text-white text-sm font-semibold">Code sent to Discord <span style={{ color: '#00ff88' }}>✓</span></p>
                : <p className="text-sm" style={{ color: '#ff2d55' }}>{err}</p>}
              <p className="text-slate-600 text-xs mt-0.5">Check your admin channel</p>
            </div>
          </div>

          {/* Input + countdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-500 text-xs uppercase tracking-widest flex items-center gap-1.5">
                <KeyRound size={11} />Enter Code
              </label>
              <div className="flex items-center gap-2">
                <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
                  <circle cx="24" cy="24" r={r} fill="none" stroke="#1a2a45" strokeWidth="3" />
                  <circle cx="24" cy="24" r={r} fill="none" stroke={countdown > 15 ? accent : '#ff2d55'}
                    strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
                    style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }} />
                  <text x="24" y="28" textAnchor="middle" fill="white" fontSize="11"
                    fontWeight="bold" fontFamily="Exo 2, sans-serif"
                    style={{ transform: 'rotate(90deg)', transformOrigin: '24px 24px' }}>{countdown}</text>
                </svg>
                <span className="text-xs text-slate-600" style={{ color: countdown <= 15 ? '#ff2d55' : undefined }}>
                  {countdown <= 15 ? 'Expiring!' : 'seconds'}
                </span>
              </div>
            </div>
            <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} maxLength={6}
              className="input text-center font-black tracking-[0.6em]"
              style={{ fontSize: '28px', letterSpacing: '0.5em', fontFamily: 'Exo 2, sans-serif' }}
              placeholder="000000" autoComplete="one-time-code" inputMode="numeric"
              onKeyDown={e => e.key === 'Enter' && verify()} disabled={!sent || loading} />
          </div>

          {err && sent && (
            <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff2d55' }}>
              <AlertTriangle size={13} />{err}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose} className="btn-ghost flex-1 justify-center">Cancel</button>
            <button onClick={verify} disabled={loading || !sent || code.length < 6}
              className="flex-1 font-black py-3 rounded-xl transition-all disabled:opacity-40 text-white flex items-center justify-center gap-2"
              style={{ background: `linear-gradient(135deg, ${accent}cc, ${accent})`, boxShadow: loading ? 'none' : `0 0 20px ${accent}40` }}>
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</>
                : <>{isActivate ? <Swords size={14} /> : <Unlock size={14} />}{isActivate ? 'Execute Lockdown' : 'Restore Access'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Lockdown Banner ────────────────────────────────────────────────────── */
function LockdownBanner({ mode, onDismiss }: { mode: 'activated' | 'deactivated'; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4500); return () => clearTimeout(t); }, [onDismiss]);
  const isActive = mode === 'activated';
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center grid-bg"
      style={{ background: isActive ? 'rgba(3,1,1,0.97)' : 'rgba(1,4,3,0.97)' }}>
      <div className="text-center animate-in">
        <div className="w-28 h-28 rounded-3xl flex items-center justify-center mx-auto mb-6"
          style={{
            background: isActive ? 'rgba(255,45,85,0.1)' : 'rgba(0,255,136,0.1)',
            border: isActive ? '2px solid rgba(255,45,85,0.5)' : '2px solid rgba(0,255,136,0.5)',
            boxShadow: isActive ? '0 0 60px rgba(255,45,85,0.3)' : '0 0 60px rgba(0,255,136,0.3)',
            animation: isActive ? 'pulseSlow 1s ease-in-out infinite' : 'none',
          }}>
          {isActive ? <Swords size={48} style={{ color: '#ff2d55' }} /> : <Unlock size={48} style={{ color: '#00ff88' }} />}
        </div>
        <h1 className="text-5xl font-black uppercase tracking-widest mb-3" style={{
          fontFamily: 'Exo 2, sans-serif',
          color: isActive ? '#ff2d55' : '#00ff88',
          textShadow: isActive ? '0 0 40px rgba(255,45,85,0.7)' : '0 0 40px rgba(0,255,136,0.7)',
        }}>
          {isActive ? 'LOCKDOWN ACTIVE' : 'OPERATIONS RESTORED'}
        </h1>
        <p className="text-slate-500 text-base">{isActive ? 'All servers shut down. No players can join.' : 'All systems restored.'}</p>
        <p className="text-slate-700 text-sm mt-3">Closing automatically...</p>
      </div>
    </div>
  );
}

/* ── Main App ────────────────────────────────────────────────────────────── */
export default function App() {
  const stored = loadStoredAuth();
  const [authed, setAuthed] = useState(stored.authed);
  const [ownerName, setOwnerName] = useState(stored.owner);
  const [showIntro, setShowIntro] = useState(true);
  const [page, setPage] = useState<Page>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lockdownActive, setLockdownActive] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [lockdownModal, setLockdownModal] = useState<'activate' | 'deactivate' | null>(null);
  const [lockdownBanner, setLockdownBanner] = useState<'activated' | 'deactivated' | null>(null);
  const toastRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { const t = setTimeout(() => setShowIntro(false), 2800); return () => clearTimeout(t); }, []);

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ msg, type });
    if (toastRef.current) clearTimeout(toastRef.current);
    toastRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const loadNotifs = useCallback(async () => {
    try { const res = await API.getActivityLog(50); setNotifs(res.logs ?? []); } catch { }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadNotifs();
    const iv = setInterval(loadNotifs, 30000);
    return () => clearInterval(iv);
  }, [authed, loadNotifs]);

  useEffect(() => {
    if (!authed) return;
    API.getGameStats().then(r => { if (r.stats?.kill_game_active) setLockdownActive(true); }).catch(() => { });
  }, [authed]);

  // Hidden keyboard shortcuts
  useEffect(() => {
    if (!authed) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        if (lockdownActive) { showToast('Lockdown already active.', 'error'); return; }
        setLockdownModal('activate');
      }
      if (e.ctrlKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        if (!lockdownActive) { showToast('No lockdown is active.', 'info'); return; }
        setLockdownModal('deactivate');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [authed, lockdownActive, showToast]);

  async function executeLockdown() {
    try {
      await Promise.all([API.emergencyLockdown('', ''), API.killGameActivate(), API.shutdown(undefined, true)]);
      setLockdownActive(true);
      setLockdownModal(null);
      setLockdownBanner('activated');
      setTimeout(() => { setAuthed(false); clearAuth(); }, 4600);
    } catch { showToast('Lockdown execution failed', 'error'); setLockdownModal(null); }
  }

  async function executeRestore() {
    try {
      await API.killGameDeactivate();
      setLockdownActive(false);
      setLockdownModal(null);
      setLockdownBanner('deactivated');
    } catch { showToast('Restore failed', 'error'); setLockdownModal(null); }
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;

  if (!authed) {
    return (<>
      <IntroScreen />
      <Login onLogin={owner => { setAuthed(true); setOwnerName(owner); saveAuth(owner); }} />
    </>);
  }

  const PAGES: Record<Page, React.ComponentType> = {
    dashboard: Dashboard, players: Players, banned: Banned,
    security: Security, analytics: Analytics, games: Games, setup: Setup,
  };
  const PageComponent = PAGES[page];

  return (
    <div className="min-h-screen flex relative" style={{ background: '#060c18' }}>
      {/* Subtle background — simple static glow, no motion */}
      <div className="ambient-bg">
        <div className="ambient-static-glow" />
      </div>

      {showIntro && <IntroScreen />}
      {lockdownBanner && <LockdownBanner mode={lockdownBanner} onDismiss={() => setLockdownBanner(null)} />}
      {lockdownModal && (
        <LockdownModal mode={lockdownModal} onClose={() => setLockdownModal(null)}
          onSuccess={() => { if (lockdownModal === 'activate') executeLockdown(); else executeRestore(); }} />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[60] animate-toast px-5 py-3 rounded-xl text-sm font-semibold shadow-2xl max-w-sm flex items-center gap-3"
          style={{
            background: toast.type === 'success' ? 'rgba(0,255,136,0.1)' : toast.type === 'error' ? 'rgba(255,45,85,0.1)' : '#0d1526',
            border: toast.type === 'success' ? '1px solid rgba(0,255,136,0.3)' : toast.type === 'error' ? '1px solid rgba(255,45,85,0.3)' : '1px solid #1a2a45',
            color: toast.type === 'success' ? '#00ff88' : toast.type === 'error' ? '#ff2d55' : '#00d4ff',
            boxShadow: toast.type === 'success' ? '0 0 20px rgba(0,255,136,0.15)' : toast.type === 'error' ? '0 0 20px rgba(255,45,85,0.15)' : 'none',
          }}>
          <Zap size={14} />{toast.msg}
        </div>
      )}

      {/* Mobile overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full z-40 flex flex-col transition-transform duration-300 relative ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:flex`}
        style={{ width: '220px', background: '#0a1220', borderRight: '1px solid #1a2a45', flexShrink: 0 }}>

        {/* Logo */}
        <div className="px-5 py-5 flex items-center gap-3" style={{ borderBottom: '1px solid #1a2a45' }}>
          <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 purple-pulse"
            style={{ border: '1.5px solid rgba(108,60,225,0.5)' }}>
            <img src={DOVE_LOGO} alt="HRYA" className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div>
            <div className="font-black text-sm tracking-widest text-white uppercase" style={{ fontFamily: 'Exo 2, sans-serif' }}>HRYA</div>
            <div className="text-[10px] tracking-wider" style={{ color: '#334155' }}>ADMIN PANEL</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon, accent }) => {
            const isActive = page === id;
            return (
              <button key={id} onClick={() => { setPage(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 relative
                  ${isActive ? 'nav-active' : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'}`}>
                {isActive && (
                  <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ background: accent || '#6c3ce1' }} />
                )}
                <Icon size={15} style={isActive ? { color: accent || '#8b5cf6' } : {}} />
                {label}
                {isActive && <ChevronRight size={12} className="ml-auto opacity-40" />}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-3 space-y-1" style={{ borderTop: '1px solid #1a2a45' }}>
          {lockdownActive && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
              style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.25)', color: '#ff2d55', animation: 'pulseSlow 1.5s ease-in-out infinite' }}>
              <Swords size={11} />LOCKDOWN ACTIVE
            </div>
          )}
          <button onClick={() => { setAuthed(false); clearAuth(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 text-slate-600 hover:text-red-400 hover:bg-red-500/[0.06]">
            <LogOut size={15} />Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col min-h-screen relative" style={{ background: 'transparent' }}>
        {/* Top bar */}
        <header className="flex items-center justify-between px-5 py-3 sticky top-0 z-20 gap-3"
          style={{ background: 'rgba(10,18,32,0.95)', borderBottom: '1px solid #1a2a45', backdropFilter: 'blur(12px)' }}>
          {/* Mobile menu */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-white transition-colors">
            <Menu size={20} />
          </button>
          {/* Page title (mobile) */}
          <span className="lg:hidden font-black text-sm uppercase tracking-wider text-white" style={{ fontFamily: 'Exo 2, sans-serif' }}>HRYA</span>

          {/* Spacer (desktop) */}
          <div className="hidden lg:flex items-center gap-2">
            <Activity size={13} style={{ color: '#6c3ce1' }} />
            <span className="text-xs text-slate-600 uppercase tracking-widest">Live · {new Date().toLocaleTimeString()}</span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {/* Notifications */}
            <div className="relative">
              <button onClick={() => { setShowNotifs(v => !v); loadNotifs(); }}
                className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 text-slate-500 hover:text-white"
                style={{ background: '#0d1526', border: '1px solid #1a2a45' }}>
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white"
                    style={{ background: '#6c3ce1', boxShadow: '0 0 10px rgba(108,60,225,0.6)' }}>
                    {Math.min(unreadCount, 9)}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute top-11 right-0 w-96 rounded-xl z-50 max-h-[28rem] overflow-hidden flex flex-col shadow-2xl animate-in"
                  style={{ background: '#0d1526', border: '1px solid #1a2a45' }}>
                  <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #1a2a45' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold text-sm">Activity Log</span>
                      {unreadCount > 0 && (
                        <span className="badge badge-purple">{unreadCount}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {notifs.length > 0 && (
                        <>
                          <button onClick={async () => { await API.markActivityRead(undefined, true); setNotifs(ns => ns.map(n => ({ ...n, is_read: true }))); }}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all"
                            style={{ color: '#00ff88' }}>
                            <Check size={10} />All Read
                          </button>
                          <button onClick={async () => { if (!confirm('Delete ALL?')) return; await API.deleteActivityLog(undefined, true); setNotifs([]); }}
                            className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg transition-all text-slate-500 hover:text-red-400">
                            <Trash2 size={10} />Clear
                          </button>
                        </>
                      )}
                      <button onClick={() => setShowNotifs(false)} className="text-slate-600 hover:text-white px-1">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                  {notifs.length === 0 ? (
                    <div className="px-4 py-10 text-center text-slate-600 text-sm">No activity yet</div>
                  ) : (
                    <div className="overflow-y-auto flex-1 divide-y" style={{ borderColor: '#111e35' }}>
                      {notifs.map(n => (
                        <div key={n.id} onClick={() => API.markActivityRead(n.id).then(() => setNotifs(ns => ns.map(x => x.id === n.id ? { ...x, is_read: true } : x)))}
                          className="px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02]"
                          style={{ background: !n.is_read ? 'rgba(108,60,225,0.03)' : undefined }}>
                          <div className="flex items-center gap-2 text-xs">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${n.action_type?.includes('ban') ? 'bg-red-400' : n.action_type?.includes('warn') ? 'bg-yellow-400' : n.action_type?.includes('kick') ? 'bg-orange-400' : 'bg-purple-400'}`} />
                            <span className="font-semibold" style={{ color: '#8b5cf6' }}>{n.performed_by}</span>
                            <span className="text-slate-600">→</span>
                            <span className="text-slate-400">{n.action_type}</span>
                            {n.target_username && <span style={{ color: '#00d4ff' }} className="font-medium">{n.target_username}</span>}
                            {!n.is_read && <div className="w-1.5 h-1.5 rounded-full ml-auto shrink-0" style={{ background: '#6c3ce1' }} />}
                          </div>
                          <div className="text-slate-700 text-xs mt-0.5 ml-3.5">
                            {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Owner badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(108,60,225,0.1)', border: '1px solid rgba(108,60,225,0.25)' }}>
              <Crown size={12} style={{ color: '#8b5cf6' }} />
              <div className="status-dot-purple" style={{ width: 6, height: 6 }} />
              <span className="text-sm font-bold" style={{ color: '#c4b5fd' }}>{ownerName}</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <div key={page} className="page-enter">
            <PageComponent />
          </div>
        </main>
      </div>
    </div>
  );
}
