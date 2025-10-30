  import mongoose from "mongoose";
  import Project from "../models/projectSchema.js";
  import Student from "../models/studentSchema.js"; // Ensure this path is correct
  import Faculty from "../models/facultySchema.js";
  // Import Panel model at the top of your file
  import Panel from "../models/panelSchema.js";
  import MarkingSchema from "../models/markingSchema.js";
  /**
   * Create a new project.
   * Expected req.body:
   * {
   *   name: "Project Name", // Unique identifier for the project
   *   students: [ { regNo, name, emailId, draftReview, review0, review1, review2, review3, pptApproved, attendance }, ... ],
   *   guideFacultyEmpId: "guide faculty employee id"
   * }
   */
  /**
   * Create a new project.
   * Expected req.body:
   * {
   *   name: "Project Name", // Unique identifier for the project
   *   students: [ { regNo, name, emailId, draftReview, review0, review1, review2, review3, review3, pptApproved, deadline }, ... ],
   *   guideFacultyEmpId: "guide faculty employee id"
   * }
   */

export async function createProject(req, res, next) {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      name,
      students: studentDetails,
      guideFacultyEmpId,
      specialization,
      type,
    } = req.body;

    if (!Array.isArray(studentDetails) || studentDetails.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message:
          "Student details are required and should be a non-empty array.",
      });
    }

    const { school, department } = studentDetails[0];

    if (!school || !department) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "School and department must be provided for the students.",
      });
    }

    if (!specialization) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Specialization must be provided.",
      });
    }

    if (!type || !["hardware", "software"].includes(type.toLowerCase())) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Project type must be either 'hardware' or 'software'.",
      });
    }

    const markingSchema = await MarkingSchema.findOne({
      school,
      department,
    }).session(session);
    
    if (!markingSchema) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Marking schema not found for school: ${school}, department: ${department}`,
      });
    }

    const guideFacultyDoc = await Faculty.findOne({
      employeeId: guideFacultyEmpId,
    }).session(session);
    
    if (!guideFacultyDoc) {
      await session.abortTransaction();
      throw new Error(
        `Guide faculty with employee id ${guideFacultyEmpId} not found`
      );
    }

    // ✅ Extract requiresContribution, contributionType, and internshipType from marking schema
    const schemaRequiresContribution = markingSchema.requiresContribution || false;
    const schemaContributionType = markingSchema.contributionType || 'none';
    const schemaInternshipType = markingSchema.internshipType || 'none'; // ✅ NEW

    console.log(`📝 Schema contribution settings: requiresContribution=${schemaRequiresContribution}, contributionType=${schemaContributionType}, internshipType=${schemaInternshipType}`);

    const reviewKeys = markingSchema.reviews.map((review) => review.reviewName);
    const defaultDeadlinesMap = new Map();
    
    markingSchema.reviews.forEach((review) => {
      if (review.deadline && review.deadline.from && review.deadline.to) {
        defaultDeadlinesMap.set(review.reviewName, {
          from: review.deadline.from,
          to: review.deadline.to,
        });
      } else {
        defaultDeadlinesMap.set(review.reviewName, null);
      }
    });

    const studentIds = await Promise.all(
      studentDetails.map(async (studentObj) => {
        const {
          regNo,
          name: studentName,
          emailId,
          reviews = {},
          pptApproved,
          deadline,
          school: studSchool,
          department: studDept,
          requiresContribution,
          contributionType,
          internshipType, // ✅ NEW: Allow override from request body
        } = studentObj;

        if (studSchool !== school || studDept !== department) {
          throw new Error(
            `Student ${regNo} has mismatched school or department. All students should belong to same school and department.`
          );
        }

        const existingStudent = await Student.findOne({ regNo }).session(
          session
        );
        
        if (existingStudent) {
          throw new Error(`Student already exists with regNo ${regNo}`);
        }

        const reviewsMap = new Map();
        
        for (const reviewKey of reviewKeys) {
          const reviewDef = markingSchema.reviews.find(
            (rev) => rev.reviewName === reviewKey
          );
          const inputReview = reviews?.[reviewKey] || {};
          let marks = {};

          if (reviewDef && Array.isArray(reviewDef.components)) {
            for (const comp of reviewDef.components) {
              marks[comp.name] = inputReview.marks?.[comp.name] || 0;
            }
          } else {
            marks = inputReview.marks || {};
          }

          reviewsMap.set(reviewKey, {
            marks,
            comments: inputReview.comments || "",
            attendance: inputReview.attendance || {
              value: false,
              locked: false,
            },
            locked: inputReview.locked || false,
          });
        }

        let studentDeadlineMap;
        if (
          deadline &&
          typeof deadline === "object" &&
          Object.keys(deadline).length > 0
        ) {
          studentDeadlineMap = new Map(Object.entries(deadline));
        } else {
          studentDeadlineMap = new Map(defaultDeadlinesMap);
        }

        // ✅ Use student-specific requiresContribution if provided, otherwise use schema default
        const studentRequiresContribution = 
          requiresContribution !== undefined 
            ? requiresContribution 
            : schemaRequiresContribution;

        // ✅ Use student-specific contributionType if provided, otherwise use schema default
        const studentContributionType = contributionType || schemaContributionType;

        // ✅ NEW: Use student-specific internshipType if provided, otherwise use schema default
        const studentInternshipType = internshipType || schemaInternshipType;

        // ✅ Validate contributionType
        const validContributionTypes = ['none', 'Patent Filed', 'Journal Publication', 'Book Chapter Contribution'];
        if (!validContributionTypes.includes(studentContributionType)) {
          throw new Error(
            `Invalid contribution type "${studentContributionType}" for student ${regNo}. Must be one of: ${validContributionTypes.join(', ')}`
          );
        }

        // ✅ NEW: Validate internshipType
        const validInternshipTypes = ['none', 'Cdc approved', 'Technology learnt', 'SRIP', 'Centre'];
        if (!validInternshipTypes.includes(studentInternshipType)) {
          throw new Error(
            `Invalid internship type "${studentInternshipType}" for student ${regNo}. Must be one of: ${validInternshipTypes.join(', ')}`
          );
        }

        // ✅ NEW: Validate internshipType based on department
        if (department !== 'internship' && studentInternshipType !== 'none') {
          throw new Error(
            `internshipType can only have values other than "none" when department is "internship". Student ${regNo} has department "${department}" with internshipType "${studentInternshipType}"`
          );
        }

        console.log(`👤 Creating student ${regNo}: requiresContribution=${studentRequiresContribution}, contributionType=${studentContributionType}, internshipType=${studentInternshipType}`);

        const student = new Student({
          regNo,
          name: studentName,
          emailId,
          reviews: reviewsMap,
          pptApproved: pptApproved || { approved: false, locked: false },
          deadline: studentDeadlineMap,
          school,
          department,
          PAT: false,
          requiresContribution: studentRequiresContribution,
          contributionType: studentContributionType,
          internshipType: studentInternshipType, // ✅ NEW: Added field
        });

        await student.save({ session });
        console.log(`✅ Student ${regNo} created successfully with contributionType: ${studentContributionType}, internshipType: ${studentInternshipType}`);
        return student._id;
      })
    );

    const newProject = new Project({
      name,
      students: studentIds,
      guideFaculty: guideFacultyDoc._id,
      panel: null,
      school,
      department,
      specialization,
      type: type.toLowerCase(),
    });

    await newProject.save({ session });
    await session.commitTransaction();

    console.log(`🎉 Project created successfully: ${newProject._id}`);

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        projectId: newProject._id,
        name: newProject.name,
        studentsCount: studentIds.length,
        requiresContribution: schemaRequiresContribution,
        contributionType: schemaContributionType,
        internshipType: schemaInternshipType, // ✅ NEW: Include in response
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ Error creating project:", error);

    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0];
      const duplicateValue = error.keyValue[duplicateField];
      return res.status(409).json({
        success: false,
        message: `Project with ${duplicateField} "${duplicateValue}" already exists. Please choose a different ${duplicateField}.`,
        errorType: "DUPLICATE_KEY",
        field: duplicateField,
        value: duplicateValue,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Validation error: " + error.message,
        errorType: "VALIDATION_ERROR",
      });
    }

    if (
      error.message.includes("Student already exists") ||
      error.message.includes("Guide faculty") ||
      error.message.includes("mismatched school") ||
      error.message.includes("Invalid contribution type") ||
      error.message.includes("Invalid internship type") || // ✅ NEW
      error.message.includes("internshipType can only have values") // ✅ NEW
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
        errorType: "BUSINESS_LOGIC_ERROR",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create project. Please try again.",
      errorType: "INTERNAL_ERROR",
      ...(process.env.NODE_ENV === "development" && { error: error.message }),
    });
  } finally {
    session.endSession();
  }
}

  export async function getAllProjects(req, res) {
    try {
      const { school, department } = req.query;

      // Build filter object for optional filtering
      const filter = {};
      if (school) filter.school = school;
      if (department) filter.department = department;

      // Fetch all projects with populated references
      const projects = await Project.find(filter)
        .populate({
          path: "students",
          model: "Student",
          select:
            "regNo name emailId reviews pptApproved deadline school department PAT", // <--- included pptApproved and PAT
        })
        .populate({
          path: "guideFaculty",
          model: "Faculty",
          select: "name emailId employeeId school department specialization",
        })
        .populate({
          path: "panel",
          model: "Panel",
          select: "school department",
          populate: {
            path: "members",
            model: "Faculty",
            select: "name emailId employeeId",
          },
        })
        .lean();

      console.log(`Found ${projects.length} projects`);

      // Process projects to convert Maps to Objects (if using Maps in Student schema)
      const processedProjects = projects.map((project) => {
        const processedStudents = project.students.map((student) => {
          // Convert MongoDB Map to plain object for reviews
          let processedReviews = {};
          if (student.reviews) {
            if (student.reviews instanceof Map) {
              processedReviews = Object.fromEntries(student.reviews);
            } else if (typeof student.reviews === "object") {
              processedReviews = { ...student.reviews };
            }
          }

          // Convert deadline Map to plain object
          let processedDeadlines = {};
          if (student.deadline) {
            if (student.deadline instanceof Map) {
              processedDeadlines = Object.fromEntries(student.deadline);
            } else if (typeof student.deadline === "object") {
              processedDeadlines = { ...student.deadline };
            }
          }

          return {
            _id: student._id,
            regNo: student.regNo,
            name: student.name,
            emailId: student.emailId,
            reviews: processedReviews,

            // Always return pptApproved object with fields and fallback
            pptApproved: {
              approved: student.pptApproved?.approved ?? false,
              locked: student.pptApproved?.locked ?? false,
              // Add any other pptApproved nested fields here if needed
            },

            deadline: processedDeadlines,
            school: student.school,
            department: student.department,
            PAT: student.PAT, // include PAT in returned student object
          };
        });

        return {
          _id: project._id,
          name: project.name,
          school: project.school,
          department: project.department,
          specialization: project.specialization,
          type: project.type,
          bestProject: !!project.bestProject,
          students: processedStudents,
          guideFaculty: project.guideFaculty,
          panel: project.panel,
        };
      });

      return res.status(200).json({
        success: true,
        data: processedProjects,
        message: "All projects retrieved successfully",
        count: processedProjects.length,
      });
    } catch (error) {
      console.error("Error in getAllProjects:", error);
      return res.status(500).json({
        success: false,
        message: "Error retrieving projects",
        error: error.message,
      });
    }
  }

export async function createProjectsBulk(req, res) {
  console.log("📦 [BULK CREATE] Starting bulk project creation at", new Date().toISOString());
  console.log("📦 [REQUEST BODY]", JSON.stringify(req.body, null, 2));

  const session = await mongoose.startSession();
  console.log("✅ [SESSION] MongoDB session created successfully");
  
  let transactionCommitted = false;
  const transactionStart = Date.now();

  try {
    session.startTransaction({
      maxTimeMS: 50000,
      readConcern: { level: "majority" },
      writeConcern: { w: "majority", j: true },
    });
    console.log("✅ [TRANSACTION] Transaction started with 50s timeout");

    const { school, department, projects, guideFacultyEmpId } = req.body;

    console.log("🔍 [VALIDATION] School:", school, "Department:", department, "Projects count:", projects?.length, "Guide:", guideFacultyEmpId);

    // ========== VALIDATION ==========
    if (!school || !department) {
      console.log("❌ [VALIDATION ERROR] Missing school or department");
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: "School and department are required.",
      });
    }

    if (!Array.isArray(projects) || projects.length === 0) {
      console.log("❌ [VALIDATION ERROR] Invalid projects array:", typeof projects, projects?.length);
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: "Projects array is required and must be non-empty.",
      });
    }

    if (!guideFacultyEmpId) {
      console.log("❌ [VALIDATION ERROR] Missing guide faculty employee ID");
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: "Guide faculty employee ID is required.",
      });
    }

    console.log("✅ [VALIDATION] All basic validations passed");

    // ========== FETCH MARKING SCHEMA ==========
    console.log("🔍 [DB QUERY] Searching for marking schema:", school, "-", department);
    const markingSchema = await MarkingSchema.findOne({ school, department }).session(session);

    if (!markingSchema) {
      console.log("❌ [DB ERROR] Marking schema not found for", school, "-", department);
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: `Marking schema not found for school: ${school}, department: ${department}`,
      });
    }

    console.log("✅ [DB SUCCESS] Marking schema found:", markingSchema._id);
    console.log("📋 [SCHEMA INFO] Reviews:", markingSchema.reviews?.map(r => r.reviewName));

    // ✅ Extract requiresContribution, contributionType, and internshipType from marking schema
    const schemaRequiresContribution = markingSchema.requiresContribution || false;
    const schemaContributionType = markingSchema.contributionType || 'none';
    const schemaInternshipType = markingSchema.internshipType || 'none'; // ✅ NEW

    console.log("📝 [SCHEMA INFO] requiresContribution:", schemaRequiresContribution);
    console.log("📝 [SCHEMA INFO] contributionType:", schemaContributionType);
    console.log("📝 [SCHEMA INFO] internshipType:", schemaInternshipType); // ✅ NEW

    // ========== FETCH GUIDE FACULTY ==========
    console.log("🔍 [DB QUERY] Searching for guide faculty:", guideFacultyEmpId);
    const guideFacultyDoc = await Faculty.findOne({ employeeId: guideFacultyEmpId }).session(session);

    if (!guideFacultyDoc) {
      console.log("❌ [DB ERROR] Guide faculty not found:", guideFacultyEmpId, "in school:", school);
      await session.abortTransaction();
      await session.endSession();
      return res.status(400).json({
        success: false,
        message: `Guide faculty with employee ID ${guideFacultyEmpId} not found in school ${school}`,
      });
    }

    console.log("✅ [DB SUCCESS] Guide faculty found:", guideFacultyDoc._id, guideFacultyDoc.name);

    // ========== PREPARE REVIEW STRUCTURE ==========
    const reviewKeys = markingSchema.reviews.map(review => review.reviewName);
    console.log("📋 [PROCESSING] Review keys:", reviewKeys);

    console.log("🔧 [FIXED] Using plain object for defaultDeadlinesObj instead of Map");
    const defaultDeadlinesObj = {};
    markingSchema.reviews.forEach(review => {
      const deadlineInfo = review.deadline && review.deadline.from && review.deadline.to
        ? { from: review.deadline.from, to: review.deadline.to }
        : null;
      defaultDeadlinesObj[review.reviewName] = deadlineInfo;
      console.log("📅 [DEADLINE]", review.reviewName, ":", deadlineInfo);
    });

    // ========== PROCESS PROJECTS ==========
    console.log("🔄 [PROCESSING] Starting project creation loop");
    const results = { created: 0, errors: 0, details: [] };
    const batchSize = 2;

    console.log("📦 [BATCH INFO] Processing", projects.length, "projects in batches of", batchSize);

    for (let batchStart = 0; batchStart < projects.length; batchStart += batchSize) {
      const batch = projects.slice(batchStart, batchStart + batchSize);
      const batchNumber = Math.floor(batchStart / batchSize) + 1;
      const totalBatches = Math.ceil(projects.length / batchSize);

      console.log(`\n📦 [BATCH ${batchNumber}/${totalBatches}] Processing projects ${batchStart + 1}-${Math.min(batchStart + batchSize, projects.length)}`);

      const elapsedTime = Date.now() - transactionStart;
      if (elapsedTime > 45000) {
        console.log("⚠️ [TIMEOUT WARNING] Transaction running for", elapsedTime, "ms, approaching timeout");
      }

      for (let i = 0; i < batch.length; i++) {
        const globalIndex = batchStart + i;
        const project = batch[i];

        console.log(`\n🎯 [PROJECT ${globalIndex + 1}/${projects.length}] Processing:`, project.name || "Unnamed");
        console.log("📄 [PROJECT DATA]", JSON.stringify(project, null, 2));

        try {
          // Validate project structure
          if (!project.name || !Array.isArray(project.students) || project.students.length === 0) {
            console.log("❌ [PROJECT ERROR] Invalid project data - name:", !!project.name, "students:", Array.isArray(project.students), "count:", project.students?.length);
            results.errors++;
            results.details.push({
              project: project.name || `Project ${globalIndex + 1}`,
              error: "Missing project name or students array",
            });
            continue;
          }

          // Validate project type
          console.log("🔍 [TYPE CHECK] Project type:", project.type, "Valid types: hardware, software");
          if (!project.type || !["hardware", "software"].includes(project.type.toLowerCase())) {
            console.log("❌ [TYPE ERROR] Invalid project type:", project.type);
            results.errors++;
            results.details.push({
              project: project.name || `Project ${globalIndex + 1}`,
              error: "Project type must be either 'hardware' or 'software'.",
            });
            continue;
          }

          // Check for duplicate projects
          console.log("🔍 [DUPLICATE CHECK] Searching for existing project:", project.name);
          const existingProject = await Project.findOne({
            name: project.name,
            school,
            department,
          }).session(session);

          if (existingProject) {
            console.log("❌ [DUPLICATE ERROR] Project already exists:", project.name);
            results.errors++;
            results.details.push({
              project: project.name,
              error: "Project with this name already exists",
            });
            continue;
          }

          console.log("✅ [PROJECT VALID] Project validation passed:", project.name);

          // ========== PROCESS STUDENTS ==========
          const studentIds = [];
          console.log("👥 [STUDENTS] Processing", project.students.length, "students");

          for (let j = 0; j < project.students.length; j++) {
            const studentObj = project.students[j];
            console.log(`\n👤 [STUDENT ${j + 1}] Processing:`, studentObj.regNo);

            const {
              regNo,
              name: studentName,
              emailId,
              school: studSchool,
              department: studDepartment,
              requiresContribution,
              contributionType, // ✅ Existing
              internshipType, // ✅ NEW: Allow override from request body
            } = studentObj;

            // Validate required fields
            if (!regNo || !studentName || !emailId) {
              console.log("❌ [STUDENT ERROR] Missing fields - regNo:", !!regNo, "name:", !!studentName, "email:", !!emailId);
              throw new Error(`Student missing required fields: regNo, name, emailId`);
            }

            // Validate school/department match
            if (studSchool !== school || studDepartment !== department) {
              console.log("❌ [STUDENT ERROR] School/dept mismatch - Expected:", school, department, "Got:", studSchool, studDepartment);
              throw new Error(`Student ${regNo} has mismatched school or department`);
            }

            // Check for duplicate students
            console.log("🔍 [STUDENT CHECK] Searching for existing student:", regNo);
            const existingStudent = await Student.findOne({ regNo }).session(session);

            if (existingStudent) {
              console.log("❌ [STUDENT ERROR] Student already exists:", regNo);
              throw new Error(`Student already exists with regNo ${regNo}`);
            }

            // ========== CREATE REVIEW STRUCTURE ==========
            console.log("🔧 [FIXED] Using plain object for reviewsObj instead of Map");
            console.log("📝 [REVIEWS] Creating reviews for", reviewKeys.length, "review types");

            const reviewsObj = {};
            for (const reviewKey of reviewKeys) {
              const reviewDef = markingSchema.reviews.find(rev => rev.reviewName === reviewKey);
              console.log("📝 [REVIEW] Processing", reviewKey, "components:", reviewDef?.components?.length || 0);

              const marks = {};
              if (reviewDef && Array.isArray(reviewDef.components)) {
                for (const comp of reviewDef.components) {
                  marks[comp.name] = 0;
                }
              }

              const reviewData = {
                marks,
                comments: "",
                attendance: { value: false, locked: false },
                locked: false,
              };

              reviewsObj[reviewKey] = reviewData;
              console.log("✅ [REVIEW SET]", reviewKey, ":", Object.keys(marks));
            }

            // ✅ Use student-specific requiresContribution if provided, otherwise use schema default
            const studentRequiresContribution = 
              requiresContribution !== undefined 
                ? requiresContribution 
                : schemaRequiresContribution;

            // ✅ Use student-specific contributionType if provided, otherwise use schema default
            const studentContributionType = contributionType || schemaContributionType;

            // ✅ NEW: Use student-specific internshipType if provided, otherwise use schema default
            const studentInternshipType = internshipType || schemaInternshipType;

            // ✅ Validate contributionType
            const validContributionTypes = ['none', 'Patent Filed', 'Journal Publication', 'Book Chapter Contribution'];
            if (!validContributionTypes.includes(studentContributionType)) {
              throw new Error(
                `Invalid contribution type "${studentContributionType}" for student ${regNo}. Must be one of: ${validContributionTypes.join(', ')}`
              );
            }

            // ✅ NEW: Validate internshipType
            const validInternshipTypes = ['none', 'Cdc approved', 'Technology learnt', 'SRIP', 'Centre'];
            if (!validInternshipTypes.includes(studentInternshipType)) {
              throw new Error(
                `Invalid internship type "${studentInternshipType}" for student ${regNo}. Must be one of: ${validInternshipTypes.join(', ')}`
              );
            }

            // ✅ NEW: Validate internshipType based on department
            if (department !== 'internship' && studentInternshipType !== 'none') {
              throw new Error(
                `internshipType can only have values other than "none" when department is "internship". Student ${regNo} has department "${department}" with internshipType "${studentInternshipType}"`
              );
            }

            console.log(`  📝 [CONTRIBUTION] Setting requiresContribution: ${studentRequiresContribution}, contributionType: ${studentContributionType}, internshipType: ${studentInternshipType}`);

            // ========== CREATE STUDENT DOCUMENT ==========
            console.log("✅ [STUDENT CREATE] Creating student document");
            console.log("🔧 [FIXED] Using plain objects for reviews and deadline");

            const student = new Student({
              regNo,
              name: studentName,
              emailId,
              reviews: reviewsObj,
              pptApproved: { approved: false, locked: false },
              deadline: { ...defaultDeadlinesObj },
              PAT: false,
              school,
              department,
              requiresContribution: studentRequiresContribution,
              contributionType: studentContributionType, // ✅ Existing
              internshipType: studentInternshipType, // ✅ NEW: Added field
            });

            console.log("💾 [STUDENT SAVE] Attempting to save student:", regNo);
            await student.save({ session });
            console.log(`✅ [STUDENT SUCCESS] Student saved: ${regNo} - ${student._id} with requiresContribution: ${studentRequiresContribution}, contributionType: ${studentContributionType}, internshipType: ${studentInternshipType}`);

            studentIds.push(student._id);
          }

          // ========== CREATE PROJECT DOCUMENT ==========
          console.log("🎯 [PROJECT CREATE] Creating project document with", studentIds.length, "students");
          const projectData = {
            name: project.name,
            students: studentIds,
            guideFaculty: guideFacultyDoc._id,
            panel: null,
            school,
            department,
            specialization: project.specialization || "",
            type: project.type.toLowerCase(),
          };

          console.log("📄 [PROJECT DATA]", JSON.stringify(projectData, null, 2));

          const newProject = new Project(projectData);
          console.log("💾 [PROJECT SAVE] Attempting to save project:", project.name);
          await newProject.save({ session });

          console.log(`✅ [PROJECT SUCCESS] Project saved: ${project.name} - ${newProject._id}`);
          results.created++;

        } catch (error) {
          console.log(`❌ [PROJECT FAILED] Error in project ${globalIndex + 1}:`, error.message);
          console.log("🔍 [FULL ERROR]", error);
          results.errors++;
          results.details.push({
            project: project.name || `Project ${globalIndex + 1}`,
            error: error.message,
          });
        }
      }

      // Pause between batches to avoid overloading
      if (batchStart + batchSize < projects.length) {
        console.log("⏸️ [BATCH PAUSE] Pausing 200ms between batches...");
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      const progress = ((batchStart + batchSize) / projects.length * 100).toFixed(1);
      console.log(`📊 [PROGRESS] ${progress}% completed (${Math.min(batchStart + batchSize, projects.length)}/${projects.length} projects)`);
    }

    // ========== COMMIT TRANSACTION ==========
    const transactionDuration = Date.now() - transactionStart;
    console.log("💾 [TRANSACTION] Attempting to commit transaction after", transactionDuration, "ms");
    console.log("📊 [RESULTS SUMMARY] Created:", results.created, "Errors:", results.errors);

    try {
      await session.commitTransaction();
      transactionCommitted = true;
      console.log("✅ [TRANSACTION SUCCESS] Transaction committed successfully in", transactionDuration, "ms");

      const response = {
        success: true,
        message: `Bulk project creation completed. ${results.created} created, ${results.errors} errors.`,
        data: results,
        timing: {
          duration: transactionDuration,
          projects: projects.length,
          averagePerProject: Math.round(transactionDuration / projects.length),
        },
        requiresContribution: schemaRequiresContribution,
        contributionType: schemaContributionType,
        internshipType: schemaInternshipType, // ✅ NEW: Include in response
      };

      console.log("🎉 [FINAL SUCCESS]", JSON.stringify(response, null, 2));
      await session.endSession();
      console.log("✅ [SESSION END] Session ended successfully");
      return res.status(201).json(response);

    } catch (commitError) {
      console.log("❌ [COMMIT ERROR] Transaction commit failed:", commitError.message);
      console.log("🔍 [COMMIT DETAILS]", commitError);
      transactionCommitted = false;
      throw commitError;
    }

  } catch (error) {
    const errorDuration = Date.now() - transactionStart;
    console.log("❌ [FATAL ERROR] Critical error in bulk project creation after", errorDuration, "ms:", error.message);
    console.log("🔍 [FULL ERROR STACK]", error.stack);

    // Abort transaction if not committed
    if (!transactionCommitted) {
      console.log("🔄 [CLEANUP] Attempting to abort transaction");
      try {
        if (session.inTransaction()) {
          await session.abortTransaction();
          console.log("✅ [ABORT SUCCESS] Transaction aborted");
        } else {
          console.log("ℹ️ [ABORT SKIP] No active transaction to abort - already aborted by MongoDB");
        }
      } catch (abortError) {
        console.log("❌ [ABORT ERROR]", abortError.message);
      }
    } else {
      console.log("ℹ️ [SKIP ABORT] Transaction already committed, skipping abort");
    }

    // End session
    try {
      await session.endSession();
      console.log("✅ [SESSION END] Session ended successfully");
    } catch (sessionError) {
      console.log("❌ [SESSION ERROR]", sessionError.message);
    }

    const errorResponse = {
      success: false,
      message: "Server error during bulk project creation",
      error: error.message,
      timing: {
        duration: errorDuration,
        failedAt: "transaction/processing",
      },
    };

    console.log("❌ [FINAL ERROR]", JSON.stringify(errorResponse, null, 2));
    return res.status(500).json(errorResponse);

  } finally {
    const totalDuration = Date.now() - transactionStart;
    console.log("🏁 [COMPLETE] Bulk project creation function completed at", new Date().toISOString());
    console.log("⏱️ [TIMING] Total execution time:", totalDuration, "ms");
  }
}

  export async function deleteProject(req, res) {
    try {
      const { projectId } = req.params;

      const deletedProject = await Project.findByIdAndDelete(projectId);

      if (!deletedProject) {
        return res.status(404).json({ message: "Project not found" });
      }

      return res.status(200).json({
        success: true,
        message: "Project deleted successfully",
      });
    } catch (error) {
      return res
        .status(500)
        .json({ message: "Error deleting project", error: error.message });
    }
  }

  /**
   * Get all projects where the logged-in faculty is the guide.
   * Relies on req.user.id (set by authMiddleware).
   */
  // This is for adding ppt approvoal for
  // This is for adding PPT approval for each review
export async function getAllGuideProjects(req, res) {
  try {
    const userId = req.user.id;
    console.log("getAllGuideProjects called for user:", userId);

    const projects = await Project.find({ guideFaculty: userId })
      .populate({
        path: "students",
        model: "Student",
        select: "regNo name emailId reviews pptApproved deadline school department PAT requiresContribution contributionType internshipType", // ✅ Added internshipType
      })
      .populate({
        path: "guideFaculty",
        model: "Faculty",
        select: "name emailId employeeId school department specialization",
      })
      .populate({
        path: "panel",
        model: "Panel",
        select: "school department",
        populate: {
          path: "members",
          model: "Faculty",
          select: "name emailId employeeId",
        },
      })
      .lean();

    console.log("Found guide projects:", projects.length);

    const processedProjects = projects.map((project) => {
      const processedStudents = project.students.map((student) => {
        let processedReviews = {};
        if (student.reviews) {
          if (student.reviews instanceof Map) {
            processedReviews = Object.fromEntries(student.reviews);
          } else if (typeof student.reviews === "object") {
            processedReviews = { ...student.reviews };
          }
        }

        // ✅ Process each review and preserve PPT approval data
        Object.keys(processedReviews).forEach(reviewKey => {
          const review = processedReviews[reviewKey];
          
          if (review && typeof review === 'object') {
            // ✅ Handle marks properly (convert Map to Object if needed)
            if (review.marks) {
              if (review.marks instanceof Map) {
                review.marks = Object.fromEntries(review.marks);
              } else if (typeof review.marks === 'object') {
                review.marks = { ...review.marks };
              }
            }
            
            // ✅ Preserve PPT approval structure in each review
            if (review.pptApproved) {
              review.pptApproved = {
                approved: Boolean(review.pptApproved.approved || false),
                locked: Boolean(review.pptApproved.locked || false)
              };
              console.log(`📽️ [Backend] PPT approval found in review ${reviewKey} for ${student.name}:`, review.pptApproved);
            }

            // ✅ Ensure other review properties are properly structured
            review.comments = review.comments || '';
            review.attendance = review.attendance || { value: false, locked: false };
            review.locked = Boolean(review.locked || false);
          }
        });

        let processedDeadlines = {};
        if (student.deadline) {
          if (student.deadline instanceof Map) {
            processedDeadlines = Object.fromEntries(student.deadline);
          } else if (typeof student.deadline === "object") {
            processedDeadlines = { ...student.deadline };
          }
        }

        // ✅ Log requiresContribution, contributionType, and internshipType for debugging
        console.log(`👤 Student ${student.name}: requiresContribution = ${student.requiresContribution}, contributionType = ${student.contributionType}, internshipType = ${student.internshipType}`);

        return {
          _id: student._id,
          regNo: student.regNo,
          name: student.name,
          emailId: student.emailId,
          reviews: processedReviews,
          pptApproved: student.pptApproved || {
            approved: false,
            locked: false,
          },
          deadline: processedDeadlines,
          school: student.school,
          department: student.department,
          PAT: student.PAT,
          requiresContribution: Boolean(student.requiresContribution || false),
          contributionType: student.contributionType || 'none',
          internshipType: student.internshipType || 'none', // ✅ NEW: Added internshipType
        };
      });

      return {
        ...project,
        bestProject: !!project.bestProject,
        students: processedStudents,
      };
    });

    console.log("✅ All projects processed with full population and PPT data");

    // ✅ Enhanced logging to verify PPT data, requiresContribution, contributionType, and internshipType
    processedProjects.forEach((project) => {
      console.log(`\n🔍 [Backend] Project: ${project.name}`);
      project.students.forEach((student) => {
        console.log(`  👤 Student: ${student.name} (requiresContribution: ${student.requiresContribution}, contributionType: ${student.contributionType}, internshipType: ${student.internshipType})`);
        Object.keys(student.reviews || {}).forEach(reviewKey => {
          const review = student.reviews[reviewKey];
          if (review.pptApproved) {
            console.log(`    📽️ Review ${reviewKey} PPT:`, review.pptApproved);
          } else {
            console.log(`    📝 Review ${reviewKey}: No PPT data`);
          }
        });
      });
    });

    // Unique school-department pairs for marking schema batch fetch
    const schoolDeptPairs = [
      ...new Set(processedProjects.map((p) => `${p.school}-${p.department}`)),
    ];
    console.log("Unique school-dept pairs:", schoolDeptPairs);

    // Batch fetch marking schemas for all unique school-department pairs
    const markingSchemas = {};
    await Promise.all(
      schoolDeptPairs.map(async (pair) => {
        const [school, department] = pair.split("-");
        try {
          const schema = await MarkingSchema.findOne({
            school,
            department,
          }).lean();
          if (schema) {
            markingSchemas[pair] = schema;
            console.log(
              `✅ Found schema for ${school}-${department} with ${
                schema.reviews?.length || 0
              } reviews (requiresContribution: ${schema.requiresContribution}, contributionType: ${schema.contributionType || 'none'}, internshipType: ${schema.internshipType || 'none'})`
            );
            
            // ✅ Enhanced logging for schema PPT requirements, contributionType, and internshipType
            if (schema.reviews) {
              schema.reviews.forEach(review => {
                console.log(`  📋 Schema Review ${review.reviewName}: PPT Required = ${!!review.pptApproved}`);
              });
            }
          } else {
            console.log(`⚠️ No schema found for ${school}-${department}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching schema for ${pair}:`, error);
        }
      })
    );

    // Attach marking schema to each project
    const projectsWithSchemas = processedProjects.map((project) => {
      const schemaKey = `${project.school}-${project.department}`;
      const projectSchema = markingSchemas[schemaKey];

      console.log(
        `Project ${project.name}: ${project.school}-${project.department} -> ${
          projectSchema ? "HAS SCHEMA" : "NO SCHEMA"
        }`
      );

      if (projectSchema) {
        console.log(
          `📋 Schema reviews for ${project.name}:`,
          projectSchema.reviews?.map((r) => `${r.reviewName} (PPT: ${!!r.pptApproved})`) || []
        );
        console.log(
          `📝 Contribution Type: ${projectSchema.contributionType || 'none'}, Internship Type: ${projectSchema.internshipType || 'none'}`
        );
      }

      return {
        ...project,
        bestProject: !!project.bestProject,
        markingSchema: projectSchema || null,
      };
    });

    console.log("✅ Final response prepared with schemas, full population, PPT data, requiresContribution, contributionType, and internshipType");

    // ✅ Enhanced final data structure logging
    projectsWithSchemas.forEach((project) => {
      console.log(`\n📊 Final Project: ${project.name}`);
      console.log(`👥 Students: ${project.students.length}`);
      project.students.forEach((student) => {
        const reviewsWithPPT = Object.keys(student.reviews || {}).filter(key => 
          student.reviews[key]?.pptApproved
        ).length;
        console.log(
          `  - ${student.name}: ${Object.keys(student.reviews || {}).length} reviews, ${reviewsWithPPT} with PPT data, requiresContribution: ${student.requiresContribution}, contributionType: ${student.contributionType}, internshipType: ${student.internshipType}`
        );
      });
      console.log(`📋 Schema: ${project.markingSchema ? "YES" : "NO"}`);
      if (project.markingSchema) {
        const schemaWithPPT = project.markingSchema.reviews?.filter(r => r.pptApproved).length || 0;
        console.log(
          `📋 Schema Reviews: ${project.markingSchema.reviews?.length || 0} total, ${schemaWithPPT} require PPT`
        );
        console.log(
          `📝 Schema requiresContribution: ${project.markingSchema.requiresContribution}, contributionType: ${project.markingSchema.contributionType || 'none'}, internshipType: ${project.markingSchema.internshipType || 'none'}`
        );
      }
    });

    return res.status(200).json({
      success: true,
      data: projectsWithSchemas,
      message: "Guide projects fetched successfully",
    });
  } catch (error) {
    console.error("❌ Error in getAllGuideProjects:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching guide projects",
      error: error.message,
    });
  }
}

export async function getAllPanelProjects(req, res) {
  try {
    const facultyId = req.user.id;
    console.log("getAllPanelProjects called for user:", facultyId);

    // Find panels where this faculty is a member
    const panels = await Panel.find({
      members: facultyId,
    });

    console.log("Found panels:", panels.length);

    if (panels.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: "No panels found for this faculty.",
      });
    }

    const panelIds = panels.map((panel) => panel._id);

    const panelProjects = await Project.find({
      panel: { $in: panelIds },
    })
      .populate({
        path: "students",
        model: "Student",
        select: "regNo name emailId reviews pptApproved deadline school department PAT requiresContribution contributionType internshipType", // ✅ Added internshipType
      })
      .populate({
        path: "guideFaculty",
        model: "Faculty",
        select: "name emailId employeeId school department specialization",
      })
      .populate({
        path: "panel",
        model: "Panel",
        select: "members venue school department",
        populate: {
          path: "members",
          model: "Faculty",
          select: "name emailId employeeId",
        },
      })
      .lean();

    console.log("Found panel projects:", panelProjects.length);

    // ✅ Process each project and students with PPT data, requiresContribution, contributionType, and internshipType
    const processedProjects = panelProjects.map((project) => {
      console.log(`🔄 Processing panel project: ${project.name}`);
      const processedStudents = project.students.map((student) => {
        console.log(`👤 Processing panel student: ${student.name} (${student.regNo})`);

        let processedReviews = {};
        if (student.reviews) {
          if (student.reviews instanceof Map) {
            processedReviews = Object.fromEntries(student.reviews);
          } else if (typeof student.reviews === "object") {
            processedReviews = { ...student.reviews };
          }
        }

        // ✅ Process each review and preserve PPT approval data
        Object.keys(processedReviews).forEach(reviewKey => {
          const review = processedReviews[reviewKey];
          
          if (review && typeof review === 'object') {
            // ✅ Handle marks properly
            if (review.marks) {
              if (review.marks instanceof Map) {
                review.marks = Object.fromEntries(review.marks);
              } else if (typeof review.marks === 'object') {
                review.marks = { ...review.marks };
              }
            }
            
            // ✅ Preserve PPT approval structure in each review
            if (review.pptApproved) {
              review.pptApproved = {
                approved: Boolean(review.pptApproved.approved || false),
                locked: Boolean(review.pptApproved.locked || false)
              };
              console.log(`📽️ [Panel Backend] PPT approval found in review ${reviewKey} for ${student.name}:`, review.pptApproved);
            }

            // ✅ Ensure other review properties are properly structured
            review.comments = review.comments || '';
            review.attendance = review.attendance || { value: false, locked: false };
            review.locked = Boolean(review.locked || false);
          }
        });

        let processedDeadlines = {};
        if (student.deadline) {
          if (student.deadline instanceof Map) {
            processedDeadlines = Object.fromEntries(student.deadline);
          } else if (typeof student.deadline === "object") {
            processedDeadlines = { ...student.deadline };
          }
        }

        console.log(`📊 Panel student ${student.name} reviews:`, Object.keys(processedReviews));
        console.log(`📅 Panel student ${student.name} deadlines:`, Object.keys(processedDeadlines));
        console.log(`📝 Panel student ${student.name} requiresContribution:`, student.requiresContribution);
        console.log(`📝 Panel student ${student.name} contributionType:`, student.contributionType);
        console.log(`📝 Panel student ${student.name} internshipType:`, student.internshipType); // ✅ NEW

        return {
          _id: student._id,
          regNo: student.regNo,
          name: student.name,
          emailId: student.emailId,
          reviews: processedReviews,
          pptApproved: student.pptApproved || {
            approved: false,
            locked: false,
          },
          deadline: processedDeadlines,
          school: student.school,
          department: student.department,
          PAT: student.PAT,
          requiresContribution: Boolean(student.requiresContribution || false),
          contributionType: student.contributionType || 'none',
          internshipType: student.internshipType || 'none', // ✅ NEW: Added internshipType
        };
      });

      return {
        ...project,
        students: processedStudents,
        bestProject: !!project.bestProject,
      };
    });

    console.log("✅ All panel projects processed with full population, PPT data, requiresContribution, contributionType, and internshipType");

    // ✅ Enhanced logging to verify PPT data, requiresContribution, contributionType, and internshipType processing
    processedProjects.forEach((project) => {
      console.log(`\n🔍 [Panel Backend] Project: ${project.name}`);
      project.students.forEach((student) => {
        console.log(`  👤 Student: ${student.name} (requiresContribution: ${student.requiresContribution}, contributionType: ${student.contributionType}, internshipType: ${student.internshipType})`);
        Object.keys(student.reviews || {}).forEach(reviewKey => {
          const review = student.reviews[reviewKey];
          if (review.pptApproved) {
            console.log(`    📽️ Review ${reviewKey} PPT:`, review.pptApproved);
          } else {
            console.log(`    📝 Review ${reviewKey}: No PPT data`);
          }
        });
      });
    });

    // Rest of your existing code for marking schemas...
    const schoolDeptPairs = [
      ...new Set(processedProjects.map((p) => `${p.school}-${p.department}`)),
    ];

    console.log("Unique school-dept pairs for panel projects:", schoolDeptPairs);

    // Batch fetch marking schemas
    const markingSchemas = {};
    await Promise.all(
      schoolDeptPairs.map(async (pair) => {
        const [school, department] = pair.split("-");
        try {
          const schema = await MarkingSchema.findOne({
            school,
            department,
          }).lean();
          if (schema) {
            markingSchemas[pair] = schema;
            console.log(
              `✅ Found panel schema for ${school}-${department} with ${
                schema.reviews?.length || 0
              } reviews (requiresContribution: ${schema.requiresContribution}, contributionType: ${schema.contributionType || 'none'}, internshipType: ${schema.internshipType || 'none'})`
            );
            
            // ✅ Enhanced logging for schema PPT requirements, contributionType, and internshipType
            if (schema.reviews) {
              schema.reviews.forEach(review => {
                console.log(`  📋 Panel Schema Review ${review.reviewName}: PPT Required = ${!!review.pptApproved}`);
              });
            }
          } else {
            console.log(`⚠️ No panel schema found for ${school}-${department}`);
          }
        } catch (error) {
          console.error(`❌ Error fetching panel schema for ${pair}:`, error);
        }
      })
    );

    // Attach marking schema to projects
    const projectsWithSchemas = processedProjects.map((project) => {
      const schemaKey = `${project.school}-${project.department}`;
      const projectSchema = markingSchemas[schemaKey];

      console.log(
        `Panel project ${project.name}: ${project.school}-${
          project.department
        } -> ${projectSchema ? "HAS SCHEMA" : "NO SCHEMA"}`
      );

      if (projectSchema) {
        console.log(
          `📋 Panel schema reviews for ${project.name}:`,
          projectSchema.reviews?.map((r) => `${r.reviewName} (PPT: ${!!r.pptApproved})`) || []
        );
        console.log(
          `📝 Contribution Type: ${projectSchema.contributionType || 'none'}, Internship Type: ${projectSchema.internshipType || 'none'}`
        );
      }

      return {
        ...project,
        markingSchema: projectSchema || null,
      };
    });

    console.log("✅ Final panel response prepared with schemas, full population, PPT data, requiresContribution, contributionType, and internshipType");

    // ✅ Enhanced final data structure logging
    projectsWithSchemas.forEach((project) => {
      console.log(`\n📊 Final Panel Project: ${project.name}`);
      console.log(`👥 Students: ${project.students.length}`);
      project.students.forEach((student) => {
        const reviewsWithPPT = Object.keys(student.reviews || {}).filter(key => 
          student.reviews[key]?.pptApproved
        ).length;
        console.log(
          `  - ${student.name}: ${Object.keys(student.reviews || {}).length} reviews, ${reviewsWithPPT} with PPT data, requiresContribution: ${student.requiresContribution}, contributionType: ${student.contributionType}, internshipType: ${student.internshipType}`
        );
      });
      console.log(`📋 Schema: ${project.markingSchema ? "YES" : "NO"}`);
      if (project.markingSchema) {
        const schemaWithPPT = project.markingSchema.reviews?.filter(r => r.pptApproved).length || 0;
        console.log(
          `📋 Panel Schema Reviews: ${project.markingSchema.reviews?.length || 0} total, ${schemaWithPPT} require PPT`
        );
        console.log(
          `📝 Panel Schema requiresContribution: ${project.markingSchema.requiresContribution}, contributionType: ${project.markingSchema.contributionType || 'none'}, internshipType: ${project.markingSchema.internshipType || 'none'}`
        );
      }
    });

    return res.status(200).json({
      success: true,
      data: projectsWithSchemas,
      message: "Panel projects fetched successfully",
    });
  } catch (error) {
    console.error("❌ Error in getAllPanelProjects:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching panel projects",
      error: error.message,
    });
  }
}

  /**
   * Update project details with review data
   */

  // const mongoose = require('mongoose');
  // const Project = require('../models/Project'); // Adjust path as needed
  // const Student = require('../models/Student'); // Adjust path as needed

export const updateProjectDetails = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const { projectId, projectUpdates, studentUpdates, pptApproved } = req.body;

    console.log("=== [BACKEND] UPDATE PROJECT STARTED ===");
    console.log("📋 [BACKEND] Project ID:", projectId);
    console.log(
      "📋 [BACKEND] Project Updates:",
      JSON.stringify(projectUpdates, null, 2)
    );
    console.log(
      "📋 [BACKEND] Student Updates:",
      JSON.stringify(studentUpdates, null, 2)
    );

    // Find the project with session
    const project = await Project.findById(projectId).session(session);
    if (!project) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    console.log("✅ [BACKEND] Project found:", project.name);

    // Update project fields (excluding immutable ones)
    if (projectUpdates && typeof projectUpdates === "object") {
      const immutableFields = ["_id", "students", "guideFaculty", "panel"];
      const updatableFields = [
        "name",
        "school",
        "department",
        "specialization",
        "type",
        "bestProject",
      ];

      for (const key of Object.keys(projectUpdates)) {
        if (!immutableFields.includes(key) && updatableFields.includes(key)) {
          project[key] = projectUpdates[key];
          console.log(`📋 [BACKEND] Updated ${key}:`, projectUpdates[key]);
        }
      }
      await project.save({ session });
      console.log("📋 [BACKEND] Project updated:", project.name);
    }

    // Process each student update sequentially (avoid parallel operations in transaction)
    for (const update of studentUpdates || []) {
      const {
        studentId,
        reviews: reviewsToUpdate,
        PAT, // Extract PAT status
        internshipType, // ✅ NEW: Extract internshipType from updates
      } = update;

      const student = await Student.findById(studentId).session(session);
      if (!student) {
        console.error("❌ [BACKEND] Student not found:", studentId);
        continue;
      }

      console.log("✅ [BACKEND] Processing student:", student.name);
      console.log("🚫 [BACKEND] PAT status for student:", PAT);

      // Merge updates into existing reviews Map
      for (const [reviewType, reviewData] of Object.entries(
        reviewsToUpdate || {}
      )) {
        if (!student.reviews) {
          student.reviews = new Map();
        }

        const newReviewData = {
          marks: new Map(Object.entries(reviewData.marks || {})),
          comments: reviewData.comments || "",
          attendance: reviewData.attendance || { value: false, locked: false },
          locked: reviewData.locked || false,
          // ✅ Store contribution if provided
          ...(reviewData.contribution !== undefined && {
            contribution: String(reviewData.contribution), // Ensure string type
          }),
        };

        // ✅ Store PPT approval if provided
        if ("pptApproved" in reviewData) {
          newReviewData.pptApproved = reviewData.pptApproved;
        }

        console.log(
          `📋 [BACKEND] Updating review ${reviewType} for ${student.name}:`,
          newReviewData
        );

        if (typeof student.reviews.set === "function") {
          student.reviews.set(reviewType, newReviewData);
        } else {
          student.reviews[reviewType] = newReviewData;
        }
      }

      // Update PAT status if provided
      if (PAT !== undefined) {
        student.PAT = Boolean(PAT); // Ensure boolean type
        console.log(
          `🚫 [BACKEND] Updated PAT status for ${student.name}:`,
          student.PAT
        );
      }

      // ✅ NEW: Update internshipType if provided
      if (internshipType !== undefined) {
        // Validate internshipType
        const validInternshipTypes = ['none', 'Cdc approved', 'Technology learnt', 'SRIP', 'Centre'];
        if (!validInternshipTypes.includes(internshipType)) {
          throw new Error(
            `Invalid internship type "${internshipType}" for student ${student.regNo}. Must be one of: ${validInternshipTypes.join(', ')}`
          );
        }

        // Validate based on department
        if (student.department !== 'internship' && internshipType !== 'none') {
          throw new Error(
            `internshipType can only have values other than "none" when department is "internship". Student ${student.regNo} has department "${student.department}"`
          );
        }

        student.internshipType = internshipType;
        console.log(
          `📝 [BACKEND] Updated internshipType for ${student.name}:`,
          student.internshipType
        );
      }

      await student.save({ session });
      console.log("✅ [BACKEND] Student saved:", student.name);
    }

    // Update project-level PPT approval if provided
    if (pptApproved !== undefined) {
      project.pptApproved = pptApproved;
      await project.save({ session });
      console.log(
        "📋 [BACKEND] Updated project-level PPT approval:",
        pptApproved
      );
    }

    await session.commitTransaction();
    console.log("✅ [BACKEND] All updates completed successfully");

    res.status(200).json({
      success: true,
      message: `Successfully updated project "${project.name}" and ${
        (studentUpdates || []).length
      } students`,
      projectId: project._id,
      updates: (studentUpdates || []).length,
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("❌ [BACKEND] Error updating project:", error);

    res.status(500).json({
      success: false,
      message: "Server error during project update",
      error: error.message,
    });
  } finally {
    session.endSession();
  }
};

  // Export other existing functions...

  export async function getProjectDetails(req, res) {
    try {
      const { projectId } = req.params;

      // Fetch project with fully populated nested documents
      const requiredProject = await Project.findOne({ _id: projectId })
        .populate({
          path: "students",
          model: "Student",
          select:
            "regNo name emailId reviews pptApproved deadline school department",
        })
        .populate({
          path: "guideFaculty",
          model: "Faculty",
          select: "name emailId employeeId school department specialization",
        })
        .populate({
          path: "panel",
          model: "Panel",
          populate: {
            path: "members",
            model: "Faculty",
            select: "name emailId employeeId",
          },
        });

      if (!requiredProject) {
        return res.status(404).send({
          message: "No project found with this ID.",
        });
      }

      // Process students: convert Maps for reviews and deadline to plain objects
      const processedStudents = requiredProject.students.map((student) => {
        let processedReviews = {};
        if (student.reviews) {
          if (student.reviews instanceof Map) {
            processedReviews = Object.fromEntries(student.reviews);
          } else if (typeof student.reviews === "object") {
            processedReviews = { ...student.reviews };
          }
        }

        let processedDeadlines = {};
        if (student.deadline) {
          if (student.deadline instanceof Map) {
            processedDeadlines = Object.fromEntries(student.deadline);
          } else if (typeof student.deadline === "object") {
            processedDeadlines = { ...student.deadline };
          }
        }

        return {
          _id: student._id,
          regNo: student.regNo,
          name: student.name,
          emailId: student.emailId,
          reviews: processedReviews,
          pptApproved: student.pptApproved || { approved: false, locked: false },
          deadline: processedDeadlines,
          school: student.school,
          department: student.department,
        };
      });

      // Construct the response including the 'type' attribute
      const projectData = {
        _id: requiredProject._id,
        name: requiredProject.name,
        school: requiredProject.school,
        department: requiredProject.department,
        specialization: requiredProject.specialization,
        type: requiredProject.type, // include type attribute
        students: processedStudents,
        guideFaculty: requiredProject.guideFaculty,
        panel: requiredProject.panel,
      };

      return res.status(200).send({ results: projectData });
    } catch (error) {
      console.error("Error fetching project details: ", error);
      return res.status(500).json({
        message: "Error fetching project details",
        error: error.message,
      });
    }
  }
