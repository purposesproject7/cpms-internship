import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';

// Input/Output files
const BRS_FILE = 'brs_internship.xlsx';
const PANEL_FILE = 'Panel_BRS_With_Email.xlsx';
const OUTPUT_FILE = 'brs_internship_with_emails.xlsx';

// Mapping keys per your instruction
const KEY_BRS = 'Student RegNo 1';     // in brs_internship.xlsx
const KEY_PANEL = 'REGISTER NUMBER';    // in Panel_BRS_With_Email.xlsx

// Column names
const PANEL_EMAIL_COL = 'Email ID';         // source
const TARGET_EMAIL_COL = 'Student Email 1'; // destination

function cleanText(v) {
  if (v === undefined || v === null) return '';
  // Normalize NBSPs and trim
  return String(v).replace(/\u00A0/g, ' ').trim();
}

function loadFirstSheetJSON(filename) {
  if (!fs.existsSync(filename)) {
    throw new Error(`File not found: ${filename}`);
  }
  const wb = XLSX.readFile(filename);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}

function saveJSONToExcel(filename, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  XLSX.writeFile(wb, filename);
}

function main() {
  console.log('🔧 Merging Email ID → Student Email 1 using REGISTER NUMBER ↔ Student RegNo 1');

  // Load data
  const brsRows = loadFirstSheetJSON(BRS_FILE);
  const panelRows = loadFirstSheetJSON(PANEL_FILE);

  if (!brsRows.length) throw new Error(`${BRS_FILE} has no rows`);
  if (!panelRows.length) throw new Error(`${PANEL_FILE} has no rows`);

  const brsHeaders = Object.keys(brsRows[0]);
  const panelHeaders = Object.keys(panelRows[0]);

  // Validate required columns
  for (const [file, headers, need] of [
    [BRS_FILE, brsHeaders, KEY_BRS],
    [PANEL_FILE, panelHeaders, KEY_PANEL],
    [PANEL_FILE, panelHeaders, PANEL_EMAIL_COL]
  ]) {
    if (!headers.includes(need)) {
      throw new Error(`Column '${need}' not found in ${file}. Headers: [${headers.join(', ')}]`);
    }
  }

  // Build lookup: REGISTER NUMBER -> Email ID
  const emailMap = new Map();
  for (const r of panelRows) {
    const reg = cleanText(r[KEY_PANEL]);
    const email = cleanText(r[PANEL_EMAIL_COL]);
    if (!reg || !email) continue;
    emailMap.set(reg, email); // last one wins on duplicates
  }

  // Ensure destination column exists
  if (!brsHeaders.includes(TARGET_EMAIL_COL)) {
    for (const r of brsRows) r[TARGET_EMAIL_COL] = '';
  }

  // Apply mapping
  let filled = 0;
  for (const r of brsRows) {
    const regNo = cleanText(r[KEY_BRS]);
    if (!regNo) continue;
    const email = emailMap.get(regNo);
    if (email) {
      r[TARGET_EMAIL_COL] = email;
      filled++;
    }
  }

  // Save full updated workbook
  saveJSONToExcel(OUTPUT_FILE, brsRows);

  console.log(`✓ Output written: ${path.resolve(OUTPUT_FILE)}`);
  console.log(`✓ Rows processed: ${brsRows.length}`);
  console.log(`✓ Emails filled: ${filled}`);
  console.log(`✓ Mapping: '${KEY_PANEL}' (panel) → '${KEY_BRS}' (brs), into '${TARGET_EMAIL_COL}'`);
}

try {
  main();
} catch (err) {
  console.error('❌ Error:', err.message);
  process.exit(1);
}
