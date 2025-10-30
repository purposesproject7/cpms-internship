import fs from "fs";
import path from "path";
import XLSX from "xlsx";

// Configure these for your sheet
const INPUT_FILE = "Internship_bps_brs.xlsx";     // put your file here
const OUTPUT_FILE = "Internship_bps_brs_empid_name.xlsx";
const PANEL_COL = "Panel";                         // column to transform

const NBSP = /\u00A0/g;

function clean(txt) {
  return String(txt ?? "")
    .replace(NBSP, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Split a panel string into two members using common separators
function splitMembers(s) {
  const t = clean(s);
  // Try " and " first (as in your examples)
  let parts = t.split(/\s+and\s+/i);
  if (parts.length === 2) return parts;

  // Then "&"
  parts = t.split(/\s*&\s*/);
  if (parts.length === 2) return parts;

  // Fallback comma
  parts = t.split(/\s*,\s*/);
  if (parts.length === 2) return parts;

  // Nothing cleanly splits; return single
  return [t];
}

// From "Dr. Name X (50123)" -> { id: "50123", name: "Dr. Name X" }
// If parentheses missing, tries best-effort: find trailing (or leading) digits.
function parseMember(member) {
  const t = clean(member);

  // Preferred: digits inside parentheses
  const mParen = t.match(/\((\d{3,})\)/);
  if (mParen) {
    const id = mParen[1];
    // Remove the "(digits)" part to get name
    const name = clean(t.replace(/\(\d{3,}\)/, ""));
    return { id, name };
  }

  // Fallback: detect trailing digits
  const mTrail = t.match(/(.*?)(\d{3,})$/);
  if (mTrail) {
    const name = clean(mTrail[1]);
    const id = mTrail[2];
    return { id, name };
  }

  // Fallback 2: detect leading digits
  const mLead = t.match(/^(\d{3,})(.*)$/);
  if (mLead) {
    const id = mLead[1];
    const name = clean(mLead[2]);
    return { id, name };
  }

  // No digits; return as name only
  return { id: "", name: t };
}

// Convert full cell to "id1 name1 & id2 name2"
function formatPanelCell(cell) {
  const raw = clean(cell);
  if (!raw) return "";

  const parts = splitMembers(raw);

  if (parts.length === 1) {
    const a = parseMember(parts[0]);
    const left = clean(`${a.id} ${a.name}`.trim());
    return left;
  }

  const a = parseMember(parts[0]);
  const b = parseMember(parts[1]);

  const left = clean(`${a.id} ${a.name}`.trim());
  const right = clean(`${b.id} ${b.name}`.trim());

  if (left && right) return `${left} & ${right}`;
  return left || right || "";
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
  console.log(`🔧 Formatting "${PANEL_COL}" → "empid1 name1 & empid2 name2"`);
  const rows = loadFirstSheetJSON(INPUT_FILE);
  if (!rows.length) throw new Error("Input sheet has no rows");
  const headers = Object.keys(rows[0]);
  if (!headers.includes(PANEL_COL)) {
    throw new Error(`Column "${PANEL_COL}" not found. Headers: [${headers.join(", ")}]`);
  }

  let updated = 0;
  const out = rows.map((r) => {
    const oldVal = r[PANEL_COL];
    const newVal = formatPanelCell(oldVal);
    if (clean(oldVal) !== clean(newVal)) updated++;
    return { ...r, [PANEL_COL]: newVal };
  });

  saveJSONToExcel(OUTPUT_FILE, out);
  console.log(`✓ Output: ${path.resolve(OUTPUT_FILE)}`);
  console.log(`✓ Rows: ${out.length}`);
  console.log(`✓ Panels updated: ${updated}`);
}

try {
  main();
} catch (err) {
  console.error("❌ Error:", err.message);
  process.exit(1);
}
