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

function aggregateResults() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var src = ss.getSheets()[0];
  var data = src.getDataRange().getValues();

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert('No responses found.');
    return;
  }

  var headers = data[0];

  // Extract character names from headers like "Tier List [Albedo]"
  var charCols = []; // { col: number, name: string }
  for (var c = 2; c < headers.length; c++) {
    var match = String(headers[c]).match(/\[(.+)\]/);
    if (match) {
      charCols.push({ col: c, name: match[1] });
    }
  }

  // Deduplicate by email — keep only the latest response
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

  // Aggregate points per character
  var totals = {};      // character -> total points
  var tierCounts = {};  // character -> { S:0, A:0, B:0, C:0, D:0 }
  var TIERS = ['S', 'A', 'B', 'C', 'D'];
  for (var i = 0; i < charCols.length; i++) {
    totals[charCols[i].name] = 0;
    tierCounts[charCols[i].name] = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  }

  var respondentCount = 0;
  var emails = Object.keys(latestByEmail);
  for (var e = 0; e < emails.length; e++) {
    var resp = latestByEmail[emails[e]].row;
    respondentCount++;
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

/** Add a menu item to run the script easily. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tier List')
    .addItem('Aggregate Results', 'aggregateResults')
    .addToUi();
}
