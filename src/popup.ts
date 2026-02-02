import type { ExtensionSettings, AppliedAction, JobStats, MessageRequest, MessageResponse } from './types';

type ExtensionState = 'inactive' | 'active' | 'pending' | 'error';

const defaultSettings: ExtensionSettings = {
  sortBy: 'default',
  appliedAction: 'dim',
  highlightViewed: true
};

let currentSettings: ExtensionSettings = { ...defaultSettings };
let savedSettings: ExtensionSettings = { ...defaultSettings };
let hasChanges = false;
let currentTheme: 'light' | 'dark' = 'light';

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadSettings();
  setupEventListeners();
  checkTabStatus();
});

function loadTheme(): void {
  chrome.storage.local.get(['linkedinJobFilterTheme'], (result: Record<string, unknown>) => {
    if (result.linkedinJobFilterTheme) {
      currentTheme = result.linkedinJobFilterTheme as 'light' | 'dark';
    } else {
      // Default to system preference
      currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(currentTheme);
  });
}

function applyTheme(theme: 'light' | 'dark'): void {
  document.body.setAttribute('data-theme', theme);
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
    themeToggle.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

function toggleTheme(): void {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  applyTheme(currentTheme);
  chrome.storage.local.set({ linkedinJobFilterTheme: currentTheme });
}

function loadSettings(): void {
  chrome.storage.local.get(['linkedinJobFilter'], (result: Record<string, unknown>) => {
    if (result.linkedinJobFilter) {
      const loaded = result.linkedinJobFilter as ExtensionSettings;
      currentSettings = { ...currentSettings, ...loaded };
      savedSettings = { ...savedSettings, ...loaded };
      updateUIFromSettings();
    }
  });

  loadStats();
}

function updateUIFromSettings(): void {
  const sortBySelect = document.getElementById('sort-by') as HTMLSelectElement;
  const highlightViewedCheckbox = document.getElementById('highlight-viewed') as HTMLInputElement;

  // Update radio buttons for applied action
  const appliedNormalRadio = document.getElementById('applied-normal') as HTMLInputElement;
  const appliedDimRadio = document.getElementById('applied-dim') as HTMLInputElement;
  const appliedHideRadio = document.getElementById('applied-hide') as HTMLInputElement;

  if (sortBySelect) sortBySelect.value = currentSettings.sortBy;
  if (highlightViewedCheckbox) highlightViewedCheckbox.checked = currentSettings.highlightViewed;

  // Set the correct radio button
  if (appliedNormalRadio) appliedNormalRadio.checked = currentSettings.appliedAction === 'normal';
  if (appliedDimRadio) appliedDimRadio.checked = currentSettings.appliedAction === 'dim';
  if (appliedHideRadio) appliedHideRadio.checked = currentSettings.appliedAction === 'hide';
}

function updateSettingsFromUI(): void {
  const sortBySelect = document.getElementById('sort-by') as HTMLSelectElement;
  const highlightViewedCheckbox = document.getElementById('highlight-viewed') as HTMLInputElement;

  // Get selected radio button for applied action
  const appliedActionRadios = document.getElementsByName('applied-action') as NodeListOf<HTMLInputElement>;
  let selectedAppliedAction: AppliedAction = 'normal';
  appliedActionRadios.forEach(radio => {
    if (radio.checked) {
      selectedAppliedAction = radio.value as AppliedAction;
    }
  });

  const newSettings: ExtensionSettings = {
    sortBy: sortBySelect.value as ExtensionSettings['sortBy'],
    appliedAction: selectedAppliedAction,
    highlightViewed: highlightViewedCheckbox.checked
  };

  currentSettings = newSettings;

  // Check if settings changed from saved
  hasChanges = JSON.stringify(currentSettings) !== JSON.stringify(savedSettings);
  updateStateIndicator();
}

function updateStateIndicator(): void {
  const indicator = document.getElementById('state-indicator');
  const stateText = document.getElementById('state-text');

  if (!indicator || !stateText) return;

  // Remove all state classes
  indicator.classList.remove('active', 'pending', 'error', 'inactive');

  if (hasChanges) {
    indicator.classList.add('pending');
    stateText.textContent = 'Pending';
  } else {
    indicator.classList.add('active');
    stateText.textContent = 'Active';
  }
}

function setErrorState(): void {
  const indicator = document.getElementById('state-indicator');
  const stateText = document.getElementById('state-text');

  if (!indicator || !stateText) return;

  indicator.classList.remove('active', 'pending', 'inactive');
  indicator.classList.add('error');
  stateText.textContent = 'Error';
}

function setInactiveState(): void {
  const indicator = document.getElementById('state-indicator');
  const stateText = document.getElementById('state-text');

  if (!indicator || !stateText) return;

  indicator.classList.remove('active', 'pending', 'error');
  indicator.classList.add('inactive');
  stateText.textContent = 'Inactive';
}

function checkTabStatus(): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    const activeTab = tabs[0];
    if (!activeTab?.url?.includes('linkedin.com/jobs')) {
      setInactiveState();
    } else {
      updateStateIndicator();
    }
  });
}

function applySettings(): void {
  updateSettingsFromUI();

  chrome.storage.local.set({ linkedinJobFilter: currentSettings });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    const activeTab = tabs[0];
    if (activeTab?.id && activeTab.url?.includes('linkedin.com/jobs')) {
      const message: MessageRequest = {
        type: 'applySettings',
        settings: currentSettings
      };

      chrome.tabs.sendMessage(activeTab.id, message, (response: MessageResponse) => {
        if (response?.success) {
          savedSettings = { ...currentSettings };
          hasChanges = false;
          loadStats();
          showSuccessFeedback();
          updateStateIndicator();
        } else {
          setErrorState();
        }
      });
    } else {
      setInactiveState();
    }
  });
}

function showSuccessFeedback(): void {
  const btn = document.getElementById('apply-btn') as HTMLButtonElement;
  if (!btn) return;

  const originalText = btn.textContent || 'Apply Filters';
  btn.textContent = 'Applied!';
  btn.style.background = '#10b981';

  setTimeout(() => {
    btn.textContent = originalText;
    btn.style.background = '';
  }, 1500);
}

function loadStats(): void {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
    const activeTab = tabs[0];
    if (activeTab?.id && activeTab.url?.includes('linkedin.com/jobs')) {
      const message: MessageRequest = { type: 'getStats' };

      chrome.tabs.sendMessage(activeTab.id, message, (response: MessageResponse) => {
        if (response) {
          const totalEl = document.getElementById('total-count');
          const viewedEl = document.getElementById('viewed-count');
          const appliedEl = document.getElementById('applied-count');

          if (totalEl) totalEl.textContent = String(response.total ?? '-');
          if (viewedEl) viewedEl.textContent = String(response.viewed ?? '-');
          if (appliedEl) appliedEl.textContent = String(response.applied ?? '-');
        }
      });
    }
  });
}

function setupEventListeners(): void {
  const applyBtn = document.getElementById('apply-btn');
  const sortBySelect = document.getElementById('sort-by');
  const highlightViewedCheckbox = document.getElementById('highlight-viewed');
  const themeToggle = document.getElementById('theme-toggle');

  if (applyBtn) applyBtn.addEventListener('click', applySettings);
  if (sortBySelect) sortBySelect.addEventListener('change', updateSettingsFromUI);
  if (highlightViewedCheckbox) highlightViewedCheckbox.addEventListener('change', updateSettingsFromUI);
  if (themeToggle) themeToggle.addEventListener('click', toggleTheme);

  // Radio button listeners
  const appliedActionRadios = document.getElementsByName('applied-action') as NodeListOf<HTMLInputElement>;
  appliedActionRadios.forEach(radio => {
    radio.addEventListener('change', updateSettingsFromUI);
  });
}

chrome.runtime.onMessage.addListener((request: JobStats & { type: string }) => {
  if (request.type === 'stats') {
    const totalEl = document.getElementById('total-count');
    const viewedEl = document.getElementById('viewed-count');
    const appliedEl = document.getElementById('applied-count');

    if (totalEl) totalEl.textContent = String(request.total);
    if (viewedEl) viewedEl.textContent = String(request.viewed);
    if (appliedEl) appliedEl.textContent = String(request.applied);
  }
});
