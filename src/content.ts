import type { JobCardInfo, JobStatus, ExtensionSettings, JobStats, MessageRequest, MessageResponse } from './types';

const CONFIG = {
  jobListSelector: '.jobs-search-results-list',
  jobCardSelector: '[data-occludable-job-id]',
  footerSelector: '.job-card-container__footer-wrapper',
  stateSelector: '.job-card-container__footer-job-state',
  timeSelector: 'time[datetime]',
} as const;

class JobFilterExtension {
  private settings: ExtensionSettings = {
    sortBy: 'default',
    appliedAction: 'dim',
    highlightViewed: true
  };

  private processedJobs = new Set<Element>();
  private observer: MutationObserver | null = null;
  private originalOrder = new Map<Element, number>();

  constructor() {
    this.init();
  }

  private init(): void {
    this.loadSettings();
    this.injectFloatingControls();
    this.startObserver();
    this.processJobs();
    this.setupMessageListener();
  }

  private loadSettings(): void {
    chrome.storage.local.get(['linkedinJobFilter'], (result: Record<string, unknown>) => {
      if (result.linkedinJobFilter) {
        this.settings = { ...this.settings, ...(result.linkedinJobFilter as ExtensionSettings) };
        this.updateUI();
      }
    });
  }

  private saveSettings(): void {
    chrome.storage.local.set({ linkedinJobFilter: this.settings });
  }

  private getJobStatus(jobCard: Element): JobCardInfo {
    const footer = jobCard.querySelector(CONFIG.footerSelector);

    const stateEl = footer?.querySelector(CONFIG.stateSelector);
    // Search more broadly for time element - could be anywhere in the job card
    const timeEl = jobCard.querySelector(CONFIG.timeSelector) ||
                   footer?.querySelector(CONFIG.timeSelector) ||
                   jobCard.querySelector('time');

    let status: JobStatus = 'normal';
    let time: Date | null = null;

    if (stateEl) {
      const text = stateEl.textContent?.trim().toLowerCase() || '';
      if (text.includes('viewed')) status = 'viewed';
      else if (text.includes('applied')) status = 'applied';
    }

    if (timeEl) {
      const datetime = timeEl.getAttribute('datetime');
      if (datetime) {
        time = new Date(datetime);
      }
    }

    return { status, time };
  }

  private processJobs(): void {
    const jobs = document.querySelectorAll(CONFIG.jobCardSelector);
    
    // Clear processed set to allow re-processing when status changes
    this.processedJobs.clear();
    
    jobs.forEach(job => {
      const { status } = this.getJobStatus(job);
      
      // Always clear old styles first (in case status changed)
      job.classList.remove(
        'linkedin-job-filter-viewed',
        'linkedin-job-filter-applied',
        'hidden'
      );

      // Apply current styles based on current status
      if (status === 'viewed' && this.settings.highlightViewed) {
        job.classList.add('linkedin-job-filter-viewed');
      }

      if (status === 'applied') {
        switch (this.settings.appliedAction) {
          case 'hide':
            job.classList.add('hidden');
            break;
          case 'dim':
            job.classList.add('linkedin-job-filter-applied');
            break;
          case 'normal':
          default:
            // No special styling
            break;
        }
      }

      this.processedJobs.add(job);
    });

    this.updateStats();
  }

  private captureOriginalOrder(): void {
    const jobs = document.querySelectorAll(CONFIG.jobCardSelector);
    jobs.forEach((job, index) => {
      this.originalOrder.set(job, index);
    });
  }

  private sortJobs(): void {
    // Find the job list container by looking at the parent of the first job
    const firstJob = document.querySelector(CONFIG.jobCardSelector);
    if (!firstJob) return;

    // Get the parent element (should be the ul/ol that contains all jobs)
    const jobList = firstJob.parentElement;
    if (!jobList) return;

    const jobs = Array.from(document.querySelectorAll(CONFIG.jobCardSelector));

    // Capture original order on first sort
    if (this.originalOrder.size === 0) {
      this.captureOriginalOrder();
    }

    // Handle default sort - restore original order
    if (this.settings.sortBy === 'default') {
      const sortedJobs = jobs.sort((a, b) => {
        const indexA = this.originalOrder.get(a) ?? Infinity;
        const indexB = this.originalOrder.get(b) ?? Infinity;
        return indexA - indexB;
      });

      sortedJobs.forEach(job => {
        jobList.appendChild(job);
      });

      console.log('[LinkedIn Job Filter] Restored original order for', sortedJobs.length, 'jobs');
      return;
    }
    
    const sortedJobs = jobs.sort((a, b) => {
      const statusA = this.getJobStatus(a);
      const statusB = this.getJobStatus(b);

      switch (this.settings.sortBy) {
        case 'recent':
          if (!statusA.time && !statusB.time) return 0;
          if (!statusA.time) return 1;
          if (!statusB.time) return -1;
          return statusA.time.getTime() - statusB.time.getTime();

        case 'viewed-first':
          if (statusA.status === 'viewed' && statusB.status !== 'viewed') return -1;
          if (statusA.status !== 'viewed' && statusB.status === 'viewed') return 1;
          return 0;

        case 'viewed-last':
          if (statusA.status === 'viewed' && statusB.status !== 'viewed') return 1;
          if (statusA.status !== 'viewed' && statusB.status === 'viewed') return -1;
          return 0;

        default:
          return 0;
      }
    });

    // Reorder by moving elements in the DOM
    if (this.settings.sortBy === 'recent') {
      // For recent sort: reverse so newest (first in array) is appended last and appears at top
      sortedJobs.reverse().forEach(job => {
        jobList.appendChild(job);
      });
    } else {
      // For other sorts: append in order
      sortedJobs.forEach(job => {
        jobList.appendChild(job);
      });
    }

    console.log('[LinkedIn Job Filter] Sorted', sortedJobs.length, 'jobs by', this.settings.sortBy);
  }

  private updateStats(): void {
    const jobs = document.querySelectorAll(CONFIG.jobCardSelector);
    let viewed = 0;
    let applied = 0;

    jobs.forEach(job => {
      const { status } = this.getJobStatus(job);
      if (status === 'viewed') viewed++;
      if (status === 'applied') applied++;
    });

    chrome.runtime.sendMessage({
      type: 'stats',
      total: jobs.length,
      viewed,
      applied
    } as JobStats & { type: string });
  }

  private startObserver(): void {
    this.observer = new MutationObserver((mutations) => {
      let shouldProcess = false;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1 && (node as Element).matches?.(CONFIG.jobCardSelector)) {
              shouldProcess = true;
            }
          });
        }
      });

      if (shouldProcess) {
        setTimeout(() => {
          this.processJobs();
          if (this.settings.sortBy !== 'default') {
            this.sortJobs();
          }
        }, 100);
      }
    });

    const jobList = document.querySelector(CONFIG.jobListSelector);
    if (jobList) {
      this.observer.observe(jobList, { childList: true, subtree: true });
    }
  }

  private injectFloatingControls(): void {
    const existing = document.getElementById('linkedin-job-filter-ui');
    if (existing) existing.remove();

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'linkedin-job-filter-toggle';
    toggleBtn.className = 'linkedin-job-filter-toggle';
    toggleBtn.innerHTML = '⚙️';
    toggleBtn.title = 'LinkedIn Job Filter';
    document.body.appendChild(toggleBtn);

    const panel = document.createElement('div');
    panel.id = 'linkedin-job-filter-controls';
    panel.className = 'linkedin-job-filter-controls';
    panel.style.display = 'none';
    panel.innerHTML = `
      <h3>Job Filter</h3>
      <div class="control-group">
        <label>Sort By</label>
        <select id="ljf-sort">
          <option value="default">Default</option>
          <option value="recent">Most Recent</option>
          <option value="viewed-first">Viewed First</option>
          <option value="viewed-last">Viewed Last</option>
        </select>
      </div>
      <div class="control-group">
        <label>Applied Jobs</label>
        <div class="radio-group">
          <label>
            <input type="radio" name="ljf-applied-action" value="normal" id="ljf-applied-normal"> Normal
          </label>
          <label>
            <input type="radio" name="ljf-applied-action" value="dim" id="ljf-applied-dim" checked> Dim
          </label>
          <label>
            <input type="radio" name="ljf-applied-action" value="hide" id="ljf-applied-hide"> Hide
          </label>
        </div>
      </div>
      <div class="control-group">
        <label>
          <input type="checkbox" id="ljf-highlight-viewed" checked> Highlight Viewed
        </label>
      </div>
    `;
    document.body.appendChild(panel);

    toggleBtn.addEventListener('click', () => {
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      toggleBtn.classList.toggle('active', !isVisible);
    });

    const sortSelect = panel.querySelector('#ljf-sort') as HTMLSelectElement;
    sortSelect.addEventListener('change', (e) => {
      this.settings.sortBy = (e.target as HTMLSelectElement).value as ExtensionSettings['sortBy'];
      this.saveSettings();
      this.sortJobs();
    });

    const appliedActionRadios = panel.querySelectorAll('input[name="ljf-applied-action"]') as NodeListOf<HTMLInputElement>;
    appliedActionRadios.forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const selectedValue = (e.target as HTMLInputElement).value;
        this.settings.appliedAction = selectedValue as ExtensionSettings['appliedAction'];
        this.saveSettings();
        this.processJobs();
      });
    });

    const highlightViewedCheckbox = panel.querySelector('#ljf-highlight-viewed') as HTMLInputElement;
    highlightViewedCheckbox.addEventListener('change', (e) => {
      this.settings.highlightViewed = (e.target as HTMLInputElement).checked;
      this.saveSettings();
      this.processJobs();
    });
  }

  private updateUI(): void {
    const panel = document.getElementById('linkedin-job-filter-controls');
    if (!panel) return;

    const sortSelect = panel.querySelector('#ljf-sort') as HTMLSelectElement;
    const appliedActionRadios = panel.querySelectorAll('input[name="ljf-applied-action"]') as NodeListOf<HTMLInputElement>;
    const highlightViewedCheckbox = panel.querySelector('#ljf-highlight-viewed') as HTMLInputElement;

    if (sortSelect) sortSelect.value = this.settings.sortBy;
    if (appliedActionRadios) {
      appliedActionRadios.forEach((radio) => {
        radio.checked = radio.value === this.settings.appliedAction;
      });
    }
    if (highlightViewedCheckbox) highlightViewedCheckbox.checked = this.settings.highlightViewed;
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((request: MessageRequest, _sender, sendResponse: (response: MessageResponse) => void) => {
      if (request.type === 'applySettings' && request.settings) {
        this.settings = { ...this.settings, ...request.settings };
        this.saveSettings();
        this.processJobs();
        if (this.settings.sortBy !== 'default') {
          this.sortJobs();
        }
        sendResponse({ success: true });
      }
      
      if (request.type === 'getStats') {
        const jobs = document.querySelectorAll(CONFIG.jobCardSelector);
        let viewed = 0;
        let applied = 0;

        jobs.forEach(job => {
          const { status } = this.getJobStatus(job);
          if (status === 'viewed') viewed++;
          if (status === 'applied') applied++;
        });

        sendResponse({ total: jobs.length, viewed, applied });
      }
      
      return true;
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new JobFilterExtension());
} else {
  new JobFilterExtension();
}
