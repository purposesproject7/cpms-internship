import mongoose from "mongoose";

const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    weight: { type: Number, required: true },
  },
  { _id: false }
);

const deadlineSchema = new mongoose.Schema(
  {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
  },
  { _id: false }
);

const reviewSchema = new mongoose.Schema(
  {
    reviewName: { type: String, required: true },
    displayName: { type: String },
    facultyType: { type: String, enum: ["guide", "panel"], required: true },
    components: [componentSchema],
    deadline: { type: deadlineSchema, required: true },
  },
  { _id: false }
);

const markingSchema = new mongoose.Schema({
  school: { type: String, required: true },
  department: { type: String, required: true },
  reviews: [reviewSchema],
  requiresContribution: { type: Boolean, default: false },
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
      message: 'internshipType can only have values other than "none" when department is "internship"'
    }
  }, 
});

markingSchema.index({ school: 1, department: 1 }, { unique: true });

const MarkingSchemaModel = mongoose.model("MarkingSchema", markingSchema);
export default MarkingSchemaModel;
