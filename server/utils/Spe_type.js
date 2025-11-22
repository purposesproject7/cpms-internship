// classify_projects.js
// Usage: node classify_projects.js [optional_excel_path]
// Requires: npm install xlsx
import XLSX from "xlsx";
import path from "node:path";
import fs from "node:fs";

/**
 * 1) Load workbook
 */
const inputPath = process.argv[2] || "D:/BTECH_CSEcore/Projects/pj2/MIA_with_emails.xlsx";
if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}
const wb = XLSX.readFile(inputPath); // reads .xlsx into workbook [web:27]
const sheetName = wb.SheetNames[0];
const ws = wb.Sheets[sheetName];

/**
 * 2) Convert sheet to JSON rows to inspect headers and rows
 */
const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }); // preserves empty cells [web:50]

/**
 * 3) Helper: normalization
 */
const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * 4) Classifier rules
 *    - Returns { specialization: <lowercase option>, type: "Software"|"Hardware" }
 *    - Adjust keywords as needed
 */
function classify(projectNameRaw) {
  const t = norm(projectNameRaw);

  // Hardware leaning keywords (iot devices, sensors, rovers, embedded, biometric machines)
  const hardwareHints = [
    "iot", "sensor", "sensors", "device", "embedded", "arduino", "raspberry",
    "biometric", "garage door", "rover", "helmet", "slipper", "patrol", "drone",
    "lidar", "camera fusion", "seat adjustment", "assistive system",
    "air pollution monitoring", "industrial rover", "medication dispensing",
    "wearables", "under water", "acoustic", "anti-bedsores", "crowd safety",
    "forest", "garage", "night patrol", "vehicleguard", "scan cart",
  ];
  const isHardware = hardwareHints.some((k) => t.includes(k));

  // Specialization buckets (ordered to avoid overlaps)
  if (t.includes("vlsi")) return { specialization: "vlsi", type: isHardware ? "Hardware" : "Software" };
  if (t.includes("blockchain")) return { specialization: "blockchain", type: "Software" };
  if (t.includes("cloud")) return { specialization: "cloud computing", type: "Software" };
  if (t.includes("devops")) return { specialization: "devops", type: "Software" };
  if (/(database|dbms|sql|database management)/.test(t)) return { specialization: "database management", type: "Software" };
  if (/(web app|webapp|web application|web portal|react|next\.js|website|web development|auction|ordering|payments|food outlet|mess scheduling|retail navigation|e-commerce|chatting app)/.test(t))
    return { specialization: "web development", type: "Software" };
  if (/(android|ios|mobile app|mobile application|augmented reality|ar )/.test(t))
    return { specialization: "mobile development", type: "Software" };
  if (/(key exchange|homomorphic|watermark|ransomware|malware|fraud detection|cyber|encryption|authentication|secure file|intrusion detection|scam link)/.test(t))
    return { specialization: "cyber security", type: isHardware ? "Hardware" : "Software" };
  if (/(data science|stock forecasting|time series|price tracker|pricepulse|coastal erosion risk|analysis)/.test(t))
    return { specialization: "data science", type: "Software" };
  if (/(ai|ml|machine learning|deep learning|transformer|cnn|vision transformer|vit|gan|pose estimation|x-ray|mri|chatbot|rag|nlp|speech|image recognition|weed segmentation|recommendation|emotion|gpt|assistant|autonomous|classification|detection|segmentation|predict|forecast)/.test(t))
    return { specialization: "ai/ml", type: isHardware ? "Hardware" : "Software" };

  // IoT bucket (if still hardware-like or explicit iot wording)
  if (/iot|internet of things/.test(t) || isHardware)
    return { specialization: "iot", type: "Hardware" };

  // Software engineering generic tools, interpreters, platforms
  if (/(interpreter|platform|framework|prototyping|linux subsystem|software engineering)/.test(t))
    return { specialization: "software engineering", type: "Software" };

  // Fallbacks
  return { specialization: "general", type: "Software" };
}

/**
 * 5) Detect column headers and update/create Specialization + Type
 */
if (rows.length === 0) {
  console.error("The worksheet is empty.");
  process.exit(1);
}

// Rebuild via header-aware process to keep other columns
const header = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
// Find or create column indices
const colProject = header.findIndex((h) => norm(h) === "project name");
let colSpec = header.findIndex((h) => norm(h) === "specialization");
let colType = header.findIndex((h) => norm(h) === "type");

const newHeader = [...header];
if (colSpec === -1) {
  newHeader.push("Specialization");
  colSpec = newHeader.length - 1;
}
if (colType === -1) {
  newHeader.push("Type");
  colType = newHeader.length - 1;
}

// Convert entire sheet to AoA, modify rows, then write back [web:50]
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

// Ensure header is updated
aoa[0] = newHeader;

// Process data rows
for (let r = 1; r < aoa.length; r++) {
  const row = aoa[r] || [];
  const pname = colProject >= 0 ? row[colProject] : "";
  if (!pname || String(pname).trim() === "") continue;

  const { specialization, type } = classify(pname);

  row[colSpec] = specialization; // lowercase per requirement
  row[colType] = type;           // "Software" or "Hardware"
  aoa[r] = row;
}

/**
 * 6) Write back to same worksheet and save the workbook
 */
const newWs = XLSX.utils.aoa_to_sheet(aoa); // create sheet from AoA [web:27]
wb.Sheets[sheetName] = newWs;
XLSX.writeFile(wb, inputPath); // overwrite original file [web:27]

console.log(`Updated ${path.basename(inputPath)} with Specialization and Type columns.`);
