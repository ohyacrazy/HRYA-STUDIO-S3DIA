import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const OWNER_IDS = [8836168362, 4335867007, 4777843035];

// A place is allowed to run only if it's registered on the Games page (in
// managed_games) AND hasn't been kill-switched. Nothing is hardcoded anymore —
// add a game on the dashboard and it goes live; remove it (or kill it) and the
// script kicks everyone the next time it checks in.
async function isPlaceAllowed(supabase: any, placeId: string): Promise<boolean> {
  if (!placeId) return true; // legacy calls with no place_id attached are not blocked
  const { data } = await supabase.from("managed_games").select("kill_active").eq("game_id", placeId).maybeSingle();
  return !!data && !data.kill_active;
}

async function resolveRobloxAvatar(userId: number): Promise<string> {
  try {
    const res = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
      { headers: { "User-Agent": "HRYA-Dashboard/1.0" } }
    );
    if (!res.ok) return "";
    const data = await res.json();
    return data?.data?.[0]?.imageUrl || "";
  } catch {
    return "";
  }
}

function extractField(fields: any[], ...names: string[]): string {
  for (const name of names) {
    const f = fields?.find((f: any) =>
      names.some(n => (f.name || "").toLowerCase().includes(n.toLowerCase()))
    );
    if (f?.value) return f.value;
  }
  return "";
}

function parseUserId(val: string): number {
  const n = parseInt((val || "").replace(/\D+/g, "").trim(), 10);
  return isNaN(n) ? 0 : n;
}

function parseSessionSeconds(raw: string): number {
  let s = 0;
  const hr = raw.match(/(\d+)\s*(h|hour|ساعة)/i);
  const min = raw.match(/(\d+)\s*(m|min|دقيقة)/i);
  const sec = raw.match(/(\d+)\s*(s|sec|ثانية)/i);
  if (hr) s += parseInt(hr[1]) * 3600;
  if (min) s += parseInt(min[1]) * 60;
  if (sec) s += parseInt(sec[1]);
  return s;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getWebhook(supabase: any): Promise<string> {
  try {
    const { data } = await supabase.from("game_stats").select("discord_webhook_url").eq("id", 1).maybeSingle();
    return data?.discord_webhook_url || "";
  } catch { return ""; }
}

async function isNotifEnabled(supabase: any, actionType: string): Promise<boolean> {
  try {
    const { data } = await supabase.from("discord_notification_settings").select("enabled").eq("action_type", actionType).maybeSingle();
    if (data === null) return true;
    return data?.enabled !== false;
  } catch { return true; }
}

async function notifyPurchase(supabase: any, opts: { username: string; gameName: string; productName: string; amount: number; productType: string }) {
  try {
    if (!(await isNotifEnabled(supabase, "purchase"))) return;
    const webhookUrl = await getWebhook(supabase);
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/1519070366109274215/45027CrrqLHeadS3_or8WwZi_5IIOK3NarkQHoHGau4LGM5basj_F94uS0TH-TZH1-8l")) return;
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: "💎 Robux Purchase",
          color: 0x2ecc71,
          fields: [
            { name: "Player", value: opts.username || "Unknown", inline: true },
            { name: "Game", value: opts.gameName || "Unknown", inline: true },
            { name: "Amount", value: `R$${opts.amount}`, inline: true },
            { name: "Item", value: `${opts.productName || "Unnamed"} (${opts.productType})`, inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }),
    });
  } catch { /* never block the request on a Discord hiccup */ }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();

    // ── Direct structured payload from Roblox game ──
    if (body.event_type && body.roblox_user_id) {
      const {
        event_type, roblox_user_id, username, display_name,
        country_code, device_type, session_seconds, server_id,
        fps, ping, reason,
      } = body;

      let avatarUrl = body.avatar_url || "";
      // If avatar_url is a thumbnail API URL, resolve the real CDN URL
      if (avatarUrl.includes("thumbnails.roblox.com/v1")) {
        avatarUrl = await resolveRobloxAvatar(Number(roblox_user_id));
      } else if (!avatarUrl && roblox_user_id) {
        avatarUrl = await resolveRobloxAvatar(Number(roblox_user_id));
      }

      // Check if this place is registered & not killed — kick immediately if not
      const joinPlaceId = String(body.place_id || "");
      const placeIsAllowed = await isPlaceAllowed(supabase, joinPlaceId);
      if (!placeIsAllowed && event_type === "join" && !OWNER_IDS.includes(Number(roblox_user_id))) {
        await supabase.from("commands").insert({
          command_type: "kick",
          roblox_user_id: Number(roblox_user_id),
          reason: "This game has not been added to the dashboard.",
        });
        return json({ success: true, kick: true, reason: "Game not registered." });
      }

      // Check kill_game
      const { data: gs } = await supabase.from("game_stats").select("kill_game_active").eq("id", 1).maybeSingle();
      const killGameActive = gs?.kill_game_active === true;

      // Check ban
      const { data: banRecord } = await supabase
        .from("banned_players").select("id,reason")
        .eq("roblox_user_id", Number(roblox_user_id)).maybeSingle();

      // Update fps/ping
      if (fps || ping) {
        const upd: any = { updated_at: new Date().toISOString() };
        if (fps) upd.fps_average = fps;
        if (ping) upd.ping_average = ping;
        await supabase.from("game_stats").update(upd).eq("id", 1);
      }

      if (event_type === "join") {
        await supabase.from("player_events").insert({
          roblox_user_id: Number(roblox_user_id), username,
          display_name: display_name || username,
          event_type: "join",
          country_code: country_code || "Unknown",
          device_type: device_type || "Unknown",
          server_id: server_id || null, avatar_url: avatarUrl,
        });

        const { data: existing } = await supabase.from("player_profiles")
          .select("*").eq("roblox_user_id", Number(roblox_user_id)).maybeSingle();

        await supabase.from("player_profiles").upsert({
          roblox_user_id: Number(roblox_user_id), username,
          display_name: display_name || username,
          avatar_url: avatarUrl || existing?.avatar_url,
          avatar_resolved: avatarUrl || existing?.avatar_resolved,
          country_code: country_code || existing?.country_code || "Unknown",
          device_type: device_type || existing?.device_type || "Unknown",
          join_count: (existing?.join_count || 0) + 1,
          session_count: existing?.session_count || 0,
          total_playtime_seconds: existing?.total_playtime_seconds || 0,
          last_seen_at: new Date().toISOString(),
          last_server_id: server_id || existing?.last_server_id,
          is_banned: !!banRecord,
          updated_at: new Date().toISOString(),
        }, { onConflict: "roblox_user_id" });

        // Block if banned or kill_game active
        if (banRecord || (killGameActive && !OWNER_IDS.includes(Number(roblox_user_id)))) {
          await supabase.from("commands").insert({
            command_type: "kick",
            roblox_user_id: Number(roblox_user_id),
            reason: banRecord ? `Banned: ${banRecord.reason || ""}` : "Server is locked.",
          });
          return json({ success: true, kick: true, reason: banRecord?.reason });
        }

        await supabase.from("online_players").upsert({
          roblox_user_id: Number(roblox_user_id), username,
          display_name: display_name || username,
          avatar_url: avatarUrl, avatar_resolved: avatarUrl,
          country_code: country_code || "Unknown",
          device_type: device_type || "Unknown",
          server_id: server_id || null,
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "roblox_user_id" });

        // Verified check
        if ((existing?.join_count || 0) >= 10) {
          await supabase.from("player_profiles")
            .update({ is_verified: true }).eq("roblox_user_id", Number(roblox_user_id));
        }

      } else if (event_type === "leave") {
        await supabase.from("online_players").delete().eq("roblox_user_id", Number(roblox_user_id));
        await supabase.from("player_events").insert({
          roblox_user_id: Number(roblox_user_id), username,
          display_name: display_name || username,
          event_type: "leave",
          country_code: country_code || "Unknown",
          device_type: device_type || "Unknown",
          session_seconds: session_seconds || 0,
          server_id: server_id || null, avatar_url: avatarUrl,
        });
        const { data: existing } = await supabase.from("player_profiles")
          .select("*").eq("roblox_user_id", Number(roblox_user_id)).maybeSingle();
        if (existing) {
          await supabase.from("player_profiles").update({
            total_playtime_seconds: (existing.total_playtime_seconds || 0) + (session_seconds || 0),
            session_count: (existing.session_count || 0) + 1,
            last_seen_at: new Date().toISOString(),
            last_server_id: server_id || existing.last_server_id,
            updated_at: new Date().toISOString(),
          }).eq("roblox_user_id", Number(roblox_user_id));
        }

      } else if (event_type === "report") {
        await supabase.from("reports").insert({
          reporter_user_id: body.reporter_user_id || null,
          reporter_username: body.reporter_username || "Unknown",
          reported_user_id: Number(roblox_user_id),
          reported_username: username,
          reason: reason || "No reason",
          description: body.description || null,
          server_id: server_id || null,
        });

      } else if (event_type === "security") {
        if (!OWNER_IDS.includes(Number(roblox_user_id))) {
          await supabase.from("security_flags").insert({
            roblox_user_id: Number(roblox_user_id), username,
            flag_type: body.flag_type || "Unknown",
            description: body.description || null,
            severity: body.severity || "medium",
            server_id: server_id || null,
          });
          await supabase.from("banned_players").upsert({
            roblox_user_id: Number(roblox_user_id), username,
            display_name: display_name || username,
            avatar_url: avatarUrl,
            reason: `Security: ${body.flag_type || "violation"}`,
            banned_by: "AutoMod",
          }, { onConflict: "roblox_user_id" });
          await supabase.from("player_profiles")
            .update({ is_banned: true, updated_at: new Date().toISOString() })
            .eq("roblox_user_id", Number(roblox_user_id));
        }

      } else if (event_type === "stats") {
        const upd: any = { updated_at: new Date().toISOString() };
        if (body.visits !== undefined) upd.visits = body.visits;
        if (body.favorites !== undefined) upd.favorites = body.favorites;
        if (body.likes !== undefined) upd.likes = body.likes;
        if (body.game_pass_sales !== undefined) upd.game_pass_sales = body.game_pass_sales;
        if (body.dev_product_sales !== undefined) upd.dev_product_sales = body.dev_product_sales;
        if (body.fps !== undefined) upd.fps_average = body.fps;
        if (body.ping !== undefined) upd.ping_average = body.ping;
        await supabase.from("game_stats").update(upd).eq("id", 1);

      } else if (event_type === "purchase") {
        // A Robux purchase (gamepass or developer product) happened in a registered game.
        const placeId = String(body.place_id || "");
        const amount = Number(body.robux_amount || 0);
        const productType = body.product_type === "gamepass" ? "gamepass" : "devproduct";

        if (placeId && amount > 0 && await isPlaceAllowed(supabase, placeId)) {
          await supabase.from("robux_purchases").insert({
            game_id: placeId,
            roblox_user_id: Number(roblox_user_id) || null,
            username: username || null,
            product_type: productType,
            product_id: body.product_id ? String(body.product_id) : null,
            product_name: body.product_name || null,
            robux_amount: amount,
          });

          const { data: game } = await supabase.from("managed_games")
            .select("id,name,total_robux,gamepass_sales").eq("game_id", placeId).maybeSingle();
          if (game) {
            await supabase.from("managed_games").update({
              total_robux: (game.total_robux || 0) + amount,
              gamepass_sales: (game.gamepass_sales || 0) + (productType === "gamepass" ? 1 : 0),
              updated_at: new Date().toISOString(),
            }).eq("id", game.id);
          }

          // Roll the new total straight into the aggregate so the dashboard updates instantly.
          const { data: allGames } = await supabase.from("managed_games").select("total_robux,gamepass_sales");
          let sumRobux = 0, sumGamepass = 0;
          for (const g of allGames || []) { sumRobux += g.total_robux || 0; sumGamepass += g.gamepass_sales || 0; }
          await supabase.from("game_stats").update({
            total_robux: sumRobux, gamepass_sales: sumGamepass, updated_at: new Date().toISOString(),
          }).eq("id", 1);

          await notifyPurchase(supabase, {
            username: username || "Unknown",
            gameName: game?.name || placeId,
            productName: body.product_name || "Unnamed item",
            amount,
            productType,
          });
        }
      }

      // Update server count
      const { count } = await supabase.from("online_players").select("*", { count: "exact", head: true });
      await supabase.from("game_stats").update({ servers_online: Math.max(1, Math.ceil((count || 0) / 15)) }).eq("id", 1);

      return json({ success: true });
    }

    // ── Discord embed format from old Roblox DiscordLogger script ──
    if (body.embeds && Array.isArray(body.embeds)) {
      for (const embed of body.embeds) {
        const fields = embed.fields || [];
        const title: string = embed.title || "";

        const userIdRaw = extractField(fields, "UserId", "userid", "id");
        const username = extractField(fields, "Username", "Player", "player");
        const displayName = extractField(fields, "Display Name", "displayname");
        const countryRaw = extractField(fields, "Country");
        const deviceRaw = extractField(fields, "Device");
        const sessionRaw = extractField(fields, "Session");
        const serverRaw = extractField(fields, "Server", "server");

        const robloxUserId = parseUserId(userIdRaw);
        if (!robloxUserId || !username) continue;

        const countryCode = countryRaw.replace(/[^\x00-\x7F]/g, "").trim() || "Unknown";
        const deviceType = deviceRaw.toLowerCase().includes("mobile") ? "Mobile"
          : deviceRaw.toLowerCase().includes("console") ? "Console"
          : deviceRaw.toLowerCase().includes("pc") ? "PC" : "Unknown";
        const sessionSeconds = parseSessionSeconds(sessionRaw);

        // Always resolve fresh avatar
        const avatarUrl = await resolveRobloxAvatar(robloxUserId);

        const isJoin = title.toLowerCase().includes("join") || title.includes("📥");
        const isLeave = title.toLowerCase().includes("left") || title.toLowerCase().includes("leave") || title.includes("📤");
        if (!isJoin && !isLeave) continue;

        const eventType = isJoin ? "join" : "leave";

        const { data: banRecord } = await supabase.from("banned_players")
          .select("id,reason").eq("roblox_user_id", robloxUserId).maybeSingle();

        await supabase.from("player_events").insert({
          roblox_user_id: robloxUserId, username,
          display_name: displayName || username,
          event_type: eventType,
          country_code: countryCode, device_type: deviceType,
          session_seconds: sessionSeconds, server_id: serverRaw || null,
          avatar_url: avatarUrl,
        });

        if (eventType === "join") {
          const { data: gs } = await supabase.from("game_stats").select("kill_game_active").eq("id", 1).maybeSingle();

          const { data: existing } = await supabase.from("player_profiles")
            .select("*").eq("roblox_user_id", robloxUserId).maybeSingle();

          await supabase.from("player_profiles").upsert({
            roblox_user_id: robloxUserId, username,
            display_name: displayName || username,
            avatar_url: avatarUrl || existing?.avatar_url,
            avatar_resolved: avatarUrl,
            country_code: countryCode,
            device_type: deviceType,
            join_count: (existing?.join_count || 0) + 1,
            session_count: existing?.session_count || 0,
            total_playtime_seconds: existing?.total_playtime_seconds || 0,
            last_seen_at: new Date().toISOString(),
            last_server_id: serverRaw || existing?.last_server_id,
            is_banned: !!banRecord,
            updated_at: new Date().toISOString(),
          }, { onConflict: "roblox_user_id" });

          if (!banRecord && !gs?.kill_game_active) {
            await supabase.from("online_players").upsert({
              roblox_user_id: robloxUserId, username,
              display_name: displayName || username,
              avatar_url: avatarUrl, avatar_resolved: avatarUrl,
              country_code: countryCode, device_type: deviceType,
              server_id: serverRaw || null,
              joined_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "roblox_user_id" });
          } else if (banRecord || gs?.kill_game_active) {
            await supabase.from("commands").insert({
              command_type: "kick",
              roblox_user_id: robloxUserId,
              reason: banRecord ? `Banned: ${banRecord.reason}` : "Server locked.",
            });
          }
        } else {
          await supabase.from("online_players").delete().eq("roblox_user_id", robloxUserId);
          const { data: existing } = await supabase.from("player_profiles")
            .select("*").eq("roblox_user_id", robloxUserId).maybeSingle();
          if (existing) {
            await supabase.from("player_profiles").update({
              total_playtime_seconds: (existing.total_playtime_seconds || 0) + sessionSeconds,
              session_count: (existing.session_count || 0) + 1,
              last_seen_at: new Date().toISOString(),
              last_server_id: serverRaw || existing.last_server_id,
              updated_at: new Date().toISOString(),
            }).eq("roblox_user_id", robloxUserId);
          }
        }
      }
      return json({ success: true });
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
