import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, BarChart2, Users, Clock, Trophy, TrendingUp, TrendingDown,
  Save, Send, Plus, Crown, RotateCcw, Activity, Target, PieChart,
  Globe, Filter, ArrowUpRight, ArrowDownRight, Zap, BarChart3,
  Eye, Heart, Server, CheckCircle, WifiOff, Swords, Shield, Star
} from 'lucide-react';
import { API, formatDuration, OWNER_IDS, countryFlag } from '../lib/api';
import Avatar from '../components/Avatar';
import { useCountUp } from '../hooks/useCountUp';

interface AnalyticsData {
  device_breakdown: Record<string, number>;
  country_breakdown: Record<string, number>;
  hourly_joins: Record<string, number>;
  daily_joins: Record<string, number>;
  monthly_joins: Record<string, number>;
  total_players: number;
  total_playtime_seconds: number;
  total_sessions: number;
  avg_session_seconds: number;
  new_players: number;
  returning_players: number;
  weekly_joins: number;
  prev_week_joins: number;
  join_change_pct: string | null;
  peak_hour: string;
  retention_rate: number;
  game_likes?: number;
  gamepass_bought?: number;
  total_robux?: number;
  total_visits?: number;
  total_playing?: number;
  total_game_likes?: number;
}
interface Snapshot { id: number; name: string; snapshot_data: any; created_at: string; }
interface LeaderEntry {
  roblox_user_id: number; username: string; display_name: string;
  avatar_url: string; avatar_resolved: string;
  total_playtime_seconds: number; session_count: number;
  country_code: string; device_type: string;
  liked_game?: boolean;
}

const CHART_COLORS = ['#6c3ce1', '#00d4ff', '#00ff88', '#ff6b2b', '#ff2d55', '#ffd60a', '#f97316', '#ec4899', '#8b5cf6', '#14b8a6'];

/* ── Animated Stat Card ────────────────────────────────────────────────── */
function AnimatedStat({ label, value, icon, color, accentBorder, suffix = '', arrow, arrowColor, subLabel }: {
  label: string; value: number; icon: React.ReactNode;
  color: string; accentBorder: string; suffix?: string;
  arrow?: React.ReactNode; arrowColor?: string; subLabel?: string;
}) {
  const count = useCountUp(value, 1200);
  return (
    <div className="stat-card tilt-card" style={{ borderColor: accentBorder }}>
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: '#475569' }}>
        <span style={{ color }}>{icon}</span>{label}
      </div>
      <div className="flex items-center gap-2">
        <div className="stat-number" style={{ color, textShadow: `0 0 20px ${color}60` }}>{count.toLocaleString()}{suffix}</div>
        {arrow && <span style={{ color: arrowColor }}>{arrow}</span>}
      </div>
      {subLabel && <div className="text-xs mt-1" style={{ color: '#334155' }}>{subLabel}</div>}
    </div>
  );
}

/* ── Donut chart ────────────────────────────────────────────────────────── */
function DonutChart({ data, title }: { data: Record<string, number>; title: string }) {
  const sorted = Object.entries(data).sort(([, a], [, b]) => b - a).slice(0, 8);
  const total = sorted.reduce((s, [, v]) => s + v, 0) || 1;
  let cumulative = 0;
  const segments = sorted.map(([key, val], i) => {
    const pct = val / total;
    const start = cumulative;
    cumulative += pct;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const r = 40; const cx = 60; const cy = 60;
    const x1 = cx + r * Math.cos(startAngle); const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle); const y2 = cy + r * Math.sin(endAngle);
    const largeArc = pct > 0.5 ? 1 : 0;
    const path = total === val
      ? `M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 1 ${2 * r} 0 a ${r} ${r} 0 1 1 -${2 * r} 0`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { key, val, pct, path, color: CHART_COLORS[i % CHART_COLORS.length] };
  });
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest mb-4 flex items-center gap-2 font-semibold" style={{ color: '#475569' }}>
        <PieChart size={13} style={{ color: '#6c3ce1' }} />{title}
      </h4>
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
          {segments.map(s => (<path key={s.key} d={s.path} fill={s.color} opacity={0.9} />))}
          <circle cx="60" cy="60" r="24" fill="#0a1220" />
          <text x="60" y="64" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="Inter">{total}</text>
        </svg>
        <div className="space-y-1.5 flex-1 min-w-0">
          {segments.map(s => (
            <div key={s.key} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
              <span className="text-slate-300 flex-1 truncate">{s.key}</span>
              <span className="text-slate-500 shrink-0">{(s.pct * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Hourly bar ─────────────────────────────────────────────────────────── */
function HourBar({ data }: { data: Record<string, number> }) {
  const entries = Array.from({ length: 24 }, (_, i) => ({ h: i, v: data[i] ?? 0 }));
  const max = Math.max(...entries.map(e => e.v), 1);
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2 font-semibold" style={{ color: '#475569' }}>
        <Clock size={13} style={{ color: '#00d4ff' }} />Hourly Activity (UTC)
      </h4>
      <div className="flex items-end gap-0.5 h-20">
        {entries.map(({ h, v }) => (
          <div key={h} className="flex-1 flex flex-col items-center gap-0.5 group" title={`${h}:00 — ${v} joins`}>
            <div className="w-full rounded-t transition-all duration-300"
              style={{ height: `${Math.max((v / max) * 100, 2)}%`, background: `rgba(108,60,225,${0.3 + (v / max) * 0.7})` }} />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-xs mt-1" style={{ color: '#1a2a45' }}>
        <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
      </div>
    </div>
  );
}

/* ── Daily bar ──────────────────────────────────────────────────────────── */
function DayBar({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2 font-semibold" style={{ color: '#475569' }}>
        <Activity size={13} style={{ color: '#00d4ff' }} />Daily Joins (30 Days)
      </h4>
      <div className="flex items-end gap-0.5 h-24">
        {entries.map(([day, v]) => (
          <div key={day} className="flex-1 flex flex-col items-center" title={`${day}: ${v}`}>
            <div className="w-full rounded-t transition-all duration-300"
              style={{ height: `${Math.max((v / max) * 100, 2)}%`, background: `rgba(0,212,255,${0.3 + (v / max) * 0.7})` }} />
          </div>
        ))}
      </div>
      {entries.length > 0 && (
        <div className="flex justify-between text-xs mt-1" style={{ color: '#1a2a45' }}>
          <span>{entries[0]?.[0]?.substring(5)}</span>
          <span>{entries[Math.floor(entries.length / 2)]?.[0]?.substring(5)}</span>
          <span>{entries[entries.length - 1]?.[0]?.substring(5)}</span>
        </div>
      )}
    </div>
  );
}

/* ── Monthly growth chart (SVG polyline) ────────────────────────────────── */
function GrowthChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-12);
  const values = entries.map(([, v]) => v);
  const max = Math.max(...values, 1);
  const W = 300; const H = 80; const PAD = 6;
  const points = entries.map(([, v], i) => {
    const x = PAD + (i / Math.max(entries.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = entries.length > 0
    ? `${PAD},${H - PAD} ` + points + ` ${PAD + ((entries.length - 1) / Math.max(entries.length - 1, 1)) * (W - PAD * 2)},${H - PAD}`
    : '';
  return (
    <div>
      <h4 className="text-xs uppercase tracking-widest mb-3 flex items-center gap-2 font-semibold" style={{ color: '#475569' }}>
        <TrendingUp size={13} style={{ color: '#6c3ce1' }} />Monthly Growth (12 Mo)
      </h4>
      {entries.length === 0 ? (
        <div className="text-xs text-center py-8" style={{ color: '#1a2a45' }}>No data yet</div>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: '80px' }}>
            <defs>
              <linearGradient id="growthGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6c3ce1" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6c3ce1" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {areaPoints && <polygon points={areaPoints} fill="url(#growthGrad2)" />}
            {points && <polyline points={points} fill="none" stroke="#6c3ce1" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
            {entries.map(([, v], i) => {
              const x = PAD + (i / Math.max(entries.length - 1, 1)) * (W - PAD * 2);
              const y = H - PAD - ((v / max) * (H - PAD * 2));
              return <circle key={i} cx={x} cy={y} r="3" fill="#6c3ce1" stroke="#0a1220" strokeWidth="1.5" />;
            })}
          </svg>
          <div className="flex justify-between text-xs mt-1" style={{ color: '#1a2a45' }}>
            <span>{entries[0]?.[0]?.substring(5)}</span>
            <span>{entries[entries.length - 1]?.[0]?.substring(5)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Engagement Gauge (SVG arc) ─────────────────────────────────────────── */
function EngagementGauge({ rate }: { rate: number }) {
  const clampedRate = Math.min(Math.max(rate, 0), 100);
  const r = 52; const circ = Math.PI * r;
  const dashOffset = circ - (clampedRate / 100) * circ;
  const color = clampedRate >= 70 ? '#00ff88' : clampedRate >= 40 ? '#6c3ce1' : '#ff2d55';
  return (
    <div className="flex flex-col items-center">
      <h4 className="text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5 self-start font-semibold" style={{ color: '#475569' }}>
        <Target size={13} style={{ color: '#6c3ce1' }} />Engagement Rate
      </h4>
      <svg viewBox="0 0 140 90" className="w-36 h-24">
        <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke="#1a2a45" strokeWidth="8" strokeLinecap="round" />
        <path d="M 18 70 A 52 52 0 0 1 122 70" fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={dashOffset}
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)', transformOrigin: '70px 70px' }} />
        <text x="70" y="60" textAnchor="middle" fill="white" fontSize="22" fontWeight="800" fontFamily="Exo 2, sans-serif"
          style={{ textShadow: `0 0 20px ${color}` }}>{clampedRate}</text>
        <text x="70" y="74" textAnchor="middle" fill="rgba(148,163,184,0.6)" fontSize="10" fontFamily="Inter">%</text>
      </svg>
      <p className="text-xs -mt-1" style={{ color: clampedRate >= 70 ? '#00ff88' : clampedRate >= 40 ? '#8b5cf6' : '#ff2d55' }}>
        {clampedRate >= 70 ? 'Excellent retention' : clampedRate >= 40 ? 'Good retention' : 'Needs improvement'}
      </p>
    </div>
  );
}

/* ── Revenue bar ────────────────────────────────────────────────────────── */
function RevenueBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max((value / max) * 100, 1) : 1;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 text-right">
        <div className="text-slate-300 text-xs font-medium truncate">{label}</div>
      </div>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden" style={{ background: '#1a2a45' }}>
        <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="w-16 text-right text-xs font-bold" style={{ color }}>R$ {value.toLocaleString()}</div>
    </div>
  );
}

/* ── Main Analytics ──────────────────────────────────────────────────────── */
export default function Analytics() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [gsData, setGsData] = useState<any>(null);
  const [revenue, setRevenue] = useState<{ gamepass_robux: number; devproduct_robux: number; total_logged: number; purchase_count: number; per_game: { game_id: string; name: string; total: number }[] } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [compareA, setCompareA] = useState<Snapshot | null>(null);
  const [compareB, setCompareB] = useState<Snapshot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tab, setTab] = useState<'overview' | 'compare'>('overview');
  const [filter, setFilter] = useState<'all' | 'most_sessions' | 'most_time'>('all');

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 3500); }

  const load = useCallback(async () => {
    setLoading(true);
    const [aRes, lbRes, snapRes, gsRes, revRes] = await Promise.all([
      API.getAnalytics(), API.getLeaderboard(), API.getSnapshots(), API.getGameStats(), API.getRevenueBreakdown(),
    ]);
    setData(aRes);
    setGsData(gsRes);
    setLeaderboard(lbRes.leaderboard ?? []);
    setSnapshots(snapRes.snapshots ?? []);
    setRevenue(revRes ?? null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function saveSnap() {
    if (!data || !snapshotName.trim()) return;
    await API.saveSnapshot(snapshotName.trim(), data);
    showToast(`Snapshot "${snapshotName}" saved`);
    setSnapshotName('');
    const res = await API.getSnapshots();
    setSnapshots(res.snapshots ?? []);
  }

  async function sendDiscordAnalytics() {
    if (!data) return;
    await API.sendDiscord({
      embeds: [{
        title: '📊 Analytics Report — HRYA-sadiaa',
        color: 0x6c3ce1,
        thumbnail: { url: 'https://images.pexels.com/photos/3861969/pexels-photo-3861969.jpeg?auto=compress&cs=tinysrgb&w=200' },
        fields: [
          { name: '👥 Total Players',    value: `**${data.total_players.toLocaleString()}**`,               inline: true },
          { name: '👁️ Total Visits',    value: `**${(data.total_visits || 0).toLocaleString()}**`,          inline: true },
          { name: '🟢 Playing Now',      value: `**${(data.total_playing || 0).toLocaleString()}**`,         inline: true },
          { name: '💬 Total Sessions',   value: `**${data.total_sessions.toLocaleString()}**`,               inline: true },
          { name: '⏱️ Avg Session',     value: `**${formatDuration(data.avg_session_seconds)}**`,            inline: true },
          { name: '📅 Weekly Joins',     value: `**${data.weekly_joins.toLocaleString()}**`,                 inline: true },
          { name: '🔄 Retention',        value: `**${data.retention_rate}%**`,                               inline: true },
          { name: '❤️ Game Likes',      value: `**${(data.total_game_likes || data.game_likes || 0).toLocaleString()}**`, inline: true },
          { name: '💰 Total Robux',      value: `**R$ ${(data.total_robux || 0).toLocaleString()}**`,        inline: true },
          { name: '🎮 Gamepass Sales',   value: `**${(data.gamepass_bought || 0).toLocaleString()}**`,       inline: true },
          { name: '🆕 New Players',      value: `**${data.new_players.toLocaleString()}**`,                  inline: true },
          { name: '🔁 Returning',        value: `**${data.returning_players.toLocaleString()}**`,            inline: true },
        ],
        footer: { text: `HRYA-sadiaa Analytics · ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      }],
    });
    showToast('Analytics sent to Discord');
  }

  async function sendCompareToDiscord() {
    if (!compareA || !compareB) return;
    const fields = [
      { key: 'total_players',          label: '👥 Players' },
      { key: 'total_sessions',         label: '💬 Sessions' },
      { key: 'weekly_joins',           label: '📅 Weekly Joins' },
      { key: 'new_players',            label: '🆕 New Players' },
      { key: 'returning_players',      label: '🔁 Returning' },
      { key: 'retention_rate',         label: '🔄 Retention' },
      { key: 'total_visits',           label: '👁️ Visits' },
      { key: 'total_robux',            label: '💰 Robux' },
    ].map(({ key, label }) => {
      const aVal = compareA.snapshot_data[key] ?? 0;
      const bVal = compareB.snapshot_data[key] ?? 0;
      const pct = aVal > 0 ? (((bVal - aVal) / aVal) * 100).toFixed(1) : '—';
      const arrow = parseFloat(pct) >= 0 ? '📈' : '📉';
      return {
        name: label,
        value: `${aVal.toLocaleString()} → **${bVal.toLocaleString()}** ${arrow} \`${pct}%\``,
        inline: false,
      };
    });

    await API.sendDiscord({
      embeds: [{
        title: `📊 Snapshot Comparison`,
        color: 0x8b5cf6,
        description: `**${compareA.name}** vs **${compareB.name}**`,
        fields,
        footer: { text: `HRYA-sadiaa Analytics · ${new Date().toUTCString()}` },
        timestamp: new Date().toISOString(),
      }],
    });
    showToast('Comparison sent to Discord');
  }

  async function resetPlaytime() {
    if (!confirm('Reset ALL playtime and session data? This cannot be undone.')) return;
    await API.resetPlaytime();
    showToast('All playtime reset to 0');
    load();
  }

  function comparePct(a: number, b: number): { pct: string; up: boolean } {
    if (!a && !b) return { pct: '0%', up: true };
    if (!a) return { pct: '+100%', up: true };
    const p = ((b - a) / Math.abs(a) * 100);
    return { pct: `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`, up: p >= 0 };
  }

  const filteredLeaderboard = useCallback(() => {
    let lb = [...leaderboard];
    if (filter === 'most_sessions') lb.sort((a, b) => b.session_count - a.session_count);
    if (filter === 'most_time') lb.sort((a, b) => b.total_playtime_seconds - a.total_playtime_seconds);
    return lb;
  }, [leaderboard, filter]);

  const engagementRate = data
    ? Math.min(Math.round((data.total_sessions / Math.max(data.total_players, 1)) * 10), 100)
    : 0;

  const killActive = gsData?.stats?.kill_game_active ?? false;
  const serversOnline = gsData?.stats?.servers_online ?? 0;
  const securityAlerts = gsData?.security_alerts ?? 0;
  const pendingReports = gsData?.pending_reports ?? 0;

  const jp = data?.join_change_pct ?? null;

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed top-4 right-4 z-50 animate-toast px-4 py-3 rounded-xl text-sm font-semibold shadow-2xl"
          style={{ background: 'rgba(108,60,225,0.12)', border: '1px solid rgba(108,60,225,0.3)', color: '#c4b5fd' }}>
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Analytics</h1>
          <p className="text-xs uppercase tracking-widest mt-0.5" style={{ color: '#334155' }}>Real data from your Roblox game</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {data && (
            <button onClick={sendDiscordAnalytics} className="btn-ghost text-sm flex items-center gap-1.5">
              <Send size={13} />Discord
            </button>
          )}
          <button onClick={resetPlaytime} className="btn-danger text-sm flex items-center gap-1.5">
            <RotateCcw size={13} />Reset
          </button>
          <button onClick={load} className="btn-ghost text-sm flex items-center gap-1.5">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />Refresh
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {(['overview', 'compare'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-bold border transition-all uppercase tracking-wider"
            style={tab === t
              ? { background: 'rgba(108,60,225,0.15)', borderColor: 'rgba(108,60,225,0.4)', color: '#c4b5fd' }
              : { background: 'rgba(255,255,255,0.03)', borderColor: '#1a2a45', color: '#475569' }}>
            {t}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="card p-20 text-center">
          <BarChart2 size={32} className="mx-auto mb-3" style={{ color: '#1a2a45' }} />
          <p style={{ color: '#334155' }}>{loading ? 'Loading...' : 'No data yet — players populate this automatically'}</p>
        </div>
      ) : tab === 'overview' ? (
        <>
          {/* Session & Player metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
            <AnimatedStat label="Total Players" value={data.total_players} icon={<Users size={15} />} color="#00d4ff" accentBorder="rgba(0,212,255,0.2)"
              arrow={jp ? (parseFloat(jp) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />) : null}
              arrowColor={parseFloat(jp || '0') >= 0 ? '#00ff88' : '#ff2d55'} />
            <AnimatedStat label="Sessions" value={data.total_sessions} icon={<Activity size={15} />} color="#00ff88" accentBorder="rgba(0,255,136,0.2)" />
            <AnimatedStat label="New Players" value={data.new_players} icon={<TrendingUp size={15} />} color="#00d4ff" accentBorder="rgba(0,212,255,0.2)" />
            <AnimatedStat label="Returning" value={data.returning_players} icon={<Target size={15} />} color="#8b5cf6" accentBorder="rgba(139,92,246,0.2)" />
            <AnimatedStat label="Weekly Joins" value={data.weekly_joins} icon={<BarChart3 size={15} />} color="#00d4ff" accentBorder="rgba(0,212,255,0.2)"
              arrow={jp ? (parseFloat(jp) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />) : null}
              arrowColor={parseFloat(jp || '0') >= 0 ? '#00ff88' : '#ff2d55'} />
            <AnimatedStat label="Retention" value={data.retention_rate} suffix="%" icon={<Target size={15} />} color="#8b5cf6" accentBorder="rgba(139,92,246,0.2)"
              arrow={data.retention_rate >= 50 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              arrowColor={data.retention_rate >= 50 ? '#00ff88' : '#ff2d55'} />
          </div>

          {/* Game / Revenue stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
            <AnimatedStat label="Total Visits" value={data.total_visits || 0} icon={<Eye size={15} />} color="#ffd60a" accentBorder="rgba(255,214,10,0.2)" subLabel="All registered games" />
            <AnimatedStat label="Playing Now" value={data.total_playing || 0} icon={<Activity size={15} />} color="#00ff88" accentBorder="rgba(0,255,136,0.2)" />
            <AnimatedStat label="Game Likes" value={data.total_game_likes || data.game_likes || 0} icon={<Heart size={15} />} color="#ff2d55" accentBorder="rgba(255,45,85,0.2)" />
            <AnimatedStat label="Gamepass Sales" value={data.gamepass_bought || 0} icon={<Zap size={15} />} color="#8b5cf6" accentBorder="rgba(139,92,246,0.2)" />
            <AnimatedStat label="Total Robux" value={data.total_robux || 0} icon={<Star size={15} />} color="#ff6b2b" accentBorder="rgba(255,107,43,0.2)" subLabel="All registered games" />
          </div>

          {/* Server Performance */}
          <div className="card p-5 hover-lift" style={{ borderColor: 'rgba(108,60,225,0.15)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Server size={14} style={{ color: '#6c3ce1' }} />
              <h3 className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>Server Performance</h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Status', value: killActive ? 'LOCKED' : 'LIVE', color: killActive ? '#ff2d55' : '#00ff88', icon: killActive ? <WifiOff size={12} /> : <CheckCircle size={12} />, bg: killActive ? 'rgba(255,45,85,0.06)' : 'rgba(0,255,136,0.06)' },
                { label: 'Servers Online', value: serversOnline, color: '#00d4ff', icon: <Server size={12} />, bg: 'rgba(0,212,255,0.06)' },
                { label: 'Security Alerts', value: securityAlerts, color: securityAlerts > 0 ? '#ff2d55' : '#00ff88', icon: <Shield size={12} />, bg: 'rgba(255,107,43,0.06)' },
                { label: 'Pending Reports', value: pendingReports, color: pendingReports > 0 ? '#ffd60a' : '#00ff88', icon: <Swords size={12} />, bg: 'rgba(255,45,85,0.04)' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3 flex flex-col gap-1" style={{ background: s.bg, border: `1px solid ${s.color}20` }}>
                  <div className="flex items-center gap-1.5 text-xs" style={{ color: s.color }}>{s.icon}{s.label}</div>
                  <div className="font-black text-xl" style={{ color: s.color, fontFamily: 'Exo 2, sans-serif' }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Charts row 1 */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5 hover-lift"><HourBar data={data.hourly_joins} /></div>
            <div className="card p-5 hover-lift"><DayBar data={data.daily_joins} /></div>
          </div>

          {/* Growth + Engagement */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card p-5 hover-lift"><GrowthChart data={data.monthly_joins} /></div>
            <div className="card p-5 hover-lift flex flex-col items-center justify-center">
              <EngagementGauge rate={engagementRate} />
              <div className="mt-2 text-center">
                <div className="text-xs" style={{ color: '#334155' }}>Sessions per player × 10</div>
              </div>
            </div>
          </div>

          {/* Revenue chart — built from real logged purchases, not an estimate */}
          {revenue && revenue.total_logged > 0 ? (
            <div className="card p-5 hover-lift">
              <div className="flex items-center gap-2 mb-4">
                <Zap size={14} style={{ color: '#ff6b2b' }} />
                <h3 className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>Revenue Breakdown</h3>
              </div>
              <div className="space-y-3">
                <RevenueBar label="Gamepasses" value={revenue.gamepass_robux} max={revenue.total_logged || 1} color="#6c3ce1" />
                <RevenueBar label="Dev Products" value={revenue.devproduct_robux} max={revenue.total_logged || 1} color="#00d4ff" />
              </div>
              {revenue.per_game.length > 0 && (
                <div className="mt-4 pt-3 space-y-2.5" style={{ borderTop: '1px solid #1a2a45' }}>
                  <p className="text-xs uppercase tracking-widest" style={{ color: '#475569' }}>By Game</p>
                  {revenue.per_game.slice(0, 5).map(g => (
                    <RevenueBar key={g.game_id} label={g.name} value={g.total} max={revenue.total_logged || 1} color="#ff6b2b" />
                  ))}
                </div>
              )}
              <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid #1a2a45' }}>
                <span className="text-xs" style={{ color: '#475569' }}>Logged from {revenue.purchase_count} purchase{revenue.purchase_count === 1 ? '' : 's'}</span>
                <span className="font-black" style={{ color: '#ff6b2b', fontFamily: 'Exo 2, sans-serif' }}>R$ {revenue.total_logged.toLocaleString()}</span>
              </div>
            </div>
          ) : (data.total_robux || 0) > 0 ? (
            <div className="card p-5 hover-lift text-center text-xs" style={{ color: '#475569' }}>
              R$ {(data.total_robux || 0).toLocaleString()} total Robux on record, but no individual purchases have been logged yet —
              new gamepass and developer product purchases will appear here automatically.
            </div>
          ) : null}

          {/* Device + Country */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="card p-5 hover-lift"><DonutChart data={data.device_breakdown} title="Device Breakdown" /></div>
            <div className="card p-5 hover-lift"><DonutChart data={data.country_breakdown} title="Top Countries" /></div>
          </div>

          {/* Weekly trend */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="card p-4 flex items-center gap-4 hover-lift">
              {jp !== null ? (
                <>
                  {parseFloat(jp) >= 0
                    ? <TrendingUp size={22} style={{ color: '#00ff88', flexShrink: 0 }} />
                    : <TrendingDown size={22} style={{ color: '#ff2d55', flexShrink: 0 }} />}
                  <div>
                    <div className="font-black text-xl" style={{ color: parseFloat(jp) >= 0 ? '#00ff88' : '#ff2d55', fontFamily: 'Exo 2, sans-serif' }}>
                      {parseFloat(jp) >= 0 ? '+' : ''}{jp}%
                    </div>
                    <div className="text-xs" style={{ color: '#334155' }}>Weekly join change</div>
                  </div>
                </>
              ) : (
                <div className="text-xs" style={{ color: '#1a2a45' }}>Not enough data for trend</div>
              )}
            </div>
            <div className="card p-4 flex items-center gap-4 hover-lift">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(108,60,225,0.1)', border: '1px solid rgba(108,60,225,0.2)' }}>
                <Clock size={18} style={{ color: '#8b5cf6' }} />
              </div>
              <div>
                <div className="font-black text-xl" style={{ color: '#8b5cf6', fontFamily: 'Exo 2, sans-serif' }}>{formatDuration(data.avg_session_seconds)}</div>
                <div className="text-xs" style={{ color: '#334155' }}>Avg session duration</div>
              </div>
            </div>
            <div className="card p-4 flex items-center gap-4 hover-lift">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)' }}>
                <Zap size={18} style={{ color: '#00d4ff' }} />
              </div>
              <div>
                <div className="font-black text-xl" style={{ color: '#00d4ff', fontFamily: 'Exo 2, sans-serif' }}>
                  {data.peak_hour !== undefined ? (() => { const h = parseInt(data.peak_hour) || 0; return `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`; })() : '—'}
                </div>
                <div className="text-xs" style={{ color: '#334155' }}>Peak hour (UTC)</div>
              </div>
            </div>
          </div>

          {/* Geographic distribution */}
          <div className="card p-5 hover-lift">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={14} style={{ color: '#00d4ff' }} />
              <span className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>Geographic Distribution</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
              {Object.entries(data.country_breakdown).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 12).map(([country, count], i) => (
                <div key={country} className="flex items-center gap-3 rounded-xl px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
                  style={{ background: '#0a1220', border: '1px solid #1a2a45' }}>
                  <span className="text-xl">{countryFlag(country) || '🌐'}</span>
                  <div className="flex-1">
                    <div className="text-white text-sm font-semibold">{country}</div>
                    <div className="text-xs" style={{ color: '#334155' }}>{count as number} players</div>
                  </div>
                  <div className="text-xs" style={{ color: '#213354' }}>#{i + 1}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Save snapshot */}
          <div className="card p-4 hover-lift">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>
              <Save size={14} style={{ color: '#6c3ce1' }} />Save Snapshot
            </h3>
            <div className="flex gap-3">
              <input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} className="input flex-1 text-sm" placeholder="Snapshot name (e.g. June Week 1)" />
              <button onClick={saveSnap} disabled={!snapshotName.trim()} className="btn-primary text-sm disabled:opacity-50">
                <Plus size={14} />Save
              </button>
            </div>
          </div>

          {/* Leaderboard with liked_game indicator */}
          <div className="card overflow-hidden">
            <div className="p-5 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid #1a2a45' }}>
              <div className="flex items-center gap-2">
                <Trophy size={16} style={{ color: '#ffd60a' }} />
                <h3 className="text-white font-bold text-sm uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>Playtime Leaderboard</h3>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={12} style={{ color: '#334155' }} />
                {(['all', 'most_sessions', 'most_time'] as const).map(f => (
                  <button key={f} onClick={() => setFilter(f)}
                    className="text-xs px-2.5 py-1 rounded-lg border transition-all capitalize"
                    style={filter === f
                      ? { background: 'rgba(108,60,225,0.15)', borderColor: 'rgba(108,60,225,0.4)', color: '#c4b5fd' }
                      : { background: 'rgba(255,255,255,0.03)', borderColor: '#1a2a45', color: '#475569' }}>
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            {filteredLeaderboard().length === 0 ? (
              <div className="p-12 text-center text-xs" style={{ color: '#1a2a45' }}>No players yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid #1a2a45' }}>
                      {['#', 'Player', 'Playtime', 'Sessions', 'Country', 'Liked', 'Device'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs uppercase tracking-wider font-semibold" style={{ color: '#334155' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaderboard().slice(0, 20).map((e, i) => (
                      <tr key={e.roblox_user_id} className="transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid #111e35' }}>
                        <td className="px-4 py-3">
                          <span className="font-black text-sm" style={{ color: i === 0 ? '#ffd60a' : i === 1 ? '#94a3b8' : i === 2 ? '#ff6b2b' : '#213354' }}>{i + 1}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar userId={e.roblox_user_id} avatarUrl={e.avatar_resolved || e.avatar_url} name={e.username} size="sm" />
                            <div>
                              <div className="text-white font-semibold flex items-center gap-1">
                                {e.display_name || e.username}
                                {OWNER_IDS.includes(e.roblox_user_id) && <Crown size={10} style={{ color: '#8b5cf6' }} />}
                              </div>
                              <div className="text-xs" style={{ color: '#334155' }}>@{e.username}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-bold" style={{ color: '#ffd60a' }}>{formatDuration(e.total_playtime_seconds)}</td>
                        <td className="px-4 py-3" style={{ color: '#64748b' }}>{e.session_count}</td>
                        <td className="px-4 py-3" style={{ color: '#64748b' }}>{countryFlag(e.country_code) || ''} {e.country_code || '—'}</td>
                        <td className="px-4 py-3">
                          {e.liked_game
                            ? <span className="badge" style={{ background: 'rgba(255,45,85,0.12)', color: '#ff6b8a', borderColor: 'rgba(255,45,85,0.3)' }}><Heart size={9} />Yes</span>
                            : <span className="text-xs" style={{ color: '#213354' }}>—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>{e.device_type || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Compare tab ──────────────────────────────────────────────────── */
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>
              <BarChart2 size={14} style={{ color: '#6c3ce1' }} />Compare Snapshots
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {[{ label: 'Snapshot A', val: compareA, set: setCompareA }, { label: 'Snapshot B', val: compareB, set: setCompareB }].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs uppercase tracking-widest mb-2 block" style={{ color: '#334155' }}>{label}</label>
                  <select value={val?.id ?? ''} onChange={e => set(snapshots.find(s => s.id === Number(e.target.value)) || null)}
                    className="input w-full">
                    <option value="">Select snapshot...</option>
                    {snapshots.map(s => <option key={s.id} value={s.id}>{s.name} ({new Date(s.created_at).toLocaleDateString()})</option>)}
                  </select>
                </div>
              ))}
            </div>

            {compareA && compareB && (
              <div className="mt-4 pt-4" style={{ borderTop: '1px solid #1a2a45' }}>
                <button onClick={sendCompareToDiscord} className="btn-ghost text-sm flex items-center gap-2">
                  <Send size={13} style={{ color: '#6c3ce1' }} />Send Comparison to Discord
                </button>
              </div>
            )}
          </div>

          {compareA && compareB && (
            <div className="card overflow-hidden">
              <div className="p-4" style={{ borderBottom: '1px solid #1a2a45' }}>
                <div className="grid grid-cols-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#334155' }}>
                  <span>Metric</span>
                  <span className="text-center" style={{ color: '#6c3ce1' }}>{compareA.name}</span>
                  <span className="text-center" style={{ color: '#00d4ff' }}>{compareB.name}</span>
                </div>
              </div>
              {[
                { key: 'total_players',         label: '👥 Players' },
                { key: 'total_sessions',        label: '💬 Sessions' },
                { key: 'avg_session_seconds',   label: '⏱️ Avg Session', fmt: formatDuration },
                { key: 'total_playtime_seconds', label: '🕒 Total Playtime', fmt: formatDuration },
                { key: 'new_players',           label: '🆕 New Players' },
                { key: 'returning_players',     label: '🔁 Returning' },
                { key: 'weekly_joins',          label: '📅 Weekly Joins' },
                { key: 'retention_rate',        label: '🔄 Retention %' },
                { key: 'total_visits',          label: '👁️ Visits' },
                { key: 'total_robux',           label: '💰 Robux' },
              ].map(({ key, label, fmt }) => {
                const aVal = compareA.snapshot_data[key] ?? 0;
                const bVal = compareB.snapshot_data[key] ?? 0;
                const { pct, up } = comparePct(aVal, bVal);
                return (
                  <div key={key} className="grid grid-cols-3 px-4 py-3 text-sm transition-colors hover:bg-white/[0.02]" style={{ borderBottom: '1px solid #111e35' }}>
                    <span style={{ color: '#64748b' }}>{label}</span>
                    <span className="text-center text-white">{fmt ? fmt(aVal) : aVal.toLocaleString()}</span>
                    <span className="text-center">
                      <span className="text-white">{fmt ? fmt(bVal) : bVal.toLocaleString()}</span>
                      <span className={`ml-2 text-xs font-bold`} style={{ color: up ? '#00ff88' : '#ff2d55' }}>{pct}</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Saved snapshots */}
          {snapshots.length > 0 && (
            <div className="card p-4">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>
                <Save size={13} style={{ color: '#6c3ce1' }} />Saved Snapshots ({snapshots.length})
              </h3>
              <div className="space-y-2">
                {snapshots.map(s => (
                  <div key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl transition-colors"
                    style={{ background: '#0a1220', border: '1px solid #1a2a45' }}>
                    <div>
                      <span className="text-white text-sm font-semibold">{s.name}</span>
                      <span className="text-xs ml-2" style={{ color: '#334155' }}>{new Date(s.created_at).toLocaleDateString()}</span>
                    </div>
                    <button onClick={async () => {
                      await API.sendDiscord({
                        embeds: [{
                          title: `📊 Snapshot: ${s.name}`,
                          color: 0x8b5cf6,
                          fields: Object.entries(s.snapshot_data).slice(0, 10).map(([k, v]) => ({
                            name: k.replace(/_/g, ' '),
                            value: String(v),
                            inline: true,
                          })),
                          footer: { text: `HRYA-sadiaa · ${new Date(s.created_at).toLocaleDateString()}` },
                        }],
                      });
                      showToast('Snapshot sent to Discord');
                    }} className="btn-ghost text-xs py-1 px-3 flex items-center gap-1">
                      <Send size={11} />Send
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card p-4 hover-lift">
            <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2 uppercase tracking-wider" style={{ fontFamily: 'Exo 2, sans-serif' }}>
              <Save size={14} style={{ color: '#6c3ce1' }} />Save Current Snapshot
            </h3>
            <div className="flex gap-3">
              <input value={snapshotName} onChange={e => setSnapshotName(e.target.value)} className="input flex-1 text-sm" placeholder="Snapshot name" />
              <button onClick={saveSnap} disabled={!snapshotName.trim()} className="btn-primary text-sm disabled:opacity-50">
                <Plus size={14} />Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
