/**
 * Conversations — portraits des PNJ
 * Le Gardien choisit les participants d'une conversation ; leurs portraits s'affichent chez toute la table,
 * et celui qui parle est mis en avant (au clic, au clavier, ou automatiquement quand il parle dans le chat).
 * Inspiré de ConversationHUD (Saervicus), réécrit pour Foundry v13 / v14.
 * magisterphamtom — MIT
 */

const ID = "conversations-pnj";
const MAX_KEYS = 9;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => foundry.utils.randomID(8);
const active = (id) => !!game.modules.get(id)?.active;
const clone = (o) => foundry.utils.deepClone(o);

/* ================================================================== */
/*  État partagé (réglage monde : chaque client est prévenu)           */
/* ================================================================== */

const EMPTY = { active: false, title: "", era: "auto", speaker: null, participants: [] };

function getState() {
  const s = game.settings.get(ID, "state");
  return { ...clone(EMPTY), ...(s ?? {}), participants: Array.isArray(s?.participants) ? clone(s.participants) : [] };
}

async function setState(patch) {
  if (!game.user.isGM) return;
  const next = { ...getState(), ...patch };
  await game.settings.set(ID, "state", next);
  return next;
}

/** Le thème : choix de la conversation, sinon époque de la Bascule, sinon réglage par défaut. */
function eraOf(state) {
  if (state.era === "1933" || state.era === "modern") return state.era;
  if (active("coc7-bascule-epoque")) {
    const e = game.settings.get("coc7-bascule-epoque", "currentEra");
    if (e === "1933" || e === "modern") return e;
  }
  return game.settings.get(ID, "defaultEra");
}

/* ================================================================== */
/*  Réglages et raccourcis                                             */
/* ================================================================== */

Hooks.once("init", () => {
  game.settings.register(ID, "state", {
    scope: "world", config: false, type: Object, default: clone(EMPTY),
    onChange: () => { Stage.render(); ManagerApp.instance?.render(); }
  });
  game.settings.register(ID, "presets", {
    scope: "world", config: false, type: Array, default: [],
    onChange: () => ManagerApp.instance?.render()
  });
  game.settings.register(ID, "defaultEra", {
    name: "Thème par défaut",
    hint: "Utilisé quand la conversation est en « automatique » et que le module Bascule d'époque n'est pas actif.",
    scope: "world", config: true, type: String,
    choices: { "1933": "Années 30 (Art Déco noir et or)", modern: "Moderne (écran polaire)" },
    default: "1933", onChange: () => Stage.render()
  });
  game.settings.register(ID, "autoSpeaker", {
    name: "Orateur automatique",
    hint: "Quand un message du chat est envoyé au nom d'un participant, il devient l'orateur.",
    scope: "world", config: true, type: Boolean, default: true
  });
  game.settings.register(ID, "position", {
    name: "Position des portraits",
    hint: "Pour vous seulement.",
    scope: "client", config: true, type: String,
    choices: { top: "En haut de l'écran", bottom: "En bas de l'écran", free: "Libre (fenêtre à déplacer où vous voulez)" },
    default: "top", onChange: () => Stage.render()
  });
  game.settings.register(ID, "size", {
    name: "Taille des portraits",
    hint: "Pour vous seulement.",
    scope: "client", config: true, type: Number,
    range: { min: 70, max: 200, step: 10 }, default: 120, onChange: () => Stage.render()
  });
  game.settings.register(ID, "collapsed", { scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(ID, "freePos", { scope: "client", config: false, type: Object, default: { left: null, top: null } });

  // Raccourcis : Maj + pavé numérique 1-9 = orateur, Maj + 0 = personne
  for (let i = 1; i <= MAX_KEYS; i++) {
    game.keybindings.register(ID, `speaker${i}`, {
      name: `Conversation : participant ${i} prend la parole`,
      editable: [{ key: `Numpad${i}`, modifiers: ["Shift"] }],
      restricted: true,
      onDown: () => { setSpeakerByIndex(i - 1); return true; }
    });
  }
  game.keybindings.register(ID, "speakerNone", {
    name: "Conversation : personne ne parle",
    editable: [{ key: "Numpad0", modifiers: ["Shift"] }],
    restricted: true,
    onDown: () => { setSpeaker(null); return true; }
  });
  game.keybindings.register(ID, "toggleManager", {
    name: "Conversation : ouvrir / fermer la fenêtre du Gardien",
    editable: [{ key: "NumpadDecimal", modifiers: ["Shift"] }],
    restricted: true,
    onDown: () => { ManagerApp.toggle(); return true; }
  });
});

Hooks.once("ready", () => {
  Stage.render();
  window.addEventListener("resize", foundry.utils.debounce(() => Stage.clamp(), 200));
  const mod = game.modules.get(ID);
  if (mod) mod.api = { open: () => ManagerApp.toggle(), start, stop, setSpeaker, addActors, state: getState };
});

/* ================================================================== */
/*  Actions                                                            */
/* ================================================================== */

function participantFrom(doc) {
  const actor = doc?.actor ?? (doc instanceof Actor ? doc : null);
  const token = doc?.document ?? (doc instanceof TokenDocument ? doc : null);
  const src = actor ?? token;
  if (!src) return null;
  return {
    id: uid(),
    actorUuid: actor?.uuid ?? null,
    actorId: actor?.id ?? null,
    name: token?.name ?? actor?.name ?? "?",
    img: actor?.img && !actor.img.includes("mystery-man") ? actor.img : (token?.texture?.src ?? actor?.img ?? "icons/svg/mystery-man.svg"),
    subtitle: "",
    hidden: false,
    unknown: false
  };
}

async function addActors(docs) {
  const state = getState();
  const known = new Set(state.participants.map((p) => p.actorUuid).filter(Boolean));
  let added = 0;
  for (const d of docs) {
    const p = participantFrom(d);
    if (!p || (p.actorUuid && known.has(p.actorUuid))) continue;
    state.participants.push(p);
    if (p.actorUuid) known.add(p.actorUuid);
    added++;
  }
  if (added) await setState({ participants: state.participants });
  return added;
}

async function setSpeaker(id) {
  const state = getState();
  if (!game.user.isGM || !state.active) return;
  if (id && !state.participants.some((p) => p.id === id)) return;
  await setState({ speaker: state.speaker === id ? null : id });
}

function setSpeakerByIndex(i) {
  const visible = getState().participants;
  if (visible[i]) setSpeaker(visible[i].id);
}

async function start() {
  const state = getState();
  if (!state.participants.length) return ui.notifications.warn("Ajoutez au moins un participant à la conversation.");
  await setState({ active: true, speaker: null });
  if (game.settings.get(ID, "collapsed")) await game.settings.set(ID, "collapsed", false);
}

async function stop() {
  await setState({ active: false, speaker: null });
}

/* Orateur automatique quand un participant parle dans le chat */
Hooks.on("createChatMessage", (msg) => {
  try {
    if (!game.users.activeGM?.isSelf) return;
    if (!game.settings.get(ID, "autoSpeaker")) return;
    const state = getState();
    if (!state.active) return;
    const actorId = msg.speaker?.actor;
    const alias = msg.speaker?.alias;
    const p = state.participants.find((x) => (actorId && x.actorId === actorId) || (!actorId && alias && x.name === alias));
    if (p && state.speaker !== p.id) setState({ speaker: p.id });
  } catch (err) {
    console.error(`${ID} | orateur automatique`, err);
  }
});

/* ================================================================== */
/*  Scène : les portraits chez tout le monde                           */
/* ================================================================== */

const Stage = {
  el: null,

  render() {
    if (!game.ready) return;
    const state = getState();
    const isGM = game.user.isGM;
    const list = state.participants.filter((p) => isGM || !p.hidden);

    if (!state.active || !list.length) return this.remove();

    const era = eraOf(state);
    const pos = game.settings.get(ID, "position");
    const size = game.settings.get(ID, "size");
    const collapsed = game.settings.get(ID, "collapsed");

    if (!this.el) {
      this.el = document.createElement("section");
      this.el.id = "cnv-stage";
      this.el.addEventListener("click", (ev) => this.onClick(ev));
      this.el.addEventListener("pointerdown", (ev) => { if (ev.target.closest(".cnv-head")) this.startDrag(ev); });
      document.body.append(this.el);
      requestAnimationFrame(() => this.el?.classList.add("cnv-in"));
    }
    const prevSpeaker = this.el.dataset.speaker ?? "";
    this.el.className = `cnv-stage cnv-era-${era} cnv-pos-${pos}${collapsed ? " cnv-collapsed" : ""}${isGM ? " cnv-gm" : ""} cnv-in`;
    this.el.style.setProperty("--cnv-size", `${size}px`);
    if (pos === "free") {
      const fp = game.settings.get(ID, "freePos") ?? {};
      this.el.style.left = `${Number.isFinite(fp.left) ? fp.left : Math.round(window.innerWidth / 2 - 200)}px`;
      this.el.style.top = `${Number.isFinite(fp.top) ? fp.top : 80}px`;
    } else {
      this.el.style.left = "";
      this.el.style.top = "";
    }
    this.el.dataset.speaker = state.speaker ?? "";

    const figs = list.map((p, i) => {
      const speaking = p.id === state.speaker;
      const name = p.unknown ? (isGM ? `${esc(p.name)} <i class="fa-solid fa-mask" title="Nom masqué aux joueurs"></i>` : "???") : esc(p.name);
      const key = isGM && i < MAX_KEYS ? `<span class="cnv-key" title="Maj + pavé numérique ${i + 1}">${i + 1}</span>` : "";
      return `<figure class="cnv-p${speaking ? " cnv-speaking" : ""}${state.speaker && !speaking ? " cnv-listening" : ""}${p.hidden ? " cnv-hidden" : ""}${speaking && prevSpeaker !== p.id ? " cnv-new-speaker" : ""}"
        data-id="${p.id}" style="--i:${i}" ${isGM ? `data-tooltip="Cliquer pour donner la parole"` : ""}>
        ${key}
        <div class="cnv-frame"><img src="${esc(p.img)}" alt="" draggable="false"></div>
        <figcaption><span class="cnv-name">${name}</span>${p.subtitle && !p.unknown ? `<span class="cnv-sub">${esc(p.subtitle)}</span>` : ""}</figcaption>
        ${p.hidden ? `<span class="cnv-hidden-tag" title="Invisible pour les joueurs"><i class="fa-solid fa-eye-slash"></i></span>` : ""}
      </figure>`;
    }).join("");

    this.el.innerHTML = `
      <header class="cnv-head">
        ${state.title ? `<span class="cnv-title">${esc(state.title)}</span>` : ""}
        <button type="button" class="cnv-btn" data-cnv="smaller" data-tooltip="Portraits plus petits"><i class="fa-solid fa-minus"></i></button>
        <button type="button" class="cnv-btn" data-cnv="bigger" data-tooltip="Portraits plus grands"><i class="fa-solid fa-plus"></i></button>
        <button type="button" class="cnv-btn${pos === "free" ? " cnv-on" : ""}" data-cnv="free" data-tooltip="${pos === "free" ? "Revenir en bande fixe" : "Mode libre : déplacer où vous voulez"}"><i class="fa-solid fa-up-down-left-right"></i></button>
        <button type="button" class="cnv-btn" data-cnv="collapse" data-tooltip="${collapsed ? "Afficher" : "Réduire"}"><i class="fa-solid ${collapsed ? "fa-chevron-down" : "fa-chevron-up"}"></i></button>
        ${isGM ? `<button type="button" class="cnv-btn" data-cnv="manage" data-tooltip="Fenêtre du Gardien"><i class="fa-solid fa-users-gear"></i></button>
        <button type="button" class="cnv-btn" data-cnv="stop" data-tooltip="Terminer la conversation"><i class="fa-solid fa-xmark"></i></button>` : ""}
      </header>
      <div class="cnv-row">${figs}</div>`;
    if (pos === "free") requestAnimationFrame(() => this.clamp());
  },

  /** Garde la fenêtre libre à l'écran (changement de taille de fenêtre, portraits plus grands…) */
  clamp() {
    const el = this.el;
    if (!el || !el.classList.contains("cnv-pos-free")) return;
    const r = el.getBoundingClientRect();
    const left = Math.min(Math.max(0, r.left), Math.max(0, window.innerWidth - r.width));
    const top = Math.min(Math.max(0, r.top), Math.max(0, window.innerHeight - 40));
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  },

  /** Déplacement à la souris par le titre, en mode libre */
  startDrag(ev) {
    const el = this.el;
    if (!el || !el.classList.contains("cnv-pos-free") || ev.button !== 0) return;
    if (ev.target.closest("[data-cnv]")) return;
    ev.preventDefault();
    const r = el.getBoundingClientRect();
    const dx = ev.clientX - r.left;
    const dy = ev.clientY - r.top;
    el.classList.add("cnv-dragging");
    const move = (e) => {
      el.style.left = `${Math.round(Math.min(Math.max(0, e.clientX - dx), window.innerWidth - 60))}px`;
      el.style.top = `${Math.round(Math.min(Math.max(0, e.clientY - dy), window.innerHeight - 30))}px`;
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.classList.remove("cnv-dragging");
      await game.settings.set(ID, "freePos", { left: parseInt(el.style.left), top: parseInt(el.style.top) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  },

  remove() {
    if (!this.el) return;
    const el = this.el;
    this.el = null;
    el.classList.remove("cnv-in");
    el.classList.add("cnv-out");
    setTimeout(() => el.remove(), 450);
  },

  async onClick(ev) {
    const btn = ev.target.closest("[data-cnv]");
    if (btn) {
      const a = btn.dataset.cnv;
      if (a === "collapse") { await game.settings.set(ID, "collapsed", !game.settings.get(ID, "collapsed")); return this.render(); }
      if (a === "smaller" || a === "bigger") {
        const cur = game.settings.get(ID, "size");
        const next = Math.min(200, Math.max(70, cur + (a === "bigger" ? 10 : -10)));
        if (next !== cur) await game.settings.set(ID, "size", next);
        return;
      }
      if (a === "free") {
        const pos = game.settings.get(ID, "position");
        if (pos !== "free") {
          // on part de l'endroit où se trouve la bande
          const r = this.el.getBoundingClientRect();
          await game.settings.set(ID, "freePos", { left: Math.round(r.left), top: Math.round(r.top) });
        }
        await game.settings.set(ID, "position", pos === "free" ? "top" : "free");
        return;
      }
      if (a === "manage") return ManagerApp.toggle();
      if (a === "stop") return stop();
      return;
    }
    if (!game.user.isGM) return;
    const fig = ev.target.closest("figure.cnv-p");
    if (fig) setSpeaker(fig.dataset.id);
  }
};

/* ================================================================== */
/*  Fenêtre du Gardien                                                 */
/* ================================================================== */

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

class ManagerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static instance = null;

  static DEFAULT_OPTIONS = {
    id: "conversations-pnj-manager",
    tag: "div",
    classes: ["cnv-manager"],
    window: { title: "Conversation", icon: "fa-solid fa-comments", resizable: true },
    position: { width: 520, height: 640 },
    actions: {
      start: ManagerApp.#start,
      stop: ManagerApp.#stop,
      addSelected: ManagerApp.#addSelected,
      remove: ManagerApp.#remove,
      up: ManagerApp.#up,
      down: ManagerApp.#down,
      toggleHidden: ManagerApp.#toggleHidden,
      toggleUnknown: ManagerApp.#toggleUnknown,
      speak: ManagerApp.#speak,
      pickImage: ManagerApp.#pickImage,
      clear: ManagerApp.#clear,
      savePreset: ManagerApp.#savePreset,
      loadPreset: ManagerApp.#loadPreset,
      deletePreset: ManagerApp.#deletePreset
    }
  };

  static PARTS = { main: { template: `modules/${ID}/templates/manager.hbs`, scrollable: [".cnv-list"] } };

  static toggle() {
    if (!game.user.isGM) return;
    if (this.instance?.rendered) return this.instance.close();
    this.instance = new ManagerApp();
    this.instance.render({ force: true });
  }

  async _prepareContext() {
    const state = getState();
    const era = eraOf(state);
    return {
      state,
      eraLabel: era === "modern" ? "moderne" : "années 30",
      eras: [
        { id: "auto", label: "Automatique (époque de la Bascule)", selected: state.era === "auto" },
        { id: "1933", label: "Années 30 (Art Déco)", selected: state.era === "1933" },
        { id: "modern", label: "Moderne (écran polaire)", selected: state.era === "modern" }
      ],
      participants: state.participants.map((p, i) => ({ ...p, index: i + 1, speaking: p.id === state.speaker, first: i === 0, last: i === state.participants.length - 1 })),
      presets: game.settings.get(ID, "presets") ?? [],
      hasPresets: (game.settings.get(ID, "presets") ?? []).length > 0
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;

    // Dépôt d'acteurs / jetons depuis la barre latérale ou le canevas
    const zone = root.querySelector(".cnv-drop");
    zone?.addEventListener("dragover", (ev) => { ev.preventDefault(); zone.classList.add("cnv-over"); });
    zone?.addEventListener("dragleave", () => zone.classList.remove("cnv-over"));
    zone?.addEventListener("drop", async (ev) => {
      ev.preventDefault();
      zone.classList.remove("cnv-over");
      try {
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(ev);
        const docs = [];
        if (data?.type === "Actor" || data?.type === "Token") docs.push(await fromUuid(data.uuid));
        else if (data?.type === "Folder") {
          const folder = await fromUuid(data.uuid);
          if (folder?.type === "Actor") docs.push(...folder.contents);
        }
        const n = await addActors(docs.filter(Boolean));
        if (!n) ui.notifications.info("Rien de nouveau à ajouter (acteur déjà présent ou type non pris en charge).");
      } catch (err) {
        console.error(`${ID} | dépôt`, err);
        ui.notifications.error("Conversation : impossible d'ajouter cet élément.");
      }
    });

    // Champs texte : enregistrés en quittant le champ
    root.querySelectorAll("[data-field]").forEach((input) => {
      input.addEventListener("change", async () => {
        const state = getState();
        const field = input.dataset.field;
        if (field === "title") return setState({ title: input.value.trim() });
        if (field === "era") return setState({ era: input.value });
        const p = state.participants.find((x) => x.id === input.closest("[data-id]")?.dataset.id);
        if (!p) return;
        p[field] = input.value.trim();
        await setState({ participants: state.participants });
      });
    });
  }

  /* ---- actions ---- */
  static #start() { return start(); }
  static #stop() { return stop(); }

  static async #addSelected() {
    const tokens = canvas.tokens?.controlled ?? [];
    if (!tokens.length) return ui.notifications.warn("Sélectionnez d'abord des jetons sur la scène.");
    const n = await addActors(tokens);
    ui.notifications.info(`${n} participant(s) ajouté(s).`);
  }

  static async #edit(target, fn) {
    const state = getState();
    const id = target.closest("[data-id]")?.dataset.id;
    const i = state.participants.findIndex((p) => p.id === id);
    if (i < 0) return;
    const patch = fn(state, i) ?? {};
    await setState({ participants: state.participants, ...patch });
  }

  static #remove(ev, t) {
    return ManagerApp.#edit(t, (s, i) => {
      const [p] = s.participants.splice(i, 1);
      return s.speaker === p.id ? { speaker: null } : {};
    });
  }
  static #up(ev, t) { return ManagerApp.#edit(t, (s, i) => { if (i > 0) [s.participants[i - 1], s.participants[i]] = [s.participants[i], s.participants[i - 1]]; }); }
  static #down(ev, t) { return ManagerApp.#edit(t, (s, i) => { if (i < s.participants.length - 1) [s.participants[i + 1], s.participants[i]] = [s.participants[i], s.participants[i + 1]]; }); }
  static #toggleHidden(ev, t) { return ManagerApp.#edit(t, (s, i) => { s.participants[i].hidden = !s.participants[i].hidden; }); }
  static #toggleUnknown(ev, t) { return ManagerApp.#edit(t, (s, i) => { s.participants[i].unknown = !s.participants[i].unknown; }); }
  static #speak(ev, t) { return setSpeaker(t.closest("[data-id]")?.dataset.id); }

  static async #pickImage(ev, t) {
    const id = t.closest("[data-id]")?.dataset.id;
    const current = getState().participants.find((p) => p.id === id)?.img;
    const FP = foundry.applications.apps.FilePicker.implementation;
    new FP({
      type: "image",
      current,
      callback: async (path) => {
        const state = getState();
        const p = state.participants.find((x) => x.id === id);
        if (!p) return;
        p.img = path;
        await setState({ participants: state.participants });
      }
    }).render(true);
  }

  static async #clear() {
    const ok = await DialogV2.confirm({
      window: { title: "Vider la conversation" },
      content: "<p>Retirer tous les participants ?</p>",
      rejectClose: false
    });
    if (ok) await setState({ participants: [], speaker: null, active: false });
  }

  static async #savePreset() {
    const state = getState();
    if (!state.participants.length) return ui.notifications.warn("La conversation est vide.");
    const name = await DialogV2.prompt({
      window: { title: "Enregistrer la conversation" },
      content: `<div class="form-group"><label>Nom</label><div class="form-fields"><input type="text" name="name" value="${esc(state.title || "Conversation")}" autofocus></div></div>`,
      ok: { label: "Enregistrer", callback: (e, b) => b.form.elements.name.value.trim() },
      rejectClose: false
    });
    if (!name) return;
    const presets = (game.settings.get(ID, "presets") ?? []).filter((p) => p.name !== name);
    presets.push({ id: uid(), name, title: state.title, era: state.era, participants: clone(state.participants) });
    presets.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    await game.settings.set(ID, "presets", presets);
    ui.notifications.info(`Conversation « ${name} » enregistrée.`);
  }

  static async #loadPreset(ev, t) {
    const sel = t.closest(".cnv-presets")?.querySelector("select");
    const preset = (game.settings.get(ID, "presets") ?? []).find((p) => p.id === sel?.value);
    if (!preset) return;
    await setState({
      title: preset.title ?? "",
      era: preset.era ?? "auto",
      speaker: null,
      participants: clone(preset.participants).map((p) => ({ ...p, id: uid() }))
    });
    ui.notifications.info(`Conversation « ${preset.name} » chargée.`);
  }

  static async #deletePreset(ev, t) {
    const sel = t.closest(".cnv-presets")?.querySelector("select");
    const presets = game.settings.get(ID, "presets") ?? [];
    const preset = presets.find((p) => p.id === sel?.value);
    if (!preset) return;
    const ok = await DialogV2.confirm({ window: { title: "Supprimer" }, content: `<p>Supprimer « ${esc(preset.name)} » ?</p>`, rejectClose: false });
    if (ok) await game.settings.set(ID, "presets", presets.filter((p) => p.id !== preset.id));
  }
}

/* ================================================================== */
/*  Bouton dans la barre de gauche                                     */
/* ================================================================== */

Hooks.on("getSceneControlButtons", (controls) => {
  const tokens = controls.tokens;
  if (!tokens?.tools) return;
  tokens.tools.conversationsPnj = {
    name: "conversationsPnj",
    title: "Conversation (portraits des PNJ)",
    icon: "fa-solid fa-comments",
    order: Object.keys(tokens.tools).length,
    button: true,
    visible: game.user.isGM,
    onChange: () => ManagerApp.toggle()
  };
});

/* La Bascule d'époque change le thème : on redessine */
Hooks.on("updateSetting", (setting) => {
  if (setting.key === "coc7-bascule-epoque.currentEra") Stage.render();
});
