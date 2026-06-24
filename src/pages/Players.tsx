import { useState, useEffect, useCallback } from 'react';
import {
  Search, Users, Ban, MessageSquare,
  ExternalLink, Copy, UserX, X, Clock, Monitor, Smartphone,
  Gamepad2, ChevronRight, Unlock, Send, Crown, RotateCcw, AlertTriangle, Globe, Server, MapPin
} from 'lucide-react';
import { API, formatDuration, timeSince, robloxProfileUrl, OWNER_IDS, countryFlag } from '../lib/api';
import Avatar from '../components/Avatar';

interface Profile {
  id: number; roblox_user_id: number; username: string; display_name: string;
  avatar_url: string; avatar_resolved: string; country_code: string; device_type: string;
  total_playtime_seconds: number; session_count: number; join_count: number;
  last_seen_at: string; first_seen_at: string; is_banned: boolean;
  last_server_id: string;
}

interface Event {
  id: number; event_type: string; session_seconds: number; server_id: string; created_at: string;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  PC: <Monitor size={13} />, Mobile: <Smartphone size={13} />, Console: <Gamepad2 size={13} />,
};

export default function Players() {
  const [players, setPlayers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [banRecord, setBanRecord] = useState<any>(null);
  const [onlineInfo, setOnlineInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; type: 'ok' | 'err' | 'info' } | null>(null);
  const [modal, setModal] = useState<{ type: 'warn' | 'msg' | 'kick' | null }>({ type: null });
  const [modalInput, setModalInput] = useState('');

  function showToast(text: string, type: 'ok' | 'err' | 'info' = 'ok') {
    setToast({ text, type });
    setTimeout(() => setToast(null), 3000);
  }

  const loadPlayers = useCallback(async () => {
    setLoading(true);
    const res = await API.getPlayers(search);
    setPlayers(res.players ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(loadPlayers, 300);
    return () => clearTimeout(t);
  }, [loadPlayers]);

  // Refresh all player info (avatar, country, device) from Roblox every 30 minutes
  useEffect(() => {
    const t = setInterval(() => {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roblox-api/players/refresh-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`, 'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: '{}',
      }).catch(() => {}).then(() => loadPlayers());
    }, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [loadPlayers]);

  async function openPlayer(p: Profile) {
    setSelected(p); setEvents([]); setBanRecord(null); setOnlineInfo(null);
    const res = await API.getPlayer(p.roblox_user_id);
    if (res.profile) setSelected(res.profile);
    setEvents(res.events ?? []);
    setBanRecord(res.ban ?? null);
    setOnlineInfo(res.online ?? null);
  }

  async function toggleBan() {
    if (!selected) return;
    setActionLoading('ban');
    if (selected.is_banned) {
      await API.unban(selected.roblox_user_id);
      const updated = { ...selected, is_banned: false };
      setSelected(updated);
      setBanRecord(null);
      setPlayers(ps => ps.map(p => p.roblox_user_id === selected.roblox_user_id ? { ...p, is_banned: false } : p));
      showToast(`Unbanned ${selected.username} — can rejoin now`, 'ok');
    } else {
      await API.ban(selected.roblox_user_id, selected.username, selected.display_name, selected.avatar_resolved || selected.avatar_url, 'Banned by admin');
      const updated = { ...selected, is_banned: true };
      setSelected(updated);
      setPlayers(ps => ps.map(p => p.roblox_user_id === selected.roblox_user_id ? { ...p, is_banned: true } : p));
      showToast(`Banned ${selected.username} — cannot rejoin`, 'err');
    }
    setActionLoading(null);
  }

  async function doKick(reason: string) {
    if (!selected) return;
    setActionLoading('kick');
    await API.kick(selected.roblox_user_id, reason || 'Kicked by admin');
    showToast(`Kicked ${selected.username}`, 'info');
    setActionLoading(null); setModal({ type: null });
  }

  async function doWarn(msg: string) {
    if (!selected) return;
    setActionLoading('warn');
    await API.warn(selected.roblox_user_id, msg || undefined);
    showToast(`Warning queued for ${selected.username} — 15s display`, 'ok');
    setActionLoading(null); setModal({ type: null });
  }

  async function doMsg(msg: string) {
    if (!selected) return;
    setActionLoading('msg');
    await API.message(selected.roblox_user_id, msg);
    showToast(`Message sent to ${selected.username}`, 'ok');
    setActionLoading(null); setModal({ type: null });
  }

  async function doShutdownServer() {
    if (!selected) return;
    setActionLoading('shutdown');
    await API.shutdownPlayerServer(selected.roblox_user_id);
    showToast(`Shutdown queued for ${selected.username}'s server`, 'info');
    setActionLoading(null);
  }

  function copyUrl() {
    if (!selected) return;
    navigator.clipboard.writeText(robloxProfileUrl(selected.roblox_user_id));
    showToast('Profile URL copied!', 'ok');
  }

  async function sendDiscord() {
    if (!selected) return;
    const ownerName = sessionStorage.getItem('hrya_owner') || 'Admin';
    const flag = countryFlag(selected.country_code);
    await API.sendDiscord({
      embeds: [{
        title: `Player Profile: ${selected.username}`,
        color: selected.is_banned ? 0xef4444 : onlineInfo ? 0x10b981 : 0x3b82f6,
        url: robloxProfileUrl(selected.roblox_user_id),
        thumbnail: { url: selected.avatar_resolved || selected.avatar_url },
        fields: [
          { name: 'Username', value: selected.username, inline: true },
          { name: 'Display Name', value: selected.display_name || '—', inline: true },
          { name: 'User ID', value: `[${selected.roblox_user_id}](https://www.roblox.com/users/${selected.roblox_user_id}/profile)`, inline: true },
          { name: 'Country', value: flag ? `${flag} ${selected.country_code || 'Unknown'}` : (selected.country_code || 'Unknown'), inline: true },
          { name: 'Device', value: selected.device_type || 'Unknown', inline: true },
          { name: 'Status', value: selected.is_banned ? '**BANNED**' : onlineInfo ? '**ONLINE**' : 'Offline', inline: true },
          { name: 'Total Playtime', value: formatDuration(selected.total_playtime_seconds), inline: true },
          { name: 'Sessions', value: String(selected.session_count), inline: true },
          { name: 'Last Server', value: selected.last_server_id ? `\`${selected.last_server_id.substring(0, 16)}...\`` : 'Never joined', inline: false },
          { name: 'Profile Link', value: `[View Roblox Profile](https://www.roblox.com/users/${selected.roblox_user_id}/profile)`, inline: false },
        ],
        footer: { text: `Sent by ${ownerName}` },
        timestamp: new Date().toISOString(),
      }]
    });
    showToast('Profile sent to Discord', 'ok');
  }

  const isOwner = selected ? OWNER_IDS.includes(selected.roblox_user_id) : false;

  return (
    <div className="relative">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-toast px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl max-w-xs flex items-center gap-2"
          style={{
            background: toast.type === 'ok' ? 'rgba(0,255,136,0.1)' : toast.type === 'err' ? 'rgba(255,45,85,0.1)' : 'rgba(0,212,255,0.1)',
            border: toast.type === 'ok' ? '1px solid rgba(0,255,136,0.3)' : toast.type === 'err' ? '1px solid rgba(255,45,85,0.3)' : '1px solid rgba(0,212,255,0.3)',
            color: toast.type === 'ok' ? '#00ff88' : toast.type === 'err' ? '#ff2d55' : '#00d4ff',
          }}>
          {toast.text}
        </div>
      )}

      <div className={`flex gap-5 ${selected ? 'items-start' : ''}`}>
        {/* Left: player list */}
        <div className={`${selected ? 'hidden lg:flex lg:w-72 shrink-0' : 'w-full'} flex-col gap-4`}>
          <div>
            <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Players</h1>
            <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: '#334155' }}>{players.length} total</p>
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="input w-full pl-11 text-sm" placeholder="Search username or display name..." />
          </div>
          <div className="space-y-2">
            {loading ? (
              <div className="card p-12 text-center text-slate-600 text-sm">Loading...</div>
            ) : players.length === 0 ? (
              <div className="card p-12 text-center">
                <Users size={28} className="mx-auto mb-3 text-slate-700" />
                <p className="text-slate-400 text-sm">No players yet</p>
              </div>
            ) : players.map(p => (
              <button key={p.roblox_user_id} onClick={() => openPlayer(p)}
                className="w-full card flex items-center gap-3 px-4 py-3 text-left transition-all hover-lift"
                style={{
                  borderColor: selected?.roblox_user_id === p.roblox_user_id ? 'rgba(108,60,225,0.5)' : p.is_banned ? 'rgba(255,45,85,0.2)' : '#1a2a45',
                  background: selected?.roblox_user_id === p.roblox_user_id ? 'rgba(108,60,225,0.08)' : p.is_banned ? 'rgba(18,6,10,0.5)' : undefined,
                }}>
                <div className="relative shrink-0">
                  <Avatar userId={p.roblox_user_id} avatarUrl={p.avatar_resolved || p.avatar_url} name={p.username} size="sm" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-white text-sm font-medium truncate">{p.display_name || p.username}</span>
                    {OWNER_IDS.includes(p.roblox_user_id) && <Crown size={11} className="text-yellow-400 shrink-0" />}
                    {p.is_banned && <span className="tag bg-red-500/15 text-red-400 border-red-500/25 shrink-0">Banned</span>}
                  </div>
                  <div className="text-slate-600 text-xs truncate">@{p.username} · {timeSince(p.last_seen_at)}</div>
                </div>
                <ChevronRight size={13} className="text-slate-700 shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div className="flex-1 min-w-0 animate-in">
            <div className="card overflow-hidden">
              <div className="relative bg-gradient-to-br from-[#0d1120] to-[#0a0d1a] p-6">
                <button onClick={() => setSelected(null)} className="absolute top-4 right-4 text-slate-600 hover:text-white transition-colors lg:hidden">
                  <X size={18} />
                </button>
                <div className="flex items-start gap-5">
                  <div className="relative shrink-0">
                    <Avatar userId={selected.roblox_user_id} avatarUrl={selected.avatar_resolved || selected.avatar_url} name={selected.username} size="xl" className="ring-2 ring-white/10 shadow-2xl" />
                    {selected.is_banned && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-900 border-2 border-[#04060f] rounded-full flex items-center justify-center"><Ban size={12} className="text-red-400" /></div>}
                    {!selected.is_banned && onlineInfo && <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-900 border-2 border-[#04060f] rounded-full flex items-center justify-center"><div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-white text-xl font-bold">{selected.display_name || selected.username}</h2>
                      {isOwner && <span className="tag bg-yellow-500/10 text-yellow-400 border-yellow-500/25 flex items-center gap-1"><Crown size={9}/>Owner</span>}
                      {selected.is_banned && <span className="tag bg-red-500/15 text-red-400 border-red-500/25">Banned</span>}
                      {onlineInfo && !selected.is_banned && <span className="tag bg-emerald-500/15 text-emerald-400 border-emerald-500/25">Online Now</span>}
                    </div>
                    <p className="text-slate-500 text-sm">@{selected.username}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-slate-600">
                      <span>UID: {selected.roblox_user_id}</span>
                      {onlineInfo?.server_id && <span className="font-mono bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded">Server: {onlineInfo.server_id.substring(0, 16)}</span>}
                      {!onlineInfo?.server_id && selected.last_server_id && <span className="font-mono bg-white/[0.04] px-2 py-0.5 rounded">Last Server: {selected.last_server_id.substring(0, 16)}</span>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Total Playtime', value: formatDuration(selected.total_playtime_seconds), icon: <Clock size={13} />, color: 'text-blue-400' },
                    { label: 'Sessions', value: selected.session_count, icon: <Users size={13} />, color: 'text-emerald-400' },
                    { label: 'Total Joins', value: selected.join_count, icon: <Monitor size={13} />, color: 'text-cyan-400' },
                    { label: 'Last Seen', value: timeSince(selected.last_seen_at), icon: <Clock size={13} />, color: 'text-amber-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-white/[0.03] border border-white/[0.05] rounded-xl p-3">
                      <div className={`flex items-center gap-1.5 mb-1.5 ${s.color} text-xs`}>{s.icon}{s.label}</div>
                      <div className={`font-bold ${s.color}`}>{s.value}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:border-white/10 transition-colors">
                    <div className="text-slate-600 text-xs mb-1 flex items-center gap-1"><Monitor size={10}/>Device</div>
                    <div className="text-white flex items-center gap-1.5 font-medium">{DEVICE_ICONS[selected.device_type] || <Monitor size={13} />}{selected.device_type || 'Unknown'}</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:border-white/10 transition-colors">
                    <div className="text-slate-600 text-xs mb-1 flex items-center gap-1"><Globe size={10}/>Country</div>
                    <div className="text-white flex items-center gap-1 font-medium">
                      {countryFlag(selected.country_code) && <span className="text-base">{countryFlag(selected.country_code)}</span>}
                      {selected.country_code || 'Unknown'}
                    </div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:border-white/10 transition-colors">
                    <div className="text-slate-600 text-xs mb-1 flex items-center gap-1"><MapPin size={10}/>First Seen</div>
                    <div className="text-white text-sm">{selected.first_seen_at ? new Date(selected.first_seen_at).toLocaleDateString() : '—'}</div>
                  </div>
                  <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 hover:border-white/10 transition-colors">
                    <div className="text-slate-600 text-xs mb-1 flex items-center gap-1"><Server size={10}/>Last Server</div>
                    <div className="text-white text-xs font-mono truncate" title={selected.last_server_id || 'Unknown'}>
                      {selected.last_server_id ? selected.last_server_id.substring(0, 12) + '...' : 'Never joined'}
                    </div>
                  </div>
                </div>

                {/* Online status info */}
                {onlineInfo && (
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Currently Online
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-slate-500 text-xs">Server ID</span>
                        <div className="text-white font-mono text-xs mt-1">{onlineInfo.server_id || 'Unknown'}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-xs">Joined At</span>
                        <div className="text-white text-xs mt-1">{onlineInfo.joined_at ? new Date(onlineInfo.joined_at).toLocaleString() : 'Unknown'}</div>
                      </div>
                    </div>
                  </div>
                )}

                {banRecord && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 text-sm">
                    <div className="text-red-400 font-semibold text-xs mb-2 uppercase tracking-widest">Ban Record</div>
                    <div className="text-red-300">{banRecord.reason}</div>
                    <div className="text-slate-600 text-xs mt-1">By {banRecord.banned_by} · {timeSince(banRecord.banned_at)}</div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={toggleBan} disabled={actionLoading === 'ban'}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all disabled:opacity-50 ${selected.is_banned
                      ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25 text-emerald-400'
                      : 'bg-red-500/10 hover:bg-red-500/20 border-red-500/25 text-red-400'}`}>
                    {actionLoading === 'ban' ? <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" /> :
                      selected.is_banned ? <Unlock size={14} /> : <Ban size={14} />}
                    {selected.is_banned ? 'Unban' : 'Ban'}
                  </button>
                  <button onClick={() => { setModal({ type: 'kick' }); setModalInput(''); }} className="btn-ghost flex items-center gap-2 text-sm"><UserX size={14} />Kick</button>
                  <button onClick={() => { setModal({ type: 'warn' }); setModalInput(''); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/25 text-amber-400 text-sm font-medium transition-all"><AlertTriangle size={14} />Warn</button>
                  <button onClick={() => { setModal({ type: 'msg' }); setModalInput(''); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/25 text-blue-400 text-sm font-medium transition-all"><MessageSquare size={14} />Message</button>
                  <button onClick={doShutdownServer} disabled={actionLoading === 'shutdown'} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-red-500/10 hover:bg-red-500/20 border-red-500/25 text-red-400 text-sm font-medium transition-all disabled:opacity-50"><RotateCcw size={14} />Shutdown Server</button>
                  <button onClick={copyUrl} className="btn-ghost flex items-center gap-2 text-sm"><Copy size={14} />Copy URL</button>
                  <a href={robloxProfileUrl(selected.roblox_user_id)} target="_blank" rel="noopener noreferrer" className="btn-ghost flex items-center gap-2 text-sm"><ExternalLink size={14} />Profile</a>
                  <button onClick={sendDiscord} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border bg-violet-500/10 hover:bg-violet-500/20 border-violet-500/25 text-violet-400 text-sm font-medium transition-all"><Send size={14} />Discord</button>
                </div>

                {events.length > 0 && (
                  <div>
                    <h3 className="text-white font-semibold text-sm mb-3">Session History</h3>
                    <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                      {events.map(ev => (
                        <div key={ev.id} className="flex items-center gap-3 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2 text-xs">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${ev.event_type === 'join' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className={`font-medium ${ev.event_type === 'join' ? 'text-emerald-400' : 'text-red-400'}`}>{ev.event_type === 'join' ? 'Joined' : 'Left'}</span>
                          {ev.session_seconds > 0 && <span className="text-slate-400">{formatDuration(ev.session_seconds)}</span>}
                          {ev.server_id && <span className="text-slate-700 font-mono">Server: {ev.server_id.substring(0, 12)}</span>}
                          <span className="text-slate-700 ml-auto">{new Date(ev.created_at).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {modal.type && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) setModal({ type: null }); }}>
          <div className="card-glow p-6 w-full max-w-md animate-in">
            {modal.type === 'kick' && (<>
              <h3 className="text-white font-bold text-lg mb-2">Kick {selected?.username}</h3>
              <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg px-3 py-2 mb-4 text-xs">
                <span className="text-orange-400 font-medium">Sent by:</span> <span className="text-white">{sessionStorage.getItem('hrya_owner') || 'Admin'}</span>
              </div>
              <input value={modalInput} onChange={e => setModalInput(e.target.value)} className="input w-full mb-4" placeholder="Reason (optional)" />
              <div className="flex gap-3"><button onClick={() => setModal({ type: null })} className="btn-ghost flex-1">Cancel</button><button onClick={() => doKick(modalInput)} disabled={!!actionLoading} className="flex-1 bg-orange-600 hover:bg-orange-500 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">Kick</button></div>
            </>)}
            {modal.type === 'warn' && (<>
              <h3 className="text-white font-bold text-lg mb-2">Warn {selected?.username}</h3>
              <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg px-3 py-2 mb-3 text-xs">
                <span className="text-amber-400 font-medium">Sent by:</span> <span className="text-white">{sessionStorage.getItem('hrya_owner') || 'Admin'}</span>
              </div>
              <p className="text-slate-500 text-sm mb-4">Shows on screen 15s. If offline: shown 30s after join, once only.</p>
              <input value={modalInput} onChange={e => setModalInput(e.target.value)} className="input w-full mb-4" placeholder="Custom message (optional)" />
              <div className="flex gap-3"><button onClick={() => setModal({ type: null })} className="btn-ghost flex-1">Cancel</button><button onClick={() => doWarn(modalInput)} disabled={!!actionLoading} className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50">Send</button></div>
            </>)}
            {modal.type === 'msg' && (<>
              <h3 className="text-white font-bold text-lg mb-2">Message {selected?.username}</h3>
              <div className="bg-blue-500/5 border border-blue-500/15 rounded-lg px-3 py-2 mb-3 text-xs">
                <span className="text-blue-400 font-medium">Sent by:</span> <span className="text-white">{sessionStorage.getItem('hrya_owner') || 'Admin'}</span>
              </div>
              <p className="text-slate-500 text-sm mb-4">Shows on screen 15s. If offline: shown 30s after join, once only.</p>
              <textarea value={modalInput} onChange={e => setModalInput(e.target.value)} className="input w-full mb-4 resize-none h-24" placeholder="Your message..." />
              <div className="flex gap-3"><button onClick={() => setModal({ type: null })} className="btn-ghost flex-1">Cancel</button><button onClick={() => doMsg(modalInput)} disabled={!!actionLoading || !modalInput.trim()} className="btn-primary flex-1 disabled:opacity-50">Send</button></div>
            </>)}
          </div>
        </div>
      )}
    </div>
  );
}
