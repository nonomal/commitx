import type { CliOptions, TimeRange } from '../types/index.js';

/** 时间预设格式: 7d / 1m / 3m / 6m / 1y */
const PERIOD_REGEX = /^(\d+)(d|m|y)$/;

/**
 * 解析时间预设字符串，返回起止时间范围
 */
export function parsePeriod(period: string): TimeRange {
  const match = PERIOD_REGEX.exec(period);
  if (!match) {
    throw new Error(`无效的时间预设: "${period}"，支持格式: 7d, 1m, 3m, 6m, 1y`);
  }

  const amount = parseInt(match[1], 10);
  const unit = match[2];
  const to = new Date();
  const from = new Date();

  switch (unit) {
    case 'd':
      from.setDate(from.getDate() - amount);
      break;
    case 'm':
      from.setMonth(from.getMonth() - amount);
      break;
    case 'y':
      from.setFullYear(from.getFullYear() - amount);
      break;
  }

  return { from, to };
}

/**
 * 解析日期字符串 YYYY-MM-DD
 */
function parseDate(dateStr: string): Date {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error(`无效的日期格式: "${dateStr}"，请使用 YYYY-MM-DD 格式`);
  }
  return date;
}

/**
 * 根据 CLI 参数解析最终的时间范围
 * --from / --to 优先于 --period
 */
export function resolveTimeRange(opts: CliOptions): TimeRange {
  if (opts.from || opts.to) {
    const to = opts.to ? parseDate(opts.to) : new Date();
    const from = opts.from ? parseDate(opts.from) : (() => {
      const d = new Date(to);
      d.setMonth(d.getMonth() - 3);
      return d;
    })();

    if (from > to) {
      throw new Error('起始日期不能晚于结束日期');
    }

    return { from, to };
  }

  return parsePeriod(opts.period);
}
