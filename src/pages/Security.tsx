import { useState, useEffect, useCallback } from 'react';
import { Shield, Ban, XCircle, RefreshCw, ExternalLink, Crown, Send } from 'lucide-react';
import { API, timeSince, robloxProfileUrl, OWNER_IDS } from '../lib/api';

interface Flag {
  id: number; roblox_user_id: number; username: string; flag_type: string;
  description: string; severity: 'low'|'medium'|'high'|'critical'; status: 'open'|'banned'|'dismissed';
  server_id: string; created_at: string;
}

const SEV: Record<string, { pill: string; glow: string }> = {
  low:      { pill: 'badge badge-low',    glow: '' },
  medium:   { pill: 'badge badge-medium', glow: '' },
  high:     { pill: 'badge badge-high',   glow: '' },
  critical: { pill: 'badge badge-critical', glow: 'glow-red' },
};

const FLAG_ICON: Record<string, string> = {
  'Alt Account':'👥','Exploiter':'💥','Impossible Speed':'⚡','Spam':'📨','Remote Abuse':'🔧','Teleport Abuse':'🌀',
};

const DETECT_TYPES = [
  { t:'Alt Account', d:'Multiple accounts from same source', s:'high' },
  { t:'Exploiter', d:'Exploit scripts detected', s:'critical' },
  { t:'Impossible Speed', d:'Speed exceeds max allowed', s:'high' },
  { t:'Spam', d:'Excessive messages or actions', s:'medium' },
  { t:'Remote Abuse', d:'RemoteEvent abuse detected', s:'high' },
  { t:'Teleport Abuse', d:'Unauthorized teleport', s:'medium' },
];

export default function Security() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [filter, setFilter] = useState<'all'|'open'|'banned'|'dismissed'>('all');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string|null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(()=>setToast(null),3000); }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await API.getSecurity();
    setFlags(res.flags ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function doBan(flag: Flag) {
    if (OWNER_IDS.includes(Number(flag.roblox_user_id))) return;
    await API.banFromSecurity(flag.id, flag.roblox_user_id, flag.username);
    setFlags(f => f.map(x => x.id===flag.id ? {...x, status:'banned'} : x));
    showToast(`Permanently banned ${flag.username} for security violation`);
  }

  async function dismiss(id: number) {
    await API.dismissSecurity(id);
    setFlags(f => f.map(x => x.id===id ? {...x, status:'dismissed'} : x));
    showToast('Flag dismissed');
  }

  async function sendDiscord(flag: Flag) {
    await API.sendDiscord({ embeds: [{ title: `Security Alert: ${flag.flag_type}`, color: 0xef4444, fields: [
      { name: 'Player', value: flag.username||'Unknown', inline: true },
      { name: 'User ID', value: String(flag.roblox_user_id), inline: true },
      { name: 'Severity', value: flag.severity, inline: true },
      { name: 'Server', value: flag.server_id||'Unknown', inline: true },
      { name: 'Status', value: flag.status, inline: true },
      { name: 'Description', value: flag.description||'—', inline: false },
    ] }] });
    showToast('Alert sent to Discord');
  }

  const filtered = filter==='all' ? flags : flags.filter(f=>f.status===filter);
  const counts = { all: flags.length, open: flags.filter(f=>f.status==='open').length, banned: flags.filter(f=>f.status==='banned').length, dismissed: flags.filter(f=>f.status==='dismissed').length };

  return (
    <div className="space-y-5">
      {toast && <div className="fixed top-4 right-4 z-50 animate-toast px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl"
        style={{ background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)', color: '#ff2d55' }}>{toast}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Security</h1>
          <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: counts.open > 0 ? '#ff2d55' : '#334155' }}>{counts.open} active alerts</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm flex items-center gap-1.5">
          <RefreshCw size={13} className={loading?'animate-spin':''} />Refresh
        </button>
      </div>

      <div className="card p-4" style={{ borderColor: 'rgba(108,60,225,0.2)' }}>
        <div className="flex items-center gap-2 mb-3">
          <div className="status-dot-green" />
          <span className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>Auto-Detection Active</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
          {DETECT_TYPES.map(dt => (
            <div key={dt.t} className="rounded-xl p-2.5 transition-all hover:border-purple-500/20" style={{ background: '#0a1220', border: '1px solid #1a2a45' }}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm">{FLAG_ICON[dt.t]||'⚠️'}</span>
                <span className="text-white text-xs font-semibold">{dt.t}</span>
                <span className={`ml-auto ${SEV[dt.s]?.pill}`}>{dt.s}</span>
              </div>
              <p className="text-xs" style={{ color: '#334155' }}>{dt.d}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(108,60,225,0.06)', border: '1px solid rgba(108,60,225,0.2)', color: '#8b5cf6' }}>
          <Crown size={12} className="shrink-0" />
          4 owner accounts are exempt from all security rules and will never be auto-banned
        </div>
      </div>

      <div className="flex gap-2">
        {(['all','open','banned','dismissed'] as const).map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all uppercase tracking-wider ${filter===t?'':'btn-ghost'}`}
            style={filter===t ? { background: 'rgba(108,60,225,0.2)', borderColor: 'rgba(108,60,225,0.5)', color: '#c4b5fd' } : {}}>
            {t} <span className="ml-1 opacity-50">{counts[t]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-20 text-center" style={{ color: '#334155' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(108,60,225,0.08)', border: '1px solid rgba(108,60,225,0.2)' }}>
            <Shield size={28} style={{ color: '#1a2a45' }} />
          </div>
          <p className="font-bold text-sm uppercase tracking-wider" style={{ color: '#334155' }}>{filter==='all'?'No Security Alerts':'No '+filter+' Alerts'}</p>
          <p className="text-xs mt-1" style={{ color: '#1a2a45' }}>Violations detected by your game appear here automatically</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(flag => {
            const isOwner = OWNER_IDS.includes(Number(flag.roblox_user_id));
            const sev = SEV[flag.severity] ?? SEV.medium;
            return (
              <div key={flag.id} className={`card p-5 hover-lift transition-all ${flag.status !== 'open' ? 'opacity-60' : ''}`}
                style={{ borderColor: flag.severity === 'critical' && flag.status === 'open' ? 'rgba(255,45,85,0.3)' : flag.status === 'open' ? 'rgba(255,107,43,0.2)' : '#1a2a45' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white font-semibold">{FLAG_ICON[flag.flag_type]||'⚠️'} {flag.flag_type}</span>
                      <span className={sev.pill}>{flag.severity}</span>
                      {flag.status !== 'open' && <span className={flag.status==='banned' ? 'badge badge-critical' : 'badge badge-info'}>{flag.status}</span>}
                      {isOwner && <span className="badge flex items-center gap-1" style={{ background: 'rgba(255,214,10,0.1)', color: '#ffd60a', borderColor: 'rgba(255,214,10,0.25)' }}><Crown size={9}/>Owner · Exempt</span>}
                    </div>

                    <div className="flex items-center gap-3 flex-wrap text-sm">
                      <div className="rounded-lg px-3 py-1.5 flex items-center gap-2" style={{ background: '#0a1220', border: '1px solid #1a2a45' }}>
                        <span className="text-white font-semibold">{flag.username||'Unknown'}</span>
                        <a href={robloxProfileUrl(flag.roblox_user_id)} target="_blank" rel="noopener noreferrer" className="text-slate-700 hover:text-blue-400 transition-colors"><ExternalLink size={11}/></a>
                      </div>
                      <span className="text-xs font-mono" style={{ color: '#334155' }}>ID: {flag.roblox_user_id}</span>
                      {flag.server_id && <span className="text-xs font-mono px-2 py-0.5 rounded-lg" style={{ background: '#0a1220', border: '1px solid #1a2a45', color: '#334155' }}>{flag.server_id.substring(0,14)}</span>}
                      <span className="text-xs" style={{ color: '#213354' }}>{timeSince(flag.created_at)}</span>
                    </div>

                    {flag.description && <p className="text-sm rounded-xl px-3 py-2" style={{ color: '#64748b', background: '#0a1220', border: '1px solid #1a2a45' }}>{flag.description}</p>}
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <button onClick={() => sendDiscord(flag)} className="btn-ghost text-xs flex items-center gap-1.5 py-1.5"><Send size={11}/>Discord</button>
                    {flag.status==='open' && !isOwner && (
                      <button onClick={() => doBan(flag)} className="btn-danger flex items-center gap-2 text-sm py-2"><Ban size={13}/>Permanent Ban</button>
                    )}
                    {flag.status==='open' && (
                      <button onClick={() => dismiss(flag.id)} className="btn-ghost flex items-center gap-2 text-sm py-2"><XCircle size={13}/>Dismiss</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
