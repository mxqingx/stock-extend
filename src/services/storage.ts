/**
 * 本地存储服务
 * 管理自选、告警、配置等持久化数据
 */

import type {
  WatchlistGroup,
  AlertRule,
  AppSettings,
  HeatmapConfig,
  IndicatorConfig,
  SearchHistoryItem,
  ColumnConfig,
  PositionRecord,
  DailyProfitRecord,
} from '@/types';
import { normalizeStockCode } from '@/utils/format';

// 存储键
const STORAGE_KEYS = {
  WATCHLIST_GROUPS: 'watchlist.groups',
  ALERTS: 'watchlist.alerts',
  SETTINGS: 'app.settings',
  TABLE_COLUMNS: 'ui.tableColumns',
  HEATMAP_CONFIG: 'ui.heatmapConfig',
  INDICATOR_CONFIG: 'ui.indicatorConfig',
  SEARCH_HISTORY: 'search.recent',
  POSITION_RECORDS: 'watchlist.positionRecords',
  DAILY_PROFITS: 'watchlist.dailyProfits',
} as const;

// 默认设置
const DEFAULT_SETTINGS: AppSettings = {
  refreshInterval: {
    list: 0, // 0 表示使用默认值
    detail: 5000,
    heatmap: 10000,
  },
  colorMode: 'red-rise',
  heatmapConfig: {
    dimension: 'industry',
    colorField: 'changePercent',
    sizeField: 'totalMarketCap',
    colorMode: 'red-rise',
    topK: 200,
  },
  indicatorConfig: {
    ma: [5, 10, 20, 60],
    macd: { short: 12, long: 26, signal: 9 },
    boll: { period: 20, stdDev: 2 },
    kdj: { period: 9, kPeriod: 3, dPeriod: 3 },
    rsi: [6, 12, 24],
  },
};

// 默认自选分组
const DEFAULT_WATCHLIST_GROUPS: WatchlistGroup[] = [
  {
    id: 'default',
    name: '默认分组',
    codes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

// ========== IndexedDB 辅助（异步） ==========

const IDB_DB_NAME = 'stock_dashboard_db';
const IDB_STORE_WATCHLIST = 'watchlist_groups';
const IDB_VERSION = 1;

export function idbAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

/**
 * 初始化存储：当 IndexedDB 可用时，从 IDB 读取自选并覆盖 localStorage（如果 IDB 上的数据更新）
 * 在应用启动时调用，确保首次渲染时数据为最新（可选）。
 */
export async function initWatchlistStore(): Promise<void> {
  if (!idbAvailable()) return;
  try {
    const idbGroups = await idbGetWatchlistGroups();
    if (!idbGroups || idbGroups.length === 0) return;
    const localData = localStorage.getItem(STORAGE_KEYS.WATCHLIST_GROUPS);
    const localGroups = safeJsonParse(localData, DEFAULT_WATCHLIST_GROUPS);
    const localLatest = Math.max(...localGroups.map((g) => g.updatedAt || 0), 0);
    const idbLatest = Math.max(...idbGroups.map((g) => g.updatedAt || 0), 0);
    if (idbLatest > localLatest) {
      localStorage.setItem(STORAGE_KEYS.WATCHLIST_GROUPS, JSON.stringify(idbGroups));
    }
  } catch (e) {
    // ignore init errors
  }
}

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!idbAvailable()) return reject(new Error('IndexedDB not available'));
    const req = window.indexedDB.open(IDB_DB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_WATCHLIST)) {
        db.createObjectStore(IDB_STORE_WATCHLIST, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetWatchlistGroups(): Promise<WatchlistGroup[] | null> {
  try {
    const db = await openIdb();
    return await new Promise<WatchlistGroup[]>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_WATCHLIST, 'readonly');
      const store = tx.objectStore(IDB_STORE_WATCHLIST);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = req.result as WatchlistGroup[];
        resolve(result && result.length ? result : []);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    return null;
  }
}

async function idbSaveWatchlistGroups(groups: WatchlistGroup[]): Promise<void> {
  try {
    const db = await openIdb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_WATCHLIST, 'readwrite');
      const store = tx.objectStore(IDB_STORE_WATCHLIST);
      // 清空后写入，以保持与 localStorage 一致的数组
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const g of groups) {
          store.put(g);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    // ignore idb errors
  }
}

/**
 * 尝试从 IDB 同步到 localStorage（如果 IDB 有更近期的数据）
 */
async function syncFromIdbIfNewer(localGroups: WatchlistGroup[]): Promise<void> {
  const idbGroups = await idbGetWatchlistGroups();
  if (!idbGroups) return;
  if (idbGroups.length === 0) return;

  const localLatest = Math.max(...localGroups.map((g) => g.updatedAt || 0), 0);
  const idbLatest = Math.max(...idbGroups.map((g) => g.updatedAt || 0), 0);
  if (idbLatest > localLatest) {
    // 覆盖 localStorage
    localStorage.setItem(STORAGE_KEYS.WATCHLIST_GROUPS, JSON.stringify(idbGroups));
  }
}

/**
 * 异步持久化：写入 localStorage 并等待 IndexedDB 写入完成（若可用）
 */
export async function saveWatchlistGroupsAsync(groups: WatchlistGroup[]): Promise<void> {
  localStorage.setItem(STORAGE_KEYS.WATCHLIST_GROUPS, JSON.stringify(groups));
  if (idbAvailable()) {
    await idbSaveWatchlistGroups(groups);
  }
}

/**
 * 安全读取 JSON
 */
function safeJsonParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// ========== 自选分组 ==========

/**
 * 获取所有自选分组
 */
export function getWatchlistGroups(): WatchlistGroup[] {
  const data = localStorage.getItem(STORAGE_KEYS.WATCHLIST_GROUPS);
  const groups = safeJsonParse(data, DEFAULT_WATCHLIST_GROUPS);
  let changed = false;

  const normalizedGroups = groups.map((group) => {
    let groupChanged = false;
    const seen = new Set<string>();
    const normalizedCodes = group.codes
      .map((code) => {
        const normalized = normalizeStockCode(code);
        if (normalized !== code) groupChanged = true;
        return normalized;
      })
      .filter((code) => {
        if (!code) {
          groupChanged = true;
          return false;
        }
        if (seen.has(code)) {
          groupChanged = true;
          return false;
        }
        seen.add(code);
        return true;
      });

    if (groupChanged || normalizedCodes.length !== group.codes.length) {
      changed = true;
      return { ...group, codes: normalizedCodes };
    }

    return group;
  });

  if (changed) {
    saveWatchlistGroups(normalizedGroups);
  }

  // 异步：若浏览器支持 IDB，则检查 IDB 是否有更为新鲜的数据，若有则覆盖 localStorage
  if (idbAvailable()) {
    // 不 await — 在后台同步，保持函数为同步 API
    syncFromIdbIfNewer(normalizedGroups).catch(() => {});
  }

  return normalizedGroups;
}

/**
 * 保存自选分组
 */
export function saveWatchlistGroups(groups: WatchlistGroup[]): void {
  localStorage.setItem(STORAGE_KEYS.WATCHLIST_GROUPS, JSON.stringify(groups));
  // 异步写入 IndexedDB（若可用），以 IDB 为主存储
  if (idbAvailable()) {
    // 不等待，保持同步 API 兼容性
    idbSaveWatchlistGroups(groups).catch(() => {});
  }
}

// 异步版本：在需要严格持久化时使用（会等待 IndexedDB 写入完成）
export { saveWatchlistGroups as saveWatchlistGroupsSync };

/**
 * 添加股票到自选
 */
export function addToWatchlist(code: string, groupId = 'default'): void {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group && !group.codes.includes(normalizedCode)) {
    group.codes.push(normalizedCode);
    group.updatedAt = Date.now();
    // 同步保存（立即生效）并异步持久化到 IndexedDB
    saveWatchlistGroups(groups);
  }
}

/** 异步版本：等待 IndexedDB 写入完成以确保持久化 */
export async function addToWatchlistAsync(code: string, groupId = 'default'): Promise<void> {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group && !group.codes.includes(normalizedCode)) {
    group.codes.push(normalizedCode);
    group.updatedAt = Date.now();
    await saveWatchlistGroupsAsync(groups);
  }
}

/**
 * 从自选移除股票
 */
export function removeFromWatchlist(code: string, groupId?: string): void {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const groups = getWatchlistGroups();
  if (groupId) {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      group.codes = group.codes.filter((c) => c !== normalizedCode);
      group.updatedAt = Date.now();
    }
  } else {
    // 从所有分组移除
    groups.forEach((group) => {
      group.codes = group.codes.filter((c) => c !== normalizedCode);
      group.updatedAt = Date.now();
    });
  }
  saveWatchlistGroups(groups);
}

/** 异步版本：等待 IndexedDB 写入完成以确保持久化 */
export async function removeFromWatchlistAsync(code: string, groupId?: string): Promise<void> {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const groups = getWatchlistGroups();
  if (groupId) {
    const group = groups.find((g) => g.id === groupId);
    if (group) {
      group.codes = group.codes.filter((c) => c !== normalizedCode);
      group.updatedAt = Date.now();
    }
  } else {
    // 从所有分组移除
    groups.forEach((group) => {
      group.codes = group.codes.filter((c) => c !== normalizedCode);
      group.updatedAt = Date.now();
    });
  }
  await saveWatchlistGroupsAsync(groups);
}

/**
 * 检查是否在自选中
 */
export function isInWatchlist(code: string): boolean {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return false;
  const groups = getWatchlistGroups();
  return groups.some((g) => g.codes.includes(normalizedCode));
}

/**
 * 获取所有自选代码
 */
export function getAllWatchlistCodes(): string[] {
  const groups = getWatchlistGroups();
  const codes = new Set<string>();
  groups.forEach((g) => g.codes.forEach((c) => codes.add(c)));
  return Array.from(codes);
}

/**
 * 创建分组
 */
export function createWatchlistGroup(name: string): WatchlistGroup {
  const groups = getWatchlistGroups();
  const newGroup: WatchlistGroup = {
    id: `group_${Date.now()}`,
    name,
    codes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  groups.push(newGroup);
  saveWatchlistGroups(groups);
  return newGroup;
}

export async function createWatchlistGroupAsync(name: string): Promise<WatchlistGroup> {
  const groups = getWatchlistGroups();
  const newGroup: WatchlistGroup = {
    id: `group_${Date.now()}`,
    name,
    codes: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  groups.push(newGroup);
  await saveWatchlistGroupsAsync(groups);
  return newGroup;
}

/**
 * 删除分组
 */
export function deleteWatchlistGroup(groupId: string): void {
  if (groupId === 'default') return; // 默认分组不可删除
  const groups = getWatchlistGroups().filter((g) => g.id !== groupId);
  saveWatchlistGroups(groups);
}

export async function deleteWatchlistGroupAsync(groupId: string): Promise<void> {
  if (groupId === 'default') return;
  const groups = getWatchlistGroups().filter((g) => g.id !== groupId);
  await saveWatchlistGroupsAsync(groups);
}

/**
 * 重命名分组
 */
export function renameWatchlistGroup(groupId: string, name: string): void {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.name = name;
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
}

export async function renameWatchlistGroupAsync(groupId: string, name: string): Promise<void> {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.name = name;
    group.updatedAt = Date.now();
    await saveWatchlistGroupsAsync(groups);
  }
}

/**
 * 批量从自选移除股票
 */
export function batchRemoveFromWatchlist(codes: string[], groupId: string): void {
  const normalizedCodes = codes.map(normalizeStockCode).filter(Boolean) as string[];
  if (normalizedCodes.length === 0) return;
  
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.codes = group.codes.filter((c) => !normalizedCodes.includes(c));
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
}

export async function batchRemoveFromWatchlistAsync(codes: string[], groupId: string): Promise<void> {
  const normalizedCodes = codes.map(normalizeStockCode).filter(Boolean) as string[];
  if (normalizedCodes.length === 0) return;
  
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.codes = group.codes.filter((c) => !normalizedCodes.includes(c));
    group.updatedAt = Date.now();
    await saveWatchlistGroupsAsync(groups);
  }
}

/**
 * 批量添加股票到自选
 */
export function batchAddToWatchlist(codes: string[], groupId = 'default'): number {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return 0;
  
  let addedCount = 0;
  codes.forEach((code) => {
    const normalizedCode = normalizeStockCode(code);
    if (normalizedCode && !group.codes.includes(normalizedCode)) {
      group.codes.push(normalizedCode);
      addedCount++;
    }
  });
  
  if (addedCount > 0) {
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
  
  return addedCount;
}

export async function batchAddToWatchlistAsync(codes: string[], groupId = 'default'): Promise<number> {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (!group) return 0;

  let addedCount = 0;
  codes.forEach((code) => {
    const normalizedCode = normalizeStockCode(code);
    if (normalizedCode && !group.codes.includes(normalizedCode)) {
      group.codes.push(normalizedCode);
      addedCount++;
    }
  });

  if (addedCount > 0) {
    group.updatedAt = Date.now();
    await saveWatchlistGroupsAsync(groups);
  }

  return addedCount;
}

/**
 * 更新分组内股票顺序
 */
export function reorderWatchlist(groupId: string, codes: string[]): void {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.codes = codes.map(normalizeStockCode).filter(Boolean) as string[];
    group.updatedAt = Date.now();
    saveWatchlistGroups(groups);
  }
}

export async function reorderWatchlistAsync(groupId: string, codes: string[]): Promise<void> {
  const groups = getWatchlistGroups();
  const group = groups.find((g) => g.id === groupId);
  if (group) {
    group.codes = codes.map(normalizeStockCode).filter(Boolean) as string[];
    group.updatedAt = Date.now();
    await saveWatchlistGroupsAsync(groups);
  }
}

// ========== 告警规则 ==========

/**
 * 获取所有告警规则
 */
export function getAlertRules(): AlertRule[] {
  const data = localStorage.getItem(STORAGE_KEYS.ALERTS);
  return safeJsonParse(data, []);
}

/**
 * 保存告警规则
 */
export function saveAlertRules(rules: AlertRule[]): void {
  localStorage.setItem(STORAGE_KEYS.ALERTS, JSON.stringify(rules));
}

/**
 * 添加告警规则
 */
export function addAlertRule(rule: Omit<AlertRule, 'id' | 'createdAt'>): AlertRule {
  const rules = getAlertRules();
  const newRule: AlertRule = {
    ...rule,
    id: `alert_${Date.now()}`,
    createdAt: Date.now(),
  };
  rules.push(newRule);
  saveAlertRules(rules);
  return newRule;
}

/**
 * 删除告警规则
 */
export function deleteAlertRule(ruleId: string): void {
  const rules = getAlertRules().filter((r) => r.id !== ruleId);
  saveAlertRules(rules);
}

/**
 * 更新告警规则
 */
export function updateAlertRule(ruleId: string, updates: Partial<AlertRule>): void {
  const rules = getAlertRules();
  const rule = rules.find((r) => r.id === ruleId);
  if (rule) {
    Object.assign(rule, updates);
    saveAlertRules(rules);
  }
}

/**
 * 获取某股票的告警规则
 */
export function getAlertsByCode(code: string): AlertRule[] {
  return getAlertRules().filter((r) => r.code === code);
}

// ========== 应用设置 ==========

/**
 * 获取应用设置
 */
export function getSettings(): AppSettings {
  const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
  return safeJsonParse(data, DEFAULT_SETTINGS);
}

/**
 * 保存应用设置
 */
export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
}

/**
 * 更新部分设置
 */
export function updateSettings(updates: Partial<AppSettings>): void {
  const settings = getSettings();
  Object.assign(settings, updates);
  saveSettings(settings);
}

// ========== 热力图配置 ==========

/**
 * 获取热力图配置
 */
export function getHeatmapConfig(): HeatmapConfig {
  const data = localStorage.getItem(STORAGE_KEYS.HEATMAP_CONFIG);
  return safeJsonParse(data, DEFAULT_SETTINGS.heatmapConfig);
}

/**
 * 保存热力图配置
 */
export function saveHeatmapConfig(config: HeatmapConfig): void {
  localStorage.setItem(STORAGE_KEYS.HEATMAP_CONFIG, JSON.stringify(config));
}

// ========== 指标配置 ==========

/**
 * 获取指标配置
 */
export function getIndicatorConfig(): IndicatorConfig {
  const data = localStorage.getItem(STORAGE_KEYS.INDICATOR_CONFIG);
  return safeJsonParse(data, DEFAULT_SETTINGS.indicatorConfig);
}

/**
 * 保存指标配置
 */
export function saveIndicatorConfig(config: IndicatorConfig): void {
  localStorage.setItem(STORAGE_KEYS.INDICATOR_CONFIG, JSON.stringify(config));
}

// ========== 表格列配置 ==========

/**
 * 获取表格列配置
 */
export function getTableColumns(pageKey: string): ColumnConfig[] | null {
  const data = localStorage.getItem(STORAGE_KEYS.TABLE_COLUMNS);
  const allConfigs = safeJsonParse<Record<string, ColumnConfig[]>>(data, {});
  return allConfigs[pageKey] || null;
}

/**
 * 保存表格列配置
 */
export function saveTableColumns(pageKey: string, columns: ColumnConfig[]): void {
  const data = localStorage.getItem(STORAGE_KEYS.TABLE_COLUMNS);
  const allConfigs = safeJsonParse<Record<string, ColumnConfig[]>>(data, {});
  allConfigs[pageKey] = columns;
  localStorage.setItem(STORAGE_KEYS.TABLE_COLUMNS, JSON.stringify(allConfigs));
}

// ========== 搜索历史 ==========

const MAX_SEARCH_HISTORY = 20;

/**
 * 获取搜索历史
 */
export function getSearchHistory(): SearchHistoryItem[] {
  const data = localStorage.getItem(STORAGE_KEYS.SEARCH_HISTORY);
  return safeJsonParse(data, []);
}

/**
 * 添加搜索历史
 */
export function addSearchHistory(item: Omit<SearchHistoryItem, 'timestamp'>): void {
  let history = getSearchHistory();
  // 移除重复项
  history = history.filter((h) => h.code !== item.code);
  // 添加到开头
  history.unshift({ ...item, timestamp: Date.now() });
  // 限制数量
  if (history.length > MAX_SEARCH_HISTORY) {
    history = history.slice(0, MAX_SEARCH_HISTORY);
  }
  localStorage.setItem(STORAGE_KEYS.SEARCH_HISTORY, JSON.stringify(history));
}

/**
 * 清除搜索历史
 */
export function clearSearchHistory(): void {
  localStorage.removeItem(STORAGE_KEYS.SEARCH_HISTORY);
}

// ========== 持仓记录 ==========

/**
 * 获取所有持仓记录（key 为标准化股票代码）
 */
export function getPositionRecords(): Record<string, PositionRecord> {
  const data = localStorage.getItem(STORAGE_KEYS.POSITION_RECORDS);
  const records = safeJsonParse<Record<string, PositionRecord>>(data, {});
  const normalized: Record<string, PositionRecord> = {};

  Object.entries(records).forEach(([code, record]) => {
    const normalizedCode = normalizeStockCode(code || record?.code || '');
    if (!normalizedCode) return;
    const costPrice = Number(record?.costPrice ?? 0);
    const quantity = Number(record?.quantity ?? 0);
    normalized[normalizedCode] = {
      code: normalizedCode,
      costPrice: Number.isFinite(costPrice) ? Math.max(0, costPrice) : 0,
      quantity: Number.isFinite(quantity) ? Math.max(0, Math.round(quantity)) : 0,
      updatedAt: record?.updatedAt || Date.now(),
    };
  });

  return normalized;
}

/**
 * 保存全部持仓记录
 */
export function savePositionRecords(records: Record<string, PositionRecord>): void {
  localStorage.setItem(STORAGE_KEYS.POSITION_RECORDS, JSON.stringify(records));
}

/**
 * 更新某只股票持仓
 */
export function upsertPositionRecord(code: string, updates: Partial<Pick<PositionRecord, 'costPrice' | 'quantity'>>): void {
  const normalizedCode = normalizeStockCode(code);
  if (!normalizedCode) return;
  const records = getPositionRecords();
  const prev = records[normalizedCode] || {
    code: normalizedCode,
    costPrice: 0,
    quantity: 0,
    updatedAt: Date.now(),
  };
  const costPrice = updates.costPrice ?? prev.costPrice;
  const quantity = updates.quantity ?? prev.quantity;
  records[normalizedCode] = {
    code: normalizedCode,
    costPrice: Math.max(0, Number(costPrice) || 0),
    quantity: Math.max(0, Math.round(Number(quantity) || 0)),
    updatedAt: Date.now(),
  };
  savePositionRecords(records);
}

/**
 * 获取每日收益记录（key 为 YYYY-MM-DD）
 */
export function getDailyProfitRecords(): Record<string, DailyProfitRecord> {
  const data = localStorage.getItem(STORAGE_KEYS.DAILY_PROFITS);
  const records = safeJsonParse<Record<string, DailyProfitRecord>>(data, {});
  const normalized: Record<string, DailyProfitRecord> = {};

  Object.entries(records).forEach(([date, record]) => {
    if (!date) return;
    const profit = Number(record?.profit ?? 0);
    normalized[date] = {
      date,
      profit: Number.isFinite(profit) ? profit : 0,
      updatedAt: record?.updatedAt || Date.now(),
    };
  });

  return normalized;
}

/**
 * 更新某日收益
 */
export function upsertDailyProfitRecord(date: string, profit: number): void {
  if (!date) return;
  const records = getDailyProfitRecords();
  records[date] = {
    date,
    profit: Number.isFinite(profit) ? profit : 0,
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEYS.DAILY_PROFITS, JSON.stringify(records));
}
