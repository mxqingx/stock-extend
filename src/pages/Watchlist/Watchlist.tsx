/**
 * 自选管理页
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  Edit3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  CheckSquare,
  Square,
  X,
  Download,
  Upload,
  GripVertical,
  BarChart3,
} from 'lucide-react';
import { Card, Button, Loading, Empty, useToast } from '@/components/common';
import { usePolling } from '@/hooks';
import { getAllQuotesByCodes } from '@/services/sdk';
import {
  getWatchlistGroups,
  createWatchlistGroup,
  deleteWatchlistGroup,
  renameWatchlistGroup,
  removeFromWatchlistAsync,
  batchRemoveFromWatchlistAsync,
  batchAddToWatchlistAsync,
  reorderWatchlist,
  reorderWatchlistAsync,
  getPositionRecords,
  upsertPositionRecord,
  getDailyProfitRecords,
  upsertDailyProfitRecord,
} from '@/services/storage';
import {
  formatPrice,
  formatPercent,
  formatAmount,
  formatTurnover,
  getChangeColorClass,
  normalizeStockCode,
} from '@/utils/format';
import type { FullQuote } from 'stock-sdk';
import type { WatchlistGroup, PositionRecord, DailyProfitRecord } from '@/types';
import { ProfitHistoryModal } from './ProfitHistoryModal';
import styles from './Watchlist.module.css';

// 排序类型
type SortField = 'default' | 'changePercent' | 'amount' | 'turnoverRate' | 'totalMarketCap';
type SortOrder = 'asc' | 'desc';

const SORT_OPTIONS: { field: SortField; label: string }[] = [
  { field: 'default', label: '默认' },
  { field: 'changePercent', label: '涨幅' },
  { field: 'amount', label: '成交额' },
  { field: 'turnoverRate', label: '换手率' },
  { field: 'totalMarketCap', label: '市值' },
];

export function Watchlist() {
  const navigate = useNavigate();
  const toast = useToast();

  // 初始化分组数据
  const initialGroups = useMemo(() => getWatchlistGroups(), []);
  const initialActiveGroupId = useMemo(() => {
    return initialGroups.length > 0 ? initialGroups[0].id : 'default';
  }, [initialGroups]);

  // 状态
  const [groups, setGroups] = useState<WatchlistGroup[]>(initialGroups);
  const [activeGroupId, setActiveGroupId] = useState(initialActiveGroupId);
  const [quotes, setQuotes] = useState<Map<string, FullQuote>>(new Map());
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  // 排序
  const [sortField, setSortField] = useState<SortField>('default');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // 批量选择
  const [selectedStocks, setSelectedStocks] = useState<Set<string>>(new Set());
  const [showSelectMode, setShowSelectMode] = useState(false);

  // 导入导出
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');

  // 拖拽
  const [draggedCode, setDraggedCode] = useState<string | null>(null);
  const [positionRecords, setPositionRecords] = useState<Record<string, PositionRecord>>(() => getPositionRecords());
  const [dailyProfitRecords, setDailyProfitRecords] = useState<Record<string, DailyProfitRecord>>(() => getDailyProfitRecords());
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [showProfitHistory, setShowProfitHistory] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isTodayProfitAnimating, setIsTodayProfitAnimating] = useState(false);

  // 当前分组
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const activeCodes = useMemo(() => activeGroup?.codes || [], [activeGroup?.codes]);

  const normalizedActiveCodes = useMemo(() => {
    const codes = new Set<string>();
    activeCodes.forEach((code) => {
      const normalized = normalizeStockCode(code);
      if (normalized) {
        codes.add(normalized);
      }
    });
    return Array.from(codes);
  }, [activeCodes]);

  // 计算加载状态
  const isEmptyGroup = useMemo(() => {
    const group = groups.find((g) => g.id === activeGroupId);
    return !group || group.codes.length === 0;
  }, [groups, activeGroupId]);

  // 加载行情
  const fetchQuotes = useCallback(async () => {
    if (normalizedActiveCodes.length === 0) {
      return;
    }

    try {
      const data = await getAllQuotesByCodes(normalizedActiveCodes);
      const map = new Map<string, FullQuote>();

      // 使用标准化后的代码作为 key
      data.forEach((q) => {
        if (q && q.code) {
          const normalized = normalizeStockCode(q.code);
          map.set(normalized, q);
          // 同时保存原始格式
          map.set(q.code, q);
          map.set(q.code.toLowerCase(), q);
        }
      });

      setQuotes(map);
    } catch (error) {
      console.error('Fetch quotes error:', error);
    }
  }, [normalizedActiveCodes, quotes]);

  // 轮询（1秒刷新频率）
  usePolling(fetchQuotes, {
    interval: 1000,
    mobileInterval: 1000,
    adaptive: true,
    enabled: normalizedActiveCodes.length > 0,
    immediate: true,
  });

  // 计算持仓指标
  const holdingMetrics = useMemo(() => {
    const perCode: Record<string, { marketValue: number; currentProfit: number; todayProfit: number }> = {};
    let totalMarketValue = 0;
    let totalCurrentProfit = 0;
    let totalTodayProfit = 0;

    normalizedActiveCodes.forEach((code) => {
      const quote = quotes.get(code) || quotes.get(code.toLowerCase());
      const position = positionRecords[code];
      const quantity = Math.max(0, position?.quantity || 0);
      const costPrice = Math.max(0, position?.costPrice || 0);
      const price = Math.max(0, Number(quote?.price || 0));
      const priceChange = Number(quote?.change || 0);

      const marketValue = price * quantity;
      const currentProfit = (price - costPrice) * quantity;
      const todayProfit = priceChange * quantity;

      perCode[code] = { marketValue, currentProfit, todayProfit };
      totalMarketValue += marketValue;
      totalCurrentProfit += currentProfit;
      totalTodayProfit += todayProfit;
    });

    return {
      perCode,
      totalMarketValue,
      totalCurrentProfit,
      totalTodayProfit,
    };
  }, [normalizedActiveCodes, quotes, positionRecords]);

  // 当日收益波动动画效果
  useEffect(() => {
    if (holdingMetrics.totalTodayProfit !== 0) {
      setIsTodayProfitAnimating(true);
      const timer = setTimeout(() => {
        setIsTodayProfitAnimating(false);
      }, 500);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [holdingMetrics.totalTodayProfit]);

  // 股价波动动画效果
  useEffect(() => {
    if (quotes.size > 0) {
      // 检查是否有实际涨跌幅变化（非零值）
      let hasChange = false;
      for (const quote of quotes.values()) {
        const changePercent = Number(quote?.changePercent || 0);
        if (changePercent !== 0) {
          hasChange = true;
          break;
        }
      }
      
      if (hasChange) {
        setIsAnimating(true);
        const timer = setTimeout(() => {
          setIsAnimating(false);
        }, 500);
        return () => clearTimeout(timer);
      }
    }
    return () => {};
  }, [quotes]);

  // 创建分组
  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const newGroup = createWatchlistGroup(newGroupName.trim());
    setGroups(getWatchlistGroups());
    setActiveGroupId(newGroup.id);
    setNewGroupName('');
  };

  // 删除分组
  const handleDeleteGroup = (groupId: string) => {
    if (groupId === 'default') return;
    if (confirm('确定删除该分组？分组内的股票将被移除。')) {
      deleteWatchlistGroup(groupId);
      setGroups(getWatchlistGroups());
      if (activeGroupId === groupId) {
        setActiveGroupId('default');
      }
    }
  };

  // 重命名分组
  const handleRenameGroup = (groupId: string, name: string) => {
    renameWatchlistGroup(groupId, name);
    setGroups(getWatchlistGroups());
    setEditingGroup(null);
  };

  // 移除股票
  const handleRemoveStock = async (code: string) => {
    try {
      await removeFromWatchlistAsync(code, activeGroupId);
      setGroups(getWatchlistGroups());
      toast.success('已从自选移除');
    } catch (err) {
      console.error('Remove from watchlist failed:', err);
      toast.error('移除自选失败');
    }
  };

  // 跳转详情
  const handleStockClick = (code: string) => {
    navigate(`/s/${code}`);
  };

  // 切换排序
  const handleSortChange = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  }, [sortField]);

  // 切换选择
  const handleToggleSelect = useCallback((code: string) => {
    setSelectedStocks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(code)) {
        newSet.delete(code);
      } else {
        newSet.add(code);
      }
      return newSet;
    });
  }, []);

  // 全选/取消全选
  const handleSelectAll = useCallback(() => {
    if (selectedStocks.size === normalizedActiveCodes.length) {
      setSelectedStocks(new Set());
    } else {
      setSelectedStocks(new Set(normalizedActiveCodes));
    }
  }, [selectedStocks.size, normalizedActiveCodes]);

  // 批量删除
  const handleBatchDelete = useCallback(async () => {
    if (selectedStocks.size === 0) return;
    try {
      await batchRemoveFromWatchlistAsync(Array.from(selectedStocks), activeGroupId);
      setGroups(getWatchlistGroups());
      toast.success(`已删除 ${selectedStocks.size} 只股票`);
    } catch (err) {
      console.error('Batch remove failed:', err);
      toast.error('批量删除失败');
    }
    setSelectedStocks(new Set());
    setShowSelectMode(false);
  }, [selectedStocks, activeGroupId, toast]);

  // 导出自选
  const handleExport = useCallback(() => {
    const codes = normalizedActiveCodes.join('\n');
    navigator.clipboard.writeText(codes).then(() => {
      toast.success(`已复制 ${normalizedActiveCodes.length} 只股票代码到剪贴板`);
    }).catch(() => {
      // 降级处理：创建下载文件
      const blob = new Blob([codes], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `watchlist_${activeGroup?.name || 'default'}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('已导出股票代码');
    });
  }, [normalizedActiveCodes, activeGroup?.name, toast]);

  // 导入自选
  const handleImport = useCallback(async () => {
    if (!importText.trim()) {
      toast.info('请输入股票代码');
      return;
    }
    // 解析输入的代码，支持逗号、空格、换行分隔
    const codes = importText
      .split(/[\s,;，；\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (codes.length === 0) {
      toast.info('未识别到有效的股票代码');
      return;
    }

    try {
      const addedCount = await batchAddToWatchlistAsync(codes, activeGroupId);
      setGroups(getWatchlistGroups());
      setImportText('');
      setShowImportModal(false);

      if (addedCount > 0) {
        toast.success(`已导入 ${addedCount} 只股票`);
      } else {
        toast.info('所有股票已在自选中');
      }
    } catch (err) {
      console.error('Import add failed:', err);
      toast.error('导入失败');
    }
  }, [importText, activeGroupId, toast]);

  // 拖拽排序处理
  const handleDragStart = useCallback((code: string) => {
    setDraggedCode(code);
  }, []);

  const handleDragOver = useCallback(async (e: React.DragEvent, targetCode: string) => {
    e.preventDefault();
    if (!draggedCode || draggedCode === targetCode) return;
    
    const currentCodes = [...normalizedActiveCodes];
    const dragIndex = currentCodes.indexOf(draggedCode);
    const targetIndex = currentCodes.indexOf(targetCode);
    
    if (dragIndex === -1 || targetIndex === -1) return;
    
    // 移动元素
    currentCodes.splice(dragIndex, 1);
    currentCodes.splice(targetIndex, 0, draggedCode);
    
    // 更新顺序（等待持久化以保证一致性）
    try {
      await reorderWatchlistAsync(activeGroupId, currentCodes);
      setGroups(getWatchlistGroups());
    } catch (err) {
      console.error('Reorder failed:', err);
      // 回退到本地计算的顺序（仍会保持 UI 响应）
      reorderWatchlist(activeGroupId, currentCodes);
      setGroups(getWatchlistGroups());
    }
  }, [draggedCode, normalizedActiveCodes, activeGroupId]);

  const handleDragEnd = useCallback(() => {
    setDraggedCode(null);
  }, []);

  const handleUpdateCostPrice = useCallback((code: string, value: string) => {
    const normalizedCode = normalizeStockCode(code);
    if (!normalizedCode) return;
    const parsed = Number(value);
    const nextCostPrice = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    upsertPositionRecord(normalizedCode, { costPrice: nextCostPrice });
    setPositionRecords(getPositionRecords());
  }, []);

  const handleUpdateQuantity = useCallback((code: string, value: string) => {
    const normalizedCode = normalizeStockCode(code);
    if (!normalizedCode) return;
    const parsed = Number(value);
    const nextQuantity = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
    upsertPositionRecord(normalizedCode, { quantity: nextQuantity });
    setPositionRecords(getPositionRecords());
  }, []);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const roundedTodayProfit = Math.round(holdingMetrics.totalTodayProfit);
    upsertDailyProfitRecord(today, roundedTodayProfit);
    setDailyProfitRecords(getDailyProfitRecords());
  }, [holdingMetrics.totalTodayProfit]);

  const sortedDailyHistory = useMemo(() => {
    return Object.values(dailyProfitRecords).sort((a, b) => b.date.localeCompare(a.date));
  }, [dailyProfitRecords]);

  const selectedHistoryProfit = dailyProfitRecords[selectedHistoryDate]?.profit ?? 0;

  // 排序后的股票列表
  const sortedStocks = useMemo(() => {
    const stockList = normalizedActiveCodes
      .map((code) => {
        return quotes.get(code) || quotes.get(code.toLowerCase());
      })
      .filter((q): q is FullQuote => !!q);

    if (sortField === 'default') {
      return stockList; // 保持原始顺序
    }

    return [...stockList].sort((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortOrder === 'desc' ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
    });
  }, [normalizedActiveCodes, quotes, sortField, sortOrder]);

  return (
    <div className={styles.watchlist}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>分组</h3>
        </div>

        <div className={styles.groupList}>
          {groups.map((group) => (
            <div
              key={group.id}
              className={`${styles.groupItem} ${activeGroupId === group.id ? styles.active : ''}`}
              onClick={() => setActiveGroupId(group.id)}
            >
              {editingGroup === group.id ? (
                <input
                  type="text"
                  className={styles.groupInput}
                  defaultValue={group.name}
                  autoFocus
                  onBlur={(e) => handleRenameGroup(group.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRenameGroup(group.id, e.currentTarget.value);
                    }
                    if (e.key === 'Escape') {
                      setEditingGroup(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <>
                  <span className={styles.groupName}>{group.name}</span>
                  <span className={styles.groupCount}>{group.codes.length}</span>
                  {group.id !== 'default' && (
                    <div className={styles.groupActions}>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingGroup(group.id);
                        }}
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        className={styles.actionBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteGroup(group.id);
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        <div className={styles.addGroup}>
          <input
            type="text"
            className={styles.addGroupInput}
            placeholder="新建分组..."
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup();
            }}
          />
          <Button size="sm" icon={<Plus size={14} />} onClick={handleCreateGroup}>
            添加
          </Button>
        </div>
      </div>

      <div className={styles.main}>
        <Card
          title={activeGroup?.name || '自选股'}
          extra={
            <div className={styles.mainActions}>
              <span className={styles.stockCount}>
                共 {activeCodes.length} 只
              </span>
              {activeCodes.length > 0 && (
                <>
                  <button
                    className={styles.toolBtn}
                    onClick={() => setShowImportModal(true)}
                    title="导入"
                  >
                    <Upload size={14} />
                  </button>
                  <button
                    className={styles.toolBtn}
                    onClick={handleExport}
                    title="导出"
                  >
                    <Download size={14} />
                  </button>
                  <button
                    className={`${styles.toolBtn} ${showSelectMode ? styles.active : ''}`}
                    onClick={() => {
                      setShowSelectMode(!showSelectMode);
                      if (showSelectMode) {
                        setSelectedStocks(new Set());
                      }
                    }}
                    title={showSelectMode ? '取消选择' : '批量选择'}
                  >
                    {showSelectMode ? <X size={14} /> : <CheckSquare size={14} />}
                  </button>
                </>
              )}
            </div>
          }
        >
          {!isEmptyGroup && quotes.size === 0 ? (
            <Loading text="加载中..." />
          ) : activeCodes.length === 0 ? (
            <Empty
              title="暂无自选股"
              description="搜索添加股票到当前分组"
              action={
                <Button size="sm" onClick={() => setShowImportModal(true)}>
                  <Upload size={14} />
                  导入股票
                </Button>
              }
            />
          ) : (
            <>
              {/* 排序栏 */}
              <div className={styles.sortBar}>
                <div className={styles.sortSection}>
                  <ArrowUpDown size={14} />
                  <span className={styles.sortLabel}>排序：</span>
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.field}
                      className={`${styles.sortOption} ${sortField === option.field ? styles.active : ''}`}
                      onClick={() => handleSortChange(option.field)}
                    >
                      {option.label}
                      {sortField === option.field && option.field !== 'default' && (
                        sortOrder === 'desc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />
                      )}
                    </button>
                  ))}
                </div>
                {showSelectMode && (
                  <div className={styles.batchSection}>
                    <button className={styles.selectAllBtn} onClick={handleSelectAll}>
                      {selectedStocks.size === normalizedActiveCodes.length ? '取消全选' : '全选'}
                    </button>
                    <button
                      className={styles.batchDeleteBtn}
                      onClick={handleBatchDelete}
                      disabled={selectedStocks.size === 0}
                    >
                      <Trash2 size={14} />
                      删除 ({selectedStocks.size})
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.profitSummary}>
                <span className={styles.summaryItem}>
                  总持仓市值: {Math.round(holdingMetrics.totalMarketValue).toLocaleString()}
                </span>
                <span className={`${styles.summaryItem} ${getChangeColorClass(holdingMetrics.totalCurrentProfit)}`}>
                  总体收益: {Math.round(holdingMetrics.totalCurrentProfit).toLocaleString()}
                </span>
                <span className={`${styles.summaryItem} ${getChangeColorClass(holdingMetrics.totalTodayProfit)} ${styles.todayProfit} ${isTodayProfitAnimating ? styles.fluctuating : ''}`}>
                  当日收益: {Math.round(holdingMetrics.totalTodayProfit).toLocaleString()}
                </span>
                <button
                  className={`${styles.summaryItem} ${styles.historyBtn}`}
                  onClick={() => setShowProfitHistory(true)}
                  title="查看历史收益"
                >
                  <BarChart3 size={16} />
                  历史收益
                </button>
              </div>

              <div className={styles.historyPanel}>
                <div className={styles.historyHeader}>
                  <span className={styles.historyTitle}>每日收益查看</span>
                  <input
                    type="date"
                    className={styles.historyDateInput}
                    value={selectedHistoryDate}
                    onChange={(e) => setSelectedHistoryDate(e.currentTarget.value)}
                  />
                  <span className={`${styles.historyValue} ${getChangeColorClass(selectedHistoryProfit)}`}>
                    {selectedHistoryDate}: {Math.round(selectedHistoryProfit).toLocaleString()}
                  </span>
                </div>
                <div className={styles.historyList}>
                  {sortedDailyHistory.slice(0, 30).map((item) => (
                    <div key={item.date} className={styles.historyItem}>
                      <span className={styles.historyDate}>{item.date}</span>
                      <span className={getChangeColorClass(item.profit)}>
                        {Math.round(item.profit).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.stockTable}>
                <div className={styles.tableHeader}>
                  {showSelectMode && <span className={styles.colSelect}></span>}
                  {sortField === 'default' && <span className={styles.colDrag}></span>}
                  <span className={styles.colName}>名称/代码</span>
                  <span className={styles.colPrice}>现价</span>
                  <span className={styles.colChange}>涨跌幅</span>
                  <span className={styles.colAmount}>成交额</span>
                  <span className={styles.colTurnover}>换手</span>
                  <span className={styles.colCost}>建仓价</span>
                  <span className={styles.colQuantity}>持股数</span>
                  <span className={styles.colProfit}>当前收益</span>
                  <span className={styles.colProfit}>当日收益</span>
                  <span className={styles.colRatio}>持仓占比</span>
                  <span className={styles.colAction}>操作</span>
                </div>

                <div className={styles.tableBody}>
                  <AnimatePresence>
                    {sortedStocks.map((quote) => {
                      const isSelected = selectedStocks.has(quote.code);
                      const normalizedCode = normalizeStockCode(quote.code);
                      const position = positionRecords[normalizedCode];
                      const codeMetrics = holdingMetrics.perCode[normalizedCode] || {
                        marketValue: 0,
                        currentProfit: 0,
                        todayProfit: 0,
                      };
                      const positionRatio = holdingMetrics.totalMarketValue > 0
                        ? (codeMetrics.marketValue / holdingMetrics.totalMarketValue) * 100
                        : 0;
                      const changePercent = Number(quote.changePercent || 0);
                      const isFluctuating = isAnimating && changePercent !== 0;
                      const fluctuatingClass = isFluctuating
                        ? (changePercent > 0 ? styles.fluctuatingRise : styles.fluctuatingFall)
                        : '';
                      return (
                        <motion.div
                          key={quote.code}
                          className={`${styles.tableRow} ${isSelected ? styles.selected : ''} ${draggedCode === quote.code ? styles.dragging : ''} ${isFluctuating ? fluctuatingClass : ''}`}
                          style={
                            isFluctuating
                              ? {}
                              : {}
                          }
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          onClick={() => !showSelectMode && handleStockClick(quote.code)}
                          draggable={sortField === 'default' && !showSelectMode}
                          onDragStart={() => handleDragStart(quote.code)}
                          onDragOver={(e) => handleDragOver(e, quote.code)}
                          onDragEnd={handleDragEnd}
                        >
                          {showSelectMode && (
                            <div className={styles.colSelect}>
                              <button
                                className={styles.selectBtn}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleSelect(quote.code);
                                }}
                              >
                                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                              </button>
                            </div>
                          )}
                          {sortField === 'default' && !showSelectMode && (
                            <div className={styles.colDrag}>
                              <GripVertical size={14} className={styles.dragHandle} />
                            </div>
                          )}
                          <div className={styles.colName}>
                            <span className={styles.stockName}>{quote.name}</span>
                            <span className={styles.stockCode}>{quote.code}</span>
                          </div>
                          <span className={`${styles.colPrice} ${getChangeColorClass(quote.changePercent)}`}>
                            {formatPrice(quote.price)}
                          </span>
                          <span className={`${styles.colChange} ${getChangeColorClass(quote.changePercent)}`}>
                            {formatPercent(quote.changePercent)}
                          </span>
                          <span className={styles.colAmount}>
                            {formatAmount(quote.amount)}
                          </span>
                          <span className={styles.colTurnover}>
                            {formatTurnover(quote.turnoverRate)}
                          </span>
                          <span className={styles.colCost}>
                            <input
                              className={styles.positionInput}
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={position?.costPrice ?? ''}
                              placeholder="0"
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => handleUpdateCostPrice(quote.code, e.currentTarget.value)}
                            />
                          </span>
                          <span className={styles.colQuantity}>
                            <input
                              className={styles.positionInput}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={position?.quantity ?? ''}
                              placeholder="0"
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => handleUpdateQuantity(quote.code, e.currentTarget.value)}
                            />
                          </span>
                          <span className={`${styles.colProfit} ${getChangeColorClass(codeMetrics.currentProfit)}`}>
                            {Math.round(codeMetrics.currentProfit).toLocaleString()}
                          </span>
                          <span className={`${styles.colProfit} ${getChangeColorClass(codeMetrics.todayProfit)}`}>
                            {Math.round(codeMetrics.todayProfit).toLocaleString()}
                          </span>
                          <span className={styles.colRatio}>
                            {positionRatio.toFixed(1)}%
                          </span>
                          <div className={styles.colAction}>
                            <button
                              className={styles.removeBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveStock(quote.code);
                              }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </Card>

        {/* 导入弹窗 */}
        <AnimatePresence>
          {showImportModal && (
            <motion.div
              className={styles.modalOverlay}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowImportModal(false)}
            >
              <motion.div
                className={styles.modal}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={styles.modalHeader}>
                  <h3>导入股票</h3>
                  <button className={styles.modalClose} onClick={() => setShowImportModal(false)}>
                    <X size={18} />
                  </button>
                </div>
                <div className={styles.modalBody}>
                  <p className={styles.modalHint}>
                    输入股票代码，支持以下格式：
                    <br />
                    • 纯代码：000001, 600000
                    <br />
                    • 带市场：sh600000, sz000001
                    <br />
                    • 多个代码用逗号、空格或换行分隔
                  </p>
                  <textarea
                    className={styles.importTextarea}
                    placeholder="请输入股票代码..."
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    rows={6}
                  />
                </div>
                <div className={styles.modalFooter}>
                  <Button variant="ghost" onClick={() => setShowImportModal(false)}>
                    取消
                  </Button>
                  <Button variant="primary" onClick={handleImport}>
                    导入
                  </Button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 历史收益弹窗 */}
        <ProfitHistoryModal
          isOpen={showProfitHistory}
          onClose={() => setShowProfitHistory(false)}
          selectedDate={selectedHistoryDate}
          quotes={quotes}
          normalizedActiveCodes={normalizedActiveCodes}
          sortedDailyHistory={sortedDailyHistory}
          selectedHistoryDate={selectedHistoryDate}
          onHistoryDateChange={setSelectedHistoryDate}
        />
      </div>
    </div>
  );
}
