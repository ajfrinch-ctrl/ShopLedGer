/* ============================================================================
   ShopLedGer — Mobile UI Config & Renderer   (ui.js)
   ----------------------------------------------------------------------------
   এই ফাইলে ৩টা অংশ:
     ১) CONFIG  → সব টেক্সট, ভ্যালু, আইকন, রঙ, ট্যাব (বদলানোর মূল জায়গা)
     ২) ICONS   → SVG আইকনের লাইব্রেরি (নতুন আইকন এখানে যোগ করুন)
     ৩) RENDER  → CONFIG পড়ে HTML বানায় (সাধারণত এখানে হাত দেওয়ার দরকার নেই)

   রঙ/radius/shadow/font-size বদলাতে → ui.css (ওপরের `:root` টোকেন)
   ============================================================================ */

/* ==========================================================================
   ১) CONFIG — এখানে যা ইচ্ছা বদলান
   ========================================================================== */

const CONFIG = {
  /* ---------- অ্যাপ পরিচয় ---------- */
  app: {
    name: 'ShopLedGer',
    subtitle: 'দোকান হিসাব',        // ছোট গ্রে সাবটাইটেল
    logoIcon: 'store',              // ICONS-এর যেকোনো key
  },

  /* ---------- হেডারের ডান পাশ ---------- */
  status: {
    text: 'অনলাইন',
    // অনলাইন/অফলাইন অনুযায়ী অটো বদলাতে চাইলে এই ফাংশন ব্যবহার করুন:
    auto: true,                     // true = ব্রাউজারের নেটওয়ার্ক অবস্থা দেখাবে
    offlineText: 'অফলাইন',
  },

  menu: [
    { icon: 'fileText', label: 'রিপোর্ট সেন্টার', href: '#reports' },
    { icon: 'users',     label: 'ক্রেতা তালিকা',   href: '#customers' },
    { icon: 'settings',  label: 'সেটিংস',         href: '#settings' },
  ],

  /* ---------- মেইন সামারি কার্ড ---------- */
  summary: {
    icon: 'barChart',
    title: 'আজকের হিসাব',
    date: '',                        // '' = আজকের তারিখ অটো (বাংলা)
    // date: '১৯ সেপ্টেম্বর, ২০২৬',  // নিজে লিখতে চাইলে এভাবে

    /* ৩-কলাম স্ট্যাট বক্স — ৩টার বেশি দিলে গ্রিড নিজেই ভাঙবে না,
       তবে ডিজাইন ৩টার জন্যই optimize করা। */
    stats: [
      {
        label: 'বিক্রি',
        value: 12500,                // সংখ্যা দিলে নিজেই "৳ ১২,৫০০" হবে
        sub: '৮টি',
        icon: 'cart',
        grad: 'var(--orange)',       // ui.css থেকে
        tint: 'var(--tint-orange)',  // হালকা প্যাস্টেল ব্যাকগ্রাউন্ড
      },
      {
        label: 'আদায়',
        value: 8200,
        sub: 'বাকি আদায়',
        icon: 'wallet',
        grad: 'var(--green)',
        tint: 'var(--tint-green)',
      },
      {
        label: 'খরচ',
        value: 1800,
        sub: 'দোকান খরচ',
        icon: 'receipt',
        grad: 'var(--blue)',
        tint: 'var(--tint-blue)',
      },
    ],

    /* কার্ডের নিচের ফুল-উইথ হাইলাইট ব্যানার (টোটাল সামারি) */
    banner: {
      icon: 'trendingUp',
      label: 'আজকের নিট লাভ',
      sub: 'খরচ বাদে',
      value: 2500,
      meta: 'আপডেটেড',
      metaIcon: 'sparkles',
    },
  },

  /* ---------- Quick Actions ---------- */
  quickActions: {
    title: 'দ্রুত কাজ',
    showCount: true,                 // ডানে "৪টি অপশন" পিল দেখাবে কিনা
    items: [
      { label: 'নতুন বিক্রি', icon: 'plus',       grad: 'var(--green)',  shadow: 'rgba(4,121,90,.25)',  href: '#sales' },
      { label: 'বাকি আদায়',  icon: 'wallet',     grad: 'var(--orange)', shadow: 'rgba(249,115,22,.25)', href: '#collections' },
      { label: 'ক্রয়',        icon: 'shoppingBag',grad: 'var(--blue)',   shadow: 'rgba(59,130,246,.25)', href: '#purchases' },
      { label: 'খরচ',         icon: 'receipt',    grad: 'var(--violet)', shadow: 'rgba(139,92,246,.25)', href: '#expenses' },
    ],
  },

  /* ---------- অতিরিক্ত তালিকা কার্ড (ঐচ্ছিক — [] দিলে উধাও হবে) ---------- */
  sections: [
    {
      title: 'বর্তমান হিসাব',
      rows: [
        { icon: 'arrowDown', title: 'আমরা পাব',      sub: 'ক্রেতার বাকি',            value: 45200,   tint: 'var(--tint-green)', ink: 'var(--brand)' },
        { icon: 'package',   title: 'মোট স্টক মূল্য', sub: '১২টি পণ্য • সব ঠিক আছে', value: 123000,  tint: 'var(--tint-blue)',  ink: '#2563eb' },
      ],
    },
  ],

  /* ---------- Bottom Navigation ---------- */
  nav: [
    { id: 'home',        label: 'হোম',   icon: 'grid',        href: '#/' },
    { id: 'sales',       label: 'বিক্রি', icon: 'cart',        href: '#/sales' },
    { id: 'stock',       label: 'স্টক',  icon: 'package',     href: '#/stock' },
    { id: 'dues',        label: 'বাকি',  icon: 'wallet',      href: '#/collections' },
    { id: 'more',        label: 'আরও',   icon: 'more',        href: '#/more' },
  ],
  activeTab: 'home',                 // শুরুতে কোন ট্যাব অ্যাক্টিভ
};

/* ==========================================================================
   ২) ICONS — SVG আইকন লাইব্রেরি (24×24 viewBox, stroke-based)
      নতুন আইকন লাগলে এখানে এক লাইন যোগ করুন, তারপর CONFIG-এ key বসান।
   ========================================================================== */

const ICONS = {
  store:       '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  menu:        '<path d="M3 6h18M3 12h18M3 18h18"/>',
  close:       '<path d="M18 6 6 18M6 6l12 12"/>',
  barChart:    '<path d="M12 20V10M18 20V4M6 20v-4"/>',
  cart:        '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
  wallet:      '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  receipt:     '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8"/>',
  fileText:    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
  shoppingBag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  trendingUp:  '<path d="m23 6-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  sparkles:    '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  plus:        '<path d="M12 5v14M5 12h14"/>',
  grid:        '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  package:     '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  arrowDown:   '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  arrowUp:     '<path d="M12 19V5M5 12l7-7 7 7"/>',
  more:        '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  settings:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  users:       '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
};

/* ==========================================================================
   ৩) HELPERS
   ========================================================================== */

/** আইকনের নাম → সম্পূর্ণ <svg> */
function icon(name, size, strokeWidth) {
  const body = ICONS[name] || '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="${strokeWidth || 2}" stroke-linecap="round" stroke-linejoin="round"
    ${size ? `width="${size}" height="${size}"` : ''} aria-hidden="true">${body}</svg>`;
}

/** ইংরেজি সংখ্যা → বাংলা সংখ্যা */
const BN_DIGITS = { 0: '০', 1: '১', 2: '২', 3: '৩', 4: '৪', 5: '৫', 6: '৬', 7: '৭', 8: '৮', 9: '৯' };
const toBn = (v) => String(v).replace(/[0-9]/g, (d) => BN_DIGITS[d]);

/** টাকা ফরম্যাট: 12500 → "৳ ১২,৫০০" (বাংলা সংখ্যা + lakh/crore গ্রুপিং) */
function money(value) {
  if (typeof value === 'string') return value;               // আগেই ফরম্যাট করা টেক্সট
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const sign = n < 0 ? '−' : '';                             // ক্ষতি হলে নেগেটিভ চিহ্ন
  const text = Math.abs(n).toLocaleString('en-IN');           // 1,23,000 স্টাইল
  return `${sign}৳ ${toBn(text)}`;
}

/** আজকের বাংলা তারিখ: "১৯ সেপ্টেম্বর, ২০২৬" */
function banglaDate(d) {
  const date = d || new Date();
  return toBn(date.toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }));
}

/** ছোট সংখ্যাও বাংলায়: 8 → ৮ */
const bnCount = (v) => (typeof v === 'number' ? `${toBn(v)}টি` : v || '');

/* ==========================================================================
   ৪) RENDER — CONFIG থেকে HTML বানানো
   ========================================================================== */

function statBox(s) {
  return `
    <div class="stat" style="--tint:${s.tint || 'var(--bg)'}; --grad:${s.grad || 'var(--green)'}">
      <div class="stat-icon">${icon(s.icon)}</div>
      <div class="stat-label">${s.label}</div>
      <div class="stat-value">${money(s.value)}</div>
      ${s.sub ? `<div class="stat-sub">${s.sub}</div>` : ''}
    </div>`;
}

function actionButton(a) {
  return `
    <a class="action" href="${a.href || '#'}" style="--grad:${a.grad || 'var(--green)'}; --grad-shadow:${a.shadow || 'rgba(4,121,90,.25)'}">
      <div class="action-icon">${icon(a.icon)}</div>
      <div class="action-label">${a.label}</div>
    </a>`;
}

function listRow(r) {
  return `
    <div class="row" style="--tint:${r.tint || 'var(--bg)'}; --row-ink:${r.ink || 'var(--brand)'}">
      <div class="row-icon">${icon(r.icon)}</div>
      <div class="row-body">
        <div class="row-title">${r.title}</div>
        ${r.sub ? `<div class="row-sub">${r.sub}</div>` : ''}
      </div>
      <div class="row-value">${money(r.value)}</div>
    </div>`;
}

function renderHeader(c) {
  return `
  <header class="header">
    <div class="header-left">
      <div class="logo">${icon(c.app.logoIcon)}</div>
      <div>
        <div class="app-name">${c.app.name}</div>
        <div class="app-sub">${c.app.subtitle}</div>
      </div>
    </div>
    <div class="header-right">
      <div class="pill" id="statusPill">
        <span class="pill-dot"></span>
        <span class="pill-text" id="statusText">${c.status.text}</span>
      </div>
      <button class="hamburger" id="menuBtn" aria-label="মেনু" aria-expanded="false">${icon('menu')}</button>
    </div>
  </header>
  <div class="menu" id="menu">
    ${c.menu.map((m) => `<a class="menu-item" href="${m.href || '#'}">${icon(m.icon)}<span>${m.label}</span></a>`).join('')}
  </div>`;
}

function renderSummary(c) {
  const s = c.summary;
  const b = s.banner;
  const negative = typeof b.value === 'number' && b.value < 0;
  return `
  <section class="card">
    <div class="card-body">
      <div class="card-head">
        <div class="card-title-wrap">
          <div class="card-icon">${icon(s.icon)}</div>
          <h2 class="card-title">${s.title}</h2>
        </div>
        <span class="card-date">${s.date || banglaDate()}</span>
      </div>
      <div class="grid3">${s.stats.map(statBox).join('')}</div>
    </div>
    ${b ? `
    <div class="banner">
      <div class="banner-left">
        <div class="banner-icon">${icon(b.icon)}</div>
        <div>
          <div class="banner-label">${b.label}</div>
          ${b.sub ? `<div class="banner-sub">${b.sub}</div>` : ''}
        </div>
      </div>
      <div class="banner-right">
        <div class="banner-value ${negative ? 'is-negative' : ''}">${money(b.value)}</div>
        ${b.meta ? `<div class="banner-meta">${icon(b.metaIcon || 'sparkles', 10)} ${b.meta}</div>` : ''}
      </div>
    </div>` : ''}
  </section>`;
}

function renderQuickActions(c) {
  const q = c.quickActions;
  if (!q || !q.items || !q.items.length) return '';
  return `
  <section>
    <div class="section-head">
      <h3 class="section-title">${q.title}</h3>
      ${q.showCount !== false ? `<span class="section-sub">${toBn(q.items.length)}টি অপশন</span>` : ''}
    </div>
    <div class="quick-card">
      <div class="grid4">${q.items.map(actionButton).join('')}</div>
    </div>
  </section>`;
}

function renderSections(c) {
  return (c.sections || []).map((sec) => `
    <section>
      ${sec.title ? `<div class="section-head"><h3 class="section-title">${sec.title}</h3>${sec.sub ? `<span class="section-sub">${sec.sub}</span>` : ''}</div>` : ''}
      <div class="card list-card">${sec.rows.map(listRow).join('')}</div>
    </section>`).join('');
}

function renderNav(c, activeId) {
  return `
  <nav class="bottom-nav" id="bottomNav">
    ${c.nav.map((t) => `
      <a class="tab ${t.id === activeId ? 'active' : ''}" href="${t.href || '#'}" data-tab="${t.id}">
        <span class="tab-icon">${icon(t.icon, 20, t.id === activeId ? 2.4 : 1.8)}</span>
        <span class="tab-label">${t.label}</span>
      </a>`).join('')}
  </nav>`;
}

/* ==========================================================================
   ৫) BOOT — পেজ লোডে সব বসিয়ে দেয় + ছোটখাটো ইন্টারঅ্যাকশন
   ========================================================================== */

function mount(config, root) {
  const cfg = config || CONFIG;
  const el = root || document.getElementById('app');
  const storedTab = (() => { try { return localStorage.getItem('sl.activeTab'); } catch { return null; } })();
  const activeId = storedTab || cfg.activeTab || (cfg.nav[0] && cfg.nav[0].id);

  el.innerHTML = `
    ${renderHeader(cfg)}
    <main class="content">
      ${renderSummary(cfg)}
      ${renderQuickActions(cfg)}
      ${renderSections(cfg)}
    </main>
    ${renderNav(cfg, activeId)}`;

  /* --- hamburger মেনু টগল --- */
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(open));
      btn.innerHTML = icon(open ? 'close' : 'menu');
    });
    document.addEventListener('click', (e) => {
      if (menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) {
        menu.classList.remove('open');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = icon('menu');
      }
    });
  }

  /* --- bottom nav: ট্যাবে চাপলে অ্যাক্টিভ বদলাবে (এবং মনে রাখবে) --- */
  const nav = document.getElementById('bottomNav');
  if (nav) {
    nav.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab');
      if (!tab) return;
      nav.querySelectorAll('.tab').forEach((t) => {
        const on = t === tab;
        t.classList.toggle('active', on);
        const id = t.dataset.tab;
        const item = (cfg.nav.find((n) => n.id === id) || {});
        t.querySelector('.tab-icon').innerHTML = icon(item.icon, 20, on ? 2.4 : 1.8);
      });
      try { localStorage.setItem('sl.activeTab', tab.dataset.tab); } catch { /* noop */ }
    });
  }

  /* --- অনলাইন/অফলাইন স্ট্যাটাস পিল --- */
  if (cfg.status.auto) {
    const text = document.getElementById('statusText');
    const sync = () => { if (text) text.textContent = navigator.onLine ? cfg.status.text : cfg.status.offlineText; };
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    sync();
  }
}

/** ?w=375 দিলে সেই width-এ রেন্ডার — প্রিভিউ গ্যালারির জন্য */
function applyPreviewWidth() {
  const w = parseInt(new URLSearchParams(location.search).get('w') || '0', 10);
  if (w >= 320 && w <= 520) {
    document.documentElement.style.width = w + 'px';
    const m = document.querySelector('meta[name=viewport]');
    if (m) m.setAttribute('content', `width=${w}, initial-scale=1.0`);
  }
}

/* --- অন্য ফাইল থেকে import করলেও চলবে, সরাসরি খুললেও চলবে --- */
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { applyPreviewWidth(); mount(); });
  } else {
    applyPreviewWidth();
    mount();
  }
}

/* --- অন্য স্ক্রিপ্ট/টেস্ট থেকে সহজে পৌঁছানোর জন্য গ্লোবাল API ---
      ব্যবহার: ShopLedgerUI.mount(ShopLedgerUI.CONFIG)                 */
const ShopLedgerUI = { CONFIG, ICONS, icon, money, toBn, banglaDate, bnCount, mount, renderHeader, renderSummary, renderQuickActions, renderSections, renderNav };
if (typeof globalThis !== 'undefined') globalThis.ShopLedgerUI = ShopLedgerUI;
