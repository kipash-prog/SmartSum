import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { FiCopy, FiCheck, FiLink, FiType, FiExternalLink } from "react-icons/fi";
import "./SummarizePage.css";

const SummarizePage = () => {
  const [input, setInput] = useState("");
  const [summaryType, setSummaryType] = useState("medium");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [inputType, setInputType] = useState("text");
  const [charCount, setCharCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCopied(false);

    if (!input.trim()) {
      setError(`Please enter ${inputType === 'url' ? 'a valid URL' : 'some text'} to summarize`);
      return;
    }

    if (inputType === 'url' && !isValidUrl(input)) {
      setError("Please enter a valid URL starting with http:// or https://");
      return;
    }

    setLoading(true);
    setSummary("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("You must be logged in to summarize");
        setLoading(false);
        navigate("/login");
        return;
      }

      const payload = {
        text: inputType === 'text' ? input : await fetchUrlContent(input),
        summary_type: summaryType
      };

      const res = await axios.post(
        "http://localhost:8000/api/summarize/",
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        }
      );

      setSummary(res.data.summary);
    } catch (error) {
      console.error("Summarization error:", error);
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUrlContent = async (url) => {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Authentication token missing");
    }

    const response = await axios.post(
      "http://localhost:8000/api/fetch-url-content/",
      { url },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      }
    );
    
    return response.data.content;
  } catch (err) {
    console.error("URL fetch error:", err);
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      navigate("/login");
      throw new Error("Session expired. Please login again.");
    }
    throw new Error("Could not fetch content from this URL. Please try another one.");
  }
};
  const handleApiError = (error) => {
  if (error.response?.status === 401) {
    setError("Session expired. Please login again.");
    localStorage.removeItem("token");
    navigate("/login");
  } else if (error.message.includes("URL")) {
    setError("Failed to fetch article content. Please ensure the URL is correct and publicly accessible.");
  } else {
    setError(
      error.response?.data?.error || 
      "An unexpected error occurred. Please try again later."
    );
  }
};

  const isValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (e) {
      return false;
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    if (inputType === 'text') {
      setCharCount(value.length);
    }
    setError("");
  };

  const copyToClipboard = () => {
    if (!summary) return;
    navigator.clipboard.writeText(summary)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(err => {
        console.error("Copy failed:", err);
        setError("Failed to copy to clipboard");
      });
  };

  const toggleInputType = () => {
    setInputType(prev => prev === 'text' ? 'url' : 'text');
    setInput("");
    setCharCount(0);
    setError("");
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const summaryOptions = [
    { value: "short", label: "Brief", icon: "⏱️", desc: "1-2 sentences" },
    { value: "medium", label: "Standard", icon: "🕒", desc: "3-5 sentences" },
    { value: "long", label: "Detailed", icon: "⏳", desc: "Full paragraph" },
  ];

  return (
    <div className="summarize-container">
      <div className="summarize-card">
        <div className="header">
          <h2>
            <span className="gradient-text">SmartSum</span>
          </h2>
          <p>Transform {inputType === 'url' ? 'web articles' : 'text'} into concise summaries</p>
        </div>

        <form onSubmit={handleSubmit} className="summarize-form">
          <div className="input-toggle">
            <button
              type="button"
              onClick={toggleInputType}
              className={inputType === 'text' ? 'active' : ''}
              aria-label="Switch to text input"
            >
              <FiType /> Text
            </button>
            <button
              type="button"
              onClick={toggleInputType}
              className={inputType === 'url' ? 'active' : ''}
              aria-label="Switch to URL input"
            >
              <FiLink /> URL
            </button>
          </div>

          <div className="input-container">
            <label>
              {inputType === 'url' ? 'Website URL' : 'Your Text'}
              {inputType === 'text' && (
                <span className="char-count">({charCount} chars)</span>
              )}
            </label>
            {inputType === 'url' ? (
              <div className="url-input-wrapper">
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={input}
                  onChange={handleInputChange}
                  required
                />
                {input && isValidUrl(input) && (
                  <a 
                    href={input} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="external-link"
                    aria-label="Open URL in new tab"
                  >
                    <FiExternalLink />
                  </a>
                )}
              </div>
            ) : (
              <textarea
                rows={isExpanded ? 12 : 6}
                placeholder="Paste your text here or enter a URL above..."
                value={input}
                onChange={handleInputChange}
                required
              />
            )}
            {inputType === 'text' && (
              <button 
                type="button" 
                onClick={toggleExpand}
                className="expand-btn"
              >
                {isExpanded ? 'Show Less' : 'Show More'}
              </button>
            )}
          </div>

          {error && (
            <div className="error-message">
              <span>⚠️</span> {error}
            </div>
          )}

          <div className="controls">
            <div className="summary-options">
              {summaryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSummaryType(option.value)}
                  className={summaryType === option.value ? 'active' : ''}
                  aria-label={`${option.label} summary option`}
                >
                  <span className="option-icon">{option.icon}</span>
                  <div className="option-details">
                    <span className="option-label">{option.label}</span>
                    <span className="option-desc">{option.desc}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`submit-btn ${loading ? 'loading' : ''}`}
              aria-label={loading ? 'Processing' : 'Generate summary'}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Processing...
                </>
              ) : (
                <>
                  <span className="gemini-icon">✧</span>
                  Generate Summary
                </>
              )}
            </button>
          </div>
        </form>

        {summary && (
          <div className="summary-container">
            <div className="summary-header">
              <h3>
                {inputType === 'url' ? 'Article Summary' : 'Text Summary'}
                <span className="summary-type-badge">{summaryType}</span>
              </h3>
              <div className="summary-actions">
                <button
                  onClick={copyToClipboard}
                  disabled={!summary}
                  className={copied ? 'copied' : ''}
                  aria-label={copied ? 'Copied!' : 'Copy summary'}
                >
                  {copied ? (
                    <>
                      <FiCheck /> Copied!
                    </>
                  ) : (
                    <>
                      <FiCopy /> Copy
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="summary-content">
              <p>{summary}</p>
            </div>
            {inputType === 'text' && input.length > 0 && summary.length > 0 && (
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-label">Original:</span>
                  <span className="stat-value">{input.length} chars</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Summary:</span>
                  <span className="stat-value">{summary.length} chars</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Reduction:</span>
                  <span className="stat-value">
                    {Math.round((1 - summary.length / input.length) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SummarizePage;