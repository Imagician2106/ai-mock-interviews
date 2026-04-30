"use client";

import Image from "next/image";
import type { CSSProperties } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, ChevronLeft, ChevronRight, Code2, Layers3, Sparkles, Wand2 } from "lucide-react";

import {
  companies,
  programmingLanguages,
  frameworks,
  experienceLevels,
  interviewTypes,
  roles,
} from "@/constants";

const InterviewSetupForm = ({ userId }: InterviewSetupFormProps) => {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [company, setCompany] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [selectedFrameworks, setSelectedFrameworks] = useState<string[]>([]);
  const [role, setRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [level, setLevel] = useState("");
  const [interviewType, setInterviewType] = useState("");
  const [questionCount, setQuestionCount] = useState(10);

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  };

  const toggleFramework = (fw: string) => {
    setSelectedFrameworks((prev) =>
      prev.includes(fw) ? prev.filter((f) => f !== fw) : [...prev, fw]
    );
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return company !== "";
      case 2:
        return selectedLanguages.length > 0;
      case 3:
        return selectedFrameworks.length > 0;
      case 4:
        return (role !== "" || customRole !== "") && level !== "" && interviewType !== "";
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    const finalRole = role === "Custom" ? customRole : role;
    if (!finalRole) {
      toast.error("Please enter a role");
      return;
    }

    setLoading(true);

    try {
      const techstack = [...selectedLanguages, ...selectedFrameworks].join(",");

      const response = await fetch("/api/vapi/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: interviewType,
          role: finalRole,
          level,
          techstack,
          amount: questionCount,
          userid: userId,
          company,
          languages: selectedLanguages,
          frameworks: selectedFrameworks,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success("Interview created successfully!");
        router.push("/");
      } else {
        toast.error(data.error || "Failed to create interview. Please try again.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;
  const finalRole = role === "Custom" ? customRole : role;

  return (
    <div className="setup-form-container setup-workbench">
      <aside className="setup-sidebar">
        <div>
          <span className="section-kicker">Builder progress</span>
          <h2>{Math.round(progress)}%</h2>
          <p>Shape the company, stack, seniority, and interview style.</p>
        </div>

        <div className="setup-progress-track" style={{ "--setup-progress": `${progress}%` } as CSSProperties}>
          <span style={{ height: `${progress}%` }} />
        </div>

        <div className="setup-summary-list">
          <span><Building2 className="size-4" /> {company || "Company"}</span>
          <span><Code2 className="size-4" /> {selectedLanguages.length || "Languages"}</span>
          <span><Layers3 className="size-4" /> {selectedFrameworks.length || "Tools"}</span>
          <span><Sparkles className="size-4" /> {finalRole || "Role"}</span>
        </div>
      </aside>

      <div className="setup-main">
        <div className="step-indicator">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div key={i} className="step-indicator-item">
              <div
                className={`step-dot ${
                  i + 1 < step
                    ? "step-done"
                    : i + 1 === step
                    ? "step-active"
                    : "step-upcoming"
                }`}
              >
                {i + 1 < step ? <Check className="size-4" /> : i + 1}
              </div>
              {i < totalSteps - 1 && (
                <div className={`step-line ${i + 1 < step ? "step-line-active" : ""}`} />
              )}
            </div>
          ))}
        </div>

      {step === 1 && (
        <div className="form-step animate-fadeIn">
          <div className="step-header">
            <h3>Which company are you preparing for?</h3>
            <p>Select the company you want to practice interviewing for</p>
          </div>

          <div className="company-grid">
            {companies.map((c) => (
              <button
                key={c.name}
                className={`company-card ${company === c.name ? "company-card-selected" : ""}`}
                onClick={() => setCompany(c.name)}
                type="button"
              >
                <Image
                  src={c.logo}
                  alt={c.name}
                  width={48}
                  height={48}
                  className="company-logo"
                />
                <span className="company-name">{c.name}</span>
                {company === c.name && (
                  <div className="company-check">
                    <Check className="size-4" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="form-step animate-fadeIn">
          <div className="step-header">
            <h3>Select Programming Languages</h3>
            <p>Choose the languages relevant to your interview</p>
          </div>

          <div className="chip-grid">
            {programmingLanguages.map((lang) => (
              <button
                key={lang}
                className={`chip ${selectedLanguages.includes(lang) ? "chip-selected" : ""}`}
                onClick={() => toggleLanguage(lang)}
                type="button"
              >
                {lang}
                {selectedLanguages.includes(lang) && (
                  <Check className="size-4" />
                )}
              </button>
            ))}
          </div>

          {selectedLanguages.length > 0 && (
            <div className="selected-summary">
              <p className="text-sm text-light-400">
                Selected: {selectedLanguages.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="form-step animate-fadeIn">
          <div className="step-header">
            <h3>Select Frameworks & Tools</h3>
            <p>Pick the technologies you want to be tested on</p>
          </div>

          <div className="chip-grid">
            {frameworks.map((fw) => (
              <button
                key={fw}
                className={`chip ${selectedFrameworks.includes(fw) ? "chip-selected" : ""}`}
                onClick={() => toggleFramework(fw)}
                type="button"
              >
                {fw}
                {selectedFrameworks.includes(fw) && (
                  <Check className="size-4" />
                )}
              </button>
            ))}
          </div>

          {selectedFrameworks.length > 0 && (
            <div className="selected-summary">
              <p className="text-sm text-light-400">
                Selected: {selectedFrameworks.join(", ")}
              </p>
            </div>
          )}
        </div>
      )}

      {step === 4 && (
        <div className="form-step animate-fadeIn">
          <div className="step-header">
            <h3>Interview Details</h3>
            <p>Configure the final details for your mock interview</p>
          </div>

          <div className="details-grid">
            <div className="detail-field">
              <label className="detail-label">Role</label>
              <div className="role-options">
                {roles.map((r) => (
                  <button
                    key={r}
                    className={`role-chip ${role === r ? "role-chip-selected" : ""}`}
                    onClick={() => { setRole(r); setCustomRole(""); }}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
                <button
                  className={`role-chip ${role === "Custom" ? "role-chip-selected" : ""}`}
                  onClick={() => setRole("Custom")}
                  type="button"
                >
                  Custom
                </button>
              </div>
              {role === "Custom" && (
                <input
                  type="text"
                  className="custom-role-input"
                  placeholder="Enter your custom role..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                />
              )}
            </div>

            <div className="detail-row">
              <div className="detail-field">
                <label className="detail-label">Experience Level</label>
                <div className="select-grid">
                  {experienceLevels.map((l) => (
                    <button
                      key={l}
                      className={`select-option ${level === l ? "select-option-selected" : ""}`}
                      onClick={() => setLevel(l)}
                      type="button"
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-field">
                <label className="detail-label">Interview Type</label>
                <div className="select-grid">
                  {interviewTypes.map((t) => (
                    <button
                      key={t}
                      className={`select-option ${interviewType === t ? "select-option-selected" : ""}`}
                      onClick={() => setInterviewType(t)}
                      type="button"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="detail-field">
              <label className="detail-label">
                Number of Questions: <span className="question-count">{questionCount}</span>
              </label>
              <input
                type="range"
                min="3"
                max="20"
                value={questionCount}
                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                className="question-slider"
              />
              <div className="slider-labels">
                <span>3</span>
                <span>20</span>
              </div>
            </div>
          </div>

          <div className="interview-preview">
            <h4>Interview Preview</h4>
            <div className="preview-tags">
              <span className="preview-tag preview-tag-company">{company}</span>
              {selectedLanguages.map((l) => (
                <span key={l} className="preview-tag preview-tag-lang">{l}</span>
              ))}
              {selectedFrameworks.map((f) => (
                <span key={f} className="preview-tag preview-tag-fw">{f}</span>
              ))}
              {(role && role !== "Custom") && <span className="preview-tag preview-tag-role">{role}</span>}
              {(role === "Custom" && customRole) && <span className="preview-tag preview-tag-role">{customRole}</span>}
              {level && <span className="preview-tag preview-tag-level">{level}</span>}
              {interviewType && <span className="preview-tag preview-tag-type">{interviewType}</span>}
            </div>
          </div>
        </div>
      )}

      <div className="form-actions">
        {step > 1 && (
          <button
            className="btn-secondary-form"
            onClick={() => setStep(step - 1)}
            type="button"
          >
            <ChevronLeft className="size-4" />
            Back
          </button>
        )}

        {step < totalSteps ? (
          <button
            className="btn-primary-form"
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            type="button"
          >
            Continue
            <ChevronRight className="size-4" />
          </button>
        ) : (
          <button
            className="btn-primary-form btn-generate"
            onClick={handleSubmit}
            disabled={!canProceed() || loading}
            type="button"
          >
            {loading ? (
              <span className="loading-content">
                <span className="loading-spinner" />
                Generating Interview...
              </span>
            ) : (
              <>
                <Wand2 className="size-4" />
                Generate Interview
              </>
            )}
          </button>
        )}
      </div>
      </div>
    </div>
  );
};

export default InterviewSetupForm;
