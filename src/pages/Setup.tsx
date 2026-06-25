import { useState, useEffect } from 'react';
import { Copy, CheckCircle, Server, Code2, Zap, Settings, Shield, AlertTriangle, Lock, Eye, EyeOff } from 'lucide-react';
import { WEBHOOK_URL, SUPABASE_URL } from '../lib/api';
import { API } from '../lib/api';

const API_BASE = `${SUPABASE_URL}/functions/v1/roblox-api`;

const SERVER_SCRIPT = `--!strict
-- HRYA-sadiaa Admin Script v4 -- ServerScriptService
-- A game only runs if its Place ID has been added on the dashboard's Games page.
-- This is checked once at startup AND on a repeating loop the whole server is
-- live, so removing/locking the game from the dashboard shuts it down too —
-- not just at the next server start.
local HttpService = game:GetService("HttpService")
local Players = game:GetService("Players")
local TeleportService = game:GetService("TeleportService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")

local WEBHOOK = "${WEBHOOK_URL}"
local API = "${API_BASE}"

local function post(url, data)
    pcall(function()
        HttpService:PostAsync(url, HttpService:JSONEncode(data), Enum.HttpContentType.ApplicationJson)
    end)
end

local function get(url)
    local ok, res = pcall(function() return HttpService:GetAsync(url, true) end)
    if ok and res then
        local ok2, dec = pcall(function() return HttpService:JSONDecode(res) end)
        if ok2 then return dec end
    end
    return nil
end

-- ── Registration / kill-switch check — fully dynamic, nothing hardcoded ─────
-- Calls the dashboard's check-place endpoint. If HTTP is blocked, disabled, or
-- the dashboard says no, this fails CLOSED (treated as not allowed).
local function checkAllowed(): boolean
    for attempt = 1, 2 do
        local data = get(API .. "/check-place/" .. tostring(game.PlaceId))
        if data ~= nil then
            return data.allowed == true
        end
        task.wait(2)
    end
    return false
end

local isAllowed = false

local function lockdownKickAll(reason: string)
    for _, p in ipairs(Players:GetPlayers()) do
        pcall(function() p:Kick(reason) end)
    end
end

isAllowed = checkAllowed()
if not isAllowed then
    lockdownKickAll("This game has not been added to the dashboard.")
end

-- Loop shutdown: re-checks every 20s for the lifetime of the server. If the
-- game is removed or locked from the Games page mid-session, everyone gets
-- kicked within 20 seconds — no need to wait for a server restart.
task.spawn(function()
    while true do
        task.wait(20)
        local nowAllowed = checkAllowed()
        if isAllowed and not nowAllowed then
            lockdownKickAll("This game has been disabled — it is no longer registered on the dashboard.")
        end
        isAllowed = nowAllowed
    end
end)

-- RemoteEvents for client notifications
local function getOrCreate(name)
    return ReplicatedStorage:FindFirstChild(name) or
        (function() local e = Instance.new("RemoteEvent", ReplicatedStorage); e.Name = name; return e end)()
end

local WarnEvent = getOrCreate("HRYAWarn")
local MsgEvent  = getOrCreate("HRYAMsg")

-- Matches each owner's color on the dashboard, so a broadcast from "Nexus" looks
-- like it's actually from Nexus in-game, not a generic gray system message.
local SENDER_COLORS = {
    Nexus   = "108,60,225",
    Luna    = "0,212,255",
    Youssef = "0,255,136",
}

-- ── Robux / gamepass purchase tracking — reported per game, in real time ───
local function reportPurchase(userId: number, username: string, productType: string, productId: any, productName: string, robuxAmount: number)
    post(WEBHOOK, {
        event_type = "purchase",
        roblox_user_id = userId,
        username = username,
        place_id = tostring(game.PlaceId),
        product_type = productType,
        product_id = tostring(productId),
        product_name = productName,
        robux_amount = robuxAmount,
    })
end

MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, gamePassId, wasPurchased)
    if not wasPurchased then return end
    local ok, info = pcall(function() return MarketplaceService:GetProductInfo(gamePassId, Enum.InfoType.GamePass) end)
    local name = (ok and info and info.Name) or ("GamePass " .. tostring(gamePassId))
    local price = (ok and info and info.PriceInRobux) or 0
    reportPurchase(player.UserId, player.Name, "gamepass", gamePassId, name, price)
end)

-- NOTE: if you already use ProcessReceipt elsewhere to grant developer-product
-- rewards, merge that logic in here instead of overwriting it — Roblox only
-- allows ONE ProcessReceipt callback per game.
MarketplaceService.ProcessReceipt = function(receiptInfo)
    local player = Players:GetPlayerByUserId(receiptInfo.PlayerId)
    if player then
        local ok, info = pcall(function() return MarketplaceService:GetProductInfo(receiptInfo.ProductId, Enum.InfoType.Product) end)
        local name = (ok and info and info.Name) or ("Product " .. tostring(receiptInfo.ProductId))
        reportPurchase(player.UserId, player.Name, "devproduct", receiptInfo.ProductId, name, receiptInfo.CurrencySpent or 0)
    end
    return Enum.ProductPurchaseDecision.PurchaseGranted
end

-- Poll commands every 3 seconds for instant response
task.spawn(function()
    while true do
        local data = get(API .. "/commands")
        if data and data.commands then
            for _, cmd in ipairs(data.commands) do
                local ctype = cmd.command_type

                if ctype == "kick" or ctype == "ban" then
                    local target = Players:GetPlayerByUserId(cmd.roblox_user_id)
                    if target then
                        target:Kick(cmd.reason or "Removed by admin")
                    end

                elseif ctype == "warn" then
                    local target = Players:GetPlayerByUserId(cmd.roblox_user_id)
                    if target then
                        WarnEvent:FireClient(target, cmd.message or "Warning: Follow the rules.", 20, "Moderator")
                    end

                elseif ctype == "message" then
                    local msg = cmd.message or ""
                    local sender = cmd.reason or "Admin"
                    if cmd.roblox_user_id and cmd.roblox_user_id ~= 0 then
                        local target = Players:GetPlayerByUserId(cmd.roblox_user_id)
                        if target then
                            MsgEvent:FireClient(target, msg, 20, sender, SENDER_COLORS[sender])
                        end
                    end

                elseif ctype == "broadcast" then
                    local msg = cmd.message or ""
                    local sender = cmd.reason or "Admin"
                    for _, p in ipairs(Players:GetPlayers()) do
                        MsgEvent:FireClient(p, msg, 20, sender, SENDER_COLORS[sender])
                    end

                elseif ctype == "shutdown" then
                    if cmd.target_server_id == game.JobId then
                        for _, p in ipairs(Players:GetPlayers()) do
                            pcall(function() TeleportService:Teleport(game.PlaceId, p) end)
                        end
                    end

                elseif ctype == "shutdown_all" then
                    for _, p in ipairs(Players:GetPlayers()) do
                        pcall(function() TeleportService:Teleport(game.PlaceId, p) end)
                    end
                end

                post(API .. "/commands/execute", { command_id = cmd.id, status = "executed" })
            end
        end
        task.wait(3)
    end
end)

local joinTimes = {}

Players.PlayerAdded:Connect(function(player)
    -- Registration gate — applies to every new joiner, even mid-session
    if not isAllowed then
        task.wait(0.5)
        player:Kick("This game has not been added to the dashboard.")
        return
    end

    joinTimes[player.UserId] = os.time()

    -- Check ban and kill_game status
    local banData = get(API .. "/check-ban/" .. player.UserId)
    if banData then
        if banData.banned then
            player:Kick("You are permanently banned. Reason: " .. (banData.reason or "Violation of rules"))
            return
        end
        if banData.kill_game then
            player:Kick("This server is currently locked by an admin.")
            return
        end
    end

    -- Report join to webhook (includes place_id for the registration check)
    post(WEBHOOK, {
        event_type = "join",
        roblox_user_id = player.UserId,
        username = player.Name,
        display_name = player.DisplayName,
        avatar_url = "",
        server_id = game.JobId,
        place_id = tostring(game.PlaceId),
        session_seconds = 0,
    })

    -- Deliver pending warns/messages after 30s
    task.spawn(function()
        task.wait(30)
        if not player or not player.Parent then return end

        local warns = get(API .. "/pending-warns/" .. player.UserId)
        if warns and warns.warns then
            for _, w in ipairs(warns.warns) do
                WarnEvent:FireClient(player, w.message, 20, "Moderator")
                task.wait(1)
            end
        end

        local msgs = get(API .. "/pending-messages/" .. player.UserId)
        if msgs and msgs.messages then
            for _, m in ipairs(msgs.messages) do
                MsgEvent:FireClient(player, m.message, 20, "Admin")
                task.wait(1)
            end
        end
    end)
end)

Players.PlayerRemoving:Connect(function(player)
    local sessionSeconds = os.time() - (joinTimes[player.UserId] or os.time())
    joinTimes[player.UserId] = nil
    post(WEBHOOK, {
        event_type = "leave",
        roblox_user_id = player.UserId,
        username = player.Name,
        display_name = player.DisplayName,
        server_id = game.JobId,
        place_id = tostring(game.PlaceId),
        session_seconds = sessionSeconds,
    })
end)`;

const CLIENT_SCRIPT = `--!strict
-- HRYA-sadiaa Client Script v4 -- StarterPlayerScripts
-- Warn/message toasts now stack in a queue instead of replacing each other,
-- and pop in with a small scale + rotation "settle" animation.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local WarnEvent = ReplicatedStorage:WaitForChild("HRYAWarn", 30)
local MsgEvent  = ReplicatedStorage:WaitForChild("HRYAMsg", 30)

if not WarnEvent or not MsgEvent then return end

local MAX_VISIBLE = 4
local order = 0

-- Built once and reused — every notification slides into this same stack.
local screenGui = Instance.new("ScreenGui")
screenGui.Name = "HRYANotif"
screenGui.ResetOnSpawn = false
screenGui.DisplayOrder = 999
screenGui.IgnoreGuiInset = true
screenGui.Parent = playerGui

local stack = Instance.new("Frame")
stack.Name = "Stack"
stack.AnchorPoint = Vector2.new(0.5, 0)
stack.Position = UDim2.new(0.5, 0, 0, 22)
stack.Size = UDim2.new(0, 420, 0, 0)
stack.AutomaticSize = Enum.AutomaticSize.Y
stack.BackgroundTransparency = 1
stack.Parent = screenGui

local stackLayout = Instance.new("UIListLayout", stack)
stackLayout.SortOrder = Enum.SortOrder.LayoutOrder
stackLayout.Padding = UDim.new(0, 10)
stackLayout.HorizontalAlignment = Enum.HorizontalAlignment.Center

local function enforceMax()
    local cards = {}
    for _, c in ipairs(stack:GetChildren()) do
        if c:IsA("Frame") and c.Name == "Card" then table.insert(cards, c) end
    end
    table.sort(cards, function(a, b) return a.LayoutOrder < b.LayoutOrder end)
    while #cards > MAX_VISIBLE do
        table.remove(cards, 1):Destroy()
    end
end

local function parseColor(csv: string?): Color3?
    if not csv then return nil end
    local r, g, b = csv:match("(%d+),(%d+),(%d+)")
    if r and g and b then
        return Color3.fromRGB(tonumber(r) :: number, tonumber(g) :: number, tonumber(b) :: number)
    end
    return nil
end

local function makeGui(message: string, duration: number, sender: string, isWarn: boolean, senderColor: string?)
    local accentColor = isWarn and Color3.fromRGB(255, 45, 85) or (parseColor(senderColor) or Color3.fromRGB(108, 60, 225))

    order += 1
    local card = Instance.new("Frame")
    card.Name = "Card"
    card.LayoutOrder = order
    card.Size = UDim2.new(0, 420, 0, 0)
    card.AutomaticSize = Enum.AutomaticSize.Y
    card.BackgroundColor3 = isWarn and Color3.fromRGB(18, 6, 10) or Color3.fromRGB(8, 12, 24)
    card.BorderSizePixel = 0
    card.Rotation = -3
    card.Parent = stack
    Instance.new("UICorner", card).CornerRadius = UDim.new(0, 14)

    local scale = Instance.new("UIScale", card)
    scale.Scale = 0.8

    local accent = Instance.new("Frame", card)
    accent.Size = UDim2.new(1, 0, 0, 3)
    accent.BorderSizePixel = 0
    accent.BackgroundColor3 = accentColor
    Instance.new("UICorner", accent).CornerRadius = UDim.new(0, 14)

    local stroke = Instance.new("UIStroke", card)
    stroke.Color = accentColor
    stroke.Thickness = 1
    stroke.Transparency = 0.55

    local padding = Instance.new("UIPadding", card)
    padding.PaddingLeft = UDim.new(0, 18)
    padding.PaddingRight = UDim.new(0, 18)
    padding.PaddingTop = UDim.new(0, 16)
    padding.PaddingBottom = UDim.new(0, 14)

    local layout = Instance.new("UIListLayout", card)
    layout.SortOrder = Enum.SortOrder.LayoutOrder
    layout.Padding = UDim.new(0, 6)

    local headerRow = Instance.new("Frame", card)
    headerRow.Size = UDim2.new(1, 0, 0, 20)
    headerRow.BackgroundTransparency = 1
    headerRow.LayoutOrder = 1
    local hLayout = Instance.new("UIListLayout", headerRow)
    hLayout.FillDirection = Enum.FillDirection.Horizontal
    hLayout.Padding = UDim.new(0, 8)
    hLayout.VerticalAlignment = Enum.VerticalAlignment.Center

    local iconLabel = Instance.new("TextLabel", headerRow)
    iconLabel.AutomaticSize = Enum.AutomaticSize.X
    iconLabel.Size = UDim2.new(0, 0, 1, 0)
    iconLabel.BackgroundTransparency = 1
    iconLabel.Text = isWarn and "⚠" or "✦"
    iconLabel.TextColor3 = accentColor
    iconLabel.TextSize = 15
    iconLabel.Font = Enum.Font.GothamBold
    iconLabel.LayoutOrder = 1

    -- The sender's name is the headline here — bold and in their own color, so
    -- it's obvious at a glance who actually sent this.
    local senderLabel = Instance.new("TextLabel", headerRow)
    senderLabel.AutomaticSize = Enum.AutomaticSize.X
    senderLabel.Size = UDim2.new(0, 0, 1, 0)
    senderLabel.BackgroundTransparency = 1
    senderLabel.Text = sender or "Admin"
    senderLabel.TextColor3 = accentColor
    senderLabel.TextSize = 14
    senderLabel.Font = Enum.Font.GothamBlack
    senderLabel.LayoutOrder = 2

    local tagLabel = Instance.new("TextLabel", headerRow)
    tagLabel.AutomaticSize = Enum.AutomaticSize.X
    tagLabel.Size = UDim2.new(0, 0, 1, 0)
    tagLabel.BackgroundTransparency = 1
    tagLabel.Text = isWarn and "· WARNING" or "· MESSAGE"
    tagLabel.TextColor3 = Color3.fromRGB(100, 116, 139)
    tagLabel.TextSize = 9
    tagLabel.Font = Enum.Font.GothamBold
    tagLabel.LayoutOrder = 3

    local msgLabel = Instance.new("TextLabel", card)
    msgLabel.Size = UDim2.new(1, 0, 0, 0)
    msgLabel.AutomaticSize = Enum.AutomaticSize.Y
    msgLabel.BackgroundTransparency = 1
    msgLabel.Text = message
    msgLabel.TextColor3 = Color3.fromRGB(226, 232, 240)
    msgLabel.TextSize = 14
    msgLabel.Font = Enum.Font.GothamMedium
    msgLabel.TextWrapped = true
    msgLabel.TextXAlignment = Enum.TextXAlignment.Left
    msgLabel.LayoutOrder = 2

    local progressBg = Instance.new("Frame", card)
    progressBg.Size = UDim2.new(1, 0, 0, 2)
    progressBg.BackgroundColor3 = Color3.fromRGB(13, 21, 38)
    progressBg.BorderSizePixel = 0
    progressBg.LayoutOrder = 3
    Instance.new("UICorner", progressBg).CornerRadius = UDim.new(0, 1)

    local progressFill = Instance.new("Frame", progressBg)
    progressFill.Size = UDim2.new(1, 0, 1, 0)
    progressFill.BackgroundColor3 = accentColor
    progressFill.BorderSizePixel = 0
    Instance.new("UICorner", progressFill).CornerRadius = UDim.new(0, 1)

    enforceMax()

    -- Pop-in: scale up from 0.8 and settle the -3° tilt back to 0, both with Back easing for a little overshoot/bounce.
    TweenService:Create(scale, TweenInfo.new(0.4, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Scale = 1 }):Play()
    TweenService:Create(card, TweenInfo.new(0.4, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Rotation = 0 }):Play()

    task.spawn(function()
        TweenService:Create(progressFill, TweenInfo.new(duration, Enum.EasingStyle.Linear), { Size = UDim2.new(0, 0, 1, 0) }):Play()
    end)

    task.delay(duration, function()
        if not card.Parent then return end
        TweenService:Create(card, TweenInfo.new(0.3, Enum.EasingStyle.Quart, Enum.EasingDirection.In), { Rotation = 3 }):Play()
        local shrink = TweenService:Create(scale, TweenInfo.new(0.3, Enum.EasingStyle.Quart, Enum.EasingDirection.In), { Scale = 0 })
        shrink:Play()
        shrink.Completed:Connect(function() if card.Parent then card:Destroy() end end)
    end)
end

WarnEvent.OnClientEvent:Connect(function(message, duration, sender)
    makeGui(message or "Warning from moderator.", duration or 20, sender or "Moderator", true)
end)

MsgEvent.OnClientEvent:Connect(function(message, duration, sender, senderColor)
    makeGui(message or "Message from admin.", duration or 20, sender or "Admin", false, senderColor)
end)`;

// Setup is restricted to Youssef only
const SETUP_PASSWORD = 'ilovenoranforever';

export default function Setup() {
  const [authorized, setAuthorized] = useState(() => {
    // Check if Youssef is the logged-in owner
    try {
      const raw = localStorage.getItem('hrya_auth_v2');
      if (raw) {
        const obj = JSON.parse(raw);
        return obj.owner === 'Youssef';
      }
    } catch { }
    return false;
  });
  const [authPw, setAuthPw] = useState('');
  const [authErr, setAuthErr] = useState('');
  const [showAuthPw, setShowAuthPw] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [discordUrl, setDiscordUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [registeredGames, setRegisteredGames] = useState<{ game_id: string; name: string; kill_active: boolean }[]>([]);

  useEffect(() => {
    API.getGames().then((r: any) => setRegisteredGames(r?.games || [])).catch(() => {});
  }, []);

  // Auth gate — only Youssef can access Setup
  if (!authorized) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="card-glow p-8 w-full max-w-sm animate-in text-center" style={{ borderColor: 'rgba(255,45,85,0.25)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{ background: 'rgba(255,45,85,0.08)', border: '2px solid rgba(255,45,85,0.3)' }}>
            <Lock size={28} style={{ color: '#ff2d55' }} />
          </div>
          <h2 className="font-black text-xl text-white uppercase tracking-wider mb-1" style={{ fontFamily: 'Exo 2, sans-serif' }}>
            Restricted Access
          </h2>
          <p className="text-xs mb-6" style={{ color: '#334155' }}>
            This section is restricted to authorized personnel only.
          </p>
          <div className="relative mb-3">
            <input type={showAuthPw ? 'text' : 'password'} value={authPw} onChange={e => setAuthPw(e.target.value)}
              className="input pr-11 text-center" placeholder="Enter access code"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  if (authPw === SETUP_PASSWORD) setAuthorized(true);
                  else { setAuthErr('Access denied.'); setAuthPw(''); }
                }
              }} />
            <button type="button" onClick={() => setShowAuthPw(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: '#334155' }}>
              {showAuthPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
          {authErr && <p className="text-xs mb-3" style={{ color: '#ff2d55' }}>{authErr}</p>}
          <button onClick={() => {
            if (authPw === SETUP_PASSWORD) setAuthorized(true);
            else { setAuthErr('Access denied.'); setAuthPw(''); }
          }} className="btn-primary w-full justify-center py-3">
            <Zap size={14} />Unlock
          </button>
        </div>
      </div>
    );
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  async function saveDiscord() {
    if (!discordUrl.trim()) return;
    setSaving(true);
    await API.updateGameStats({ discord_webhook_url: discordUrl.trim() });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const Card = ({ children, color = 'default' }: { children: React.ReactNode; color?: 'default' | 'purple' | 'green' | 'red' | 'cyan' }) => {
    const styles: Record<string, React.CSSProperties> = {
      default: { background: '#0d1526', border: '1px solid #1a2a45' },
      purple: { background: '#0d1526', border: '1px solid rgba(108,60,225,0.3)' },
      green:  { background: '#0a1a14', border: '1px solid rgba(0,255,136,0.2)' },
      red:    { background: '#180a0e', border: '1px solid rgba(255,45,85,0.2)' },
      cyan:   { background: '#0a1620', border: '1px solid rgba(0,212,255,0.2)' },
    };
    return (
      <div className="rounded-xl p-5 space-y-3 hover-lift transition-all" style={styles[color]}>
        {children}
      </div>
    );
  };

  const StepNum = ({ n, color = '#6c3ce1' }: { n: number; color?: string }) => (
    <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs shrink-0"
      style={{ background: color, boxShadow: `0 0 12px ${color}60` }}>{n}</div>
  );

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'Exo 2, sans-serif' }}>Setup</h1>
        <p className="text-xs uppercase tracking-widest mt-1" style={{ color: '#334155' }}>Connect your Roblox games to this dashboard</p>
      </div>

      {/* Registered games notice */}
      <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'rgba(255,214,10,0.05)', border: '1px solid rgba(255,214,10,0.2)' }}>
        <AlertTriangle size={16} style={{ color: '#ffd60a', flexShrink: 0, marginTop: 1 }} />
        <div>
          <p className="font-bold text-sm" style={{ color: '#ffd60a' }}>Only Two Places Can Run This</p>
          <p className="text-xs mt-1" style={{ color: '#64748b' }}>
            The Games page can only ever register <strong className="text-white">88817119635622</strong> and{' '}
            <strong className="text-white">130852921874128</strong> — nothing else can be added, so there's no way to
            accidentally widen the list. Any other place that runs this script — including a copy someone pastes into
            their own game — kicks every player immediately and keeps re-checking every 20 seconds while live.
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            {registeredGames.length === 0 ? (
              <span className="text-xs" style={{ color: '#475569' }}>Neither place is registered yet — add them on the Games page first.</span>
            ) : registeredGames.map(g => (
              <span key={g.game_id} className="badge font-mono" style={g.kill_active
                ? { background: 'rgba(255,45,85,0.1)', color: '#ff2d55', border: '1px solid rgba(255,45,85,0.3)' }
                : { background: 'rgba(0,255,136,0.1)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.3)' }}>
                {g.game_id} {g.kill_active ? '· locked' : '· live'}
              </span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: '#475569' }}>
            Visits, likes, and playing count are fetched per game from its own place. Robux and gamepass sales are tracked
            per game in real time as players buy gamepasses or developer products. If the script turns up in an unregistered
            place, Discord gets a one-time alert with that place's public name and creator — never anything about the players
            inside it.
          </p>
        </div>
      </div>

      {/* Discord Webhook */}
      <Card color="purple">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(108,60,225,0.15)', border: '1px solid rgba(108,60,225,0.3)' }}>
            <Settings size={16} style={{ color: '#8b5cf6' }} />
          </div>
          <div>
            <h3 className="text-white font-bold">Discord Webhook</h3>
            <p className="text-xs" style={{ color: '#475569' }}>Used for 2FA codes, alerts, and notifications.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <input value={discordUrl} onChange={e => setDiscordUrl(e.target.value)}
            className="input flex-1 text-sm font-mono" placeholder="https://discord.com/api/webhooks/1519070366109274215/45027CrrqLHeadS3_or8WwZi_5IIOK3NarkQHoHGau4LGM5basj_F94uS0TH-TZH1-8l" />
          <button onClick={saveDiscord} disabled={saving || !discordUrl.trim()} className="btn-primary disabled:opacity-40">
            {saved ? <CheckCircle size={14} /> : saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={14} />}
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
      </Card>

      {/* Step 1 */}
      <Card>
        <div className="flex items-center gap-3">
          <StepNum n={1} />
          <h3 className="text-white font-bold">Enable HTTP Requests in Roblox Studio</h3>
        </div>
        <p className="text-sm pl-10" style={{ color: '#64748b' }}>
          Go to <strong className="text-white">Game Settings → Security</strong> and enable <strong className="text-white">Allow HTTP Requests</strong>.
          Do this for every game you plan to register.
        </p>
      </Card>

      {/* Step 2 - Webhook URL */}
      <Card color="cyan">
        <div className="flex items-center gap-3">
          <StepNum n={2} color="#00d4ff" />
          <div>
            <h3 className="text-white font-bold flex items-center gap-2"><Server size={14} />Webhook URL</h3>
            <p className="text-xs" style={{ color: '#475569' }}>Embedded in the script below automatically.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: '#060c18', border: '1px solid #1a2a45' }}>
          <code className="text-xs flex-1 break-all font-mono" style={{ color: '#00d4ff' }}>{WEBHOOK_URL}</code>
          <button onClick={() => copy(WEBHOOK_URL, 'webhook')} className="shrink-0 transition-colors text-slate-600 hover:text-white">
            {copied === 'webhook' ? <CheckCircle size={13} style={{ color: '#00ff88' }} /> : <Copy size={13} />}
          </button>
        </div>
      </Card>

      {/* Step 3 - Server Script */}
      <Card>
        <div className="flex items-center gap-3">
          <StepNum n={3} color="#6c3ce1" />
          <div>
            <h3 className="text-white font-bold flex items-center gap-2"><Code2 size={14} />Server Script — ServerScriptService</h3>
            <p className="text-xs" style={{ color: '#475569' }}>Place this in ServerScriptService in every game you register.</p>
          </div>
        </div>
        <div className="rounded-xl px-3 py-2 text-xs flex items-start gap-2" style={{ background: 'rgba(108,60,225,0.06)', border: '1px solid rgba(108,60,225,0.2)', color: '#8b5cf6' }}>
          <Shield size={11} style={{ flexShrink: 0, marginTop: 1 }} />
          Checks the dashboard on a 20-second loop — add or remove a game on the Games page and every live server reacts within seconds.
        </div>
        <div className="relative">
          <pre className="rounded-xl p-4 text-xs overflow-x-auto max-h-72 font-mono" style={{ background: '#060c18', border: '1px solid #1a2a45', color: '#94a3b8' }}>{SERVER_SCRIPT}</pre>
          <button onClick={() => copy(SERVER_SCRIPT, 'server')}
            className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: '#0d1526', border: '1px solid #1a2a45', color: copied === 'server' ? '#00ff88' : '#64748b' }}>
            {copied === 'server' ? <CheckCircle size={11} /> : <Copy size={11} />}
            {copied === 'server' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </Card>

      {/* Step 4 - Client Script */}
      <Card>
        <div className="flex items-center gap-3">
          <StepNum n={4} color="#00d4ff" />
          <div>
            <h3 className="text-white font-bold flex items-center gap-2"><Code2 size={14} />Client Script — StarterPlayerScripts</h3>
            <p className="text-xs" style={{ color: '#475569' }}>Handles warn/message popups with animated progress bar.</p>
          </div>
        </div>
        <div className="relative">
          <pre className="rounded-xl p-4 text-xs overflow-x-auto max-h-72 font-mono" style={{ background: '#060c18', border: '1px solid #1a2a45', color: '#94a3b8' }}>{CLIENT_SCRIPT}</pre>
          <button onClick={() => copy(CLIENT_SCRIPT, 'client')}
            className="absolute top-2 right-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: '#0d1526', border: '1px solid #1a2a45', color: copied === 'client' ? '#00ff88' : '#64748b' }}>
            {copied === 'client' ? <CheckCircle size={11} /> : <Copy size={11} />}
            {copied === 'client' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </Card>

      {/* Done */}
      <Card color="green">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.25)' }}>
            <Zap size={16} style={{ color: '#00ff88' }} />
          </div>
          <h3 className="font-bold text-white">System Ready</h3>
        </div>
        <ul className="text-sm space-y-1.5 pl-12" style={{ color: '#64748b' }}>
          {[
            ['Kick', 'Player removed within 3 seconds'],
            ['Ban', 'Blocked permanently, kicked within 3s'],
            ['Warn / Message', 'Stacks as toasts with a 20s animated progress bar'],
            ['Broadcast', 'Sent to ALL players with your chosen name'],
            ['Kill Game', 'Locks server — no new joins'],
            ['Revive Game', 'Removes lock — normal operations resume'],
            ['Unregistered games', 'Auto-kick everyone; reported to Discord once, then re-checked every 20s'],
            ['Visits, Likes & Playing', 'Tracked per game, from its own place'],
            ['Robux', 'Tracked per game, in real time, from gamepasses and dev products'],
          ].map(([label, desc]) => (
            <li key={label} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#00ff88' }} />
              <strong className="text-white">{label}</strong> — {desc}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
