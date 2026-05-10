/**
 * Aggregate tier list responses into a results sheet.
 *
 * Source sheet (first): "Form_Responses" or index 0
 *   Row 1 — headers: Timestamp | Email | Tier List [Char1] | Tier List [Char2] | ...
 *   Row 2+ — responses with tier values: S, A, B, C, D
 *
 * Target sheet: "Results" (created if missing)
 *   Columns: Character | Total Points | Average Points | Scaled Points
 *            | S Count | S % | A Count | A % | B Count | B % | C Count | C % | D Count | D %
 *   Sorted by Total Points descending.
 *
 * Scoring: D=1, C=2, B=3, A=4, S=5 (bottom tier = 1, top tier = number of tiers).
 * Duplicate emails: only the latest response (by timestamp) is counted.
 *
 * Run manually or attach to a time-driven trigger.
 */

var TIER_POINTS = { S: 5, A: 4, B: 3, C: 2, D: 1 };
var RESULTS_SHEET_NAME = 'Results';
var SIMILARITY_SHEET_NAME = 'Similarity';

// ── Shared helpers ───────────────────────────────────────────────────────────

/** Extracts { col, name } entries from a header row (columns 2+, "Tier List [Name]"). */
function getCharacterColumns_(headers) {
  var charCols = [];
  for (var c = 2; c < headers.length; c++) {
    var match = String(headers[c]).match(/\[(.+)\]/);
    if (match) charCols.push({ col: c, name: match[1] });
  }
  return charCols;
}

/**
 * Deduplicates rows by email, keeping only the latest response per email.
 * Returns { latestByEmail, respondentCount }.
 */
function getUniqueResponses_(data) {
  var latestByEmail = {};
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var timestamp = new Date(row[0]);
    var email = String(row[1]).trim().toLowerCase();
    if (!email) continue;
    if (!latestByEmail[email] || timestamp > latestByEmail[email].ts) {
      latestByEmail[email] = { ts: timestamp, row: row };
    }
  }
  return { latestByEmail: latestByEmail, respondentCount: Object.keys(latestByEmail).length };
}

// ── aggregateResults ─────────────────────────────────────────────────────────

function aggregateResults() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheets()[0];
  var data = src.getDataRange().getValues();

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('No responses found.');
    return;
  }

  var headers = data[0];
  var charCols = getCharacterColumns_(headers);

  var unique = getUniqueResponses_(data);
  var latestByEmail = unique.latestByEmail;
  var respondentCount = unique.respondentCount;

  // Aggregate points per character
  var totals = {};      // character -> total points
  var tierCounts = {};  // character -> { S:0, A:0, B:0, C:0, D:0 }
  var TIERS = ['S', 'A', 'B', 'C', 'D'];
  for (var i = 0; i < charCols.length; i++) {
    totals[charCols[i].name] = 0;
    tierCounts[charCols[i].name] = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  }

  var emails = Object.keys(latestByEmail);
  for (var e = 0; e < emails.length; e++) {
    var resp = latestByEmail[emails[e]].row;
    for (var j = 0; j < charCols.length; j++) {
      var tier = String(resp[charCols[j].col]).trim().toUpperCase();
      var pts = TIER_POINTS[tier];
      if (pts !== undefined) {
        totals[charCols[j].name] += pts;
        tierCounts[charCols[j].name][tier]++;
      }
    }
  }

  // Build sorted results array
  var results = [];
  for (var name in totals) {
    var avg = respondentCount > 0 ? Math.round((totals[name] / respondentCount) * 100) / 100 : 0;
    var scaled = Math.round(((avg - 1) / 4) * 5 * 100) / 100;
    var row = [name, totals[name], avg, scaled];
    for (var t = 0; t < TIERS.length; t++) {
      var cnt = tierCounts[name][TIERS[t]];
      var pct = respondentCount > 0 ? cnt / respondentCount : 0;
      row.push(cnt, pct);
    }
    results.push(row);
  }
  results.sort(function (a, b) { return b[1] - a[1]; });

  // Write to Results sheet
  var dst = ss.getSheetByName(RESULTS_SHEET_NAME);
  if (!dst) {
    dst = ss.insertSheet(RESULTS_SHEET_NAME);
  }
  dst.clear();

  var NUM_COLS = 14;

  // Header
  dst.getRange(1, 1, 1, NUM_COLS).setValues([[
    'Character', 'Total Points', 'Average Points', 'Scaled Points',
    'S Count', 'S %', 'A Count', 'A %', 'B Count', 'B %',
    'C Count', 'C %', 'D Count', 'D %'
  ]]);
  dst.getRange(1, 1, 1, NUM_COLS).setFontWeight('bold');

  // Data
  if (results.length > 0) {
    dst.getRange(2, 1, results.length, NUM_COLS).setValues(results);
  }

  // Formatting
  var dataRows = Math.max(results.length, 1);
  dst.getRange(2, 3, dataRows, 1).setNumberFormat('0.00'); // Average Points
  dst.getRange(2, 4, dataRows, 1).setNumberFormat('0.00'); // Scaled Points
  // Percentage columns: 6, 8, 10, 12, 14
  for (var p = 0; p < 5; p++) {
    dst.getRange(2, 6 + p * 2, dataRows, 1).setNumberFormat('0.0%');
  }
  dst.autoResizeColumns(1, NUM_COLS);

  // Info row
  var infoRow = results.length + 3;
  dst.getRange(infoRow, 1).setValue('Unique respondents: ' + respondentCount);
  dst.getRange(infoRow, 1).setFontColor('#888888');

  SpreadsheetApp.getUi().alert(
    'Done! ' + results.length + ' characters, ' + respondentCount + ' unique respondents.'
  );
}

// ── buildSimilaritySheet ────────────────────────────────────────────────────

/**
 * Builds a "Similarity" sheet ranking respondents by how closely their
 * tier list matches the community average (Average Points per character).
 *
 * Metric: MAE = mean absolute error between respondent's tier points (1–5)
 *         and the community Average Points. Range 0–4 (lower = closer match).
 * Similarity Score = 1 − MAE/4.  Range 0.0–1.0 (higher = closer match).
 *
 * Also inserts a histogram chart of the Similarity Score distribution.
 *
 * Can be run independently — re-computes averages from raw responses.
 */
function buildSimilaritySheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheets()[0];
  var data = src.getDataRange().getValues();

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('No responses found.');
    return;
  }

  var headers = data[0];
  var charCols = getCharacterColumns_(headers);

  var unique = getUniqueResponses_(data);
  var latestByEmail = unique.latestByEmail;
  var respondentCount = unique.respondentCount;

  if (respondentCount === 0) {
    SpreadsheetApp.getUi().alert('No valid respondents found.');
    return;
  }

  // Compute community average points per character
  var totals = {};
  for (var i = 0; i < charCols.length; i++) totals[charCols[i].name] = 0;

  var emails = Object.keys(latestByEmail);
  for (var e = 0; e < emails.length; e++) {
    var resp = latestByEmail[emails[e]].row;
    for (var j = 0; j < charCols.length; j++) {
      var tier = String(resp[charCols[j].col]).trim().toUpperCase();
      var pts = TIER_POINTS[tier];
      if (pts !== undefined) totals[charCols[j].name] += pts;
    }
  }

  var avgs = {};
  for (var charName in totals) avgs[charName] = totals[charName] / respondentCount;

  // Compute MAE and Similarity Score per respondent
  var rows = [];
  for (var e2 = 0; e2 < emails.length; e2++) {
    var email = emails[e2];
    var resp2 = latestByEmail[email].row;
    var totalError = 0;
    var counted = 0;
    for (var k = 0; k < charCols.length; k++) {
      var tier2 = String(resp2[charCols[k].col]).trim().toUpperCase();
      var pts2 = TIER_POINTS[tier2];
      if (pts2 !== undefined) {
        totalError += Math.abs(pts2 - avgs[charCols[k].name]);
        counted++;
      }
    }
    var mae = counted > 0 ? totalError / counted : 4;
    var score = 1 - mae / 4;
    rows.push([email, mae, score]);
  }
  rows.sort(function (a, b) { return b[2] - a[2]; });

  // Write to Similarity sheet
  var dst = ss.getSheetByName(SIMILARITY_SHEET_NAME);
  if (!dst) {
    dst = ss.insertSheet(SIMILARITY_SHEET_NAME);
  }
  dst.clear();

  dst.getRange(1, 1, 1, 3).setValues([['Email', 'MAE', 'Similarity Score']]);
  dst.getRange(1, 1, 1, 3).setFontWeight('bold');

  if (rows.length > 0) {
    dst.getRange(2, 1, rows.length, 3).setValues(rows);
  }

  var dataRows = Math.max(rows.length, 1);
  dst.getRange(2, 2, dataRows, 1).setNumberFormat('0.000'); // MAE
  dst.getRange(2, 3, dataRows, 1).setNumberFormat('0.0%');  // Similarity Score
  dst.autoResizeColumns(1, 3);

  // Remove existing charts and insert a histogram of Similarity Score distribution
  var charts = dst.getCharts();
  for (var ch = 0; ch < charts.length; ch++) dst.removeChart(charts[ch]);

  if (rows.length > 0) {
    var scoreRange = dst.getRange(1, 3, rows.length + 1, 1); // include header so Sheets names the series
    var chart = dst.newChart()
      .setChartType(Charts.ChartType.HISTOGRAM)
      .addRange(scoreRange)
      .setOption('title', 'Similarity Score Distribution')
      .setOption('hAxis.title', 'Similarity Score')
      .setOption('hAxis.direction', -1)
      .setOption('vAxis.title', 'Number of respondents')
      .setOption('legend.position', 'none')
      .setPosition(2, 5, 0, 0)
      .build();
    dst.insertChart(chart);
  }

  SpreadsheetApp.getUi().alert(
    'Done! ' + rows.length + ' respondents ranked by similarity.'
  );
}

// ── Menu ─────────────────────────────────────────────────────────────────────

/** Add a menu item to run the script easily. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tier List')
    .addItem('Aggregate Results', 'aggregateResults')
    .addItem('Build Similarity Report', 'buildSimilaritySheet')
    .addToUi();
}
