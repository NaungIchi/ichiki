(() => {
  'use strict';

  const STORAGE_KEY = 'moneyflow-v3';

  const readState = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  };

  const saveState = (state) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // no-op
    }
  };

  const showToast = (message, isError = false) => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = isError ? 'error' : 'success';
    node.classList.add('on');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => node.classList.remove('on'), 2800);
  };

  const setStatus = (message, tone = 'idle') => {
    const node = document.getElementById('syncStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.status = tone;
  };

  const getSyncUrl = () => String(readState().settings?.syncUrl || '').trim();

  const updateGreeting = () => {
    const label = document.getElementById('greetLabel');
    const title = document.getElementById('greetTitle');
    const text = document.getElementById('focusMessage');

    if (!label || !title || !text) return;

    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

    label.textContent = greeting.toUpperCase();
    title.textContent = 'Your money story';

    const copy = hour < 12
      ? 'Start the day with a clear view of your money.'
      : hour < 18
      ? 'Keep your spending aligned with today’s plan.'
      : 'Review today’s progress and plan tomorrow with confidence.';

    text.textContent = copy;
  };

  const ensureUrlField = () => {
    if (document.getElementById('syncUrl')) return;
    const settingsList = document.querySelector('#settings .settings-list');
    if (!settingsList) return;

    const wrapper = document.createElement('label');
    wrapper.className = 'sync-url-row';
    wrapper.innerHTML = `
      <span>Google Apps Script URL</span>
      <input id="syncUrl" type="url" inputmode="url" placeholder="https://script.google.com/.../exec" autocomplete="url">
    `;
    settingsList.appendChild(wrapper);
  };

  const wireSyncUrlField = () => {
    const input = document.getElementById('syncUrl');
    if (!input || input.dataset.bound) return;
    input.dataset.bound = 'true';
    input.value = getSyncUrl();

    input.addEventListener('input', (event) => {
      const state = readState();
      state.settings = state.settings || {};
      state.settings.syncUrl = event.target.value.trim();
      saveState(state);
      setStatus(state.settings.syncUrl ? 'Ready to sync' : 'Sync URL required', state.settings.syncUrl ? 'idle' : 'warning');
    });
  };

  const askForSyncUrl = () => {
    const entered = window.prompt('Enter your Google Apps Script /exec URL', getSyncUrl());
    if (!entered || !entered.trim()) return '';
    const state = readState();
    state.settings = state.settings || {};
    state.settings.syncUrl = entered.trim();
    saveState(state);

    const input = document.getElementById('syncUrl');
    if (input) input.value = state.settings.syncUrl;

    return state.settings.syncUrl;
  };

  const syncToGoogleSheets = async (reason = 'manual') => {
    const url = getSyncUrl() || askForSyncUrl();
    if (!url) {
      setStatus('Sync URL required', 'warning');
      showToast('Add your Google Apps Script URL in Settings.', true);
      return false;
    }

    const state = readState();
    setStatus('Syncing…', 'loading');

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'appendDelta',
          transactions: state.transactions || [],
          budgets: state.budgets || [],
          categories: state.categories || [],
          loans: state.loans || [],
          syncedAt: new Date().toISOString()
        })
      });

      if (!response.ok) throw new Error('Sync failed');

      setStatus('Synced just now', 'success');
      if (reason === 'manual') showToast('Synced to Google Sheets.');
      return true;
    } catch {
      setStatus('Sync failed', 'error');
      showToast('Sync failed. Check your Apps Script URL and deployment access.', true);
      return false;
    }
  };

  const init = () => {
    updateGreeting();
    ensureUrlField();
    wireSyncUrlField();
    setStatus(getSyncUrl() ? 'Ready to sync' : 'Sync URL required', getSyncUrl() ? 'idle' : 'warning');

    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
      syncButton.addEventListener('click', () => syncToGoogleSheets('manual'));
    }

    document.addEventListener('submit', (event) => {
      if (!event.target || !event.target.id) return;
      if (['transactionForm', 'budgetForm', 'categoryForm'].includes(event.target.id) && getSyncUrl()) {
        setTimeout(() => syncToGoogleSheets('save'), 250);
      }
    });

    window.syncToGoogleSheets = syncToGoogleSheets;
    window.setInterval(updateGreeting, 60000);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
