import mongoose from "mongoose";

const studentSchema = new mongoose.Schema({
  regNo: { 
    type: String, 
    required: true, 
    unique: true 
  },
  name: { 
    type: String, 
    required: true 
  },
  emailId: { 
    type: String, 
    required: true 
  },
  reviews: { 
    type: Map, 
    of: Object 
  },
  deadline: { 
    type: Map, 
    of: Object 
  },
  PAT: { 
    type: Boolean, 
    default: false 
  },
  school: { 
    type: String, 
    required: true 
  },
  department: { 
    type: String, 
    required: true 
  },
  requiresContribution: { 
    type: Boolean, 
    default: false 
  },
  contributionType: { 
    type: String, 
    enum: ["none", "Patent Filed", "Journal Publication", "Book Chapter Contribution"], 
    default: "none" 
  },
  internshipType: { 
    type: String, 
    enum: ["none", "Cdc approved", "Technology learnt", "SRIP", "Centre"], 
    default: "none",
    validate: {
      validator: function(value) {
        if (this.department !== "Internship" && value !== "none") {
          return false;
        }
        return true;
      },
      message: 'internshipType can only have values other than "none" when department is "Internship"'
    }
  },
}, {
  timestamps: true // Optional: adds createdAt and updatedAt
});

// Index for faster queries
studentSchema.index({ regNo: 1 });
studentSchema.index({ school: 1, department: 1 });

const Student = mongoose.model("Student", studentSchema);

export default Student;
