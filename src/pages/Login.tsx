import { useState, useEffect, useRef } from 'react';
import { Shield, Eye, EyeOff, Lock, KeyRound, ChevronRight, Zap, Activity, Crown, Fingerprint } from 'lucide-react';
import { API, OWNER_NAMES, OWNER_IDS, OWNER_IMAGES } from '../lib/api';

interface Props { onLogin: (ownerName: string) => void; }

// ── Owner passwords (hardcoded) ────────────────────────────────────────────
const OWNER_PASSWORDS: Record<string, string> = {
  Nexus:   'HRYATEAM',
  Luna:    'HRYATEAM',
  Youssef: 'LOVENORANFOREVER',
};

const OWNER_COLORS: Record<string, string> = {
  Nexus:   '#ffffff',
  Luna:    '#ff86ff',
  Youssef: '#ff0000',
};

const OWNER_TITLES: Record<string, string> = {
  Nexus:   'باشا متعدد مواهب جدا',
  Luna:    'باشايه مفكره',
  Youssef: 'باشا الي عامل ويب (حرامي قد دنيا)',
};

const OWNERS = OWNER_IDS.map(id => ({ id, name: OWNER_NAMES[id] }));
const DOVE_LOGO = 'https://plain-weur-prod-public.komododecks.com/202606/24/B2pLpgAMoJOibhac9Jlk/image.png';

// ── Discord Webhook Config ─────────────────────────────────────────────────
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1519070366109274215/45027CrrqLHeadS3_or8WwZi_5IIOK3NarkQHoHGau4LGM5basj_F94uS0TH-TZH1-8l';

// ── Per-owner Passkey storage (client-side only, 1 per owner) ─────────────
function getPasskeyStorageKey(ownerName: string): string {
  return `hrya_passkey_${ownerName}`;
}

interface StoredPasskey {
  id: string;
  name: string;
  createdAt: string;
}

function getStoredPasskey(ownerName: string): StoredPasskey | null {
  try {
    const raw = localStorage.getItem(getPasskeyStorageKey(ownerName));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasPasskey(ownerName: string): boolean {
  return getStoredPasskey(ownerName) !== null;
}

function savePasskey(ownerName: string, secret: string): { success: boolean; error?: string } {
  if (hasPasskey(ownerName)) {
    return { success: false, error: `Passkey already exists for ${ownerName}. Remove it first to create a new one.` };
  }
  const newPasskey: StoredPasskey = {
    id: crypto.randomUUID(),
    name: secret.trim(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(getPasskeyStorageKey(ownerName), JSON.stringify(newPasskey));
  return { success: true };
}

function verifyPasskey(ownerName: string, input: string): boolean {
  const pk = getStoredPasskey(ownerName);
  return pk !== null && pk.name === input.trim();
}

function deletePasskey(ownerName: string): void {
  localStorage.removeItem(getPasskeyStorageKey(ownerName));
}

// ── Generate 6-digit code ──────────────────────────────────────────────────
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ── Send code to Discord webhook ───────────────────────────────────────────
async function sendCodeToWebhook(
  code: string,
  ownerName: string,
  ip?: string,
  location?: string
): Promise<void> {
  const timestamp = new Date().toLocaleString('en-US', { timeZone: 'UTC' });

  const content = `🔐 **2FA Verification Code** — ${ownerName}`;
  const embedDescription = `**Code:** \`${code}\`
**Time:** ${timestamp} UTC`;

  const payload = {
    username: 'HRYA Security',
    avatar_url: 'https://cdn.discordapp.com/embed/avatars/0.png',
    content,
    embeds: [{
      title: 'Login Verification',
      description: embedDescription,
      color: 0x6c3ce1,
      fields: [
        { name: 'Owner', value: ownerName, inline: true },
        { name: 'IP', value: ip || 'Unknown', inline: true },
        { name: 'Location', value: location || 'Unknown', inline: true },
      ],
      footer: { text: 'HRYA Admin Panel • 2FA' },
      timestamp: new Date().toISOString(),
    }],
  };

  const res = await fetch(DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook failed: ${res.status} ${res.statusText}`);
  }
}

export default function Login({ onLogin }: Props) {
  const [step, setStep] = useState<'owner' | 'password' | 'passkey' | '2fa'>('owner');
  const [selectedOwner, setSelectedOwner] = useState<{ id: number; name: string } | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [passkeyInput, setPasskeyInput] = useState('');
  const [passkeyMode, setPasskeyMode] = useState<'verify' | 'create'>('verify');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();
  const [time, setTime] = useState(new Date());
  const [attempts, setAttempts] = useState(0);
  const [current2FACode, setCurrent2FACode] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  function startCooldown() {
    setCooldown(60);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => { if (c <= 1) { clearInterval(cooldownRef.current); return 0; } return c - 1; });
    }, 1000);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOwner || loading) return;
    setLoading(true); setError('');

    const expected = OWNER_PASSWORDS[selectedOwner.name];
    const passwordOk = expected && password === expected;

    if (!passwordOk) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setError(newAttempts >= 3 ? 'Too many failed attempts. Try again later.' : 'Incorrect password.');
      try {
        let ip = 'Unknown', location = 'Unknown';
        const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
        if (ipRes?.ok) {
          const d = await ipRes.json().catch(() => ({}));
          ip = d.ip || 'Unknown'; location = d.city ? `${d.city}, ${d.country_name}` : 'Unknown';
        }
        await API.loginEvent(ip, location, false);
      } catch { }
      setLoading(false);
      return;
    }

    // Password correct — check if this owner has a passkey
    const ownerHasPk = hasPasskey(selectedOwner.name);
    setPasskeyMode(ownerHasPk ? 'verify' : 'create');
    setStep('passkey');
    setPasskeyInput('');
    setLoading(false);
  }

  async function proceedTo2FA() {
    try {
      let ip = 'Unknown', location = 'Unknown';
      const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
      if (ipRes?.ok) {
        const d = await ipRes.json().catch(() => ({}));
        ip = d.ip || 'Unknown'; location = d.city ? `${d.city}, ${d.country_name}` : 'Unknown';
      }

      const newCode = generateCode();
      setCurrent2FACode(newCode);
      setCode('');

      await sendCodeToWebhook(newCode, selectedOwner!.name, ip, location);
      await API.loginEvent(ip, location, true);

      setStep('2fa');
      startCooldown();
    } catch (err) {
      setError('Failed to send 2FA code to Discord. Check webhook URL.');
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passkeyInput.trim() || !selectedOwner || loading) return;

    setLoading(true); 
    setError('');

    if (passkeyMode === 'verify') {
      if (!verifyPasskey(selectedOwner.name, passkeyInput)) {
        setError('Invalid passkey.');
        setLoading(false);
        return;
      }
    } else {
      const result = savePasskey(selectedOwner.name, passkeyInput);
      if (!result.success) {
        setError(result.error || 'Cannot save passkey.');
        setLoading(false);
        return;
      }
    }

    await proceedTo2FA();
  }

  async function handle2FA(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || !selectedOwner || loading) return;
    setLoading(true); setError('');

    if (code.trim() === current2FACode) {
      onLogin(selectedOwner.name);
    } else {
      setError('Invalid or expired code.');
      setCode('');
    }
    setLoading(false);
  }

  async function handleResendCode() {
    if (cooldown > 0 || loading || !selectedOwner) return;
    setLoading(true); setError('');
    try { 
      const newCode = generateCode();
      setCurrent2FACode(newCode);
      setCode('');

      let ip = 'Unknown', location = 'Unknown';
      const ipRes = await fetch('https://ipapi.co/json/').catch(() => null);
      if (ipRes?.ok) {
        const d = await ipRes.json().catch(() => ({}));
        ip = d.ip || 'Unknown'; location = d.city ? `${d.city}, ${d.country_name}` : 'Unknown';
      }

      await sendCodeToWebhook(newCode, selectedOwner.name, ip, location);
      startCooldown(); 
    } catch { 
      setError('Failed to resend code.'); 
    } finally {
      setLoading(false);
    }
  }

  const color = selectedOwner ? OWNER_COLORS[selectedOwner.name] || '#6c3ce1' : '#6c3ce1';

  return (
    <div className="min-h-screen flex" style={{ background: '#030812' }}>
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] shrink-0 p-10 relative overflow-hidden"
        style={{ background: '#0a1220', borderRight: '1px solid #1a2a45' }}>
        <div className="absolute inset-0 grid-bg opacity-25" />
        <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-[140px] pointer-events-none"
          style={{ background: `rgba(108,60,225,0.12)` }} />
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[120px] pointer-events-none"
          style={{ background: `rgba(0,212,255,0.05)` }} />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl overflow-hidden purple-pulse"
              style={{ border: '1.5px solid rgba(108,60,225,0.5)' }}>
              <img src={DOVE_LOGO} alt="HRYA" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div>
              <div className="font-black text-xl text-white uppercase tracking-widest" style={{ fontFamily: 'Exo 2, sans-serif' }}>HRYA</div>
              <div className="text-xs tracking-wider" style={{ color: '#334155' }}>ADMIN PANEL</div>
            </div>
          </div>

          {selectedOwner ? (
            <div className="rounded-2xl overflow-hidden mb-6" style={{ border: `1px solid ${color}30` }}>
              <div className="relative h-32">
                <img src={OWNER_IMAGES[selectedOwner.name]} alt={selectedOwner.name}
                  className="w-full h-full object-cover" style={{ filter: 'brightness(0.5)' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${color}40, transparent)` }} />
                <div className="absolute bottom-3 left-4 flex items-end gap-3">
                  <div className="w-12 h-12 rounded-xl overflow-hidden" style={{ border: `2px solid ${color}` }}>
                    <img src={OWNER_IMAGES[selectedOwner.name]} alt={selectedOwner.name}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div>
                    <div className="text-white font-black text-base" style={{ fontFamily: 'Exo 2, sans-serif' }}>{selectedOwner.name}</div>
                    <div className="text-xs" style={{ color: `${color}cc` }}>{OWNER_TITLES[selectedOwner.name]}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 space-y-3">
              {OWNERS.map(o => {
                const c = OWNER_COLORS[o.name] || '#6c3ce1';
                const pkExists = hasPasskey(o.name);
                return (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: '#060c18', border: '1px solid #1a2a45' }}>
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0" style={{ border: `1px solid ${c}40` }}>
                      <img src={OWNER_IMAGES[o.name]} alt={o.name} className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    </div>
                    <div>
                      <div className="text-white text-sm font-bold">{o.name}</div>
                      <div className="text-xs" style={{ color: '#334155' }}>{OWNER_TITLES[o.name]}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-auto">
                      {pkExists && (
                        <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md" style={{ background: `${c}15`, color: `${c}cc`, border: `1px solid ${c}30` }}>
                          <Fingerprint size={10} />
                          <span>Locked</span>
                        </div>
                      )}
                      <div className="w-2 h-2 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            {[
              { icon: <Shield size={13} />, label: 'Discord 2FA Verification', color: '#6c3ce1' },
              { icon: <Activity size={13} />, label: 'Real-time Game Monitoring', color: '#00d4ff' },
              { icon: <Zap size={13} />, label: 'Instant Player Actions', color: '#00ff88' },
              { icon: <Fingerprint size={13} />, label: 'Passkey Protection', color: '#ff86ff' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${f.color}12`, border: `1px solid ${f.color}25`, color: f.color }}>{f.icon}</div>
                <span className="text-sm" style={{ color: '#475569' }}>{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-xs" style={{ color: '#1a2a45' }}>
          <div className="status-dot-green" style={{ width: 6, height: 6 }} />
          <span>Systems Online · {time.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4 purple-pulse"
              style={{ border: '1.5px solid rgba(108,60,225,0.5)' }}>
              <img src={DOVE_LOGO} alt="HRYA" className="w-full h-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <h1 className="text-3xl font-black text-white uppercase tracking-wider gradient-text"
              style={{ fontFamily: 'Exo 2, sans-serif' }}>HRYA</h1>
          </div>

          {/* Step 1: Select owner */}
          {step === 'owner' && (
            <div className="card-glow p-6 animate-in">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(108,60,225,0.12)', border: '1px solid rgba(108,60,225,0.25)' }}>
                  <Crown size={16} style={{ color: '#8b5cf6' }} />
                </div>
                <div>
                  <h2 className="text-white font-black text-base uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Select Identity</h2>
                  <p className="text-xs" style={{ color: '#334155' }}>Choose your owner account</p>
                </div>
              </div>

              <div className="space-y-2">
                {OWNERS.map(o => {
                  const c = OWNER_COLORS[o.name] || '#6c3ce1';
                  const pkExists = hasPasskey(o.name);
                  return (
                    <button key={o.id} onClick={() => { setSelectedOwner(o); setStep('password'); setError(''); setPassword(''); setAttempts(0); }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200 group text-left"
                      style={{ background: '#060c18', borderColor: '#1a2a45' }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = `${c}50`;
                        (e.currentTarget as HTMLElement).style.background = `${c}08`;
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = '#1a2a45';
                        (e.currentTarget as HTMLElement).style.background = '#060c18';
                      }}>
                      <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0" style={{ border: `1.5px solid ${c}40` }}>
                        <img src={OWNER_IMAGES[o.name]} alt={o.name} className="w-full h-full object-cover"
                          onError={e => { (e.currentTarget as HTMLElement).style.background = c; }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-white font-bold text-sm">{o.name}</div>
                        <div className="text-xs" style={{ color: '#334155' }}>{OWNER_TITLES[o.name]}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pkExists && (
                          <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md" style={{ background: `${c}15`, color: `${c}cc`, border: `1px solid ${c}30` }}>
                            <Fingerprint size={10} />
                            <span>Locked</span>
                          </div>
                        )}
                        <ChevronRight size={14} style={{ color: '#213354' }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Password */}
          {step === 'password' && selectedOwner && (
            <div className="card-glow p-6 animate-in" style={{ borderColor: `${color}20` }}>
              <div className="flex items-center gap-3 mb-5 p-3 rounded-xl" style={{ background: '#060c18', border: `1px solid ${color}20` }}>
                <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0" style={{ border: `2px solid ${color}` }}>
                  <img src={OWNER_IMAGES[selectedOwner.name]} alt={selectedOwner.name} className="w-full h-full object-cover"
                    onError={e => { (e.currentTarget as HTMLElement).style.background = color; }} />
                </div>
                <div className="flex-1">
                  <div className="text-white font-black text-base" style={{ fontFamily: 'Exo 2, sans-serif' }}>{selectedOwner.name}</div>
                  <div className="text-xs" style={{ color: `${color}80` }}>{OWNER_TITLES[selectedOwner.name]}</div>
                </div>
                <button onClick={() => { setStep('owner'); setError(''); }}
                  className="text-xs px-2 py-1 rounded-lg transition-all" style={{ color: '#334155', border: '1px solid #1a2a45' }}>
                  Change
                </button>
              </div>

              <form onSubmit={handlePassword} className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#334155' }}>
                    <Lock size={10} className="inline mr-1" />Password
                  </label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                      className="input pr-11" placeholder="Enter your password" autoComplete="new-password" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors" style={{ color: '#334155' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff2d55' }}>
                    <Shield size={12} />{error}
                  </div>
                )}

                <button type="submit" disabled={loading || !password.trim() || attempts >= 3}
                  className="btn-primary w-full justify-center py-3 disabled:opacity-40"
                  style={{ background: `linear-gradient(135deg, ${color}cc, ${color})`, boxShadow: `0 0 20px ${color}30` }}>
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Signing in...</>
                    : <><Zap size={14} className="mr-2" />Sign In</>}
                </button>
              </form>
            </div>
          )}

          {/* Step 3: Passkey */}
          {step === 'passkey' && selectedOwner && (
            <div className="card-glow p-6 animate-in" style={{ borderColor: 'rgba(255,134,255,0.2)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,134,255,0.1)', border: '1px solid rgba(255,134,255,0.25)' }}>
                  <Fingerprint size={16} style={{ color: '#ff86ff' }} />
                </div>
                <div>
                  <h2 className="text-white font-black text-base uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>
                    {passkeyMode === 'verify' ? 'Passkey Required' : 'Create Passkey'}
                  </h2>
                  <p className="text-xs" style={{ color: '#334155' }}>
                    {passkeyMode === 'verify'
                      ? 'Authenticate to continue'
                      : `Set up a passkey for ${selectedOwner.name} (1 per owner)`}
                  </p>
                </div>
              </div>

              {/* Passkey status — NEVER shows secret */}
              {passkeyMode === 'verify' && !showDeleteConfirm && (
                <div className="mb-4 p-3 rounded-xl flex items-center gap-3"
                  style={{ background: 'rgba(255,134,255,0.05)', border: '1px solid rgba(255,134,255,0.2)' }}>
                  <Fingerprint size={16} style={{ color: '#ff86ff' }} />
                  <div>
                    <div className="text-white text-sm font-bold">Passkey Active</div>
                    <div className="text-xs" style={{ color: '#334155' }}>
                      {selectedOwner.name} has a saved passkey on this device
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(true);
                      setDeletePassword('');
                      setError('');
                    }}
                    className="ml-auto text-xs px-2 py-1 rounded-md transition-colors hover:bg-red-500/10 hover:text-red-400"
                    style={{ color: '#334155' }}
                  >
                    Remove
                  </button>
                </div>
              )}

              {/* Delete confirmation — requires password "REPET" */}
              {showDeleteConfirm && (
                <div className="mb-4 p-4 rounded-xl space-y-3"
                  style={{ background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.2)' }}>
                  <div className="flex items-center gap-2">
                    <Shield size={14} style={{ color: '#ff2d55' }} />
                    <span className="text-sm font-bold" style={{ color: '#ff2d55' }}>Confirm Removal</span>
                  </div>
                  <p className="text-xs" style={{ color: '#334155' }}>
                    Enter deletion password to remove this passkey. This action cannot be undone.
                  </p>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={e => setDeletePassword(e.target.value)}
                    className="input"
                    placeholder="Enter deletion password"
                    autoComplete="off"
                    autoFocus
                  />
                  {error && (
                    <div className="flex items-center gap-2 text-xs rounded-lg px-3 py-2"
                      style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff2d55' }}>
                      <Shield size={10} />{error}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (deletePassword !== 'REPET') {
                          setError('Incorrect deletion password.');
                          return;
                        }
                        deletePasskey(selectedOwner.name);
                        setPasskeyMode('create');
                        setPasskeyInput('');
                        setDeletePassword('');
                        setShowDeleteConfirm(false);
                        setError('');
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: 'rgba(255,45,85,0.15)', color: '#ff2d55', border: '1px solid rgba(255,45,85,0.3)' }}
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowDeleteConfirm(false);
                        setDeletePassword('');
                        setError('');
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
                      style={{ background: '#060c18', color: '#334155', border: '1px solid #1a2a45' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

                <form onSubmit={handlePasskeySubmit} className="space-y-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#334155' }}>
                      <Lock size={10} className="inline mr-1" />
                      {passkeyMode === 'verify' ? 'Secret Passkey' : 'New Secret Passkey'}
                    </label>
                    <input
                      type="password"
                      value={passkeyInput}
                      onChange={e => setPasskeyInput(e.target.value)}
                      className="input"
                      placeholder={passkeyMode === 'verify' ? 'Enter your secret passkey' : 'Create a secret passkey'}
                      autoComplete="off"
                    />
                    {passkeyMode === 'create' && (
                      <div className="text-xs mt-1.5" style={{ color: '#334155' }}>
                        1 passkey per owner. Stored encrypted locally.
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2.5"
                      style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff2d55' }}>
                      <Shield size={12} />{error}
                    </div>
                  )}

                  <button type="submit" disabled={loading || !passkeyInput.trim()}
                    className="btn-primary w-full justify-center py-3 disabled:opacity-40"
                    style={{ background: `linear-gradient(135deg, #ff86ffcc, #ff86ff)`, boxShadow: `0 0 20px rgba(255,134,255,0.2)` }}>
                    {loading
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Verifying...</>
                      : <><Fingerprint size={14} className="mr-2" />{passkeyMode === 'verify' ? 'Verify Passkey' : 'Save Passkey'}</>}
                  </button>
                </form>

              {passkeyMode === 'verify' && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setDeletePassword('');
                    setError('');
                  }}
                  className="w-full text-center text-sm py-2 mt-2 transition-colors hover:text-red-400"
                  style={{ color: '#334155' }}
                >
                  Reset Passkey (Create New)
                </button>
              )}
            </div>
          )}

          {/* Step 4: 2FA */}
          {step === '2fa' && selectedOwner && (
            <div className="card-glow p-6 animate-in" style={{ borderColor: 'rgba(0,212,255,0.2)' }}>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.25)' }}>
                  <KeyRound size={16} style={{ color: '#00d4ff' }} />
                </div>
                <div>
                  <h2 className="text-white font-black text-base uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Verification</h2>
                  <p className="text-xs" style={{ color: '#334155' }}>Code sent to Discord channel</p>
                </div>
              </div>

              <div className="rounded-xl px-4 py-3 text-xs mb-5"
                style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', color: '#00d4ff' }}>
                Enter the 6-digit code from your Discord admin channel. Code expires in 5 minutes.
              </div>

              <form onSubmit={handle2FA} className="space-y-4">
                <div>
                  <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#334155' }}>6-Digit Code</label>
                  <input type="text" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} maxLength={6}
                    className="input text-center font-black tracking-[0.5em]"
                    style={{ fontSize: '26px', letterSpacing: '0.5em', fontFamily: 'Exo 2, sans-serif' }}
                    placeholder="000000" autoComplete="one-time-code" inputMode="numeric" />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff2d55' }}>
                    <Shield size={12} />{error}
                  </div>
                )}

                <button type="submit" disabled={loading || !code.trim()} className="btn-primary w-full justify-center py-3 disabled:opacity-40">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Verifying...</>
                    : <><KeyRound size={14} className="mr-2" />Verify Code</>}
                </button>

                <button type="button" onClick={handleResendCode}
                  disabled={cooldown > 0 || loading}
                  className="w-full text-center text-sm py-2 transition-colors disabled:opacity-40"
                  style={{ color: cooldown > 0 ? '#1a2a45' : '#6c3ce1' }}>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Code'}
                </button>
              </form>
            </div>
          )}

          <p className="text-center text-xs mt-5 uppercase tracking-widest" style={{ color: '#1a2a45' }}>HRYA-sadiaa · 2026</p>
        </div>
      </div>
    </div>
  );
}