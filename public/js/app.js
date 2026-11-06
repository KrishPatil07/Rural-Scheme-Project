// app.js — Main application controller
// Dynamically use the current hostname (works on localhost AND local IPs)
const API_BASE = `http://${window.location.hostname}:8000`;
const App = (function() {
let schemes = [];
let tools = [];
let profile = null;
let currentView = 'home';
let currentSearch = '';
let currentCategory = 'all';

  async function boot() {
    await DB.open();
    await I18n.init();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }

    updateOnlineStatus();
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

document.addEventListener('localeChanged', () => {
  const overlay = document.getElementById('details-overlay');
  if (overlay) {
    overlay.remove();
    document.body.style.overflow = '';
  }
  renderCurrentView();
  updateStaticText();
});    

    profile = await DB.getProfile();
    await Promise.all([loadData(), loadTools()]);
    renderCurrentView();
    buildLocalePicker();
  }

  async function loadData() {
    const cached = await DB.getAllSchemes();
    if (cached.length > 0) {
      schemes = cached;
      console.log(`Loaded ${schemes.length} schemes from IndexedDB`);
    }

    if (navigator.onLine) {
      try {
        const resp = await fetch(`${API_BASE}/api/schemes`);
        const data = await resp.json();
        schemes = data.schemes;
        await DB.saveSchemes(schemes);
        await DB.setMeta('last_sync', data.version);
        console.log(`Synced ${schemes.length} schemes from API`);
      } catch (e) {
        console.warn('Sync failed, using cached data:', e);
      }
    }
  }

  async function loadTools() {
    const cached = await DB.getAllTools();
    if (cached.length > 0) {
      tools = cached;
      console.log(`Loaded ${tools.length} tools from IndexedDB`);
    }

    if (navigator.onLine) {
      try {
        const resp = await fetch(`${API_BASE}/api/tools`);
        const data = await resp.json();
        tools = data.tools;
        await DB.saveTools(tools);
        console.log(`Synced ${tools.length} tools from API`);
      } catch (e) {
        console.warn('Tool sync failed, using cached data:', e);
      }
    }
  }

  function updateStaticText() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = I18n.t(key);
    });
  }

  function updateOnlineStatus() {
    const badge = document.getElementById('offline-badge');
    if (navigator.onLine) {
      badge.classList.add('hidden');
    } else {
      badge.classList.remove('hidden');
    }
  }

  function renderCurrentView() {
    const content = document.getElementById('content');
    switch (currentView) {
      case 'home': renderHome(content); break;
      case 'schemes': renderSchemes(content); break;
      case 'tools': renderTools(content); break;
      case 'settings': renderSettings(content); break;
    }
    updateStaticText();
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      const locale = I18n.getCurrentLocale();
      const localeCode = locale === 'mr' ? 'mr-IN' :
                         locale === 'hi' ? 'hi-IN' :
                         locale === 'kok' ? 'kok-IN' :
                         locale === 'vah' ? 'mr-IN' : 'en-IN';
      return d.toLocaleDateString(localeCode, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) {
      return iso;
    }
  }

  function getStepsForScheme(schemeKey) {
    const steps = [];
    for (let i = 1; i <= 20; i++) {
      const key = `${schemeKey}.step${i}`;
      const val = I18n.t(key);
      if (val === key) break;   // Key doesn't exist — stop
      steps.push(val);
    }
    return steps;
  }

  function getKeyIfExists(key) {
    const val = I18n.t(key);
    return val === key ? null : val;
  }

  function renderSchemes(container) {
  container.innerHTML = `
    <div class="filter-bar">
    <div class="filter-chips" id="filter-chips">
    <!-- Chips injected below -->
    </div>
    <input type="text" id="search-input" class="search-input" 
           placeholder="${I18n.t('filter.search_placeholder')}" 
           value="${currentSearch}">
    </div>
    <div id="scheme-results"></div>
  `;

  // Build Category Chips
  const categories = ['all', 'financial', 'women', 'msme', 'sc-st'];
  const chipsContainer = document.getElementById('filter-chips');
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `filter-chip ${currentCategory === cat ? 'active' : ''}`;
    btn.setAttribute('data-category', cat);
    btn.textContent = I18n.t(`filter.${cat}`);
    btn.addEventListener('click', () => {
      currentCategory = cat;
      renderSchemes(container); // Re-render to update active chip and list
    });
    chipsContainer.appendChild(btn);
  });

  // Handle Search Input
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('input', (e) => {
    currentSearch = e.target.value.toLowerCase();
    updateSchemeList();
  });
  
  // Focus search input if there was a search term (prevents losing focus on re-render)
  if (currentSearch) {
    searchInput.focus();
    searchInput.setSelectionRange(currentSearch.length, currentSearch.length);
  }

  function updateSchemeList() {
    const resultsContainer = document.getElementById('scheme-results');
    resultsContainer.innerHTML = '';

    // 1. Filter the schemes
    const filtered = schemes.filter(scheme => {
      // Check Category
      if (currentCategory !== 'all' && scheme.category !== currentCategory) {
        return false;
      }
      // Check Search Query (in current language)
      if (currentSearch) {
        const title = I18n.t(`${scheme.translation_key}.title`).toLowerCase();
        const short = I18n.t(`${scheme.translation_key}.short`).toLowerCase();
        if (!title.includes(currentSearch) && !short.includes(currentSearch)) {
          return false;
        }
      }
      return true;
    });

    // 2. Handle No Results
    if (filtered.length === 0) {
      resultsContainer.innerHTML = `<p class="no-results">${I18n.t('filter.no_results')}</p>`;
      return;
    }

    // 3. Render the filtered schemes
    filtered.forEach(scheme => {
      const card = document.createElement('div');
      card.className = 'scheme-card';
      card.setAttribute('data-category', scheme.category || '');

      const sourceHtml = scheme.last_updated
        ? `<div class="card-meta">
            <span class="meta-label">${I18n.t('label.last_verified')}:</span>
            <span class="meta-value">${formatDate(scheme.last_updated)}</span>
          </div>`
        : '';

      card.innerHTML = `
        <h2>${I18n.t(`${scheme.translation_key}.title`)}</h2>
        <p class="short-desc">${I18n.t(`${scheme.translation_key}.short`)}</p>
        ${sourceHtml}
        <div class="card-actions">
          <button class="btn-listen" data-audio="${scheme.id}">${I18n.t('button.listen')}</button>
          <button class="btn-details" data-details="${scheme.id}">${I18n.t('details.view')}</button>
          <button class="btn-apply" data-url="${scheme.apply_url}">${I18n.t('button.apply')}</button>
        </div>
      `;
      resultsContainer.appendChild(card);
    });

    // 4. Attach Event Listeners
    resultsContainer.querySelectorAll('.btn-apply').forEach(btn => {
      btn.addEventListener('click', () => {
        const url = btn.getAttribute('data-url');
        DB.queueAction({ type: 'apply_click', scheme_url: url });
        window.open(url, '_blank');
      });
    });

    resultsContainer.querySelectorAll('.btn-listen').forEach(btn => {
      btn.addEventListener('click', () => {
        Audio.playSchemeAudio(btn.getAttribute('data-audio'), I18n.getCurrentLocale());
      });
    });

    resultsContainer.querySelectorAll('.btn-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const schemeId = btn.getAttribute('data-details');
        const scheme = schemes.find(s => s.id === schemeId);
        if (scheme) openSchemeDetails(scheme);
      });
    });
  }

  // Initial render of the list
  updateSchemeList();
}

function openSchemeDetails(scheme) {
  const key = scheme.translation_key;

  const eligibility = getKeyIfExists(`${key}.eligibility`);
  const benefit = getKeyIfExists(`${key}.benefit`);
  const documents = getKeyIfExists(`${key}.documents`);
  const steps = getStepsForScheme(key);

  const overlay = document.createElement('div');
  overlay.className = 'details-overlay';
  overlay.id = 'details-overlay';

  const stepsHtml = steps.length > 0
    ? `<div class="details-section">
        <h3>${I18n.t('details.steps')}</h3>
        <ol class="details-steps">
          ${steps.map(s => `<li>${s}</li>`).join('')}
        </ol>
      </div>`
    : '';

  const eligibilityHtml = eligibility
    ? `<div class="details-section">
        <h3>${I18n.t('details.eligibility')}</h3>
        <p>${eligibility}</p>
      </div>`
    : '';

  const benefitHtml = benefit
    ? `<div class="details-section">
        <h3>${I18n.t('details.benefit')}</h3>
        <p>${benefit}</p>
      </div>`
    : '';

  const documentsHtml = documents
    ? `<div class="details-section">
        <h3>${I18n.t('details.documents')}</h3>
        <p>${documents}</p>
      </div>`
    : '';

  const metaHtml = scheme.last_updated
    ? `<div class="card-meta">
        <span class="meta-label">${I18n.t('label.last_verified')}:</span>
        <span class="meta-value">${formatDate(scheme.last_updated)}</span>
      </div>`
    : '';

  overlay.innerHTML = `
    <div class="details-panel" role="dialog" aria-modal="true">
      <button class="details-close" id="details-close-btn" aria-label="${I18n.t('details.back')}">← ${I18n.t('details.back')}</button>

      <h2 class="details-title">${I18n.t(`${key}.title`)}</h2>
      <p class="details-short">${I18n.t(`${key}.short`)}</p>

      <div class="details-actions">
        <button class="btn-listen" id="details-listen-btn">${I18n.t('button.listen')}</button>
        <button class="btn-apply" id="details-apply-btn">${I18n.t('button.apply')}</button>
      </div>

      ${eligibilityHtml}
      ${benefitHtml}
      ${documentsHtml}
      ${stepsHtml}

      ${metaHtml}

      <a class="details-source" href="${scheme.apply_url}" target="_blank" rel="noopener">
        ${I18n.t('details.source')} →
      </a>
    </div>
  `;

  document.body.appendChild(overlay);

  // Prevent body scroll while modal is open
  document.body.style.overflow = 'hidden';

  // Close handlers
  function closeOverlay() {
    document.body.style.overflow = '';
    overlay.remove();
  }

  document.getElementById('details-close-btn').addEventListener('click', closeOverlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeOverlay();
  });

  document.addEventListener('keydown', function onEsc(e) {
    if (e.key === 'Escape') {
      closeOverlay();
      document.removeEventListener('keydown', onEsc);
    }
  });

  // Actions
  document.getElementById('details-apply-btn').addEventListener('click', () => {
    DB.queueAction({ type: 'apply_click', scheme_url: scheme.apply_url });
    window.open(scheme.apply_url, '_blank');
  });

  document.getElementById('details-listen-btn').addEventListener('click', () => {
    Audio.playSchemeAudio(scheme.id, I18n.getCurrentLocale());
  });
}

  function renderTools(container) {
    container.innerHTML = '';
    tools.forEach(tool => {
      const card = document.createElement('div');
      card.className = 'tool-card';
      card.setAttribute('data-category', tool.category || '');

      const websiteHtml = tool.website
        ? `<a class="btn-visit" href="${tool.website}" target="_blank" rel="noopener">
             ${I18n.t('label.visit_website')} →
           </a>`
        : '';

      const verifiedHtml = '';

      card.innerHTML = `
        <h2>${I18n.t(`${tool.translation_key}.title`)}</h2>
        <p class="short-desc">${I18n.t(`${tool.translation_key}.short`)}</p>

        <div class="tool-section">
          <strong>${I18n.t('label.why_it_helps')}</strong>
          <p>${I18n.t(`${tool.translation_key}.why`)}</p>
        </div>

        <div class="tool-section">
          <strong>${I18n.t('label.how_to_setup')}</strong>
          <p>${I18n.t(`${tool.translation_key}.setup`)}</p>
        </div>

        <div class="tool-tip">
          <strong>💡 ${I18n.t('label.tip')}</strong>
          <p>${I18n.t(`${tool.translation_key}.tip`)}</p>
        </div>

        ${verifiedHtml}
        <div class="card-actions" style="margin-top:18px">${websiteHtml}</div>
      `;
      container.appendChild(card);
    });
  }

function renderHome(container) {
  container.innerHTML = `
    <div class="scheme-card">
      <h1>${I18n.t('app.title')}</h1>
      <p style="font-size:20px">${I18n.t('app.subtitle')}</p>
    </div>
    <div class="scheme-card">
      <p style="font-size:16px">${I18n.t('app.hero')}</p>
    </div>
  `;

  const profileSection = document.createElement('div');
  container.appendChild(profileSection);

  if (profile && profile.name) {
    renderProfileSummary(profileSection);
  } else {
    renderProfileForm(profileSection);
  }
}

function renderProfileSummary(container) {
  container.innerHTML = `
    <div class="profile-card">
      <div class="profile-greeting">
        <h2 style="color:var(--text);
;  letter-spacing: 1px;">${I18n.t('profile.greeting', { name: profile.name })}</h2>
      </div>

      <dl class="profile-summary">
        <div><dt>${I18n.t('profile.age')}</dt><dd>${profile.age || '—'}</dd></div>
        <div><dt>${I18n.t('profile.gender')}</dt><dd>${I18n.t('profile.gender.' + (profile.gender || 'other'))}</dd></div>
        <div><dt>${I18n.t('profile.category')}</dt><dd>${I18n.t('profile.category.' + (profile.category || 'general'))}</dd></div>
        <div><dt>${I18n.t('profile.education')}</dt><dd>${I18n.t('profile.education.' + (profile.education || 'below7'))}</dd></div>
        <div><dt>${I18n.t('profile.occupation')}</dt><dd>${I18n.t('profile.occupation.' + (profile.occupation || 'other'))}</dd></div>
        <div><dt>${I18n.t('profile.district')}</dt><dd>${profile.district || '—'}</dd></div>
        <div><dt>${I18n.t('profile.income')}</dt><dd>${profile.income ? '₹' + Number(profile.income).toLocaleString('en-IN') : '—'}</dd></div>
        <div><dt>${I18n.t('profile.shg')}</dt><dd>${profile.shg === 'yes' ? I18n.t('profile.yes') : I18n.t('profile.no')}</dd></div>
      </dl>

      <button class="btn-listenk profile-edit-btn" id="edit-profile-btn">✎ ${I18n.t('profile.edit')}</button>
      <p class="profile-privacy">🔒 ${I18n.t('profile.privacy')}</p>
    </div>
  `;

  document.getElementById('edit-profile-btn').addEventListener('click', () => {
    renderProfileForm(container);
  });
}

function renderProfileForm(container) {
  const p = profile || {};

  container.innerHTML = `
    <div class="profile-card">
      <h2>${I18n.t('profile.title')}</h2>
      <p class="profile-subtitle">${I18n.t('profile.subtitle')}</p>

      <form id="profile-form" class="profile-form">
        <div class="form-row">
          <label for="pf-name">${I18n.t('profile.name')} *</label>
          <input type="text" id="pf-name" value="${p.name || ''}" required autocomplete="name">
        </div>

        <div class="form-row form-row-half">
          <div>
            <label for="pf-age">${I18n.t('profile.age')} *</label>
            <input type="number" id="pf-age" min="15" max="100" value="${p.age || ''}" required>
          </div>
          <div>
            <label for="pf-gender">${I18n.t('profile.gender')}</label>
            <select id="pf-gender">
              <option value="female" ${p.gender==='female'?'selected':''}>${I18n.t('profile.gender.female')}</option>
              <option value="male" ${p.gender==='male'?'selected':''}>${I18n.t('profile.gender.male')}</option>
              <option value="other" ${p.gender==='other'?'selected':''}>${I18n.t('profile.gender.other')}</option>
            </select>
          </div>
        </div>

        <div class="form-row">
          <label for="pf-category">${I18n.t('profile.category')}</label>
          <select id="pf-category">
            <option value="general" ${p.category==='general'?'selected':''}>${I18n.t('profile.category.general')}</option>
            <option value="obc" ${p.category==='obc'?'selected':''}>${I18n.t('profile.category.obc')}</option>
            <option value="sc" ${p.category==='sc'?'selected':''}>${I18n.t('profile.category.sc')}</option>
            <option value="st" ${p.category==='st'?'selected':''}>${I18n.t('profile.category.st')}</option>
            <option value="nt" ${p.category==='nt'?'selected':''}>${I18n.t('profile.category.nt')}</option>
            <option value="vjnt" ${p.category==='vjnt'?'selected':''}>${I18n.t('profile.category.vjnt')}</option>
            <option value="minority" ${p.category==='minority'?'selected':''}>${I18n.t('profile.category.minority')}</option>
          </select>
        </div>

        <div class="form-row">
          <label for="pf-education">${I18n.t('profile.education')}</label>
          <select id="pf-education">
            <option value="below7" ${p.education==='below7'?'selected':''}>${I18n.t('profile.education.below7')}</option>
            <option value="7th" ${p.education==='7th'?'selected':''}>${I18n.t('profile.education.7th')}</option>
            <option value="8th" ${p.education==='8th'?'selected':''}>${I18n.t('profile.education.8th')}</option>
            <option value="10th" ${p.education==='10th'?'selected':''}>${I18n.t('profile.education.10th')}</option>
            <option value="12th" ${p.education==='12th'?'selected':''}>${I18n.t('profile.education.12th')}</option>
            <option value="iti" ${p.education==='iti'?'selected':''}>${I18n.t('profile.education.iti')}</option>
            <option value="graduate" ${p.education==='graduate'?'selected':''}>${I18n.t('profile.education.graduate')}</option>
          </select>
        </div>

        <div class="form-row">
          <label for="pf-occupation">${I18n.t('profile.occupation')}</label>
          <select id="pf-occupation">
            <option value="farmer" ${p.occupation==='farmer'?'selected':''}>${I18n.t('profile.occupation.farmer')}</option>
            <option value="artisan" ${p.occupation==='artisan'?'selected':''}>${I18n.t('profile.occupation.artisan')}</option>
            <option value="student" ${p.occupation==='student'?'selected':''}>${I18n.t('profile.occupation.student')}</option>
            <option value="unemployed" ${p.occupation==='unemployed'?'selected':''}>${I18n.t('profile.occupation.unemployed')}</option>
            <option value="business" ${p.occupation==='business'?'selected':''}>${I18n.t('profile.occupation.business')}</option>
            <option value="other" ${p.occupation==='other'?'selected':''}>${I18n.t('profile.occupation.other')}</option>
          </select>
        </div>

        <div class="form-row">
          <label for="pf-district">${I18n.t('profile.district')}</label>
          <input type="text" id="pf-district" value="${p.district || ''}" placeholder="e.g. Nashik, Pune, Nagpur">
        </div>

        <div class="form-row">
          <label for="pf-income">${I18n.t('profile.income')}</label>
          <input type="number" id="pf-income" min="0" value="${p.income || ''}" placeholder="150000">
        </div>

        <div class="form-row">
          <label for="pf-shg">${I18n.t('profile.shg')}</label>
          <select id="pf-shg">
            <option value="no" ${p.shg==='no'?'selected':''}>${I18n.t('profile.no')}</option>
            <option value="yes" ${p.shg==='yes'?'selected':''}>${I18n.t('profile.yes')}</option>
          </select>
        </div>

        <div class="form-actions">
          <button type="submit" class="btn-apply">${I18n.t('profile.save')}</button>
        </div>

        <p class="profile-privacy">🔒 ${I18n.t('profile.privacy')}</p>
      </form>
    </div>
  `;

  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('pf-name').value.trim(),
      age: document.getElementById('pf-age').value.trim(),
      gender: document.getElementById('pf-gender').value,
      category: document.getElementById('pf-category').value,
      education: document.getElementById('pf-education').value,
      occupation: document.getElementById('pf-occupation').value,
      district: document.getElementById('pf-district').value.trim(),
      income: document.getElementById('pf-income').value.trim(),
      shg: document.getElementById('pf-shg').value
    };

    if (!data.name || !data.age) {
      alert(I18n.t('profile.required'));
      return;
    }

    await DB.saveProfile(data);
    profile = data;
    renderProfileSummary(container);
  });
}

  function renderSettings(container) {
    const locales = I18n.getSupportedLocales();
    let html = `<div class="scheme-card"><h2>${I18n.t('nav.settings')}</h2><p>Language:</p><div id="settings-locales">`;
    Object.entries(locales).forEach(([code, meta]) => {
      const active = code === I18n.getCurrentLocale() ? 'style="font-weight:bold"' : '';
      html += `<button class="locale-btn" data-locale="${code}" ${active}>${meta.name}</button> `;
    });
    html += `</div></div>`;
    container.innerHTML = html;

    container.querySelectorAll('.locale-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        await I18n.switchLocale(btn.getAttribute('data-locale'));
        renderSettings(container);
      });
    });
  }

  function buildLocalePicker() {
    const picker = document.getElementById('locale-picker');
    if (!picker) return;
    const locales = I18n.getSupportedLocales();
    picker.innerHTML = '';
    Object.entries(locales).forEach(([code, meta]) => {
      const btn = document.createElement('button');
      btn.textContent = meta.name;
      btn.className = 'locale-btn';
      if (code === I18n.getCurrentLocale()) btn.classList.add('active');
      btn.addEventListener('click', () => I18n.switchLocale(code));
      picker.appendChild(btn);
    });
  }

  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.getAttribute('data-nav');
          // Reset filters when navigating away
    if (currentView !== 'schemes') {
      currentSearch = '';
      currentCategory = 'all';
    }
      document.querySelectorAll('[data-nav]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCurrentView();
    });
  });

  async function checkForUpdates() {
    const lastSync = await DB.getMeta('last_sync');
    const sixHours = 6 * 60 * 60 * 1000;
    if (!lastSync || (Date.now() - new Date(lastSync).getTime()) > sixHours) {
      await Promise.all([loadData(), loadTools()]);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkForUpdates();
  });

  return { boot, loadData, loadTools, getSchemes: () => schemes, getTools: () => tools };
})();

document.addEventListener('DOMContentLoaded', () => App.boot());