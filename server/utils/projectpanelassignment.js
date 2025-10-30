import xlsx from "xlsx";
import axios from "axios";
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import connectDB from "./db.js";
import Panel from "../models/panelSchema.js";
import Project from "../models/projectSchema.js";
import Faculty from "../models/facultySchema.js";

dotenv.config();

const EXCEL_PATH =
  "/home/administrator/Production/excel-files/Upload/Internship_bps_brs.xlsx";
const API_BASE_URL =
  process.env.API_BASE_URL || "http://localhost:5000/api/admin";
const AUTH_TOKEN =
"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4Zjg5N2JlMjJiN2QwODQ3NDRmNjU0OCIsImVtYWlsSWQiOiJhZG1pbkB2aXQuYWMuaW4iLCJlbXBsb3llZUlkIjoiQURNSU4wMDEiLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3NjE4NDg3MDAsImV4cCI6MTc2MTkzNTEwMH0.MQm4PNtsyf5RSO7hGXOD2ZZ0AcZOvuw5r4zn0OiTNKI"
async function main() {
  await connectDB();

  // Check if Excel file exists before reading
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("Excel file does not exist at path:", EXCEL_PATH);
    process.exit(1);
  }

  const workbook = xlsx.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet);

  for (const row of data) {
    const projectTitle =
      row["Project"] || row["project"] || row[Object.keys(row)[0]];
    const panelString =
      row["Panel"] ||
      row["panel"] ||
      row["PANEL MEMBERS"] ||
      row[Object.keys(row)[1]];

    if (!projectTitle || !panelString) {
      console.error("Missing project/panel:", row);
      continue;
    }

    const panelEmpIds =
      typeof panelString === "string" ? panelString.match(/\b\d{5}\b/g) : [];
    if (!panelEmpIds || panelEmpIds.length < 2) {
      console.error(
        "Could not extract panel employee IDs for project:",
        projectTitle,
        "| Panel string:",
        panelString
      );
      continue;
    }

    // Detailed faculty lookup
    const panelMemberDocs = await Faculty.find({
      employeeId: { $in: panelEmpIds.map(String) },
    });

    if (panelMemberDocs.length < panelEmpIds.length) {
      console.error(
        "Could not resolve all ObjectIds for employee IDs:",
        panelEmpIds,
        "| Got:",
        panelMemberDocs.map((f) => f.employeeId)
      );
      continue;
    }
    const panelMemberObjectIds = panelMemberDocs.map((f) => f._id);

    // Panel lookup
    const panel = await Panel.findOne({
      members: {
        $all: panelMemberObjectIds,
        $size: panelMemberObjectIds.length,
      },
    });
    if (!panel) {
      console.error(
        "Panel not found for employee IDs:",
        panelEmpIds,
        "| Faculty ObjectIds:",
        panelMemberObjectIds,
        "| Project:",
        projectTitle
      );
      continue;
    }

    // Project lookup
    const project = await Project.findOne({
      name: projectTitle,
    });
    if (!project) {
      console.error(
        "Project not found in DB for:",
        projectTitle,
        "| Row data:",
        row
      );
      try {
        const res = await axios.get(`${API_BASE_URL}/projectByName`, {
          params: { name: projectTitle },
          headers: { Authorization: `Bearer ${AUTH_TOKEN}` },
        });
        console.error("Backend response for missing project:", res.data);
      } catch (err) {
        console.error(
          "Backend error (project lookup):",
          err.response?.data || err.message
        );
      }
      continue;
    }

    try {
      await axios.post(
        `${API_BASE_URL}/assignPanel`,
        { panelId: panel._id, projectId: project._id },
        { headers: { Authorization: `Bearer ${AUTH_TOKEN}` } }
      );
      console.log(`Project with name "${projectTitle}" assigned`);
    } catch (error) {
      console.error(
        `Failed to assign panel to project "${projectTitle}":`,
        error.response?.data || error.message
      );
    }
  }

  await mongoose.disconnect();
}

main();
