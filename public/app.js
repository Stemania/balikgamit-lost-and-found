// BalikGamit front end: talks to the REST API with fetch() and renders the views.
// All user text is inserted with textContent (never innerHTML) to prevent HTML injection.

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------------------------------------------------------------------------
// Routes (sidebar links use #hash URLs)
// ---------------------------------------------------------------------------
const ROUTES = {
  dashboard: { view: 'dashboard', crumb: 'Overview', title: 'Dashboard' },
  all: { view: 'list', crumb: 'Reports', title: 'All open reports', preset: { type: '', status: 'Open' } },
  lost: { view: 'list', crumb: 'Reports', title: 'Lost items', preset: { type: 'Lost', status: 'Open' } },
  found: { view: 'list', crumb: 'Reports', title: 'Found items', preset: { type: 'Found', status: 'Open' } },
  claimed: { view: 'list', crumb: 'Reports', title: 'Claimed items', preset: { type: '', status: 'Claimed' } },
  api: { view: 'api', crumb: 'System', title: 'API & status' },
};

const state = { route: 'dashboard', type: '', status: 'Open', category: '', q: '', items: [], current: null };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  return { ok: res.ok, status: res.status, data };
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('data-') || key.startsWith('aria-') || key === 'role' || key === 'tabindex' || key === 'type' || key === 'colspan') node.setAttribute(key, value);
    else node[key] = value;
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function icon(name, extra = '') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', `ic ${extra}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

const refCode = (id) => `BG-${String(id).slice(-6).toUpperCase()}`;

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// dateOccurred is stored as midnight UTC of the chosen day, so format it in UTC.
const fmtDay = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const fmtDateTime = (iso) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function timeAgo(iso) {
  const plural = (n, unit) => `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  const minutes = Math.max(0, (Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return plural(Math.floor(minutes), 'min');
  const hours = minutes / 60;
  if (hours < 24) return plural(Math.floor(hours), 'hr');
  const days = hours / 24;
  if (days < 30) return plural(Math.floor(days), 'day');
  if (days < 365) return plural(Math.floor(days / 30), 'month');
  return plural(Math.floor(days / 365), 'year');
}

function toast(message, kind = 'success') {
  const node = el('div', { class: `toast ${kind}`, role: 'status' }, icon(kind === 'error' ? 'alert' : 'check'), el('span', { text: message }));
  $('#toasts').append(node);
  setTimeout(() => node.remove(), 4000);
}

const badge = (kind, text) => el('span', { class: `badge ${kind}`, text });
const typeBadge = (type) => badge(type === 'Lost' ? 'lost' : 'found', type);
const statusBadge = (status) => badge(status === 'Claimed' ? 'claimed' : 'open', status);

// ---------------------------------------------------------------------------
// Service status (sidebar + API page)
// ---------------------------------------------------------------------------
let lastHealth = null;

async function checkHealth() {
  const box = $('#sb-status');
  const text = $('#sb-status-text');
  const started = performance.now();
  try {
    const { ok, data } = await api('/api/health');
    const ms = Math.round(performance.now() - started);
    lastHealth = { ok, data, ms, at: new Date() };
    if (ok && data.database === 'connected') {
      box.dataset.state = 'ok'; text.textContent = 'All systems operational';
    } else {
      box.dataset.state = 'degraded'; text.textContent = 'Database connecting…';
    }
  } catch {
    lastHealth = { ok: false, data: null, ms: null, at: new Date() };
    box.dataset.state = 'down'; text.textContent = 'Server unreachable';
  }
  renderStatusList();
}

function renderStatusList() {
  const list = $('#status-list');
  if (!list || !lastHealth) return;
  const { ok, data, ms, at } = lastHealth;
  const row = (label, value, stateName) => {
    const dd = el('dd', stateName ? { 'data-state': stateName } : {});
    if (stateName) dd.append(el('span', { class: 'dot' }));
    dd.append(value);
    return el('div', {}, el('dt', { text: label }), dd);
  };
  const dbOk = data && data.database === 'connected';
  list.replaceChildren(
    row('Web service (Render)', ok ? 'Online' : 'Unreachable', ok ? 'ok' : 'down'),
    row('Database (MongoDB Atlas)', data ? data.database[0].toUpperCase() + data.database.slice(1) : 'Unknown', dbOk ? 'ok' : 'degraded'),
    row('API response time', ms !== null ? `${ms} ms` : '–'),
    row('Server uptime', data ? formatUptime(data.uptimeSeconds) : '–'),
    row('Last checked', at.toLocaleTimeString()),
  );
}

function formatUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec % 60}s`;
  return `${sec}s`;
}

// ---------------------------------------------------------------------------
// Stats (dashboard + sidebar counts)
// ---------------------------------------------------------------------------
async function loadStats() {
  let res;
  try { res = await api('/api/stats'); } catch { return; }
  if (!res.ok || !res.data) return;
  const s = res.data;

  $$('[data-stat]').forEach((node) => { node.textContent = s[node.dataset.stat] ?? '–'; });
  $$('[data-count]').forEach((node) => { node.textContent = s[node.dataset.count] || ''; });

  const bars = $('#cat-bars');
  if (!s.byCategory.length) {
    bars.replaceChildren(el('li', { class: 'side-empty', text: 'No open reports yet.' }));
  } else {
    const max = Math.max(...s.byCategory.map((c) => c.count));
    bars.replaceChildren(...s.byCategory.map((c) => {
      const fill = el('div', { class: 'bar-fill' });
      fill.style.width = `${Math.max(4, (c.count / max) * 100)}%`;
      return el('li', { class: 'bar-row' }, el('span', { text: c.category }), el('strong', { text: c.count }), el('div', { class: 'bar-track' }, fill));
    }));
  }

  const spots = $('#hotspots');
  if (!s.topLocations.length) {
    spots.replaceChildren(el('li', { class: 'side-empty', text: 'No locations yet.' }));
    spots.classList.add('is-empty');
  } else {
    spots.classList.remove('is-empty');
    spots.replaceChildren(...s.topLocations.map((l) => el('li', {}, el('span', { text: l.location }), el('strong', { text: `${l.count}` }))));
  }
}

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------
function skeletonRows(tbody, cols, rows = 5) {
  tbody.replaceChildren(...Array.from({ length: rows }, () =>
    el('tr', { class: 'skeleton' }, ...Array.from({ length: cols }, (_, i) => {
      const bar = el('span', { class: 'sk' });
      bar.style.width = `${[70, 40, 55, 60, 45, 50, 20][i % 7]}%`;
      return el('td', {}, bar);
    }))));
}

function itemCell(item) {
  return el('td', {}, el('div', { class: 'cell-item' },
    el('strong', { text: item.itemName }),
    el('small', {}, el('span', { class: 'mono', text: refCode(item.id) }), el('span', { text: `by ${item.reporterName}` }))));
}

function clickableRow(item, cells) {
  const tr = el('tr', { tabindex: '0', 'aria-label': `Open details for ${item.itemName}` }, ...cells);
  tr.addEventListener('click', () => openDrawer(item));
  tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDrawer(item); } });
  return tr;
}

async function loadRecent() {
  const tbody = $('#recent-body');
  skeletonRows(tbody, 5, 4);
  let res;
  try { res = await api('/api/items?limit=7'); } catch { res = { ok: false, data: null }; }
  if (!res.ok) {
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '5' }, emptyState('alert', 'Could not load reports', (res.data && res.data.error) || 'The server could not be reached.', true))));
    return;
  }
  if (!res.data.items.length) {
    const btn = el('button', { class: 'btn btn-primary btn-sm', type: 'button', text: 'Report the first item' });
    btn.addEventListener('click', openReport);
    tbody.replaceChildren(el('tr', {}, el('td', { colspan: '5' }, emptyState('inbox', 'No reports yet', 'Lost or found something? Post it here.', false, btn))));
    return;
  }
  tbody.replaceChildren(...res.data.items.map((item) => clickableRow(item, [
    itemCell(item),
    el('td', {}, typeBadge(item.type)),
    el('td', { class: 'col-loc cell-muted', text: item.location }),
    el('td', { class: 'col-status' }, statusBadge(item.status)),
    el('td', { class: 'col-when cell-muted', text: timeAgo(item.createdAt) }),
  ])));
}

function emptyState(iconName, title, text, isError = false, action = null) {
  return el('div', { class: `empty${isError ? ' is-error' : ''}` },
    icon(iconName, 'ic-xl'), el('p', { class: 'empty-title', text: title }), el('p', { class: 'empty-text', text }), action);
}

let listRequest = 0;
async function loadList() {
  const requestId = ++listRequest;
  const tbody = $('#items-body');
  const empty = $('#list-empty');
  empty.hidden = true;
  skeletonRows(tbody, 7);
  $('#result-count').textContent = 'Loading…';

  const params = new URLSearchParams();
  if (state.type) params.set('type', state.type);
  if (state.status) params.set('status', state.status);
  if (state.category) params.set('category', state.category);
  if (state.q) params.set('q', state.q);

  let res;
  try { res = await api(`/api/items?${params}`); } catch { res = { ok: false, data: null }; }
  if (requestId !== listRequest) return; // a newer request replaced this one

  if (!res.ok) {
    tbody.replaceChildren();
    $('#result-count').textContent = '';
    $('#list-empty-title').textContent = 'Could not load reports';
    $('#list-empty-text').textContent = (res.data && res.data.error) || 'The server could not be reached. Try refreshing.';
    empty.classList.add('is-error');
    empty.hidden = false;
    return;
  }

  state.items = res.data.items;
  const n = state.items.length;
  $('#result-count').textContent = `${n} ${n === 1 ? 'result' : 'results'}`;
  if (!n) {
    tbody.replaceChildren();
    empty.classList.remove('is-error');
    $('#list-empty-title').textContent = state.q ? `No results for “${state.q}”` : 'Nothing here yet';
    $('#list-empty-text').textContent = state.q || state.category ? 'Try a different filter or search term.' : 'Reports that match this view will show up here.';
    empty.hidden = false;
    return;
  }

  tbody.replaceChildren(...state.items.map((item) => clickableRow(item, [
    itemCell(item),
    el('td', {}, typeBadge(item.type)),
    el('td', { class: 'col-cat cell-muted', text: item.category }),
    el('td', { class: 'col-loc cell-muted', text: item.location }),
    el('td', { class: 'col-date cell-muted', text: fmtDay(item.dateOccurred) }),
    el('td', { class: 'col-status' }, statusBadge(item.status)),
    el('td', { class: 'col-go' }, icon('chevron')),
  ])));
}

// ---------------------------------------------------------------------------
// Custom dropdown: styles the option list (native <select> lists can't be styled).
// The real <select> stays in the DOM, hidden, as the source of truth, so forms,
// FormData and 'change' listeners keep working unchanged.
// ---------------------------------------------------------------------------
const customSelects = new Map();
let openSelect = null;

function enhanceSelect(select) {
  if (customSelects.has(select)) return customSelects.get(select).render();
  const wrap = el('div', { class: 'select' });
  select.before(wrap);
  const label = select.getAttribute('aria-label') || (select.closest('label')?.querySelector('span')?.textContent || '').replace('*', '').trim();
  const valueText = el('span', { class: 'select-value' });
  const trigger = el('button', { class: 'select-trigger', type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': label }, valueText, icon('chevron-down'));
  const menuId = `menu-${select.id}`;
  const menu = el('div', { class: 'select-menu', role: 'listbox', id: menuId, hidden: true, 'aria-label': label });
  trigger.setAttribute('aria-controls', menuId);
  select.classList.add('select-native');
  select.tabIndex = -1;
  wrap.append(trigger, select, menu); // trigger first, so clicking a <label> opens it

  let active = -1;
  const options = () => [...select.options].filter((o) => !o.disabled);

  function render() {
    const current = select.selectedOptions[0];
    const placeholder = !current || (current.disabled && current.value === '');
    valueText.textContent = current ? current.textContent : '';
    valueText.classList.toggle('is-placeholder', placeholder);
    menu.replaceChildren(...options().map((o, i) => {
      const item = el('div', { class: 'select-option', role: 'option', id: `${menuId}-${i}`, 'aria-selected': String(o.selected && !placeholder), 'data-index': String(i) },
        el('span', { text: o.textContent }), icon('check'));
      item.addEventListener('pointermove', () => setActive(i));
      item.addEventListener('click', (e) => { e.preventDefault(); choose(i); });
      return item;
    }));
  }

  function setActive(i) {
    const items = [...menu.children];
    if (!items.length) return;
    active = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((n, k) => n.classList.toggle('is-active', k === active));
    trigger.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function position() {
    const r = trigger.getBoundingClientRect();
    menu.style.minWidth = `${Math.max(r.width, 180)}px`;
    menu.style.left = `${Math.min(r.left, window.innerWidth - menu.offsetWidth - 8)}px`;
    const below = window.innerHeight - r.bottom;
    const h = menu.offsetHeight;
    menu.style.top = below < h + 12 && r.top > below ? `${r.top - h - 6}px` : `${r.bottom + 6}px`;
  }

  function open() {
    if (openSelect && openSelect !== api) openSelect.close();
    render();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    position();
    setActive(Math.max(0, options().findIndex((o) => o.selected)));
    openSelect = api;
  }

  function close(focus = false) {
    if (menu.hidden) return;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    if (openSelect === api) openSelect = null;
    if (focus) trigger.focus();
  }

  function choose(i) {
    const opt = options().at(i);
    if (!opt) return;
    const changed = select.value !== opt.value;
    select.value = opt.value;
    select.removeAttribute('aria-invalid');
    render();
    close(true);
    if (changed) {
      select.dispatchEvent(new Event('input', { bubbles: true }));
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  trigger.addEventListener('click', () => (menu.hidden ? open() : close()));
  menu.addEventListener('click', (e) => e.preventDefault()); // a click in the menu must not re-trigger the <label>
  trigger.addEventListener('keydown', (e) => {
    const isOpen = !menu.hidden;
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key) && !isOpen) { e.preventDefault(); open(); return; }
    if (!isOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(menu.children.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); } // don't close the dialog/drawer too
    else if (e.key === 'Tab') close();
  });

  const api = { render, close, trigger, wrap, menu };
  customSelects.set(select, api);
  render();
  return api;
}

const syncSelect = (select) => customSelects.get(select)?.render();

// ---------------------------------------------------------------------------
// Autocomplete for free-text fields (replaces the browser's unstyled <datalist>):
// suggestions filter as you type, but any value can still be entered.
// ---------------------------------------------------------------------------
function enhanceCombo(input, suggestions) {
  const wrap = el('div', { class: 'combo' });
  input.before(wrap);
  const menuId = `menu-${input.id}`;
  const menu = el('div', { class: 'select-menu', role: 'listbox', id: menuId, hidden: true });
  const chevron = icon('chevron-down', 'combo-chevron');
  wrap.append(input, chevron, menu);
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', menuId);

  let matches = [];
  let active = -1;

  function setActive(i) {
    const items = [...menu.children];
    if (!items.length) return;
    active = (i + items.length) % items.length;
    items.forEach((n, k) => n.classList.toggle('is-active', k === active));
    input.setAttribute('aria-activedescendant', items[active].id);
    items[active].scrollIntoView({ block: 'nearest' });
  }

  function position() {
    const r = input.getBoundingClientRect();
    menu.style.minWidth = `${r.width}px`;
    menu.style.left = `${r.left}px`;
    const below = window.innerHeight - r.bottom;
    const h = menu.offsetHeight;
    menu.style.top = below < h + 12 && r.top > below ? `${r.top - h - 6}px` : `${r.bottom + 6}px`;
  }

  function open() {
    const q = input.value.trim().toLowerCase();
    matches = suggestions.filter((s) => s.toLowerCase().includes(q));
    if (!matches.length) return close();
    menu.replaceChildren(...matches.map((s, i) => {
      const item = el('div', { class: 'select-option', role: 'option', id: `${menuId}-${i}`, 'aria-selected': String(s === input.value) },
        el('span', { text: s }), icon('check'));
      item.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
      item.addEventListener('pointermove', () => setActive(i));
      item.addEventListener('click', (e) => { e.preventDefault(); choose(i); });
      return item;
    }));
    if (openSelect && openSelect !== api) openSelect.close();
    menu.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    wrap.classList.add('is-open');
    position();
    active = -1;
    openSelect = api;
  }

  function close() {
    if (menu.hidden) return;
    menu.hidden = true;
    wrap.classList.remove('is-open');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (openSelect === api) openSelect = null;
  }

  function choose(i) {
    const value = matches.at(i);
    if (value === undefined) return;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    close();
  }

  input.addEventListener('focus', open);
  input.addEventListener('click', () => { if (menu.hidden) open(); });
  input.addEventListener('input', (e) => { if (e.isTrusted) open(); });
  input.addEventListener('blur', () => setTimeout(close, 100));
  input.addEventListener('keydown', (e) => {
    const isOpen = !menu.hidden;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!isOpen) open(); else setActive(active + 1); }
    else if (e.key === 'ArrowUp' && isOpen) { e.preventDefault(); setActive(active - 1); }
    else if (e.key === 'Enter' && isOpen && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape' && isOpen) { e.preventDefault(); e.stopPropagation(); close(); } // don't close the dialog too
    else if (e.key === 'Tab') close();
  });
  menu.addEventListener('click', (e) => e.preventDefault());

  const api = { close, wrap, menu };
  return api;
}

document.addEventListener('pointerdown', (e) => {
  if (openSelect && !openSelect.wrap.contains(e.target)) openSelect.close();
}, true);
window.addEventListener('resize', () => openSelect?.close());
document.addEventListener('scroll', (e) => {
  if (openSelect && !openSelect.menu.contains(e.target)) openSelect.close();
}, true);

// ---------------------------------------------------------------------------
// Routing / views
// ---------------------------------------------------------------------------
function syncToolbar() {
  $$('#seg-type button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.type === state.type)));
  $('#f-status').value = state.status;
  $('#f-category').value = state.category;
  syncSelect($('#f-status'));
  syncSelect($('#f-category'));
}

function highlightNav() {
  // Highlight the sidebar link whose preset matches the current filters.
  let key = state.route;
  if (ROUTES[key].view === 'list') {
    key = Object.keys(ROUTES).find((k) => {
      const p = ROUTES[k].preset;
      return p && p.type === state.type && p.status === state.status;
    }) || null;
  }
  $$('.sb-nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === key));
}

function route() {
  const key = ROUTES[location.hash.slice(1)] ? location.hash.slice(1) : 'dashboard';
  const r = ROUTES[key];
  state.route = key;
  $('#crumb').textContent = r.crumb;
  $('#page-title').textContent = r.title;
  document.title = `${r.title} · BalikGamit`;

  $('#view-dashboard').hidden = r.view !== 'dashboard';
  $('#view-list').hidden = r.view !== 'list';
  $('#view-api').hidden = r.view !== 'api';

  if (r.preset) {
    state.type = r.preset.type;
    state.status = r.preset.status;
    state.category = '';
    syncToolbar();
    loadList();
  } else if (r.view === 'dashboard') {
    loadStats();
    loadRecent();
  } else if (r.view === 'api') {
    checkHealth();
  }
  highlightNav();
  closeSidebar();
  window.scrollTo(0, 0);
}

function refreshAll() {
  loadStats();
  if (ROUTES[state.route].view === 'dashboard') loadRecent();
  if (ROUTES[state.route].view === 'list') loadList();
}

// ---------------------------------------------------------------------------
// Detail drawer
// ---------------------------------------------------------------------------
let lastFocus = null;

function openDrawer(item) {
  state.current = item;
  lastFocus = document.activeElement;
  renderDrawer();
  $('#drawer').hidden = false;
  $('#drawer-backdrop').hidden = false;
  $('#drawer-close').focus();
}

function closeDrawer() {
  if ($('#drawer').hidden) return;
  $('#drawer').hidden = true;
  $('#drawer-backdrop').hidden = true;
  state.current = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function detailRow(iconName, label, value) {
  return el('div', {}, el('dt', {}, icon(iconName), label), el('dd', { text: value }));
}

function renderDrawer() {
  const item = state.current;
  if (!item) return;
  const lost = item.type === 'Lost';
  $('#drawer-ref').textContent = refCode(item.id);

  const timeline = el('ol', { class: 'timeline' },
    el('li', {}, el('strong', { text: `${lost ? 'Lost' : 'Found'} at ${item.location}` }), fmtDay(item.dateOccurred)),
    el('li', {}, el('strong', { text: 'Reported on BalikGamit' }), `${fmtDateTime(item.createdAt)} · ${timeAgo(item.createdAt)}`));
  if (item.status === 'Claimed' && item.claimedAt) {
    timeline.append(el('li', { class: 'done' }, el('strong', { text: 'Claimed by owner' }), `${fmtDateTime(item.claimedAt)} · ${timeAgo(item.claimedAt)}`));
  }

  $('#drawer-body').replaceChildren(
    el('div', { class: 'drawer-badges' }, typeBadge(item.type), statusBadge(item.status), badge('neutral', item.category)),
    el('h2', { id: 'drawer-title', text: item.itemName }),
    el('p', { class: `drawer-desc${item.description ? '' : ' none'}`, text: item.description || 'No description provided.' }),
    el('dl', { class: 'detail-list' },
      detailRow('tag', 'Category', item.category),
      detailRow('pin', lost ? 'Last seen at' : 'Found at', item.location),
      detailRow('calendar', lost ? 'Date lost' : 'Date found', fmtDay(item.dateOccurred)),
      detailRow('user', 'Reported by', item.reporterName),
      detailRow('message', 'Contact', item.contact)),
    el('p', { class: 'section-title', text: 'Timeline' }),
    timeline,
  );
  renderDrawerFoot();
}

function renderDrawerFoot(confirming = false) {
  const item = state.current;
  const foot = $('#drawer-foot');
  if (item.status === 'Claimed') {
    foot.replaceChildren(el('p', { class: 'claimed-note' }, icon('check'), 'This item has been returned to its owner.'));
    return;
  }
  if (!confirming) {
    const btn = el('button', { class: 'btn btn-success btn-block', type: 'button' }, icon('check'), 'Mark as claimed');
    btn.addEventListener('click', () => renderDrawerFoot(true));
    foot.replaceChildren(btn);
    return;
  }
  const cancel = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Cancel' });
  const yes = el('button', { class: 'btn btn-success', type: 'button' }, icon('check'), 'Yes, it was claimed');
  cancel.addEventListener('click', () => renderDrawerFoot(false));
  yes.addEventListener('click', () => claimItem(item, [cancel, yes]));
  foot.replaceChildren(el('div', { class: 'confirm-box' },
    el('p', { text: `Confirm that “${item.itemName}” has been returned to its owner. This closes the report.` }),
    el('div', { class: 'confirm-actions' }, cancel, yes)));
  yes.focus();
}

async function claimItem(item, buttons) {
  buttons.forEach((b) => { b.disabled = true; });
  let res;
  try { res = await api(`/api/items/${item.id}/claim`, { method: 'PATCH' }); } catch { res = { status: 0, data: null }; }
  if (res.status === 200) {
    toast(`${refCode(item.id)} “${item.itemName}” marked as claimed.`);
    state.current = res.data.item;
    renderDrawer();
  } else if (res.status === 409 && res.data && res.data.item) {
    toast('This item was already marked as claimed.', 'error');
    state.current = res.data.item;
    renderDrawer();
  } else {
    toast((res.data && res.data.error) || 'Could not update the item. Please try again.', 'error');
    renderDrawerFoot(false);
  }
  refreshAll();
}

// ---------------------------------------------------------------------------
// Report dialog
// ---------------------------------------------------------------------------
const dialog = $('#report-dialog');
const form = $('#report-form');

function updateTypeLabels() {
  const found = form.elements.type.value === 'Found';
  $('#date-label').textContent = found ? 'Date found *' : 'Date lost *';
  $('#loc-label').textContent = found ? 'Where did you find it? *' : 'Where was it lost? *';
}

function openReport() {
  form.reset();
  syncSelect($('#form-category'));
  $('#form-date').value = todayLocal();
  $('#form-date').max = todayLocal();
  $('#form-errors').hidden = true;
  $$('[aria-invalid]', form).forEach((f) => f.removeAttribute('aria-invalid'));
  updateTypeLabels();
  closeSidebar();
  dialog.showModal();
  form.elements.itemName.focus();
}

function showFormErrors(title, details = []) {
  const box = $('#form-errors');
  box.replaceChildren(el('strong', { text: title }));
  if (details.length) box.append(el('ul', {}, ...details.map((d) => el('li', { text: d }))));
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest' });
}

form.addEventListener('change', (e) => { if (e.target.name === 'type') updateTypeLabels(); });
form.addEventListener('reset', () => setTimeout(() => syncSelect($('#form-category')))); // keep the custom dropdown in step
form.addEventListener('input', (e) => e.target.removeAttribute('aria-invalid'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#form-errors').hidden = true;

  // Quick browser-side check; the server validates everything again and has the final say.
  const missing = $$('[required]', form).filter((f) => !String(f.value).trim());
  $$('[aria-invalid]', form).forEach((f) => f.removeAttribute('aria-invalid'));
  if (missing.length) {
    missing.forEach((f) => f.setAttribute('aria-invalid', 'true'));
    (customSelects.get(missing[0])?.trigger || missing[0]).focus();
    showFormErrors('Please complete the highlighted fields.');
    return;
  }

  const payload = Object.fromEntries(new FormData(form).entries());
  const submit = $('#submit-btn');
  submit.disabled = true;
  submit.textContent = 'Submitting…';
  try {
    const { status, data } = await api('/api/items', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 201) {
      dialog.close();
      toast(`${refCode(data.item.id)} “${data.item.itemName}” was posted.`);
      const target = data.item.type === 'Lost' ? 'lost' : 'found';
      if (location.hash === `#${target}`) refreshAll();
      else location.hash = target;
      loadStats();
      openDrawer(data.item);
    } else if (status === 400) {
      showFormErrors('Please fix the following:', (data && data.details) || []);
    } else {
      showFormErrors((data && data.error) || `Something went wrong (HTTP ${status}).`);
    }
  } catch {
    showFormErrors('Cannot reach the server. Check your connection and try again.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Submit report';
  }
});

$$('[data-close-report]').forEach((b) => b.addEventListener('click', () => dialog.close()));
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); }); // click on backdrop
$$('[data-open-report]').forEach((b) => b.addEventListener('click', openReport));

// ---------------------------------------------------------------------------
// API "Try it" console
// ---------------------------------------------------------------------------
async function tryRequest(method, path, body) {
  const consoleBox = $('#console');
  consoleBox.hidden = false;
  $('#console-req').textContent = `${method} ${path}`;
  $('#console-status').textContent = '…';
  $('#console-body').textContent = '';
  const started = performance.now();
  try {
    const { status, data } = await api(path, body ? { method, body: JSON.stringify(body) } : { method });
    $('#console-status').textContent = `HTTP ${status} · ${Math.round(performance.now() - started)} ms`;
    $('#console-body').textContent = JSON.stringify(data, null, 2);
  } catch {
    $('#console-status').textContent = 'Network error';
  }
}

$$('[data-try]').forEach((b) => b.addEventListener('click', () => tryRequest('GET', b.dataset.try)));
$$('[data-try-post]').forEach((b) => b.addEventListener('click', () =>
  tryRequest('POST', '/api/items', { type: 'Lost', itemName: '', category: 'Not a category', dateOccurred: '2026-02-30' })));
$('#status-refresh').addEventListener('click', checkHealth);

// ---------------------------------------------------------------------------
// Sidebar (mobile), search, filters, keyboard
// ---------------------------------------------------------------------------
function closeSidebar() {
  $('#sidebar').classList.remove('open');
  $('#sb-backdrop').hidden = true;
}
$('#menu-btn').addEventListener('click', () => {
  $('#sidebar').classList.add('open');
  $('#sb-backdrop').hidden = false;
});
$('#sb-backdrop').addEventListener('click', closeSidebar);

let searchTimer;
$('#search').addEventListener('input', (e) => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.q = e.target.value.trim();
    if (ROUTES[state.route].view !== 'list') {
      location.hash = 'all';
    } else {
      loadList();
    }
  }, 250);
});

$('#seg-type').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-type]');
  if (!b) return;
  state.type = b.dataset.type;
  syncToolbar(); highlightNav(); loadList();
});
$('#f-status').addEventListener('change', (e) => { state.status = e.target.value; highlightNav(); loadList(); });
$('#f-category').addEventListener('change', (e) => { state.category = e.target.value; loadList(); });
$('#refresh-btn').addEventListener('click', () => { loadList(); loadStats(); });

$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer-backdrop').addEventListener('click', closeDrawer);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeDrawer(); closeSidebar(); }
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (e.key === '/' && !typing && !dialog.open) { e.preventDefault(); $('#search').focus(); }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function loadOptions() {
  try {
    const { ok, data } = await api('/api/options');
    if (!ok) return;
    for (const cat of data.categories) {
      $('#form-category').append(new Option(cat, cat));
      $('#f-category').append(new Option(cat, cat));
    }
    enhanceCombo($('#form-location'), data.locations);
  } catch { /* the form still works with free text */ }
  ['#f-category', '#f-status', '#form-category'].forEach((sel) => enhanceSelect($(sel)));
}

window.addEventListener('hashchange', route);
loadOptions().finally(() => {
  route();
  loadStats();
  checkHealth();
  setInterval(checkHealth, 60000);
});
