// ../../packages/protocol/dist/version.js
var PROVIDER_GLOBAL = "claude";

// ../../packages/sdk/dist/connect-chip.js
var STYLE = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
.chip, .btn { display: inline-flex; align-items: center; gap: 9px; cursor: pointer; border: 0;
  font-size: 13px; font-weight: 600; line-height: 1; border-radius: 10px; }
/* The canonical connect lockup \u2014 the SAME mark + wordmark on every wrapp, so users recognize
   "Connect Switchboard" the way they knew the MetaMask button. Dark pill, lime glyph, locked in
   the shadow root so a host app can't restyle it away. */
.btn { padding: 9px 15px 9px 11px; background: #12151C; color: #E8EDF4; border: 1px solid #2C3444; }
.btn.connect:hover { background: #161B24; border-color: #3A4A18; }
.btn.get { color: #C3CAD6; border-color: #262C38; }
.btn.get:hover { color: #E8EDF4; border-color: #3A4353; }
.btn .arr { color: #6E7C90; font-weight: 500; margin-left: -2px; }
/* The Switchboard mark: lime rounded square with the top-right notch (matches the side-panel brand).
   Muted to slate when the sidekick isn't installed yet \u2014 the mark "lights up" once you can connect. */
.glyph { position: relative; width: 16px; height: 16px; border-radius: 5px; background: #C8F250;
  box-shadow: 0 0 12px rgba(200,242,80,.45); flex: none; }
.glyph::after { content: ""; position: absolute; top: 4px; right: 4px; width: 4px; height: 4px;
  border-radius: 50%; background: #0A0C10; }
.btn.get .glyph { background: #6E7C90; box-shadow: none; }
.wrap { position: relative; display: inline-block; }
.chip { background: #1A1F29; border: 1px solid #262C38; padding: 6px 10px 6px 7px; color: #E8EDF4; }
.chip:hover { border-color: #3A4353; }
.av { width: 26px; height: 26px; border-radius: 7px; background: #C8F250; color: #0A0C10; display: grid;
  place-items: center; font-weight: 700; font-size: 12px; overflow: hidden; flex: none; }
.av img { width: 100%; height: 100%; object-fit: cover; }
.who { display: flex; flex-direction: column; gap: 3px; min-width: 0; text-align: left; }
.who .hi { font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.who .proj { font-size: 10.5px; font-weight: 500; color: #99A3B7; white-space: nowrap; }
.caret { color: #6E7C90; font-size: 9px; margin-left: 2px; }
.menu { position: absolute; top: calc(100% + 6px); right: 0; z-index: 2147483000; width: 232px;
  background: #1A1F29; border: 1px solid #262C38; border-radius: 12px; padding: 7px;
  box-shadow: 0 18px 40px -20px rgba(0,0,0,.7); }
.menu .lbl { padding: 8px 10px 6px; font-size: 10px; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: #6E7C90; }
.menu .proj-row { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 8px;
  background: #20262F; cursor: pointer; border: 0; width: 100%; color: #E8EDF4; font-size: 13px; font-weight: 600; }
.menu .proj-row:hover { background: #262d38; }
.menu .proj-row .go { margin-left: auto; color: #C8F250; font-size: 11px; font-weight: 600; }
.menu .sep { height: 1px; background: #262C38; margin: 6px 4px; }
.menu .item { display: block; width: 100%; text-align: left; padding: 8px 10px; border: 0; border-radius: 8px;
  background: transparent; color: #B4BECE; font-size: 13px; font-weight: 500; cursor: pointer; }
.menu .item:hover { background: #20262F; color: #E8EDF4; }
.menu .foot { padding: 8px 10px 4px; font-size: 11px; font-weight: 500; color: #6E7C90; line-height: 1.4; }
`;
function mountConnect(target, opts = {}) {
  const installUrl = opts.installUrl ?? "https://thelastprompt.ai/switchboard/";
  const host = document.createElement("div");
  host.style.display = "inline-block";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  root.append(style);
  const mount = document.createElement("div");
  root.append(mount);
  target.append(host);
  let state = { kind: "booting" };
  let menuOpen = false;
  let destroyed = false;
  let relay2 = null;
  let seq = 0;
  let wasConnected = false;
  let sessionDisconnected = false;
  const onDocClick = (e) => {
    if (menuOpen && !host.contains(e.target)) {
      menuOpen = false;
      render();
    }
  };
  document.addEventListener("click", onDocClick);
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls)
      n.className = cls;
    if (text != null)
      n.textContent = text;
    return n;
  }
  async function refresh() {
    const my = ++seq;
    const r = await whenRelayReady(2500, { installUrl });
    if (destroyed || my !== seq)
      return;
    if (!(r instanceof Relay)) {
      state = { kind: "not-installed", installUrl };
      return render();
    }
    relay2 = r;
    subscribe(r);
    const grant = sessionDisconnected ? null : await r.permissions().catch(() => null);
    if (destroyed || my !== seq)
      return;
    if (!grant) {
      state = { kind: "disconnected", relay: r };
      emitTransition(false);
      return render();
    }
    const [user, project] = await Promise.all([r.identity(), r.context.active().catch(() => null)]);
    if (destroyed || my !== seq)
      return;
    state = { kind: "connected", relay: r, user, project };
    emitTransition(true);
    render();
  }
  function emitTransition(connected) {
    if (connected === wasConnected)
      return;
    wasConnected = connected;
    if (connected && relay2)
      opts.onConnect?.(relay2);
    else if (!connected)
      opts.onDisconnect?.();
  }
  let subscribed = false;
  function subscribe(r) {
    if (subscribed)
      return;
    subscribed = true;
    r.on("permissionsChanged", () => {
      void refresh();
    });
    r.on("disconnect", () => {
      void refresh();
    });
  }
  async function doConnect() {
    if (!relay2)
      return;
    try {
      sessionDisconnected = false;
      await relay2.connect(opts.scope);
      await refresh();
    } catch {
    }
  }
  async function doPick() {
    if (!relay2)
      return;
    menuOpen = false;
    render();
    const project = await relay2.context.pick().catch(() => null);
    opts.onProjectChange?.(project);
    await refresh();
  }
  async function doDisconnect() {
    if (!relay2)
      return;
    menuOpen = false;
    sessionDisconnected = true;
    await relay2.disconnect().catch(() => {
    });
    await refresh();
  }
  function render() {
    if (destroyed)
      return;
    mount.textContent = "";
    if (state.kind === "booting")
      return;
    if (state.kind === "not-installed") {
      const b = el("button", "btn get");
      b.append(el("span", "glyph"), el("span", void 0, "Get Switchboard"), el("span", "arr", "\u2197"));
      b.onclick = () => window.open(state.kind === "not-installed" ? state.installUrl : installUrl, "_blank", "noopener");
      mount.append(b);
      return;
    }
    if (state.kind === "disconnected") {
      const b = el("button", "btn connect");
      b.append(el("span", "glyph"), el("span", void 0, "Connect Switchboard"));
      b.onclick = doConnect;
      mount.append(b);
      return;
    }
    const { user, project } = state;
    const rawName = user?.name?.trim();
    const collides = !!rawName && !!project?.name && rawName.toLowerCase() === project.name.toLowerCase();
    const name = !rawName || collides ? "there" : rawName;
    const wrap = el("div", "wrap");
    const chip = el("button", "chip");
    const av = el("div", "av");
    if (user?.avatar) {
      const img = el("img");
      img.src = user.avatar;
      img.alt = name;
      av.append(img);
    } else
      av.textContent = name.charAt(0).toUpperCase();
    const who = el("div", "who");
    who.append(el("div", "hi", `Hi ${name}`));
    who.append(el("div", "proj", project ? project.name : "No context lent"));
    chip.append(av, who, el("span", "caret", "\u25BE"));
    chip.onclick = (e) => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      render();
    };
    wrap.append(chip);
    if (menuOpen) {
      const menu = el("div", "menu");
      menu.append(el("div", "lbl", "Working on"));
      const row = el("button", "proj-row");
      row.append(el("span", void 0, project ? project.name : "Choose a context"));
      row.append(el("span", "go", project ? "Switch \u25B8" : "Choose \u25B8"));
      row.onclick = doPick;
      menu.append(row, el("div", "sep"));
      const dc = el("button", "item", "Disconnect this app");
      dc.onclick = doDisconnect;
      menu.append(dc);
      menu.append(el("div", "foot", "Connectors, budgets & activity live in the Switchboard toolbar panel."));
      wrap.append(menu);
    }
    mount.append(wrap);
  }
  render();
  void refresh();
  return {
    refresh: () => void refresh(),
    destroy: () => {
      destroyed = true;
      document.removeEventListener("click", onDocClick);
      host.remove();
    }
  };
}

// ../../packages/sdk/dist/index.js
var Relay = class {
  provider;
  constructor(provider) {
    this.provider = provider;
  }
  get version() {
    return this.provider.version;
  }
  capabilities() {
    return this.provider.request({ method: "claude_capabilities" });
  }
  connect(scope) {
    return this.provider.request({ method: "claude_connect", params: scope });
  }
  /** Drop this app's connection for the current page session. The grant persists (a later connect()
   *  won't reprompt) — this is "disconnect from this tab", not "revoke". Full revoke lives in the panel. */
  disconnect() {
    return this.provider.request({ method: "claude_disconnect" });
  }
  permissions() {
    return this.provider.request({ method: "claude_permissions" });
  }
  /** The paired user's public identity (name/avatar), or null if unavailable. Convenience over
   *  capabilities().user — what the connect chip greets with ("Hi Sameep"). */
  identity() {
    return this.capabilities().then((c) => c.user ?? null).catch(() => null);
  }
  /** Synthesize speech ON-DEVICE via a local model/engine (no cloud, no connector, no credits).
   *  Returns audio as a playable data: URL, or null if no local TTS is available.
   *
   *    const clip = await relay.speak("hey, it's Maya");
   *    if (clip) new Audio(clip.audio).play();
   */
  speak(text, opts) {
    return this.provider.request({ method: "claude_speak", params: { text, voice: opts?.voice } }).catch(() => null);
  }
  listTools() {
    return this.provider.request({ method: "claude_listTools" }).then((r) => r.tools);
  }
  callTool(name, args) {
    const call = { name, arguments: args };
    return this.provider.request({ method: "claude_callTool", params: call });
  }
  complete(params) {
    return this.provider.request({ method: "claude_complete", params });
  }
  /** Streamed completion as an async iterator of deltas. Ends after a `done`/`error` delta. */
  async *stream(params) {
    const { streamId } = await this.provider.request({ method: "claude_stream", params });
    const queue = [];
    let notify = null;
    let ended = false;
    const handler = (payload) => {
      const p = payload;
      if (p.streamId !== streamId)
        return;
      queue.push(p);
      if (p.type === "done" || p.type === "error")
        ended = true;
      notify?.();
    };
    this.provider.on("delta", handler);
    try {
      while (true) {
        if (queue.length === 0) {
          if (ended)
            break;
          await new Promise((r) => notify = r);
          notify = null;
          continue;
        }
        yield queue.shift();
      }
    } finally {
      this.provider.removeListener("delta", handler);
    }
  }
  on(event2, handler) {
    this.provider.on(event2, handler);
  }
  /**
   * Per-origin local storage — a private on-disk key/value store for this app, plus `bind` to point
   * it at a real folder the user picks. Values are opaque strings (store JSON). Isolated per origin;
   * reads are free, writes need the site not to be read-only, and `bind` prompts for the exact path.
   *
   *   await relay.storage.set("workspace", JSON.stringify(data));
   *   const raw = await relay.storage.get("workspace");
   *   await relay.storage.bind("~/Documents/Projects/brandbrain/.data"); // existing files appear as records
   */
  get storage() {
    const req = (params) => this.provider.request({ method: "claude_storage", params });
    return {
      get: (key) => req({ op: "get", key }).then((r) => r.value ?? null),
      set: (key, value) => req({ op: "set", key, value }).then(() => void 0),
      delete: (key) => req({ op: "delete", key }).then((r) => r.ok),
      list: () => req({ op: "list" }).then((r) => r.keys ?? []),
      info: () => req({ op: "info" }).then((r) => r.info),
      /** Point this app's store at a real folder (triggers a path-consent click). */
      bind: (path) => req({ op: "bind", path }).then((r) => r.info)
    };
  }
  /**
   * Shared, cross-app context — your portable brand knowledge. Publish a whole context; read the one
   * the user selected for this app; or open the picker. Selection happens in the side panel, so an
   * app only ever receives the context the user chose to lend it — never the whole library.
   *
   *   await relay.context.publish({ name: "Aamras", kind: "brand", data: brand });
   *   const active = await relay.context.active();   // the brand the user loaded for this app, or null
   */
  get context() {
    const req = (params) => this.provider.request({ method: "claude_context", params });
    return {
      publish: (context) => req({ op: "publish", context }).then((r) => r.id),
      list: () => req({ op: "list" }).then((r) => r.contexts ?? []),
      active: () => req({ op: "active" }).then((r) => r.context ?? null),
      pick: () => req({ op: "pick" }).then((r) => r.context ?? null)
    };
  }
};
var DEFAULT_INSTALL_URL = "https://thelastprompt.ai/switchboard/";
function getRelay(opts) {
  const provider = globalThis[PROVIDER_GLOBAL];
  if (provider?.isRelay)
    return new Relay(provider);
  return { installed: false, installUrl: opts?.installUrl ?? DEFAULT_INSTALL_URL };
}
function whenRelayReady(timeoutMs = 3e3, opts) {
  const now = getRelay(opts);
  if (now instanceof Relay)
    return Promise.resolve(now);
  return new Promise((resolve) => {
    const onInit = () => {
      cleanup();
      resolve(getRelay(opts));
    };
    const timer = setTimeout(() => {
      cleanup();
      resolve({ installed: false, installUrl: opts?.installUrl ?? DEFAULT_INSTALL_URL });
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener(`${PROVIDER_GLOBAL}#initialized`, onInit);
    }
    window.addEventListener(`${PROVIDER_GLOBAL}#initialized`, onInit);
  });
}

// src/aplus.js
var $ = (id) => document.getElementById(id);
var STORE_KEY = "aplus:v1";
var INSTALL_URL = "https://thelastprompt.ai/switchboard/";
var relay = null;
var notInstalled = false;
var stack = null;
var busy = false;
var runSeq = 0;
var lastTask = null;
var TONES = ["Premium minimal", "Ayurvedic heritage", "Clinical + evidence", "Playful DTC"];
var TONE_VOICE = {
  "Premium minimal": "restrained and confident \u2014 short sentences, zero hype words, no exclamation points, let the material speak",
  "Ayurvedic heritage": "warm and rooted \u2014 daily-ritual language, sensory detail, tradition treated with respect (never mystical woo)",
  "Clinical + evidence": "precise and mechanism-first \u2014 every claim earns its keep, name the how (copper ions, thermal mass, decibels), no fluff",
  "Playful DTC": "witty and conversational \u2014 first-person brand voice, one good joke per module max, still selling hard"
};
var SAMPLES = [
  {
    cat: "beauty",
    name: "Copper Tongue Cleaner \u2014 2 pack",
    tone: "Ayurvedic heritage",
    bullets: [
      "pure copper, naturally antimicrobial \u2014 the ayurveda thing that actually works",
      "flexible handle so you don't gag, comfy for everyone in the house (that's why the 2 pack)",
      "replaces the plastic scraper junk \u2014 lasts forever, ships in a little cotton pouch"
    ].join("\n")
  },
  {
    cat: "kitchen",
    name: "Cast Iron Tortilla Press \u2014 8 inch",
    tone: "Premium minimal",
    bullets: [
      "restaurant-heavy cast iron \u2014 one squeeze, a perfect 8-inch tortilla, no rolling pin drama",
      "comes pre-seasoned, wipes clean, lives on the counter looking great",
      "not just tortillas \u2014 dumplings, empanadas, roti. we throw in 100 parchment rounds"
    ].join("\n")
  },
  {
    cat: "gadget",
    name: "Pocket White Noise Machine \u2014 USB-C",
    tone: "Clinical + evidence",
    bullets: [
      "real fan inside, not a looped mp3 \u2014 actual non-repeating white noise",
      "hockey-puck small, lives in a carry-on side pocket, finally charges over USB-C",
      "remembers your last volume, 12 sounds, headphone jack for red-eyes"
    ].join("\n")
  }
];
var sampleIdx = 0;
var tone = SAMPLES[0].tone;
var GRADS = {
  "Premium minimal": "linear-gradient(118deg, #22262C, #3E444D 48%, #7E8791)",
  "Ayurvedic heritage": "linear-gradient(118deg, #6E3317, #A85C2E 48%, #DDA36C)",
  "Clinical + evidence": "linear-gradient(118deg, #0E3A5C, #2C6E9E 48%, #8FC1E3)",
  "Playful DTC": "linear-gradient(118deg, #B03A52, #E56E5B 48%, #F7B08C)"
};
var str = (v, fb = "") => typeof v === "string" && v.trim() ? v.trim() : fb;
var cellVal = (v) => {
  if (v === true || v === "true") return true;
  if (v === false || v === "false" || v == null) return false;
  const t = String(v).trim();
  return t ? t : false;
};
function event(t) {
  const d = document.createElement("div");
  d.className = "event";
  d.textContent = t;
  $("events").append(d);
}
function toast(t) {
  const el = $("toast");
  el.textContent = t;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1500);
}
async function copyText(t) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand("copy");
    } catch {
    }
    ta.remove();
  }
}
function save() {
  const data = { name: $("f-name").value, bullets: $("f-bullets").value, url: $("f-url").value, tone, sampleIdx, stack };
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
  } catch {
  }
}
function restore() {
  let d = null;
  try {
    d = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
  } catch {
  }
  if (d) {
    if (typeof d.name === "string") $("f-name").value = d.name;
    if (typeof d.bullets === "string") $("f-bullets").value = d.bullets;
    if (typeof d.url === "string") $("f-url").value = d.url;
    if (TONES.includes(d.tone)) tone = d.tone;
    if (Number.isInteger(d.sampleIdx) && SAMPLES[d.sampleIdx]) sampleIdx = d.sampleIdx;
    if (d.stack && typeof d.stack === "object") {
      try {
        stack = normalizeStack(d.stack);
        renderStack();
        $("preview").hidden = false;
      } catch {
        stack = null;
      }
    }
  }
  renderTones();
  sampleNote();
}
function renderTones() {
  const mount = $("tones");
  mount.textContent = "";
  const rec = SAMPLES[sampleIdx].tone;
  TONES.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tone" + (t === tone ? " on" : "");
    if (t === rec) {
      const s = document.createElement("span");
      s.className = "star";
      s.textContent = "\u2605";
      b.append(s);
      b.title = "recommended for this sample";
    }
    b.append(document.createTextNode(t));
    b.addEventListener("click", () => {
      tone = t;
      renderTones();
      save();
    });
    mount.append(b);
  });
}
function sampleNote() {
  $("sample-note").textContent = "sample " + (sampleIdx + 1) + "/" + SAMPLES.length + " \xB7 " + SAMPLES[sampleIdx].cat;
}
function loadSample(i) {
  sampleIdx = (i % SAMPLES.length + SAMPLES.length) % SAMPLES.length;
  const smp = SAMPLES[sampleIdx];
  $("f-name").value = smp.name;
  $("f-bullets").value = smp.bullets;
  $("f-url").value = "";
  tone = smp.tone;
  renderTones();
  sampleNote();
  save();
}
mountConnect($("chip-dock"), {
  scope: { reason: "write your Amazon A+ content", tools: ["WebFetch"], models: ["sonnet"] },
  installUrl: INSTALL_URL,
  onConnect: (r) => {
    relay = r;
    reflect();
  },
  onDisconnect: () => {
    relay = null;
    reflect();
  }
});
(async () => {
  const r = await whenRelayReady(2e3, { installUrl: INSTALL_URL });
  if (r && "connect" in r) {
    const grant = await r.permissions().catch(() => null);
    if (grant) relay = r;
  } else if (r && r.installed === false) {
    notInstalled = true;
  }
  reflect();
})();
var REGEN_IDS = ["rg-hero", "rg-features", "rg-comparison", "rg-brandstory", "rg-faqs", "rg-terms", "regen-all"];
function reflect() {
  const on = !!relay;
  $("go").disabled = !on || busy;
  REGEN_IDS.forEach((id) => {
    $(id).disabled = !on || busy || !stack;
  });
  $("copy-all").disabled = !stack;
  $("copy-terms").disabled = !stack;
  const hint = $("conn-hint");
  hint.textContent = "";
  if (on) {
    hint.textContent = "connected \u2014 writes on your Claude, the app never sees a key";
  } else if (notInstalled) {
    hint.append("needs the Switchboard sidekick \u2014 ");
    const a = document.createElement("a");
    a.href = INSTALL_URL;
    a.target = "_blank";
    a.rel = "noreferrer";
    a.textContent = "get it here";
    hint.append(a);
  } else {
    hint.textContent = "everything below works now \u2014 connect Switchboard (top right) to write the stack";
  }
}
var SHAPE = [
  "{",
  '"heroHeadline": string \u2014 the big banner line, <= 9 words, benefit-first, sentence case,',
  '"heroSub": string \u2014 one supporting sentence, <= 28 words,',
  '"features": exactly 4 of {"emoji": exactly one emoji, "title": 2-5 words, "body": 1-2 sentences (<= 30 words)},',
  '"comparison": {"ourName": short display name for THIS product, "otherName": the generic alternative buyers weigh it against, "rows": exactly 5 of {"feature": 2-6 words, "ours": true | false | short string (<= 3 words), "other": true | false | short string (<= 3 words)}},',
  '"brandStory": {"headline": 3-8 words, "body": 2-3 sentences in first-person-plural brand voice},',
  '"faqs": exactly 3 of {"q": a question real buyers actually ask, "a": 1-3 sentence honest answer},',
  '"searchTerms": 8 to 12 lowercase buyer search phrases, 2-4 words each, no punctuation, no duplicates, no brand names',
  "}"
].join("\n");
function productBrief() {
  const name = str($("f-name").value, "an unnamed product");
  const bullets = str($("f-bullets").value, "(no bullets given \u2014 infer sensible, honest claims from the product name)");
  return [
    "PRODUCT: " + name,
    "FOUNDER'S ROUGH BULLETS (raw notes \u2014 rewrite them properly, keep every real claim, invent nothing):\n" + bullets,
    "TONE: " + tone + " \u2014 " + (TONE_VOICE[tone] || "")
  ].join("\n\n");
}
function fetchStep() {
  let url = str($("f-url").value);
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  return "FIRST: use the WebFetch tool to read " + url + " and pull real details \u2014 materials, dimensions, claims, review language, brand voice. Fold what you learn into the copy; never invent specs the page does not support. Then write the JSON.";
}
function buildStackPrompt() {
  return [
    "You are a senior Amazon listing copywriter writing a complete A+ (Enhanced Brand Content) module stack.",
    fetchStep(),
    productBrief(),
    'Write tight, concrete, conversion-focused retail copy. Ban the words "elevate", "game-changer", "unleash" and empty superlatives. In comparison cells use true for a clear win (renders as a green check), false for a miss (gray dash), or a short string when a value reads better (e.g. "Pure copper" vs "Plastic").',
    "Respond with ONLY one JSON object \u2014 no prose, no markdown fences \u2014 shaped exactly:\n" + SHAPE
  ].filter(Boolean).join("\n\n");
}
function buildModulePrompt(key) {
  const m = MODULES[key];
  return [
    "You are a senior Amazon listing copywriter. You already wrote this A+ stack (JSON):",
    JSON.stringify(stack),
    productBrief(),
    "Rewrite ONLY the " + m.label + ": take a genuinely different angle than the current version \u2014 same product, same tone, same honesty.",
    "Respond with ONLY one JSON object \u2014 no prose, no markdown fences \u2014 shaped exactly:\n" + m.shape
  ].join("\n\n");
}
var normFeat = (f) => ({ emoji: str(f?.emoji, "\u2726"), title: str(f?.title, "Feature"), body: str(f?.body) });
var normRow = (r) => ({ feature: str(r?.feature, "\u2014"), ours: cellVal(r?.ours), other: cellVal(r?.other) });
var normFaq = (f) => ({ q: str(f?.q, "\u2014"), a: str(f?.a) });
function normalizeStack(d) {
  if (!d || !str(d.heroHeadline) || !Array.isArray(d.features) || !d.features.length || !d.comparison || !Array.isArray(d.comparison.rows) || !d.comparison.rows.length || !d.brandStory || !Array.isArray(d.faqs) || !d.faqs.length || !Array.isArray(d.searchTerms) || !d.searchTerms.length) {
    throw new Error("INCOMPLETE");
  }
  return {
    heroHeadline: str(d.heroHeadline),
    heroSub: str(d.heroSub),
    features: d.features.slice(0, 4).map(normFeat),
    comparison: {
      ourName: str(d.comparison.ourName, str($("f-name").value, "This one")),
      otherName: str(d.comparison.otherName, "The usual option"),
      rows: d.comparison.rows.slice(0, 6).map(normRow)
    },
    brandStory: { headline: str(d.brandStory.headline, "Our story"), body: str(d.brandStory.body) },
    faqs: d.faqs.slice(0, 4).map(normFaq),
    searchTerms: d.searchTerms.map((t) => str(String(t))).filter(Boolean).slice(0, 12)
  };
}
var MODULES = {
  hero: {
    btn: "rg-hero",
    mod: "mod-hero",
    label: "hero module (headline + subheadline)",
    line: "Rewriting the hero\u2026",
    shape: '{"heroHeadline": "<= 9 words, benefit-first, sentence case", "heroSub": "one supporting sentence, <= 28 words"}',
    patch(d) {
      if (!str(d.heroHeadline)) throw new Error("INCOMPLETE");
      stack.heroHeadline = str(d.heroHeadline);
      stack.heroSub = str(d.heroSub, stack.heroSub);
    }
  },
  features: {
    btn: "rg-features",
    mod: "mod-features",
    label: "four-feature grid",
    line: "Rewriting the feature grid\u2026",
    shape: '{"features": [exactly 4 of {"emoji": "exactly one emoji", "title": "2-5 words", "body": "1-2 sentences, <= 30 words"}]}',
    patch(d) {
      if (!Array.isArray(d.features) || !d.features.length) throw new Error("INCOMPLETE");
      stack.features = d.features.slice(0, 4).map(normFeat);
    }
  },
  comparison: {
    btn: "rg-comparison",
    mod: "mod-comparison",
    label: "comparison chart",
    line: "Rebuilding the comparison chart\u2026",
    shape: '{"comparison": {"ourName": "short display name for THIS product", "otherName": "the generic alternative", "rows": [exactly 5 of {"feature": "2-6 words", "ours": true | false | "short string", "other": true | false | "short string"}]}}',
    patch(d) {
      const c = d.comparison;
      if (!c || !Array.isArray(c.rows) || !c.rows.length) throw new Error("INCOMPLETE");
      stack.comparison = {
        ourName: str(c.ourName, stack.comparison.ourName),
        otherName: str(c.otherName, stack.comparison.otherName),
        rows: c.rows.slice(0, 6).map(normRow)
      };
    }
  },
  brandStory: {
    btn: "rg-brandstory",
    mod: "mod-brandstory",
    label: "brand story band",
    line: "Redrafting the brand story\u2026",
    shape: '{"brandStory": {"headline": "3-8 words", "body": "2-3 sentences, first-person-plural brand voice"}}',
    patch(d) {
      const b = d.brandStory;
      if (!b || !str(b.headline) && !str(b.body)) throw new Error("INCOMPLETE");
      stack.brandStory = { headline: str(b.headline, stack.brandStory.headline), body: str(b.body, stack.brandStory.body) };
    }
  },
  faqs: {
    btn: "rg-faqs",
    mod: "mod-faqs",
    label: "FAQ module (3 questions)",
    line: "Re-answering the FAQs\u2026",
    shape: '{"faqs": [exactly 3 of {"q": "a question real buyers actually ask", "a": "1-3 sentence honest answer"}]}',
    patch(d) {
      if (!Array.isArray(d.faqs) || !d.faqs.length) throw new Error("INCOMPLETE");
      stack.faqs = d.faqs.slice(0, 4).map(normFaq);
    }
  },
  searchTerms: {
    btn: "rg-terms",
    mod: "terms-sec",
    label: "backend search terms (give a fresh set, avoid repeating the current ones)",
    line: "Mining a fresh set of search terms\u2026",
    shape: '{"searchTerms": [8 to 12 lowercase buyer search phrases, 2-4 words each, no punctuation, no duplicates, no brand names]}',
    patch(d) {
      if (!Array.isArray(d.searchTerms) || !d.searchTerms.length) throw new Error("INCOMPLETE");
      stack.searchTerms = d.searchTerms.map((t) => str(String(t))).filter(Boolean).slice(0, 12);
    }
  }
};
var GEN_LINES = [
  "Reading the brief\u2026",
  "Writing the hero\u2026",
  "Filling the feature grid\u2026",
  "Building the comparison chart\u2026",
  "Drafting the brand story\u2026",
  "Answering buyer questions\u2026",
  "Mining backend search terms\u2026"
];
var lineTimer = null;
function startLines(lines) {
  const arr = Array.isArray(lines) ? lines : [lines];
  let i = 0;
  $("status-line").textContent = arr[0];
  clearInterval(lineTimer);
  if (arr.length > 1) lineTimer = setInterval(() => {
    i = (i + 1) % arr.length;
    $("status-line").textContent = arr[i];
  }, 2400);
}
function setBusy(on, lines) {
  busy = on;
  $("statusbox").hidden = !on;
  if (on) {
    $("errbox").hidden = true;
    $("events").textContent = "";
    $("status-meta").textContent = "0.0 kb written";
    startLines(lines || GEN_LINES);
  } else {
    clearInterval(lineTimer);
  }
  reflect();
}
async function streamJSON(prompt, my) {
  let text = "";
  for await (const d of relay.stream({ prompt, agentic: true })) {
    if (my !== runSeq) return null;
    if (d.type === "text") {
      text += d.text;
      $("status-meta").textContent = (text.length / 1024).toFixed(1) + " kb written";
    } else if (d.type === "tool_proposed") {
      if (d.call?.name === "WebFetch") event("\u2192 reading your product page (WebFetch, read-only)\u2026");
      else event("\u2192 tool proposed: " + (d.call?.name || "?"));
    } else if (d.type === "tool_result") {
      if (d.result?.ok) {
        if (d.call?.name === "WebFetch") event("\u2713 page read \u2014 folding it into the copy");
      } else {
        event("\u26A0 " + (d.call?.name || "tool") + " failed: " + (d.result?.error?.message || "unknown") + " \u2014 continuing from your bullets");
      }
    } else if (d.type === "error") {
      throw Object.assign(new Error(d.error?.message || "stream error"), { code: d.error?.code });
    }
  }
  if (my !== runSeq) return null;
  const m = text.replace(/```(?:json)?/gi, "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("PARSE");
  try {
    return JSON.parse(m[0]);
  } catch {
    throw new Error("PARSE");
  }
}
async function generateStack() {
  if (!relay || busy) return;
  lastTask = generateStack;
  const my = ++runSeq;
  setBusy(true, GEN_LINES);
  try {
    const data = await streamJSON(buildStackPrompt(), my);
    if (!data || my !== runSeq) return;
    stack = normalizeStack(data);
    save();
    renderStack();
    $("preview").hidden = false;
    $("preview").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    if (my === runSeq) showError(err);
  } finally {
    if (my === runSeq) setBusy(false);
  }
}
async function regenModule(key) {
  if (!relay || busy || !stack) return;
  lastTask = () => regenModule(key);
  const m = MODULES[key];
  const my = ++runSeq;
  setBusy(true, m.line);
  $(m.mod).classList.add("rewriting");
  try {
    const data = await streamJSON(buildModulePrompt(key), my);
    if (!data || my !== runSeq) return;
    m.patch(data);
    save();
    renderStack();
  } catch (err) {
    if (my === runSeq) showError(err);
  } finally {
    $(m.mod).classList.remove("rewriting");
    if (my === runSeq) setBusy(false);
  }
}
function showError(err) {
  const box = $("errbox");
  box.hidden = false;
  const msg = String(err?.message || err);
  const code = err?.code;
  let head, body;
  if (code === 4001) {
    head = "Not connected.";
    body = "Approve the connect in the Switchboard chip (top right), then try again.";
  } else if (code === 4290) {
    head = "Budget cap reached.";
    body = "This app hit the daily token budget you granted it. Raise it in the Switchboard panel, or come back tomorrow.";
  } else if (code === 4900) {
    head = "Your Claude is unreachable.";
    body = "Start the Switchboard daemon, then hit Try again.";
  } else if (code === 4100) {
    head = "Not connected yet.";
    body = "Click the chip (top right) and approve the connect.";
  } else if (msg === "PARSE") {
    head = "That reply wasn't clean JSON.";
    body = "It happens \u2014 models drift. Hit Try again; the second pass almost always lands.";
  } else if (msg === "INCOMPLETE") {
    head = "The stack came back missing pieces.";
    body = "Hit Try again for a full pass.";
  } else {
    head = "Generation failed.";
    body = msg.slice(0, 240);
  }
  const p = $("err-text");
  p.textContent = "";
  const b = document.createElement("b");
  b.textContent = head;
  p.append(b, " " + body);
}
function cellNode(v) {
  const sp = document.createElement("span");
  if (v === true) {
    sp.className = "ck";
    sp.textContent = "\u2713";
  } else if (v === false) {
    sp.className = "dash";
    sp.textContent = "\u2014";
  } else sp.textContent = String(v);
  return sp;
}
function renderComparison() {
  const wrap = $("cmp-wrap");
  wrap.textContent = "";
  const c = stack.comparison;
  const tbl = document.createElement("table");
  tbl.className = "cmp";
  const thead = document.createElement("thead");
  const hr = document.createElement("tr");
  const h0 = document.createElement("th");
  h0.className = "f";
  const h1 = document.createElement("th");
  h1.className = "ours";
  h1.textContent = c.ourName;
  const h2 = document.createElement("th");
  h2.textContent = c.otherName;
  hr.append(h0, h1, h2);
  thead.append(hr);
  const tb = document.createElement("tbody");
  c.rows.forEach((r) => {
    const tr = document.createElement("tr");
    const tdf = document.createElement("td");
    tdf.className = "f";
    tdf.textContent = r.feature;
    const td1 = document.createElement("td");
    td1.className = "ours";
    td1.append(cellNode(r.ours));
    const td2 = document.createElement("td");
    td2.append(cellNode(r.other));
    tr.append(tdf, td1, td2);
    tb.append(tr);
  });
  tbl.append(thead, tb);
  wrap.append(tbl);
}
function renderStack() {
  if (!stack) return;
  $("hero-banner").style.background = GRADS[tone] || GRADS["Ayurvedic heritage"];
  $("hero-headline").textContent = stack.heroHeadline;
  $("hero-sub").textContent = stack.heroSub;
  $("hero-sub").hidden = !stack.heroSub;
  const fg = $("feat-grid");
  fg.textContent = "";
  stack.features.forEach((f) => {
    const el = document.createElement("div");
    el.className = "feat";
    const ic = document.createElement("div");
    ic.className = "ic";
    ic.textContent = f.emoji;
    const h = document.createElement("h4");
    h.textContent = f.title;
    const p = document.createElement("p");
    p.textContent = f.body;
    el.append(ic, h, p);
    fg.append(el);
  });
  renderComparison();
  $("bs-headline").textContent = stack.brandStory.headline;
  $("bs-body").textContent = stack.brandStory.body;
  const fl = $("faq-list");
  fl.textContent = "";
  stack.faqs.forEach((f) => {
    const row = document.createElement("div");
    row.className = "faq-row";
    const q = document.createElement("div");
    q.className = "faq-q";
    const qm = document.createElement("span");
    qm.className = "qm";
    qm.textContent = "Q";
    const qt = document.createElement("span");
    qt.textContent = f.q;
    q.append(qm, qt);
    const a = document.createElement("p");
    a.className = "faq-a";
    a.textContent = f.a;
    row.append(q, a);
    fl.append(row);
  });
  const tw = $("terms");
  tw.textContent = "";
  stack.searchTerms.forEach((t) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "term";
    b.textContent = t;
    b.addEventListener("click", async () => {
      await copyText(t);
      b.classList.add("copied");
      toast("Copied \u201C" + t + "\u201D");
      setTimeout(() => b.classList.remove("copied"), 1200);
    });
    tw.append(b);
  });
}
function stackText() {
  if (!stack) return "";
  const cellTxt = (v) => v === true ? "\u2713" : v === false ? "\u2014" : String(v);
  const L = [];
  L.push("A+ CONTENT \u2014 " + str($("f-name").value, "product"));
  L.push("tone: " + tone, "");
  L.push("== HERO (standard image header with text) ==", stack.heroHeadline);
  if (stack.heroSub) L.push(stack.heroSub);
  L.push("", "== FOUR-FEATURE GRID (standard four image & text) ==");
  stack.features.forEach((f, i) => {
    L.push(i + 1 + ") " + f.title, f.body, "");
  });
  L.push("== COMPARISON CHART \u2014 " + stack.comparison.ourName + " vs " + stack.comparison.otherName + " ==");
  stack.comparison.rows.forEach((r) => {
    L.push(r.feature + ": " + stack.comparison.ourName + " " + cellTxt(r.ours) + " \xB7 " + stack.comparison.otherName + " " + cellTxt(r.other));
  });
  L.push("", "== BRAND STORY ==", stack.brandStory.headline, stack.brandStory.body, "");
  L.push("== FAQ ==");
  stack.faqs.forEach((f) => {
    L.push("Q: " + f.q, "A: " + f.a, "");
  });
  L.push("== BACKEND SEARCH TERMS (paste into Seller Central) ==", stack.searchTerms.join(" "));
  return L.join("\n");
}
$("go").addEventListener("click", generateStack);
$("regen-all").addEventListener("click", generateStack);
$("sample-btn").addEventListener("click", () => loadSample(sampleIdx + 1));
$("cancel").addEventListener("click", () => {
  runSeq++;
  setBusy(false);
});
$("retry").addEventListener("click", () => {
  $("errbox").hidden = true;
  lastTask?.();
});
$("copy-all").addEventListener("click", async () => {
  if (!stack) return;
  await copyText(stackText());
  toast("Copied the whole stack \u2014 paste into Seller Central");
});
$("copy-terms").addEventListener("click", async () => {
  if (!stack) return;
  await copyText(stack.searchTerms.join(" "));
  toast("Copied " + stack.searchTerms.length + " terms, space-separated");
});
for (const [key, m] of Object.entries(MODULES)) {
  $(m.btn).addEventListener("click", () => regenModule(key));
}
["f-name", "f-bullets", "f-url"].forEach((id) => $(id).addEventListener("input", save));
restore();
reflect();
//# sourceMappingURL=aplus.js.map
