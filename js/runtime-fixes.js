(() => {
  'use strict';
  const STORAGE_KEY = 'moneyflow-v3';
  const readState = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; } };
  const saveState = (state) => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {} };
  const toast = (message, error = false) => {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = error ? 'error' : 'success';
    node.classList.add('on');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('on'), 2800);
  };
  const status = (message, tone = 'idle') => {
    const node = document.getElementById('syncStatus');
    if (node) { node.textContent = message; node.dataset.status = tone; }
  };
  const syncUrl = () => String(readState().settings?.syncUrl || '').trim();

  const updateGreeting = () => {
    const label = document.getElementById('greetLabel');
    const title = document.getElementById('greetTitle');
    const message = document.getElementById('focusMessage');
    if (!label || !title || !message) return;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    label.textContent = greeting.toUpperCase();
    title.textContent = 'Your money story';
    message.textContent = hour < 12 ? 'Start the day with a clear view of your money.' : hour < 18 ? 'Keep your spending aligned with today’s plan.' : 'Review today’s progress and plan tomorrow with confidence.';
  };

  const ensureUrlField = () => {
    if (document.getElementById('syncUrl')) return;
    const settings = document.querySelector('#settings .settings-list');
    if (!settings) return;
    const row = document.createElement('label');
    row.className = 'sync-url-row';
    row.innerHTML = '<span>Google Apps Script URL</span><input id="syncUrl" type="url" inputmode="url" placeholder="https://script.google.com/.../exec" autocomplete="url">';
    settings.appendChild(row);
  };

  const wireUrlField = () => {
    const input = document.getElementById('syncUrl');
    if (!input || input.dataset.wired) return;
    input.dataset.wired = 'true';
    input.value = syncUrl();
    input.addEventListener('input', (event) => {
      const state = readState();
      state.settings = state.settings || {};
      state.settings.syncUrl = event.target.value.trim();
      saveState(state);
      status(state.settings.syncUrl ? 'Ready to sync' : 'Sync URL required', state.settings.syncUrl ? 'idle' : 'warning');
    });
  };

  const askForUrl = () => {
    const entered = window.prompt('Enter your Google Apps Script /exec URL', syncUrl());
    if (!entered || !entered.trim()) return '';
    const state = readState();
    state.settings = state.settings || {};
    state.settings.syncUrl = entered.trim();
    saveState(state);
    const input = document.getElementById('syncUrl');
    if (input) input.value = state.settings.syncUrl;
    return state.settings.syncUrl;
  };

  const sync = async (reason = 'manual') => {
    const url = syncUrl() || askForUrl();
    if (!url) { status('Sync URL required', 'warning'); toast('Add your Google Apps Script URL in Settings.', true); return false; }
    const state = readState();
    status('Syncing…', 'loading');
    try {
      const response = await fetch(url, { method:'POST', headers:{ 'Content-Type':'text/plain;charset=utf-8' }, body:JSON.stringify({ action:'appendDelta', transactions:state.transactions || [], budgets:state.budgets || [], categories:state.categories || [], loans:state.loans || [], syncedAt:new Date().toISOString() }) });
      if (!response.ok) throw new Error('Sync failed');
      status('Synced just now', 'success');
      if (reason === 'manual') toast('Synced to Google Sheets.');
      return true;
    } catch {
      status('Sync failed', 'error');
      toast('Sync failed. Check your Apps Script URL and deployment access.', true);
      return false;
    }
  };

  const init = () => {
    updateGreeting();
    ensureUrlField();
    wireUrlField();
    status(syncUrl() ? 'Ready to sync' : 'Sync URL required', syncUrl() ? 'idle' : 'warning');
    window.syncToGoogleSheets = sync;
    document.getElementById('syncButton')?.addEventListener('click', () => sync('manual'));
    document.addEventListener('submit', (event) => {
      if (['transactionForm','budgetForm','categoryForm'].includes(event.target?.id) && syncUrl()) setTimeout(() => sync('save'), 250);
    });
    window.setInterval(updateGreeting, 60000);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true }); else init();
})();
