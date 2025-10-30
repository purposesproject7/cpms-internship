// PopupReview.jsx
import React, { useState, useEffect } from "react";
import { X, Award, Star, Clock, Calendar, AlertTriangle } from "lucide-react";

const PopupReview = ({
  title,
  teamMembers,
  reviewType = "review0",
  isOpen,
  locked = false,
  onClose,
  onSubmit,
  onRequestEdit,
  requestEditVisible = false,
  requestPending = false,
  requiresPPT = false,
  markingSchema = null,
  requestStatus = "none",
  panelMode = false,
  currentBestProject = false,
  teamId = null,
  isGuideReview = false,
  isPanelReview = false,
}) => {
  const [marks, setMarks] = useState({});
  const [comments, setComments] = useState({});
  const [attendance, setAttendance] = useState({});
  const [teamPptApproved, setTeamPptApproved] = useState(false);
  const [bestProject, setBestProject] = useState(false);
  const [componentLabels, setComponentLabels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasAttendance, setHasAttendance] = useState(true);
  const [sub, setSub] = useState("Locked");
  const [patStates, setPatStates] = useState({});

  // Contribution requirement
  const [requiresContribution, setRequiresContribution] = useState(false);
  const [contributions, setContributions] = useState({});

  // Internship type
  const [internshipTypes, setInternshipTypes] = useState({});
  const [showInternshipSelect, setShowInternshipSelect] = useState(false);

  const [deadlineInfo, setDeadlineInfo] = useState({
    hasDeadline: false,
    fromDate: null,
    toDate: null,
    isBeforeStart: false,
    isAfterEnd: false,
    timeUntilStart: "",
    timeUntilEnd: "",
  });

  const isGuideViewingPanel = !panelMode && isPanelReview;
  const showOnlyPPTApproval = isGuideViewingPanel;
  const isFormLocked = locked && requestStatus !== "approved";
  const isDeadlineLocked =
    (deadlineInfo.isBeforeStart || deadlineInfo.isAfterEnd) && requestStatus !== "approved";
  const finalFormLocked = isFormLocked || isDeadlineLocked;

  // PPT approval shown for ALL departments if requiresPPT is true
  const showPPTSection = requiresPPT;

  const calculateDeadlineStatus = (reviewConfig) => {
    if (!reviewConfig?.deadline) {
      return {
        hasDeadline: false,
        fromDate: null,
        toDate: null,
        isBeforeStart: false,
        isAfterEnd: false,
        timeUntilStart: "",
        timeUntilEnd: "",
      };
    }

    const now = new Date();
    const currentIST = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const deadline = reviewConfig.deadline;
    let fromDate = null;
    let toDate = null;

    try {
      if (deadline.from && deadline.to) {
        fromDate = new Date(deadline.from);
        toDate = new Date(deadline.to);
      } else if (typeof deadline === "string" || deadline instanceof Date) {
        toDate = new Date(deadline);
        fromDate = new Date(0);
      }

      const fromIST = fromDate
        ? new Date(fromDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
        : null;
      const toIST = toDate
        ? new Date(toDate.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }))
        : null;

      const isBeforeStart = fromIST && currentIST < fromIST;
      const isAfterEnd = toIST && currentIST > toIST;
      const timeUntilStart = isBeforeStart ? getTimeDifference(currentIST, fromIST) : "";
      const timeUntilEnd = !isAfterEnd && toIST ? getTimeDifference(currentIST, toIST) : "";

      return {
        hasDeadline: !!(fromDate || toDate),
        fromDate: fromIST,
        toDate: toIST,
        isBeforeStart,
        isAfterEnd,
        timeUntilStart,
        timeUntilEnd,
      };
    } catch (error) {
      console.error("Error calculating deadline status:", error);
      return {
        hasDeadline: false,
        fromDate: null,
        toDate: null,
        isBeforeStart: false,
        isAfterEnd: false,
        timeUntilStart: "",
        timeUntilEnd: "",
      };
    }
  };

  const getTimeDifference = (from, to) => {
    const diffMs = to - from;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? "s" : ""} ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ${diffMinutes} minute${diffMinutes > 1 ? "s" : ""}`;
    } else {
      return `${Math.max(0, diffMinutes)} minute${diffMinutes > 1 ? "s" : ""}`;
    }
  };

  // Load schema and initialize components
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    try {
      console.log("=== [PopupReview] LOADING MARKING SCHEMA WITH DEADLINE CHECK ===");
      console.log("Review type:", reviewType);
      console.log("Panel mode:", panelMode);
      console.log("Show only PPT:", showOnlyPPTApproval);
      console.log("Marking schema:", markingSchema);

      let components = [];
      let hasValidSchema = false;
      let reviewConfig = null;

      if (markingSchema?.reviews) {
        reviewConfig = markingSchema.reviews.find((review) => review.reviewName === reviewType);
        console.log(`Found review config for ${reviewType}:`, reviewConfig);

        if (reviewConfig?.components?.length > 0) {
          hasValidSchema = true;
          components = reviewConfig.components.map((comp, index) => ({
            key: `component${index + 1}`,
            label: comp.name,
            name: comp.name,
            points: comp.weight || 10,
          }));
          console.log("Processed components:", components);
        }

        setRequiresContribution(reviewConfig?.requiresContribution || false);
        setShowInternshipSelect(markingSchema?.department === "Internship");
        console.log(`Department: ${markingSchema?.department} → showInternshipSelect = ${markingSchema?.department === "Internship"}`);
      }

      const deadlineStatus = showOnlyPPTApproval
        ? {
            hasDeadline: false,
            fromDate: null,
            toDate: null,
            isBeforeStart: false,
            isAfterEnd: false,
            timeUntilStart: "",
            timeUntilEnd: "",
          }
        : calculateDeadlineStatus(reviewConfig);

      console.log("Deadline status:", deadlineStatus);
      setDeadlineInfo(deadlineStatus);

      if (!hasValidSchema && !showOnlyPPTApproval) {
        console.warn("No valid schema found");
        setError("No marking components found for this review type");
        components = [];
      }

      setComponentLabels(showOnlyPPTApproval ? [] : components);
      setHasAttendance(showOnlyPPTApproval ? false : components.length > 0);
      console.log("Schema loading completed");
    } catch (err) {
      console.error("Error loading schema:", err);
      setComponentLabels([]);
      setHasAttendance(false);
      setError("Schema loading error");
    } finally {
      setLoading(false);
    }
  }, [
    isOpen,
    reviewType,
    markingSchema,
    requestStatus,
    finalFormLocked,
    panelMode,
    showOnlyPPTApproval,
  ]);

  // Initialize form data from existing reviews
useEffect(() => {
  if (!isOpen || loading) return;

  console.log("Initializing form data...");
  console.log("Team members:", teamMembers.length);

  const initialMarks = {};
  const initialComments = {};
  const initialAttendance = {};
  const initialPatStates = {};
  const initialContributions = {};
  const initialInternshipTypes = {};

  teamMembers.forEach((member) => {
    console.log(`Processing member: ${member.name}`);
    let reviewData = null;
    if (member.reviews?.get) {
      reviewData = member.reviews.get(reviewType);
    } else if (member.reviews?.[reviewType]) {
      reviewData = member.reviews[reviewType];
    }
    console.log(`Review data for ${member.name}:`, reviewData);

    if (!showOnlyPPTApproval) {
      const componentMarks = {};
      componentLabels.forEach((comp) => {
        let markValue = "";
        if (reviewData?.marks) {
          markValue = reviewData.marks[comp.name] || "";
        }
        componentMarks[comp.key] = markValue || "";
      });
      initialMarks[member._id] = componentMarks;
      initialComments[member._id] = reviewData?.comments || "";
      if (hasAttendance) {
        initialAttendance[member._id] = reviewData?.attendance?.value ?? false;
      }

      initialContributions[member._id] = reviewData?.contribution || "0";
      
      // ✅ CRITICAL FIX: Get from member (student level), NOT from reviewData
      const existingInternship = member.internshipType || "none";
      initialInternshipTypes[member._id] = existingInternship;
      console.log(`🏢 [PopupReview] Loaded internshipType for ${member.name} (ID: ${member._id}): "${existingInternship}"`);
    }

    const patStatus = member.PAT === true || member.PAT === "true" || member.PAT === 1;
    initialPatStates[member._id] = patStatus;
  });

  console.log('📊 [PopupReview] All initial data loaded:');
  console.log('  - Internship Types:', initialInternshipTypes);

  setMarks(initialMarks);
  setComments(initialComments);
  if (hasAttendance) setAttendance(initialAttendance);
  setPatStates(initialPatStates);
  setContributions(initialContributions);
  setInternshipTypes(initialInternshipTypes);  // ✅ Make sure this is called
  setBestProject(currentBestProject || false);


    if (showOnlyPPTApproval) {
      setSub("Unlocked");
    } else {
      const allCommentsFilled = teamMembers.every((m) => initialComments[m._id]?.trim() !== "");
      const allContributionsFilled = !requiresContribution
        ? true
        : teamMembers.every((m) => contributions[m._id] !== undefined && contributions[m._id] !== "");
      const allInternshipFilled = !showInternshipSelect
        ? true
        : teamMembers.every((m) => initialInternshipTypes[m._id] && initialInternshipTypes[m._id] !== "");

      const isSubReady = allCommentsFilled && allContributionsFilled && allInternshipFilled;
      setSub(isSubReady ? "Unlocked" : "Locked");
    }

    // PPT approval init – for ALL departments if requiresPPT
    if (showPPTSection) {
      let pptAlreadyApproved = false;
      if (teamMembers.length > 0) {
        const pptApprovals = teamMembers.map((member) => {
          let reviewData = null;
          if (member.reviews?.get) reviewData = member.reviews.get(reviewType);
          else if (member.reviews?.[reviewType]) reviewData = member.reviews[reviewType];
          if (reviewData?.pptApproved) return Boolean(reviewData.pptApproved.approved);
          if (member.pptApproved) return Boolean(member.pptApproved.approved);
          return false;
        });
        pptAlreadyApproved = pptApprovals.length > 0 && pptApprovals.every((a) => a === true);
      }
      setTeamPptApproved(pptAlreadyApproved);
    } else {
      setTeamPptApproved(false);
    }

    console.log("Form data initialization completed");
  }, [
    isOpen,
    teamMembers,
    reviewType,
    loading,
    componentLabels,
    hasAttendance,
    requiresPPT,
    currentBestProject,
    showOnlyPPTApproval,
    requiresContribution,
    showInternshipSelect,
    showPPTSection,
  ]);

  const handleMarksChange = (memberId, value, componentKey) => {
    if (finalFormLocked || showOnlyPPTApproval) return;
    if (hasAttendance && attendance[memberId] === false) return;
    if (patStates[memberId]) return;

    const componentInfo = componentLabels.find((comp) => comp.key === componentKey);
    const maxPoints = componentInfo?.points || 10;
    const numValue = Number(value);

    if (numValue > maxPoints) {
      alert(`Enter value less than ${maxPoints}, resetting to ${maxPoints}`);
      setMarks((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], [componentKey]: maxPoints },
      }));
    } else if (numValue < 0) {
      setMarks((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], [componentKey]: 0 },
      }));
    } else {
      setMarks((prev) => ({
        ...prev,
        [memberId]: { ...prev[memberId], [componentKey]: numValue },
      }));
    }
  };

  const handleAttendanceChange = (memberId, isPresent) => {
    if (finalFormLocked || showOnlyPPTApproval) return;
    setAttendance((prev) => ({ ...prev, [memberId]: isPresent }));
    if (!isPresent) {
      const zeroedMarks = {};
      componentLabels.forEach((comp) => {
        zeroedMarks[comp.key] = 0;
      });
      setMarks((prev) => ({ ...prev, [memberId]: zeroedMarks }));
    }
    updateSubmitStatus();
  };

  const handleCommentsChange = (memberId, value) => {
    if (finalFormLocked || showOnlyPPTApproval) return;
    setComments((prev) => ({ ...prev, [memberId]: value }));
    updateSubmitStatus();
  };

  const handleContributionChange = (memberId, value) => {
    if (finalFormLocked || showOnlyPPTApproval) return;
    setContributions((prev) => ({ ...prev, [memberId]: value }));
    updateSubmitStatus();
  };

  const handleInternshipTypeChange = (memberId, value) => {
    if (finalFormLocked || showOnlyPPTApproval) return;
    setInternshipTypes((prev) => ({ ...prev, [memberId]: value }));
    updateSubmitStatus();
  };

  const updateSubmitStatus = () => {
    const allCommentsFilled = teamMembers.every((m) => comments[m._id]?.trim() !== "");
    const allContributionsFilled = !requiresContribution
      ? true
      : teamMembers.every((m) => contributions[m._id] !== undefined && contributions[m._id] !== "");
    const allInternshipFilled = !showInternshipSelect
      ? true
      : teamMembers.every((m) => internshipTypes[m._id] && internshipTypes[m._id] !== "");

    setSub(allCommentsFilled && allContributionsFilled && allInternshipFilled ? "Unlocked" : "Locked");
  };

  const handlePatToggle = (memberId, isPat) => {
    if (finalFormLocked || panelMode || showOnlyPPTApproval) return;
    setPatStates((prev) => ({ ...prev, [memberId]: isPat }));
    if (isPat) {
      const patMarks = {};
      componentLabels.forEach((comp) => {
        patMarks[comp.key] = "PAT";
      });
      setMarks((prev) => ({ ...prev, [memberId]: patMarks }));
    } else {
      const resetMarks = {};
      componentLabels.forEach((comp) => {
        resetMarks[comp.key] = 0;
      });
      setMarks((prev) => ({ ...prev, [memberId]: resetMarks }));
    }
  };

  const handleSubmit = () => {
    if (finalFormLocked || (sub === "Locked" && !showOnlyPPTApproval)) return;

    console.log("Starting submission...");
    const submission = {};
    const patUpdates = {};

    if (!showOnlyPPTApproval) {
      teamMembers.forEach((member) => {
        const memberMarks = marks[member._id] || {};
        const submissionData = {
          comments: comments[member._id] || "",
          ...(requiresContribution && { contribution: contributions[member._id] || "0" }),
          ...(showInternshipSelect && {
            internshipType: internshipTypes[member._id] ?? "none",
          }),
        };

        componentLabels.forEach((comp) => {
          const markValue = memberMarks[comp.key];
          submissionData[comp.name] = patStates[member._id] ? -1 : Number(markValue) || 0;
        });

        if (hasAttendance) {
          submissionData.attendance = {
            value: attendance[member._id] || false,
            locked: false,
          };
        }

        submission[member.regNo] = submissionData;

        if (!panelMode) {
          patUpdates[member.regNo] = patStates[member._id] || false;
        }
      });
    }

    if (showOnlyPPTApproval) {
      const teamPptObj = showPPTSection
        ? { pptApproved: { approved: teamPptApproved, locked: false } }
        : null;
      onSubmit({}, teamPptObj, {});
    } else if (showPPTSection && panelMode) {
      const teamPptObj = { pptApproved: { approved: teamPptApproved, locked: false } };
      onSubmit(submission, teamPptObj, { bestProject });
    } else if (panelMode) {
      onSubmit(submission, null, { bestProject });
    } else if (showPPTSection) {
      const teamPptObj = { pptApproved: { approved: teamPptApproved, locked: false } };
      onSubmit(submission, teamPptObj, patUpdates);
    } else {
      onSubmit(submission, null, patUpdates);
    }
  };

  let guidePPTApprovals = [];
  let allGuidePPTApproved = true;
  if (panelMode && showPPTSection) {
    guidePPTApprovals = teamMembers.map((member) => {
      let reviewData = null;
      if (member.reviews?.get) reviewData = member.reviews.get(reviewType);
      else if (member.reviews?.[reviewType]) reviewData = member.reviews[reviewType];
      if (reviewData?.pptApproved) return Boolean(reviewData.pptApproved.approved);
      if (member.pptApproved) return Boolean(member.pptApproved.approved);
      return false;
    });
    allGuidePPTApproved = guidePPTApprovals.length > 0 && guidePPTApprovals.every((a) => a === true);
  }

  if (!isOpen) return null;
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 shadow-2xl">
          <div className="flex items-center justify-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-lg text-gray-700">Loading marking schema...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[95vh] flex flex-col border-2 border-blue-100">
        {error && (
          <div className="absolute inset-0 bg-white bg-opacity-95 z-50 flex flex-col items-center justify-center p-10">
            <div className="max-w-lg w-full bg-red-100 border-2 border-red-500 rounded-2xl shadow-2xl p-8 flex flex-col items-center">
              <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
              <h2 className="text-2xl font-bold text-red-700 mb-2">Review Error</h2>
              <p className="text-red-800 mb-6 text-center">{error}</p>
              <button
                onClick={onClose}
                className="mt-2 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-700 text-white font-semibold text-base shadow"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {panelMode && showPPTSection && !allGuidePPTApproved && (
          <div className="absolute inset-0 bg-white bg-opacity-95 z-50 flex flex-col items-center justify-center p-8">
            <div className="max-w-xl w-full bg-red-100 border-2 border-red-500 rounded-2xl shadow-2xl p-8 flex flex-col items-center">
              <AlertTriangle className="w-16 h-16 text-red-600 mb-4" />
              <h2 className="text-2xl font-bold text-red-700 mb-2">Panel Review Blocked</h2>
              <p className="text-red-800 mb-4 text-center">
                This panel review requires the project <b>guide</b> to approve the team's <b>PPT</b> before you can proceed.
              </p>
              <div className="bg-white w-full rounded-xl p-4 mb-4 flex flex-col gap-2 border shadow">
                <div className="font-medium text-gray-700 mb-2">Current Status:</div>
                {teamMembers.map((member, idx) => (
                  <div key={member._id} className="flex items-center justify-between">
                    <span className="text-red-700">{member.name} ({member.regNo})</span>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-bold ${
                        guidePPTApprovals[idx]
                          ? "bg-green-100 text-green-700"
                          : "bg-red-200 text-red-800"
                      }`}
                    >
                      {guidePPTApprovals[idx] ? "Guide Approved" : "Pending Guide Approval"}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-3 rounded-xl bg-red-500 hover:bg-red-700 text-white font-semibold text-base shadow"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-600 to-purple-600 text-white p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <Award className="w-7 h-7" />
                <h2 className="text-2xl font-bold">{title}</h2>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-sm text-white/90">
                <span className="bg-white/20 px-3 py-1 rounded-full">
                  {showOnlyPPTApproval ? "PPT Approval Only" : `${componentLabels.length} components`}
                </span>
                <span className="bg-white/20 px-3 py-1 rounded-full">{teamMembers.length} students</span>
                {showPPTSection && (
                  <span className="bg-yellow-400/30 px-3 py-1 rounded-full">PPT Required</span>
                )}
                {requiresContribution && (
                  <span className="bg-green-400/30 px-3 py-1 rounded-full">Contribution Required</span>
                )}
                {showInternshipSelect && (
                  <span className="bg-indigo-400/30 px-3 py-1 rounded-full">Internship Type Required</span>
                )}
                {panelMode && <span className="bg-purple-400/30 px-3 py-1 rounded-full">Panel Review</span>}
                {showOnlyPPTApproval && (
                  <span className="bg-green-400/30 px-3 py-1 rounded-full">Guide View</span>
                )}
                {panelMode && bestProject && (
                  <span className="bg-yellow-500/30 px-3 py-1 rounded-full">Best Project</span>
                )}
                {requestStatus === "approved" && (
                  <span className="bg-green-400/30 px-3 py-1 rounded-full">Extension Approved</span>
                )}
                {deadlineInfo.isBeforeStart && (
                  <span className="bg-orange-400/30 px-3 py-1 rounded-full">Not Yet Open</span>
                )}
                {deadlineInfo.isAfterEnd && (
                  <span className="bg-red-400/30 px-3 py-1 rounded-full">Deadline Passed</span>
                )}
                {finalFormLocked && <span className="bg-red-400/30 px-3 py-1 rounded-full">Locked</span>}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <X size={28} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
          {!showOnlyPPTApproval && deadlineInfo.hasDeadline && (
            <div
              className={`mb-6 p-4 rounded-xl border-2 ${
                deadlineInfo.isBeforeStart
                  ? "bg-orange-50 border-orange-200"
                  : deadlineInfo.isAfterEnd
                  ? "bg-red-50 border-red-200"
                  : "bg-green-50 border-green-200"
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  {deadlineInfo.isBeforeStart ? (
                    <Clock className="w-6 h-6 text-orange-600" />
                  ) : deadlineInfo.isAfterEnd ? (
                    <Calendar className="w-6 h-6 text-red-600" />
                  ) : (
                    <Calendar className="w-6 h-6 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3
                    className={`font-bold text-lg ${
                      deadlineInfo.isBeforeStart
                        ? "text-orange-800"
                        : deadlineInfo.isAfterEnd
                        ? "text-red-800"
                        : "text-green-800"
                    }`}
                  >
                    {deadlineInfo.isBeforeStart
                      ? "Review Not Yet Open"
                      : deadlineInfo.isAfterEnd
                      ? "Review Deadline Has Passed"
                      : "Review Is Currently Open"}
                  </h3>
                  <div className="mt-2 space-y-1 text-sm">
                    {deadlineInfo.fromDate && (
                      <p
                        className={
                          deadlineInfo.isBeforeStart
                            ? "text-orange-700"
                            : deadlineInfo.isAfterEnd
                            ? "text-red-700"
                            : "text-green-700"
                        }
                      >
                        <strong>Opens:</strong>{" "}
                        {deadlineInfo.fromDate.toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "full",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {deadlineInfo.toDate && (
                      <p
                        className={
                          deadlineInfo.isBeforeStart
                            ? "text-orange-700"
                            : deadlineInfo.isAfterEnd
                            ? "text-red-700"
                            : "text-green-700"
                        }
                      >
                        <strong>Closes:</strong>{" "}
                        {deadlineInfo.toDate.toLocaleString("en-IN", {
                          timeZone: "Asia/Kolkata",
                          dateStyle: "full",
                          timeStyle: "short",
                        })}
                      </p>
                    )}
                    {deadlineInfo.timeUntilStart && (
                      <p className="text-orange-600 font-medium">
                        Opens in: {deadlineInfo.timeUntilStart}
                      </p>
                    )}
                    {deadlineInfo.timeUntilEnd && !deadlineInfo.isAfterEnd && (
                      <p className="text-green-600 font-medium">
                        Closes in: {deadlineInfo.timeUntilEnd}
                      </p>
                    )}
                  </div>
                  {requestStatus === "approved" &&
                    (deadlineInfo.isBeforeStart || deadlineInfo.isAfterEnd) && (
                      <div className="mt-3 p-2 bg-green-100 border border-green-300 rounded">
                        <p className="text-green-800 font-medium text-sm">
                          Extension Approved - You can still submit this review
                        </p>
                      </div>
                    )}
                </div>
              </div>
            </div>
          )}

          {panelMode && !showOnlyPPTApproval && (
            <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-200 rounded-xl">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bestProject}
                  onChange={(e) => setBestProject(e.target.checked)}
                  disabled={finalFormLocked}
                  className="w-5 h-5 text-yellow-600 bg-yellow-50 border-yellow-300 rounded focus:ring-2 focus:ring-yellow-500"
                />
                <Star className="w-5 h-5 text-yellow-600" />
                <div>
                  <span className="font-bold text-yellow-800 text-lg">Mark as Best Project</span>
                  <p className="text-sm text-yellow-700 mt-1">
                    Select this if you consider this project to be among the best
                  </p>
                </div>
              </label>
            </div>
          )}

          {(showPPTSection || requiresContribution || showInternshipSelect) && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                  <span>Team Review Requirements</span>
                </h3>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  Schema Required
                </span>
              </div>

              {showPPTSection && (
                <label className="flex items-center space-x-3 mb-3">
                  <input
                    type="checkbox"
                    checked={teamPptApproved}
                    onChange={(e) => setTeamPptApproved(e.target.checked)}
                    disabled={finalFormLocked}
                    className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="font-semibold text-blue-800">Approve Team PPT for this review</span>
                </label>
              )}

              {requiresContribution && (
                <div>
                  <h4 className="font-semibold text-blue-800 mb-2">Contribution Assessment</h4>
                  {teamMembers.map((member) => (
                    <div key={member._id} className="mb-2">
                      <label className="flex items-center space-x-3">
                        <select
                          value={contributions[member._id] || ""}
                          onChange={(e) => handleContributionChange(member._id, e.target.value)}
                          disabled={finalFormLocked}
                          className={`px-3 py-1 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 ${
                            finalFormLocked ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                        >
                          <option value="">Select Contribution</option>
                          <option value="Book_Chapter_Contribution">Book Chapter Contribution</option>
                          <option value="Patent_filing">Patent Filing</option>
                          <option value="Journal_Publication">Journal Publication</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {showInternshipSelect && !showOnlyPPTApproval && (
                <div className="mt-3">
                  <h4 className="font-semibold text-blue-800 mb-2">Internship Type</h4>
                  {teamMembers.map((member) => (
                    <div key={member._id} className="mb-2">
                      <label className="flex items-center space-x-3">
                        <select
                          value={internshipTypes[member._id] ?? "none"}
                          onChange={(e) => handleInternshipTypeChange(member._id, e.target.value)}
                          disabled={finalFormLocked}
                          className={`px-3 py-1 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 ${
                            finalFormLocked ? "bg-gray-100 cursor-not-allowed" : ""
                          }`}
                        >
                          <option value="none">None</option>
                          <option value="Cdc approved">CDC Approved</option>
                          <option value="Technology learnt">Technology Learnt</option>
                          <option value="SRIP">SRIP</option>
                          <option value="Centre">Centre</option>
                        </select>
                      </label>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-sm text-blue-600 mt-2">
                {showPPTSection && requiresContribution && showInternshipSelect
                  ? "This review requires PPT approval, contribution, and internship type."
                  : showPPTSection && requiresContribution
                  ? "This review requires PPT approval and contribution."
                  : showPPTSection && showInternshipSelect
                  ? "This review requires PPT approval and internship type."
                  : requiresContribution && showInternshipSelect
                  ? "This review requires contribution and internship type."
                  : showPPTSection
                  ? "This review requires PPT approval."
                  : requiresContribution
                  ? "This review requires contribution assessment."
                  : "This review requires internship type selection."}
              </p>
            </div>
          )}

          {showOnlyPPTApproval && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
              <h3 className="text-lg font-bold text-blue-800 mb-4">Panel Review - PPT Approval Only</h3>
              <p className="text-blue-600 mb-4">
                As a guide, you can only approve/disapprove the PPT for this panel review.
              </p>
              {showPPTSection ? (
                <div className="mb-6 p-4 bg-white border border-blue-200 rounded-xl">
                  <div className="flex items-center justify-center space-x-3 mb-3">
                    <span className="text-2xl">PPT</span>
                    <span className="font-semibold text-blue-800 text-lg">PPT Approval Required</span>
                  </div>
                  <label className="flex items-center justify-center space-x-3">
                    <input
                      type="checkbox"
                      checked={teamPptApproved}
                      onChange={(e) => setTeamPptApproved(e.target.checked)}
                      disabled={finalFormLocked}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-blue-800 text-lg">Approve Team PPT</span>
                  </label>
                </div>
              ) : (
                <div className="text-gray-500 italic p-4 bg-gray-50 rounded-xl">
                  <span className="text-4xl mb-2 block">Info</span>
                  This panel review does not require PPT approval.
                  <br />
                  <span className="text-sm mt-2 block">No action needed from guide side.</span>
                </div>
              )}
            </div>
          )}

          {!showOnlyPPTApproval && (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {teamMembers.map((member) => (
                <div
                  key={member._id}
                  className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4 pb-3 border-b border-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-bold text-lg text-gray-800">{member.name}</h3>
                        {patStates[member._id] && (
                          <div className="bg-red-100 border border-red-300 px-2 py-1 rounded-lg">
                            <span className="text-red-800 text-xs font-bold">PAT</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{member.regNo}</p>
                      {!panelMode && (
                        <div className="mt-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={patStates[member._id] || false}
                              onChange={(e) => handlePatToggle(member._id, e.target.checked)}
                              disabled={finalFormLocked}
                              className="w-4 h-4 text-red-600 bg-red-50 border-red-300 rounded focus:ring-2 focus:ring-red-500"
                            />
                            <span className="text-sm font-medium text-red-700">PAT Detected</span>
                          </label>
                        </div>
                      )}
                    </div>
                    {hasAttendance && (
                      <div className="ml-3">
                        <select
                          value={attendance[member._id] ? "present" : "absent"}
                          onChange={(e) =>
                            handleAttendanceChange(member._id, e.target.value === "present")
                          }
                          disabled={finalFormLocked}
                          className={`px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 ${
                            attendance[member._id]
                              ? "bg-green-50 border-green-300 text-green-800"
                              : "bg-red-50 border-red-300 text-red-800"
                          } ${finalFormLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 mb-4">
                    {componentLabels.map((comp) => (
                      <div key={comp.key} className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 flex-1 mr-3">
                          {comp.label}
                        </label>
                        <div className="flex items-center space-x-2">
                          <input
                            type={patStates[member._id] ? "text" : "number"}
                            min="0"
                            max={comp.points}
                            value={
                              patStates[member._id]
                                ? "PAT"
                                : marks[member._id]?.[comp.key] ?? ""
                            }
                            onChange={(e) =>
                              !patStates[member._id] &&
                              handleMarksChange(member._id, e.target.value, comp.key)
                            }
                            onWheel={(e) => e.target.blur()}
                            disabled={
                              finalFormLocked ||
                              (hasAttendance && attendance[member._id] === false) ||
                              patStates[member._id]
                            }
                            readOnly={patStates[member._id]}
                            placeholder={patStates[member._id] ? "PAT" : "0"}
                            className={`w-16 px-2 py-1 border rounded text-center text-sm focus:ring-2 focus:ring-blue-500 ${
                              finalFormLocked ||
                              (hasAttendance && attendance[member._id] === false)
                                ? "bg-gray-100 cursor-not-allowed"
                                : ""
                            } ${patStates[member._id] ? "text-red-600 font-bold" : ""}`}
                          />
                          <span className="text-xs text-gray-500 min-w-fit">/{comp.points}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <textarea
                    value={comments[member._id] || ""}
                    onChange={(e) => handleCommentsChange(member._id, e.target.value)}
                    disabled={finalFormLocked}
                    required
                    className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 ${
                      finalFormLocked ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    rows="3"
                    placeholder={finalFormLocked ? "Comments locked" : "Add comments..."}
                  />

                  {showInternshipSelect && !showOnlyPPTApproval && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Internship Type
                      </label>
                      <select
                        value={internshipTypes[member._id] ?? "none"}
                        onChange={(e) => handleInternshipTypeChange(member._id, e.target.value)}
                        disabled={finalFormLocked}
                        className={`w-full px-3 py-2 border rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 ${
                          finalFormLocked ? "bg-gray-100 cursor-not-allowed" : ""
                        }`}
                      >
                        <option value="none">None</option>
                        <option value="Cdc approved">CDC Approved</option>
                        <option value="Technology learnt">Technology Learnt</option>
                        <option value="SRIP">SRIP</option>
                        <option value="Centre">Centre</option>
                      </select>
                      <p className="mt-1 text-xs text-gray-500">
                        Select the type of internship this student completed.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border-t border-gray-200 px-6 py-4 flex justify-between items-center rounded-b-2xl">
          <div className="flex space-x-3">
            {requestEditVisible && !requestPending && !showOnlyPPTApproval && (
              <button
                onClick={onRequestEdit}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors"
              >
                Request Edit
              </button>
            )}
            {requestPending && (
              <span className="px-4 py-2 bg-gray-200 text-gray-600 rounded-lg text-sm">
                Request Pending...
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                finalFormLocked ||
                (sub === "Locked" && !showOnlyPPTApproval) ||
                (showOnlyPPTApproval && !showPPTSection)
              }
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                finalFormLocked ||
                (sub === "Locked" && !showOnlyPPTApproval) ||
                (showOnlyPPTApproval && !showPPTSection)
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : panelMode && bestProject
                  ? "bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {deadlineInfo.isBeforeStart && requestStatus !== "approved" && !showOnlyPPTApproval
                ? "Not Yet Open"
                : deadlineInfo.isAfterEnd && requestStatus !== "approved" && !showOnlyPPTApproval
                ? "Deadline Passed"
                : requestStatus === "approved" &&
                  (deadlineInfo.isBeforeStart || deadlineInfo.isAfterEnd) &&
                  !showOnlyPPTApproval
                ? `Submit ${panelMode ? "Panel " : ""}Review (Extended)`
                : finalFormLocked && !showOnlyPPTApproval
                ? "Locked"
                : sub === "Locked" && !showOnlyPPTApproval
                ? "Comments/Contributions Required"
                : showOnlyPPTApproval && !showPPTSection
                ? "No PPT Required by Schema"
                : showOnlyPPTApproval && showPPTSection
                ? "Submit PPT Approval"
                : panelMode && bestProject
                ? "Submit Best Project Review"
                : showPPTSection
                ? `Submit ${panelMode ? "Panel " : ""}Review + PPT`
                : `Submit ${panelMode ? "Panel " : ""}Review`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PopupReview;