/**
 * gstemplate.gs — Router and template helpers for the Financial Dashboard Web App.
 * Handles doGet, JSON API routing, page routing, and template includes.
 */

/**
 * Entry point for the Web App.
 *
 * Modes:
 *   1. JSON API mode: ?api=dashboard|money|capital|profit
 *   2. HTML UI mode: ?page=dashboard|money|capital|profit
 *
 * JSON mode is used by the Lovable / React frontend.
 * HTML mode keeps the old Apps Script interface working.
 *
 * @param {Object} e - Event object from Apps Script doGet trigger.
 * @returns {HtmlOutput|TextOutput}
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};

    if (params.api) {
      return handleJsonApiRequest_(params);
    }

    var allowedPages = ['dashboard', 'money', 'capital', 'profit'];
    var requestedPage = params.page
      ? String(params.page).toLowerCase().trim()
      : 'dashboard';

    if (allowedPages.indexOf(requestedPage) === -1) {
      requestedPage = 'dashboard';
    }

    logInfo('doGet: page=' + requestedPage);

    var template = HtmlService.createTemplateFromFile('template');
    template.currentPage = requestedPage;
    template.scriptUrl = getScriptUrl();

    var output = template.evaluate();
    output.setTitle('Финансовый дашборд');
    output.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    output.addMetaTag('viewport', 'width=device-width, initial-scale=1.0');

    return output;
  } catch (err) {
    logError('doGet failed', err);
    return HtmlService.createHtmlOutput(
      '<p style="color:red;font-family:sans-serif;">Ошибка загрузки: ' +
      encodeHtmlEntities(String(err.message || err)) + '</p>'
    );
  }
}

/**
 * Routes JSON API requests for the React/Lovable frontend.
 * @param {Object} params - e.parameter from doGet.
 * @returns {TextOutput}
 */
function handleJsonApiRequest_(params) {
  var out;
  try {
    var api = String(params.api || '').toLowerCase().trim();
    logInfo('handleJsonApiRequest_: api=' + api + ' params=' + JSON.stringify(params));

    if (api === 'dashboard') {
      out = dashboardApiDashboard(params);
    } else if (api === 'money') {
      out = cashApiMoney(params);
    } else if (api === 'profit') {
      out = profitApiProfit(params);
    } else if (api === 'capital') {
      out = capitalApiCapital(params);
    } else {
      out = createErrorResponse('Unknown api: ' + api);
    }
  } catch (err) {
    logError('handleJsonApiRequest_ failed', err);
    out = createErrorResponse('Ошибка API: ' + (err.message || String(err)));
  }

  return ContentService
    .createTextOutput(JSON.stringify(prepareResponse(out)))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Includes an HTML file as a raw string into a template.
 * Used in template.html as <?= include('money') ?>.
 * @param {string} filename - The name of the .html file (without extension).
 * @returns {string} Raw HTML content.
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (err) {
    logError('include failed for file: ' + filename, err);
    return '<!-- ERROR: could not include ' + filename + ' -->';
  }
}

/**
 * Returns the URL of the deployed Web App script.
 * @returns {string}
 */
function getScriptUrl() {
  try {
    return ScriptApp.getService().getUrl();
  } catch (err) {
    logError('getScriptUrl failed', err);
    return '';
  }
}

/**
 * URL-encodes a parameter value for safe use in query strings.
 * @param {string} param
 * @returns {string}
 */
function encodeUrlParam(param) {
  try {
    return encodeURIComponent(String(param));
  } catch (err) {
    logError('encodeUrlParam failed', err);
    return '';
  }
}

/**
 * Escapes HTML special characters to prevent XSS in error messages.
 * @param {string} str
 * @returns {string}
 */
function encodeHtmlEntities(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
