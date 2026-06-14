/**
 * gscore.gs — Core module: CONFIG, data layer, contract helpers, shared utilities.
 * All other modules depend on this file.
 */

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

const CONFIG = {
  // ID таблицы с данными (читаем напрямую, не зависим от привязки скрипта)
  DATA_SPREADSHEET_ID: '1jTjAlrBClUhAnhUqKsaVZ_CjZf7657oSeebGB8KVrto',
  SHEETS: { MONEY: 'Деньги', CAPITAL: 'Капитал', PROFIT: 'Прибыль' },
  DATE_FORMAT: 'dd.MM.yyyy',
  CURRENCY_SYMBOL: '₽',
  DECIMAL_PLACES: 2,
  THOUSANDS_SEPARATOR: ' ',
  CASH: {
    openingBalanceFrom: 'CAPITAL',
    cashRow3: 'Денежные средства',
    fallbackOpening: 0,
    excludeOddsSection: '5. Перемещение'
  },
  PROFIT: { netProfitSections: [1, 2, 3, 4, 5, 6, 7] },
  EQUITY: {
    section1: { assets: 'Активы', liabilities: 'Пассивы' },
    currentAssets: 'Оборотные активы',
    currentLiabilities: ['Краткосрочные обязательства', 'Кредиторская задолженность'],
    equity: 'Капитал',
    arItemsR4: ['Задолженность клиентов'],
    apItemsR4: ['Задолженность перед поставщиками', 'Задолженность перед подрядчиками']
  }
};

// ─────────────────────────────────────────────────────────────
// LOGGING
// ─────────────────────────────────────────────────────────────

function logDebug(msg) {
  Logger.log('[DEBUG] ' + msg);
}

function logInfo(msg) {
  Logger.log('[INFO] ' + msg);
}

function logError(msg, err) {
  var detail = err ? (' | ' + (err.stack || err.message || String(err))) : '';
  Logger.log('[ERROR] ' + msg + detail);
}

// ─────────────────────────────────────────────────────────────
// CONTRACT HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Creates a standard success response envelope.
 * @param {Object} data - Must contain kpis, tables, charts, meta sub-keys.
 * @returns {Object} {status:'success', data, error:null}
 */
function createSuccessResponse(data) {
  return prepareResponse({ status: 'success', data: data, error: null });
}

/**
 * Creates a standard error response envelope.
 * @param {string} msg - Human-readable error message.
 * @returns {Object} {status:'error', data:null, error:msg}
 */
function createErrorResponse(msg) {
  return prepareResponse({ status: 'error', data: null, error: String(msg) });
}

/**
 * Recursively sanitises an object for safe transmission via google.script.run:
 *   - NaN / Infinity / -Infinity → 0
 *   - undefined properties removed
 *   - Date objects → ISO string
 * @param {*} obj
 * @returns {*}
 */
function prepareResponse(obj) {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (obj instanceof Date) {
    return isNaN(obj.getTime()) ? null : obj.toISOString();
  }
  if (typeof obj === 'number') {
    if (!isFinite(obj) || isNaN(obj)) return 0;
    return obj;
  }
  if (typeof obj === 'string' || typeof obj === 'boolean') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(function(item) { return prepareResponse(item); });
  }
  if (typeof obj === 'object') {
    var result = {};
    var keys = Object.keys(obj);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var val = obj[key];
      if (val === undefined) continue;
      result[key] = prepareResponse(val);
    }
    return result;
  }
  return obj;
}

// ─────────────────────────────────────────────────────────────
// SHEET ACCESS
// ─────────────────────────────────────────────────────────────

/**
 * Returns a Range for the given sheet, first trying a named range,
 * then falling back to the entire used range of the sheet.
 * Named ranges: rangecash, rangeprofit, rangeequity.
 * @param {string} sheetName - CONFIG.SHEETS.* value.
 * @param {string} rangeName - Named range name (e.g. 'rangecash').
 * @returns {GoogleAppsScript.Spreadsheet.Range|null}
 */
function getSheetRange(sheetName, rangeName) {
  try {
    var ss = CONFIG.DATA_SPREADSHEET_ID ? SpreadsheetApp.openById(CONFIG.DATA_SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet();
    // Try named range first
    if (rangeName) {
      try {
        var namedRange = ss.getRangeByName(rangeName);
        if (namedRange) {
          logDebug('getSheetRange: using named range "' + rangeName + '"');
          return namedRange;
        }
      } catch (nre) {
        logDebug('getSheetRange: named range "' + rangeName + '" not found, falling back');
      }
    }
    // Fallback: entire used range of sheet
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      logError('getSheetRange: sheet "' + sheetName + '" not found');
      return null;
    }
    var dataRange = sheet.getDataRange();
    logDebug('getSheetRange: using full sheet "' + sheetName + '" range ' + dataRange.getA1Notation());
    return dataRange;
  } catch (err) {
    logError('getSheetRange failed for sheet=' + sheetName, err);
    return null;
  }
}

/**
 * Reads a sheet (or named range) and returns an array of plain objects,
 * using the first row as header keys. Empty rows are skipped.
 * @param {string} sheetName - Sheet name from CONFIG.SHEETS.
 * @param {string} rangeName - Named range name for this sheet.
 * @returns {Object[]} Array of row objects.
 */
function readSheetAsObjects(sheetName, rangeName) {
  try {
    var range = getSheetRange(sheetName, rangeName);
    if (!range) {
      logError('readSheetAsObjects: no range for sheet=' + sheetName);
      return [];
    }
    var values = range.getValues();
    if (!values || values.length < 2) {
      logDebug('readSheetAsObjects: sheet "' + sheetName + '" has fewer than 2 rows');
      return [];
    }

    var headers = values[0].map(function(h) { return String(h).trim(); });
    var rows = [];

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      // Skip rows where ALL cells are empty
      var hasData = row.some(function(cell) {
        return cell !== null && cell !== undefined && String(cell).trim() !== '';
      });
      if (!hasData) continue;

      var obj = {};
      for (var c = 0; c < headers.length; c++) {
        obj[headers[c]] = row[c] !== undefined ? row[c] : null;
      }
      rows.push(obj);
    }

    logDebug('readSheetAsObjects: sheet="' + sheetName + '" loaded ' + rows.length + ' rows');
    return rows;
  } catch (err) {
    logError('readSheetAsObjects failed for sheet=' + sheetName, err);
    return [];
  }
}

// ────────────────────────────────────────────────────────────
// NORMALISATION
// ───────────────────────────────────────────────────────────

/**
 * Normalises a raw cell value to a JavaScript number.
 * Removes all whitespace (including NBSP), replaces comma decimal separator,
 * then parses as float. Returns 0 for non-numeric / empty values.
 * @param {*} v
 * @returns {number}
 */
function normalizeValue(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') {
    return isFinite(v) ? v : 0;
  }
  var s = String(v)
    .replace(/[\s\u00a0]/g, '')   // remove all whitespace and NBSP
    .replace(/,/g, '.');           // comma → dot decimal separator
  if (s === '' || s === '-') return 0;
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

/**
 * Parses a date value into a Date object (timezone-agnostic).
 * Accepts: JS Date, 'YYYY-MM-DD', 'DD.MM.YYYY'.
 * Returns null for invalid / empty input. NEVER substitutes today's date.
 * @param {*} v
 * @returns {Date|null}
 */
function parseDate(v) {
  if (v === null || v === undefined || v === '') return null;

  // Already a Date (from Sheets)
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // Reconstruct without timezone shift
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }

  var s = String(v).trim();
  if (s === '') return null;

  // ISO format YYYY-MM-DD
  var isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    var y = parseInt(isoMatch[1], 10);
    var m = parseInt(isoMatch[2], 10);
    var d = parseInt(isoMatch[3], 10);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return new Date(y, m - 1, d);
    }
    return null;
  }

  // Russian format DD.MM.YYYY
  var ruMatch = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ruMatch) {
    var dd = parseInt(ruMatch[1], 10);
    var mm = parseInt(ruMatch[2], 10);
    var yyyy = parseInt(ruMatch[3], 10);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return new Date(yyyy, mm - 1, dd);
    }
    return null;
  }

  return null;
}

/**
 * Sets a date to the start of day: 00:00:00.000.
 * @param {Date} d
 * @returns {Date}
 */
function startOfDay(d) {
  var copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * Sets a date to the end of day: 23:59:59.999.
 * @param {Date} d
 * @returns {Date}
 */
function endOfDay(d) {
  var copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setHours(23, 59, 59, 999);
  return copy;
}

// ─────────────────────────────────────────────────────────────
// FILTER / SORT / GROUP UTILITIES
// ─────────────────────────────────────────────────────────────

/**
 * Filters rows by a date range [from, to].
 * dateCol: the column name that contains a date value (will be parsed via parseDate).
 * from/to: Date objects with hours already set (use startOfDay/endOfDay).
 * @param {Object[]} rows
 * @param {string} dateCol
 * @param {Date|null} from
 * @param {Date|null} to
 * @returns {Object[]}
 */
function filterByDateRange(rows, dateCol, from, to) {
  return rows.filter(function(row) {
    var d = parseDate(row[dateCol]);
    if (!d) return false;
    var t = d.getTime();
    if (from && t < from.getTime()) return false;
    if (to && t > to.getTime()) return false;
    return true;
  });
}

/**
 * Filters rows by multiple conditions (AND logic).
 * conditions: [{col: 'ColumnName', value: 'exactValue'}]
 * @param {Object[]} rows
 * @param {Array<{col:string, value:*}>} conditions
 * @returns {Object[]}
 */
function filterByConditions(rows, conditions) {
  if (!conditions || conditions.length === 0) return rows;
  return rows.filter(function(row) {
    return conditions.every(function(cond) {
      return String(row[cond.col] || '').trim() === String(cond.value).trim();
    });
  });
}

/**
 * Sorts rows by a column value (string or number).
 * @param {Object[]} rows
 * @param {string} col
 * @param {boolean} [desc=false]
 * @returns {Object[]}
 */
function sortByColumn(rows, col, desc) {
  var factor = desc ? -1 : 1;
  return rows.slice().sort(function(a, b) {
    var av = a[col];
    var bv = b[col];
    if (typeof av === 'number' && typeof bv === 'number') return factor * (av - bv);
    return factor * String(av || '').localeCompare(String(bv || ''));
  });
}

/**
 * Groups rows by a column value into a Map: key → row[].
 * @param {Object[]} rows
 * @param {string} col
 * @returns {Map<string, Object[]>}
 */
function groupByColumn(rows, col) {
  var map = new Map();
  rows.forEach(function(row) {
    var key = String(row[col] || '').trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  });
  return map;
}

/**
 * Sums the numeric values of a column across all rows.
 * Uses normalizeValue for each cell.
 * @param {Object[]} rows
 * @param {string} col
 * @returns {number}
 */
function sumColumn(rows, col) {
  return rows.reduce(function(acc, row) {
    return acc + normalizeValue(row[col]);
  }, 0);
}

// ─────────────────────────────────────────────────────────────
// FORMATTING
// ─────────────────────────────────────────────────────────────

/**
 * Formats a number as a currency string with thousands separator and 2 decimal places.
 * Example: 1234567.89 → '1 234 567,89 ₽'
 * @param {number} n
 * @returns {string}
 */
function formatCurrency(n) {
  if (typeof n !== 'number' || !isFinite(n)) n = 0;
  var fixed = Math.abs(n).toFixed(CONFIG.DECIMAL_PLACES);
  var parts = fixed.split('.');
  var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, CONFIG.THOUSANDS_SEPARATOR);
  var result = (n < 0 ? '-' : '') + intPart + ',' + parts[1] + ' ' + CONFIG.CURRENCY_SYMBOL;
  return result;
}

/**
 * Returns a 'YYYY-MM' month key from a Date object.
 * @param {Date} d
 * @returns {string}
 */
function toMonthKey(d) {
  var y = d.getFullYear();
  var m = d.getMonth() + 1;
  return y + '-' + (m < 10 ? '0' + m : String(m));
}

// ─────────────────────────────────────────────────────────────
// CAPITAL: OPENING BALANCE
// ─────────────────────────────────────────────────────────────

/**
 * Returns the opening balance of cash from the Capital sheet.
 * Finds the snapshot with max(date) ≤ startDate in rows where
 * Раздел 3 = CONFIG.CASH.cashRow3.
 * Returns CONFIG.CASH.fallbackOpening (0) if nothing found.
 * @param {Date} startDate - The start of the analysis period.
 * @returns {number}
 */
function getOpeningBalance(startDate) {
  try {
    if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
      logError('getOpeningBalance: invalid startDate');
      return CONFIG.CASH.fallbackOpening;
    }

    var rows = readSheetAsObjects(CONFIG.SHEETS.CAPITAL, 'rangeequity');
    if (!rows || rows.length === 0) {
      logError('getOpeningBalance: no data in Capital sheet');
      return CONFIG.CASH.fallbackOpening;
    }

    var datCol = 'Дата';
    var sec3Col = 'Раздел 3';
    var sumCol = 'Сумма';

    var cashLabel = CONFIG.CASH.cashRow3;
    var cashRows = rows.filter(function(row) {
      return String(row[sec3Col] || '').trim() === cashLabel;
    });

    if (cashRows.length === 0) {
      logInfo('getOpeningBalance: no rows with Раздел 3 = "' + cashLabel + '"');
      return CONFIG.CASH.fallbackOpening;
    }

    var startTime = startOfDay(startDate).getTime();

    var bestDate = null;
    var bestTime = -Infinity;

    cashRows.forEach(function(row) {
      var d = parseDate(row[datCol]);
      if (!d) return;
      var t = d.getTime();
      if (t <= startTime && t > bestTime) {
        bestTime = t;
        bestDate = d;
      }
    });

    if (!bestDate) {
      logInfo('getOpeningBalance: no snapshot <= startDate ' + startDate.toISOString());
      return CONFIG.CASH.fallbackOpening;
    }

    var bestDateStart = startOfDay(bestDate).getTime();
    var bestDateEnd = endOfDay(bestDate).getTime();

    var balance = cashRows.reduce(function(acc, row) {
      var d = parseDate(row[datCol]);
      if (!d) return acc;
      var t = d.getTime();
      if (t >= bestDateStart && t <= bestDateEnd) {
        return acc + normalizeValue(row[sumCol]);
      }
      return acc;
    }, 0);

    logInfo('getOpeningBalance: snapshotDate=' + bestDate.toISOString() + ' balance=' + balance);
    return balance;
  } catch (err) {
    logError('getOpeningBalance failed', err);
    return CONFIG.CASH.fallbackOpening;
  }
}

// ─────────────────────────────────────────────────────────────
// CAPITAL: ALL SNAPSHOTS HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Returns all unique snapshot dates from the Capital sheet, sorted ascending.
 * @returns {Date[]}
 */
function capitalGetAllSnapshotDates() {
  try {
    var rows = readSheetAsObjects(CONFIG.SHEETS.CAPITAL, 'rangeequity');
    var seen = {};
    var dates = [];
    rows.forEach(function(row) {
      var d = parseDate(row['Дата']);
      if (!d) return;
      var key = d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
      if (!seen[key]) {
        seen[key] = true;
        dates.push(d);
      }
    });
    dates.sort(function(a, b) { return a.getTime() - b.getTime(); });
    return dates;
  } catch (err) {
    logError('capitalGetAllSnapshotDates failed', err);
    return [];
  }
}

/**
 * Returns the most recent snapshot date <= dateTo from Capital sheet.
 * Returns null if none found.
 * @param {Date} dateTo
 * @returns {Date|null}
 */
function capitalGetSnapshotDate(dateTo) {
  try {
    var allDates = capitalGetAllSnapshotDates();
    var toTime = endOfDay(dateTo).getTime();
    var best = null;
    allDates.forEach(function(d) {
      if (d.getTime() <= toTime) {
        best = d;
      }
    });
    return best;
  } catch (err) {
    logError('capitalGetSnapshotDate failed', err);
    return null;
  }
}

/**
 * Returns all Capital rows for a specific snapshot date.
 * @param {Date} snapshotDate
 * @returns {Object[]}
 */
function capitalGetRowsForDate(snapshotDate) {
  try {
    var rows = readSheetAsObjects(CONFIG.SHEETS.CAPITAL, 'rangeequity');
    var dayStart = startOfDay(snapshotDate).getTime();
    var dayEnd = endOfDay(snapshotDate).getTime();
    return rows.filter(function(row) {
      var d = parseDate(row['Дата']);
      if (!d) return false;
      var t = d.getTime();
      return t >= dayStart && t <= dayEnd;
    });
  } catch (err) {
    logError('capitalGetRowsForDate failed', err);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────
// CAPITAL KPI HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Calculates KPI values from Capital rows for a given snapshot date.
 * @param {Date} snapshotDate
 * @returns {Object} KPI values
 */
function capitalCalcKpisForDate(snapshotDate) {
  var rows = capitalGetRowsForDate(snapshotDate);

  var sec1Col = 'Раздел 1';
  var sec2Col = 'Раздел 2';
  var sec3Col = 'Раздел 3';
  var sec4Col = 'Раздел 4';
  var sumCol = 'Сумма';

  function sumWhere(filterFn) {
    return rows.filter(filterFn).reduce(function(acc, row) {
      return acc + normalizeValue(row[sumCol]);
    }, 0);
  }

  var equity = sumWhere(function(row) {
    return String(row[sec2Col] || '').trim() === CONFIG.EQUITY.equity;
  });

  var currentAssets = sumWhere(function(row) {
    return String(row[sec2Col] || '').trim() === CONFIG.EQUITY.currentAssets;
  });

  var currentLiabilities = sumWhere(function(row) {
    return CONFIG.EQUITY.currentLiabilities.indexOf(String(row[sec2Col] || '').trim()) !== -1;
  });

  var totalAssets = sumWhere(function(row) {
    return String(row[sec1Col] || '').trim() === CONFIG.EQUITY.section1.assets;
  });

  var arValue = sumWhere(function(row) {
    return CONFIG.EQUITY.arItemsR4.indexOf(String(row[sec4Col] || '').trim()) !== -1;
  });

  var apValue = sumWhere(function(row) {
    return CONFIG.EQUITY.apItemsR4.indexOf(String(row[sec4Col] || '').trim()) !== -1;
  });

  var liquidity = currentLiabilities !== 0 ? currentAssets / currentLiabilities : 0;
  var finIndependence = totalAssets !== 0 ? equity / totalAssets : 0;

  return {
    equity: equity,
    currentAssets: currentAssets,
    currentLiabilities: currentLiabilities,
    totalAssets: totalAssets,
    liquidity: liquidity,
    finIndependence: finIndependence,
    arValue: arValue,
    apValue: apValue
  };
}

// ─────────────────────────────────────────────────────────────
// API STUB ENTRIES (actual logic in module files)
// ─────────────────────────────────────────────────────────────

function apiMoney(params) {
  try {
    return cashApiMoney(params);
  } catch (err) {
    logError('apiMoney proxy failed', err);
    return createErrorResponse('Ошибка модуля Деньги: ' + (err.message || err));
  }
}

function apiCapital(params) {
  try {
    return capitalApiCapital(params);
  } catch (err) {
    logError('apiCapital proxy failed', err);
    return createErrorResponse('Ошибка модуля Капитал: ' + (err.message || err));
  }
}

function apiProfit(params) {
  try {
    return profitApiProfit(params);
  } catch (err) {
    logError('apiProfit proxy failed', err);
    return createErrorResponse('Ошибка модуля Прибыль: ' + (err.message || err));
  }
}

function apiDashboard(params) {
  try {
    return dashboardApiDashboard(params);
  } catch (err) {
    logError('apiDashboard proxy failed', err);
    return createErrorResponse('Ошибка модуля Дэшборд: ' + (err.message || err));
  }
}
