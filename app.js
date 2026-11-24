'use strict';

/* =========================================================
   จดๆ — Todo + รายรับรายจ่าย
   ข้อมูลเก็บใน localStorage ของเบราว์เซอร์/แอปนี้เท่านั้น
   ========================================================= */

const KEY = 'todo-money:v1';

const EXPENSE_CATS = [
  { id: 'food', name: 'อาหาร', icon: '🍜' },
  { id: 'transport', name: 'เดินทาง', icon: '🚌' },
  { id: 'shopping', name: 'ช้อปปิ้ง', icon: '🛍️' },
  { id: 'bills', name: 'บิล/ค่าบริการ', icon: '🧾' },
  { id: 'home', name: 'ที่พัก', icon: '🏠' },
  { id: 'health', name: 'สุขภาพ', icon: '💊' },
  { id: 'fun', name: 'บันเทิง', icon: '🎮' },
  { id: 'other', name: 'อื่นๆ', icon: '📦' },
];
const INCOME_CATS = [
  { id: 'salary', name: 'เงินเดือน', icon: '💼' },
  { id: 'freelance', name: 'ฟรีแลนซ์', icon: '💻' },
  { id: 'bonus', name: 'โบนัส', icon: '🎁' },
  { id: 'invest', name: 'ลงทุน', icon: '📈' },
  { id: 'other', name: 'อื่นๆ', icon: '💰' },
];
const catsOf = (type) => (type === 'income' ? INCOME_CATS : EXPENSE_CATS);
const findCat = (type, id) => catsOf(type).find((c) => c.id === id) || catsOf(type).at(-1);

/* ---------- helpers ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const parseYMD = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const nf = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const baht = (n) => (n < 0 ? '-฿' : '฿') + nf.format(Math.abs(n));
const cents = (n) => Math.round(n * 100);

function parseAmount(str) {
  let s = String(str).trim().replace(/\s/g, '');
  // "12,5" -> 12.5 (คีย์บอร์ดบางแบบใช้ , เป็นทศนิยม) ; "1,234.50" -> 1234.50
  if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(',', '.');
  else s = s.replace(/,/g, '');
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0 || n > 1e10) return null;
  return Math.round(n * 100) / 100;
}

const dayLabel = (s) => {
  const t = today();
  const y = ymd(new Date(Date.now() - 86400000));
  if (s === t) return 'วันนี้';
  if (s === y) return 'เมื่อวาน';
  const d = parseYMD(s);
  const opts = { weekday: 'short', day: 'numeric', month: 'short' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = '2-digit';
  return d.toLocaleDateString('th-TH', opts);
};
const monthLabel = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
};
const shiftMonth = (ym, delta) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

/* ---------- state ---------- */
let state = load();
const ui = { tab: 'todo', filter: 'all', month: today().slice(0, 7) };

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && Array.isArray(s.todos) && Array.isArray(s.tx)) return { deleted: {}, ...s };
  } catch (_) { /* ignore */ }
  return { todos: [], tx: [], deleted: {} };
}
// สำหรับ sync: ทุกการแก้ไขประทับ updatedAt, ทุกการลบเก็บ tombstone (ดู mergeState ใน sync.js)
const stamp = (x) => { x.updatedAt = Date.now(); return x; };
function bury(items) { for (const x of items) state.deleted[x.id] = Date.now(); }
function unbury(items) { for (const x of items) { delete state.deleted[x.id]; stamp(x); } }
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (_) {
    toast('บันทึกไม่สำเร็จ — พื้นที่เก็บข้อมูลเต็ม');
  }
}
function commit() {
  save();
  render();
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, actionLabel, action) {
  const el = $('#toast');
  el.replaceChildren(h('span', {}, msg));
  if (actionLabel) {
    el.append(h('button', { type: 'button', onclick: () => { action?.(); hideToast(); } }, actionLabel));
  }
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 3000);
}
function hideToast() {
  $('#toast').hidden = true;
}

/* ---------- tabs ---------- */
const TITLES = { todo: 'สิ่งที่ต้องทำ', money: 'รายรับรายจ่าย', more: 'เพิ่มเติม' };
function setTab(tab) {
  ui.tab = tab;
  $$('.strip').forEach((s) => delete s.dataset.ym); // re-center the day strip on today
  render();
  window.scrollTo(0, 0);
}
$$('.tabbar button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

/* ---------- month nav + day strip (ใช้ร่วมกันทั้งแท็บงานและเงิน) ---------- */
$$('[data-shift]').forEach((b) =>
  b.addEventListener('click', () => { ui.month = shiftMonth(ui.month, Number(b.dataset.shift)); render(); })
);
$$('.month-label').forEach((b) => b.addEventListener('click', () => { ui.month = today().slice(0, 7); render(); }));

// marks: Map<'YYYY-MM-DD', ''|'pos'|'neg'> = วันที่มีรายการ ; กดแล้วเลื่อนไปที่ #<prefix><date>
function renderStrip(strip, marks, prefix) {
  const [y, m] = ui.month.split('-').map(Number);
  const now = today();
  const keep = strip.dataset.ym === ui.month ? strip.scrollLeft : null;
  strip.replaceChildren(
    ...Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => {
      const date = `${ui.month}-${pad(i + 1)}`;
      const has = marks.has(date);
      return h('button', {
        type: 'button', class: date === now ? 'today' : null, disabled: !has,
        onclick: () => document.getElementById(prefix + date)?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      },
      h('small', {}, parseYMD(date).toLocaleDateString('th-TH', { weekday: 'narrow' })),
      h('b', {}, i + 1),
      h('i', { class: has ? 'dot on ' + marks.get(date) : 'dot' }));
    })
  );
  if (keep != null) strip.scrollLeft = keep;
  else {
    const t = strip.querySelector('.today');
    strip.scrollLeft = t ? t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2 : 0;
  }
  strip.dataset.ym = ui.month;
}

/* =========================================================
   TODO
   ========================================================= */
$('#todo-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#todo-title').value.trim();
  if (!title) return;
  const due = $('#todo-due').value;
  const detail = $('#todo-detail').value.trim();
  state.todos.push(stamp({ id: uid(), title, detail, due: DATE_RE.test(due) ? due : '', done: false, createdAt: Date.now(), doneAt: 0 }));
  if (DATE_RE.test(due)) ui.month = due.slice(0, 7); // พาไปเดือนของงานที่เพิ่งเพิ่ม
  $('#todo-title').value = '';
  $('#todo-detail').value = '';
  $('#todo-due').value = '';
  commit();
  $('#todo-title').focus();
});

$$('#todo-filter button').forEach((b) =>
  b.addEventListener('click', () => {
    ui.filter = b.dataset.filter;
    render();
  })
);

$('#todo-clear').addEventListener('click', () => {
  const removed = state.todos.filter((t) => t.done);
  if (!removed.length) return;
  state.todos = state.todos.filter((t) => !t.done);
  bury(removed);
  commit();
  toast(`ล้างแล้ว ${removed.length} งาน`, 'เลิกทำ', () => {
    unbury(removed);
    state.todos.push(...removed);
    commit();
  });
});

function sortedTodos() {
  const active = state.todos.filter((t) => !t.done).sort((a, b) => {
    if (a.due && b.due) return a.due.localeCompare(b.due) || a.createdAt - b.createdAt;
    if (a.due) return -1;
    if (b.due) return 1;
    return a.createdAt - b.createdAt;
  });
  const done = state.todos.filter((t) => t.done).sort((a, b) => b.doneAt - a.doneAt);
  return [...active, ...done];
}

function dueBadge(t) {
  if (!t.due) return null;
  const now = today();
  let cls = 'badge';
  let text = '📅 ' + dayLabel(t.due);
  if (!t.done && t.due < now) { cls += ' overdue'; text = '⚠️ เลยกำหนด · ' + dayLabel(t.due); }
  else if (!t.done && t.due === now) cls += ' today';
  return h('span', { class: cls }, text);
}

function renderTodos() {
  const all = sortedTodos();
  const items = all.filter((t) => (ui.filter === 'active' ? !t.done : ui.filter === 'done' ? t.done : true));
  const left = state.todos.filter((t) => !t.done).length;
  const doneCount = state.todos.length - left;

  $('#todo-stats').textContent = state.todos.length ? `ค้างอยู่ ${left} · เสร็จแล้ว ${doneCount}` : '';
  $$('#todo-filter button').forEach((b) => b.classList.toggle('on', b.dataset.filter === ui.filter));

  // timeline: [เลยกำหนดจากเดือนก่อน] → [ไม่มีกำหนด] → วันในเดือนนี้ (เก่า → ใหม่)
  const now = today();
  const groups = new Map();
  if (now.startsWith(ui.month)) groups.set('overdue', items.filter((t) => !t.done && t.due && t.due < ui.month + '-01'));
  groups.set('nodue', items.filter((t) => !t.due));
  const dates = [...new Set(items.filter((t) => t.due.startsWith(ui.month)).map((t) => t.due))].sort();
  for (const d of dates) groups.set(d, items.filter((t) => t.due === d));

  const HEAD = { overdue: '⚠️ เลยกำหนดจากเดือนก่อน', nodue: 'ไม่มีกำหนด' };
  const row = (t, showDue) =>
    h('li', { class: 'todo' + (t.done ? ' done' : t.due && t.due < now ? ' late' : '') },
      h('button', {
        class: 'check', type: 'button', role: 'checkbox', 'aria-checked': String(t.done),
        'aria-label': t.done ? 'ยกเลิกเสร็จ' : 'ทำเสร็จแล้ว',
        onclick: () => { t.done = !t.done; t.doneAt = t.done ? Date.now() : 0; stamp(t); commit(); },
      }),
      h('button', { class: 'todo-body', type: 'button', onclick: () => openTodoDialog(t) },
        h('span', { class: 'todo-title' }, t.title),
        t.detail ? h('span', { class: 'todo-detail' }, t.detail.split('\n', 1)[0]) : null,
        showDue ? dueBadge(t) : null)
    );
  $('#todo-list').replaceChildren(
    ...[...groups].filter(([, g]) => g.length).map(([k, g]) =>
      h('section', { class: 'tl-day', id: 'td-' + k },
        h('div', { class: 'day-head' }, h('span', {}, HEAD[k] || dayLabel(k)), h('span', {}, `${g.length} งาน`)),
        h('ul', { class: 'tl' }, g.map((t) => row(t, k === 'overdue'))))
    )
  );
  renderStrip($('#todo-strip'),
    new Map(dates.map((d) => [d, groups.get(d).some((t) => !t.done && d < now) ? 'neg' : ''])), 'td-');

  const empty = $('#todo-empty');
  empty.hidden = $('#todo-list').children.length > 0;
  empty.textContent =
    !state.todos.length ? 'ยังไม่มีงาน — เพิ่มงานแรกได้เลยด้านบน'
    : ui.filter === 'done' ? 'ไม่มีงานที่เสร็จในเดือนนี้'
    : ui.filter === 'active' ? '🎉 ไม่มีงานค้างในเดือนนี้'
    : 'ไม่มีงานในเดือนนี้';
  $('#todo-clear').hidden = !(doneCount > 0 && ui.filter !== 'active');
}

/* ----- todo edit dialog ----- */
let editingTodo = null;
const todoDlg = $('#todo-dialog');
function openTodoDialog(t) {
  editingTodo = t;
  $('#te-title').value = t.title;
  $('#te-due').value = t.due || '';
  $('#te-detail').value = t.detail || '';
  todoDlg.showModal();
}
$('#todo-edit-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const title = $('#te-title').value.trim();
  if (!title || !editingTodo) return;
  editingTodo.title = title;
  editingTodo.detail = $('#te-detail').value.trim();
  const due = $('#te-due').value;
  editingTodo.due = DATE_RE.test(due) ? due : '';
  if (editingTodo.due) ui.month = editingTodo.due.slice(0, 7);
  stamp(editingTodo);
  todoDlg.close();
  commit();
});
$('#te-cancel').addEventListener('click', () => todoDlg.close());
$('#te-delete').addEventListener('click', () => {
  const t = editingTodo;
  if (!t) return;
  state.todos = state.todos.filter((x) => x.id !== t.id);
  bury([t]);
  todoDlg.close();
  commit();
  toast('ลบงานแล้ว', 'เลิกทำ', () => { unbury([t]); state.todos.push(t); commit(); });
});

/* =========================================================
   MONEY
   ========================================================= */
function renderMoney() {
  const txs = state.tx.filter((t) => t.date.startsWith(ui.month));

  let inc = 0, exp = 0;
  const byCat = new Map();
  for (const t of txs) {
    if (t.type === 'income') inc += cents(t.amount);
    else {
      exp += cents(t.amount);
      byCat.set(t.category, (byCat.get(t.category) || 0) + cents(t.amount));
    }
  }
  $('#s-income').textContent = baht(inc / 100);
  $('#s-expense').textContent = baht(exp / 100);
  const bal = $('#s-balance');
  bal.textContent = baht((inc - exp) / 100);
  bal.className = inc - exp < 0 ? 'neg' : '';

  // breakdown
  const bd = $('#breakdown');
  bd.hidden = exp === 0;
  if (exp > 0) {
    const rows = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
    bd.replaceChildren(
      h('h2', {}, 'รายจ่ายตามหมวด'),
      ...rows.map(([id, c]) => {
        const cat = findCat('expense', id);
        return h('div', { class: 'bar-row' },
          h('span', {}, `${cat.icon} ${cat.name}`),
          h('span', { class: 'amt' }, `${baht(c / 100)} · ${Math.round((c / exp) * 100)}%`),
          h('div', { class: 'bar' }, h('i', { style: `width:${Math.max(2, (c / rows[0][1]) * 100)}%` }))
        );
      })
    );
  }

  // timeline รายวัน (เก่า → ใหม่)
  const groups = new Map();
  for (const t of txs.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    if (!groups.has(t.date)) groups.set(t.date, []);
    groups.get(t.date).push(t);
  }
  const nets = new Map([...groups].map(([d, items]) =>
    [d, items.reduce((s, t) => s + (t.type === 'income' ? 1 : -1) * cents(t.amount), 0) / 100]));
  renderStrip($('#money-strip'), new Map([...nets].map(([d, n]) => [d, n < 0 ? 'neg' : 'pos'])), 'md-');
  $('#tx-list').replaceChildren(
    ...[...groups.entries()].map(([date, items]) => {
      return h('section', { class: 'tl-day', id: 'md-' + date },
        h('div', { class: 'day-head' }, h('span', {}, dayLabel(date)), h('span', {}, baht(nets.get(date)))),
        h('div', { class: 'tl' },
          items.map((t) => {
            const cat = findCat(t.type, t.category);
            return h('button', { class: 'tx ' + t.type, type: 'button', onclick: () => openTxDialog(t) },
              h('span', { class: 'tx-ico' }, cat.icon),
              h('span', { class: 'tx-main' }, h('b', {}, cat.name), t.note ? h('small', {}, t.note) : null),
              h('span', { class: 'tx-amt ' + (t.type === 'income' ? 'pos' : 'neg') },
                (t.type === 'income' ? '+' : '-') + baht(t.amount))
            );
          })
        )
      );
    })
  );
  $('#tx-empty').hidden = txs.length > 0;
}

/* ----- transaction dialog ----- */
const txDlg = $('#tx-dialog');
let txDraft = null; // { id|null, type, category }

function openTxDialog(t) {
  txDraft = t
    ? { id: t.id, type: t.type, category: t.category }
    : { id: null, type: 'expense', category: 'food' };
  $('#tx-dialog-title').textContent = t ? 'แก้ไขรายการ' : 'เพิ่มรายการ';
  $('#tx-amount').value = t ? String(t.amount) : '';
  $('#tx-note').value = t ? t.note || '' : '';
  // วันที่ default: วันนี้ (หรือวันที่ 1 ของเดือนที่กำลังดู ถ้าไม่ใช่เดือนนี้ → ใช้วันนี้ถ้าอยู่ในเดือนนั้น)
  const def = today().startsWith(ui.month) ? today() : ui.month + '-01';
  $('#tx-date').value = t ? t.date : def;
  $('#tx-delete').hidden = !t;
  renderTxForm();
  txDlg.showModal();
  if (!t) setTimeout(() => $('#tx-amount').focus(), 50);
}

function renderTxForm() {
  $$('#tx-type button').forEach((b) => b.classList.toggle('on', b.dataset.type === txDraft.type));
  $('#tx-cats').replaceChildren(
    ...catsOf(txDraft.type).map((c) =>
      h('button', {
        type: 'button', class: 'chip' + (c.id === txDraft.category ? ' on' : ''),
        onclick: () => { txDraft.category = c.id; renderTxForm(); },
      }, `${c.icon} ${c.name}`)
    )
  );
}

$$('#tx-type button').forEach((b) =>
  b.addEventListener('click', () => {
    if (txDraft.type === b.dataset.type) return;
    txDraft.type = b.dataset.type;
    txDraft.category = catsOf(txDraft.type)[0].id;
    renderTxForm();
  })
);

$('#tx-amount').addEventListener('input', (e) => e.target.setCustomValidity(''));
$('#fab').addEventListener('click', () => openTxDialog(null));
$('#tx-cancel').addEventListener('click', () => txDlg.close());

$('#tx-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseAmount($('#tx-amount').value);
  const date = $('#tx-date').value;
  // แจ้งเตือนในตัว input เอง (toast จะถูก dialog บังเพราะ dialog อยู่ top layer)
  if (amount == null) {
    $('#tx-amount').setCustomValidity('กรุณาใส่จำนวนเงินให้ถูกต้อง เช่น 120 หรือ 59.50');
    $('#tx-amount').reportValidity();
    return;
  }
  if (!DATE_RE.test(date)) return;
  const note = $('#tx-note').value.trim();
  if (txDraft.id) {
    const t = state.tx.find((x) => x.id === txDraft.id);
    if (t) stamp(Object.assign(t, { type: txDraft.type, category: txDraft.category, amount, date, note }));
  } else {
    state.tx.push(stamp({ id: uid(), type: txDraft.type, category: txDraft.category, amount, date, note, createdAt: Date.now() }));
  }
  // ถ้าบันทึกเป็นวันในเดือนอื่น ให้พาไปดูเดือนนั้น เพื่อให้เห็นรายการที่เพิ่งเพิ่ม
  ui.month = date.slice(0, 7);
  txDlg.close();
  commit();
});

$('#tx-delete').addEventListener('click', () => {
  const t = state.tx.find((x) => x.id === txDraft?.id);
  if (!t) return;
  state.tx = state.tx.filter((x) => x.id !== t.id);
  bury([t]);
  txDlg.close();
  commit();
  toast('ลบรายการแล้ว', 'เลิกทำ', () => { unbury([t]); state.tx.push(t); commit(); });
});

// ปิด dialog เมื่อแตะพื้นหลัง
for (const dlg of [txDlg, todoDlg]) {
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
}

/* =========================================================
   MORE: export / import / wipe
   ========================================================= */
async function saveFile(name, mime, text) {
  const file = new File([text], name, { type: mime });
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; }
    catch (e) { if (e.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

$('#btn-export-json').addEventListener('click', () => {
  const payload = { app: 'todo-money', version: 1, exportedAt: new Date().toISOString(), ...state };
  saveFile(`todo-money-backup-${today()}.json`, 'application/json', JSON.stringify(payload, null, 2));
});

const csvCell = (v) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // กัน formula injection ใน Excel/Numbers
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
$('#btn-export-csv').addEventListener('click', () => {
  const rows = [['date', 'type', 'category', 'amount', 'note']];
  for (const t of [...state.tx].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)) {
    rows.push([t.date, t.type === 'income' ? 'รายรับ' : 'รายจ่าย', findCat(t.type, t.category).name, t.amount, t.note || '']);
  }
  const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  saveFile(`money-${today()}.csv`, 'text/csv', csv);
});

$('#file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.todos) || !Array.isArray(data.tx)) throw new Error('bad shape');
    const str = (v, max) => String(v ?? '').slice(0, max);
    const todos = data.todos
      .filter((t) => t && typeof t.title === 'string' && t.title.trim())
      .map((t) => ({
        id: str(t.id, 64) || uid(), title: str(t.title, 200), detail: str(t.detail, 5000).trim(), due: DATE_RE.test(t.due) ? t.due : '',
        done: !!t.done, createdAt: Number(t.createdAt) || Date.now(), doneAt: Number(t.doneAt) || 0,
        updatedAt: Number(t.updatedAt) || 0,
      }));
    const tx = data.tx
      .filter((t) => t && (t.type === 'income' || t.type === 'expense') && Number.isFinite(Number(t.amount)) && Number(t.amount) > 0 && DATE_RE.test(t.date))
      .map((t) => ({
        id: str(t.id, 64) || uid(), type: t.type, category: str(t.category, 32) || 'other',
        amount: Math.round(Number(t.amount) * 100) / 100, date: t.date, note: str(t.note, 120),
        createdAt: Number(t.createdAt) || Date.now(), updatedAt: Number(t.updatedAt) || 0,
      }));
    if (!confirm(`นำเข้า ${todos.length} งาน และ ${tx.length} รายการเงิน?\nข้อมูลปัจจุบันในเครื่องจะถูกแทนที่`)) return;
    state = { todos, tx, deleted: {} };
    commit();
    toast('นำเข้าข้อมูลแล้ว');
  } catch (_) {
    toast('ไฟล์ไม่ถูกต้อง — ใช้ไฟล์ JSON ที่ส่งออกจากแอปนี้');
  }
});

$('#btn-wipe').addEventListener('click', () => {
  if (!confirm('ลบข้อมูลทั้งหมดในเครื่องนี้ (งานและรายรับรายจ่าย) และปิด sync?\nไม่สามารถกู้คืนได้ — ควรส่งออกสำรองก่อน\n(ข้อมูลบน server และเครื่องอื่นไม่ถูกลบ)')) return;
  if (!confirm('ยืนยันอีกครั้ง: ลบทั้งหมดจริงๆ?')) return;
  state = { todos: [], tx: [], deleted: {} };
  setSyncConf(null); // ไม่ให้ sync ครั้งถัดไปดึงข้อมูลที่เพิ่งลบกลับมาเงียบๆ
  commit();
  toast('ลบข้อมูลทั้งหมดแล้ว');
});

/* =========================================================
   MORE: sync ระหว่างเครื่อง (กดเอง) — crypto/merge อยู่ใน sync.js
   ========================================================= */
const SYNC_KEY = 'todo-money:sync'; // { code, last } — แยกจาก state เพื่อไม่ให้รหัสหลุดไปในไฟล์สำรอง
function syncConf() {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY)); } catch (_) { return null; }
}
function setSyncConf(c) {
  if (c) localStorage.setItem(SYNC_KEY, JSON.stringify(c));
  else localStorage.removeItem(SYNC_KEY);
}

async function syncFetch(id, init = {}) {
  const res = await fetch('/api/sync', { ...init, cache: 'no-store', headers: { 'x-sync-id': id } });
  if (!res.ok && res.status !== 404) throw new Error(`server ตอบ ${res.status}`);
  return res;
}

// pull → merge → save → push ; mustExist = ตอนเชื่อมเครื่องใหม่ ต้องมีข้อมูลของรหัสนี้อยู่แล้ว (กันพิมพ์รหัสผิด)
async function syncNow(code, mustExist) {
  const { id, key } = await syncKeys(code);
  const res = await syncFetch(id);
  if (res.status === 404) {
    if (mustExist) throw new Error('ไม่พบข้อมูลของรหัสนี้ — ตรวจรหัสอีกครั้ง');
  } else {
    let remote;
    try { remote = await decryptState(key, await res.text()); }
    catch (_) { throw new Error('ถอดรหัสข้อมูลบน server ไม่ได้'); }
    state = mergeState(state, remote);
    save();
  }
  // ponytail: KV ไม่มี compare-and-swap — ถ้าสองเครื่องกด sync พร้อมกันเป๊ะ การแก้ไขฝั่งหนึ่งจะมาในรอบถัดไป
  await syncFetch(id, { method: 'PUT', body: await encryptState(key, state) });
}

let syncing = false;
async function runSync(code, mustExist = false) {
  if (syncing) return;
  syncing = true;
  renderSync('กำลัง sync…');
  try {
    await syncNow(code, mustExist);
    setSyncConf({ code, last: Date.now() });
    syncing = false;
    render();
    toast('Sync แล้ว');
  } catch (e) {
    syncing = false;
    renderSync('Sync ไม่สำเร็จ: ' + (e instanceof TypeError ? 'เชื่อมต่อ server ไม่ได้ (ออฟไลน์อยู่?)' : e.message));
  }
}

function renderSync(msg) {
  const c = syncConf();
  $('#sync-off').hidden = !!c;
  $('#sync-on').hidden = !c;
  $('#sync-code').textContent = c?.code || '';
  $$('#sync-now, #sync-new, #sync-join button').forEach((b) => (b.disabled = syncing));
  $('#sync-status').textContent = msg ?? (c?.last
    ? 'Sync ล่าสุด: ' + new Date(c.last).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : '');
}

$('#sync-new').addEventListener('click', () => runSync(newSyncCode()));
$('#sync-join').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('#sync-code-in');
  const code = normalizeSyncCode(input.value);
  if (!code) {
    input.setCustomValidity('รหัสไม่ถูกต้อง — ต้องมี 20 ตัวอักษร เช่น abcde-12345-fghjk-67890');
    input.reportValidity();
    return;
  }
  runSync(code, true);
});
$('#sync-code-in').addEventListener('input', (e) => e.target.setCustomValidity(''));
$('#sync-now').addEventListener('click', () => runSync(syncConf().code));
$('#sync-copy').addEventListener('click', () => {
  const link = `${location.origin}${location.pathname}#sync=${syncConf().code}`;
  navigator.clipboard.writeText(link).then(() => toast('คัดลอกลิงก์แล้ว'), () => toast('คัดลอกไม่ได้ — จดรหัสด้านบนแทน'));
});
$('#sync-disconnect').addEventListener('click', () => {
  if (!confirm('ปิด sync ในเครื่องนี้?\nข้อมูลในเครื่องยังอยู่ ถ้าจะเชื่อมใหม่ต้องใช้รหัสเดิม')) return;
  setSyncConf(null);
  renderSync();
});

// เปิดจากลิงก์ ...#sync=<code> → ใส่รหัสรอไว้ให้กดเชื่อมต่อเอง (ไม่เชื่อมอัตโนมัติ)
function takeSyncLink() {
  if (!location.hash.startsWith('#sync=')) return;
  $('#sync-code-in').value = decodeURIComponent(location.hash.slice(6));
  history.replaceState(null, '', location.pathname + location.search);
  setTab('more');
}
takeSyncLink();
window.addEventListener('hashchange', takeSyncLink);

/* =========================================================
   render
   ========================================================= */
function render() {
  $('#title').textContent = TITLES[ui.tab];
  $$('.month-label').forEach((b) => (b.textContent = monthLabel(ui.month)));
  for (const t of ['todo', 'money', 'more']) $('#view-' + t).hidden = ui.tab !== t;
  $$('.tabbar button').forEach((b) => {
    const on = b.dataset.tab === ui.tab;
    b.classList.toggle('on', on);
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('#fab').hidden = ui.tab !== 'money';

  if (ui.tab === 'todo') renderTodos();
  else if (ui.tab === 'money') renderMoney();
  else {
    $('#data-count').textContent = `ตอนนี้มี ${state.todos.length} งาน · ${state.tx.length} รายการเงิน`;
    renderSync();
  }
}

render();

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => { /* เปิดจาก file:// จะ register ไม่ได้ — ไม่เป็นไร */ });
  });
}
// ขอให้เบราว์เซอร์ไม่ล้างข้อมูลอัตโนมัติ (ถ้ารองรับ)
navigator.storage?.persist?.().catch(() => {});
