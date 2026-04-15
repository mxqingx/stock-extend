# Stock SDK API 文档

## 概述

本文档整理了项目中使用的所有 `stock-sdk` API 接口，包括实时行情、K线数据、板块信息、资金流向等功能。该文档可供小程序项目参考使用。

## SDK 初始化

```typescript
import { StockSDK } from 'stock-sdk';

const sdk = new StockSDK({
  timeout: 30000,
  retry: {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
});
```

## 实时行情 API

### 1. 获取完整行情（A股/指数）

**函数**: `getFullQuotes(codes: string[], useCache?: boolean)`

**功能**: 获取指定股票代码的完整行情数据，包括价格、涨跌幅、成交量、成交额、换手率、量比、市盈率、市净率、市值等。

**参数**:
- `codes`: 股票代码数组，如 `['600000', '000001']`
- `useCache`: 是否使用缓存，默认 `true`

**返回数据类型**: `FullQuote[]`

```typescript
interface FullQuote {
  code: string;          // 股票代码
  name: string;          // 股票名称
  price: number;         // 当前价格
  change: number;        // 涨跌额
  changePercent: number; // 涨跌幅(%)
  open: number;          // 开盘价
  prevClose: number;     // 昨收价
  high: number;          // 最高价
  low: number;           // 最低价
  volume: number;        // 成交量
  amount: number;        // 成交额
  turnoverRate: number;  // 换手率(%)
  volumeRatio: number;   // 量比
  pe: number;            // 市盈率
  pb: number;            // 市净率
  totalMarketCap: number;        // 总市值
  circulatingMarketCap: number;  // 流通市值
  bid?: Array<{ price: number; volume: number }>;  // 买盘
  ask?: Array<{ price: number; volume: number }>;  // 卖盘
}
```

**使用场景**: 个股详情页、自选股列表、首页行情展示

**缓存时间**: 5秒

---

### 2. 批量获取行情

**函数**: `getAllQuotesByCodes(codes: string[], options?)`

**功能**: 批量获取指定股票代码的行情数据，支持分批处理和并发控制。

**参数**:
- `codes`: 股票代码数组
- `options.batchSize`: 每批处理数量，默认 500
- `options.concurrency`: 并发数，默认 5
- `options.onProgress`: 进度回调函数 `(completed: number, total: number) => void`

**返回数据类型**: `FullQuote[]`

**使用场景**: 自选股列表、热力图、批量数据获取

---

### 3. 获取全部A股行情

**函数**: `getAllAShareQuotes(options?)`

**功能**: 获取全市场A股行情数据。

**参数**:
- `options.batchSize`: 每批处理数量
- `options.concurrency`: 并发数
- `options.onProgress`: 进度回调

**返回数据类型**: `FullQuote[]`

**使用场景**: 尾盘选股法、全市场扫描、热力图

---

## K线数据 API

### 4. 获取历史K线

**函数**: `getHistoryKline(symbol: string, options?)`

**功能**: 获取股票的历史K线数据。

**参数**:
- `symbol`: 股票代码
- `options.period`: 周期，可选 `'daily'` | `'weekly'` | `'monthly'`
- `options.adjust`: 复权类型，可选 `''` | `'qfq'` (前复权) | `'hfq'` (后复权)
- `options.startDate`: 开始日期
- `options.endDate`: 结束日期

**返回数据类型**: `KlineData[]`

```typescript
interface KlineData {
  date: string;    // 日期
  open: number;    // 开盘价
  close: number;   // 收盘价
  high: number;    // 最高价
  low: number;     // 最低价
  volume: number;  // 成交量
}
```

**使用场景**: K线图展示、历史数据分析

**缓存时间**: 10分钟

---

### 5. 获取带指标的K线

**函数**: `getKlineWithIndicators(symbol: string, options?)`

**功能**: 获取K线数据并计算技术指标。

**参数**:
- `symbol`: 股票代码
- `options.market`: 市场类型，可选 `'A'` | `'HK'` | `'US'`
- `options.period`: 周期
- `options.adjust`: 复权类型
- `options.startDate`: 开始日期
- `options.endDate`: 结束日期
- `options.indicators`: 指标配置

```typescript
interface IndicatorConfig {
  ma?: { periods?: number[] } | boolean;   // 均线
  macd?: { short?: number; long?: number; signal?: number } | boolean;
  boll?: { period?: number; stdDev?: number } | boolean;
  kdj?: { period?: number; kPeriod?: number; dPeriod?: number } | boolean;
  rsi?: { periods?: number[] } | boolean;
  wr?: { periods?: number[] } | boolean;
  bias?: { periods?: number[] } | boolean;
  cci?: { period?: number } | boolean;
  atr?: { period?: number } | boolean;
}
```

**返回数据类型**: `KlineWithIndicators[]`

```typescript
interface KlineWithIndicators {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  ma?: { [key: string]: number };  // 如 ma5, ma10, ma20, ma60
  macd?: { dif: number; dea: number; macd: number };
  boll?: { upper: number; mid: number; lower: number };
  kdj?: { k: number; d: number; j: number };
  rsi?: { rsi6?: number; rsi12?: number; rsi24?: number };
}
```

**使用场景**: K线图技术指标展示、信号扫描

**缓存时间**: 10分钟

---

### 6. 获取分钟K线

**函数**: `getMinuteKline(symbol: string, options?)`

**功能**: 获取分钟级别的K线数据。

**参数**:
- `symbol`: 股票代码
- `options.period`: 分钟周期，可选 `'1'` | `'5'` | `'15'` | `'30'` | `'60'`
- `options.adjust`: 复权类型
- `options.startDate`: 开始日期
- `options.endDate`: 结束日期

**返回数据类型**: `MinuteKlineData[]`

```typescript
interface MinuteKlineData {
  time: string;    // 时间
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}
```

**使用场景**: 分钟K线图展示

---

### 7. 获取当日分时

**函数**: `getTodayTimeline(code: string)`

**功能**: 获取当日分时数据。

**参数**:
- `code`: 股票代码

**返回数据类型**: `TodayTimelineResponse`

```typescript
interface TodayTimelineResponse {
  data: Array<{
    time: string;      // 时间
    price: number;     // 价格
    avgPrice: number;  // 均价
  }>;
}
```

**使用场景**: 分时图展示、尾盘选股法的分时强度计算

**缓存时间**: 5秒

---

## 板块 API

### 8. 获取行业板块列表

**函数**: `getIndustryList()`

**功能**: 获取所有行业板块的列表和实时数据。

**返回数据类型**: `IndustryBoard[]`

```typescript
interface IndustryBoard {
  code: string;                    // 板块代码
  name: string;                    // 板块名称
  changePercent: number;           // 涨跌幅(%)
  turnoverRate: number;            // 换手率(%)
  totalMarketCap: number;          // 总市值
  riseCount: number;               // 上涨家数
  fallCount: number;               // 下跌家数
  leadingStock?: string;           // 领涨股
  leadingStockChangePercent?: number; // 领涨股涨跌幅
}
```

**使用场景**: 板块列表、热力图、板块分析

**缓存时间**: 60秒

---

### 9. 获取概念板块列表

**函数**: `getConceptList()`

**功能**: 获取所有概念板块的列表和实时数据。

**返回数据类型**: `ConceptBoard[]`

```typescript
interface ConceptBoard {
  code: string;
  name: string;
  changePercent: number;
  turnoverRate: number;
  totalMarketCap: number;
  riseCount: number;
  fallCount: number;
  leadingStock?: string;
  leadingStockChangePercent?: number;
}
```

**使用场景**: 板块列表、热力图、概念分析

**缓存时间**: 60秒

---

### 10. 获取行业成分股

**函数**: `getIndustryConstituents(symbol: string)`

**功能**: 获取指定行业板块的成分股列表。

**参数**:
- `symbol`: 行业板块代码

**返回数据类型**: `IndustryBoardConstituent[]`

```typescript
interface IndustryBoardConstituent {
  code: string;          // 股票代码
  name: string;          // 股票名称
  rank: number;          // 排名
  price: number;         // 现价
  changePercent: number; // 涨跌幅
  amount: number;        // 成交额
  turnoverRate: number;  // 换手率
  pe: number;            // 市盈率
}
```

**使用场景**: 板块详情页、板块成分股列表

**缓存时间**: 3分钟

---

### 11. 获取概念成分股

**函数**: `getConceptConstituents(symbol: string)`

**功能**: 获取指定概念板块的成分股列表。

**参数**:
- `symbol`: 概念板块代码

**返回数据类型**: `ConceptBoardConstituent[]`

**使用场景**: 板块详情页、板块成分股列表

**缓存时间**: 3分钟

---

### 12. 获取行业K线

**函数**: `getIndustryKline(symbol: string, options?)`

**功能**: 获取行业板块的K线数据。

**参数**:
- `symbol`: 行业板块代码
- `options.period`: 周期
- `options.adjust`: 复权类型
- `options.startDate`: 开始日期
- `options.endDate`: 结束日期

**返回数据类型**: `IndustryBoardKline[]`

```typescript
interface IndustryBoardKline {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}
```

**使用场景**: 板块K线图

**缓存时间**: 10分钟

---

### 13. 获取概念K线

**函数**: `getConceptKline(symbol: string, options?)`

**功能**: 获取概念板块的K线数据。

**返回数据类型**: `ConceptBoardKline[]`

**使用场景**: 板块K线图

**缓存时间**: 10分钟

---

### 14. 获取行业分钟K线

**函数**: `getIndustryMinuteKline(symbol: string, options?)`

**功能**: 获取行业板块的分钟K线数据。

**参数**:
- `symbol`: 行业板块代码
- `options.period`: 分钟周期

**返回数据类型**: `MinuteKlineData[]`

**使用场景**: 板块分钟K线图

---

### 15. 获取概念分钟K线

**函数**: `getConceptMinuteKline(symbol: string, options?)`

**功能**: 获取概念板块的分钟K线数据。

**返回数据类型**: `MinuteKlineData[]`

**使用场景**: 板块分钟K线图

---

### 16. 获取行业Spot指标

**函数**: `getIndustrySpot(symbol: string)`

**功能**: 获取行业板块的实时指标数据。

**返回数据类型**: `IndustryBoardSpot[]`

```typescript
interface IndustryBoardSpot {
  item: string;   // 指标名称
  value: number;  // 指标值
}
```

**使用场景**: 板块详情页实时指标展示

---

### 17. 获取概念Spot指标

**函数**: `getConceptSpot(symbol: string)`

**功能**: 获取概念板块的实时指标数据。

**返回数据类型**: `ConceptBoardSpot[]`

**使用场景**: 板块详情页实时指标展示

---

## 资金与大单 API

### 18. 获取资金流向

**函数**: `getFundFlow(codes: string[])`

**功能**: 获取股票的资金流向数据。

**参数**:
- `codes`: 股票代码数组

**返回数据类型**: `FundFlow[]`

```typescript
interface FundFlow {
  mainNet: number;        // 主力净流入
  mainNetRatio: number;   // 主力净占比(%)
  retailNet: number;      // 散户净流入
}
```

**使用场景**: 个股详情页资金流向展示

**缓存时间**: 30秒

---

### 19. 获取盘口大单

**函数**: `getPanelLargeOrder(codes: string[])`

**功能**: 获取股票的盘口大单结构数据。

**参数**:
- `codes`: 股票代码数组

**返回数据类型**: `PanelLargeOrder[]`

```typescript
interface PanelLargeOrder {
  buyLargeRatio: number;   // 大买比例(%)
  buySmallRatio: number;   // 小买比例(%)
  sellSmallRatio: number;  // 小卖比例(%)
  sellLargeRatio: number;  // 大卖比例(%)
}
```

**使用场景**: 个股详情页大单结构展示

**缓存时间**: 30秒

---

## 搜索 API

### 20. 搜索股票/板块

**函数**: `search(keyword: string)`

**功能**: 根据关键词搜索股票或板块。

**参数**:
- `keyword`: 搜索关键词（股票代码、名称、拼音等）

**返回数据类型**: `SearchResult[]`

```typescript
interface SearchResult {
  code: string;
  name: string;
  market: string;  // 市场代码
  type: string;    // 类型
}
```

**使用场景**: 搜索框、股票搜索

---

## 其他 API

### 21. 获取交易日历

**函数**: `getTradingCalendar()`

**功能**: 获取交易日历数据。

**返回数据类型**: `TradingCalendar[]`

**使用场景**: 判断是否为交易日

**缓存时间**: 1小时

---

## 缓存机制

项目实现了内存缓存机制，不同 API 有不同的缓存时间：

| API 类型 | 缓存时间 | 说明 |
|---------|---------|------|
| 实时行情 | 5秒 | 保证数据实时性 |
| 板块列表 | 60秒 | 平衡实时性和性能 |
| 成分股 | 3分钟 | 数据变化较慢 |
| K线数据 | 10分钟 | 历史数据相对稳定 |
| 资金流向 | 30秒 | 较频繁更新 |
| 分时数据 | 5秒 | 实时性要求高 |
| 交易日历 | 1小时 | 几乎不变 |

### 缓存管理函数

```typescript
// 清除所有缓存
clearAllCache(): void

// 清除指定前缀的缓存
clearCacheByPrefix(prefix: string): void
```

---

## 典型使用示例

### 获取单个股票行情

```typescript
import { getFullQuotes } from '@/services/sdk';

const [quote] = await getFullQuotes(['600000']);
console.log(quote.name, quote.price, quote.changePercent);
```

### 获取K线数据并显示指标

```typescript
import { getKlineWithIndicators } from '@/services/sdk';

const klineData = await getKlineWithIndicators('600000', {
  period: 'daily',
  adjust: 'qfq',
  indicators: {
    ma: true,
    macd: true,
    rsi: true,
  },
});
```

### 获取板块成分股

```typescript
import { getIndustryConstituents } from '@/services/sdk';

const constituents = await getIndustryConstituents('BK0475');
consttopStocks = constituents.slice(0, 10);
```

### 批量获取行情（带进度）

```typescript
import { getAllAShareQuotes } from '@/services/sdk';

const quotes = await getAllAShareQuotes({
  batchSize: 500,
  concurrency: 5,
  onProgress: (completed, total) => {
    console.log(`进度: ${completed}/${total}`);
  },
});
```

### 获取分时数据

```typescript
import { getTodayTimeline } from '@/services/sdk';

const timeline = await getTodayTimeline('sh600000');
const prices = timeline.data.map(d => d.price);
const avgPrices = timeline.data.map(d => d.avgPrice);
```

---

## TypeScript 类型定义

```typescript
// 从 stock-sdk 导入类型
import type {
  FullQuote,
  TodayTimelineResponse,
  FundFlow,
  PanelLargeOrder,
  IndustryBoard,
  ConceptBoard,
  IndustryBoardConstituent,
  ConceptBoardConstituent,
  IndustryBoardKline,
  ConceptBoardKline,
  IndustryBoardSpot,
  ConceptBoardSpot,
} from 'stock-sdk';
```

---

## 注意事项

1. **股票代码格式**: 
   - A股代码一般为6位数字，如 `'600000'`
   - 完整代码格式为 `市场前缀 + 代码`，如 `'sh600000'`
   - 市场前缀: `sh` (上海), `sz` (深圳), `bj` (北交所)

2. **错误处理**:
   - 所有 API 调用都应该使用 try-catch 包装
   - 网络错误会自动重试（最多3次）

3. **性能优化**:
   - 合理使用缓存，减少重复请求
   - 批量获取时使用 `batchSize` 和 `concurrency` 控制并发
   - 移动端可以使用更长的轮询间隔

4. **数据更新频率**:
   - 行情数据建议 5-10秒 轮询
   - 分时数据建议 5秒 轮询
   - 资金流向建议 30秒 轮询

---

## 更新日志

- **v1.0.0** (2026-03-26): 初始版本，整理项目中使用的全部 API