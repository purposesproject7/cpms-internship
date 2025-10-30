// scripts/createPanels.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import connectDB from "./db.js";
import Faculty from "../models/facultySchema.js";
import Panel from "../models/panelSchema.js";

dotenv.config();

console.log("Mongo URI from env:", process.env.MONGOOSE_CONNECTION_STRING);

// Put rawPanels like:
// [
//   [["50392", "Dr. Syed Ibrahim S P"], ["52343", "Dr. Dinakaran M"]],
//   [["50007", "Dr. Sivagami M"], ["52344", "Dr. Pandiyaraju V"]],
//   ...
// ]
// Location will be force-set to "At the Faculty Cabin" for all.
const rawPanels = [
  [["50007", "Dr. Sivagami M"], ["54173", "Dr. Elakya R"]],
  [["50063", "Dr. Sajidha S A"], ["54173", "Dr. Iniya Nehru"]],
  [["50138", "Dr. Vergin Raja Sarobin M"], ["53887", "Dr. Sheela Lavanya J M"]],
  [["50160", "Dr. Maheswari N"], ["53694", "Dr. Prethija G"]],
  [["50177", "Dr. Thomas Abraham J V"], ["53693", "Dr. Logeshwari V"]],
  [["50183", "Dr. Ilakiyaselvan N"], ["53692", "Dr. Hemila Rexline D"]],
  [["50201", "Dr. Umitty Srinivasa Rao"], ["53691", "Dr. Jeyavim Sherin R C"]],
  [["50239", "Dr. Khadar Nawas K"], ["53690", "Dr. Sarah Prithvika P C"]],
  [["50250", "Maheswari S"], ["53647", "Kshma Trivedi"]],
  [["50276", "B V A N S S S Prabhakar Rao"], ["53645", "Siva Priya M S"]],
  [["50299", "Bharathi Raja S"], ["53642", "Sarita Kumari"]],
  [["50303", "Malathi G"], ["53633", "Ranjith Kumar M"]],
  [["50392", "Syed Ibrahim S P"], ["53627", "Parvathy A K"]],
  [["53161", "Prem Sankar N"], ["53626", "Jai Vinita L"]],
  [["50430", "R. Prabhakaran"], ["53624", "Hemalatha K"]],
  [["50432", "Shola Usha Rani"], ["53619", "Manikandan P"]],
  [["50577", "Renta Chintala Bhargavi"], ["53618", "Sakthivel R"]],
  [["50616", "Janaki Meena M"], ["53567", "Shree Prakash"]],
  [["50879", "Rajalakshmi R"], ["53560", "Jeyamani D"]],
  [["50926", "Jayanthi R"], ["53398", "Santhi V"]],
  [["51142", "Jani Anbarasi L"], ["53396", "Balaji V"]],
  [["51325", "M. Prasad"], ["53395", "Berin Shalu S"]],
  [["51327", "M. Braveen"], ["53392", "Johnsi R"]],
];

async function createPanelsBatch() {
  try {
    await connectDB();

    const VENUE = "At the Faculty Cabin";

    // Collect all unique employeeIds to minimize DB queries
    const allIds = new Set();
    for (const pair of rawPanels) {
      const [[id1], [id2]] = pair;
      allIds.add(String(id1));
      allIds.add(String(id2));
    }

    // Fetch all faculties in one query map by employeeId
    const faculties = await Faculty.find({
      employeeId: { $in: Array.from(allIds) },
    }).select("_id employeeId");
    const facultyByEmpId = new Map(
      faculties.map((f) => [String(f.employeeId), f._id])
    );

    const docsToInsert = [];
    const skipped = [];

    for (const panel of rawPanels) {
      const [[empId1, name1], [empId2, name2]] = panel;

      const f1Id = facultyByEmpId.get(String(empId1));
      const f2Id = facultyByEmpId.get(String(empId2));

      if (!f1Id || !f2Id) {
        skipped.push({
          reason: "Faculty not found",
          missing: [
            !f1Id ? { employeeId: String(empId1), name: name1 } : null,
            !f2Id ? { employeeId: String(empId2), name: name2 } : null,
          ].filter(Boolean),
        });
        continue;
      }

      docsToInsert.push({
        members: [f1Id, f2Id],
        venue: VENUE,
        school: "SCOPE",
        department: "Internship",
      });
    }

    if (docsToInsert.length > 0) {
      // insertMany is efficient for batch inserts
      const result = await Panel.insertMany(docsToInsert, { ordered: false });
      console.log(`Inserted panels: ${result.length}`);
    } else {
      console.log("No valid panels to insert.");
    }

    if (skipped.length > 0) {
      console.warn("Skipped panels due to missing faculties:", skipped);
    }
  } catch (err) {
    console.error("Error creating panels:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from DB");
  }
}

createPanelsBatch();
