import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { 
  FiCopy, FiCheck, 
  FiExternalLink, FiAlertCircle, FiClock,
  FiAlignLeft, FiAlignCenter, FiLoader,
  FiTrash2, FiChevronDown, FiChevronUp,
  FiRotateCw, FiMaximize2, FiMinimize2
} from "react-icons/fi";
import "./SummarizePage.css";

const API_BASE_URL = 'http://localhost:8000';
const MAX_HISTORY_ITEMS = 10;

const SummarizePage = () => {
  const [form, setForm] = useState({
    input: "",
    summaryType: "medium",
    inputType: "text"
  });

  const [ui, setUi] = useState({
    loading: false,
    fetchingContent: false,
    copied: false,
    isExpanded: false,
    showHistory: false,
    isMobile: window.innerWidth < 768
  });

  const [data, setData] = useState({
    summary: "",
    charCount: 0,
    history: []
  });

  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const summaryRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      setUi(prev => ({ ...prev, isMobile: window.innerWidth < 768 }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (form.inputType === 'text' && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [form.inputType]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('summaryHistory');
    if (savedHistory) setData(prev => ({ ...prev, history: JSON.parse(savedHistory) }));
  }, []);

  useEffect(() => {
    if (data.history.length > 0) {
      localStorage.setItem('summaryHistory', JSON.stringify(data.history));
    }
  }, [data.history]);

  useEffect(() => {
    if (form.inputType === 'text') {
      setData(prev => ({ ...prev, charCount: form.input.length }));
    }
  }, [form.input, form.inputType]);

  const summaryOptions = [
    { value: "short", label: "Brief", icon: <FiAlignLeft />, desc: "1-2 sentences" },
    { value: "medium", label: "Standard", icon: <FiAlignCenter />, desc: "3-5 sentences" },
    { value: "long", label: "Detailed", icon: <FiClock />, desc: "Full paragraph" }
  ];

  const fetchUrlContent = async (url) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const response = await axios.post(
        `${API_BASE_URL}/api/fetch-url-content/`,
        { url },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          timeout: 30000
        }
      );

      return response.data?.content || "";
    } catch (err) {
      let errorMsg = "Failed to fetch URL content";
      if (err.response?.status === 403) errorMsg = "Access denied";
      else if (err.response?.status === 400) errorMsg = "Invalid URL";
      else if (err.code === "ECONNABORTED") errorMsg = "Request timed out";
      throw new Error(errorMsg);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setUi(prev => ({ ...prev, copied: false }));

    if (!form.input.trim()) {
      setError({ title: "Input Required", message: "Please provide content", type: "validation" });
      return;
    }

    if (form.inputType === 'url' && !isValidUrl(form.input)) {
      setError({ title: "Invalid URL", message: "URL must start with http:// or https://", type: "validation" });
      return;
    }

    setUi(prev => ({ ...prev, loading: true }));
    setData(prev => ({ ...prev, summary: "" }));

    try {
      const token = localStorage.getItem("token");
      if (!token) return navigate("/login");

      let content = form.input;
      if (form.inputType === 'url') {
        setUi(prev => ({ ...prev, fetchingContent: true }));
        content = await fetchUrlContent(form.input);
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/summarize/`,
        { text: content, summary_type: form.summaryType },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const newSummary = response.data?.summary;
      if (!newSummary) throw new Error("Empty response");

      setData(prev => ({
        ...prev,
        summary: newSummary,
        history: [{
          id: Date.now(),
          input: form.input,
          summary: newSummary,
          summaryType: form.summaryType,
          inputType: form.inputType,
          timestamp: new Date().toLocaleString()
        }, ...prev.history.slice(0, MAX_HISTORY_ITEMS - 1)]
      }));

      if (ui.isMobile && summaryRef.current) {
        setTimeout(() => {
          summaryRef.current.scrollIntoView({ behavior: 'smooth' });
        }, 300);
      }

    } catch (error) {
      setError({ title: "Summarization Failed", message: error.message, type: "processing" });
    } finally {
      setUi(prev => ({ ...prev, loading: false, fetchingContent: false }));
    }
  };

  const loadFromHistory = (item) => {
    setForm({
      input: item.input,
      summaryType: item.summaryType,
      inputType: item.inputType
    });
    setData(prev => ({ ...prev, summary: item.summary }));
    setUi(prev => ({ ...prev, showHistory: false }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = (id, e) => {
    e.stopPropagation();
    setData(prev => ({ ...prev, history: prev.history.filter(item => item.id !== id) }));
  };

  const clearHistory = () => {
    setData(prev => ({ ...prev, history: [] }));
    localStorage.removeItem('summaryHistory');
  };

  const toggleHistory = () => setUi(prev => ({ ...prev, showHistory: !prev.showHistory }));
  const toggleExpand = () => setUi(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  const clearAll = () => {
    setForm(prev => ({ ...prev, input: "" }));
    setData(prev => ({ ...prev, summary: "" }));
    setError(null);
  };

  const copyToClipboard = () => {
    if (!data.summary) return;
    navigator.clipboard.writeText(data.summary)
      .then(() => {
        setUi(prev => ({ ...prev, copied: true }));
        setTimeout(() => setUi(prev => ({ ...prev, copied: false })), 2000);
      })
      .catch(() => setError({ title: "Clipboard Error", message: "Failed to copy", type: "system" }));
  };

  const toggleInputType = () => {
    setForm(prev => ({
      ...prev,
      inputType: prev.inputType === 'text' ? 'url' : 'text',
      input: ""
    }));
    setData(prev => ({ ...prev, summary: "" }));
  };

  const isValidUrl = (url) => {
    try { new URL(url); return true; } catch { return false; }
  };

  const truncateText = (text, maxLength) => 
    text?.length > maxLength ? `${text.substring(0, maxLength)}...` : text || '';

  const calculateReadingTime = (text) => {
    const wordsPerMinute = 200;
    const wordCount = text.trim().split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  };

  return (
    <div className="summarize-app">
      <div className="summarize-card">
        <header className="app-header">
          <div className="header-content">
            <h1 className="app-title">KipaSum</h1>
            <p className="app-subtitle">
              Transform {form.inputType === 'url' ? 'web content' : 'text'} into concise summaries
            </p>
          </div>
          
          <div className="history-controls">
            <button 
              onClick={toggleHistory} 
              className="history-toggle"
              aria-label={ui.showHistory ? "Hide history" : "Show history"}
            >
              <FiRotateCw />
              {ui.showHistory ? <FiChevronUp /> : <FiChevronDown />}
            </button>
            {data.history.length > 0 && (
              <button 
                onClick={clearHistory} 
                className="clear-history"
                aria-label="Clear all history"
              >
                <FiTrash2 /> {ui.isMobile ? '' : 'Clear All'}
              </button>
            )}
          </div>
        </header>

        {ui.showHistory ? (
          <div className="history-panel">
            <h3>Your Summary History</h3>
            {data.history.length === 0 ? (
              <p className="no-history">No summaries yet</p>
            ) : (
              <ul className="history-list">
                {data.history.map(item => (
                  <li 
                    key={item.id} 
                    onClick={() => loadFromHistory(item)} 
                    className="history-item"
                    tabIndex="0"
                    onKeyPress={(e) => e.key === 'Enter' && loadFromHistory(item)}
                  >
                    <div className="history-item-header">
                      <span className={`history-type ${item.summaryType}`}>
                        {item.summaryType}
                      </span>
                      <span className="history-timestamp">{item.timestamp}</span>
                      <button 
                        onClick={(e) => deleteHistoryItem(item.id, e)}
                        className="delete-history-item"
                        aria-label="Delete this history item"
                      >
                        <FiTrash2 size={14} />
                      </button>
                    </div>
                    <div className="history-preview">
                      {item.inputType === 'url' ? (
                        <a href={item.input} target="_blank" rel="noopener noreferrer">
                          {truncateText(item.input, ui.isMobile ? 30 : 50)}
                        </a>
                      ) : (
                        <p>{truncateText(item.input, ui.isMobile ? 60 : 100)}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="summarize-form">
              <div className="input-mode-toggle">
                <button
                  type="button"
                  onClick={toggleInputType}
                  className="input-type-toggle"
                  aria-label={`Switch to ${form.inputType === 'text' ? 'URL' : 'text'} input`}
                >
                  {form.inputType === 'text' ? 'Switch to URL' : 'Switch to Text'}
                </button>
                
                <div className="summary-options-container">
                  {summaryOptions.map(option => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, summaryType: option.value }))}
                      className={`summary-option ${form.summaryType === option.value ? 'active' : ''}`}
                      aria-label={`${option.label} summary (${option.desc})`}
                      data-tooltip={option.desc}
                    >
                      <span className="option-icon">{option.icon}</span>
                      {!ui.isMobile && <span className="option-label">{option.label}</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div className="input-section">
                <div className="input-header">
                  <label>{form.inputType === 'url' ? 'Article URL' : 'Your Content'}</label>
                  {form.inputType === 'text' && (
                    <span className={`char-counter ${data.charCount > 5000 ? 'warning' : ''}`}>
                      {data.charCount.toLocaleString()} chars
                    </span>
                  )}
                </div>
                
                {form.inputType === 'url' ? (
                  <div className="url-input-container">
                    <input
                      type="url"
                      value={form.input}
                      onChange={(e) => setForm(prev => ({ ...prev, input: e.target.value }))}
                      placeholder="https://example.com/article"
                      required
                      aria-label="Enter article URL to summarize"
                    />
                    {form.input && (
                      <div className="url-actions">
                        {isValidUrl(form.input) && (
                          <a 
                            href={form.input} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            aria-label="Open URL in new tab"
                          >
                            <FiExternalLink />
                          </a>
                        )}
                        <button 
                          type="button" 
                          onClick={clearAll}
                          aria-label="Clear input"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-input-container">
                    <textarea
                      ref={textareaRef}
                      rows={ui.isExpanded ? 8 : 5}
                      value={form.input}
                      onChange={(e) => setForm(prev => ({ ...prev, input: e.target.value }))}
                      placeholder="Paste your content here..."
                      required
                      aria-label="Enter text to summarize"
                    />
                    <div className="text-actions">
                      <button 
                        type="button" 
                        onClick={toggleExpand}
                        aria-label={ui.isExpanded ? "Show less text" : "Show more text"}
                      >
                        {ui.isExpanded ? <FiMinimize2 /> : <FiMaximize2 />}
                        {!ui.isMobile && (ui.isExpanded ? 'Show Less' : 'Show More')}
                      </button>
                      {form.input && (
                        <button 
                          type="button" 
                          onClick={clearAll}
                          aria-label="Clear input"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div className={`error-message ${error.type}`}>
                  <FiAlertCircle className="error-icon" />
                  <div className="error-content">
                    <h3>{error.title}</h3>
                    <p>{error.message}</p>
                    <div className="error-suggestions">
                      <p>Suggested actions:</p>
                      <ul>
                        <li>Try different content</li>
                        <li>Check the format</li>
                        <li>Contact support</li>
                      </ul>
                    </div>
                  </div>
                  <button 
                    className="error-close"
                    onClick={() => setError(null)}
                    aria-label="Dismiss error message"
                  >
                    ×
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={ui.loading || !form.input.trim()}
                className={`submit-button ${ui.loading ? 'loading' : ''}`}
                aria-label={ui.loading ? "Processing your request" : "Generate summary"}
              >
                {ui.loading ? (
                  <>
                    <FiLoader className="spinner" />
                    Processing...
                  </>
                ) : (
                  <>
                    <span className="submit-icon">✧</span>
                    {ui.isMobile ? 'Summarize' : 'Generate Summary'}
                  </>
                )}
              </button>
            </form>

            {data.summary && (
              <div className="summary-section" ref={summaryRef}>
                <div className="summary-header">
                  <h2>
                    {form.inputType === 'url' ? 'Article Summary' : 'Content Summary'}
                    <span className={`summary-type-label ${form.summaryType}`}>
                      {form.summaryType}
                    </span>
                  </h2>
                  <div className="summary-actions">
                    <button
                      onClick={copyToClipboard}
                      className={`copy-button ${ui.copied ? 'copied' : ''}`}
                      aria-label={ui.copied ? "Copied to clipboard" : "Copy summary to clipboard"}
                    >
                      {ui.copied ? (
                        <>
                          <FiCheck />
                          {!ui.isMobile && 'Copied!'}
                        </>
                      ) : (
                        <>
                          <FiCopy />
                          {!ui.isMobile && 'Copy'}
                        </>
                      )}
                    </button>
                    <button 
                      onClick={clearAll}
                      aria-label="Reset form"
                    >
                      Reset
                    </button>
                  </div>
                </div>
                <div className="summary-content">
                  <p>{data.summary}</p>
                </div>
                {form.inputType === 'text' && form.input.length > 0 && data.summary.length > 0 && (
                  <div className="summary-metrics">
                    <div className="metric">
                      <span>Original:</span>
                      <span>{form.input.length.toLocaleString()} chars</span>
                    </div>
                    <div className="metric">
                      <span>Summary:</span>
                      <span>{data.summary.length.toLocaleString()} chars</span>
                    </div>
                    <div className="metric">
                      <span>Reduction:</span>
                      <span>
                        {Math.round((1 - data.summary.length / form.input.length) * 100)}%
                      </span>
                    </div>
                    <div className="metric">
                      <span>Reading Time:</span>
                      <span>
                        ~{calculateReadingTime(data.summary)} min read
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SummarizePage;