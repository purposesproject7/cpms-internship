import mongoose from "mongoose";
import Faculty from "../models/facultySchema.js";
import bcrypt from "bcryptjs";
import Student from "../models/studentSchema.js";
import Request from "../models/requestSchema.js";
import Project from "../models/projectSchema.js";
import Panel from "../models/panelSchema.js";
import MarkingSchema from "../models/markingSchema.js";
import BroadcastMessage from "../models/broadcastMessageSchema.js";

export async function createOrUpdateMarkingSchema(req, res) {
  const { school, department, reviews, requiresContribution, contributionType, internshipType } = req.body;

  console.log("📝 Received marking schema request:", {
    school,
    department,
    reviewCount: reviews?.length,
    requiresContribution,
    contributionType,
    internshipType,
    rawBody: JSON.stringify(req.body, null, 2),
  });

  if (
    !school ||
    !department ||
    !Array.isArray(reviews) ||
    reviews.length === 0
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid fields." });
  }

  if (requiresContribution !== undefined && typeof requiresContribution !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "requiresContribution must be a boolean value",
    });
  }

  // ✅ Validate contributionType
  if (contributionType !== undefined) {
    const validContributionTypes = ['none', 'Patent Filed', 'Journal Publication', 'Book Chapter Contribution'];
    if (!validContributionTypes.includes(contributionType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid contribution type. Must be one of: ${validContributionTypes.join(', ')}`,
      });
    }
  }

  // ✅ Validate internshipType
  if (internshipType !== undefined) {
    const validInternshipTypes = ['none', 'Cdc approved', 'Technology learnt', 'SRIP', 'Centre'];
    if (!validInternshipTypes.includes(internshipType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid internship type. Must be one of: ${validInternshipTypes.join(', ')}`,
      });
    }
  }

  const cleanedReviews = [];
  let totalWeightAcrossAllReviews = 0;

  for (const review of reviews) {
    console.log("🔍 Validating review:", review.reviewName);

    if (
      !review.reviewName ||
      !review.facultyType ||
      !["guide", "panel"].includes(review.facultyType)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Each review must have reviewName and facultyType (guide or panel)",
      });
    }

    if (!review.deadline || !review.deadline.from || !review.deadline.to) {
      return res.status(400).json({
        success: false,
        message: "Each review must have valid deadline with from and to dates",
      });
    }

    const fromDate = new Date(review.deadline.from);
    const toDate = new Date(review.deadline.to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: `Invalid date format in deadline for review: ${review.reviewName}`,
      });
    }

    if (fromDate >= toDate) {
      return res.status(400).json({
        success: false,
        message: `Deadline 'from' date must be before 'to' date for review: ${review.reviewName}`,
      });
    }

    let reviewTotalWeight = 0;
    if (review.components) {
      if (!Array.isArray(review.components)) {
        return res.status(400).json({
          success: false,
          message: "Components must be an array if provided",
        });
      }

      if (review.components.length === 0) {
        return res.status(400).json({
          success: false,
          message: `Review ${review.reviewName} has empty components array`,
        });
      }

      for (const comp of review.components) {
        if (!comp.name || typeof comp.weight !== "number") {
          return res.status(400).json({
            success: false,
            message: "Each component must have a name and numeric weight",
          });
        }

        if (comp.weight <= 0) {
          return res.status(400).json({
            success: false,
            message: `Component ${comp.name} must have a positive weight`,
          });
        }

        reviewTotalWeight += comp.weight;
      }
    }

    totalWeightAcrossAllReviews += reviewTotalWeight;
    console.log(`📊 Review ${review.reviewName} weight: ${reviewTotalWeight}`);

    const cleanedReview = {
      reviewName: review.reviewName,
      displayName: review.displayName || review.reviewName,
      facultyType: review.facultyType,
      components: review.components || [],
      deadline: {
        from: review.deadline.from,
        to: review.deadline.to,
      },
    };

    if (review.requiresContribution !== undefined) {
      console.warn(
        `⚠️ WARNING: Review ${review.reviewName} contains requiresContribution field. This should only be at schema level. Stripping it from review.`
      );
    }

    cleanedReviews.push(cleanedReview);
  }

  console.log(`📊 Total weight across all reviews: ${totalWeightAcrossAllReviews}`);
  if (Math.abs(totalWeightAcrossAllReviews - 100) > 0.01) {
    return res.status(400).json({
      success: false,
      message: `Total weight across all reviews must equal 100. Current total: ${totalWeightAcrossAllReviews}`,
    });
  }

  try {
    console.log("💾 Attempting to save/update marking schema for:", {
      school,
      department,
    });

    const existingSchema = await MarkingSchema.findOne({ school, department });

    if (existingSchema) {
      console.log("📝 Updating existing marking schema:", existingSchema._id);
    } else {
      console.log("🆕 Creating new marking schema");
    }

    const updateData = {
      school,
      department,
      reviews: cleanedReviews,
      requiresContribution: requiresContribution !== undefined ? requiresContribution : false,
      contributionType: contributionType || 'none',
      internshipType: internshipType || 'none',
    };

    console.log("💾 Final update data:", JSON.stringify(updateData, null, 2));

    const updated = await MarkingSchema.findOneAndUpdate(
      { school, department },
      updateData,
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    console.log("✅ Marking schema saved successfully with _id:", updated._id);
    console.log("📊 Schema details:", {
      reviewCount: updated.reviews.length,
      requiresContribution: updated.requiresContribution,
      contributionType: updated.contributionType,
      internshipType: updated.internshipType,
      totalWeight: totalWeightAcrossAllReviews,
      reviews: updated.reviews.map(r => ({
        name: r.reviewName,
        displayName: r.displayName,
        facultyType: r.facultyType,
        componentsCount: r.components?.length || 0,
        componentWeight: r.components?.reduce((sum, c) => sum + c.weight, 0) || 0,
      })),
    });

    res.status(200).json({
      success: true,
      message: existingSchema 
        ? "Marking schema updated successfully."
        : "Marking schema created successfully.",
      data: updated,
    });
  } catch (error) {
    console.error("❌ Error saving marking schema:", error);
    console.error("❌ Error stack:", error.stack);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A marking schema with this school and department already exists",
        error: error.message,
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: "Schema validation failed",
        error: error.message,
        details: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message,
        })),
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid data type for field: ${error.path}`,
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Server error while saving marking schema",
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

export async function getDefaultDeadline(req, res) {
  try {
    const { school, department } = req.query;

    if (!school || !department) {
      return res.status(400).json({
        success: false,
        message: "school and department query parameters are required.",
      });
    }

    console.log(`📥 Fetching marking schema for ${school} - ${department}`);

    const markingSchema = await MarkingSchema.findOne({ school, department });

    if (!markingSchema) {
      console.log(`❌ No marking schema found for ${school} - ${department}`);
      return res.status(404).json({
        success: false,
        message: "No marking schema found for this school and department.",
      });
    }

    console.log(`✅ Found marking schema for ${school} - ${department}`);
    console.log(`📊 requiresContribution: ${markingSchema.requiresContribution}`);
    console.log(`📊 contributionType: ${markingSchema.contributionType}`);
    console.log(`📊 internshipType: ${markingSchema.internshipType}`);

    res.status(200).json({
      success: true,
      data: {
        school: markingSchema.school,
        department: markingSchema.department,
        requiresContribution: markingSchema.requiresContribution || false,
        contributionType: markingSchema.contributionType || 'none',
        internshipType: markingSchema.internshipType || 'none',
        reviews: markingSchema.reviews.map((review) => ({
          reviewName: review.reviewName,
          displayName: review.displayName || review.reviewName,
          facultyType: review.facultyType || "guide",
          components: review.components || [],
          deadline: review.deadline || null,
        })),
      },
    });

    console.log(`📤 Returned ${markingSchema.reviews.length} reviews for ${school} - ${department}`);

  } catch (error) {
    console.error("❌ Error in getDefaultDeadline:", error);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  }
}

export async function createFaculty(req, res) {
  try {
    const {
      name,
      emailId,
      password,
      employeeId,
      school,
      department,
      specialization,
      imageUrl,
      role = "faculty",
      phoneNumber,
    } = req.body;

    if (!name || !emailId || !password || !employeeId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password, employee ID, and phone number are required",
      });
    }

    if (!emailId.endsWith("@vit.ac.in")) {
      return res.status(400).json({
        success: false,
        message: "Only college emails allowed!",
      });
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    if (!school || !Array.isArray(school) || school.length === 0) {
      return res.status(400).json({
        success: false,
        message: "School must be a non-empty array",
      });
    }

    if (!/^(\+91[- ]?)?[6-9]\d{9}$/.test(phoneNumber.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid Indian phone number",
      });
    }

    if (
      !specialization ||
      !Array.isArray(specialization) ||
      specialization.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Specialization must be a non-empty array",
      });
    }

    const existingFaculty = await Faculty.findOne({
      $or: [
        { emailId: emailId.trim().toLowerCase() },
        { employeeId: employeeId.trim().toUpperCase() },
        { phoneNumber: phoneNumber.trim() },
      ],
    });

    if (existingFaculty) {
      return res.status(400).json({
        success: false,
        message:
          "Faculty with this email, employee ID, or phone number already exists!",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newFaculty = new Faculty({
      imageUrl: imageUrl || "",
      name: name.trim(),
      emailId: emailId.trim().toLowerCase(),
      password: hashedPassword,
      employeeId: employeeId.trim().toUpperCase(),
      phoneNumber: phoneNumber.trim(),
      role: role,
      school: school.map((s) => s.trim()),
      department: department.map((d) => d.trim()),
      specialization: specialization.map((sp) => sp.trim()),
    });

    await newFaculty.save();

    return res.status(201).json({
      success: true,
      message: "Faculty created successfully!",
    });
  } catch (error) {
    console.error("Error creating faculty:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while creating faculty",
      error: error.message,
    });
  }
}

export async function createFacultyBulk(req, res) {
  try {
    const { facultyList } = req.body;
    if (!Array.isArray(facultyList) || facultyList.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Faculty list is required and must be a non-empty array",
      });
    }

    const results = {
      created: 0,
      errors: 0,
      details: [],
    };

    for (let i = 0; i < facultyList.length; i++) {
      const faculty = facultyList[i];
      try {
        if (
          !faculty.name ||
          !faculty.emailId ||
          !faculty.password ||
          !faculty.employeeId ||
          !faculty.phoneNumber ||
          !faculty.schools ||
          !faculty.specialization
        ) {
          results.errors++;
          results.details.push({
            row: i + 1,
            error:
              "Missing required fields including phoneNumber, schools, or specialization",
          });
          continue;
        }

        if (
          !Array.isArray(faculty.schools) ||
          faculty.schools.length === 0 ||
          !Array.isArray(faculty.specialization) ||
          faculty.specialization.length === 0
        ) {
          results.errors++;
          results.details.push({
            row: i + 1,
            error: "Schools and specialization must be non-empty arrays",
          });
          continue;
        }

        if (!faculty.emailId.endsWith("@vit.ac.in")) {
          results.errors++;
          results.details.push({
            row: i + 1,
            error: "Invalid email domain",
          });
          continue;
        }

        const phoneRegex = /^(\+91[- ]?)?[6-9]\d{9}$/;
        if (!phoneRegex.test(faculty.phoneNumber.trim())) {
          results.errors++;
          results.details.push({
            row: i + 1,
            error: "Invalid Indian phone number format",
          });
          continue;
        }

        const existingFaculty = await Faculty.findOne({
          $or: [
            { emailId: faculty.emailId.trim().toLowerCase() },
            { employeeId: faculty.employeeId.trim().toUpperCase() },
            { phoneNumber: faculty.phoneNumber.trim() },
          ],
        });

        if (existingFaculty) {
          results.errors++;
          results.details.push({
            row: i + 1,
            error:
              "Faculty with this email, employee ID, or phone number already exists",
          });
          continue;
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(faculty.password, salt);

        let departments = [];
        if (
          Array.isArray(faculty.departments) &&
          faculty.departments.length > 0
        ) {
          departments = faculty.departments.map((d) => d.trim());
        }

        const newFaculty = new Faculty({
          imageUrl: faculty.imageUrl || "",
          name: faculty.name.trim(),
          emailId: faculty.emailId.trim().toLowerCase(),
          password: hashedPassword,
          employeeId: faculty.employeeId.trim().toUpperCase(),
          phoneNumber: faculty.phoneNumber.trim(),
          role: faculty.role || "faculty",
          school: faculty.schools.map((s) => s.trim()),
          department: departments,
          specialization: faculty.specialization.map((sp) => sp.trim()),
        });

        await newFaculty.save();
        console.log(newFaculty);
        results.created++;
      } catch (error) {
        results.errors++;
        results.details.push({
          row: i + 1,
          error: error.message,
        });
      }
    }

    return res.status(201).json({
      success: true,
      message: `Bulk faculty creation completed. ${results.created} created, ${results.errors} errors.`,
      data: results,
    });
  } catch (error) {
    console.error("Error in bulk faculty creation:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during bulk creation",
      error: error.message,
    });
  }
}

export async function updateFaculty(req, res) {
  try {
    const { employeeId } = req.params;
    const {
      name,
      emailId,
      password,
      school,
      department,
      specialization,
      role,
      imageUrl,
      phoneNumber,
    } = req.body;

    const faculty = await Faculty.findOne({
      employeeId: employeeId.trim().toUpperCase(),
    });
    if (!faculty) {
      return res.status(404).json({
        success: false,
        message: "Faculty with the given employee ID not found.",
      });
    }

    if (emailId && !emailId.endsWith("@vit.ac.in")) {
      return res.status(400).json({
        success: false,
        message: "Only college emails allowed!",
      });
    }

    if (emailId && emailId !== faculty.emailId) {
      const emailExists = await Faculty.findOne({ emailId });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: "Another faculty with this email already exists.",
        });
      }
    }

    if (phoneNumber) {
      const phoneRegex = /^(\+91[- ]?)?[6-9]\d{9}$/;
      if (!phoneRegex.test(phoneNumber)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid Indian phone number.",
        });
      }
      if (phoneNumber !== faculty.phoneNumber) {
        const phoneExists = await Faculty.findOne({ phoneNumber });
        if (phoneExists) {
          return res.status(400).json({
            success: false,
            message: "Another faculty with this phone number already exists.",
          });
        }
      }
    }

    if (password) {
      if (
        password.length < 8 ||
        !/[A-Z]/.test(password) ||
        !/[a-z]/.test(password) ||
        !/[0-9]/.test(password) ||
        !/[^A-Za-z0-9]/.test(password)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
        });
      }
      const salt = await bcrypt.genSalt(10);
      faculty.password = await bcrypt.hash(password, salt);
    }

    if (name) faculty.name = name;
    if (emailId) faculty.emailId = emailId.trim().toLowerCase();
    if (phoneNumber) faculty.phoneNumber = phoneNumber;
    if (role && ["admin", "faculty"].includes(role)) faculty.role = role;
    if (Array.isArray(school) && school.length > 0) faculty.school = school;
    if (Array.isArray(department) && department.length > 0)
      faculty.department = department;
    if (Array.isArray(specialization) && specialization.length > 0)
      faculty.specialization = specialization;
    if (imageUrl !== undefined) faculty.imageUrl = imageUrl;

    await faculty.save();
    console.log(faculty);

    return res.status(200).json({
      success: true,
      message: "Faculty updated successfully!",
    });
  } catch (error) {
    console.error("Error updating faculty:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating faculty",
    });
  }
}

export async function getAllFaculty(req, res) {
  const { school, department, specialization, sortBy, sortOrder } = req.query;

  try {
    let query = {};

    if (school && school !== "all") query.school = school;
    if (department && department !== "all") query.department = department;
    if (specialization && specialization !== "all")
      query.specialization = specialization;

    const validSortFields = [
      "school",
      "department",
      "specialization",
      "name",
      "employeeId",
    ];

    let sortOption = {};
    if (sortBy && validSortFields.includes(sortBy)) {
      const order = sortOrder && sortOrder.toLowerCase() === "desc" ? -1 : 1;
      sortOption[sortBy] = order;
    } else {
      sortOption.name = 1;
    }

    const faculty = await Faculty.find(query)
      .sort(sortOption)
      .select("-password");

    res.status(200).json({
      success: true,
      data: faculty.map((f) => ({
        _id: f._id,
        imageUrl: f.imageUrl,
        name: f.name,
        employeeId: f.employeeId,
        emailId: f.emailId,
        phoneNumber: f.phoneNumber,
        role: f.role,
        school: f.school,
        department: f.department,
        specialization: f.specialization,
      })),
      count: faculty.length,
    });
  } catch (error) {
    console.error("Error in getAllFaculty:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getAllGuideWithProjects(req, res) {
  try {
    const { school, department } = req.query;

    const facultyQuery = { role: "faculty" };
    if (school) facultyQuery.school = school;
    if (department) facultyQuery.department = department;

    const faculties = await Faculty.find(facultyQuery);

    const result = await Promise.all(
      faculties.map(async (faculty) => {
        const projectQuery = { guideFaculty: faculty._id };
        if (school) projectQuery.school = school;
        if (department) projectQuery.department = department;

        const guidedProjects = await Project.find(projectQuery)
          .populate("students", "regNo name")
          .lean();

        return {
          faculty: {
            _id: faculty._id,
            employeeId: faculty.employeeId,
            name: faculty.name,
            emailId: faculty.emailId,
            school: faculty.school,
            department: faculty.department,
            phoneNumber: faculty.phoneNumber,
          },
          guidedProjects,
        };
      })
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getAllGuideWithProjects:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function getAllPanelsWithProjects(req, res) {
  try {
    const { school, department } = req.query;
    console.log("getAllPanelsWithProjects called with:", {
      school,
      department,
    });

    let panelQuery = {};
    if (school) {
      panelQuery.school = school;
    }
    if (department) {
      panelQuery.department = department;
    }

    console.log("Panel query:", panelQuery);

    const panels = await Panel.find(panelQuery)
      .populate("members", "employeeId name emailId school department")
      .lean();

    console.log("Found panels with direct filtering:", panels.length);

    const result = await Promise.all(
      panels.map(async (panel) => {
        const projectQuery = { panel: panel._id };

        console.log(`Searching projects for panel ${panel._id}`);

        const projects = await Project.find(projectQuery)
          .populate("students", "regNo name emailId school department")
          .populate("guideFaculty", "name emailId employeeId")
          .lean();

        console.log(`Found ${projects.length} projects for panel ${panel._id}`);

        return {
          panelId: panel._id,
          members: panel.members,
          venue: panel.venue,
          school: panel.school,
          department: panel.department,
          projects,
        };
      })
    );

    console.log(
      "Final result:",
      result.map((r) => ({
        panelId: r.panelId,
        projectCount: r.projects.length,
      }))
    );

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in getAllPanelsWithProjects:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function deleteFacultyByEmployeeId(req, res) {
  const { employeeId } = req.params;

  try {
    const deletedFaculty = await Faculty.findOneAndDelete({
      employeeId: employeeId.trim().toUpperCase(),
    });

    if (!deletedFaculty) {
      return res.status(404).json({
        success: false,
        message: `No faculty found with employee ID: ${employeeId}`,
      });
    }

    res.status(200).json({
      success: true,
      message: `Faculty with employee ID ${employeeId} has been deleted successfully.`,
      data: deletedFaculty,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error while deleting faculty",
      error: error.message,
    });
  }
}

export async function createAdmin(req, res) {
  try {
    const {
      name,
      emailId,
      password,
      employeeId,
      phoneNumber,
      school,
      department,
    } = req.body;

    if (!emailId.endsWith("@vit.ac.in")) {
      return res.status(400).json({
        success: false,
        message: "Only college emails allowed!",
      });
    }

    if (
      password.length < 8 ||
      !/[A-Z]/.test(password) ||
      !/[a-z]/.test(password) ||
      !/[0-9]/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      });
    }

    const existingFaculty = await Faculty.findOne({ emailId });
    if (existingFaculty) {
      return res.status(400).json({
        success: false,
        message: "Admin already registered!",
      });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newFaculty = new Faculty({
      name,
      emailId,
      password: hashedPassword,
      employeeId,
      phoneNumber,
      role: "admin",
      school: Array.isArray(school) ? school : [school],
      department: Array.isArray(department)
        ? department
        : department
        ? [department]
        : [],
      specialization: [],
    });

    await newFaculty.save();

    return res.status(201).json({
      success: true,
      message: "Admin created successfully!",
    });
  } catch (error) {
    console.error("Error creating admin:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create admin",
    });
  }
}

export async function setDefaultDeadline(req, res) {
  try {
    const { school, department, deadlines } = req.body;

    if (!school || !department) {
      return res.status(400).json({
        success: false,
        message: "school and department are required.",
      });
    }

    if (
      !Array.isArray(deadlines) ||
      deadlines.some(
        (d) =>
          !d.reviewName || !d.deadline || !d.deadline.from || !d.deadline.to
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "deadlines must be an array of objects with reviewName and deadline { from, to }.",
      });
    }

    let markingSchema = await MarkingSchema.findOne({ school, department });

    if (!markingSchema) {
      markingSchema = new MarkingSchema({ school, department, reviews: [] });
    }

    deadlines.forEach(({ reviewName, deadline }) => {
      const idx = markingSchema.reviews.findIndex(
        (rev) => rev.reviewName === reviewName
      );
      if (idx !== -1) {
        markingSchema.reviews[idx].deadline = deadline;
      } else {
        markingSchema.reviews.push({
          reviewName,
          components: [],
          deadline,
        });
      }
    });

    await markingSchema.save();

    res.status(200).json({
      success: true,
      message: "Default deadlines set successfully.",
      data: markingSchema,
    });
  } catch (error) {
    console.error("Error in setDefaultDeadline:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function updateRequestStatus(req, res) {
  try {
    const { requestId, status, newDeadline } = req.body;

    console.log("=== UPDATING REQUEST STATUS ===");
    console.log("Request ID:", requestId);
    console.log("Status:", status);
    console.log("New Deadline:", newDeadline);

    if (![" approved", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value. Must be 'approved' or 'rejected'.",
      });
    }

    if (status === "approved") {
      if (!newDeadline) {
        return res.status(400).json({
          success: false,
          message: "newDeadline is required for approved requests.",
        });
      }
      if (isNaN(new Date(newDeadline).getTime())) {
        return res.status(400).json({
          success: false,
          message: "Invalid date format for newDeadline.",
        });
      }
    }

    const request = await Request.findById(requestId)
      .populate("student")
      .populate("faculty");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Request not found!",
      });
    }

    const student = request.student;
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "No student mapped to the request.",
      });
    }

    const reviewType = request.reviewType;
    console.log("Review Type:", reviewType);
    console.log("Student RegNo:", student.regNo);

    if (status === "approved") {
      request.status = "approved";
      request.resolvedAt = new Date();

      if (student.reviews?.has(reviewType)) {
        const reviewData = student.reviews.get(reviewType);
        reviewData.locked = false;
        student.reviews.set(reviewType, reviewData);
      }

      const existingDeadline = student.deadline?.get(reviewType);
      if (existingDeadline) {
        existingDeadline.to = new Date(newDeadline);
        student.deadline.set(reviewType, existingDeadline);
      } else {
        student.deadline.set(reviewType, {
          from: new Date(),
          to: new Date(newDeadline),
        });
      }

      await student.save();
    } else {
      request.status = "rejected";
      request.resolvedAt = new Date();
    }

    await request.save();

    return res.status(200).json({
      success: true,
      message: `Request ${status} successfully.`,
      data: request,
    });
  } catch (error) {
    console.error("Error in updateRequestStatus:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

export async function getAllRequests(req, res) {
  try {
    const { facultyType } = req.params;
    const { school, department } = req.query;

    if (![" panel", "guide"].includes(facultyType)) {
      return res.status(400).json({
        success: false,
        message: "facultyType should either be 'guide' or 'panel'",
      });
    }

    console.log("Fetching requests with filters:", {
      facultyType,
      school,
      department,
    });

    const facultyMatch = {};
    if (school) {
      facultyMatch.school = { $in: [school] };
    }
    if (department) {
      facultyMatch.department = { $in: [department] };
    }

    console.log("Faculty match condition:", facultyMatch);

    const requests = await Request.find({ facultyType })
      .populate({
        path: "faculty",
        select: "name employeeId school department",
        match: facultyMatch,
      })
      .populate("student", "name regNo")
      .lean();

    console.log(
      `Found ${requests.length} requests, filtering out null faculty...`
    );

    const filteredRequests = requests.filter((req, index) => {
      if (req.faculty === null) {
        console.log(
          `Request ${index} has null faculty (filtered out by match condition)`
        );
        return false;
      }
      return true;
    });

    console.log(
      `After filtering: ${filteredRequests.length} requests with valid faculty`
    );

    if (!filteredRequests.length) {
      return res.status(404).json({
        success: false,
        message: `No requests found for the ${facultyType} with specified filters`,
      });
    }

    const grouped = {};

    filteredRequests.forEach((req, index) => {
      if (!req.faculty) {
        console.error(`Request ${index} has null faculty, skipping...`);
        return;
      }

      if (!req.student) {
        console.error(`Request ${index} has null student, skipping...`);
        return;
      }

      const faculty = req.faculty;
      const facultyId = faculty._id.toString();

      if (!grouped[facultyId]) {
        grouped[facultyId] = {
          _id: facultyId,
          name: faculty.name,
          empId: faculty.employeeId,
          school: faculty.school,
          department: faculty.department,
          students: [],
        };
      }

      grouped[facultyId].students.push({
        _id: req._id,
        name: req.student.name,
        regNo: req.student.regNo,
        projectType: req.reviewType,
        comments: req.reason,
        approved:
          req.status === "approved"
            ? true
            : req.status === "rejected"
            ? false
            : null,
      });
    });

    const result = Object.values(grouped);

    console.log(`Final result: ${result.length} faculty groups`);

    return res.status(200).json({
      success: true,
      message: "Operation successful",
      data: result,
    });
  } catch (error) {
    console.error("Error in getAllRequests:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function createPanelManually(req, res) {
  try {
    const { memberEmployeeIds, school, department, venue } = req.body;

    if (
      !Array.isArray(memberEmployeeIds) ||
      memberEmployeeIds.length < 2 ||
      new Set(memberEmployeeIds).size !== memberEmployeeIds.length
    ) {
      return res.status(400).json({
        success: false,
        message:
          "At least two distinct faculty employee IDs are required in members.",
      });
    }

    const faculties = await Faculty.find({
      employeeId: { $in: memberEmployeeIds },
    });

    if (faculties.length !== memberEmployeeIds.length) {
      const foundEmpIds = faculties.map((f) => f.employeeId.toString());
      const missing = memberEmployeeIds.filter(
        (id) => !foundEmpIds.includes(id)
      );
      return res.status(404).json({
        success: false,
        message: "Some faculty members not found.",
        missing,
      });
    }

    let panelSchool = school;
    let panelDepartment = department;

    if (!panelSchool) {
      const commonSchool = faculties
        .map((f) => f.school)
        .reduce((acc, schools) => acc.filter((s) => schools.includes(s)));
      if (commonSchool.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Faculty members must have at least one common school.",
        });
      }
      panelSchool = commonSchool[0];
    }

    if (!panelDepartment) {
      const commonDepartment = faculties
        .map((f) => f.department || [])
        .reduce((acc, depts) => acc.filter((d) => depts.includes(d)));
      if (commonDepartment.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Faculty members must have at least one common department.",
        });
      }
      panelDepartment = commonDepartment[0];
    }

    const panelData = {
      members: faculties.map((f) => f._id),
      school: panelSchool,
      department: panelDepartment,
      ...(venue ? { venue } : {}),
    };

    const panel = new Panel(panelData);
    await panel.save();

    return res.status(201).json({
      success: true,
      message: "Panel created successfully.",
      data: panel,
    });
  } catch (error) {
    console.error("Error creating panel:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function autoCreatePanels(req, res) {
  try {
    const { departments, school } = req.body;

    if (!school) {
      return res.status(400).json({
        success: false,
        message: "School must be provided in the request body.",
      });
    }

    const existingPanels = await Panel.find({}).populate(
      "members",
      "employeeId"
    );
    const alreadyAssignedFacultyIds = new Set();

    existingPanels.forEach((panel) => {
      panel.members.forEach((faculty) => {
        if (faculty && faculty.employeeId) {
          alreadyAssignedFacultyIds.add(faculty.employeeId.toString());
        }
      });
    });

    console.log(
      "Already assigned faculty IDs:",
      Array.from(alreadyAssignedFacultyIds)
    );

    const createdPanels = [];
    const invalidFaculties = {};
    const facultiesToUpdate = {};

    for (const [dept, { panelsNeeded, panelSize, faculties }] of Object.entries(
      departments
    )) {
      const availableFaculties = faculties.filter(
        (empId) => !alreadyAssignedFacultyIds.has(empId.toString())
      );

      console.log(
        `Department ${dept}: Original ${faculties.length}, Available ${availableFaculties.length}`
      );

      if (availableFaculties.length === 0) {
        invalidFaculties[dept] = [
          "All faculties already assigned to other panels",
        ];
        continue;
      }

      const foundFaculties = await Faculty.find({
        employeeId: { $in: availableFaculties },
      });

      const foundEmpIds = foundFaculties.map((f) => f.employeeId.toString());
      const missingEmpIds = availableFaculties.filter(
        (eid) => !foundEmpIds.includes(eid.toString())
      );

      if (missingEmpIds.length > 0) {
        invalidFaculties[dept] = missingEmpIds;
        continue;
      }

      foundFaculties.sort(
        (a, b) => parseInt(a.employeeId) - parseInt(b.employeeId)
      );

      const totalAvailable = foundFaculties.length;
      const requiredFaculty = panelsNeeded * panelSize;

      let actualPanelsNeeded = panelsNeeded;
      if (totalAvailable < requiredFaculty) {
        actualPanelsNeeded = Math.floor(totalAvailable / panelSize);

        if (actualPanelsNeeded === 0) {
          invalidFaculties[dept] = [
            `Not enough available faculties for even 1 panel. Need ${panelSize}, found ${totalAvailable} (excluding already assigned)`,
          ];
          continue;
        }

        console.log(
          `Adjusted panels for ${dept}: ${panelsNeeded} → ${actualPanelsNeeded}`
        );
      }

      const used = new Set();
      let facultyPool = [...foundFaculties];

      for (let i = 0; i < actualPanelsNeeded; i++) {
        let panelMembers = [];
        let left = 0,
          right = facultyPool.length - 1;

        while (panelMembers.length < panelSize && left <= right) {
          const leftFaculty = facultyPool[left];
          const rightFaculty = facultyPool[right];

          if (
            !used.has(leftFaculty.employeeId.toString()) &&
            panelMembers.length < panelSize
          ) {
            panelMembers.push(leftFaculty);
            used.add(leftFaculty.employeeId.toString());
            alreadyAssignedFacultyIds.add(leftFaculty.employeeId.toString());
          }

          if (
            left !== right &&
            !used.has(rightFaculty.employeeId.toString()) &&
            panelMembers.length < panelSize
          ) {
            panelMembers.push(rightFaculty);
            used.add(rightFaculty.employeeId.toString());
            alreadyAssignedFacultyIds.add(rightFaculty.employeeId.toString());
          }

          left++;
          right--;
        }

        const uniqueEmployeeIds = new Set(
          panelMembers.map((f) => f.employeeId.toString())
        );

        if (
          panelMembers.length !== panelSize ||
          uniqueEmployeeIds.size !== panelSize
        ) {
          console.log(
            `Skipping incomplete panel for ${dept}: got ${panelMembers.length}/${panelSize} members`
          );
          continue;
        }

        for (const f of panelMembers) {
          if (!facultiesToUpdate[f.employeeId]) {
            facultiesToUpdate[f.employeeId] = new Set();
          }
          facultiesToUpdate[f.employeeId].add(dept);
        }

        const panel = new Panel({
          members: panelMembers.map((f) => f._id),
          department: dept,
          school: school,
        });

        await panel.save();
        createdPanels.push(panel);

        console.log(
          `Created panel for ${dept} with faculty:`,
          panelMembers.map((f) => f.employeeId)
        );
      }
    }

    for (const [empid, deptSet] of Object.entries(facultiesToUpdate)) {
      const doc = await Faculty.findOne({ employeeId: empid });
      if (doc) {
        const prevDepartments = Array.isArray(doc.department)
          ? doc.department
          : [];
        const nextDepartments = Array.from(
          new Set([...prevDepartments, ...deptSet])
        );
        doc.department = nextDepartments;
        await doc.save();
      }
    }

    res.status(200).json({
      success: Object.keys(invalidFaculties).length === 0,
      message:
        Object.keys(invalidFaculties).length === 0
          ? `Successfully created ${createdPanels.length} panels and updated faculty departments.`
          : `Created ${
              createdPanels.length
            } panels with some errors. Invalid/missing faculties: ${JSON.stringify(
              invalidFaculties
            )}`,
      panelsCreated: createdPanels.length,
      invalidFaculties:
        Object.keys(invalidFaculties).length > 0 ? invalidFaculties : undefined,
      details: createdPanels.map((p) => ({
        department: p.department,
        facultyCount: p.members.length,
        school: p.school,
      })),
    });
  } catch (error) {
    console.error("Auto create panels error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function deletePanel(req, res) {
  try {
    const { panelId } = req.params;

    const deletedPanel = await Panel.findByIdAndDelete(panelId);

    if (!deletedPanel) {
      return res.status(404).json({
        success: false,
        message: "No panel found for the provided ID",
      });
    }

    await Project.updateMany({ panel: panelId }, { $set: { panel: null } });

    return res.status(200).json({
      success: true,
      message:
        "Panel deleted successfully and removed from associated projects",
      data: deletedPanel,
    });
  } catch (error) {
    console.error("Error deleting panel:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function getAllPanels(req, res) {
  try {
    const { school, department } = req.query;

    const filter = {};
    if (school) filter.school = school;
    if (department) filter.department = department;

    const panels = await Panel.find(filter)
      .populate({
        path: "members",
        select: "employeeId name emailId school department",
      })
      .lean();

    return res.status(200).json({
      success: true,
      message: "Operation Successful",
      data: panels || [],
    });
  } catch (error) {
    console.error("Error in getAllPanels:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function assignPanelToProject(req, res) {
  try {
    const { panelId, projectId } = req.body;

    if (!panelId || panelId === "null") {
      const updatedProject = await Project.findByIdAndUpdate(
        projectId,
        { panel: null },
        { new: true }
      );

      return res.status(200).json({
        success: true,
        message: "Panel removed from project successfully",
        data: updatedProject,
      });
    }

    const panel = await Panel.findById(panelId);
    if (!panel) {
      return res.status(404).json({
        success: false,
        message: "Panel not found.",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found.",
      });
    }

    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { panel: panel._id },
      { new: true }
    ).populate("panel");

    return res.status(200).json({
      success: true,
      message: "Panel assigned successfully",
      data: updatedProject,
    });
  } catch (error) {
    console.error("Error assigning panel to project:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function autoAssignPanelsToProjects(req, res) {
  try {
    const buffer = Number(req.body.buffer) || 0;
    const department = req.body.department;

    let projectFilter = { panel: null };
    let panelFilter = {};

    if (department) {
      projectFilter.department = department;
      panelFilter.department = department;
    }

    const unassignedProjects = await Project.find(projectFilter).populate(
      "guideFaculty"
    );

    const panels = await Panel.find(panelFilter).populate({
      path: "members",
      select: "employeeId name emailId school department specialization",
    });

    if (!panels.length) {
      return res.status(400).json({
        success: false,
        message: `No panels available${
          department ? ` for ${department} department` : ""
        }`,
      });
    }

    let panelsToAssign;
    let bufferPanels;
    let assignmentStats = {};

    if (department) {
      if (buffer >= panels.length) {
        return res.status(400).json({
          success: false,
          message: `Buffer (${buffer}) cannot be >= total panels (${panels.length}) for ${department}.`,
        });
      }
      panelsToAssign = panels.slice(0, panels.length - buffer);
      bufferPanels = panels.slice(panels.length - buffer);
    } else {
      const panelsByDept = {};
      panels.forEach((panel) => {
        if (!panelsByDept[panel.department]) {
          panelsByDept[panel.department] = [];
        }
        panelsByDept[panel.department].push(panel);
      });

      const departments = Object.keys(panelsByDept);
      if (departments.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No departments found with panels.",
        });
      }

      const bufferPerDept = Math.ceil(buffer / departments.length);
      panelsToAssign = [];
      bufferPanels = [];

      departments.forEach((dept) => {
        const deptPanels = panelsByDept[dept];
        const actualBuffer = Math.min(
          bufferPerDept,
          Math.max(0, deptPanels.length - 1)
        );

        const deptPanelsToAssign = deptPanels.slice(
          0,
          deptPanels.length - actualBuffer
        );
        const deptBufferPanels = deptPanels.slice(
          deptPanels.length - actualBuffer
        );

        panelsToAssign.push(...deptPanelsToAssign);
        bufferPanels.push(...deptBufferPanels);

        assignmentStats[dept] = 0;
      });
    }

    if (!panelsToAssign.length) {
      return res.status(400).json({
        success: false,
        message: "No panels left for assignment after applying buffer.",
      });
    }

    const sumEmployeeIdNumbers = (employeeId) => {
      const digits = employeeId.match(/\d+/g);
      if (!digits) return 0;
      return digits.reduce((acc, val) => acc + parseInt(val, 10), 0);
    };

    const calculatePanelScore = (panel) => {
      return panel.members.reduce(
        (acc, member) => acc + sumEmployeeIdNumbers(member.employeeId),
        0
      );
    };

    const panelsByDeptFiltered = {};
    panelsToAssign.forEach((panel) => {
      if (!panelsByDeptFiltered[panel.department]) {
        panelsByDeptFiltered[panel.department] = [];
      }
      panelsByDeptFiltered[panel.department].push(panel);
    });

    for (const dept in panelsByDeptFiltered) {
      panelsByDeptFiltered[dept].sort(
        (a, b) => calculatePanelScore(a) - calculatePanelScore(b)
      );
    }

    const panelAssignments = {};
    panelsToAssign.forEach((panel) => {
      panelAssignments[panel._id.toString()] = [];
    });

    let assignedCount = 0;
    let conflictCount = 0;

    const roundRobinIndex = {};

    for (const project of unassignedProjects) {
      const deptPanels = panelsByDeptFiltered[project.department] || [];

      const specializedPanels = deptPanels.filter((panel) =>
        panel.members.some(
          (member) =>
            member.specialization &&
            member.specialization.includes(project.specialization)
        )
      );

      const eligibleSpecializedPanels = specializedPanels.filter((panel) => {
        const guideId = project.guideFaculty._id.toString();
        return !panel.members.some(
          (member) => member._id.toString() === guideId
        );
      });

      let selectedPanel = null;

      if (eligibleSpecializedPanels.length > 0) {
        if (!(project.department in roundRobinIndex)) {
          roundRobinIndex[project.department] = 0;
        }

        const panelIdx =
          roundRobinIndex[project.department] %
          eligibleSpecializedPanels.length;
        selectedPanel = eligibleSpecializedPanels[panelIdx];

        roundRobinIndex[project.department]++;
      } else {
        const eligibleFallbackPanels = deptPanels.filter((panel) => {
          const guideId = project.guideFaculty._id.toString();
          return !panel.members.some(
            (member) => member._id.toString() === guideId
          );
        });

        if (eligibleFallbackPanels.length > 0) {
          if (!(project.department in roundRobinIndex)) {
            roundRobinIndex[project.department] = 0;
          }

          const fallbackPanelIdx =
            roundRobinIndex[project.department] % eligibleFallbackPanels.length;
          selectedPanel = eligibleFallbackPanels[fallbackPanelIdx];

          roundRobinIndex[project.department]++;
        }
      }

      if (selectedPanel) {
        project.panel = selectedPanel._id;
        await project.save();

        panelAssignments[selectedPanel._id.toString()].push(project._id);
        assignedCount++;
        if (!assignmentStats[project.department])
          assignmentStats[project.department] = 0;
        assignmentStats[project.department]++;
      } else {
        conflictCount++;
        console.log(
          `⚠️ No eligible panels for project ${project.name} with guide ${project.guideFaculty.name} in department ${project.department}`
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: `Assigned ${assignedCount} projects with ${
        department ? "department-specific" : "distributed per-department"
      } buffer strategy.`,
      data: {
        assignments: panelAssignments,
        bufferPanels: bufferPanels.map((p) => ({
          id: p._id,
          department: p.department,
          members: p.members.map((m) => ({
            name: m.name,
            employeeId: m.employeeId,
          })),
        })),
        statistics: {
          totalProjects: unassignedProjects.length,
          assignedProjects: assignedCount,
          conflictedProjects: conflictCount,
          unassignableProjects: unassignedProjects.length - assignedCount,
          totalPanelsAvailable: panels.length,
          panelsUsedForAssignment: panelsToAssign.length,
          panelsKeptAsBuffer: bufferPanels.length,
          assignmentPerDepartment: assignmentStats,
        },
        mode: department
          ? `Single Department (${department})`
          : "All Departments with Distributed Buffer",
      },
    });
  } catch (error) {
    console.error("Error in autoAssignPanelsToProjects:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

export async function createBroadcastMessage(req, res) {
  try {
    const {
      title = "",
      message,
      targetSchools,
      targetDepartments,
      expiresAt,
      isActive,
    } = req.body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message content is required.",
      });
    }

    if (targetSchools && !Array.isArray(targetSchools)) {
      return res.status(400).json({
        success: false,
        message: "targetSchools must be an array of strings.",
      });
    }

    if (targetDepartments && !Array.isArray(targetDepartments)) {
      return res.status(400).json({
        success: false,
        message: "targetDepartments must be an array of strings.",
      });
    }

    const admin = await Faculty.findById(req.user.id).select(
      "_id name employeeId"
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: "Admin context not found.",
      });
    }

    const normalizeAudience = (list) => {
      if (!Array.isArray(list)) return [];
      const uniqueValues = [...new Set(list.filter(Boolean))];
      return uniqueValues.map((value) => String(value).trim()).filter(Boolean);
    };

    const normalizedSchools = normalizeAudience(targetSchools);
    const normalizedDepartments = normalizeAudience(targetDepartments);

    let expiryDate = null;
    if (expiresAt) {
      const parsedExpiry = new Date(expiresAt);
      if (Number.isNaN(parsedExpiry.getTime())) {
        return res.status(400).json({
          success: false,
          message: "expiresAt must be a valid date string.",
        });
      }
      expiryDate = parsedExpiry;
    }

    const payload = {
      title: title?.trim?.() || "",
      message: message.trim(),
      targetSchools: normalizedSchools,
      targetDepartments: normalizedDepartments,
      createdBy: admin._id,
      createdByEmployeeId: admin.employeeId,
      createdByName: admin.name || "",
      expiresAt: expiryDate,
    };

    if (typeof isActive === "boolean") {
      payload.isActive = isActive;
    }

    const broadcast = await BroadcastMessage.create(payload);

    return res.status(201).json({
      success: true,
      message: "Broadcast message sent successfully.",
      data: broadcast,
    });
  } catch (error) {
    console.error("❌ Error creating broadcast message:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create broadcast message.",
      error: error.message,
    });
  }
}

export async function getBroadcastMessages(req, res) {
  try {
    const {
      limit = 25,
      skip = 0,
      includeExpired = "false",
      activeOnly = "false",
    } = req.query;

    const parsedLimit = Math.min(Number(limit) || 25, 100);
    const parsedSkip = Number(skip) || 0;
    const now = new Date();

    const filters = {};

    if (activeOnly === "true") {
      filters.isActive = true;
    }

    if (includeExpired !== "true") {
      filters.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
    }

    const broadcasts = await BroadcastMessage.find(filters)
      .sort({ createdAt: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit)
      .lean();

    const total = await BroadcastMessage.countDocuments(filters);

    return res.status(200).json({
      success: true,
      data: broadcasts,
      meta: {
        count: broadcasts.length,
        total,
        limit: parsedLimit,
        skip: parsedSkip,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching broadcast messages:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch broadcast messages.",
      error: error.message,
    });
  }
}








// import mongoose from "mongoose";
// import Faculty from "../models/facultySchema.js";
// import bcrypt from "bcryptjs";
// import Student from "../models/studentSchema.js";
// import Request from "../models/requestSchema.js";
// import Project from "../models/projectSchema.js";
// import Panel from "../models/panelSchema.js";
// import MarkingSchema from "../models/markingSchema.js";
// import BroadcastMessage from "../models/broadcastMessageSchema.js";


// // for updating the structure of the marks

// export async function createOrUpdateMarkingSchema(req, res) {
//   const { school, department, reviews, requiresContribution } = req.body;

//   console.log("📝 Received marking schema request:", {
//     school,
//     department,
//     reviewCount: reviews?.length,
//     requiresContribution,
//     rawBody: JSON.stringify(req.body, null, 2),
//   });

//   if (
//     !school ||
//     !department ||
//     !Array.isArray(reviews) ||
//     reviews.length === 0
//   ) {
//     return res
//       .status(400)
//       .json({ success: false, message: "Missing or invalid fields." });
//   }

//   // Validate requiresContribution at schema level (optional, defaults to false)
//   if (requiresContribution !== undefined && typeof requiresContribution !== "boolean") {
//     return res.status(400).json({
//       success: false,
//       message: "requiresContribution must be a boolean value",
//     });
//   }

//   // VALIDATE AND CLEAN EACH REVIEW
//   const cleanedReviews = [];
//   let totalWeightAcrossAllReviews = 0;

//   for (const review of reviews) {
//     console.log("🔍 Validating review:", review.reviewName);

//     // Required fields validation
//     if (
//       !review.reviewName ||
//       !review.facultyType ||
//       !["guide", "panel"].includes(review.facultyType)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Each review must have reviewName and facultyType (guide or panel)",
//       });
//     }

//     // Deadline validation
//     if (!review.deadline || !review.deadline.from || !review.deadline.to) {
//       return res.status(400).json({
//         success: false,
//         message: "Each review must have valid deadline with from and to dates",
//       });
//     }

//     // Validate deadline dates
//     const fromDate = new Date(review.deadline.from);
//     const toDate = new Date(review.deadline.to);
    
//     if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid date format in deadline for review: ${review.reviewName}`,
//       });
//     }

//     if (fromDate >= toDate) {
//       return res.status(400).json({
//         success: false,
//         message: `Deadline 'from' date must be before 'to' date for review: ${review.reviewName}`,
//       });
//     }

//     // Components validation (optional but if provided must be valid)
//     let reviewTotalWeight = 0;
//     if (review.components) {
//       if (!Array.isArray(review.components)) {
//         return res.status(400).json({
//           success: false,
//           message: "Components must be an array if provided",
//         });
//       }

//       if (review.components.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: `Review ${review.reviewName} has empty components array`,
//         });
//       }

//       for (const comp of review.components) {
//         if (!comp.name || typeof comp.weight !== "number") {
//           return res.status(400).json({
//             success: false,
//             message: "Each component must have a name and numeric weight",
//           });
//         }

//         if (comp.weight <= 0) {
//           return res.status(400).json({
//             success: false,
//             message: `Component ${comp.name} must have a positive weight`,
//           });
//         }

//         reviewTotalWeight += comp.weight;
//       }
//     }

//     totalWeightAcrossAllReviews += reviewTotalWeight;
//     console.log(`📊 Review ${review.reviewName} weight: ${reviewTotalWeight}`);

//     // PPT Approved validation (should always be present)
//     if (!review.pptApproved) {
//       return res.status(400).json({
//         success: false,
//         message: "Each review must have pptApproved field",
//       });
//     }

//     // Check for pptApproved.approved as Boolean
//     if (typeof review.pptApproved.approved !== "boolean") {
//       return res.status(400).json({
//         success: false,
//         message: "pptApproved field must have boolean approved value",
//       });
//     }

//     // Validate pptApproved.locked if provided
//     if (
//       review.pptApproved.locked !== undefined &&
//       typeof review.pptApproved.locked !== "boolean"
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "pptApproved.locked must be a boolean value if provided",
//       });
//     }

//     // CRITICAL: Strip requiresContribution from individual reviews if present
//     // This field should only exist at schema level, not per review
//     const cleanedReview = {
//       reviewName: review.reviewName,
//       displayName: review.displayName || review.reviewName,
//       facultyType: review.facultyType,
//       components: review.components || [],
//       deadline: {
//         from: review.deadline.from,
//         to: review.deadline.to,
//       },
//       pptApproved: {
//         approved: review.pptApproved.approved,
//         locked: review.pptApproved.locked !== undefined ? review.pptApproved.locked : false,
//       },
//     };

//     // Log if requiresContribution was present at review level (for debugging)
//     if (review.requiresContribution !== undefined) {
//       console.warn(
//         `⚠️  WARNING: Review ${review.reviewName} contains requiresContribution field. This should only be at schema level. Stripping it from review.`
//       );
//     }

//     cleanedReviews.push(cleanedReview);
//   }

//   // Validate total weight across all reviews equals 100
//   console.log(`📊 Total weight across all reviews: ${totalWeightAcrossAllReviews}`);
//   if (Math.abs(totalWeightAcrossAllReviews - 100) > 0.01) {
//     return res.status(400).json({
//       success: false,
//       message: `Total weight across all reviews must equal 100. Current total: ${totalWeightAcrossAllReviews}`,
//     });
//   }

//   try {
//     console.log("💾 Attempting to save/update marking schema for:", {
//       school,
//       department,
//     });

//     // Check if updating existing schema
//     const existingSchema = await MarkingSchema.findOne({ school, department });
    
//     if (existingSchema) {
//       console.log("📝 Updating existing marking schema:", existingSchema._id);
//     } else {
//       console.log("🆕 Creating new marking schema");
//     }

//     // Prepare the update object with cleaned reviews
//     const updateData = {
//       school,
//       department,
//       reviews: cleanedReviews,
//       requiresContribution: requiresContribution !== undefined ? requiresContribution : false,
//     };

//     console.log("💾 Final update data:", JSON.stringify(updateData, null, 2));

//     const updated = await MarkingSchema.findOneAndUpdate(
//       { school, department },
//       updateData,
//       {
//         new: true,
//         upsert: true,
//         runValidators: true, // Enable schema validation on update
//       }
//     );

//     console.log("✅ Marking schema saved successfully with _id:", updated._id);
//     console.log("📊 Schema details:", {
//       reviewCount: updated.reviews.length,
//       requiresContribution: updated.requiresContribution,
//       totalWeight: totalWeightAcrossAllReviews,
//       reviews: updated.reviews.map(r => ({
//         name: r.reviewName,
//         displayName: r.displayName,
//         facultyType: r.facultyType,
//         componentsCount: r.components?.length || 0,
//         componentWeight: r.components?.reduce((sum, c) => sum + c.weight, 0) || 0,
//       })),
//     });

//     res.status(200).json({
//       success: true,
//       message: existingSchema 
//         ? "Marking schema updated successfully."
//         : "Marking schema created successfully.",
//       data: updated,
//     });
//   } catch (error) {
//     console.error("❌ Error saving marking schema:", error);
//     console.error("❌ Error stack:", error.stack);
    
//     // Handle duplicate key error
//     if (error.code === 11000) {
//       return res.status(409).json({
//         success: false,
//         message: "A marking schema with this school and department already exists",
//         error: error.message,
//       });
//     }

//     // Handle validation errors
//     if (error.name === "ValidationError") {
//       return res.status(400).json({
//         success: false,
//         message: "Schema validation failed",
//         error: error.message,
//         details: Object.keys(error.errors).map(key => ({
//           field: key,
//           message: error.errors[key].message,
//         })),
//       });
//     }

//     // Handle cast errors
//     if (error.name === "CastError") {
//       return res.status(400).json({
//         success: false,
//         message: `Invalid data type for field: ${error.path}`,
//         error: error.message,
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Server error while saving marking schema",
//       error: error.message,
//       ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
//     });
//   }
// }

// // Updated getDefaultDeadline function
// export async function getDefaultDeadline(req, res) {
//   try {
//     const { school, department } = req.query;

//     if (!school || !department) {
//       return res.status(400).json({
//         success: false,
//         message: "school and department query parameters are required.",
//       });
//     }

//     console.log(`📥 Fetching marking schema for ${school} - ${department}`);

//     const markingSchema = await MarkingSchema.findOne({ school, department });

//     if (!markingSchema) {
//       console.log(`❌ No marking schema found for ${school} - ${department}`);
//       return res.status(404).json({
//         success: false,
//         message: "No marking schema found for this school and department.",
//       });
//     }

//     console.log(`✅ Found marking schema for ${school} - ${department}`);
//     console.log(`📊 requiresContribution: ${markingSchema.requiresContribution}`);

//     // FIXED: Return requiresContribution at schema level, not per review
//     res.status(200).json({
//       success: true,
//       data: {
//         school: markingSchema.school,
//         department: markingSchema.department,
//         requiresContribution: markingSchema.requiresContribution || false, // ✅ At schema level
//         reviews: markingSchema.reviews.map((review) => ({
//           reviewName: review.reviewName,
//           displayName: review.displayName || review.reviewName,
//           facultyType: review.facultyType || "guide",
//           components: review.components || [],
//           deadline: review.deadline || null,
//           pptApproved: review.pptApproved || { approved: false, locked: false },
//           // ❌ REMOVED: requiresContribution from individual reviews
//         })),
//       },
//     });

//     console.log(`📤 Returned ${markingSchema.reviews.length} reviews for ${school} - ${department}`);

//   } catch (error) {
//     console.error("❌ Error in getDefaultDeadline:", error);
//     console.error("❌ Error stack:", error.stack);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//       ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
//     });
//   }
// }

// export async function createFaculty(req, res) {
//   try {
//     const {
//       name,
//       emailId,
//       password,
//       employeeId,
//       school,
//       department,
//       specialization,
//       imageUrl,
//       role = "faculty",
//       phoneNumber,
//     } = req.body;

//     if (!name || !emailId || !password || !employeeId || !phoneNumber) {
//       // ← phoneNumber required
//       return res.status(400).json({
//         success: false,
//         message:
//           "Name, email, password, employee ID, and phone number are required",
//       });
//     } // Only allow college emails

//     if (!emailId.endsWith("@vit.ac.in")) {
//       return res.status(400).json({
//         success: false,
//         message: "Only college emails allowed!",
//       });
//     } // Password validation

//     if (
//       password.length < 8 ||
//       !/[A-Z]/.test(password) ||
//       !/[a-z]/.test(password) ||
//       !/[0-9]/.test(password) ||
//       !/[^A-Za-z0-9]/.test(password)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
//       });
//     } // Validate school, department, and specialization arrays

//     if (!school || !Array.isArray(school) || school.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "School must be a non-empty array",
//       });
//     } // if (!department || !Array.isArray(department) || department.length === 0) { //   return res.status(400).json({ //     success: false, //     message: "Department must be a non-empty array", //   }); // }

//     if (!/^(\+91[- ]?)?[6-9]\d{9}$/.test(phoneNumber.trim())) {
//       return res.status(400).json({
//         success: false,
//         message: "Please enter a valid Indian phone number",
//       });
//     }

//     if (
//       !specialization ||
//       !Array.isArray(specialization) ||
//       specialization.length === 0
//     ) {
//       return res.status(400).json({
//         success: false,
//         message: "Specialization must be a non-empty array",
//       });
//     } // Check if email or phone number is already registered

//     const existingFaculty = await Faculty.findOne({
//       $or: [
//         { emailId: emailId.trim().toLowerCase() },
//         { employeeId: employeeId.trim().toUpperCase() },
//         { phoneNumber: phoneNumber.trim() }, // ← Added uniqueness check for phoneNumber
//       ],
//     });

//     if (existingFaculty) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Faculty with this email, employee ID, or phone number already exists!",
//       });
//     } // Hash password before saving

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt); // Create faculty with correct field names matching schema

//     const newFaculty = new Faculty({
//       imageUrl: imageUrl || "",
//       name: name.trim(),
//       emailId: emailId.trim().toLowerCase(),
//       password: hashedPassword,
//       employeeId: employeeId.trim().toUpperCase(),
//       phoneNumber: phoneNumber.trim(), // ← Set phoneNumber
//       role: role,
//       school: school.map((s) => s.trim()),
//       department: department.map((d) => d.trim()),
//       specialization: specialization.map((sp) => sp.trim()),
//     });

//     await newFaculty.save();

//     return res.status(201).json({
//       success: true,
//       message: "Faculty created successfully!",
//     });
//   } catch (error) {
//     console.error("Error creating faculty:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while creating faculty",
//       error: error.message,
//     });
//   }
// }

// export async function createFacultyBulk(req, res) {
//   try {
//     const { facultyList } = req.body;
//     if (!Array.isArray(facultyList) || facultyList.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Faculty list is required and must be a non-empty array",
//       });
//     }

//     const results = {
//       created: 0,
//       errors: 0,
//       details: [],
//     };

//     for (let i = 0; i < facultyList.length; i++) {
//       const faculty = facultyList[i];
//       try {
//         // Validate required fields including arrays and phoneNumber
//         if (
//           !faculty.name ||
//           !faculty.emailId ||
//           !faculty.password ||
//           !faculty.employeeId ||
//           !faculty.phoneNumber ||
//           !faculty.schools ||
//           !faculty.specialization
//         ) {
//           results.errors++;
//           results.details.push({
//             row: i + 1,
//             error:
//               "Missing required fields including phoneNumber, schools, or specialization",
//           });
//           continue;
//         }

//         if (
//           !Array.isArray(faculty.schools) ||
//           faculty.schools.length === 0 ||
//           !Array.isArray(faculty.specialization) ||
//           faculty.specialization.length === 0
//         ) {
//           results.errors++;
//           results.details.push({
//             row: i + 1,
//             error: "Schools and specialization must be non-empty arrays",
//           });
//           continue;
//         }

//         if (!faculty.emailId.endsWith("@vit.ac.in")) {
//           results.errors++;
//           results.details.push({
//             row: i + 1,
//             error: "Invalid email domain",
//           });
//           continue;
//         }

//         // Phone number regex validation using schema regex pattern
//         const phoneRegex = /^(\+91[- ]?)?[6-9]\d{9}$/;
//         if (!phoneRegex.test(faculty.phoneNumber.trim())) {
//           results.errors++;
//           results.details.push({
//             row: i + 1,
//             error: "Invalid Indian phone number format",
//           });
//           continue;
//         }

//         // Check existing faculty by email, employeeId, or phoneNumber (case normalized)
//         const existingFaculty = await Faculty.findOne({
//           $or: [
//             { emailId: faculty.emailId.trim().toLowerCase() },
//             { employeeId: faculty.employeeId.trim().toUpperCase() },
//             { phoneNumber: faculty.phoneNumber.trim() },
//           ],
//         });

//         if (existingFaculty) {
//           results.errors++;
//           results.details.push({
//             row: i + 1,
//             error:
//               "Faculty with this email, employee ID, or phone number already exists",
//           });
//           continue;
//         }

//         // Hash password securely
//         const salt = await bcrypt.genSalt(10);
//         const hashedPassword = await bcrypt.hash(faculty.password, salt);

//         // Departments: assign empty array if not provided or not a valid array
//         let departments = [];
//         if (
//           Array.isArray(faculty.departments) &&
//           faculty.departments.length > 0
//         ) {
//           departments = faculty.departments.map((d) => d.trim());
//         }

//         // Create new faculty record with array fields and phone number
//         const newFaculty = new Faculty({
//           imageUrl: faculty.imageUrl || "",
//           name: faculty.name.trim(),
//           emailId: faculty.emailId.trim().toLowerCase(),
//           password: hashedPassword,
//           employeeId: faculty.employeeId.trim().toUpperCase(),
//           phoneNumber: faculty.phoneNumber.trim(),
//           role: faculty.role || "faculty",
//           school: faculty.schools.map((s) => s.trim()),
//           department: departments,
//           specialization: faculty.specialization.map((sp) => sp.trim()),
//         });

//         await newFaculty.save();
//         console.log(newFaculty);
//         results.created++;
//       } catch (error) {
//         results.errors++;
//         results.details.push({
//           row: i + 1,
//           error: error.message,
//         });
//       }
//     }

//     return res.status(201).json({
//       success: true,
//       message: `Bulk faculty creation completed. ${results.created} created, ${results.errors} errors.`,
//       data: results,
//     });
//   } catch (error) {
//     console.error("Error in bulk faculty creation:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error during bulk creation",
//       error: error.message,
//     });
//   }
// }

// export async function updateFaculty(req, res) {
//   try {
//     const { employeeId } = req.params;
//     const {
//       name,
//       emailId,
//       password,
//       school,
//       department,
//       specialization,
//       role,
//       imageUrl,
//       phoneNumber, // Added phoneNumber here
//     } = req.body;

//     // Find existing faculty by employeeId (normalized case)
//     const faculty = await Faculty.findOne({
//       employeeId: employeeId.trim().toUpperCase(),
//     });
//     if (!faculty) {
//       return res.status(404).json({
//         success: false,
//         message: "Faculty with the given employee ID not found.",
//       });
//     }

//     // Validate updated email if provided
//     if (emailId && !emailId.endsWith("@vit.ac.in")) {
//       return res.status(400).json({
//         success: false,
//         message: "Only college emails allowed!",
//       });
//     }

//     // If email is updated and different, check uniqueness
//     if (emailId && emailId !== faculty.emailId) {
//       const emailExists = await Faculty.findOne({ emailId });
//       if (emailExists) {
//         return res.status(400).json({
//           success: false,
//           message: "Another faculty with this email already exists.",
//         });
//       }
//     }

//     // Validate phoneNumber similarly
//     if (phoneNumber) {
//       const phoneRegex = /^(\+91[- ]?)?[6-9]\d{9}$/;
//       if (!phoneRegex.test(phoneNumber)) {
//         return res.status(400).json({
//           success: false,
//           message: "Please enter a valid Indian phone number.",
//         });
//       }
//       if (phoneNumber !== faculty.phoneNumber) {
//         const phoneExists = await Faculty.findOne({ phoneNumber });
//         if (phoneExists) {
//           return res.status(400).json({
//             success: false,
//             message: "Another faculty with this phone number already exists.",
//           });
//         }
//       }
//     }

//     // Validate password if provided
//     if (password) {
//       if (
//         password.length < 8 ||
//         !/[A-Z]/.test(password) ||
//         !/[a-z]/.test(password) ||
//         !/[0-9]/.test(password) ||
//         !/[^A-Za-z0-9]/.test(password)
//       ) {
//         return res.status(400).json({
//           success: false,
//           message:
//             "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
//         });
//       }
//       // Hash new password
//       const salt = await bcrypt.genSalt(10);
//       faculty.password = await bcrypt.hash(password, salt);
//     }

//     // Update fields if provided
//     if (name) faculty.name = name;
//     if (emailId) faculty.emailId = emailId.trim().toLowerCase();
//     if (phoneNumber) faculty.phoneNumber = phoneNumber;
//     if (role && ["admin", "faculty"].includes(role)) faculty.role = role;
//     if (Array.isArray(school) && school.length > 0) faculty.school = school;
//     if (Array.isArray(department) && department.length > 0)
//       faculty.department = department;
//     if (Array.isArray(specialization) && specialization.length > 0)
//       faculty.specialization = specialization;
//     if (imageUrl !== undefined) faculty.imageUrl = imageUrl;

//     await faculty.save();
//     console.log(faculty);

//     return res.status(200).json({
//       success: true,
//       message: "Faculty updated successfully!",
//     });
//   } catch (error) {
//     console.error("Error updating faculty:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error while updating faculty",
//     });
//   }
// }

// export async function getAllFaculty(req, res) {
//   const { school, department, specialization, sortBy, sortOrder } = req.query;

//   try {
//     // Build dynamic query based on provided filters
//     let query = {};

//     if (school && school !== "all") query.school = school;
//     if (department && department !== "all") query.department = department;
//     if (specialization && specialization !== "all")
//       query.specialization = specialization;

//     // Allowed sorting fields
//     const validSortFields = [
//       "school",
//       "department",
//       "specialization",
//       "name",
//       "employeeId",
//     ];

//     let sortOption = {};
//     if (sortBy && validSortFields.includes(sortBy)) {
//       const order = sortOrder && sortOrder.toLowerCase() === "desc" ? -1 : 1;
//       sortOption[sortBy] = order;
//     } else {
//       // Default sort by name
//       sortOption.name = 1;
//     }

//     const faculty = await Faculty.find(query)
//       .sort(sortOption)
//       .select("-password");

//     res.status(200).json({
//       success: true,
//       data: faculty.map((f) => ({
//         _id: f._id,
//         imageUrl: f.imageUrl,
//         name: f.name,
//         employeeId: f.employeeId,
//         emailId: f.emailId,
//         phoneNumber: f.phoneNumber,
//         role: f.role,
//         school: f.school,
//         department: f.department,
//         specialization: f.specialization,
//       })),
//       count: faculty.length,
//     });
//   } catch (error) {
//     console.error("Error in getAllFaculty:", error);
//     res.status(500).json({
//       success: false,
//       message: error.message,
//     });
//   }
// }

// export async function getAllGuideWithProjects(req, res) {
//   try {
//     const { school, department } = req.query;

//     // Build dynamic query for faculties by role and optional school and department
//     const facultyQuery = { role: "faculty" };
//     if (school) facultyQuery.school = school;
//     if (department) facultyQuery.department = department;

//     const faculties = await Faculty.find(facultyQuery);

//     const result = await Promise.all(
//       faculties.map(async (faculty) => {
//         // Build dynamic query for projects by guideFaculty, and optional school and department
//         const projectQuery = { guideFaculty: faculty._id };
//         if (school) projectQuery.school = school;
//         if (department) projectQuery.department = department;

//         const guidedProjects = await Project.find(projectQuery)
//           .populate("students", "regNo name")
//           .lean();

//         return {
//           faculty: {
//             _id: faculty._id,
//             employeeId: faculty.employeeId,
//             name: faculty.name,
//             emailId: faculty.emailId,
//             school: faculty.school,
//             department: faculty.department,
//             phoneNumber: faculty.phoneNumber,
//           },
//           guidedProjects,
//         };
//       })
//     );

//     res.status(200).json({ success: true, data: result });
//   } catch (error) {
//     console.error("Error in getAllGuideWithProjects:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// }

// export async function getAllPanelsWithProjects(req, res) {
//   try {
//     const { school, department } = req.query;
//     console.log("getAllPanelsWithProjects called with:", {
//       school,
//       department,
//     });

//     // ✅ FIXED: Build panel filter query based on panel fields, not faculty fields
//     let panelQuery = {};
//     if (school) {
//       panelQuery.school = school;
//     }
//     if (department) {
//       panelQuery.department = department;
//     }

//     console.log("Panel query:", panelQuery);

//     // ✅ FIXED: Find panels directly by panel school/department fields
//     const panels = await Panel.find(panelQuery)
//       .populate("members", "employeeId name emailId school department")
//       .lean();

//     console.log("Found panels with direct filtering:", panels.length);

//     // ✅ SIMPLIFIED: No additional filtering needed since we already filtered at database level
//     const result = await Promise.all(
//       panels.map(async (panel) => {
//         // Get ALL teams assigned to this panel
//         const projectQuery = { panel: panel._id };

//         console.log(`Searching projects for panel ${panel._id}`);

//         const projects = await Project.find(projectQuery)
//           .populate("students", "regNo name emailId school department")
//           .populate("guideFaculty", "name emailId employeeId")
//           .lean();

//         console.log(`Found ${projects.length} projects for panel ${panel._id}`);

//         return {
//           panelId: panel._id,
//           members: panel.members,
//           venue: panel.venue,
//           school: panel.school,
//           department: panel.department,
//           projects,
//         };
//       })
//     );

//     console.log(
//       "Final result:",
//       result.map((r) => ({
//         panelId: r.panelId,
//         projectCount: r.projects.length,
//       }))
//     );

//     res.status(200).json({ success: true, data: result });
//   } catch (error) {
//     console.error("Error in getAllPanelsWithProjects:", error);
//     res.status(500).json({ success: false, message: error.message });
//   }
// }

// export async function deleteFacultyByEmployeeId(req, res) {
//   const { employeeId } = req.params;

//   try {
//     const deletedFaculty = await Faculty.findOneAndDelete({
//       employeeId: employeeId.trim().toUpperCase(),
//     });

//     if (!deletedFaculty) {
//       return res.status(404).json({
//         success: false,
//         message: `No faculty found with employee ID: ${employeeId}`,
//       });
//     }

//     res.status(200).json({
//       success: true,
//       message: `Faculty with employee ID ${employeeId} has been deleted successfully.`,
//       data: deletedFaculty,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Server error while deleting faculty",
//       error: error.message,
//     });
//   }
// }

// export async function createAdmin(req, res) {
//   try {
//     const {
//       name,
//       emailId,
//       password,
//       employeeId,
//       phoneNumber,
//       school,
//       department,
//     } = req.body;

//     if (!emailId.endsWith("@vit.ac.in")) {
//       return res.status(400).json({
//         success: false,
//         message: "Only college emails allowed!",
//       });
//     }

//     // Password validation
//     if (
//       password.length < 8 ||
//       !/[A-Z]/.test(password) ||
//       !/[a-z]/.test(password) ||
//       !/[0-9]/.test(password) ||
//       !/[^A-Za-z0-9]/.test(password)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
//       });
//     }

//     const existingFaculty = await Faculty.findOne({ emailId });
//     if (existingFaculty) {
//       return res.status(400).json({
//         success: false,
//         message: "Admin already registered!",
//       });
//     }

//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     // ✅ FIXED: Handle arrays for school and department
//     const newFaculty = new Faculty({
//       name,
//       emailId,
//       password: hashedPassword,
//       employeeId,
//       phoneNumber, // ✅ Add missing phoneNumber
//       role: "admin",
//       school: Array.isArray(school) ? school : [school], // ✅ Ensure array
//       department: Array.isArray(department)
//         ? department
//         : department
//         ? [department]
//         : [], // ✅ Ensure array
//       specialization: [], // ✅ Empty array for admin
//     });

//     await newFaculty.save();

//     return res.status(201).json({
//       success: true,
//       message: "Admin created successfully!",
//     });
//   } catch (error) {
//     console.error("Error creating admin:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to create admin",
//     });
//   }
// }

// export async function setDefaultDeadline(req, res) {
//   try {
//     const { school, department, deadlines } = req.body;

//     if (!school || !department) {
//       return res.status(400).json({
//         success: false,
//         message: "school and department are required.",
//       });
//     }

//     if (
//       !Array.isArray(deadlines) ||
//       deadlines.some(
//         (d) =>
//           !d.reviewName || !d.deadline || !d.deadline.from || !d.deadline.to
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "deadlines must be an array of objects with reviewName and deadline { from, to }.",
//       });
//     }

//     // Fetch existing marking schema or create new one
//     let markingSchema = await MarkingSchema.findOne({ school, department });

//     if (!markingSchema) {
//       // Create new markingSchema with empty reviews (will get updated now)
//       markingSchema = new MarkingSchema({ school, department, reviews: [] });
//     }

//     // Merge/update deadlines for reviews
//     // Loop through the input deadlines, for each review update or add deadline object
//     deadlines.forEach(({ reviewName, deadline }) => {
//       // Find if the review exists
//       const idx = markingSchema.reviews.findIndex(
//         (rev) => rev.reviewName === reviewName
//       );
//       if (idx !== -1) {
//         // Update deadline of existing review
//         markingSchema.reviews[idx].deadline = deadline;
//       } else {
//         // Add new review with empty components but provided deadline
//         markingSchema.reviews.push({
//           reviewName,
//           components: [],
//           deadline,
//         });
//       }
//     });

//     await markingSchema.save();

//     res.status(200).json({
//       success: true,
//       message: "Default deadlines set successfully.",
//       data: markingSchema,
//     });
//   } catch (error) {
//     console.error("Error in setDefaultDeadline:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// // need to restructure this
// export async function updateRequestStatus(req, res) {
//   try {
//     const { requestId, status, newDeadline } = req.body;

//     console.log("=== UPDATING REQUEST STATUS ===");
//     console.log("Request ID:", requestId);
//     console.log("Status:", status);
//     console.log("New Deadline:", newDeadline);

//     if (!["approved", "rejected"].includes(status)) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid status value. Must be 'approved' or 'rejected'.",
//       });
//     }

//     if (status === "approved") {
//       if (!newDeadline) {
//         return res.status(400).json({
//           success: false,
//           message: "newDeadline is required for approved requests.",
//         });
//       }
//       if (isNaN(new Date(newDeadline).getTime())) {
//         return res.status(400).json({
//           success: false,
//           message: "Invalid date format for newDeadline.",
//         });
//       }
//     }

//     const request = await Request.findById(requestId)
//       .populate("student")
//       .populate("faculty");

//     if (!request) {
//       return res.status(404).json({
//         success: false,
//         message: "Request not found!",
//       });
//     }

//     const student = request.student;
//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "No student mapped to the request.",
//       });
//     }

//     const reviewType = request.reviewType;
//     console.log("Review Type:", reviewType);
//     console.log("Student RegNo:", student.regNo);

//     if (status === "approved") {
//       request.status = "approved";
//       request.resolvedAt = new Date();

//       // Unlock review in student's reviews map (if present)
//       if (student.reviews?.has(reviewType)) {
//         const reviewData = student.reviews.get(reviewType);
//         reviewData.locked = false;
//         student.reviews.set(reviewType, reviewData);
//       }

//       // Update or create student deadline Map entry for this reviewType
//       const existingDeadline = student.deadline?.get(reviewType);
//       if (existingDeadline) {
//         existingDeadline.to = new Date(newDeadline);
//         student.deadline.set(reviewType, existingDeadline);
//       } else {
//         student.deadline.set(reviewType, {
//           from: new Date(),
//           to: new Date(newDeadline),
//         });
//       }

//       await student.save();
//     } else {
//       request.status = "rejected";
//       request.resolvedAt = new Date();
//     }

//     await request.save();

//     return res.status(200).json({
//       success: true,
//       message: `Request ${status} successfully.`,
//       data: request,
//     });
//   } catch (error) {
//     console.error("Error in updateRequestStatus:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//       error: error.message,
//     });
//   }
// }

// export async function getAllRequests(req, res) {
//   try {
//     const { facultyType } = req.params;
//     const { school, department } = req.query;

//     if (!["panel", "guide"].includes(facultyType)) {
//       return res.status(400).json({
//         success: false,
//         message: "facultyType should either be 'guide' or 'panel'",
//       });
//     }

//     console.log("Fetching requests with filters:", {
//       facultyType,
//       school,
//       department,
//     });

//     // ✅ FIXED: Build match condition for array fields
//     const facultyMatch = {};
//     if (school) {
//       facultyMatch.school = { $in: [school] }; // ✅ Use $in for array field
//     }
//     if (department) {
//       facultyMatch.department = { $in: [department] }; // ✅ Use $in for array field
//     }

//     console.log("Faculty match condition:", facultyMatch);

//     // Fetch requests and populate faculty and student with necessary fields
//     const requests = await Request.find({ facultyType })
//       .populate({
//         path: "faculty",
//         select: "name employeeId school department",
//         match: facultyMatch, // ✅ Use the corrected match condition
//       })
//       .populate("student", "name regNo")
//       .lean();

//     console.log(
//       `Found ${requests.length} requests, filtering out null faculty...`
//     );

//     // ✅ ENHANCED: Filter out requests whose faculty is null and add logging
//     const filteredRequests = requests.filter((req, index) => {
//       if (req.faculty === null) {
//         console.log(
//           `Request ${index} has null faculty (filtered out by match condition)`
//         );
//         return false;
//       }
//       return true;
//     });

//     console.log(
//       `After filtering: ${filteredRequests.length} requests with valid faculty`
//     );

//     if (!filteredRequests.length) {
//       return res.status(404).json({
//         success: false,
//         message: `No requests found for the ${facultyType} with specified filters`,
//       });
//     }

//     // Group by faculty
//     const grouped = {};

//     filteredRequests.forEach((req, index) => {
//       // ✅ ENHANCED: Add null checks and error logging
//       if (!req.faculty) {
//         console.error(`Request ${index} has null faculty, skipping...`);
//         return;
//       }

//       if (!req.student) {
//         console.error(`Request ${index} has null student, skipping...`);
//         return;
//       }

//       const faculty = req.faculty;
//       const facultyId = faculty._id.toString();

//       if (!grouped[facultyId]) {
//         grouped[facultyId] = {
//           _id: facultyId,
//           name: faculty.name,
//           empId: faculty.employeeId, // Note: you had empId in original, faculty schema likely uses employeeId
//           school: faculty.school,
//           department: faculty.department,
//           students: [],
//         };
//       }

//       grouped[facultyId].students.push({
//         _id: req._id,
//         name: req.student.name,
//         regNo: req.student.regNo,
//         projectType: req.reviewType,
//         comments: req.reason,
//         approved:
//           req.status === "approved"
//             ? true
//             : req.status === "rejected"
//             ? false
//             : null,
//       });
//     });

//     const result = Object.values(grouped);

//     console.log(`Final result: ${result.length} faculty groups`);

//     return res.status(200).json({
//       success: true,
//       message: "Operation successful",
//       data: result,
//     });
//   } catch (error) {
//     console.error("Error in getAllRequests:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function createPanelManually(req, res) {
//   try {
//     const { memberEmployeeIds, school, department, venue } = req.body; // expecting array of employeeIds, optional school & department

//     // Validate input
//     if (
//       !Array.isArray(memberEmployeeIds) ||
//       memberEmployeeIds.length < 2 ||
//       new Set(memberEmployeeIds).size !== memberEmployeeIds.length
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "At least two distinct faculty employee IDs are required in members.",
//       });
//     }

//     // Fetch faculties by employeeId
//     const faculties = await Faculty.find({
//       employeeId: { $in: memberEmployeeIds },
//     });

//     if (faculties.length !== memberEmployeeIds.length) {
//       const foundEmpIds = faculties.map((f) => f.employeeId.toString());
//       const missing = memberEmployeeIds.filter(
//         (id) => !foundEmpIds.includes(id)
//       );
//       return res.status(404).json({
//         success: false,
//         message: "Some faculty members not found.",
//         missing,
//       });
//     }

//     // Use provided school and department if given, else compute intersection
//     let panelSchool = school;
//     let panelDepartment = department;

//     if (!panelSchool) {
//       const commonSchool = faculties
//         .map((f) => f.school)
//         .reduce((acc, schools) => acc.filter((s) => schools.includes(s)));
//       if (commonSchool.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Faculty members must have at least one common school.",
//         });
//       }
//       panelSchool = commonSchool[0];
//     }

//     if (!panelDepartment) {
//       const commonDepartment = faculties
//         .map((f) => f.department || [])
//         .reduce((acc, depts) => acc.filter((d) => depts.includes(d)));
//       if (commonDepartment.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: "Faculty members must have at least one common department.",
//         });
//       }
//       panelDepartment = commonDepartment[0];
//     }

//     // Create and save panel
//     const panelData = {
//       members: faculties.map((f) => f._id), // ObjectId references to Faculty
//       school: panelSchool,
//       department: panelDepartment,
//       ...(venue ? { venue } : {}),
//     };

//     const panel = new Panel(panelData);
//     await panel.save();

//     return res.status(201).json({
//       success: true,
//       message: "Panel created successfully.",
//       data: panel,
//     });
//   } catch (error) {
//     console.error("Error creating panel:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function autoCreatePanels(req, res) {
//   try {
//     const { departments, school } = req.body;

//     if (!school) {
//       return res.status(400).json({
//         success: false,
//         message: "School must be provided in the request body.",
//       });
//     }

//     // ✅ FIX 1: Get all already assigned faculty IDs from existing panels
//     const existingPanels = await Panel.find({}).populate(
//       "members",
//       "employeeId"
//     );
//     const alreadyAssignedFacultyIds = new Set();

//     existingPanels.forEach((panel) => {
//       panel.members.forEach((faculty) => {
//         if (faculty && faculty.employeeId) {
//           alreadyAssignedFacultyIds.add(faculty.employeeId.toString());
//         }
//       });
//     });

//     console.log(
//       "Already assigned faculty IDs:",
//       Array.from(alreadyAssignedFacultyIds)
//     );

//     const createdPanels = [];
//     const invalidFaculties = {};
//     const facultiesToUpdate = {}; // { empid: Set(depts) }

//     for (const [dept, { panelsNeeded, panelSize, faculties }] of Object.entries(
//       departments
//     )) {
//       // ✅ FIX 2: Filter out already assigned faculties BEFORE processing
//       const availableFaculties = faculties.filter(
//         (empId) => !alreadyAssignedFacultyIds.has(empId.toString())
//       );

//       console.log(
//         `Department ${dept}: Original ${faculties.length}, Available ${availableFaculties.length}`
//       );

//       if (availableFaculties.length === 0) {
//         invalidFaculties[dept] = [
//           "All faculties already assigned to other panels",
//         ];
//         continue;
//       }

//       // 1. Check available faculties exist
//       const foundFaculties = await Faculty.find({
//         employeeId: { $in: availableFaculties },
//       });

//       const foundEmpIds = foundFaculties.map((f) => f.employeeId.toString());
//       const missingEmpIds = availableFaculties.filter(
//         (eid) => !foundEmpIds.includes(eid.toString())
//       );

//       if (missingEmpIds.length > 0) {
//         invalidFaculties[dept] = missingEmpIds;
//         continue;
//       }

//       // 2. Sort by experience (empid ASC)
//       foundFaculties.sort(
//         (a, b) => parseInt(a.employeeId) - parseInt(b.employeeId)
//       );

//       const totalAvailable = foundFaculties.length;
//       const requiredFaculty = panelsNeeded * panelSize;

//       // ✅ FIX 3: Adjust panel count if not enough faculty available
//       let actualPanelsNeeded = panelsNeeded;
//       if (totalAvailable < requiredFaculty) {
//         actualPanelsNeeded = Math.floor(totalAvailable / panelSize);

//         if (actualPanelsNeeded === 0) {
//           invalidFaculties[dept] = [
//             `Not enough available faculties for even 1 panel. Need ${panelSize}, found ${totalAvailable} (excluding already assigned)`,
//           ];
//           continue;
//         }

//         console.log(
//           `Adjusted panels for ${dept}: ${panelsNeeded} → ${actualPanelsNeeded}`
//         );
//       }

//       // 3. Make panels: most/least experienced pairing, never repeat
//       const used = new Set();
//       let facultyPool = [...foundFaculties];

//       for (let i = 0; i < actualPanelsNeeded; i++) {
//         let panelMembers = [];
//         let left = 0,
//           right = facultyPool.length - 1;

//         while (panelMembers.length < panelSize && left <= right) {
//           const leftFaculty = facultyPool[left];
//           const rightFaculty = facultyPool[right];

//           // Add most experienced (left)
//           if (
//             !used.has(leftFaculty.employeeId.toString()) &&
//             panelMembers.length < panelSize
//           ) {
//             panelMembers.push(leftFaculty);
//             used.add(leftFaculty.employeeId.toString());
//             // ✅ FIX 4: Also add to global assigned set to prevent future use
//             alreadyAssignedFacultyIds.add(leftFaculty.employeeId.toString());
//           }

//           // Add least experienced (right) if different from left
//           if (
//             left !== right &&
//             !used.has(rightFaculty.employeeId.toString()) &&
//             panelMembers.length < panelSize
//           ) {
//             panelMembers.push(rightFaculty);
//             used.add(rightFaculty.employeeId.toString());
//             // ✅ FIX 4: Also add to global assigned set
//             alreadyAssignedFacultyIds.add(rightFaculty.employeeId.toString());
//           }

//           left++;
//           right--;
//         }

//         // ✅ FIX 5: Enhanced validation - ensure distinct members
//         const uniqueEmployeeIds = new Set(
//           panelMembers.map((f) => f.employeeId.toString())
//         );

//         if (
//           panelMembers.length !== panelSize ||
//           uniqueEmployeeIds.size !== panelSize
//         ) {
//           console.log(
//             `Skipping incomplete panel for ${dept}: got ${panelMembers.length}/${panelSize} members`
//           );
//           continue;
//         }

//         // Track faculty to update dept later
//         for (const f of panelMembers) {
//           if (!facultiesToUpdate[f.employeeId]) {
//             facultiesToUpdate[f.employeeId] = new Set();
//           }
//           facultiesToUpdate[f.employeeId].add(dept);
//         }

//         // Create and save panel
//         const panel = new Panel({
//           members: panelMembers.map((f) => f._id),
//           department: dept,
//           school: school,
//         });

//         await panel.save();
//         createdPanels.push(panel);

//         console.log(
//           `Created panel for ${dept} with faculty:`,
//           panelMembers.map((f) => f.employeeId)
//         );
//       }
//     }

//     // 4. Update faculty department attribute (adds dept, no duplication)
//     for (const [empid, deptSet] of Object.entries(facultiesToUpdate)) {
//       const doc = await Faculty.findOne({ employeeId: empid });
//       if (doc) {
//         const prevDepartments = Array.isArray(doc.department)
//           ? doc.department
//           : [];
//         const nextDepartments = Array.from(
//           new Set([...prevDepartments, ...deptSet])
//         );
//         doc.department = nextDepartments;
//         await doc.save();
//       }
//     }

//     res.status(200).json({
//       success: Object.keys(invalidFaculties).length === 0,
//       message:
//         Object.keys(invalidFaculties).length === 0
//           ? `Successfully created ${createdPanels.length} panels and updated faculty departments.`
//           : `Created ${
//               createdPanels.length
//             } panels with some errors. Invalid/missing faculties: ${JSON.stringify(
//               invalidFaculties
//             )}`,
//       panelsCreated: createdPanels.length,
//       invalidFaculties:
//         Object.keys(invalidFaculties).length > 0 ? invalidFaculties : undefined,
//       details: createdPanels.map((p) => ({
//         department: p.department,
//         facultyCount: p.members.length,
//         school: p.school,
//       })),
//     });
//   } catch (error) {
//     console.error("Auto create panels error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function deletePanel(req, res) {
//   try {
//     const { panelId } = req.params;

//     const deletedPanel = await Panel.findByIdAndDelete(panelId);

//     if (!deletedPanel) {
//       return res.status(404).json({
//         success: false,
//         message: "No panel found for the provided ID",
//       });
//     }

//     // Remove panel references from projects
//     await Project.updateMany({ panel: panelId }, { $set: { panel: null } });

//     return res.status(200).json({
//       success: true,
//       message:
//         "Panel deleted successfully and removed from associated projects",
//       data: deletedPanel,
//     });
//   } catch (error) {
//     console.error("Error deleting panel:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function getAllPanels(req, res) {
//   try {
//     const { school, department } = req.query;

//     const filter = {};
//     if (school) filter.school = school;
//     if (department) filter.department = department;

//     // ✅ FIXED: Populate 'members' array instead of 'faculty1' and 'faculty2'
//     const panels = await Panel.find(filter)
//       .populate({
//         path: "members",
//         select: "employeeId name emailId school department",
//       })
//       .lean();

//     return res.status(200).json({
//       success: true,
//       message: "Operation Successful",
//       data: panels || [],
//     });
//   } catch (error) {
//     console.error("Error in getAllPanels:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function assignPanelToProject(req, res) {
//   try {
//     const { panelId, projectId } = req.body;

//     // Handle panel removal
//     if (!panelId || panelId === "null") {
//       const updatedProject = await Project.findByIdAndUpdate(
//         projectId,
//         { panel: null },
//         { new: true }
//       );

//       return res.status(200).json({
//         success: true,
//         message: "Panel removed from project successfully",
//         data: updatedProject,
//       });
//     }

//     const panel = await Panel.findById(panelId);
//     if (!panel) {
//       return res.status(404).json({
//         success: false,
//         message: "Panel not found.",
//       });
//     }

//     const project = await Project.findById(projectId);
//     if (!project) {
//       return res.status(404).json({
//         success: false,
//         message: "Project not found.",
//       });
//     }

//     // Optionally validate same school and department
//     // if (
//     //   panel.school !== project.school ||
//     //   panel.department !== project.department
//     // ) {
//     //   return res.status(400).json({
//     //     success: false,
//     //     message: "Panel and project belong to different school or department.",
//     //   });
//     // }

//     const updatedProject = await Project.findByIdAndUpdate(
//       projectId,
//       { panel: panel._id },
//       { new: true }
//     ).populate("panel");

//     return res.status(200).json({
//       success: true,
//       message: "Panel assigned successfully",
//       data: updatedProject,
//     });
//   } catch (error) {
//     console.error("Error assigning panel to project:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function autoAssignPanelsToProjects(req, res) {
//   try {
//     const buffer = Number(req.body.buffer) || 0;
//     const department = req.body.department; // Optional department filter

//     let projectFilter = { panel: null };
//     let panelFilter = {};

//     if (department) {
//       projectFilter.department = department;
//       panelFilter.department = department;
//     }

//     // Populate unassigned projects with guideFaculty
//     const unassignedProjects = await Project.find(projectFilter).populate(
//       "guideFaculty"
//     );

//     // Populate panels with faculty members fully loaded
//     const panels = await Panel.find(panelFilter).populate({
//       path: "members",
//       select: "employeeId name emailId school department specialization",
//     });

//     if (!panels.length) {
//       return res.status(400).json({
//         success: false,
//         message: `No panels available${
//           department ? ` for ${department} department` : ""
//         }`,
//       });
//     }

//     let panelsToAssign;
//     let bufferPanels;
//     let assignmentStats = {};

//     if (department) {
//       if (buffer >= panels.length) {
//         return res.status(400).json({
//           success: false,
//           message: `Buffer (${buffer}) cannot be >= total panels (${panels.length}) for ${department}.`,
//         });
//       }
//       panelsToAssign = panels.slice(0, panels.length - buffer);
//       bufferPanels = panels.slice(panels.length - buffer);
//     } else {
//       const panelsByDept = {};
//       panels.forEach((panel) => {
//         if (!panelsByDept[panel.department]) {
//           panelsByDept[panel.department] = [];
//         }
//         panelsByDept[panel.department].push(panel);
//       });

//       const departments = Object.keys(panelsByDept);
//       if (departments.length === 0) {
//         return res.status(400).json({
//           success: false,
//           message: "No departments found with panels.",
//         });
//       }

//       const bufferPerDept = Math.ceil(buffer / departments.length);
//       panelsToAssign = [];
//       bufferPanels = [];

//       departments.forEach((dept) => {
//         const deptPanels = panelsByDept[dept];
//         const actualBuffer = Math.min(
//           bufferPerDept,
//           Math.max(0, deptPanels.length - 1)
//         );

//         const deptPanelsToAssign = deptPanels.slice(
//           0,
//           deptPanels.length - actualBuffer
//         );
//         const deptBufferPanels = deptPanels.slice(
//           deptPanels.length - actualBuffer
//         );

//         panelsToAssign.push(...deptPanelsToAssign);
//         bufferPanels.push(...deptBufferPanels);

//         assignmentStats[dept] = 0;
//       });
//     }

//     if (!panelsToAssign.length) {
//       return res.status(400).json({
//         success: false,
//         message: "No panels left for assignment after applying buffer.",
//       });
//     }

//     // Helper to extract numeric part sum from employeeId string
//     const sumEmployeeIdNumbers = (employeeId) => {
//       const digits = employeeId.match(/\d+/g);
//       if (!digits) return 0;
//       return digits.reduce((acc, val) => acc + parseInt(val, 10), 0);
//     };

//     // Calculate total employeeId sum for a panel (sum of all member employeeId sums)
//     const calculatePanelScore = (panel) => {
//       return panel.members.reduce(
//         (acc, member) => acc + sumEmployeeIdNumbers(member.employeeId),
//         0
//       );
//     };

//     // Filter panels by department (pre-filter once)
//     const panelsByDeptFiltered = {};
//     panelsToAssign.forEach((panel) => {
//       if (!panelsByDeptFiltered[panel.department]) {
//         panelsByDeptFiltered[panel.department] = [];
//       }
//       panelsByDeptFiltered[panel.department].push(panel);
//     });

//     // Sort panels within each department by sum of employee Ids (ascending order = older faculties first)
//     for (const dept in panelsByDeptFiltered) {
//       panelsByDeptFiltered[dept].sort(
//         (a, b) => calculatePanelScore(a) - calculatePanelScore(b)
//       );
//     }

//     const panelAssignments = {};
//     panelsToAssign.forEach((panel) => {
//       panelAssignments[panel._id.toString()] = [];
//     });

//     let assignedCount = 0;
//     let conflictCount = 0;

//     // Keep track of round robin index per department
//     const roundRobinIndex = {};

//     for (const project of unassignedProjects) {
//       const deptPanels = panelsByDeptFiltered[project.department] || [];

//       // Filter panels that contain at least one member with matching specialization with the project
//       const specializedPanels = deptPanels.filter((panel) =>
//         panel.members.some(
//           (member) =>
//             member.specialization &&
//             member.specialization.includes(project.specialization)
//         )
//       );

//       // Further filter panels that do NOT have the guideFaculty as a member (conflict check)
//       const eligibleSpecializedPanels = specializedPanels.filter((panel) => {
//         const guideId = project.guideFaculty._id.toString();
//         return !panel.members.some(
//           (member) => member._id.toString() === guideId
//         );
//       });

//       let selectedPanel = null;

//       if (eligibleSpecializedPanels.length > 0) {
//         // Initialize round robin index for this department if not done
//         if (!(project.department in roundRobinIndex)) {
//           roundRobinIndex[project.department] = 0;
//         }

//         // Select panel using round robin among eligible panels with matching specialization
//         const panelIdx =
//           roundRobinIndex[project.department] %
//           eligibleSpecializedPanels.length;
//         selectedPanel = eligibleSpecializedPanels[panelIdx];

//         roundRobinIndex[project.department]++;
//       } else {
//         // If no specialized panel is suitable, assign to panel (with members but no guide conflict) in round robin by experience
//         const eligibleFallbackPanels = deptPanels.filter((panel) => {
//           const guideId = project.guideFaculty._id.toString();
//           // Exclude panels having the guide as member
//           return !panel.members.some(
//             (member) => member._id.toString() === guideId
//           );
//         });

//         if (eligibleFallbackPanels.length > 0) {
//           if (!(project.department in roundRobinIndex)) {
//             roundRobinIndex[project.department] = 0;
//           }

//           // Round robin among fallback panels
//           const fallbackPanelIdx =
//             roundRobinIndex[project.department] % eligibleFallbackPanels.length;
//           selectedPanel = eligibleFallbackPanels[fallbackPanelIdx];

//           roundRobinIndex[project.department]++;
//         }
//       }

//       if (selectedPanel) {
//         // Assign project to selected panel
//         project.panel = selectedPanel._id;
//         await project.save();

//         panelAssignments[selectedPanel._id.toString()].push(project._id);
//         assignedCount++;
//         if (!assignmentStats[project.department])
//           assignmentStats[project.department] = 0;
//         assignmentStats[project.department]++;
//       } else {
//         conflictCount++;
//         console.log(
//           `⚠️ No eligible panels for project ${project.name} with guide ${project.guideFaculty.name} in department ${project.department}`
//         );
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `Assigned ${assignedCount} projects with ${
//         department ? "department-specific" : "distributed per-department"
//       } buffer strategy.`,
//       data: {
//         assignments: panelAssignments,
//         bufferPanels: bufferPanels.map((p) => ({
//           id: p._id,
//           department: p.department,
//           members: p.members.map((m) => ({
//             name: m.name,
//             employeeId: m.employeeId,
//           })),
//         })),
//         statistics: {
//           totalProjects: unassignedProjects.length,
//           assignedProjects: assignedCount,
//           conflictedProjects: conflictCount,
//           unassignableProjects: unassignedProjects.length - assignedCount,
//           totalPanelsAvailable: panels.length,
//           panelsUsedForAssignment: panelsToAssign.length,
//           panelsKeptAsBuffer: bufferPanels.length,
//           assignmentPerDepartment: assignmentStats,
//         },
//         mode: department
//           ? `Single Department (${department})`
//           : "All Departments with Distributed Buffer",
//       },
//     });
//   } catch (error) {
//     console.error("Error in autoAssignPanelsToProjects:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error",
//       error: error.message,
//     });
//   }
// }

// export async function createBroadcastMessage(req, res) {
//   try {
//     const {
//       title = "",
//       message,
//       targetSchools,
//       targetDepartments,
//       expiresAt,
//       isActive,
//     } = req.body;

//     if (!message || typeof message !== "string" || !message.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Message content is required.",
//       });
//     }

//     if (targetSchools && !Array.isArray(targetSchools)) {
//       return res.status(400).json({
//         success: false,
//         message: "targetSchools must be an array of strings.",
//       });
//     }

//     if (targetDepartments && !Array.isArray(targetDepartments)) {
//       return res.status(400).json({
//         success: false,
//         message: "targetDepartments must be an array of strings.",
//       });
//     }

//     const admin = await Faculty.findById(req.user.id).select(
//       "_id name employeeId"
//     );

//     if (!admin) {
//       return res.status(404).json({
//         success: false,
//         message: "Admin context not found.",
//       });
//     }

//     const normalizeAudience = (list) => {
//       if (!Array.isArray(list)) return [];
//       const uniqueValues = [...new Set(list.filter(Boolean))];
//       return uniqueValues.map((value) => String(value).trim()).filter(Boolean);
//     };

//     const normalizedSchools = normalizeAudience(targetSchools);
//     const normalizedDepartments = normalizeAudience(targetDepartments);

//     let expiryDate = null;
//     if (expiresAt) {
//       const parsedExpiry = new Date(expiresAt);
//       if (Number.isNaN(parsedExpiry.getTime())) {
//         return res.status(400).json({
//           success: false,
//           message: "expiresAt must be a valid date string.",
//         });
//       }
//       expiryDate = parsedExpiry;
//     }

//     const payload = {
//       title: title?.trim?.() || "",
//       message: message.trim(),
//       targetSchools: normalizedSchools,
//       targetDepartments: normalizedDepartments,
//       createdBy: admin._id,
//       createdByEmployeeId: admin.employeeId,
//       createdByName: admin.name || "",
//       expiresAt: expiryDate,
//     };

//     if (typeof isActive === "boolean") {
//       payload.isActive = isActive;
//     }

//     const broadcast = await BroadcastMessage.create(payload);

//     return res.status(201).json({
//       success: true,
//       message: "Broadcast message sent successfully.",
//       data: broadcast,
//     });
//   } catch (error) {
//     console.error("❌ Error creating broadcast message:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to create broadcast message.",
//       error: error.message,
//     });
//   }
// }

// export async function getBroadcastMessages(req, res) {
//   try {
//     const {
//       limit = 25,
//       skip = 0,
//       includeExpired = "false",
//       activeOnly = "false",
//     } = req.query;

//     const parsedLimit = Math.min(Number(limit) || 25, 100);
//     const parsedSkip = Number(skip) || 0;
//     const now = new Date();

//     const filters = {};

//     if (activeOnly === "true") {
//       filters.isActive = true;
//     }

//     if (includeExpired !== "true") {
//       filters.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
//     }

//     const broadcasts = await BroadcastMessage.find(filters)
//       .sort({ createdAt: -1 })
//       .skip(parsedSkip)
//       .limit(parsedLimit)
//       .lean();

//     const total = await BroadcastMessage.countDocuments(filters);

//     return res.status(200).json({
//       success: true,
//       data: broadcasts,
//       meta: {
//         count: broadcasts.length,
//         total,
//         limit: parsedLimit,
//         skip: parsedSkip,
//       },
//     });
//   } catch (error) {
//     console.error("❌ Error fetching broadcast messages:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to fetch broadcast messages.",
//       error: error.message,
//     });
//   }
// }