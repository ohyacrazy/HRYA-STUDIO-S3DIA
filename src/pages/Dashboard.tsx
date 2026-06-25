import { useState, useEffect, useCallback } from 'react';
import {
  Users, UserX, Shield, Server, Trophy,
  Ban, MessageSquare, AlertTriangle, ExternalLink, Copy,
  RotateCcw, RefreshCw, Crown,
  Monitor, Smartphone, Gamepad2, TrendingUp, TrendingDown,
  Swords, Unlock, XCircle, Send, Timer, Globe, Eye, Heart,
  Star, Activity, Zap, Bell, ToggleLeft, ToggleRight
} from 'lucide-react';
import { API, formatDuration, robloxProfileUrl, OWNER_IDS, countryFlag, OWNER_IMAGES } from '../lib/api';
import Avatar from '../components/Avatar';
import { useCountUp } from '../hooks/useCountUp';

interface OnlinePlayer {
  id: number; roblox_user_id: number; username: string;
  display_name: string; avatar_url: string; avatar_resolved: string;
  country_code: string; device_type: string; server_id: string; joined_at: string;
}
interface LeaderEntry {
  roblox_user_id: number; username: string; display_name: string;
  avatar_url: string; avatar_resolved: string;
  total_playtime_seconds: number; session_count: number; country_code: string;
}
interface ToastMsg { id: number; text: string; type: 'success' | 'warn' | 'error' | 'info'; }
interface ModalState {
  type: 'warn' | 'msg' | 'kick' | 'shutdown_id' | 'kill_game' | 'all_msg' | 'revive_game' | null;
  player?: OnlinePlayer;
}

const DEVICE_ICONS: Record<string, React.ReactNode> = {
  PC: <Monitor size={11} />, Mobile: <Smartphone size={11} />, Console: <Gamepad2 size={11} />,
};
const BROADCAST_CHARS = ['Nexus', 'Luna', 'Youssef'];
const OWNER_COLORS_MAP: Record<string, string> = {
  Nexus: '#f9f9f9', Luna: '#ff00f2', Youssef: '#fe0000',
};

const NOTIF_LABELS: Record<string, { label: string; icon: string }> = {
  ban:          { label: 'Player Banned',       icon: '🔨' },
  unban:        { label: 'Player Unbanned',     icon: '✅' },
  kick:         { label: 'Player Kicked',       icon: '👢' },
  warn:         { label: 'Player Warned',       icon: '⚠️' },
  kill_game:    { label: 'Kill Game',           icon: '💀' },
  revive_game:  { label: 'Game Revived',        icon: '💚' },
  broadcast:    { label: 'Broadcast Sent',      icon: '📢' },
  login:        { label: 'Admin Login',         icon: '🔐' },
  login_failed: { label: 'Failed Login',        icon: '🚫' },
  security:     { label: 'Security Alert',      icon: '🛡️' },
  lockdown:     { label: 'Emergency Lockdown',  icon: '🔴' },
  purchase:     { label: 'Robux Purchase',      icon: '💎' },
  unauthorized_use: { label: 'Unauthorized Game Use', icon: '🚨' },
};

function GlowStat({ label, value, icon, color, glowClass, suffix = '', subLabel }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; glowClass: string; suffix?: string; subLabel?: string;
}) {
  const count = useCountUp(value, 1000);
  return (
    <div className="stat-card tilt-card" style={{ borderColor: `${color}20` }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40`; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}20`; }}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className={`stat-number ${glowClass}`}>{count.toLocaleString()}{suffix}</div>
      {subLabel && <div className="text-xs mt-1" style={{ color: '#334155' }}>{subLabel}</div>}
    </div>
  );
}

 
export default function Dashboard() {
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [gs, setGs] = useState<any>(null);
  const [extra, setExtra] = useState({ online_count: 0, banned_count: 0, total_players: 0, security_alerts: 0, total_visits: 0, total_playing: 0, total_likes_games: 0 });
  const [analytics, setAnalytics] = useState<any>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [bannedSet, setBannedSet] = useState<Set<number>>(new Set());
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [modalInput, setModalInput] = useState('');
  const [killAuth, setKillAuth] = useState({ user: '', pass: '' });
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [shutdownId, setShutdownId] = useState('');
  const [broadcastChar, setBroadcastChar] = useState('Nexus');
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState<Record<string, boolean>>({});
  const [playerLikes, setPlayerLikes] = useState<Record<number, boolean>>({});
  const [refreshing, setRefreshing] = useState(false);

  const ownerName = (() => { try { const r = localStorage.getItem('hrya_auth_v2'); if (r) return JSON.parse(r).owner || 'Admin'; } catch { } return 'Admin'; })();

  function toast(text: string, type: ToastMsg['type'] = 'info') {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, text, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4500);
  }

  const load = useCallback(async () => {
    setRefreshing(true);
    const [statsRes, onlineRes, lbRes, analyticsRes] = await Promise.all([
      API.getGameStats(), API.getOnlinePlayers(), API.getLeaderboard(), API.getAnalytics(),
    ]);
    if (statsRes.stats) setGs(statsRes.stats);
    setExtra({
      online_count: statsRes.online_count ?? 0, banned_count: statsRes.banned_count ?? 0,
      total_players: statsRes.total_players ?? 0, security_alerts: statsRes.security_alerts ?? 0,
      total_visits: statsRes.total_visits ?? 0, total_playing: statsRes.total_playing ?? 0,
      total_likes_games: statsRes.total_likes_games ?? 0,
    });
    setOnline(onlineRes.players ?? []);
    setLeaderboard(lbRes.leaderboard ?? []);
    setAnalytics(analyticsRes);
    setLastRefresh(new Date());
    setRefreshing(false);
  }, []);

  // Load notification settings
  useEffect(() => {
    API.getNotifSettings().then((r: any) => {
      const map: Record<string, boolean> = {};
      for (const s of (r.settings || [])) map[s.action_type] = s.enabled;
      setNotifSettings(map);
    }).catch(() => {});
  }, []);

  // Load player like status for online players
  useEffect(() => {
    if (online.length === 0) return;
    online.forEach(p => {
      API.checkPlayerLiked(p.roblox_user_id).then((r: any) => {
        if (r.liked !== undefined) {
          setPlayerLikes(prev => ({ ...prev, [p.roblox_user_id]: r.liked }));
        }
      }).catch(() => {});
    });
  }, [online]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 10000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function toggleNotif(actionType: string, enabled: boolean) {
    setNotifSettings(s => ({ ...s, [actionType]: enabled }));
    await API.updateNotifSetting(actionType, enabled);
    toast(`${NOTIF_LABELS[actionType]?.label || actionType} notifications ${enabled ? 'enabled' : 'disabled'}`, enabled ? 'success' : 'info');
  }

  function sessionTime(joinedAt: string) { return formatDuration(Math.floor((now - new Date(joinedAt).getTime()) / 1000)); }

  async function doBan(p: OnlinePlayer) {
    setActionLoading(`ban-${p.roblox_user_id}`);
    if (bannedSet.has(p.roblox_user_id)) {
      await API.unban(p.roblox_user_id);
      setBannedSet(s => { const n = new Set(s); n.delete(p.roblox_user_id); return n; });
      try { await API.logActivity('unban', p.roblox_user_id, p.username, ownerName); } catch { }
      toast(`Unbanned ${p.username}`, 'success');
    } else {
      await API.ban(p.roblox_user_id, p.username, p.display_name, p.avatar_resolved || p.avatar_url, 'Banned by admin');
      setBannedSet(s => new Set([...s, p.roblox_user_id]));
      setOnline(prev => prev.filter(x => x.roblox_user_id !== p.roblox_user_id));
      try { await API.logActivity('ban', p.roblox_user_id, p.username, ownerName, 'Banned by admin'); } catch { }
      toast(`Banned ${p.username}`, 'error');
    }
    setActionLoading(null);
  }

  async function doKick(p: OnlinePlayer, reason: string) {
    setActionLoading('kick');
    await API.kick(p.roblox_user_id, reason || 'Kicked by admin');
    setOnline(prev => prev.filter(x => x.roblox_user_id !== p.roblox_user_id));
    try { await API.logActivity('kick', p.roblox_user_id, p.username, ownerName, reason); } catch { }
    toast(`Kicked ${p.username}`, 'warn');
    setActionLoading(null); setModal({ type: null });
  }

  async function doWarn(p: OnlinePlayer, msg: string) {
    setActionLoading('warn');
    const warnMsg = msg || 'Warning from moderator: Follow the rules.';
    await API.warn(p.roblox_user_id, warnMsg);
    try { await API.logActivity('warn', p.roblox_user_id, p.username, ownerName, warnMsg); } catch { }
    toast(`Warning sent to ${p.username}`, 'success');
    setActionLoading(null); setModal({ type: null });
  }

  async function doMsg(p: OnlinePlayer | null, msg: string, all = false) {
    setActionLoading('msg');
    await API.message(p?.roblox_user_id ?? null, msg, all, all ? broadcastChar : undefined);
    try { await API.logActivity('broadcast', p?.roblox_user_id ?? null, p?.username ?? 'All Players', ownerName, msg); } catch { }
    toast(all ? `Broadcast sent as ${broadcastChar}` : `Message sent to ${p?.username}`, 'success');
    setActionLoading(null); setModal({ type: null });
  }

  async function doKillGame() {
    if (killAuth.user !== 'KillGame' || killAuth.pass !== 'GameDied') { toast('Wrong credentials', 'error'); return; }
    setActionLoading('kill');
    await API.killGameActivate();
    setGs((g: any) => g ? { ...g, kill_game_active: true } : g);
    setOnline([]);
    try { await API.logActivity('kill_game', null, 'All Players', ownerName, 'Kill Game activated'); } catch { }
    toast('Kill Game activated', 'error');
    setActionLoading(null); setModal({ type: null }); setKillAuth({ user: '', pass: '' });
  }

  async function doReviveGame() {
    if (killAuth.user !== 'KillGame' || killAuth.pass !== 'GameDied') { toast('Wrong credentials', 'error'); return; }
    setActionLoading('kill');
    await API.killGameDeactivate();
    setGs((g: any) => g ? { ...g, kill_game_active: false } : g);
    try { await API.logActivity('revive_game', null, 'All Players', ownerName, 'Game revived'); } catch { }
    toast('Game revived', 'success');
    setActionLoading(null); setModal({ type: null }); setKillAuth({ user: '', pass: '' });
  }

  const insights: { text: string; dir: 'up' | 'down' | 'neutral' }[] = [];
  if (analytics) {
    const jp = analytics.join_change_pct;
    if (jp !== null) insights.push({ text: `Weekly joins ${parseFloat(jp) >= 0 ? '+' : ''}${jp}% vs last week`, dir: parseFloat(jp) >= 0 ? 'up' : 'down' });
    const devs = Object.entries(analytics.device_breakdown || {}).sort(([, a], [, b]) => (b as number) - (a as number));
    if (devs[0]) insights.push({ text: `${devs[0][0]} is top device`, dir: 'neutral' });
    if (analytics.peak_hour !== undefined) {
      const h = parseInt(analytics.peak_hour); const ampm = h >= 12 ? 'PM' : 'AM'; const hr = h % 12 || 12;
      insights.push({ text: `Peak: ${hr}:00 ${ampm} UTC`, dir: 'neutral' });
    }
    if (analytics.retention_rate !== undefined) insights.push({ text: `Retention: ${analytics.retention_rate}%`, dir: analytics.retention_rate >= 50 ? 'up' : 'down' });
    if (analytics.avg_session_seconds > 0) insights.push({ text: `Avg session: ${formatDuration(analytics.avg_session_seconds)}`, dir: 'neutral' });
  }

  const broadcastColor = OWNER_COLORS_MAP[broadcastChar] || '#6c3ce1';

  return (
    <div className="space-y-5">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className="animate-toast px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl pointer-events-auto flex items-center gap-2"
            style={{
              background: t.type === 'success' ? 'rgba(0,255,136,0.1)' : t.type === 'error' ? 'rgba(255,45,85,0.1)' : t.type === 'warn' ? 'rgba(255,107,43,0.1)' : '#0d1526',
              border: t.type === 'success' ? '1px solid rgba(0,255,136,0.3)' : t.type === 'error' ? '1px solid rgba(255,45,85,0.3)' : t.type === 'warn' ? '1px solid rgba(255,107,43,0.3)' : '1px solid #1a2a45',
              color: t.type === 'success' ? '#00ff88' : t.type === 'error' ? '#ff2d55' : t.type === 'warn' ? '#ff6b2b' : '#00d4ff',
            }}>
            <Zap size={12} />{t.text}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: '#334155' }}>
            Live · auto-refresh 10s{lastRefresh && <span className="ml-2">· {lastRefresh.toLocaleTimeString()}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowNotifSettings(v => !v)}
            className={`text-xs flex items-center gap-1.5 px-3 py-2 rounded-xl border transition-all ${showNotifSettings ? '' : 'btn-ghost'}`}
            style={showNotifSettings ? { background: 'rgba(108,60,225,0.15)', borderColor: 'rgba(108,60,225,0.4)', color: '#c4b5fd' } : {}}>
            <Bell size={12} />Notifications
          </button>
          <button onClick={() => { setModal({ type: 'all_msg' }); setModalInput(''); }} className="btn-ghost text-xs flex items-center gap-1.5">
            <MessageSquare size={12} />Broadcast
          </button>
          <button onClick={() => { setShutdownId(''); setModal({ type: 'shutdown_id' }); }} className="btn-ghost text-xs">
            <Server size={12} className="mr-1" />Reset by ID
          </button>
          <button onClick={async () => { if (!confirm('Reset ALL servers?')) return; await API.shutdown(undefined, true); toast('All servers reset', 'warn'); }} className="btn-danger text-xs">
            <RotateCcw size={12} className="mr-1" />Reset All
          </button>
          {gs?.kill_game_active
            ? <button onClick={() => { setKillAuth({ user: '', pass: '' }); setModal({ type: 'revive_game' }); }} className="btn-success text-xs"><Unlock size={12} className="mr-1" />Revive</button>
            : <button onClick={() => { setKillAuth({ user: '', pass: '' }); setModal({ type: 'kill_game' }); }} className="btn-danger text-xs"><Swords size={12} className="mr-1" />Kill Game</button>
          }
          <button onClick={load} className="btn-ghost text-xs" disabled={refreshing}>
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Discord Notification Settings Panel */}
      {showNotifSettings && (
        <div className="card p-5 animate-in" style={{ borderColor: 'rgba(108,60,225,0.25)' }}>
          <div className="flex items-center gap-2 mb-4">
            <Bell size={14} style={{ color: '#8b5cf6' }} />
            <h3 className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>Discord Notifications</h3>
            <span className="text-xs ml-2" style={{ color: '#334155' }}>Toggle which actions send Discord messages</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {Object.entries(NOTIF_LABELS).map(([key, { label, icon }]) => {
              const enabled = notifSettings[key] !== false;
              return (
                <button key={key} onClick={() => toggleNotif(key, !enabled)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: enabled ? 'rgba(108,60,225,0.08)' : 'rgba(255,255,255,0.02)',
                    border: enabled ? '1px solid rgba(108,60,225,0.25)' : '1px solid #1a2a45',
                  }}>
                  <span className="text-base">{icon}</span>
                  <span className="flex-1 text-sm font-medium" style={{ color: enabled ? '#c4b5fd' : '#475569' }}>{label}</span>
                  {enabled
                    ? <ToggleRight size={18} style={{ color: '#6c3ce1', flexShrink: 0 }} />
                    : <ToggleLeft size={18} style={{ color: '#213354', flexShrink: 0 }} />
                  }
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Kill active banner */}
      {gs?.kill_game_active && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: 'rgba(255,45,85,0.06)', border: '1px solid rgba(255,45,85,0.25)' }}>
          <div className="status-dot-red" />
          <span className="font-bold text-sm" style={{ color: '#ff2d55' }}>KILL GAME ACTIVE</span>
          <span className="text-xs ml-1" style={{ color: 'rgba(255,45,85,0.5)' }}>No players can join any game</span>
          <button onClick={() => { setKillAuth({ user: '', pass: '' }); setModal({ type: 'revive_game' }); }}
            className="ml-auto btn-success text-xs py-1.5 px-3"><Unlock size={11} className="mr-1" />Revive</button>
        </div>
      )}

      {/* Primary stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        <GlowStat label="Online Now" value={extra.online_count} icon={<div className="status-dot-green" />} color="#00ff88" glowClass="glow-green" subLabel="Live players" />
        <GlowStat label="Total Players" value={extra.total_players} icon={<Users size={15} />} color="#00d4ff" glowClass="glow-cyan" />
        <GlowStat label="Banned" value={extra.banned_count} icon={<UserX size={15} />} color="#ff2d55" glowClass="glow-red" />
        <GlowStat label="Security Alerts" value={extra.security_alerts} icon={<Shield size={15} />} color="#ff6b2b" glowClass="glow-orange" />
        <GlowStat label="Servers" value={gs?.servers_online ?? 0} icon={<Server size={15} />} color="#00d4ff" glowClass="glow-cyan" />
      </div>

      {/* Roblox game stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlowStat label="Total Visits" value={extra.total_visits} icon={<Eye size={14} />} color="#ffd60a" glowClass="glow-yellow" subLabel="All games" />
        <GlowStat label="Playing Now" value={extra.total_playing} icon={<Activity size={14} />} color="#00ff88" glowClass="glow-green" subLabel="Live in-game" />
        <GlowStat label="Game Likes" value={extra.total_likes_games} icon={<Heart size={14} />} color="#00d4ff" glowClass="glow-cyan" subLabel="Favorites" />
        <GlowStat label="Total Robux" value={gs?.total_robux ?? 0} icon={<Star size={14} />} color="#ff6b2b" glowClass="glow-orange" suffix=" R$" subLabel="Earned" />
      </div>

      {/* Insights strip */}
      {insights.length > 0 && (
        <div className="rounded-xl p-4 flex flex-wrap gap-3" style={{ background: '#0d1526', border: '1px solid #1a2a45' }}>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold shrink-0" style={{ color: '#6c3ce1' }}>
            <Activity size={12} />Insights
          </div>
          {insights.map((ins, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg"
              style={{ background: '#0a1220', border: '1px solid #1a2a45', color: '#64748b' }}>
              {ins.dir === 'up' && <TrendingUp size={11} style={{ color: '#00ff88' }} />}
              {ins.dir === 'down' && <TrendingDown size={11} style={{ color: '#ff2d55' }} />}
              {ins.dir === 'neutral' && <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#6c3ce1' }} />}
              {ins.text}
            </div>
          ))}
        </div>
      )}

      <div className="grid xl:grid-cols-3 gap-5">
        {/* Online Players */}
        <div className="xl:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>
              <div className="status-dot-green" />Online Players <span style={{ color: '#1a2a45' }}>({online.length})</span>
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => API.sendDiscord({
                embeds: [{
                  title: '🟢 Online Players Report',
                  color: 0x00ff88,
                  description: online.length > 0
                    ? online.map(p => `**[${p.username}](${robloxProfileUrl(p.roblox_user_id)})** — ${p.country_code || 'Unknown'} · ${p.device_type || 'PC'} ${playerLikes[p.roblox_user_id] ? '❤️' : ''}`).join('\n')
                    : '_No players online_',
                  fields: [{ name: '📊 Total Online', value: String(online.length), inline: true }],
                  footer: { text: `HRYA-sadiaa · ${new Date().toUTCString()}` },
                  timestamp: new Date().toISOString(),
                }],
              }).then(() => toast('Sent to Discord', 'success'))}
                className="btn-ghost text-xs py-1.5"><Send size={11} className="mr-1" />Discord</button>
              <button onClick={load} disabled={refreshing} className="btn-ghost text-xs py-1.5 flex items-center gap-1">
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />Refresh
              </button>
            </div>
          </div>

          {online.length === 0 ? (
            <div className="card p-16 text-center scan-line">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(108,60,225,0.08)', border: '1px solid rgba(108,60,225,0.2)' }}>
                <Users size={28} style={{ color: '#1a2a45' }} />
              </div>
              <p className="font-bold text-sm uppercase tracking-wider" style={{ color: '#334155' }}>No Players Online</p>
              <p className="text-xs mt-1" style={{ color: '#1a2a45' }}>Waiting for your Roblox game to connect</p>
            </div>
          ) : (
            <div className="space-y-2">
              {online.map(p => (
                <PlayerCard key={p.roblox_user_id} player={p}
                  isBanned={bannedSet.has(p.roblox_user_id)}
                  isOwner={OWNER_IDS.includes(p.roblox_user_id)}
                  likedGame={playerLikes[p.roblox_user_id] ?? false}
                  sessionTime={sessionTime(p.joined_at)}
                  actionLoading={actionLoading}
                  onBan={() => doBan(p)}
                  onKick={() => { setModal({ type: 'kick', player: p }); setModalInput(''); }}
                  onWarn={() => { setModal({ type: 'warn', player: p }); setModalInput(''); }}
                  onMsg={() => { setModal({ type: 'msg', player: p }); setModalInput(''); }}
                  onShutdown={() => API.shutdownPlayerServer(p.roblox_user_id).then(() => toast(`Server reset for ${p.username}`, 'warn'))}
                  onDiscord={() => API.sendDiscord({
                    embeds: [{
                      title: `🎮 Player Report — ${p.username}`,
                      color: 0x6c3ce1,
                      url: robloxProfileUrl(p.roblox_user_id),
                      thumbnail: { url: p.avatar_resolved || p.avatar_url },
                      description: `**[View Roblox Profile](${robloxProfileUrl(p.roblox_user_id)})**`,
                      fields: [
                        { name: '🆔 User ID', value: `\`${p.roblox_user_id}\``, inline: true },
                        { name: '🌍 Country', value: `${countryFlag(p.country_code) || ''} ${p.country_code || 'Unknown'}`, inline: true },
                        { name: '💻 Device', value: p.device_type || 'Unknown', inline: true },
                        { name: '⏱️ Session', value: sessionTime(p.joined_at), inline: true },
                        { name: '🖥️ Server', value: `\`${p.server_id?.substring(0, 18) || 'N/A'}\``, inline: true },
                        { name: '❤️ Liked Game', value: playerLikes[p.roblox_user_id] ? '**Yes**' : 'No', inline: true },
                      ],
                      footer: { text: `Reported by ${ownerName} · HRYA-sadiaa` },
                      timestamp: new Date().toISOString(),
                    }],
                  }).then(() => toast('Sent to Discord', 'success'))}
                />
              ))}
            </div>
          )}
        </div>

        {/* Leaderboard */}
        <div className="space-y-3">
          <h2 className="font-bold text-white flex items-center gap-2 text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>
            <Trophy size={14} style={{ color: '#ffd60a' }} />Top Playtime
          </h2>
          <div className="card overflow-hidden">
            {leaderboard.length === 0
              ? <div className="p-10 text-center text-xs" style={{ color: '#1a2a45' }}>No data yet</div>
              : leaderboard.slice(0, 15).map((e, i) => (
                <div key={e.roblox_user_id} className="flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-white/[0.02]"
                  style={{ borderColor: '#111e35' }}>
                  <span className="w-5 text-center font-black text-xs shrink-0"
                    style={{ color: i === 0 ? '#ffd60a' : i === 1 ? '#94a3b8' : i === 2 ? '#ff6b2b' : '#213354' }}>
                    {i + 1}
                  </span>
                  <Avatar userId={e.roblox_user_id} avatarUrl={e.avatar_resolved || e.avatar_url} name={e.username} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-white text-sm font-semibold truncate">{e.display_name || e.username}</span>
                      {OWNER_IDS.includes(e.roblox_user_id) && <Crown size={10} style={{ color: '#8b5cf6', flexShrink: 0 }} />}
                    </div>
                    <div className="text-xs" style={{ color: '#334155' }}>{formatDuration(e.total_playtime_seconds)}</div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Modals */}
      {modal.type && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4"
          style={{ backdropFilter: 'blur(8px)' }}
          onClick={e => { if (e.target === e.currentTarget) setModal({ type: null }); }}>
          <div className="card-glow p-6 w-full max-w-md shadow-2xl animate-in">

            {modal.type === 'kick' && (
              <>
                <MHead icon={<XCircle size={18} style={{ color: '#ff6b2b' }} />} iconBg="rgba(255,107,43,0.1)" iconBorder="rgba(255,107,43,0.25)" title="Kick Player" sub={modal.player?.username || ''} />
                <ByLine who={ownerName} />
                <input value={modalInput} onChange={e => setModalInput(e.target.value)} className="input mb-4" placeholder="Reason (optional)" />
                <MBtns onCancel={() => setModal({ type: null })} onConfirm={() => doKick(modal.player!, modalInput)}
                  confirmLabel="Kick" confirmStyle={{ background: 'linear-gradient(135deg, #ff6b2b, #ff8c4b)', color: 'white' }} />
              </>
            )}

            {modal.type === 'warn' && (
              <>
                <MHead icon={<AlertTriangle size={18} style={{ color: '#ffd60a' }} />} iconBg="rgba(255,214,10,0.1)" iconBorder="rgba(255,214,10,0.25)" title="Warn Player" sub={modal.player?.username || ''} />
                <ByLine who={ownerName} />
                <input value={modalInput} onChange={e => setModalInput(e.target.value)} className="input mb-3" placeholder="Custom message (optional)" />
                <div className="mb-4">
                  <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: '#334155' }}></p>
                </div>
                <MBtns onCancel={() => setModal({ type: null })} onConfirm={() => doWarn(modal.player!, modalInput)}
                  confirmLabel="Warn" confirmStyle={{ background: 'linear-gradient(135deg, #ffd60a, #ffea50)', color: '#000' }} />
              </>
            )}

            {modal.type === 'msg' && (
              <>
                <MHead icon={<MessageSquare size={18} style={{ color: '#00d4ff' }} />} iconBg="rgba(0,212,255,0.1)" iconBorder="rgba(0,212,255,0.25)" title={`Message ${modal.player?.username}`} sub="Private message" />
                <ByLine who={ownerName} />
                <textarea value={modalInput} onChange={e => setModalInput(e.target.value)} className="input mb-3 resize-none h-20" placeholder="Your message..." />
                {modalInput && (
                  <div className="mb-4">
                    <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: '#334155' }}></p>
                  </div>
                )}
                <MBtns onCancel={() => setModal({ type: null })} onConfirm={() => doMsg(modal.player!, modalInput)}
                  confirmLabel="Send" confirmStyle={{ background: 'linear-gradient(135deg, #00d4ff, #00b4dd)', color: '#000' }} disabled={!modalInput.trim()} />
              </>
            )}

            {modal.type === 'all_msg' && (
              <>
                <MHead icon={<MessageSquare size={18} style={{ color: '#6c3ce1' }} />} iconBg="rgba(108,60,225,0.1)" iconBorder="rgba(108,60,225,0.3)" title="Broadcast to All" sub="Shown on ALL player screens" />

                {/* Character selector with owner images */}
                <div className="mb-4">
                  <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#475569' }}>Send As</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BROADCAST_CHARS.map(ch => {
                      const c = OWNER_COLORS_MAP[ch];
                      const active = broadcastChar === ch;
                      return (
                        <button key={ch} onClick={() => setBroadcastChar(ch)}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all"
                          style={{
                            borderColor: active ? c : '#1a2a45',
                            background: active ? `${c}12` : '#060c18',
                            boxShadow: active ? `0 0 12px ${c}30` : 'none',
                          }}>
                          <div className="w-10 h-10 rounded-xl overflow-hidden" style={{ border: `2px solid ${active ? c : '#1a2a45'}` }}>
                            <img src={OWNER_IMAGES[ch]} alt={ch} className="w-full h-full object-cover"
                              onError={e => { (e.currentTarget as HTMLElement).style.background = c; }} />
                          </div>
                          <span className="text-xs font-bold" style={{ color: active ? c : '#475569' }}>{ch}</span>
                          {active && <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <textarea value={modalInput} onChange={e => setModalInput(e.target.value)} className="input mb-3 resize-none h-20" placeholder="Broadcast message..." />

                {modalInput && (
                  <div className="mb-4">
                    <p className="text-xs mb-2 uppercase tracking-widest" style={{ color: '#334155' }}></p>
                  </div>
                )}

                <MBtns onCancel={() => setModal({ type: null })} onConfirm={() => doMsg(null, modalInput, true)}
                  confirmLabel={`Broadcast as ${broadcastChar}`} confirmStyle={{ background: `linear-gradient(135deg, ${broadcastColor}cc, ${broadcastColor})`, color: broadcastColor === '#ffd60a' ? '#000' : 'white' }} disabled={!modalInput.trim()} />
              </>
            )}

            {modal.type === 'shutdown_id' && (
              <>
                <MHead icon={<Server size={18} style={{ color: '#ff2d55' }} />} iconBg="rgba(255,45,85,0.1)" iconBorder="rgba(255,45,85,0.25)" title="Reset Server by ID" sub="Shutdown a specific server" />
                <input value={shutdownId} onChange={e => setShutdownId(e.target.value)} className="input mb-4 font-mono text-sm" placeholder="Server Job ID" />
                <MBtns onCancel={() => setModal({ type: null })} onConfirm={async () => { await API.shutdown(shutdownId, false); toast('Server reset commanded', 'warn'); setModal({ type: null }); }}
                  confirmLabel="Reset" confirmStyle={{ background: 'linear-gradient(135deg, #ff2d55, #ff5570)', color: 'white' }} disabled={!shutdownId.trim()} />
              </>
            )}

            {modal.type === 'kill_game' && (
              <>
                <MHead icon={<Swords size={18} style={{ color: '#ff2d55' }} />} iconBg="rgba(255,45,85,0.08)" iconBorder="rgba(255,45,85,0.3)" title="Kill Game" sub="Kick everyone & block joins" />
                <div className="rounded-xl px-4 py-3 mb-4 text-xs" style={{ background: 'rgba(255,45,85,0.05)', border: '1px solid rgba(255,45,85,0.15)', color: 'rgba(255,45,85,0.7)' }}>
                  This kicks ALL players and blocks new joins until revived.
                </div>
                <div className="space-y-3 mb-4">
                  <input value={killAuth.user} onChange={e => setKillAuth(a => ({ ...a, user: e.target.value }))} className="input" placeholder="Username" />
                  <input type="password" value={killAuth.pass} onChange={e => setKillAuth(a => ({ ...a, pass: e.target.value }))} className="input" placeholder="Password" />
                </div>
                <MBtns onCancel={() => setModal({ type: null })} onConfirm={doKillGame}
                  confirmLabel="Kill Game" confirmStyle={{ background: 'linear-gradient(135deg, #ff2d55, #ff5570)', color: 'white' }} disabled={!!actionLoading} />
              </>
            )}

            {modal.type === 'revive_game' && (
              <>
                <MHead icon={<Unlock size={18} style={{ color: '#00ff88' }} />} iconBg="rgba(0,255,136,0.08)" iconBorder="rgba(0,255,136,0.3)" title="Revive Game" sub="Allow players to join again" />
                <div className="space-y-3 mb-4">
                  <input value={killAuth.user} onChange={e => setKillAuth(a => ({ ...a, user: e.target.value }))} className="input" placeholder="Username" />
                  <input type="password" value={killAuth.pass} onChange={e => setKillAuth(a => ({ ...a, pass: e.target.value }))} className="input" placeholder="Password" />
                </div>
                <MBtns onCancel={() => setModal({ type: null })} onConfirm={doReviveGame}
                  confirmLabel="Revive Game" confirmStyle={{ background: 'linear-gradient(135deg, #00ff88, #00cc6a)', color: '#000' }} disabled={!!actionLoading} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MHead({ icon, iconBg, iconBorder, title, sub }: { icon: React.ReactNode; iconBg: string; iconBorder: string; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: iconBg, border: `1px solid ${iconBorder}` }}>{icon}</div>
      <div>
        <h3 className="text-white font-black text-base uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>{title}</h3>
        <p className="text-slate-500 text-xs">{sub}</p>
      </div>
    </div>
  );
}
function ByLine({ who }: { who: string }) {
  return (
    <div className="rounded-xl px-3 py-2 mb-3 text-xs" style={{ background: 'rgba(108,60,225,0.06)', border: '1px solid rgba(108,60,225,0.15)' }}>
      <span style={{ color: '#8b5cf6' }} className="font-semibold">By:</span> <span className="text-white">{who}</span>
    </div>
  );
}
function MBtns({ onCancel, onConfirm, confirmLabel, confirmStyle, disabled }: {
  onCancel: () => void; onConfirm: () => void; confirmLabel: string; confirmStyle: React.CSSProperties; disabled?: boolean;
}) {
  return (
    <div className="flex gap-3">
      <button onClick={onCancel} className="btn-ghost flex-1 justify-center">Cancel</button>
      <button onClick={onConfirm} disabled={disabled} className="flex-1 font-bold py-2.5 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        style={confirmStyle}>{confirmLabel}</button>
    </div>
  );
}

function PlayerCard({ player: p, isBanned, isOwner, likedGame, sessionTime, actionLoading, onBan, onKick, onWarn, onMsg, onShutdown, onDiscord }: {
  player: OnlinePlayer; isBanned: boolean; isOwner: boolean; likedGame: boolean; sessionTime: string; actionLoading: string | null;
  onBan: () => void; onKick: () => void; onWarn: () => void; onMsg: () => void; onShutdown: () => void; onDiscord: () => void;
}) {
  const flag = countryFlag(p.country_code);
  return (
    <div className="card p-4 hover-lift group" style={{ borderColor: isBanned ? 'rgba(255,45,85,0.2)' : '#1a2a45' }}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <Avatar userId={p.roblox_user_id} avatarUrl={p.avatar_resolved || p.avatar_url} name={p.username} size="lg" />
          <div className="absolute -bottom-0.5 -right-0.5 status-dot-green" style={{ width: 10, height: 10, border: '2px solid #0d1526' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <a href={robloxProfileUrl(p.roblox_user_id)} target="_blank" rel="noopener noreferrer"
              className="font-bold text-white hover:text-purple-300 transition-colors">{p.display_name || p.username}</a>
            <span className="text-xs" style={{ color: '#334155' }}>@{p.username}</span>
            {isOwner && <span className="badge badge-purple"><Crown size={9} />Owner</span>}
            {isBanned && <span className="badge badge-critical">Banned</span>}
            {likedGame && (
              <span className="badge" style={{ background: 'rgba(255,45,85,0.12)', color: '#ff6b8a', borderColor: 'rgba(255,45,85,0.3)' }}>
                <Heart size={9} />Liked
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <InfoChip icon={DEVICE_ICONS[p.device_type] || <Monitor size={10} />} label={p.device_type || 'PC'} />
            <InfoChip icon={<Globe size={10} />} label={flag ? `${flag} ${p.country_code}` : p.country_code || 'Unknown'} />
            <InfoChip icon={<Timer size={10} />} label={sessionTime} color="#ffd60a" />
            <InfoChip icon={<Server size={10} />} label={(p.server_id?.substring(0, 8) || 'N/A') + '...'} mono />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3 pt-3" style={{ borderTop: '1px solid #111e35' }}>
        <PBtn icon={<ExternalLink size={10} />} label="Profile" onClick={() => window.open(robloxProfileUrl(p.roblox_user_id), '_blank')} c="cyan" />
        <PBtn icon={isBanned ? <Unlock size={10} /> : <Ban size={10} />} label={isBanned ? 'Unban' : 'Ban'} onClick={onBan} c={isBanned ? 'green' : 'red'} loading={actionLoading === `ban-${p.roblox_user_id}`} />
        <PBtn icon={<XCircle size={10} />} label="Kick" onClick={onKick} c="orange" />
        <PBtn icon={<AlertTriangle size={10} />} label="Warn" onClick={onWarn} c="yellow" />
        <PBtn icon={<MessageSquare size={10} />} label="Msg" onClick={onMsg} c="blue" />
        <PBtn icon={<Copy size={10} />} label="Copy" onClick={() => navigator.clipboard.writeText(robloxProfileUrl(p.roblox_user_id))} c="slate" />
        <PBtn icon={<RotateCcw size={10} />} label="Reset" onClick={onShutdown} c="red" />
        <PBtn icon={<Send size={10} />} label="Discord" onClick={onDiscord} c="purple" />
      </div>
    </div>
  );
}

function InfoChip({ icon, label, color, mono }: { icon: React.ReactNode; label: string; color?: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
      style={{ background: '#0a1220', border: '1px solid #1a2a45', color: color || '#475569', fontFamily: mono ? 'monospace' : undefined }}>
      {icon}<span>{label}</span>
    </div>
  );
}

function PBtn({ icon, label, onClick, c, loading }: { icon: React.ReactNode; label: string; onClick: () => void; c: string; loading?: boolean }) {
  const styles: Record<string, React.CSSProperties> = {
    red:    { background: 'rgba(255,45,85,0.08)',  border: '1px solid rgba(255,45,85,0.2)',  color: '#ff2d55' },
    green:  { background: 'rgba(0,255,136,0.08)',  border: '1px solid rgba(0,255,136,0.2)',  color: '#00ff88' },
    cyan:   { background: 'rgba(0,212,255,0.08)',  border: '1px solid rgba(0,212,255,0.2)',  color: '#00d4ff' },
    orange: { background: 'rgba(255,107,43,0.08)', border: '1px solid rgba(255,107,43,0.2)', color: '#ff6b2b' },
    yellow: { background: 'rgba(255,214,10,0.08)', border: '1px solid rgba(255,214,10,0.2)', color: '#ffd60a' },
    blue:   { background: 'rgba(0,212,255,0.06)',  border: '1px solid rgba(0,212,255,0.15)', color: '#7dd3fc' },
    purple: { background: 'rgba(108,60,225,0.08)', border: '1px solid rgba(108,60,225,0.2)', color: '#8b5cf6' },
    slate:  { background: 'rgba(255,255,255,0.04)', border: '1px solid #1a2a45',             color: '#475569' },
  };
  return (
    <button onClick={onClick} disabled={loading} style={styles[c] || styles.slate}
      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-40">
      {loading ? <div className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {label}
    </button>
  );
}