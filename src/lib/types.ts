export type ReportCategory =
  | 'flooding'
  | 'standing_water'
  | 'facility_leak'
  | 'poor_drainage'
  | 'other';

export type ReportSeverity = 'low' | 'medium' | 'high';

export type ReportStatus = 'active' | 'reviewing' | 'resolved' | 'rejected';

export type ConfirmationType = 'still_exists' | 'resolved';

export interface Report {
  id: string;
  title: string;
  description: string | null;
  category: ReportCategory;
  severity: ReportSeverity;
  location_name: string | null;
  latitude: number;
  longitude: number;
  image_url: string | null;
  reporter_name: string | null;
  status: ReportStatus;
  upvote_count: number;
  resolved_count: number;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportConfirmation {
  id: string;
  report_id: string;
  type: ConfirmationType;
  created_at: string;
}

export interface ReportFilterState {
  category: ReportCategory | 'all';
  severity: ReportSeverity | 'all';
  status: ReportStatus | 'all';
}

export interface CreateReportInput {
  title: string;
  description?: string | null;
  category: ReportCategory;
  severity: ReportSeverity;
  location_name?: string | null;
  latitude: number;
  longitude: number;
  image_url?: string | null;
  reporter_name?: string | null;
}

export interface RiskRankingEntry {
  location_name: string;
  latitude: number;
  longitude: number;
  report_count: number;
  high_severity_count: number;
  recent_7_days_count: number;
  risk_score: number;
  risk_level: 'high' | 'medium' | 'low';
}

export interface DashboardStats {
  totalReports: number;
  activeReports: number;
  resolvedReports: number;
  highSeverityReports: number;
  byCategory: { category: ReportCategory; count: number }[];
  trend7d: { date: string; count: number }[];
  ranking: RiskRankingEntry[];
}

export const CATEGORY_LABEL: Record<ReportCategory, string> = {
  flooding: '淹水',
  standing_water: '積水',
  facility_leak: '設施漏水',
  poor_drainage: '排水不良',
  other: '其他',
};

export const SEVERITY_LABEL: Record<ReportSeverity, string> = {
  high: '嚴重',
  medium: '中等',
  low: '輕微',
};

export const STATUS_LABEL: Record<ReportStatus, string> = {
  active: '處理中',
  reviewing: '審查中',
  resolved: '已改善',
  rejected: '已駁回',
};

export const SEVERITY_COLOR: Record<ReportSeverity, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#3b82f6',
};
