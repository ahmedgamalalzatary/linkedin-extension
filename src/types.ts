export type JobStatus = 'normal' | 'viewed' | 'applied';

export interface JobCardInfo {
  status: JobStatus;
  time: Date | null;
}

export type AppliedAction = 'normal' | 'dim' | 'hide';

export interface ExtensionSettings {
  sortBy: 'default' | 'recent' | 'viewed-first' | 'viewed-last';
  appliedAction: AppliedAction;
  highlightViewed: boolean;
}

export interface JobStats {
  total: number;
  viewed: number;
  applied: number;
}

export interface MessageRequest {
  type: 'applySettings' | 'getStats';
  settings?: ExtensionSettings;
}

export interface MessageResponse {
  success?: boolean;
  total?: number;
  viewed?: number;
  applied?: number;
}
