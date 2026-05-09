import type {
  ConfirmationType,
  CreateReportInput,
  Report,
  ReportConfirmation,
} from './types';
import { uuid } from './utils';

// 為了讓 dev 環境的「新增報告」在 hot reload 之間維持，把 store 掛到 globalThis
declare global {
  // eslint-disable-next-line no-var
  var __NTU_WATER_MOCK_STORE__:
    | { reports: Report[]; confirmations: ReportConfirmation[] }
    | undefined;
}

const NOW = Date.now();
const day = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString();

const seedReports: Report[] = [
  {
    id: 'r-001',
    title: '小椰林道在大雨後嚴重淹水',
    description: '昨日大雨後路面積水超過 20 公分，腳踏車難以通行。',
    category: 'flooding',
    severity: 'high',
    location_name: '小椰林道',
    latitude: 25.01755,
    longitude: 121.5403,
    image_url: null,
    reporter_name: '物理系大三',
    status: 'active',
    upvote_count: 12,
    resolved_count: 0,
    admin_note: null,
    created_at: day(1),
    updated_at: day(1),
  },
  {
    id: 'r-002',
    title: '總圖前方廣場有大面積積水',
    description: '即使天晴後仍有積水，疑似排水孔阻塞。',
    category: 'standing_water',
    severity: 'medium',
    location_name: '總圖書館前廣場',
    latitude: 25.0173,
    longitude: 121.5345,
    image_url: null,
    reporter_name: '社會系研究生',
    status: 'reviewing',
    upvote_count: 6,
    resolved_count: 1,
    admin_note: '已通知總務處清理排水孔。',
    created_at: day(2),
    updated_at: day(1),
  },
  {
    id: 'r-003',
    title: '舊體育館男廁洗手台漏水',
    description: '水龍頭關不緊，整夜流水。',
    category: 'facility_leak',
    severity: 'low',
    location_name: '舊體育館',
    latitude: 25.0162,
    longitude: 121.5375,
    image_url: null,
    reporter_name: '匿名',
    status: 'resolved',
    upvote_count: 3,
    resolved_count: 4,
    admin_note: '已維修完成。',
    created_at: day(8),
    updated_at: day(3),
  },
  {
    id: 'r-004',
    title: '醉月湖步道排水不良',
    description: '雨天後泥水堆積，行走時容易滑倒。',
    category: 'poor_drainage',
    severity: 'medium',
    location_name: '醉月湖',
    latitude: 25.0188,
    longitude: 121.5391,
    image_url: null,
    reporter_name: '森林系',
    status: 'active',
    upvote_count: 4,
    resolved_count: 0,
    admin_note: null,
    created_at: day(3),
    updated_at: day(3),
  },
  {
    id: 'r-005',
    title: '小椰林道下水道蓋附近滲水',
    description: '人行道旁持續有水滲出，疑似管線破損。',
    category: 'facility_leak',
    severity: 'high',
    location_name: '小椰林道',
    latitude: 25.0179,
    longitude: 121.5408,
    image_url: null,
    reporter_name: '土木系',
    status: 'active',
    upvote_count: 9,
    resolved_count: 0,
    admin_note: null,
    created_at: day(0),
    updated_at: day(0),
  },
  {
    id: 'r-006',
    title: '行政大樓後方走道積水',
    description: '走道有 5 公分高度積水，行人需繞道。',
    category: 'standing_water',
    severity: 'low',
    location_name: '行政大樓',
    latitude: 25.0169,
    longitude: 121.5388,
    image_url: null,
    reporter_name: '匿名',
    status: 'active',
    upvote_count: 2,
    resolved_count: 0,
    admin_note: null,
    created_at: day(4),
    updated_at: day(4),
  },
  {
    id: 'r-007',
    title: '共同教學館前下雨會大量積水',
    description: '已連續觀察三次下雨後出現相同情況。',
    category: 'flooding',
    severity: 'high',
    location_name: '共同教學館',
    latitude: 25.0166,
    longitude: 121.5403,
    image_url: null,
    reporter_name: '經濟系',
    status: 'reviewing',
    upvote_count: 7,
    resolved_count: 0,
    admin_note: null,
    created_at: day(2),
    updated_at: day(1),
  },
  {
    id: 'r-008',
    title: '醉月湖湖面溢出步道',
    description: '颱風後湖水高漲，步道難通行。',
    category: 'flooding',
    severity: 'medium',
    location_name: '醉月湖',
    latitude: 25.0192,
    longitude: 121.5395,
    image_url: null,
    reporter_name: '匿名',
    status: 'resolved',
    upvote_count: 5,
    resolved_count: 3,
    admin_note: '湖水退去，已巡視確認無安全問題。',
    created_at: day(10),
    updated_at: day(5),
  },
];

function getStore() {
  if (!globalThis.__NTU_WATER_MOCK_STORE__) {
    globalThis.__NTU_WATER_MOCK_STORE__ = {
      reports: [...seedReports],
      confirmations: [],
    };
  }
  return globalThis.__NTU_WATER_MOCK_STORE__;
}

export const mockStore = {
  listReports(): Report[] {
    return [...getStore().reports].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  },

  getReport(id: string): Report | null {
    return getStore().reports.find((r) => r.id === id) ?? null;
  },

  createReport(input: CreateReportInput): Report {
    const now = new Date().toISOString();
    const report: Report = {
      id: uuid(),
      title: input.title,
      description: input.description ?? null,
      category: input.category,
      severity: input.severity,
      location_name: input.location_name ?? null,
      latitude: input.latitude,
      longitude: input.longitude,
      image_url: input.image_url ?? null,
      reporter_name: input.reporter_name ?? null,
      status: 'active',
      upvote_count: 0,
      resolved_count: 0,
      admin_note: null,
      created_at: now,
      updated_at: now,
    };
    getStore().reports.unshift(report);
    return report;
  },

  updateReport(id: string, patch: Partial<Report>): Report | null {
    const reports = getStore().reports;
    const idx = reports.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    reports[idx] = {
      ...reports[idx],
      ...patch,
      updated_at: new Date().toISOString(),
    };
    return reports[idx];
  },

  deleteReport(id: string): boolean {
    const store = getStore();
    const len = store.reports.length;
    store.reports = store.reports.filter((r) => r.id !== id);
    store.confirmations = store.confirmations.filter((c) => c.report_id !== id);
    return store.reports.length < len;
  },

  addConfirmation(reportId: string, type: ConfirmationType): Report | null {
    const store = getStore();
    const idx = store.reports.findIndex((r) => r.id === reportId);
    if (idx < 0) return null;
    const confirmation: ReportConfirmation = {
      id: uuid(),
      report_id: reportId,
      type,
      created_at: new Date().toISOString(),
    };
    store.confirmations.push(confirmation);
    if (type === 'still_exists') {
      store.reports[idx].upvote_count += 1;
    } else {
      store.reports[idx].resolved_count += 1;
    }
    store.reports[idx].updated_at = new Date().toISOString();
    return store.reports[idx];
  },
};
