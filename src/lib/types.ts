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

// ────────────────────────────────────────────────────────
// 飲水機（WaterStation）— 解學生「找水裝瓶」痛點
// ────────────────────────────────────────────────────────

export type WaterStationKind =
  | 'fountain' // 一般飲水機（直飲）
  | 'refill' // 大瓶裝填補水站
  | 'rest_water' // 廁所盥洗水（不可飲）
  | 'hot_cold'; // 冷熱飲水機

export type WaterStationStatus =
  | 'normal'
  | 'broken' // 故障
  | 'maintenance' // 維修中
  | 'filter_due'; // 濾心過期

/** 資料來源：'osm' = OpenStreetMap 社群，'official' = 北水處 OpenData，'merged' = 兩源融合 */
export type WaterStationSource = 'osm' | 'official' | 'merged';

export interface WaterStation {
  id: string;
  name: string;
  /** 建築物名稱 + 樓層描述，例：「第一學生活動中心 1F」 */
  location_hint: string | null;
  kind: WaterStationKind;
  latitude: number;
  longitude: number;
  status: WaterStationStatus;
  /** 最後一次故障/修復回報時間 */
  last_reported_at: string | null;
  /** 累積回報次數（壞/修） */
  report_count: number;
  /** 該飲水機今年已替使用者省下幾個 600ml 寶特瓶（眾包 +1）給 ESG 教育用 */
  bottles_saved: number;
  /** 資料來源 */
  source: WaterStationSource;
  /** 北水處官方資料才有：水質詳情頁面 URL */
  external_url?: string | null;
  /** 北水處官方資料才有：「正常 / 暫停」等官方狀態 */
  official_status?: string | null;
  /** 北水處官方資料才有：官方狀態異動時間（YYYYMMDDTHHMMSS） */
  official_status_at?: string | null;
  /** 北水處官方資料才有：最近水質採樣時間 */
  last_water_test_at?: string | null;
  /** 北水處官方資料才有：飲水機照片 URL */
  photo_url?: string | null;
  created_at: string;
  updated_at: string;
}

/** 使用者回報類型 — 已移除「在排隊/沒人」（用戶要求簡化） */
export type WaterStationReportType =
  | 'broken' // 報故障
  | 'fixed' // 修好了
  | 'refill'; // 我用它裝水了，+1 寶特瓶

export const WATER_STATION_KIND_LABEL: Record<WaterStationKind, string> = {
  fountain: '飲水機',
  refill: '補水站',
  rest_water: '盥洗水',
  hot_cold: '冷熱飲水機',
};

export const WATER_STATION_STATUS_LABEL: Record<WaterStationStatus, string> = {
  normal: '正常',
  broken: '故障',
  maintenance: '維修中',
  filter_due: '濾心過期',
};

// ────────────────────────────────────────────────────────
// 通勤路線（個人化，純 client localStorage，不上 server）
// ────────────────────────────────────────────────────────

export interface CommuteRoute {
  id: string;
  label: string;
  startNodeId: string; // CAMPUS_NODES.id
  endNodeId: string;
  mode: 'walk' | 'bike';
  /** 通常出發時刻（HH:mm），用來決定推送時機；現階段純 UI 顯示 */
  preferredTimes: string[];
  createdAt: string;
}
