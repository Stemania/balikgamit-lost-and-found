// Front end: talks to the REST API with fetch() and renders the board.
const form = document.querySelector('#item-form');
const formErrors = document.querySelector('#form-errors');
const submitBtn = document.querySelector('#submit-btn');
const formCategory = document.querySelector('#form-category');
const formDate = document.querySelector('#form-date');
const locationList = document.querySelector('#location-list');
const filterType = document.querySelector('#filter-type');
const filterCategory = document.querySelector('#filter-category');
const filterStatus = document.querySelector('#filter-status');
const list = document.querySelector('#item-list');
const boardMessage = document.querySelector('#board-message');
const toast = document.querySelector('#toast');

// --- helpers ---------------------------------------------------------------

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }
  return { ok: res.ok, status: res.status, data };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text; // textContent = safe from HTML injection
  return node;
}

function todayLocal() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

function timeAgo(iso) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const steps = [[60, 'second'], [60, 'minute'], [24, 'hour'], [30, 'day'], [12, 'month'], [Infinity, 'year']];
  let value = seconds;
  for (const [size, unit] of steps) {
    if (value < size) {
      const n = Math.floor(value);
      return n <= 0 && unit === 'second' ? 'just now' : `${n} ${unit}${n === 1 ? '' : 's'} ago`;
    }
    value /= size;
  }
  return '';
}

let toastTimer;
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3500);
}

function showBoardMessage(text, isError = false) {
  boardMessage.textContent = text;
  boardMessage.classList.toggle('is-error', isError);
  boardMessage.hidden = false;
}

function showFormErrors(title, details = []) {
  formErrors.replaceChildren(el('strong', '', title));
  if (details.length) {
    const ul = el('ul');
    details.forEach((d) => ul.append(el('li', '', d)));
    formErrors.append(ul);
  }
  formErrors.hidden = false;
}

// --- options (categories, locations) ---------------------------------------

async function loadOptions() {
  const { ok, data } = await api('/api/options');
  if (!ok || !data) return;
  for (const cat of data.categories) {
    formCategory.append(new Option(cat, cat));
    filterCategory.append(new Option(cat, cat));
  }
  for (const loc of data.locations) locationList.append(new Option(loc));
}

// --- board -----------------------------------------------------------------

function renderItem(item) {
  const isClaimed = item.status === 'Claimed';
  const li = el('li', `card ${isClaimed ? 'is-claimed' : item.type === 'Lost' ? 'is-lost' : 'is-found'}`);

  const tags = el('div', 'tags');
  tags.append(el('span', `tag ${item.type.toLowerCase()}`, item.type.toUpperCase()));
  tags.append(el('span', 'tag', item.category));
  if (isClaimed) tags.append(el('span', 'tag claimed', 'CLAIMED'));
  li.append(tags);

  li.append(el('h3', '', item.itemName));
  const verb = item.type === 'Lost' ? 'Lost at' : 'Found at';
  li.append(el('p', 'meta', `${verb} ${item.location} · ${formatDate(item.dateOccurred)}`));
  if (item.description) li.append(el('p', 'desc', item.description));

  const contact = el('p', 'contact');
  contact.append(el('strong', '', 'Contact: '), document.createTextNode(`${item.reporterName} (${item.contact})`));
  li.append(contact);

  const foot = el('div', 'card-foot');
  foot.append(el('small', '', isClaimed && item.claimedAt ? `Claimed ${timeAgo(item.claimedAt)}` : `Posted ${timeAgo(item.createdAt)}`));
  if (!isClaimed) {
    const btn = el('button', 'btn btn-ghost', 'Mark as claimed');
    btn.type = 'button';
    btn.dataset.action = 'ask';
    btn.dataset.id = item.id;
    foot.append(btn);
  }
  li.append(foot);
  return li;
}

async function loadItems() {
  const params = new URLSearchParams();
  if (filterType.value) params.set('type', filterType.value);
  if (filterCategory.value) params.set('category', filterCategory.value);
  if (filterStatus.value) params.set('status', filterStatus.value);

  showBoardMessage('Loading items…');
  let result;
  try {
    result = await api(`/api/items?${params}`);
  } catch {
    list.replaceChildren();
    return showBoardMessage('Cannot reach the server. Check your connection and refresh.', true);
  }

  const { ok, data } = result;
  if (!ok) {
    list.replaceChildren();
    return showBoardMessage((data && data.error) || 'Could not load items.', true);
  }

  list.replaceChildren(...data.items.map(renderItem));
  if (data.items.length === 0) showBoardMessage('No items match these filters yet.');
  else boardMessage.hidden = true;
}

// --- events ----------------------------------------------------------------

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  formErrors.hidden = true;
  form.querySelectorAll('[aria-invalid]').forEach((f) => f.removeAttribute('aria-invalid'));

  const payload = Object.fromEntries(new FormData(form).entries());

  // Quick browser-side check; the server re-checks everything (and has the final say).
  const missing = [...form.querySelectorAll('[required]')].filter((f) => !f.value.trim());
  if (missing.length) {
    missing.forEach((f) => f.setAttribute('aria-invalid', 'true'));
    missing[0].focus();
    return showFormErrors('Please fill in the highlighted fields.');
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Posting…';
  try {
    const { status, data } = await api('/api/items', { method: 'POST', body: JSON.stringify(payload) });
    if (status === 201) {
      form.reset();
      formDate.value = todayLocal();
      showToast(`Posted "${data.item.itemName}" to the board.`);
      filterStatus.value = 'Open';
      await loadItems();
    } else if (status === 400) {
      showFormErrors('Please fix the following:', (data && data.details) || []);
    } else {
      showFormErrors((data && data.error) || `Something went wrong (HTTP ${status}).`);
    }
  } catch {
    showFormErrors('Cannot reach the server. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Post to board';
  }
});

// Two-step, on-page confirmation (browser confirm() popups can be blocked).
list.addEventListener('click', async (event) => {
  const btn = event.target.closest('button[data-action]');
  if (!btn) return;
  const foot = btn.closest('.card-foot');
  const { action, id } = btn.dataset;

  if (action === 'ask') {
    const actions = el('div', 'confirm-actions');
    const cancel = el('button', 'btn btn-ghost', 'Cancel');
    cancel.type = 'button';
    cancel.dataset.action = 'cancel';
    const yes = el('button', 'btn btn-ghost btn-confirm', 'Yes, claimed');
    yes.type = 'button';
    yes.dataset.action = 'confirm';
    yes.dataset.id = id;
    actions.append(cancel, yes);
    btn.replaceWith(actions);
    yes.focus();
  } else if (action === 'cancel') {
    await loadItems();
  } else if (action === 'confirm') {
    foot.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      const { status, data } = await api(`/api/items/${id}/claim`, { method: 'PATCH' });
      if (status === 200) showToast(`"${data.item.itemName}" marked as claimed. Thanks for helping!`);
      else showToast((data && data.error) || `Could not update item (HTTP ${status}).`);
    } catch {
      showToast('Cannot reach the server. Please try again.');
    }
    await loadItems();
  }
});

[filterType, filterCategory, filterStatus].forEach((s) => s.addEventListener('change', loadItems));

// --- start -----------------------------------------------------------------

formDate.value = todayLocal();
formDate.max = todayLocal();
loadOptions().finally(loadItems);
