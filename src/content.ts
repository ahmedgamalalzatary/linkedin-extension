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
    this.startObserver();
    this.processJobs();
    this.setupMessageListener();
  }

  private loadSettings(): void {
    chrome.storage.local.get(['linkedinJobFilter'], (result: Record<string, unknown>) => {
      if (result.linkedinJobFilter) {
        this.settings = { ...this.settings, ...(result.linkedinJobFilter as ExtensionSettings) };
      }
    });
  }

  private saveSettings(): void {
    chrome.storage.local.set({ linkedinJobFilter: this.settings });
  }

  private parseRelativeTime(text: string): Date | null {
    // Find the line containing "ago" (handles multiline text with leading newlines)
    const lines = text.split('\n');
    const timeLine = lines.find(line => line.includes('ago'))?.trim() || '';
    const match = timeLine.match(/(\d+)\s+(minute|hour|day|week)s?\s+ago/i);
    if (!match) return null;

    const value = parseInt(match[1]!, 10);
    const unit = match[2]!.toLowerCase();

    const now = new Date();
    const msPerUnit: Record<string, number> = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000
    };

    return new Date(now.getTime() - (value * msPerUnit[unit]!));
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
      const timeText = timeEl.textContent || '';
      time = this.parseRelativeTime(timeText);
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
      // Always update the index for all jobs (handles lazy loading)
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
          if (!statusA.time) return -1;  // Jobs WITHOUT time go FIRST in sort array
          if (!statusB.time) return 1;   // Jobs WITH time go LAST in sort array
          // Sort by older first (4h, 2h, 10min), then reverse to get (10min, 2h, 4h, no-time)
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
          // Re-sort if a non-default sort is active
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
