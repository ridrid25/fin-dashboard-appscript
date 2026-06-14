/**
 * gstemplate.gs — Router and template helpers for the Financial Dashboard Web App.
 * Handles doGet, page routing, and template includes.
 */

/**
 * Entry point for the Web App.
 * Reads ?page=... query param; allowed pages: dashboard, money, capital, profit.
 * Falls back to 'dashboard' for unknown or missing values.
 * @param {Object} e - Event object from Apps Script doGet trigger.
 * @returns {HtmlOutput}
 */
function doGet(e) {
  try {
    var allowedPages = ['dashboard', 'money', 'capital', 'profit'];
    var requestedPage = (e && e.parameter && e.parameter.page)
      ? String(e.parameter.page).toLowerCase().trim()
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
