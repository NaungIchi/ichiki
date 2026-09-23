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
      // Ignore storage write failures in static front-end mode.
    }
  };

  const showToast = (message, isError = false) => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.dataset.tone = isError ? 'error' : 'success';
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
  };

  const updateGreeting = () => {
    const greetLabel = document.getElementById('greetLabel');
    const greetTitle = document.getElementById('greetTitle');
    const focusMessage = document.getElementById('focusMessage');
    if (!greetLabel || !greetTitle || !focusMessage) return;

    const hour = new Date().getHours();
    let greeting = 'Good evening';
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';

    greetLabel.textContent = greeting.toUpperCase();
    greetTitle.textContent = 'Your money story';

    const messages = [
      'Everything is on track today.',
      'Your money momentum looks healthy.',
      'You are staying ahead of your plan.',
      'You are making steady progress this week.'
    ];
    focusMessage.textContent = messages[(new Date().getHours() + new Date().getMinutes()) % messages.length];
  };

  const getSyncUrl = () => {
    const state = readState();
    return String(state?.settings?.syncUrl || '').trim();
  };

  const setSyncStatus = (message, tone = 'idle') => {
    const node = document.getElementById('syncStatus');
    if (!node) return;
    node.textContent = message;
    node.dataset.status = tone;
  };

  const syncGoogleSheets = async (reason = 'manual') => {
    const state = readState();
    const settings = state.settings || {};
    let syncUrl = String(settings.syncUrl || '').trim();

    if (!syncUrl) {
      const entered = window.prompt('Enter your Google Apps Script /exec URL', settings.syncUrl || '');
      if (!entered) {
        setSyncStatus('Sync URL required', 'warning');
        showToast('Google Sheets URL is required to sync.', true);
        return false;
      }
      syncUrl = entered.trim();
      if (!syncUrl) {
        setSyncStatus('Sync URL required', 'warning');
        showToast('A valid Google Apps Script URL is required.', true);
        return false;
      }
      settings.syncUrl = syncUrl;
      state.settings = settings;
      saveState(state);
      const syncUrlInput = document.getElementById('syncUrl');
      if (syncUrlInput) syncUrlInput.value = syncUrl;
    }

    setSyncStatus('Syncing…', 'loading');
    try {
      const payload = {
        action: 'replaceAll',
        transactions: Array.isArray(state.transactions) ? state.transactions : [],
        budgets: Array.isArray(state.budgets) ? state.budgets : [],
        categories: Array.isArray(state.categories) ? state.categories : [],
        loans: Array.isArray(state.loans) ? state.loans : [],
        settings: settings
      };

      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('sync failed');
      }

      setSyncStatus('Synced just now', 'success');
      if (reason === 'manual') showToast('Synced to Google Sheets.');
      return true;
    } catch (error) {
      setSyncStatus('Sync failed', 'error');
      showToast('Sync could not complete. Please check the URL.', true);
      return false;
    }
  };

  const wireSyncControls = () => {
    const syncButton = document.getElementById('syncButton');
    if (syncButton) {
      syncButton.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await syncGoogleSheets('manual');
      });
    }

    const syncUrlInput = document.getElementById('syncUrl');
    if (syncUrlInput) {
      syncUrlInput.value = getSyncUrl();
      syncUrlInput.addEventListener('input', (event) => {
        const state = readState();
        state.settings = state.settings || {};
        state.settings.syncUrl = event.target.value.trim();
        saveState(state);
        setSyncStatus(getSyncUrl() ? 'Ready to sync' : 'Sync URL required', getSyncUrl() ? 'idle' : 'warning');
      });
    }
  };

  const autoSyncIfConfigured = () => {
    const url = getSyncUrl();
    if (!url) return;
    setTimeout(() => syncGoogleSheets('save'), 200);
  };

  const init = () => {
    updateGreeting();
    wireSyncControls();
    setSyncStatus(getSyncUrl() ? 'Ready to sync' : 'Sync URL required', getSyncUrl() ? 'idle' : 'warning');
    window.syncToGoogleSheets = syncGoogleSheets;

    document.addEventListener('submit', (event) => {
      if (!event.target || !event.target.id) return;
      if (['transactionForm', 'budgetForm', 'categoryForm'].includes(event.target.id)) {
        setTimeout(() => autoSyncIfConfigured(), 220);
      }
    });

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!target || !(target instanceof HTMLElement)) return;
      if (target.closest('[data-remove-tx]') || target.closest('[data-remove-budget]') || target.closest('[data-remove-category]')) {
        setTimeout(() => autoSyncIfConfigured(), 220);
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
