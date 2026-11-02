(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const REMOTE = /^https:\/\/script\.google(usercontent)?\.com\//.test(CFG.scriptUrl || '');

  const mem = {};
  function sget(k) {
    try { const v = localStorage.getItem(k); if (v != null) return JSON.parse(v); } catch (e) {}
    return k in mem ? mem[k] : null;
  }
  function sset(k, v) {
    mem[k] = v;
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function nowStr() { const d = new Date(); return todayStr() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); }
  function parseDate(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function weekday(s) {
    const d = parseDate(s); if (!d) return '';
    const w = d.toLocaleDateString('vi-VN', { weekday: 'long' });
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  function fmtDate(s, withWeekday) {
    const d = parseDate(s); if (!d) return s || '';
    const t = pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
    return withWeekday ? weekday(s) + ', ' + t : t;
  }
  function normalizePhone(p) {
    let d = String(p || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('84')) d = '0' + d.slice(2);
    return d;
  }
  const PHONE_RE = /^0\d{9}$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isTrue = v => v === true || /^(có|co|true|x|1|yes)$/i.test(String(v == null ? '' : v).trim());

  function startKey(s) {
    const m = /(\d{1,2})[:hH.](\d{2})/.exec(s.gio || '');
    return (s.ngay || '') + ' ' + (m ? pad(m[1]) + ':' + m[2] : '23:59');
  }
  function nowKey() { return nowStr().slice(0, 16); }

  const HAN = CFG.hanDangKyPhut != null ? +CFG.hanDangKyPhut : 120;
  function deadlineKey(s) {
    if (s.hanDangKy) return s.hanDangKy;
    const han = s.hanDangKyPhut != null && s.hanDangKyPhut !== '' ? +s.hanDangKyPhut : HAN;
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(startKey(s));
    if (!m) return '';
    const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5] - han);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function fmtDeadline(s) {
    const k = deadlineKey(s); if (!k) return '';
    return k.slice(11) + ' ngày ' + k.slice(8, 10) + '/' + k.slice(5, 7);
  }

  function sessionStatus(s) {
    if (!s.mo) return 'closed';
    const now = nowKey();
    if (s.ngay && startKey(s) <= now) return 'past';
    if (s.ngay && deadlineKey(s) && deadlineKey(s) <= now) return 'expired';
    if ((s.conLai || 0) <= 0) return 'full';
    return 'open';
  }

  const ROLES = ['Học sinh', 'Phụ huynh', 'Thầy cô'];
  function cleanReg(d) {
    const s = v => String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
    const out = {
      buoiId: s(d.buoiId),
      vaiTro: ROLES.indexOf(s(d.vaiTro)) >= 0 ? s(d.vaiTro) : 'Học sinh',
      hoTen: s(d.hoTen).slice(0, 100),
      lop: s(d.lop).slice(0, 20),
      truong: s(d.truong).slice(0, 120),
      phuHuynh: s(d.phuHuynh).slice(0, 100),
      sdt: normalizePhone(d.sdt)
    };
    if (!out.buoiId) throw new Error('Vui lòng chọn suất.');
    if (out.hoTen.length < 2) throw new Error('Vui lòng nhập họ và tên học sinh.');
    if (!out.lop) throw new Error('Vui lòng nhập lớp.');
    if (out.truong.length < 2) throw new Error('Vui lòng nhập trường.');
    if (out.vaiTro === 'Học sinh' && out.phuHuynh.length < 2) throw new Error('Vui lòng nhập họ tên phụ huynh / thầy cô.');
    if (!PHONE_RE.test(out.sdt)) throw new Error('Số điện thoại chưa đúng (10 số, bắt đầu bằng 0).');
    return out;
  }
  const sameName = (a, b) => String(a || '').toLowerCase().replace(/\s+/g, ' ').trim() === String(b || '').toLowerCase().replace(/\s+/g, ' ').trim();

  function genCode(existing) {
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let c;
    do { c = 'NS-'; for (let i = 0; i < 5; i++) c += A[Math.floor(Math.random() * A.length)]; }
    while (existing.has(c));
    return c;
  }

  const LKEY = 'ngamsao_demo_regs';
  const localRegs = () => sget(LKEY) || [];
  function localSessions() {
    const regs = localRegs();
    return (CFG.demoSessions || []).map(s => {
      const used = regs.filter(r => r.buoiId === s.id).length;
      const cap = +s.sucChua || 0;
      return Object.assign({}, s, { sucChua: cap, mo: s.mo !== false, daDangKy: used, conLai: Math.max(0, cap - used) });
    });
  }
  async function localRegister(d) {
    const x = cleanReg(d);
    const ses = localSessions().find(s => s.id === x.buoiId);
    if (!ses) throw new Error('Buổi ngắm không tồn tại.');
    const st = sessionStatus(ses);
    if (st === 'closed' || st === 'past') throw new Error('Suất này đã đóng đăng ký.');
    if (st === 'expired') throw new Error('Đã hết hạn đăng ký suất này (hạn lúc ' + fmtDeadline(ses) + ').');
    const regs = localRegs();
    const dup = regs.find(r => r.buoiId === x.buoiId && r.sdt === x.sdt && sameName(r.hoTen, x.hoTen));
    if (dup) throw new Error(dup.hoTen + ' đã đăng ký suất này rồi (mã ' + dup.ma + ').');
    if (ses.conLai <= 0) throw new Error('Suất này đã đủ người.');
    const row = Object.assign({ ma: genCode(new Set(regs.map(r => r.ma))), thoiGian: nowStr(), tenBuoi: ses.ten, ngay: ses.ngay, gio: ses.gio },
      x, { checkin: false, gioCheckin: '' });
    regs.push(row);
    sset(LKEY, regs);
    ses.daDangKy += 1; ses.conLai -= 1;
    return { ma: row.ma, session: ses };
  }

  async function readJson(r) {
    if (!r.ok) throw new Error('Máy chủ trả lỗi (' + r.status + ').');
    let j;
    try { j = await r.json(); } catch (e) { throw new Error('Máy chủ trả dữ liệu lạ — kiểm tra lại URL Web App và quyền truy cập "Anyone".'); }
    if (!j.ok) throw new Error(j.error || 'Có lỗi xảy ra.');
    return j;
  }
  async function post(payload) {
    let r;
    try {
      r = await fetch(CFG.scriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
    } catch (e) { throw new Error('Không kết nối được máy chủ. Kiểm tra Internet rồi thử lại.'); }
    return readJson(r);
  }
  async function get(action) {
    let r;
    try { r = await fetch(CFG.scriptUrl + (CFG.scriptUrl.includes('?') ? '&' : '?') + 'action=' + action); }
    catch (e) { throw new Error('Không kết nối được máy chủ. Kiểm tra Internet rồi thử lại.'); }
    return readJson(r);
  }

  const API = {
    remote: REMOTE,
    async sessions() { return REMOTE ? (await get('sessions')).sessions : localSessions(); },
    async register(d) { return REMOTE ? post({ action: 'register', data: d }) : localRegister(d); },
    async list(key) { return REMOTE ? post({ action: 'list', key }) : { sessions: localSessions(), rows: localRegs() }; },
    async checkin(key, ma, value) {
      if (REMOTE) return post({ action: 'checkin', key, ma, value: !!value });
      const regs = localRegs(); const r = regs.find(x => x.ma === ma);
      if (!r) throw new Error('Không tìm thấy mã ' + ma);
      r.checkin = !!value; r.gioCheckin = value ? nowStr() : '';
      sset(LKEY, regs);
      return { ma, checkin: r.checkin, gioCheckin: r.gioCheckin };
    },
    clearDemo() { sset(LKEY, []); }
  };

  function isRed() { return document.documentElement.classList.contains('red'); }
  function setRed(on) {
    document.documentElement.classList.toggle('red', !!on);
    sset('ngamsao_red', !!on);
    if (window.__drawSky) window.__drawSky();
  }
  if (sget('ngamsao_red')) document.documentElement.classList.add('red');

  function sky() {
    const c = document.getElementById('sky'); if (!c || !c.getContext) return;
    const ctx = c.getContext('2d');
    function draw() {
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = innerWidth, h = innerHeight;
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      let seed = 20261031;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const col = isRed() ? '255,60,60' : '232,236,255';
      const n = Math.round(w * h / 4200);
      for (let i = 0; i < n; i++) {
        const x = rnd() * w, y = rnd() * h;
        const big = rnd() > 0.94, r = big ? 0.9 + rnd() * 1.1 : 0.25 + rnd() * 0.75;
        ctx.fillStyle = 'rgba(' + col + ',' + (0.25 + rnd() * 0.7).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
    }
    window.__drawSky = draw;
    draw();
    let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(draw, 150); });
  }

  window.NS = { CFG, API, sget, sset, esc, pad, todayStr, nowStr, parseDate, weekday, fmtDate, normalizePhone,
    PHONE_RE, EMAIL_RE, isTrue, sessionStatus, startKey, deadlineKey, fmtDeadline, cleanReg, sky, setRed, isRed };
})();
