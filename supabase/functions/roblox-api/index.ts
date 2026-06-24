import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS, PATCH",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ── Game registry is 100% database-driven now ──────────────────────────────
// A place is "allowed" only if it has been added on the Games page (exists in
// managed_games) AND has not been kill-switched (kill_active = false).
// This is what makes the "no game works unless added to the dashboard" rule
// actually true everywhere (it used to be a separate hardcoded list that
// silently overrode whatever the Games page showed).
const OWNER_IDS = [8836168362, 4335867007, 4777843035];

// Only these two places can ever be registered on the Games page.
// Anything else that runs the script gets kicked and reported — see check-place below.
const REGISTERABLE_PLACE_IDS = ["88817119635622", "130852921874128"];

async function getManagedGame(supabase: any, placeId: string) {
  const { data } = await supabase.from("managed_games").select("*").eq("game_id", placeId).maybeSingle();
  return data || null;
}

/** A place is allowed to run only if it's registered AND not kill-switched. */
async function isPlaceAllowed(supabase: any, placeId: string): Promise<boolean> {
  const game = await getManagedGame(supabase, placeId);
  return !!game && !game.kill_active;
}

// Re-alert Discord at most this often per offending place — the watchdog loop
// re-checks every 20s, so without this it would spam the channel constantly.
const UNAUTHORIZED_RENOTIFY_MS = 12 * 60 * 60 * 1000;

/**
 * A place outside the registered allow-list just tried to run the script.
 * Logs it (so attempt counts/history are visible) and alerts Discord with the
 * place's PUBLIC Roblox info only — place name, place ID, and creator
 * username/ID. No player data, IP addresses, or device info is collected.
 */
async function reportUnauthorizedUse(supabase: any, placeId: string) {
  try {
    const { data: existing } = await supabase.from("unauthorized_place_attempts").select("*").eq("game_id", placeId).maybeSingle();
    const lastNotified = existing?.last_notified_at ? new Date(existing.last_notified_at).getTime() : 0;
    const shouldNotify = !existing || (Date.now() - lastNotified > UNAUTHORIZED_RENOTIFY_MS);

    if (!shouldNotify) {
      await supabase.from("unauthorized_place_attempts").update({
        attempt_count: (existing.attempt_count || 0) + 1,
        last_seen_at: new Date().toISOString(),
      }).eq("game_id", placeId);
      return;
    }

    let placeName: string | null = null, creatorName: string | null = null, creatorId: string | null = null, creatorType: string | null = null;
    const universeId = await getUniverseId(placeId);
    if (universeId) {
      const game = await fetchGameByUniverse(universeId);
      if (game) {
        placeName = game.name || null;
        creatorName = game.creator?.name || null;
        creatorId = game.creator?.id ? String(game.creator.id) : null;
        creatorType = game.creator?.type || null;
      }
    }

    await supabase.from("unauthorized_place_attempts").upsert({
      game_id: placeId, place_name: placeName, creator_name: creatorName, creator_id: creatorId, creator_type: creatorType,
      attempt_count: (existing?.attempt_count || 0) + 1,
      first_seen_at: existing?.first_seen_at || new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      last_notified_at: new Date().toISOString(),
    }, { onConflict: "game_id" });

    if (!(await isNotifEnabled(supabase, "unauthorized_use"))) return;
    const webhookUrl = await getWebhook(supabase);
    if (!webhookUrl) return;

    await sendDiscordMsg(webhookUrl, {
      embeds: [{
        title: "🚨 Unauthorized Script Use Detected",
        description: "A place outside the registered Game IDs just tried to run the script. Everyone in it was kicked immediately — this is just informational.",
        color: 0xff2d55,
        fields: [
          { name: "Place ID", value: placeId, inline: true },
          { name: "Place Name", value: placeName || "Unknown", inline: true },
          { name: "Creator", value: creatorName ? `${creatorName} (${creatorType || "User"})` : "Unknown", inline: true },
          { name: "Roblox Link", value: `https://www.roblox.com/games/${placeId}`, inline: false },
        ],
        timestamp: new Date().toISOString(),
      }],
    });
  } catch { /* never let a reporting hiccup break the place check */ }
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function resolveAvatar(userId: number): Promise<string> {
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
    if (!r.ok) return "";
    const d = await r.json();
    return d?.data?.[0]?.imageUrl || "";
  } catch { return ""; }
}

async function getWebhook(supabase: any): Promise<string> {
  try {
    const { data } = await supabase.from("game_stats").select("discord_webhook_url").eq("id", 1).maybeSingle();
    return data?.discord_webhook_url || "";
  } catch { return ""; }
}

// ── Discord Rate-Limit–Safe Sender ───────────────────────────────────────
// Retries on 429 (rate limit) with retry_after delay, times out after 12s total
async function sendDiscordMsg(webhookUrl: string, payload: any): Promise<boolean> {
  if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) return false;

  const deadline = Date.now() + 12000;
  let attempt = 0;

  while (Date.now() < deadline) {
    attempt++;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), Math.min(8000, deadline - Date.now()));
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(tid);

      if (res.status === 429) {
        // Rate limited — respect retry_after
        let retryAfterMs = 1000;
        try {
          const j = await res.json();
          retryAfterMs = Math.min((j.retry_after || 1) * 1000, 5000);
        } catch { }
        if (Date.now() + retryAfterMs < deadline) {
          await new Promise(r => setTimeout(r, retryAfterMs));
          continue;
        }
        return false;
      }

      if (res.status === 204 || res.ok) return true;
      // Other errors — don't retry
      return false;
    } catch (err) {
      // Abort or network error
      if (attempt >= 2) return false;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  return false;
}

// Check if a notification type is enabled
async function isNotifEnabled(supabase: any, actionType: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("discord_notification_settings")
      .select("enabled")
      .eq("action_type", actionType)
      .maybeSingle();
    if (data === null) return true; // Default to enabled if not configured
    return data?.enabled !== false;
  } catch { return true; }
}

// ── Player like check ─────────────────────────────────────────────────────
async function checkPlayerLikedGame(userId: number, universeId: string): Promise<boolean> {
  try {
    const r = await fetch(`https://games.roblox.com/v1/games/${universeId}/votes/user?userId=${userId}`);
    if (!r.ok) return false;
    const d = await r.json();
    return d?.vote === true || d?.liked === true;
  } catch { return false; }
}

// ── Roblox profile URL helper ─────────────────────────────────────────────
function robloxUrl(userId: number): string {
  return `https://www.roblox.com/users/${userId}/profile`;
}

// ── Beautiful Discord embed builders ─────────────────────────────────────

const EMBED_COLORS = {
  ban:          0xff2d55,
  unban:        0x00ff88,
  kick:         0xff6b2b,
  warn:         0xffd60a,
  kill_game:    0xff0000,
  revive_game:  0x00ff88,
  broadcast:    0x6c3ce1,
  login:        0x00ff88,
  login_failed: 0xff2d55,
  security:     0xff6b2b,
  lockdown:     0xff0000,
  info:         0x00d4ff,
  analytics:    0x8b5cf6,
};

function buildActivityEmbed(opts: {
  actionType: string;
  performedBy: string;
  targetUsername?: string;
  targetUserId?: number;
  reason?: string;
  avatarUrl?: string;
  serverId?: string;
  country?: string;
  device?: string;
  extraFields?: { name: string; value: string; inline?: boolean }[];
}): any {
  const color = EMBED_COLORS[opts.actionType as keyof typeof EMBED_COLORS] || 0x6c3ce1;

  const actionLabels: Record<string, string> = {
    ban:          '🔨 Player Banned',
    unban:        '✅ Player Unbanned',
    kick:         '👢 Player Kicked',
    warn:         '⚠️ Player Warned',
    kill_game:    '💀 Game Locked (Kill Game)',
    revive_game:  '💚 Game Revived',
    broadcast:    '📢 Broadcast Sent',
    login:        '🔐 Admin Login',
    login_failed: '🚫 Failed Login Attempt',
    security:     '🛡️ Security Alert',
    lockdown:     '🔴 Emergency Lockdown',
  };

  const title = actionLabels[opts.actionType] || `📋 ${opts.actionType}`;
  const fields: any[] = [];

  if (opts.performedBy) fields.push({ name: '👑 By', value: `**${opts.performedBy}**`, inline: true });

  if (opts.targetUsername && opts.targetUserId) {
    fields.push({
      name: '🎮 Player',
      value: `**[${opts.targetUsername}](${robloxUrl(opts.targetUserId)})**\nID: \`${opts.targetUserId}\``,
      inline: true,
    });
  } else if (opts.targetUsername) {
    fields.push({ name: '🎮 Player', value: `**${opts.targetUsername}**`, inline: true });
  }

  if (opts.reason) fields.push({ name: '📝 Reason', value: `> ${opts.reason}`, inline: false });
  if (opts.country) fields.push({ name: '🌍 Country', value: opts.country, inline: true });
  if (opts.device)  fields.push({ name: '💻 Device',  value: opts.device,  inline: true });

  if (opts.serverId) {
    fields.push({ name: '🖥️ Server', value: `\`${opts.serverId.substring(0, 20)}...\``, inline: true });
  }

  if (opts.extraFields) fields.push(...opts.extraFields);

  const embed: any = {
    title,
    color,
    fields,
    footer: { text: 'HRYA-sadiaa Admin Panel · hrya.sadiaa' },
    timestamp: new Date().toISOString(),
  };

  if (opts.avatarUrl) {
    embed.thumbnail = { url: opts.avatarUrl };
  }

  return { embeds: [embed] };
}

function rotateString(s: string): string {
  return s.split("").reverse().join("");
}

/** Get universe ID for a place ID */
async function getUniverseId(placeId: string): Promise<string | null> {
  try {
    const r = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.universeId ? String(d.universeId) : null;
  } catch { return null; }
}

/** Fetch game data by universe ID */
async function fetchGameByUniverse(universeId: string) {
  try {
    const r = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.data?.[0] || null;
  } catch { return null; }
}

/** Fetch game icon/thumbnail */
async function fetchGameThumbnail(universeId: string): Promise<string> {
  try {
    const r = await fetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`);
    if (!r.ok) return "";
    const d = await r.json();
    return d?.data?.[0]?.imageUrl || "";
  } catch { return ""; }
}

/** Live stats for one place, fetched from its OWN universe — no special-casing. */
async function fetchPlaceStats(placeId: string, cachedUniverseId?: string | null) {
  try {
    const universeId = cachedUniverseId || await getUniverseId(placeId);
    if (!universeId) return null;
    const [game, thumbnail] = await Promise.all([
      fetchGameByUniverse(universeId),
      fetchGameThumbnail(universeId),
    ]);
    if (!game) return null;
    return {
      universeId: String(universeId),
      name: game.name || `Game ${placeId}`,
      description: game.description || "",
      thumbnail,
      visits: game.visits || 0,
      likes: game.favoritedCount || 0,
      playing: game.playing || 0,
      maxPlayers: game.maxPlayers || 0,
    };
  } catch { return null; }
}

/** Sum visits/playing/likes/robux/gamepass across every registered game. */
async function sumManagedGames(supabase: any) {
  const { data: games } = await supabase.from("managed_games")
    .select("visits,playing,likes,total_robux,gamepass_sales,kill_active");
  let visits = 0, playing = 0, likes = 0, total_robux = 0, gamepass_sales = 0;
  for (const g of games || []) {
    // Revenue already earned still counts even if the game is currently locked.
    total_robux += g.total_robux || 0;
    gamepass_sales += g.gamepass_sales || 0;
    if (g.kill_active) continue;
    visits += g.visits || 0;
    playing += g.playing || 0;
    likes += g.likes || 0;
  }
  return { visits, playing, likes, total_robux, gamepass_sales };
}

/** Recompute the aggregate and persist it onto game_stats (id=1) for legacy readers. */
async function recomputeAndStoreAggregate(supabase: any) {
  const agg = await sumManagedGames(supabase);
  await supabase.from("game_stats").update({
    likes: agg.likes, total_robux: agg.total_robux, gamepass_sales: agg.gamepass_sales,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  return agg;
}

/** Full game info by place ID — allowed status comes from the managed_games table. */
async function fetchRobloxGameInfo(placeId: string, supabase: any) {
  const stats = await fetchPlaceStats(placeId);
  if (!stats) return null;
  const isAllowed = await isPlaceAllowed(supabase, placeId);
  return {
    name: stats.name,
    description: stats.description,
    universeId: stats.universeId,
    thumbnail: stats.thumbnail,
    placeId,
    visits: stats.visits,
    playing: stats.playing,
    likes: stats.likes,
    maxPlayers: stats.maxPlayers,
    isAllowed,
    isDead: !isAllowed,
  };
}

/** Refresh live visits/playing/likes/thumbnail for every registered game, from its OWN place. */
async function refreshAllGameStats(supabase: any) {
  const { data: games } = await supabase.from("managed_games").select("id,game_id,universe_id,kill_active");

  for (const g of games || []) {
    if (g.kill_active) {
      // Locked games show no live traffic, but keep their lifetime Robux total intact.
      await supabase.from("managed_games").update({
        visits: 0, playing: 0, likes: 0, updated_at: new Date().toISOString(),
      }).eq("id", g.id);
      continue;
    }
    try {
      const stats = await fetchPlaceStats(g.game_id, g.universe_id);
      if (!stats) continue;

      const upd: any = {
        visits: stats.visits, playing: stats.playing, likes: stats.likes,
        updated_at: new Date().toISOString(),
      };
      if (!g.universe_id) upd.universe_id = stats.universeId;
      if (stats.name) upd.name = stats.name;
      if (stats.thumbnail) upd.image_url = stats.thumbnail;

      await supabase.from("managed_games").update(upd).eq("id", g.id);
    } catch { /* skip this one, try the rest */ }
  }

  return await recomputeAndStoreAggregate(supabase);
}

/** Refresh stats only if they're stale, so dashboard polling doesn't hammer the Roblox API. */
async function ensureFreshGameStats(supabase: any, maxAgeMs = 5 * 60 * 1000) {
  const { data: rows } = await supabase.from("managed_games")
    .select("updated_at").order("updated_at", { ascending: true }).limit(1);
  const oldest = rows?.[0]?.updated_at ? new Date(rows[0].updated_at).getTime() : 0;
  if (Date.now() - oldest > maxAgeMs) {
    await refreshAllGameStats(supabase);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/roblox-api\/?/, "").replace(/^\//, "");

  try {
    // ── Roblox game server polling ────────────────────────────────────────
    if (req.method === "GET" && path === "commands") {
      const { data } = await supabase.from("commands")
        .select("*").eq("status", "pending").order("created_at", { ascending: true });
      return json({ commands: data || [] });
    }

    if (req.method === "POST" && path === "commands/execute") {
      const b = await req.json();
      await supabase.from("commands").update({
        status: b.status || "executed",
        executed_at: new Date().toISOString(),
      }).eq("id", b.command_id);
      return json({ success: true });
    }

    if (req.method === "GET" && path.startsWith("check-ban/")) {
      const userId = parseInt(path.replace("check-ban/", ""), 10);
      const { data: ban } = await supabase.from("banned_players").select("*").eq("roblox_user_id", userId).maybeSingle();
      const { data: gs } = await supabase.from("game_stats").select("kill_game_active").eq("id", 1).maybeSingle();
      return json({ banned: !!ban, reason: ban?.reason || null, kill_game: gs?.kill_game_active || false });
    }

    if (req.method === "GET" && path.startsWith("pending-warns/")) {
      const userId = parseInt(path.replace("pending-warns/", ""), 10);
      const { data } = await supabase.from("player_warns")
        .select("*").eq("roblox_user_id", userId).eq("delivered", false).order("created_at", { ascending: true });
      if (data?.length) await supabase.from("player_warns").update({ delivered: true }).in("id", data.map((w: any) => w.id));
      return json({ warns: data || [] });
    }

    if (req.method === "GET" && path.startsWith("pending-messages/")) {
      const userId = parseInt(path.replace("pending-messages/", ""), 10);
      const { data } = await supabase.from("player_messages").select("*")
        .or(`roblox_user_id.eq.${userId},target_all.eq.true`).eq("delivered", false);
      if (data?.length) await supabase.from("player_messages").update({ delivered: true }).in("id", data.map((m: any) => m.id));
      return json({ messages: data || [] });
    }

    // ── Check if place is allowed (called by game server on join, and on a loop) ──
    if (req.method === "GET" && path.startsWith("check-place/")) {
      const placeId = path.replace("check-place/", "");
      const allowed = await isPlaceAllowed(supabase, placeId);
      if (!allowed) await reportUnauthorizedUse(supabase, placeId);
      return json({ allowed, kill_if_not_allowed: !allowed });
    }

    // ── Avatar proxy ──────────────────────────────────────────────────────
    if (req.method === "GET" && path.startsWith("avatar/")) {
      const userId = parseInt(path.replace("avatar/", ""), 10);
      return json({ url: await resolveAvatar(userId) });
    }

    // ── Roblox game info by Place ID ──────────────────────────────────────
    if (req.method === "GET" && path.startsWith("roblox-game-info/")) {
      const placeId = path.replace("roblox-game-info/", "");
      const info = await fetchRobloxGameInfo(placeId, supabase);
      if (!info) return json({ error: "Game not found" }, 404);
      return json(info);
    }

    // ── Refresh all managed game stats from Roblox ────────────────────────
    if (req.method === "POST" && path === "games/refresh-stats") {
      await refreshAllGameStats(supabase);
      return json({ success: true });
    }

    // ── Activity log ──────────────────────────────────────────────────────
    if (req.method === "GET" && path === "activity-log") {
      const limit = parseInt(url.searchParams.get("limit") || "50");
      const unreadOnly = url.searchParams.get("unread") === "true";
      let query = supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(limit);
      if (unreadOnly) query = query.eq("is_read", false);
      const { data } = await query;
      return json({ logs: data || [] });
    }

    if (req.method === "POST" && path === "activity-log") {
      const b = await req.json();
      await supabase.from("activity_log").insert({
        action_type: b.action_type, target_user_id: b.target_user_id || null,
        target_username: b.target_username || null, performed_by: b.performed_by || "Admin",
        reason: b.reason || null, server_id: b.server_id || null,
        country_code: b.country_code || null, device_type: b.device_type || null,
      });
      if (b.discord_notify !== false) {
        const [webhookUrl, notifEnabled] = await Promise.all([
          getWebhook(supabase),
          isNotifEnabled(supabase, b.action_type),
        ]);
        if (webhookUrl && notifEnabled) {
          // Resolve avatar if we have a user ID
          let avatarUrl = b.avatar_url || "";
          if (!avatarUrl && b.target_user_id) {
            avatarUrl = await resolveAvatar(Number(b.target_user_id));
          }
          const payload = buildActivityEmbed({
            actionType: b.action_type,
            performedBy: b.performed_by || "Admin",
            targetUsername: b.target_username,
            targetUserId: b.target_user_id ? Number(b.target_user_id) : undefined,
            reason: b.reason,
            avatarUrl,
            serverId: b.server_id,
            country: b.country_code,
            device: b.device_type,
          });
          await sendDiscordMsg(webhookUrl, payload);
        }
      }
      return json({ success: true });
    }

    if (req.method === "POST" && path === "activity-log/mark-read") {
      const b = await req.json();
      if (b.all) await supabase.from("activity_log").update({ is_read: true, read_at: new Date().toISOString() }).eq("is_read", false);
      else if (b.ids?.length) await supabase.from("activity_log").update({ is_read: true, read_at: new Date().toISOString() }).in("id", b.ids);
      else if (b.id) await supabase.from("activity_log").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", b.id);
      return json({ success: true });
    }

    if (req.method === "POST" && path === "activity-log/delete") {
      const b = await req.json();
      if (b.all) await supabase.from("activity_log").delete().not("id", "is", null);
      else if (b.ids?.length) await supabase.from("activity_log").delete().in("id", b.ids);
      return json({ success: true });
    }

    // ── Owner password check ────────────────────────────────────────────────
    // Passwords live ONLY as Edge Function secrets (set in the Supabase
    // dashboard / CLI), never in this file and never sent to the browser.
    // The frontend no longer has the password values at all — it just asks
    // this endpoint "is this correct?" and gets back true/false.
    if (req.method === "POST" && path === "verify-password") {
      const b = await req.json();
      const ownerName = (b.ownerName || "").toString();
      const password = (b.password || "").toString();

      const expected: Record<string, string | undefined> = {
        Youssef: Deno.env.get("OWNER_PASSWORD_YOUSSEF"),
        Nexus: Deno.env.get("OWNER_PASSWORD_NEXUS"),
        Luna: Deno.env.get("OWNER_PASSWORD_LUNA"),
      };

      const ok = !!ownerName && !!expected[ownerName] && password === expected[ownerName];

      if (!ok) {
        const wu = await getWebhook(supabase);
        if (wu) {
          await sendDiscordMsg(wu, {
            embeds: [{
              title: "🚫 Failed Login (wrong password)",
              description: `Attempted owner: **${ownerName || "unknown"}**`,
              color: 0xff2d55,
              footer: { text: "HRYA-sadiaa" },
              timestamp: new Date().toISOString(),
            }],
          });
        }
      }

      // Never echo the expected password back, even on failure.
      return json({ success: ok });
    }

    // ── 2FA ───────────────────────────────────────────────────────────────
    if (req.method === "POST" && path === "2fa/generate") {
      const b = await req.json();
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const rotated = rotateString(code);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await supabase.from("two_factor_codes").delete().lt("expires_at", new Date().toISOString());
      await supabase.from("two_factor_codes").insert({ code, action: b.action || "auth", used: false, expires_at: expiresAt });
      const webhookUrl = await getWebhook(supabase);
      if (webhookUrl) {
        const actionLabel: Record<string, string> = {
          login: "🔐 Admin Login",
          "emergency-lockdown": "🔴 Emergency Lockdown",
          "restore-lockdown": "💚 Restore Operations",
          auth: "🔑 Authentication",
        };
        await sendDiscordMsg(webhookUrl, {
          embeds: [{
            title: "🔑 Two-Factor Code",
            color: b.action === "emergency-lockdown" ? 0xff0000 : b.action === "restore-lockdown" ? 0x00ff88 : 0x6c3ce1,
            description: `**Action:** ${actionLabel[b.action] || b.action || "Authentication"}\n\n> Enter this code **exactly as shown** in the admin panel.`,
            fields: [
              {
                name: "📟 Your Code",
                value: `# \`\`\`\n${rotated}\n\`\`\``,
                inline: false,
              },
              { name: "⏰ Expires In", value: "**5 minutes**", inline: true },
              { name: "🔒 One-time use", value: "**Yes**", inline: true },
            ],
            footer: { text: "HRYA-sadiaa Security · Do not share this code" },
            timestamp: new Date().toISOString(),
          }],
        });
      }
      return json({ success: true, expires_in: 300 });
    }

    if (req.method === "POST" && path === "2fa/verify") {
      const b = await req.json();
      const inputCode = (b.code || "").toString().trim();
      const originalCode = rotateString(inputCode);
      const { data: codes } = await supabase.from("two_factor_codes")
        .select("*").eq("code", originalCode).eq("used", false)
        .gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(1);
      if (!codes || codes.length === 0) {
        const wu = await getWebhook(supabase);
        if (wu) await sendDiscordMsg(wu, { embeds: [{ title: "Failed 2FA Attempt", color: 0xff2d55, footer: { text: "HRYA-sadiaa" }, timestamp: new Date().toISOString() }] });
        return json({ success: false, error: "Invalid or expired code" });
      }
      await supabase.from("two_factor_codes").update({ used: true }).eq("id", codes[0].id);
      const wu = await getWebhook(supabase);
      if (wu) await sendDiscordMsg(wu, { embeds: [{ title: "Successful Login ✓", color: 0x00ff88, footer: { text: "HRYA-sadiaa" }, timestamp: new Date().toISOString() }] });
      return json({ success: true });
    }

    // ── Login event ───────────────────────────────────────────────────────
    if (req.method === "POST" && path === "login-event") {
      const b = await req.json();
      const notifEnabled = await isNotifEnabled(supabase, b.success ? "login" : "login_failed");
      const wu = await getWebhook(supabase);
      if (wu && notifEnabled) {
        await sendDiscordMsg(wu, {
          embeds: [{
            title: b.success ? "🔐 Admin Panel Login" : "🚫 Failed Login Attempt",
            color: b.success ? 0x00ff88 : 0xff2d55,
            description: b.success
              ? "An admin has successfully logged into the HRYA panel."
              : "⚠️ Someone tried to log in with incorrect credentials.",
            fields: [
              { name: "🌐 IP Address", value: `\`${b.ip || "Unknown"}\``, inline: true },
              { name: "📍 Location", value: b.location || "Unknown", inline: true },
              { name: "📅 Time", value: new Date().toUTCString(), inline: false },
            ],
            footer: { text: "HRYA-sadiaa Security System" },
            timestamp: new Date().toISOString(),
          }],
        });
      }
      return json({ success: true });
    }

    // ── Emergency lockdown ────────────────────────────────────────────────
    if (req.method === "POST" && path === "emergency/lockdown") {
      const { data: online } = await supabase.from("online_players").select("roblox_user_id");
      for (const p of online || []) {
        await supabase.from("commands").insert({ command_type: "kick", roblox_user_id: p.roblox_user_id, reason: "Emergency lockdown." });
      }
      await supabase.from("online_players").delete().not("id", "is", null);
      await supabase.from("game_stats").update({ kill_game_active: true }).eq("id", 1);
      const wu = await getWebhook(supabase);
      if (wu) {
        await sendDiscordMsg(wu, {
          embeds: [{
            title: "🔴 EMERGENCY LOCKDOWN ACTIVATED",
            color: 0xff0000,
            description: "**All players have been kicked. No new players can join any game.**",
            fields: [
              { name: "🎮 Players Kicked", value: `**${(online || []).length}**`, inline: true },
              { name: "⏰ Triggered At", value: new Date().toUTCString(), inline: true },
              { name: "📋 Status", value: "```🔴 LOCKED```", inline: false },
            ],
            footer: { text: "HRYA-sadiaa Emergency System — Ctrl+Y" },
            timestamp: new Date().toISOString(),
          }],
        });
      }
      return json({ success: true });
    }

    // ── Game stats ────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "game-stats") {
      const { data } = await supabase.from("game_stats").select("*").eq("id", 1).maybeSingle();
      const { count: onlineCount } = await supabase.from("online_players").select("*", { count: "exact", head: true });
      const { count: bannedCount } = await supabase.from("banned_players").select("*", { count: "exact", head: true });
      const { count: totalPlayers } = await supabase.from("player_profiles").select("*", { count: "exact", head: true });
      const { count: pendingReports } = await supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending");
      const { count: securityAlerts } = await supabase.from("security_flags").select("*", { count: "exact", head: true }).eq("status", "open");

      // Keep per-game numbers fresh (cheap no-op if refreshed recently), then sum across every game.
      await ensureFreshGameStats(supabase);
      const agg = await sumManagedGames(supabase);

      // SECURITY: never echo secrets back to the client. This endpoint has no auth check,
      // so anything spread from `data` here is effectively public — strip it explicitly
      // rather than relying on every future column staying "safe" by accident.
      const safeStats = { ...data };
      delete (safeStats as any).discord_webhook_url;

      return json({
        stats: { ...safeStats, total_robux: agg.total_robux, gamepass_sales: agg.gamepass_sales, likes: agg.likes },
        online_count: onlineCount || 0,
        banned_count: bannedCount || 0,
        total_players: totalPlayers || 0,
        pending_reports: pendingReports || 0,
        security_alerts: securityAlerts || 0,
        total_visits: agg.visits,
        total_playing: agg.playing,
        total_likes_games: agg.likes,
      });
    }

    if (req.method === "PATCH" && path === "game-stats") {
      const b = await req.json();
      await supabase.from("game_stats").update({ ...b, updated_at: new Date().toISOString() }).eq("id", 1);
      return json({ success: true });
    }

    // ── Kill Game ─────────────────────────────────────────────────────────
    if (req.method === "POST" && path === "kill-game/activate") {
      await supabase.from("game_stats").update({ kill_game_active: true, updated_at: new Date().toISOString() }).eq("id", 1);
      const { data: online } = await supabase.from("online_players").select("roblox_user_id");
      for (const p of online || []) await supabase.from("commands").insert({ command_type: "kick", roblox_user_id: p.roblox_user_id, reason: "Server locked by admin." });
      await supabase.from("online_players").delete().not("id", "is", null);
      return json({ success: true });
    }

    if (req.method === "POST" && path === "kill-game/deactivate") {
      await supabase.from("game_stats").update({ kill_game_active: false, updated_at: new Date().toISOString() }).eq("id", 1);
      return json({ success: true });
    }

    // ── Managed games ─────────────────────────────────────────────────────
    if (req.method === "GET" && path === "games") {
      const { data } = await supabase.from("managed_games").select("*").order("created_at", { ascending: false });
      return json({ games: data || [] });
    }

    if (req.method === "POST" && path === "games") {
      const b = await req.json();
      if (!REGISTERABLE_PLACE_IDS.includes(String(b.game_id))) {
        return json({ success: false, error: `Only place ${REGISTERABLE_PLACE_IDS.join(" and ")} can be registered.` }, 403);
      }
      // Adding a game on this page is exactly what makes it allowed to run.
      // If it already exists, preserve whatever lock state the admin set.
      const existing = await getManagedGame(supabase, b.game_id);
      await supabase.from("managed_games").upsert({
        game_id: b.game_id, name: b.name,
        image_url: b.image_url || null, universe_id: b.universe_id || null,
        visits: b.visits || 0, playing: b.playing || 0, likes: b.likes || 0,
        kill_active: existing ? existing.kill_active : false,
      }, { onConflict: "game_id" });
      await recomputeAndStoreAggregate(supabase);
      return json({ success: true, isAllowed: true });
    }

    if (req.method === "DELETE" && path.startsWith("games/")) {
      const id = path.replace("games/", "");
      await supabase.from("managed_games").delete().eq("id", id);
      await recomputeAndStoreAggregate(supabase);
      return json({ success: true });
    }

    if (req.method === "POST" && path.startsWith("games/") && path.endsWith("/kill")) {
      const id = path.replace("games/", "").replace("/kill", "");
      await supabase.from("managed_games").update({
        kill_active: true, visits: 0, playing: 0, likes: 0, updated_at: new Date().toISOString(),
      }).eq("id", id);
      const { data: online } = await supabase.from("online_players").select("roblox_user_id");
      for (const p of online || []) await supabase.from("commands").insert({ command_type: "kick", roblox_user_id: p.roblox_user_id, reason: "Game locked by admin." });
      await recomputeAndStoreAggregate(supabase);
      return json({ success: true });
    }

    if (req.method === "POST" && path.startsWith("games/") && path.endsWith("/unkill")) {
      const id = path.replace("games/", "").replace("/unkill", "");
      const game = await supabase.from("managed_games").select("game_id,universe_id").eq("id", id).maybeSingle().then((r: any) => r.data);
      if (!game) return json({ success: false, error: "Game not found." }, 404);

      // Pull fresh stats right away so the card doesn't sit at 0 until the next refresh cycle.
      const stats = await fetchPlaceStats(game.game_id, game.universe_id);
      const upd: any = { kill_active: false, updated_at: new Date().toISOString() };
      if (stats) {
        upd.visits = stats.visits; upd.playing = stats.playing; upd.likes = stats.likes;
        if (!game.universe_id) upd.universe_id = stats.universeId;
      }
      await supabase.from("managed_games").update(upd).eq("id", id);
      await recomputeAndStoreAggregate(supabase);
      return json({ success: true });
    }

    // ── Online players ────────────────────────────────────────────────────
    if (req.method === "GET" && path === "online-players") {
      const { data } = await supabase.from("online_players").select("*").order("joined_at", { ascending: false });
      return json({ players: data || [] });
    }

    // ── Players ───────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "players") {
      const search = url.searchParams.get("search") || "";
      let query = supabase.from("player_profiles").select("*").order("last_seen_at", { ascending: false });
      if (search) query = query.or(`username.ilike.%${search}%,display_name.ilike.%${search}%`);
      const { data } = await query.limit(100);
      return json({ players: data || [] });
    }

    if (req.method === "GET" && path.startsWith("player/")) {
      const userId = parseInt(path.replace("player/", ""), 10);
      const [{ data: profile }, { data: events }, { data: ban }, { data: online }] = await Promise.all([
        supabase.from("player_profiles").select("*").eq("roblox_user_id", userId).maybeSingle(),
        supabase.from("player_events").select("*").eq("roblox_user_id", userId).order("created_at", { ascending: false }).limit(50),
        supabase.from("banned_players").select("*").eq("roblox_user_id", userId).maybeSingle(),
        supabase.from("online_players").select("*").eq("roblox_user_id", userId).maybeSingle(),
      ]);
      return json({ profile, events: events || [], ban, online });
    }

    if (req.method === "POST" && path === "players/refresh-all") {
      const { data: players } = await supabase.from("player_profiles").select("roblox_user_id").limit(200);
      let refreshed = 0;
      for (const p of players || []) {
        try {
          const avatarUrl = await resolveAvatar(p.roblox_user_id);
          if (avatarUrl) {
            await supabase.from("player_profiles").update({ avatar_resolved: avatarUrl, updated_at: new Date().toISOString() }).eq("roblox_user_id", p.roblox_user_id);
            refreshed++;
          }
        } catch { }
      }
      return json({ success: true, refreshed });
    }

    // ── Banned players ────────────────────────────────────────────────────
    if (req.method === "GET" && path === "banned-players") {
      const { data } = await supabase.from("banned_players").select("*").order("banned_at", { ascending: false });
      return json({ players: data || [] });
    }

    // ── Ban / Unban ───────────────────────────────────────────────────────
    if (req.method === "POST" && path === "ban") {
      const b = await req.json();
      let avatarUrl = b.avatar_url || "";
      if (!avatarUrl && b.roblox_user_id) avatarUrl = await resolveAvatar(Number(b.roblox_user_id));
      await supabase.from("banned_players").upsert({
        roblox_user_id: b.roblox_user_id, username: b.username, display_name: b.display_name,
        avatar_url: avatarUrl, reason: b.reason || "Banned", banned_by: b.banned_by || "Admin", banned_at: new Date().toISOString(),
      }, { onConflict: "roblox_user_id" });
      await supabase.from("player_profiles").update({ is_banned: true, updated_at: new Date().toISOString() }).eq("roblox_user_id", b.roblox_user_id);
      await supabase.from("commands").insert({ command_type: "kick", roblox_user_id: b.roblox_user_id, reason: `Banned: ${b.reason || "Banned"}` });
      await supabase.from("online_players").delete().eq("roblox_user_id", b.roblox_user_id);
      return json({ success: true });
    }

    if (req.method === "POST" && path === "unban") {
      const b = await req.json();
      await supabase.from("banned_players").delete().eq("roblox_user_id", b.roblox_user_id);
      await supabase.from("player_profiles").update({ is_banned: false, updated_at: new Date().toISOString() }).eq("roblox_user_id", b.roblox_user_id);
      return json({ success: true });
    }

    if (req.method === "POST" && path === "kick") {
      const b = await req.json();
      await supabase.from("commands").insert({ command_type: "kick", roblox_user_id: b.roblox_user_id, reason: b.reason || "Kicked" });
      return json({ success: true });
    }

    if (req.method === "POST" && path === "warn") {
      const b = await req.json();
      const msg = b.message || "Warning from moderator.";
      await supabase.from("player_warns").insert({ roblox_user_id: b.roblox_user_id, message: msg });
      await supabase.from("commands").insert({ command_type: "warn", roblox_user_id: b.roblox_user_id, message: msg });
      return json({ success: true });
    }

    if (req.method === "POST" && path === "message") {
      const b = await req.json();
      if (b.target_all) {
        await supabase.from("player_messages").insert({ roblox_user_id: null, message: b.message, target_all: true });
        await supabase.from("commands").insert({ command_type: "broadcast", roblox_user_id: null, message: b.message, reason: b.character || "Admin" });
      } else {
        await supabase.from("player_messages").insert({ roblox_user_id: b.roblox_user_id, message: b.message, target_all: false });
        await supabase.from("commands").insert({ command_type: "message", roblox_user_id: b.roblox_user_id, message: b.message, reason: b.character || "Admin" });
      }
      return json({ success: true });
    }

    if (req.method === "POST" && path === "shutdown") {
      const b = await req.json();
      if (b.all_servers) await supabase.from("commands").insert({ command_type: "shutdown_all", reason: "Admin reset" });
      else await supabase.from("commands").insert({ command_type: "shutdown", target_server_id: b.server_id || null, reason: "Admin reset" });
      return json({ success: true });
    }

    if (req.method === "POST" && path === "shutdown-player-server") {
      const b = await req.json();
      const { data: online } = await supabase.from("online_players").select("server_id").eq("roblox_user_id", b.roblox_user_id).maybeSingle();
      if (online?.server_id) await supabase.from("commands").insert({ command_type: "shutdown", target_server_id: online.server_id, reason: "Admin reset" });
      else await supabase.from("commands").insert({ command_type: "shutdown_all", reason: "Admin reset" });
      return json({ success: true, server_id: online?.server_id });
    }

    // ── Leaderboard ───────────────────────────────────────────────────────
    if (req.method === "GET" && path === "leaderboard") {
      const { data } = await supabase.from("player_profiles")
        .select("roblox_user_id,username,display_name,avatar_url,avatar_resolved,total_playtime_seconds,session_count,country_code,device_type,join_count")
        .order("total_playtime_seconds", { ascending: false }).limit(20);
      return json({ leaderboard: data || [] });
    }

    if (req.method === "POST" && path === "reset-playtime") {
      await supabase.from("player_profiles").update({ total_playtime_seconds: 0, session_count: 0, updated_at: new Date().toISOString() }).not("roblox_user_id", "is", null);
      await supabase.from("player_events").delete().not("id", "is", null);
      return json({ success: true });
    }

    if (req.method === "POST" && path === "reset-session-time") {
      await supabase.from("online_players").update({ joined_at: new Date().toISOString(), updated_at: new Date().toISOString() }).not("id", "is", null);
      return json({ success: true });
    }

    // ── Reports ───────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "reports") {
      const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
      return json({ reports: data || [] });
    }
    if (req.method === "POST" && path === "reports") { const b = await req.json(); await supabase.from("reports").insert(b); return json({ success: true }); }
    if (req.method === "PATCH" && path.startsWith("reports/")) {
      const id = path.replace("reports/", "");
      const b = await req.json();
      await supabase.from("reports").update(b).eq("id", id);
      return json({ success: true });
    }

    // ── Security ──────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "security") {
      const { data } = await supabase.from("security_flags").select("*").order("created_at", { ascending: false });
      return json({ flags: data || [] });
    }
    if (req.method === "PATCH" && path.startsWith("security/")) {
      const id = path.replace("security/", "");
      const b = await req.json();
      if (b.status === "banned" && b.roblox_user_id && !OWNER_IDS.includes(Number(b.roblox_user_id))) {
        const avatarUrl = await resolveAvatar(Number(b.roblox_user_id));
        await supabase.from("banned_players").upsert({
          roblox_user_id: b.roblox_user_id, username: b.username, display_name: b.username,
          avatar_url: avatarUrl, reason: "Security violation", banned_by: "AutoMod", banned_at: new Date().toISOString(),
        }, { onConflict: "roblox_user_id" });
        await supabase.from("player_profiles").update({ is_banned: true, updated_at: new Date().toISOString() }).eq("roblox_user_id", b.roblox_user_id);
        await supabase.from("commands").insert({ command_type: "kick", roblox_user_id: b.roblox_user_id, reason: "Banned for security violation" });
        await supabase.from("online_players").delete().eq("roblox_user_id", b.roblox_user_id);
      }
      await supabase.from("security_flags").update({ status: b.status }).eq("id", id);
      return json({ success: true });
    }

    // ── Discord notification settings ────────────────────────────────────
    if (req.method === "GET" && path === "notification-settings") {
      const { data } = await supabase.from("discord_notification_settings").select("*").order("action_type");
      return json({ settings: data || [] });
    }

    if (req.method === "PATCH" && path.startsWith("notification-settings/")) {
      const actionType = path.replace("notification-settings/", "");
      const b = await req.json();
      await supabase.from("discord_notification_settings")
        .upsert({ action_type: actionType, enabled: b.enabled, updated_at: new Date().toISOString() }, { onConflict: "action_type" });
      return json({ success: true });
    }

    // ── Player like check ─────────────────────────────────────────────────
    if (req.method === "GET" && path.startsWith("player-liked/")) {
      const parts = path.replace("player-liked/", "").split("/");
      const userId = parseInt(parts[0], 10);
      const universeId = parts[1] || "";
      if (!universeId) {
        const { data: profile } = await supabase.from("player_profiles").select("liked_game").eq("roblox_user_id", userId).maybeSingle();
        return json({ liked: profile?.liked_game || false });
      }
      const liked = await checkPlayerLikedGame(userId, universeId);
      // Store in profile
      await supabase.from("player_profiles").update({ liked_game: liked, updated_at: new Date().toISOString() }).eq("roblox_user_id", userId);
      return json({ liked });
    }

    // ── Analytics ─────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "analytics") {
      const [{ data: events }, { data: profiles }] = await Promise.all([
        supabase.from("player_events").select("*").order("created_at", { ascending: true }),
        supabase.from("player_profiles").select("country_code,device_type,total_playtime_seconds,session_count,join_count,first_seen_at,created_at,last_seen_at"),
      ]);

      const deviceMap: Record<string, number> = {};
      const countryMap: Record<string, number> = {};
      let totalPlaytime = 0, totalSessions = 0, newPlayers = 0, returningPlayers = 0;
      for (const p of profiles || []) {
        const dev = p.device_type || "Unknown";
        deviceMap[dev] = (deviceMap[dev] || 0) + 1;
        const cc = p.country_code || "Unknown";
        countryMap[cc] = (countryMap[cc] || 0) + 1;
        totalPlaytime += p.total_playtime_seconds || 0;
        totalSessions += p.session_count || 0;
        if ((p.join_count || 0) <= 1) newPlayers++; else returningPlayers++;
      }

      const hourMap: Record<number, number> = {};
      const dayMap: Record<string, number> = {};
      const monthMap: Record<string, number> = {};
      for (let i = 0; i < 24; i++) hourMap[i] = 0;
      const now = Date.now();
      let weeklyJoins = 0, prevWeekJoins = 0;
      for (const e of events || []) {
        if (e.event_type !== "join") continue;
        const d = new Date(e.created_at);
        hourMap[d.getUTCHours()] = (hourMap[d.getUTCHours()] || 0) + 1;
        const day = d.toISOString().split("T")[0];
        if (now - d.getTime() < 30 * 86400 * 1000) dayMap[day] = (dayMap[day] || 0) + 1;
        const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        monthMap[month] = (monthMap[month] || 0) + 1;
        if (now - d.getTime() < 7 * 86400 * 1000) weeklyJoins++;
        if (now - d.getTime() >= 7 * 86400 * 1000 && now - d.getTime() < 14 * 86400 * 1000) prevWeekJoins++;
      }

      const joinChange = prevWeekJoins > 0 ? ((weeklyJoins - prevWeekJoins) / prevWeekJoins * 100).toFixed(1) : null;
      const avgSession = totalSessions > 0 ? Math.round(totalPlaytime / totalSessions) : 0;
      const peakHour = Object.entries(hourMap).sort(([, a], [, b]) => b - a)[0]?.[0];
      const retentionRate = (profiles?.length || 0) > 0 ? Math.round(returningPlayers / (profiles?.length || 1) * 100) : 0;

      // Visits, likes, playing, and Robux summed across every registered game
      await ensureFreshGameStats(supabase);
      const agg = await sumManagedGames(supabase);

      return json({
        device_breakdown: deviceMap, country_breakdown: countryMap,
        hourly_joins: hourMap, daily_joins: dayMap, monthly_joins: monthMap,
        total_players: profiles?.length || 0,
        total_playtime_seconds: totalPlaytime, total_sessions: totalSessions,
        avg_session_seconds: avgSession, new_players: newPlayers, returning_players: returningPlayers,
        weekly_joins: weeklyJoins, prev_week_joins: prevWeekJoins, join_change_pct: joinChange,
        peak_hour: peakHour, retention_rate: retentionRate,
        game_likes: agg.likes, gamepass_bought: agg.gamepass_sales, total_robux: agg.total_robux,
        total_visits: agg.visits, total_playing: agg.playing, total_game_likes: agg.likes,
      });
    }

    // ── Snapshots ─────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "snapshots") {
      const { data } = await supabase.from("analytics_snapshots").select("*").order("created_at", { ascending: false });
      return json({ snapshots: data || [] });
    }
    if (req.method === "POST" && path === "snapshots") {
      const b = await req.json();
      await supabase.from("analytics_snapshots").insert({ name: b.name, snapshot_data: b.data });
      return json({ success: true });
    }
    if (req.method === "DELETE" && path.startsWith("snapshots/")) {
      const id = path.replace("snapshots/", "");
      await supabase.from("analytics_snapshots").delete().eq("id", id);
      return json({ success: true });
    }

    // ── Revenue breakdown — real numbers from logged purchases, per game ──
    if (req.method === "GET" && path === "revenue-breakdown") {
      const [{ data: purchases }, { data: games }] = await Promise.all([
        supabase.from("robux_purchases").select("game_id,product_type,robux_amount,created_at").order("created_at", { ascending: false }).limit(2000),
        supabase.from("managed_games").select("game_id,name"),
      ]);
      const nameByGame: Record<string, string> = {};
      for (const g of games || []) nameByGame[g.game_id] = g.name;

      let gamepass = 0, devproduct = 0;
      const perGame: Record<string, { name: string; total: number; gamepass: number; devproduct: number; sales: number }> = {};
      for (const p of purchases || []) {
        const amt = p.robux_amount || 0;
        if (p.product_type === "gamepass") gamepass += amt; else devproduct += amt;
        const key = p.game_id || "unknown";
        if (!perGame[key]) perGame[key] = { name: nameByGame[key] || key, total: 0, gamepass: 0, devproduct: 0, sales: 0 };
        perGame[key].total += amt;
        perGame[key].sales += 1;
        if (p.product_type === "gamepass") perGame[key].gamepass += amt; else perGame[key].devproduct += amt;
      }

      return json({
        gamepass_robux: gamepass,
        devproduct_robux: devproduct,
        total_logged: gamepass + devproduct,
        purchase_count: (purchases || []).length,
        per_game: Object.entries(perGame).map(([game_id, v]) => ({ game_id, ...v })),
        recent: (purchases || []).slice(0, 25),
      });
    }

    // ── Discord send ──────────────────────────────────────────────────────
    if (req.method === "POST" && path === "discord-send") {
      const b = await req.json();
      const webhookUrl = b.webhook_url || (await getWebhook(supabase));
      if (!webhookUrl) return json({ success: false, error: "No webhook configured" });
      const sent = await sendDiscordMsg(webhookUrl, b.payload);
      return json({ success: sent });
    }

    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
