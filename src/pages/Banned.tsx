import { useState, useEffect, useCallback } from 'react';
import { Ban, Unlock, RefreshCw, ExternalLink, Search, UserX, Crown } from 'lucide-react';
import { API, timeSince, robloxProfileUrl, OWNER_IDS } from '../lib/api';
import Avatar from '../components/Avatar';

interface BannedPlayer {
  id: number;
  roblox_user_id: number;
  username: string;
  display_name: string;
  avatar_url: string;
  reason: string;
  banned_by: string;
  banned_at: string;
}

export default function Banned() {
  const [players, setPlayers] = useState<BannedPlayer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [unbanning, setUnbanning] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await API.getBannedPlayers();
    setPlayers(res.players ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function unban(player: BannedPlayer) {
    setUnbanning(player.roblox_user_id);
    await API.unban(player.roblox_user_id);
    setPlayers(p => p.filter(x => x.roblox_user_id !== player.roblox_user_id));
    showToast(`Unbanned ${player.username} — they can now join again`);
    setUnbanning(null);
  }

  const filtered = players.filter(p =>
    !search || p.username?.toLowerCase().includes(search.toLowerCase()) ||
    p.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    String(p.roblox_user_id).includes(search)
  );

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-toast px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl flex items-center gap-2"
          style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)', color: '#00ff88' }}>
          <Unlock size={13} />{toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Banned Players</h1>
          <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: '#334155' }}>{players.length} permanently blocked from joining</p>
        </div>
        <button onClick={load} className="btn-ghost text-sm flex items-center gap-1.5">
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
        </button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="input w-full pl-11"
          placeholder="Search by username, display name, or user ID..."
        />
      </div>

      {loading ? (
        <div className="card p-20 text-center" style={{ color: '#334155' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-20 text-center">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,45,85,0.08)', border: '1px solid rgba(255,45,85,0.2)' }}>
            <UserX size={28} style={{ color: '#334155' }} />
          </div>
          <p className="font-bold text-sm uppercase tracking-wider" style={{ color: '#334155' }}>{search ? 'No matching players' : 'No banned players'}</p>
          <p className="text-slate-600 text-sm mt-1">
            {search ? 'Try a different search' : 'Players you ban will appear here and cannot rejoin until unbanned'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map(p => {
            const isOwner = OWNER_IDS.includes(p.roblox_user_id);
            return (
              <div key={p.roblox_user_id} className="card p-5 flex flex-col gap-4 hover-lift"
                style={{ borderColor: isOwner ? 'rgba(255,214,10,0.2)' : 'rgba(255,45,85,0.2)', background: isOwner ? 'rgba(10,8,0,0.5)' : 'rgba(18,6,10,0.5)' }}>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <Avatar userId={p.roblox_user_id} avatarUrl={p.avatar_url} name={p.username || '?'} size="lg" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center"
                      style={{ background: isOwner ? '#2a1a00' : '#1a0008', borderColor: '#0a1220' }}>
                      {isOwner ? <Crown size={10} style={{ color: '#ffd60a' }} /> : <Ban size={10} style={{ color: '#ff2d55' }} />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-white font-bold truncate">{p.display_name || p.username}</span>
                      {isOwner && <span className="tag bg-yellow-500/10 text-yellow-400 border-yellow-500/25 flex items-center gap-1 shrink-0"><Crown size={9}/>Owner</span>}
                    </div>
                    <div className="text-slate-500 text-sm">@{p.username}</div>
                    <div className="text-slate-700 text-xs font-mono mt-0.5">ID: {p.roblox_user_id}</div>
                  </div>
                </div>

                <div className={`border rounded-xl p-3 space-y-1.5 text-xs ${isOwner ? 'bg-yellow-500/5 border-yellow-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5" style={{ color: isOwner ? 'rgba(255,214,10,0.5)' : 'rgba(255,45,85,0.5)' }}>Reason</span>
                    <span className="font-semibold" style={{ color: isOwner ? '#ffd60a' : '#ff2d55' }}>{p.reason || 'No reason provided'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#334155' }}>Banned by</span>
                    <span style={{ color: '#64748b' }}>{p.banned_by || 'Admin'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{ color: '#334155' }}>Banned</span>
                    <span style={{ color: '#64748b' }}>{timeSince(p.banned_at)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => unban(p)}
                    disabled={unbanning === p.roblox_user_id}
                    className="btn-success flex-1 flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-50"
                  >
                    {unbanning === p.roblox_user_id
                      ? <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                      : <Unlock size={14} />}
                    Unban
                  </button>
                  <a
                    href={robloxProfileUrl(p.roblox_user_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost flex items-center justify-center gap-1.5 text-sm px-3"
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
