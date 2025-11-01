import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const INPUT_FILE = "MIA_proj.xlsx";
const OUTPUT_FILE = "MIA_with_emails.xlsx";

// Source and target columns
const REGNO_COL = "Student RegNo 1";     // exact header in your sheet
const EMAIL_COL = "Student Email 1";     // column to create/update

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/\u00A0/g, " ").trim();
}

function makeEmailFromRegno(regno) {
  const id = clean(regno).toLowerCase();   // small case only
  if (!id) return "";
  return `${id}@vit.ac.in`;
}

function loadFirstSheetJSON(file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${file}`);
  const wb = XLSX.readFile(file);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function saveJSONToExcel(file, rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, file);
}

function main() {
  console.log("🔧 Generating Student Email 1 from Student Regno 1 (lowercase + @vit.ac.in)");

  const rows = loadFirstSheetJSON(INPUT_FILE);
  if (!rows.length) throw new Error("Input sheet has no rows");

  const headers = Object.keys(rows[0]);
  if (!headers.includes(REGNO_COL)) {
    throw new Error(
      `Column "${REGNO_COL}" not found. Headers: [${headers.join(", ")}]`
    );
  }

  const updated = rows.map((r) => {
    const email = makeEmailFromRegno(r[REGNO_COL]);
    return {
      ...r,
      [EMAIL_COL]: email,
    };
  });

  saveJSONToExcel(OUTPUT_FILE, updated);

  console.log(`✓ Output written: ${path.resolve(OUTPUT_FILE)}`);
  console.log(`✓ Rows: ${updated.length}`);
  console.log(`✓ Column added/updated: "${EMAIL_COL}"`);
}

try {
  main();
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
