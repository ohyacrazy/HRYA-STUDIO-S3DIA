import { useState, useEffect, useCallback } from 'react';
import {
  Gamepad2, Plus, Trash2, Swords, Unlock, RefreshCw, Sparkles,
  Heart, RotateCcw, ExternalLink, Settings, BarChart2,
  WifiOff, Activity, Eye, AlertTriangle,
  CheckCircle, Shield, Zap
} from 'lucide-react';
import { API } from '../lib/api';
import { useCountUp } from '../hooks/useCountUp';

// Only these two places can ever be registered — kept in sync with the backend's REGISTERABLE_PLACE_IDS.
const REGISTERABLE_PLACE_IDS = ['88817119635622', '130852921874128'];

interface ManagedGame {
  id: string;
  game_id: string;
  name: string;
  image_url: string | null;
  universe_id: string | null;
  kill_active: boolean;
  created_at: string;
  likes?: number;
  gamepass_sales?: number;
  total_robux?: number;
  visits?: number;
  playing?: number;
}

function StatBadge({ value, label, color }: { value: number; label: string; color: string }) {
  const count = useCountUp(value, 900);
  return (
    <div className="flex flex-col items-center">
      <span className={`font-bold text-base leading-none ${color}`}>{count.toLocaleString()}</span>
      <span className="text-white/50 text-[10px] mt-0.5">{label}</span>
    </div>
  );
}

function GameCard({
  game,
  onKill,
  onRevive,
  onDelete,
  onAddId,
  onManage,
  onShutdown,
  onAnalytics,
}: {
  game: ManagedGame;
  onKill: () => void;
  onRevive: () => void;
  onDelete: () => void;
  onAddId: () => void;
  onManage: () => void;
  onShutdown: () => void;
  onAnalytics: () => void;
}) {
  const isDead = !game.game_id || game.game_id.trim() === '';
  const isKilled = game.kill_active;
  const statusColor = isDead || isKilled ? '#ff2d55' : '#00ff88';
  const statusLabel = isDead ? 'No ID' : isKilled ? 'Locked' : 'Live';

  return (
    <div className="tilt-card rounded-2xl overflow-hidden border" style={{ borderColor: '#1a2a45', background: '#0a1220' }}>
      {/* Thumbnail */}
      <div className="relative" style={{ aspectRatio: '16/9' }}>
        {game.image_url ? (
          <img src={game.image_url} alt={game.name}
            className="w-full h-full object-cover"
            style={{ opacity: isDead || isKilled ? 0.35 : 1 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        ) : (
          <div className="w-full h-full" style={{ background: '#0d1424' }} />
        )}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0a1220 0%, transparent 55%)' }} />

        <div className="absolute top-3 left-3 flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg"
          style={{ background: 'rgba(6,12,24,0.85)', border: `1px solid ${statusColor}40`, color: statusColor }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
          {statusLabel}
        </div>

        {!isDead && (
          <a href={`https://www.roblox.com/games/${game.game_id}`} target="_blank" rel="noopener noreferrer"
            className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-lg transition-colors hover:text-white"
            style={{ background: 'rgba(6,12,24,0.85)', border: '1px solid #1a2a45', color: '#64748b' }} title="Open on Roblox">
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="text-white font-bold text-base leading-tight mb-3 line-clamp-1">{game.name}</h3>

        {isDead ? (
          <button onClick={onAddId} className="btn-ghost w-full text-sm flex items-center justify-center gap-2">
            <Plus size={13} />Add Game ID
          </button>
        ) : (
          <>
            <div className="flex items-center gap-4 mb-4">
              <StatBadge value={game.visits ?? 0} label="Visits" color="text-[#e8b930]" />
              <StatBadge value={game.playing ?? 0} label="Playing" color="text-emerald-400" />
              <StatBadge value={game.likes ?? 0} label="Likes" color="text-blue-400" />
              <div className="ml-auto text-right">
                <div className="font-bold text-base leading-none" style={{ color: '#ffd60a' }}>R$ {(game.total_robux ?? 0).toLocaleString()}</div>
                <span className="text-[10px]" style={{ color: '#475569' }}>Robux</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ActionBtn icon={<Settings size={12} />} label="Manage" onClick={onManage} />
              <ActionBtn icon={<BarChart2 size={12} />} label="Stats" onClick={onAnalytics} />
              <ActionBtn icon={<RotateCcw size={12} />} label="Reset" onClick={onShutdown} />
              {isKilled
                ? <ActionBtn icon={<Unlock size={12} />} label="Revive" onClick={onRevive} variant="success" />
                : <ActionBtn icon={<Swords size={12} />} label="Kill" onClick={onKill} variant="danger" />
              }
              <button onClick={onDelete}
                className="ml-auto flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
                style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)', color: '#ff6b85' }}
                title="Delete game">
                <Trash2 size={12} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ActionBtn({
  icon, label, onClick, variant = 'default',
}: { icon: React.ReactNode; label: string; onClick: () => void; variant?: 'default' | 'danger' | 'success' }) {
  const styles: Record<string, React.CSSProperties> = {
    default: { background: '#0d1628', border: '1px solid #1a2a45', color: '#94a3b8' },
    danger:  { background: 'rgba(255,45,85,0.1)', border: '1px solid rgba(255,45,85,0.3)', color: '#ff6b85' },
    success: { background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' },
  };
  return (
    <button onClick={onClick} style={styles[variant]}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors hover:brightness-125">
      {icon}{label}
    </button>
  );
}

// ── Modals ──────────────────────────────────────────────────────────────────

function KillAuthModal({
  gameId, action, onClose, onSuccess,
}: { gameId: string; action: 'kill' | 'unkill'; onClose: () => void; onSuccess: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (user !== 'KillGame' || pass !== 'GameDied') { setErr('Wrong credentials'); return; }
    setLoading(true);
    if (action === 'kill') await API.killGame(gameId);
    else await API.unkillGame(gameId);
    setLoading(false);
    onSuccess();
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-glow p-6 w-full max-w-sm shadow-2xl animate-in gold-border-glow">
        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${action === 'kill' ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
            {action === 'kill' ? <Swords size={18} className="text-red-400" /> : <Unlock size={18} className="text-emerald-400" />}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{action === 'kill' ? 'Kill Game' : 'Revive Game'}</h3>
            <p className="text-slate-500 text-xs">{action === 'kill' ? 'Kick all players & block joins' : 'Allow players to join again'}</p>
          </div>
        </div>
        <div className="space-y-3 mb-4">
          <input value={user} onChange={e => setUser(e.target.value)} className="input w-full" placeholder="Username" />
          <input type="password" value={pass} onChange={e => setPass(e.target.value)} className="input w-full" placeholder="Password" onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {err && <p className="text-red-400 text-xs mb-3 flex items-center gap-1"><AlertTriangle size={11} />{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={submit} disabled={loading}
            className={`flex-1 font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 ${action === 'kill' ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}>
            {loading ? 'Processing...' : action === 'kill' ? 'Kill Game' : 'Revive'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddIdModal({ game, onClose, onSuccess }: { game: ManagedGame; onClose: () => void; onSuccess: () => void }) {
  const [placeId, setPlaceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function submit() {
    if (!placeId.trim()) { setErr('Enter a Place ID'); return; }
    if (!REGISTERABLE_PLACE_IDS.includes(placeId.trim())) {
      setErr(`Only ${REGISTERABLE_PLACE_IDS.join(' or ')} can be registered.`);
      return;
    }
    setLoading(true);
    setErr('');
    try {
      const info = await API.fetchRobloxGameInfo(placeId.trim());
      if (!info || info.error) { setErr('Game not found. Check the Place ID.'); setLoading(false); return; }
      await API.addGame(placeId.trim(), info.name || game.name, info.thumbnail || game.image_url || undefined, info.universeId || undefined);
      onSuccess();
    } catch {
      setErr('Failed to fetch game info. Try again.');
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-glow p-6 w-full max-w-sm shadow-2xl animate-in gold-border-glow">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#c9a227]/10 border border-[#c9a227]/25">
            <Gamepad2 size={18} className="text-[#c9a227]" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Register Game ID</h3>
            <p className="text-slate-500 text-xs">"{game.name}"</p>
          </div>
        </div>
        <p className="text-slate-400 text-xs mb-4 rounded-xl px-3 py-2.5" style={{ background: 'rgba(201,162,39,0.05)', border: '1px solid rgba(201,162,39,0.1)' }}>
          This game has no Roblox Place ID registered. Only {REGISTERABLE_PLACE_IDS.join(' or ')} can be entered here.
        </p>
        <div className="mb-4">
          <label className="text-slate-500 text-xs uppercase tracking-widest mb-2 block">Roblox Place ID</label>
          <input value={placeId} onChange={e => setPlaceId(e.target.value)} className="input w-full font-mono"
            placeholder="e.g. 123456789" onKeyDown={e => e.key === 'Enter' && submit()} />
        </div>
        {err && <p className="text-red-400 text-xs mb-3 flex items-center gap-1"><AlertTriangle size={11} />{err}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1">Cancel</button>
          <button onClick={submit} disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />Fetching...
              </span>
            ) : 'Fetch & Revive'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageGameModal({ game, onClose }: { game: ManagedGame; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-glow p-6 w-full max-w-lg shadow-2xl animate-in gold-border-glow">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            {game.image_url && (
              <img src={game.image_url} alt={game.name} className="w-12 h-12 rounded-xl object-cover" />
            )}
            <div>
              <h3 className="text-white font-bold text-lg">{game.name}</h3>
              <p className="text-slate-500 text-xs font-mono">Place ID: {game.game_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-white transition-colors text-lg">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Total Visits', value: (game.visits ?? 0).toLocaleString(), color: 'text-[#e8b930]', icon: <Eye size={13} /> },
            { label: 'Playing Now', value: (game.playing ?? 0).toLocaleString(), color: 'text-emerald-400', icon: <Activity size={13} /> },
            { label: 'Likes', value: (game.likes ?? 0).toLocaleString(), color: 'text-blue-400', icon: <Heart size={13} /> },
            { label: 'Robux Earned', value: `R$ ${(game.total_robux ?? 0).toLocaleString()}`, color: 'text-amber-400', icon: <Zap size={13} /> },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 flex items-center gap-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className={s.color}>{s.icon}</span>
              <div>
                <div className={`font-bold ${s.color}`}>{s.value}</div>
                <div className="text-slate-600 text-xs">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={12} className="text-[#c9a227]" />
            <span className="text-slate-400 text-xs uppercase tracking-widest">Status</span>
          </div>
          <div className="flex items-center gap-2">
            {game.kill_active
              ? <><WifiOff size={14} className="text-red-400" /><span className="text-red-300 text-sm font-semibold">Locked — no new joins</span></>
              : <><CheckCircle size={14} className="text-emerald-400" /><span className="text-emerald-300 text-sm font-semibold">Live — accepting players</span></>
            }
          </div>
        </div>

        <div className="flex gap-2">
          <a href={`https://www.roblox.com/games/${game.game_id}`} target="_blank" rel="noopener noreferrer"
            className="btn-ghost flex items-center gap-2 text-sm flex-1 justify-center">
            <ExternalLink size={13} />Open on Roblox
          </a>
          <button onClick={onClose} className="btn-ghost flex-1 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}

// ── Discord status section ────────────────────────────────────────────────

function DiscordSection({ games }: { games: ManagedGame[] }) {
  const totalPlaying = games.reduce((s, g) => s + (g.playing ?? 0), 0);
  const totalVisits = games.reduce((s, g) => s + (g.visits ?? 0), 0);
  const activeGames = games.filter(g => g.game_id && !g.kill_active).length;

  const playingCount = useCountUp(totalPlaying, 800);
  const visitsCount = useCountUp(totalVisits, 1200);

  return (
    <div className="rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
      style={{
        background: 'linear-gradient(135deg, rgba(88,101,242,0.12) 0%, rgba(88,101,242,0.04) 100%)',
        border: '1px solid rgba(88,101,242,0.3)',
      }}>
      {/* Discord icon */}
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: 'rgba(88,101,242,0.2)', border: '1.5px solid rgba(88,101,242,0.4)' }}>
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-white font-bold text-base">HRYA-sadiaa Discord</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(88,101,242,0.2)', border: '1px solid rgba(88,101,242,0.4)', color: '#7289da' }}>
            LINKED
          </span>
        </div>
        <p className="text-slate-500 text-xs">Alerts, 2FA codes, and admin notifications are sent here.</p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="text-center">
          <div className="text-lg font-bold text-emerald-400">{playingCount.toLocaleString()}</div>
          <div className="text-slate-600 text-[10px]">In-Game Now</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="text-lg font-bold" style={{ color: '#7289da' }}>{visitsCount.toLocaleString()}</div>
          <div className="text-slate-600 text-[10px]">Total Visits</div>
        </div>
        <div className="w-px h-8 bg-white/10" />
        <div className="text-center">
          <div className="text-lg font-bold text-[#e8b930]">{activeGames}</div>
          <div className="text-slate-600 text-[10px]">Active Games</div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Games() {
  const [games, setGames] = useState<ManagedGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [fetchingInfo, setFetchingInfo] = useState(false);

  const [killModal, setKillModal] = useState<{ gameId: string; action: 'kill' | 'unkill' } | null>(null);
  const [addIdModal, setAddIdModal] = useState<ManagedGame | null>(null);
  const [manageModal, setManageModal] = useState<ManagedGame | null>(null);

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 4000); }

  const load = useCallback(async () => {
    setLoading(true);
    const res = await API.getGames();
    setGames(res.games ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh Roblox game stats every 30 minutes
  useEffect(() => {
    const t = setInterval(async () => {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roblox-api/games/refresh-stats`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
        },
        body: '{}',
      }).catch(() => { });
      load();
    }, 30 * 60 * 1000);
    return () => clearInterval(t);
  }, [load]);

  async function addRegisterableGame(id: string) {
    setFetchingInfo(true);
    try {
      const info = await API.fetchRobloxGameInfo(id);
      if (info?.name) {
        await API.addGame(id, info.name, info.thumbnail || undefined, info.universeId || undefined);
        showToast(`Added: ${info.name}`);
        setShowAdd(false);
        load();
      } else {
        showToast('Could not fetch game info from Roblox.');
      }
    } catch {
      showToast('Failed to fetch game info from Roblox');
    }
    setFetchingInfo(false);
  }

  async function deleteGame(id: string) {
    if (!confirm('Remove this game from the panel?')) return;
    await API.deleteGame(id);
    showToast('Game removed');
    load();
  }

  // Summary stats for header
  const totalVisits = games.reduce((s, g) => s + (g.visits ?? 0), 0);
  const totalPlaying = games.reduce((s, g) => s + (g.playing ?? 0), 0);
  const totalLikes = games.reduce((s, g) => s + (g.likes ?? 0), 0);
  const activeGames = games.filter(g => g.game_id && !g.kill_active).length;
  const deadGames = games.filter(g => !g.game_id || g.game_id.trim() === '').length;

  const visitsHeader = useCountUp(totalVisits, 1200);
  const playingHeader = useCountUp(totalPlaying, 900);
  const likesHeader = useCountUp(totalLikes, 1000);

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-toast px-4 py-3 rounded-xl text-sm font-medium shadow-2xl"
          style={{ background: '#0d0e0a', border: '1px solid rgba(201,162,39,0.3)', color: '#e8b930' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Games</h1>
          <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: '#334155' }}>
            {games.length} managed · {activeGames} active
            {deadGames > 0 && <span className="text-red-400 ml-1">· {deadGames} dead</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAdd(v => !v)} className="btn-primary text-sm flex items-center gap-1.5">
            <Plus size={13} />Add Game
          </button>
          <button onClick={load} className="btn-ghost text-sm flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Summary stats strip */}
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Visits', value: visitsHeader, icon: <Eye size={14} />, color: 'text-[#e8b930]', border: 'border-[#c9a227]/20' },
          { label: 'Playing Now', value: playingHeader, icon: <Activity size={14} />, color: 'text-emerald-400', border: 'border-emerald-500/20' },
          { label: 'Total Likes', value: likesHeader, icon: <Heart size={14} />, color: 'text-blue-400', border: 'border-blue-500/20' },
        ].map(s => (
          <div key={s.label} className={`stat-card border ${s.border} hover-lift stat-accent`}>
            <div className={`flex items-center gap-1.5 ${s.color} text-xs`}>{s.icon}{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      {/* Discord integration section */}
      {games.length > 0 && <DiscordSection games={games} />}

      {/* Add Game — locked to exactly two places, nothing else can ever be registered */}
      {showAdd && (
        <div className="card p-5">
          <h3 className="text-white font-semibold text-sm mb-1 flex items-center gap-2">
            <Sparkles size={14} className="text-[#c9a227]" />Register a Game
          </h3>
          <p className="text-slate-600 text-xs mb-4">Only these two places can be registered — nothing else will ever run.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {REGISTERABLE_PLACE_IDS.map(id => {
              const already = games.some(g => g.game_id === id);
              return (
                <button key={id} disabled={already || fetchingInfo} onClick={() => addRegisterableGame(id)}
                  className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border text-sm font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ borderColor: already ? 'rgba(0,255,136,0.3)' : '#1a2a45', background: already ? 'rgba(0,255,136,0.06)' : '#0a1220', color: already ? '#00ff88' : '#cbd5e1' }}>
                  <span>{id}</span>
                  {already ? <CheckCircle size={14} /> : fetchingInfo ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-4">
            <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Close</button>
          </div>
        </div>
      )}

      {/* Games grid */}
      {loading ? (
        <div className="card p-20 text-center text-slate-600">Loading games...</div>
      ) : games.length === 0 ? (
        <div className="card p-16 text-center">
          <Gamepad2 size={28} className="mx-auto mb-3 text-slate-700" />
          <p className="text-slate-400 font-medium">No games added yet</p>
          <p className="text-slate-600 text-sm mt-1">Add your first Roblox game by Place ID to get started</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary mt-4 text-sm flex items-center gap-1.5 mx-auto">
            <Plus size={13} />Add First Game
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {games.map(g => (
            <GameCard
              key={g.id}
              game={g}
              onKill={() => setKillModal({ gameId: g.id, action: 'kill' })}
              onRevive={() => setKillModal({ gameId: g.id, action: 'unkill' })}
              onDelete={() => deleteGame(g.id)}
              onAddId={() => setAddIdModal(g)}
              onManage={() => setManageModal(g)}
              onShutdown={async () => {
                await API.shutdown(undefined, false);
                showToast(`Server reset commanded for ${g.name}`);
              }}
              onAnalytics={() => showToast('Switch to Analytics tab to view full stats')}
            />
          ))}
        </div>
      )}

      {/* Kill auth modal */}
      {killModal && (
        <KillAuthModal
          gameId={killModal.gameId}
          action={killModal.action}
          onClose={() => setKillModal(null)}
          onSuccess={() => { setKillModal(null); showToast(killModal.action === 'kill' ? 'Game killed' : 'Game revived'); load(); }}
        />
      )}

      {/* Add ID modal */}
      {addIdModal && (
        <AddIdModal
          game={addIdModal}
          onClose={() => setAddIdModal(null)}
          onSuccess={() => { setAddIdModal(null); showToast('Game ID registered — game revived'); load(); }}
        />
      )}

      {/* Manage modal */}
      {manageModal && (
        <ManageGameModal game={manageModal} onClose={() => setManageModal(null)} />
      )}
    </div>
  );
}
