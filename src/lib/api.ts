const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roblox-api`;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export async function req(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${BASE}/${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KEY}`,
      'Apikey': KEY,
      ...(opts.headers || {}),
    },
  });
  return res.json();
}

export const API = {
  // Password check happens on the server (edge function), not in the browser.
  verifyPassword: (ownerName: string, password: string) =>
    req('verify-password', { method: 'POST', body: JSON.stringify({ ownerName, password }) }),

  getGameStats: () => req('game-stats'),
  getOnlinePlayers: () => req('online-players'),
  getPlayers: (search = '') => req(`players${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  getPlayer: (userId: number) => req(`player/${userId}`),
  getBannedPlayers: () => req('banned-players'),
  getLeaderboard: () => req('leaderboard'),
  getSecurity: () => req('security'),
  getAnalytics: () => req('analytics'),
  getRevenueBreakdown: () => req('revenue-breakdown'),
  getSnapshots: () => req('snapshots'),
  resolveAvatar: (userId: number) => req(`avatar/${userId}`),

  ban: (userId: number, username: string, displayName: string, avatarUrl: string, reason: string) =>
    req('ban', { method: 'POST', body: JSON.stringify({ roblox_user_id: userId, username, display_name: displayName, avatar_url: avatarUrl, reason }) }),

  unban: (userId: number) =>
    req('unban', { method: 'POST', body: JSON.stringify({ roblox_user_id: userId }) }),

  kick: (userId: number, reason: string) =>
    req('kick', { method: 'POST', body: JSON.stringify({ roblox_user_id: userId, reason }) }),

  warn: (userId: number, message?: string) =>
    req('warn', { method: 'POST', body: JSON.stringify({ roblox_user_id: userId, message }) }),

  message: (userId: number | null, message: string, targetAll = false, character?: string) =>
    req('message', { method: 'POST', body: JSON.stringify({ roblox_user_id: userId, message, target_all: targetAll, character }) }),

  shutdown: (serverId?: string, allServers = false) =>
    req('shutdown', { method: 'POST', body: JSON.stringify({ server_id: serverId, all_servers: allServers }) }),

  shutdownPlayerServer: (userId: number) =>
    req('shutdown-player-server', { method: 'POST', body: JSON.stringify({ roblox_user_id: userId }) }),

  killGameActivate: () => req('kill-game/activate', { method: 'POST', body: '{}' }),
  killGameDeactivate: () => req('kill-game/deactivate', { method: 'POST', body: '{}' }),

  banFromSecurity: (id: number, userId: number, username: string) =>
    req(`security/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'banned', roblox_user_id: userId, username }) }),
  dismissSecurity: (id: number) =>
    req(`security/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) }),

  saveSnapshot: (name: string, data: any) =>
    req('snapshots', { method: 'POST', body: JSON.stringify({ name, data }) }),

  updateGameStats: (updates: any) =>
    req('game-stats', { method: 'PATCH', body: JSON.stringify(updates) }),

  sendDiscord: (payload: any, webhookUrl?: string) =>
    req('discord-send', { method: 'POST', body: JSON.stringify({ payload, webhook_url: webhookUrl }) }),

  // 2FA
  generate2FA: (action: string) =>
    req('2fa/generate', { method: 'POST', body: JSON.stringify({ action }) }),
  verify2FA: (code: string) =>
    req('2fa/verify', { method: 'POST', body: JSON.stringify({ code }) }),

  // Login event
  loginEvent: (ip: string, location: string, success: boolean) =>
    req('login-event', { method: 'POST', body: JSON.stringify({ ip, location, success }) }),

  // Emergency lockdown
  emergencyLockdown: (rotatedUser: string, rotatedPass: string) =>
    req('emergency/lockdown', { method: 'POST', body: JSON.stringify({ rotated_user: rotatedUser, rotated_pass: rotatedPass }) }),

  // Reset all playtime
  resetPlaytime: () =>
    req('reset-playtime', { method: 'POST', body: '{}' }),

  // Reset session time for all players
  resetSessionTime: () =>
    req('reset-session-time', { method: 'POST', body: '{}' }),

  // Discord notification settings
  getNotifSettings: () => req('notification-settings'),
  updateNotifSetting: (actionType: string, enabled: boolean) =>
    req(`notification-settings/${actionType}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),

  // Player like check
  checkPlayerLiked: (userId: number, universeId?: string) =>
    req(universeId ? `player-liked/${userId}/${universeId}` : `player-liked/${userId}`),

  // Managed games
  getGames: () => req('games'),
  addGame: (gameId: string, name: string, imageUrl?: string, universeId?: string) =>
    req('games', { method: 'POST', body: JSON.stringify({ game_id: gameId, name, image_url: imageUrl, universe_id: universeId }) }),
  deleteGame: (id: string) =>
    req(`games/${id}`, { method: 'DELETE' }),
  killGame: (id: string) =>
    req(`games/${id}/kill`, { method: 'POST', body: '{}' }),
  unkillGame: (id: string) =>
    req(`games/${id}/unkill`, { method: 'POST', body: '{}' }),

  // Fetch Roblox game info by Place ID
  fetchRobloxGameInfo: (placeId: string) =>
    req(`roblox-game-info/${placeId}`),

  // Activity log
  getActivityLog: (limit = 50, unreadOnly = false) =>
    req(`activity-log?limit=${limit}${unreadOnly ? '&unread=true' : ''}`),
  logActivity: (actionType: string, targetUserId: number | null, targetUsername: string, performedBy: string, reason?: string, serverId?: string, countryCode?: string, deviceType?: string) =>
    req('activity-log', { method: 'POST', body: JSON.stringify({ action_type: actionType, target_user_id: targetUserId, target_username: targetUsername, performed_by: performedBy, reason, server_id: serverId, country_code: countryCode, device_type: deviceType }) }),
  markActivityRead: (id?: number | number[], all = false) =>
    req('activity-log/mark-read', { method: 'POST', body: JSON.stringify(id ? (Array.isArray(id) ? { ids: id } : { id }) : { all }) }),
  deleteActivityLog: (ids?: number[], all = false) =>
    req('activity-log/delete', { method: 'POST', body: JSON.stringify(ids ? { ids } : { all }) }),
};

export const OWNER_IDS = [8836168362, 4335867007, 4777843035];
export const OWNER_NAMES: Record<number, string> = {
  8836168362: 'Nexus',
  4335867007: 'Luna',
  4777843035: 'Youssef',
};

// Canonical owner avatars — single source of truth, used everywhere (Login, Dashboard broadcast picker, etc.)
export const OWNER_IMAGES: Record<string, string> = {
  Youssef: 'https://r2.image-upload.app/ptImg/l2wozdov.png',
  Nexus:   'https://r2.image-upload.app/ptImg/o4l3MUSc.png',
  Luna:    'https://r2.image-upload.app/ptImg/1bhmdfw6A.png',
};

export const COUNTRY_FLAGS: Record<string, string> = {
  AF:'🇦🇫',AL:'🇦🇱',DZ:'🇩🇿',AD:'🇦🇩',AO:'🇦🇴',AG:'🇦🇬',AR:'🇦🇷',AM:'🇦🇲',AU:'🇦🇺',AT:'🇦🇹',AZ:'🇦🇿',
  BS:'🇧🇸',BH:'🇧🇭',BD:'🇧🇩',BB:'🇧🇧',BY:'🇧🇾',BE:'🇧🇪',BZ:'🇧🇿',BJ:'🇧🇯',BT:'🇧🇹',BO:'🇧🇴',BA:'🇧🇦',BW:'🇧🇼',BR:'🇧🇷',BN:'🇧🇳',BG:'🇧🇬',BF:'🇧🇫',BI:'🇧🇮',
  KH:'🇰🇭',CM:'🇨🇲',CA:'🇨🇦',CV:'🇨🇻',CF:'🇨🇫',TD:'🇹🇩',CL:'🇨🇱',CN:'🇨🇳',CO:'🇨🇴',KM:'🇰🇲',CG:'🇨🇬',CD:'🇨🇩',CR:'🇨🇷',CI:'🇨🇮',HR:'🇭🇷',CU:'🇨🇺',CY:'🇨🇾',CZ:'🇨🇿',
  DK:'🇩🇰',DJ:'🇩🇯',DM:'🇩🇲',DO:'🇩🇴',EC:'🇪🇨',EG:'🇪🇬',SV:'🇸🇻',GQ:'🇬🇶',ER:'🇪🇷',EE:'🇪🇪',ET:'🇪🇹',
  FJ:'🇫🇯',FI:'🇫🇮',FR:'🇫🇷',GA:'🇬🇦',GM:'🇬🇲',GE:'🇬🇪',DE:'🇩🇪',GH:'🇬🇭',GR:'🇬🇷',GD:'🇬🇩',GT:'🇬🇹',GN:'🇬🇳',GW:'🇬🇼',GY:'🇬🇾',
  HT:'🇭🇹',HN:'🇭🇳',HU:'🇭🇺',IS:'🇮🇸',IN:'🇮🇳',ID:'🇮🇩',IR:'🇮🇷',IQ:'🇮🇶',IE:'🇮🇪',IL:'🇮🇱',IT:'🇮🇹',JM:'🇯🇲',JP:'🇯🇵',JO:'🇯🇴',
  KZ:'🇰🇿',KE:'🇰🇪',KI:'🇰🇮',KP:'🇰🇵',KR:'🇰🇷',KW:'🇰🇼',KG:'🇰🇬',LA:'🇱🇦',LV:'🇱🇻',LB:'🇱🇧',LS:'🇱🇸',LR:'🇱🇷',LY:'🇱🇾',LI:'🇱🇮',LT:'🇱🇹',LU:'🇱🇺',
  MK:'🇲🇰',MG:'🇲🇬',MW:'🇲🇼',MY:'🇲🇾',MV:'🇲🇻',ML:'🇲🇱',MT:'🇲🇹',MH:'🇲🇭',MR:'🇲🇷',MU:'🇲🇺',MX:'🇲🇽',FM:'🇫🇲',MD:'🇲🇩',MC:'🇲🇨',MN:'🇲🇳',ME:'🇲🇪',MA:'🇲🇦',MZ:'🇲🇿',MM:'🇲🇲',NA:'🇳🇦',NR:'🇳🇷',NP:'🇳🇵',NL:'🇳🇱',NZ:'🇳🇿',NI:'🇳🇮',NE:'🇳🇪',NG:'🇳🇬',NO:'🇳🇴',OM:'🇴🇲',
  PK:'🇵🇰',PW:'🇵🇼',PA:'🇵🇦',PG:'🇵🇬',PY:'🇵🇾',PE:'🇵🇪',PH:'🇵🇭',PL:'🇵🇱',PT:'🇵🇹',QA:'🇶🇦',
  RO:'🇷🇴',RU:'🇷🇺',RW:'🇷🇼',KN:'🇰🇳',LC:'🇱🇨',VC:'🇻🇨',WS:'🇼🇸',SM:'🇸🇲',ST:'🇸🇹',SA:'🇸🇦',SN:'🇸🇳',RS:'🇷🇸',SC:'🇸🇨',SL:'🇸🇱',SG:'🇸🇬',SK:'🇸🇰',SI:'🇸🇮',SB:'🇸🇧',SO:'🇸🇴',ZA:'🇿🇦',ES:'🇪🇸',LK:'🇱🇰',SD:'🇸🇩',SR:'🇸🇷',SE:'🇸🇪',CH:'🇨🇭',SY:'🇸🇾',TW:'🇹🇼',TJ:'🇹🇯',TZ:'🇹🇿',TH:'🇹🇭',TL:'🇹🇱',TG:'🇹🇬',TO:'🇹🇴',TT:'🇹🇹',TN:'🇹🇳',TR:'🇹🇷',TM:'🇹🇲',TV:'🇹🇻',UG:'🇺🇬',UA:'🇺🇦',AE:'🇦🇪',GB:'🇬🇧',US:'🇺🇸',UY:'🇺🇾',UZ:'🇺🇿',VU:'🇻🇺',VE:'🇻🇪',VN:'🇻🇳',YE:'🇾🇪',ZM:'🇿🇲',ZW:'🇿🇼',
  PS:'🇵🇸',UK:'🇬🇧',
};

export function countryFlag(code: string): string {
  if (!code || code === 'Unknown') return '';
  return COUNTRY_FLAGS[code.toUpperCase()] || '';
}

export function countryDisplay(code: string): string {
  const flag = countryFlag(code);
  if (!code || code === 'Unknown') return 'Unknown';
  return flag ? `${flag} ${code}` : code;
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function timeSince(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function robloxProfileUrl(userId: number) {
  return `https://www.roblox.com/users/${userId}/profile`;
}

export const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/roblox-webhook`;
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
