/**
 * 历史收益弹窗组件
 * 按日期维度展示每个股票的收益率和收益金额（根据持股数量计算）
 */

import { useMemo } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { Button, useToast } from '@/components/common';
import styles from './Watchlist.module.css';
import { getPositionRecords } from '@/services/storage';
import {
  formatPrice,
  formatPercent,
  formatChange,
  getChangeColorClass,
  normalizeStockCode,
} from '@/utils/format';

interface StockDailyProfit {
  code: string;
  name: string;
  profit: number; // 总收益金额 = (当日价格 - 建仓价) * 持股数
  profitPercent: number; // 收益率 = 总收益 / 建仓价 / 持股数
  price: number; // 当日收盘价
  changePercent: number; // 涨跌幅
  quantity: number; // 持股数
  costPrice: number; // 建仓价
}

interface ProfitHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  // 当前选中的日期（用于展示当日收益）
  selectedDate: string;
  // 所有股票的最新行情，用于计算当日收益
  quotes: Map<string, { code: string; name: string; price: number; changePercent: number; change: number }>;
  normalizedActiveCodes: string[];
  // 历史每日收益记录（日期 -> 总收益）
  sortedDailyHistory: { date: string; profit: number }[];
  // 当前选中的历史日期，用于高亮显示
  selectedHistoryDate: string;
  // 切换历史日期的回调
  onHistoryDateChange: (date: string) => void;
}

export function ProfitHistoryModal({
  isOpen,
  onClose,
  selectedDate,
  quotes,
  normalizedActiveCodes,
  sortedDailyHistory,
  selectedHistoryDate,
  onHistoryDateChange,
}: ProfitHistoryModalProps) {
  const toast = useToast();

  // 根据选中的历史日期获取对应的总收益（来自 sortedDailyHistory）
  const selectedHistoryProfit = useMemo(() => {
    const record = sortedDailyHistory.find((r) => r.date === selectedHistoryDate);
    return record ? record.profit : 0;
  }, [sortedDailyHistory, selectedHistoryDate]);

  // 获取指定日期的所有股票收益数据（按持股计算）
  const stockDailyProfitData = useMemo<StockDailyProfit[]>(() => {
    const profitData: StockDailyProfit[] = [];

    normalizedActiveCodes.forEach((code) => {
      const quote = quotes.get(code) || quotes.get(code.toLowerCase());
      const position = getPositionRecords()[normalizeStockCode(code)];

      if (quote && position) {
        const quantity = Math.max(0, position.quantity || 0);
        const costPrice = Math.max(0, position.costPrice || 0);
        const price = quote.price || 0;
        const changePercent = quote.changePercent || 0;

        // 总收益金额 = (当日价格 - 建仓价) * 持股数
        const profit = (price - costPrice) * quantity;
        // 收益率 = (当日价格 - 建仓价) / 建仓价 * 100%
        const profitPercent = costPrice > 0 ? ((price - costPrice) / costPrice) * 100 : 0;

        profitData.push({
          code: quote.code,
          name: quote.name,
          profit,
          profitPercent,
          price,
          changePercent,
          quantity,
          costPrice,
        });
      }
    });

    // 按总收益金额排序
    return profitData.sort((a, b) => b.profit - a.profit);
  }, [normalizedActiveCodes, quotes]);

  // 计算当日所有股票的总收益
  // 当日（或选中历史）总收益金额，若有历史收益则使用历史数据，否则使用当前计算值
  const totalProfit = useMemo(() => {
    if (selectedHistoryDate) {
      return selectedHistoryProfit;
    }
    return stockDailyProfitData.reduce((sum, item) => sum + item.profit, 0);
  }, [stockDailyProfitData, selectedHistoryDate, selectedHistoryProfit]);

  // 计算当日总涨跌幅
  const totalChangePercent = useMemo(() => {
    if (stockDailyProfitData.length === 0) return 0;
    const weightedSum = stockDailyProfitData.reduce(
      (sum, item) => sum + item.changePercent * (item.profit > 0 ? 1 : -1),
      0
    );
    return weightedSum / stockDailyProfitData.length;
  }, [stockDailyProfitData]);

  // 计算所有股票的当日总涨跌额
  const allStocksTodayChange = useMemo(() => {
    return stockDailyProfitData.reduce((sum, item) => sum + (item.price - item.costPrice) * item.quantity, 0);
  }, [stockDailyProfitData]);

  const handleExport = () => {
    const exportText = `日期: ${selectedDate}\n` +
      `总收益: ${formatChange(totalProfit)}\n` +
      `总涨跌幅: ${formatPercent(totalChangePercent)}\n` +
      `所有股票当日总涨跌: ${formatChange(allStocksTodayChange)}\n\n` +
      `股票列表:\n` +
      `名称\t代码\t当日价格\t收益金额\t收益率\t涨跌幅\n` +
      stockDailyProfitData.map(item =>
        `${item.name}\t${item.code}\t${formatPrice(item.price)}\t${formatChange(item.profit)}\t${formatPercent(item.profitPercent)}\t${formatPercent(item.changePercent)}`
      ).join('\n');

    navigator.clipboard.writeText(exportText).then(() => {
      toast.success('已复制到剪贴板');
    }).catch(() => {
      toast.error('复制失败');
    });
  };

  if (!isOpen) return null;

  // 使用 portal 渲染，确保弹框层级在最外层，不受父容器样式影响
  return ReactDOM.createPortal(
    <motion.div
      className={styles['profit-history-modal']}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className={styles['profit-history-modal-content']}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles['profit-history-header']}>
          <h3>历史收益详情 - {selectedHistoryDate}</h3>
          <button className={styles['close-btn']} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className={styles['profit-history-header']}>
          <input
            type="date"
            value={selectedHistoryDate}
            onChange={(e) => onHistoryDateChange(e.target.value)}
            className={styles['historyDateInput']}
          />
        </div>
        <div className={styles['profit-history-summary']}>
            <div className={styles['summary-item']}>
            <span className={styles['summary-label']}>总收益金额</span>
            <span className={`${styles['summary-value']} ${getChangeColorClass(totalProfit)}`}> 
              {formatChange(totalProfit)}
            </span>
          </div>
          <div className={styles['summary-item']}>
            <span className={styles['summary-label']}>总涨跌幅</span>
            <span className={`${styles['summary-value']} ${getChangeColorClass(totalChangePercent)}`}> 
              {formatPercent(totalChangePercent)}
            </span>
          </div>
          <div className={styles['summary-item']}>
            <span className={styles['summary-label']}>所有股票当日总涨跌</span>
            <span className={`${styles['summary-value']} ${getChangeColorClass(allStocksTodayChange)}`}> 
              {formatChange(allStocksTodayChange)}
            </span>
          </div>
        </div>

        <div className={styles['profit-history-table']}>
          <div className={styles['table-header']}>
            <span className={styles['colName']}>股票名称</span>
            <span className={styles['colCode']}>代码</span>
            <span className={styles['colPrice']}>当日价格</span>
            <span className={styles['colProfit']}>收益金额</span>
            <span className={styles['colProfitPercent']}>收益率</span>
            <span className={styles['colChangePercent']}>涨跌幅</span>
          </div>
          <div className={styles['table-body']}>
            {stockDailyProfitData.map((item) => (
                <div
                  key={item.code}
                  className={`${styles['table-row']} ${getChangeColorClass(item.changePercent)}`}
                >
                  <div className={styles['colName']}>
                    <span className={styles['stockName']}>{item.name}</span>
                  </div>
                  <div className={styles['colCode']}>
                    <span className={styles['stockCode']}>{item.code}</span>
                  </div>
                <span className={styles['colPrice']}>
                  {formatPrice(item.price)}
                </span>
                <span className={`${styles['colProfit']} ${getChangeColorClass(item.profit)}`}>
                  {formatChange(item.profit)}
                </span>
                <span className={`${styles['colProfitPercent']} ${getChangeColorClass(item.profitPercent)}`}>
                  {formatPercent(item.profitPercent)}
                </span>
                <span className={`${styles['colChangePercent']} ${getChangeColorClass(item.changePercent)}`}>
                  {formatPercent(item.changePercent)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles['profit-history-footer']}>
          <Button variant="ghost" onClick={onClose}>
            关闭
          </Button>
          <Button variant="primary" onClick={handleExport}>
            复制明细
          </Button>
        </div>
      </motion.div>
    </motion.div>
  , document.body);
}
