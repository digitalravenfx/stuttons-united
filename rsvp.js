/* RSVP — multi-step state machine */
(function () {
  const state = {
    step: 1,
    name: '',
    email: '',
    attending: null, // 'yes' | 'no'
    events: { thu: false, 'fri-day': false, 'fri-dinner': false, sat: true, sun: false },
    plusone: 'no',
    guestName: '',
    guestEmail: '',
    numberAttending: '',
    numberChildcare: '',
    diet: '',
    song: '',
    advice: '',
    memory: '',
    fridayActivities: [],
  };

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  function show(stepNum) {
    state.step = stepNum;
    $$('.rsvp-step').forEach(s => s.classList.toggle('active', +s.dataset.step === stepNum));
    $$('#progress .step').forEach((s, i) => {
      const n = i + 1;
      s.classList.toggle('done', n < stepNum);
      s.classList.toggle('active', n === stepNum);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function readForm() {
    state.name = $('#name')?.value.trim() || state.name;
    state.email = $('#email')?.value.trim() || state.email;
    state.guestName = $('#guest-name')?.value.trim() || state.guestName;
    state.guestEmail = $('#guest-email')?.value.trim() || state.guestEmail;
    state.numberAttending = $('#num-attending')?.value.trim() || state.numberAttending;
    state.numberChildcare = $('#num-childcare')?.value.trim() || state.numberChildcare;
    state.diet = $('#diet')?.value.trim() || state.diet;
    state.song = $('#song')?.value.trim() || state.song;
    state.advice = $('#advice')?.value.trim() || state.advice;
    state.memory = $('#memory')?.value.trim() || state.memory;
  }

  function validateStep1() {
    const name = $('#name').value.trim();
    const email = $('#email').value.trim();
    if (!name) { $('#name').focus(); return false; }
    if (!email || !email.includes('@')) { $('#email').focus(); return false; }
    return true;
  }

  // attendance choices
  $$('[data-attending]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.attending = btn.dataset.attending;
      $$('[data-attending]').forEach(b => b.classList.toggle('selected', b === btn));
      $('#events-block').style.display = state.attending === 'yes' ? 'block' : 'none';
    });
  });

  // event checks
  $$('.event-check').forEach(el => {
    el.addEventListener('click', () => {
      const key = el.dataset.event;
      state.events[key] = !state.events[key];
      el.classList.toggle('checked', state.events[key]);
      if (key === 'fri-day') updateFridayBlock();
    });
  });

  function updateFridayBlock() {
    const block = document.getElementById('friday-block');
    if (block) block.style.display = state.events['fri-day'] ? 'flex' : 'none';
  }

  // Friday activity multi-select (max 3)
  const FRIDAY_MAX = 3;
  $$('[data-friday]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.friday;
      if (input.checked) {
        if (state.fridayActivities.length >= FRIDAY_MAX) {
          input.checked = false;
          return;
        }
        if (!state.fridayActivities.includes(key)) state.fridayActivities.push(key);
      } else {
        state.fridayActivities = state.fridayActivities.filter(k => k !== key);
      }
      updateFridayLimits();
    });
  });
  function updateFridayLimits() {
    const count = state.fridayActivities.length;
    const counter = document.getElementById('friday-count');
    if (counter) counter.textContent = count;
    const atMax = count >= FRIDAY_MAX;
    $$('[data-friday]').forEach(input => {
      const opt = input.closest('.friday-opt');
      if (!input.checked && atMax) {
        opt.classList.add('disabled');
      } else {
        opt.classList.remove('disabled');
      }
    });
  }

  // plusone
  $$('[data-plusone]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.plusone = btn.dataset.plusone;
      $$('[data-plusone]').forEach(b => b.classList.toggle('selected', b === btn));
      $('#guest-name-field').style.display = state.plusone === 'yes' ? 'flex' : 'none';
      $('#guest-email-field').style.display = state.plusone === 'yes' ? 'flex' : 'none';
    });
  });

  // next/back buttons
  $$('[data-action="next"]').forEach(btn => {
    btn.addEventListener('click', () => {
      readForm();
      if (state.step === 1) {
        if (!validateStep1()) return;
        show(2);
      } else if (state.step === 2) {
        if (state.attending === null) {
          // require pick
          $$('[data-attending]')[0].animate(
            [{ transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'none' }],
            { duration: 200, iterations: 2 }
          );
          return;
        }
        if (state.attending === 'no') {
          // skip step 3 entirely — submit immediately
          submitToNetlify(btn);
        } else {
          show(3);
        }
      } else if (state.step === 3) {
        submitToNetlify(btn);
      }
    });
  });

  // Sync state into the hidden form inputs Netlify reads
  function syncHiddenInputs() {
    const a = document.getElementById('hidden-attending');
    if (a) a.value = state.attending || '';
    const p = document.getElementById('hidden-plusone');
    if (p) p.value = state.plusone || 'no';
    const e = document.getElementById('hidden-events');
    if (e) {
      const list = [];
      if (state.events['thu']) list.push('Thursday cocktails');
      if (state.events['fri-day']) list.push('Friday activities');
      if (state.events['fri-dinner']) list.push('Friday dinner');
      if (state.events['sat']) list.push('Saturday ceremony & reception');
      if (state.events['sun']) list.push('Sunday brunch');
      e.value = list.join(', ');
    }
  }

  // Human-readable labels for the Friday activity multi-select (Notion options).
  const FRIDAY_LABELS = {
    'ski-snowboard': 'Ski or snowboard',
    'xc-ski': 'Cross-country skiing',
    'sledding': 'Sledding',
    'snow-tubing': 'Snow tubing',
    'snowshoeing': 'Snowshoeing',
    'snowmobiling': 'Snowmobiling',
    'reindeer': 'Reindeer Farm',
    'alpine-slide': 'Adventure Park / Alpine Slide',
    'nature-park': 'Nature park visit',
    'wine-tasting': 'Wine tasting',
  };

  // Structured payload the Notion serverless function understands. Keys here map
  // to Notion columns inside netlify/functions/rsvp.mjs (PROP_MAP).
  function buildPayload() {
    return {
      'bot-field': document.querySelector('[name="bot-field"]')?.value || '',
      name: state.name,
      email: state.email,
      attending: state.attending === 'yes' ? 'Yes' : 'No',
      plusOne: state.plusone === 'yes' ? 'Yes' : 'No',
      guestName: state.guestName,
      guestEmail: state.guestEmail,
      numberAttending: state.numberAttending,
      numberChildcare: state.numberChildcare,
      thursday: state.events['thu'] ? 'Yes' : 'No',
      fridayActivities: state.events['fri-day'] ? 'Yes' : 'No',
      fridayDinner: state.events['fri-dinner'] ? 'Yes' : 'No',
      sundayBrunch: state.events['sun'] ? 'Yes' : 'No',
      fridayInterest: state.events['fri-day']
        ? state.fridayActivities.map(k => FRIDAY_LABELS[k] || k)
        : [],
      diet: state.diet,
      song: state.song,
      advice: state.advice,
      memory: state.memory,
    };
  }

  const NOTION_ENDPOINT = '/.netlify/functions/rsvp';

  // Submit: write straight to the Notion database via the serverless function,
  // and drop a best-effort backup copy into Netlify Forms.
  async function submitToNetlify(btn) {
    readForm();
    syncHiddenInputs();

    // visual loading state
    const original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Sending…';

    // The function + Netlify Forms only exist on the deployed site. In any other
    // context (this preview, a local file, a sandbox) the request 404s, which
    // would make a perfectly-good form look broken. Detect the live host and only
    // treat failures as real errors there.
    const isLiveHost = /netlify\.app$|stuttonsunited\.com$/i.test(location.hostname);

    // Best-effort backup → Netlify Forms dashboard. Fire-and-forget; never blocks the guest.
    try {
      const form = document.getElementById('rsvp-form');
      const body = new URLSearchParams();
      for (const [k, v] of new FormData(form).entries()) body.append(k, v);
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }).catch(() => {});
    } catch (_) { /* no-op */ }

    // Primary → Notion database.
    try {
      const res = await fetch(NOTION_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });

      if (!res.ok) throw new Error('Submission failed (' + res.status + ')');

      buildConfirmation();
      show(4);
    } catch (err) {
      console.error('RSVP submit failed', err);
      if (isLiveHost) {
        // Real failure on the live site — surface the error so the guest retries.
        showSubmitError(err);
        btn.disabled = false;
        btn.innerHTML = original;
      } else {
        // Preview / non-deployed context: the network handler simply isn't here.
        // Show the confirmation so the flow is fully testable.
        console.info('Preview mode — skipping network submit, showing confirmation.');
        buildConfirmation();
        show(4);
      }
    }
  }

  function showSubmitError(err) {
    // surface a small inline error near the Review & send button
    const step = $('.rsvp-step.active');
    if (!step) return;
    let banner = step.querySelector('.rsvp-error');
    if (!banner) {
      banner = document.createElement('div');
      banner.className = 'rsvp-error';
      banner.style.cssText = 'margin-top: 20px; padding: 14px 18px; border: 1px solid #c4444433; background: rgba(196, 68, 68, 0.06); color: var(--ink); font-family: var(--serif-display); font-style: italic; font-size: 16px;';
      const actions = step.querySelector('.rsvp-actions');
      if (actions) actions.parentNode.insertBefore(banner, actions);
    }
    banner.textContent = "Something went wrong sending your RSVP. Please check your connection and try again — or email stuttonsunited@gmail.com and we'll record it manually.";
  }

  $$('[data-action="back"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.step === 3) show(2);
      else if (state.step === 2) show(1);
    });
  });

  function buildConfirmation() {
    readForm();
    const conf = $('#conf-summary');
    const firstName = state.name.split(' ')[0] || 'friend';
    const confName = $('#conf-name');
    if (confName) confName.textContent = firstName;

    if (state.attending === 'no') {
      $('#conf-headline').textContent = 'We\u2019ll miss you.';
      $('#conf-body').innerHTML = `Thank you, ${escapeHtml(firstName)}. We're sad you can't be there in person, but glad you let us know — we'll raise a glass for you on the 13th.`;
      conf.style.display = 'none';
      $('#conf-actions').style.display = 'none';
      return;
    }
    conf.style.display = 'inline-flex';
    $('#conf-actions').style.display = 'flex';

    const rows = [];
    rows.push(['Guest', state.name + (state.plusone === 'yes' && state.guestName ? ' & ' + state.guestName : '')]);
    if (state.numberAttending) rows.push(['# attending', state.numberAttending]);
    if (state.numberChildcare) rows.push(['# in childcare', state.numberChildcare]);
    const events = [];
    if (state.events['thu']) events.push('Thu cocktails');
    if (state.events['fri-day']) events.push('Fri activities');
    if (state.events['fri-dinner']) events.push('Fri dinner');
    if (state.events['sat']) events.push('Ceremony & reception');
    if (state.events['sun']) events.push('Sun brunch');
    rows.push(['Attending', events.join(' · ') || '\u2014']);
    if (state.events['fri-day'] && state.fridayActivities.length) {
      const fridayLabels = {
        'ski-snowboard': 'Ski or snowboard',
        'xc-ski': 'Cross-country skiing',
        'sledding': 'Sledding',
        'snow-tubing': 'Snow tubing',
        'snowshoeing': 'Snowshoeing',
        'snowmobiling': 'Snowmobiling',
        'reindeer': 'Reindeer Farm',
        'alpine-slide': 'Adventure Park / Alpine Slide',
        'nature-park': 'Nature park visit',
        'wine-tasting': 'Wine tasting',
      };
      rows.push(['Friday picks', state.fridayActivities.map(k => fridayLabels[k] || k).join(' · ')]);
    }
    if (state.diet) rows.push(['Notes', state.diet]);
    if (state.song) rows.push(['Dance request', '"' + state.song + '"']);
    if (state.advice) rows.push(['Advice', state.advice]);
    if (state.memory) rows.push(['A memory', state.memory]);

    conf.innerHTML = rows.map(([k, v]) => `
      <div style="display:grid;grid-template-columns:140px 1fr;gap:16px;align-items:baseline;padding:8px 0;border-bottom:1px solid var(--rule);">
        <div style="font-family:var(--label);font-size:10px;letter-spacing:0.28em;text-transform:uppercase;color:var(--mist);">${escapeHtml(k)}</div>
        <div style="font-family:var(--serif-display);font-style:italic;font-size:18px;color:var(--ink);">${escapeHtml(v)}</div>
      </div>
    `).join('');
    // remove last border
    const last = conf.lastElementChild;
    if (last) last.style.borderBottom = '0';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  window.__rsvpReset = () => {
    show(1);
  };
})();
