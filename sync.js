'use strict';

/* =========================================================
   Sync helpers — ไม่แตะ DOM / state (ทดสอบ: node --test)
   - รหัส sync = ความลับเดียว: ใช้ทั้งหา blob บน server (id) และเข้ารหัส (key)
   - server เห็นแค่ id (hash) กับ ciphertext
   ========================================================= */

const SYNC_ALPHABET = '0123456789abcdefghjkmnpqrstvwxyz'; // Crockford base32 (ไม่มี i l o u)

// 20 ตัว × 5 bit = 100 bit, แสดงเป็น xxxxx-xxxxx-xxxxx-xxxxx
function newSyncCode() {
  const b = crypto.getRandomValues(new Uint8Array(20));
  return [...b].map((x) => SYNC_ALPHABET[x % 32]).join('').replace(/(.{5})(?=.)/g, '$1-');
}

// รับได้ทั้งรหัสเปล่าๆ และลิงก์ ...#sync=<code> ; คืน '' ถ้ารูปแบบไม่ถูก
function normalizeSyncCode(input) {
  const s = String(input).toLowerCase().split('sync=').pop().replace(/[^0-9a-z]/g, '')
    .replace(/o/g, '0').replace(/[il]/g, '1'); // พิมพ์ผิดที่พบบ่อย (Crockford)
  return s.length === 20 && [...s].every((c) => SYNC_ALPHABET.includes(c))
    ? s.replace(/(.{5})(?=.)/g, '$1-')
    : '';
}

const sha256 = async (text) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
const toB64 = (bytes) => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

// รหัสมี entropy 100 bit จึงใช้ SHA-256 แยก domain เป็น KDF ได้ ไม่ต้อง PBKDF2
async function syncKeys(code) {
  const id = [...(await sha256('todo-money/id/' + code))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', await sha256('todo-money/key/' + code), 'AES-GCM', false, ['encrypt', 'decrypt']);
  return { id, key };
}

async function encryptState(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(obj))));
  return JSON.stringify({ v: 1, iv: toB64(iv), ct: toB64(ct) });
}

// throws ถ้ารหัสผิดหรือข้อมูลถูกแก้ (AES-GCM ตรวจความถูกต้องให้)
async function decryptState(key, text) {
  const { iv, ct } = JSON.parse(text);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

// รวมสองฝั่ง: ต่อ id เอาเวอร์ชัน updatedAt ใหม่สุด; tombstone ที่ใหม่กว่ารายการ = ลบ
// ponytail: เก็บ tombstone 180 วัน — เครื่องที่ไม่ได้ sync นานกว่านั้นอาจทำให้รายการที่ลบแล้วกลับมา
const TOMBSTONE_TTL = 180 * 86400000;
function mergeState(a, b, now = Date.now()) {
  const deleted = {};
  for (const [id, at] of [...Object.entries(a.deleted || {}), ...Object.entries(b.deleted || {})]) {
    if (at > now - TOMBSTONE_TTL && !(deleted[id] >= at)) deleted[id] = at;
  }
  const pick = (xs = [], ys = []) => {
    const m = new Map();
    for (const x of [...xs, ...ys]) {
      const cur = m.get(x.id);
      if (!cur || (x.updatedAt || 0) > (cur.updatedAt || 0)) m.set(x.id, x); // เท่ากัน → ฝั่ง a (เครื่องนี้) ชนะ
    }
    return [...m.values()].filter((x) => !(deleted[x.id] > (x.updatedAt || 0)));
  };
  return { todos: pick(a.todos, b.todos), tx: pick(a.tx, b.tx), deleted };
}
