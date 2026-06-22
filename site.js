/* ============================================
   Stuttons United — shared script
   countdown + snowfall + reveal + tweaks load
   ============================================ */

(function () {
  // ---------- tweaks persistence ----------
  // Tweaks live in localStorage so they apply across pages.
  const TWEAK_KEYS = {
    palette: 'dusk',
    type: 'garamond-classic',
    hero: 'fullbleed',
    motion: 'rich', // off | subtle | rich
  };
  function loadTweaks() {
    try {
      const raw = localStorage.getItem('su-tweaks');
      if (raw) Object.assign(TWEAK_KEYS, JSON.parse(raw));
    } catch (e) {}
    applyTweaks();
  }
  function applyTweaks() {
    const root = document.documentElement;
    root.dataset.palette = TWEAK_KEYS.palette;
    root.dataset.type = TWEAK_KEYS.type;
    root.dataset.hero = TWEAK_KEYS.hero;
    root.dataset.motion = TWEAK_KEYS.motion;
    const m = TWEAK_KEYS.motion;
    root.style.setProperty('--snowfall-opacity', m === 'off' ? '0' : m === 'rich' ? '0.85' : '0.55');
    root.style.setProperty('--parallax-strength', m === 'off' ? '0' : m === 'rich' ? '1.4' : '1');
    // hero variant
    const hero = document.querySelector('.hero[data-hero-target]');
    if (hero) hero.setAttribute('data-hero', TWEAK_KEYS.hero);
  }
  window.__suGetTweak = (k) => TWEAK_KEYS[k];
  window.__suSetTweak = (patch) => {
    Object.assign(TWEAK_KEYS, patch);
    try { localStorage.setItem('su-tweaks', JSON.stringify(TWEAK_KEYS)); } catch (e) {}
    applyTweaks();
  };
  loadTweaks();

  // ---------- countdown ----------
  function tickCountdown() {
    const target = new Date('2027-02-13T17:00:00-08:00').getTime();
    const now = Date.now();
    let diff = Math.max(0, target - now);
    const d = Math.floor(diff / 86400000); diff -= d * 86400000;
    const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
    const m = Math.floor(diff / 60000);    diff -= m * 60000;
    const s = Math.floor(diff / 1000);
    const pad = (n) => String(n).padStart(2, '0');
    const set = (sel, val) => { document.querySelectorAll(sel).forEach(n => n.textContent = val); };
    set('[data-cd="d"]', pad(d));
    set('[data-cd="h"]', pad(h));
    set('[data-cd="m"]', pad(m));
    set('[data-cd="s"]', pad(s));
  }
  tickCountdown();
  setInterval(tickCountdown, 1000);

  // ---------- snowfall (canvas) ----------
  function startSnow() {
    if (document.querySelector('.snowfall')) return;
    const c = document.createElement('canvas');
    c.className = 'snowfall';
    document.body.appendChild(c);
    const ctx = c.getContext('2d');
    let w, h, flakes;
    function resize() {
      w = c.width = window.innerWidth * devicePixelRatio;
      h = c.height = window.innerHeight * devicePixelRatio;
      c.style.width = window.innerWidth + 'px';
      c.style.height = window.innerHeight + 'px';
    }
    function init() {
      const motion = window.__suGetTweak('motion');
      const count = motion === 'rich' ? 120 : motion === 'off' ? 0 : 60;
      flakes = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: (Math.random() * 1.8 + 0.4) * devicePixelRatio,
        vy: (Math.random() * 0.5 + 0.25) * devicePixelRatio,
        vx: (Math.random() - 0.5) * 0.25 * devicePixelRatio,
        a: Math.random() * 0.4 + 0.3,
      }));
    }
    resize();
    init();
    window.addEventListener('resize', () => { resize(); init(); });
    window.addEventListener('su:tweak', init);
    function frame() {
      ctx.clearRect(0, 0, w, h);
      const dark = document.documentElement.dataset.palette === 'dusk';
      // In Dusk, give the snowfall a warm gold tint to read with the foil palette.
      ctx.fillStyle = dark ? 'rgba(240, 219, 168, 0.8)' : 'rgba(255,255,255,0.95)';
      for (const f of flakes) {
        f.x += f.vx;
        f.y += f.vy;
        if (f.y > h) { f.y = -10; f.x = Math.random() * w; }
        if (f.x < -10) f.x = w + 10;
        if (f.x > w + 10) f.x = -10;
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(frame);
    }
    frame();
  }
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) startSnow();

  // ---------- reveal on scroll ----------
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));

  // ---------- hero slide toggle ----------
  const heroDots = document.querySelectorAll('.hero-dot');
  const heroSlides = document.querySelectorAll('.hero-slide');
  if (heroDots.length && heroSlides.length) {
    let activeSlide = 0;
    let autoTimer = null;
    function showSlide(i) {
      activeSlide = i;
      heroSlides.forEach((s, k) => s.classList.toggle('active', k === i));
      heroDots.forEach((d, k) => d.classList.toggle('active', k === i));
    }
    function startAuto() {
      autoTimer = setInterval(() => {
        showSlide((activeSlide + 1) % heroSlides.length);
      }, 5000);
    }
    function stopAuto() {
      if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
    }
    heroDots.forEach((d, k) => {
      d.addEventListener('click', () => {
        stopAuto();
        showSlide(k);
      });
    });
    startAuto();
  }
  const heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY || 0;
        const motion = window.__suGetTweak('motion');
        const strength = motion === 'off' ? 0 : motion === 'rich' ? 0.35 : 0.18;
        heroBg.style.transform = `translate3d(0, ${y * strength}px, 0) scale(${1 + y * 0.0002})`;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---------- broadcast tweak changes ----------
  const _set = window.__suSetTweak;
  window.__suSetTweak = (patch) => {
    _set(patch);
    window.dispatchEvent(new CustomEvent('su:tweak', { detail: patch }));
  };
})();
