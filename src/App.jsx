import { useEffect, useMemo, useState } from "react";
import "./App.css";

const DEMO_EMAIL = "demo@trustvault.com";
const DEMO_PASSWORD = "TrustVault123!";

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function App() {
  const [users, setUsers] = useState(() => readStorage("tv-users", []));
  const [currentUser, setCurrentUser] = useState(
    () => readStorage("tv-session", null)
  );
  const [documents, setDocuments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [page, setPage] = useState("login");
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [notice, setNotice] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [username, setUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    localStorage.setItem("tv-users", JSON.stringify(users));
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("tv-session", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("tv-session");
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setDocuments(
        readStorage(`tv-documents-${currentUser.email}`, [])
      );
      setActivities(
        readStorage(`tv-activities-${currentUser.email}`, [])
      );
    } else {
      setDocuments([]);
      setActivities([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        `tv-documents-${currentUser.email}`,
        JSON.stringify(documents.map(({ file, ...doc }) => doc))
      );
    }
  }, [documents, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(
        `tv-activities-${currentUser.email}`,
        JSON.stringify(activities)
      );
    }
  }, [activities, currentUser]);

  function logActivity(action, detail) {
    setActivities((previous) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        action,
        detail,
        time: new Date().toLocaleString(),
      },
      ...previous,
    ]);
  }

  function showNotice(message) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

 async function handleLogin(event) {
  event.preventDefault();

  const email = loginEmail.trim().toLowerCase();

  try {
    const response = await fetch("http://localhost:5000/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password: loginPassword,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      showNotice(data.error || "Incorrect email or password.");
      return;
    }

    localStorage.setItem("tv-token", data.token);

    setCurrentUser({
      username: data.user.username,
      email: data.user.email,
    });

    setPage("app");
    setActiveTab("Dashboard");
    showNotice("Welcome back to TrustVault.");
  } catch (error) {
    showNotice(
      "Cannot connect to the server. Make sure the backend is running."
    );
  }
}

  function handleRegister(event) {
    event.preventDefault();

    if (username.trim().length < 3 || username.trim().length > 80) {
      showNotice("Username must be between 3 and 80 characters.");
      return;
    }

    if (registerPassword.length < 12) {
      showNotice("Password must contain at least 12 characters.");
      return;
    }

    if (registerPassword !== confirmPassword) {
      showNotice("Passwords do not match.");
      return;
    }

    const email = registerEmail.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      showNotice("Please enter a valid email address.");
      return;
    }

    if (users.some((user) => user.email.toLowerCase() === email)) {
      showNotice("An account with this email already exists.");
      return;
    }

    const newUser = { username: username.trim(), email, password: registerPassword };
    setUsers((previous) => [...previous, newUser]);
    setCurrentUser({ username: newUser.username, email: newUser.email });
    setPage("app");
    setActiveTab("Dashboard");
    showNotice("Your account has been created.");
  }

  function logout() {
    setCurrentUser(null);
    setPage("login");
    setLoginEmail("");
    setLoginPassword("");
    setSearch("");
    setActiveTab("Dashboard");
  }

  function uploadFiles(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const newDocuments = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type || "Unknown file type",
      category: getCategory(file.name),
      uploadedAt: new Date().toLocaleDateString(),
      file,
    }));

    setDocuments((previous) => [...newDocuments, ...previous]);
    newDocuments.forEach((doc) => logActivity("Uploaded", doc.name));
    showNotice(`${files.length} file${files.length === 1 ? "" : "s"} added.`);
    event.target.value = "";
  }

  function getCategory(name) {
    const extension = name.split(".").pop()?.toLowerCase();
    if (["pdf"].includes(extension)) return "PDF";
    if (["doc", "docx", "txt", "rtf"].includes(extension)) return "Documents";
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(extension)) return "Images";
    if (["xls", "xlsx", "csv"].includes(extension)) return "Spreadsheets";
    if (["ppt", "pptx"].includes(extension)) return "Presentations";
    return "Other";
  }

  function downloadDocument(doc) {
    if (!doc.file) {
      showNotice("Please upload this file again; its contents aren't saved after refresh.");
      return;
    }

    const url = URL.createObjectURL(doc.file);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    logActivity("Downloaded", doc.name);
  }

  function removeDocument(id) {
    const doc = documents.find((item) => item.id === id);
    if (!doc) return;

    setDocuments((previous) => previous.filter((item) => item.id !== id));
    logActivity("Deleted", doc.name);
    showNotice("Document removed.");
  }

  const filteredDocuments = useMemo(
    () =>
      documents.filter((doc) => {
        const matchesSearch = doc.name
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesCategory =
          category === "All" || doc.category === category;
        return matchesSearch && matchesCategory;
      }),
    [documents, search, category]
  );

  const totalSize = documents.reduce((total, doc) => total + doc.size, 0);
  const categories = ["All", "PDF", "Documents", "Images", "Spreadsheets", "Presentations", "Other"];

  const navItems = [
    { label: "Dashboard", icon: "▦" },
    { label: "My Documents", icon: "▤" },
    { label: "Search Documents", icon: "⌕" },
    { label: "Categories", icon: "▧" },
    { label: "Upload Document", icon: "↑" },
    { label: "Activity Logs", icon: "◷" },
  ];

  if (page !== "app" || !currentUser) {
    return (
      <div className="auth-page">
        <header className="auth-nav">
          <button className="brand" onClick={() => setPage("login")} type="button">
            <span className="brand-shield">⬡</span>
            <span>TrustVault</span>
          </button>
          <div className="auth-nav-right">
            <span className="nav-lock">◆</span>
            <span>Secure Document Vault</span>
          </div>
        </header>

        <main className="auth-layout">
          <section className="auth-intro">
            <div className="eyebrow">
              <span className="eyebrow-line" />
              PRIVATE. ORGANIZED. SECURE.
            </div>
            <h1>
              Your Documents,
              <br />
              <span>Our Priority</span>
            </h1>
            <p>
              Store, manage, and find your important documents in one secure place.
            </p>
            <div className="security-points">
              <div className="security-point">
                <span className="point-icon">✓</span>
                <div>
                  <strong>Your files, organized</strong>
                  <small>Keep important documents together.</small>
                </div>
              </div>
              <div className="security-point">
                <span className="point-icon">⌕</span>
                <div>
                  <strong>Find what you need</strong>
                  <small>Search your document collection quickly.</small>
                </div>
              </div>
              <div className="security-point">
                <span className="point-icon">◇</span>
                <div>
                  <strong>Privacy comes first</strong>
                  <small>A simple, private document workspace.</small>
                </div>
              </div>
            </div>
          </section>

          <section className="auth-card">
            <div className="auth-card-heading">
              <div className="card-emblem">⬡</div>
              <div className="auth-card-title">
                <h2>{page === "register" ? "Create your account" : "Welcome back"}</h2>
                <p>
                  {page === "register"
                    ? "Set up your secure document space."
                    : "Sign in to access your secure vault."}
                </p>
              </div>
            </div>

            <div className="auth-tabs">
              <button
                className={page === "login" ? "auth-tab active" : "auth-tab"}
                onClick={() => setPage("login")}
                type="button"
              >
                Login
              </button>
              <button
                className={page === "register" ? "auth-tab active" : "auth-tab"}
                onClick={() => setPage("register")}
                type="button"
              >
                Create Account
              </button>
            </div>

            {page === "register" ? (
              <form className="auth-form" onSubmit={handleRegister}>
                <label htmlFor="username">Username</label>
                <input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Choose a username"
                  minLength={3}
                  maxLength={80}
                  autoComplete="username"
                  required
                />
                <label htmlFor="register-email">Email address</label>
                <input
                  id="register-email"
                  type="email"
                  value={registerEmail}
                  onChange={(event) => setRegisterEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <label htmlFor="register-password">Password</label>
                <input
                  id="register-password"
                  type="password"
                  value={registerPassword}
                  onChange={(event) => setRegisterPassword(event.target.value)}
                  placeholder="At least 12 characters"
                  minLength={12}
                  autoComplete="new-password"
                  required
                />
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  required
                />
                <button className="primary-button auth-submit" type="submit">
                  Create Account <span>→</span>
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={handleLogin}>
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(event) => setLoginEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  value={loginPassword}
                  onChange={(event) => setLoginPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button className="primary-button auth-submit" type="submit">
                  Sign In <span>→</span>
                </button>
                <p className="form-hint">
                  New to TrustVault?{" "}
                  <button
                    className="inline-link"
                    onClick={() => setPage("register")}
                    type="button"
                  >
                    Create an account
                  </button>
                </p>
              </form>
            )}

            <div className="auth-card-footer">
              <span className="footer-shield">◇</span>
              <span>Your privacy matters. Keep your documents safe.</span>
            </div>
          </section>
        </main>

        <footer className="site-footer">
          <span>TRUSTVAULT</span>
          <span className="footer-dot">·</span>
          YOUR PERSONAL DOCUMENT SPACE
        </footer>

        {notice && <div className="toast">{notice}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="sidebar-brand" onClick={() => setActiveTab("Dashboard")} type="button">
          <span className="brand-shield">⬡</span>
          <span>TrustVault</span>
        </button>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="side-nav">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={activeTab === item.label ? "side-link active" : "side-link"}
              onClick={() => {
                setActiveTab(item.label);
                if (item.label !== "Categories") setCategory("All");
              }}
              type="button"
            >
              <span className="side-icon">{item.icon}</span>
              {item.label}
              {item.label === "My Documents" && (
                <span className="nav-count">{documents.length}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-secure">
            <span className="secure-icon">◇</span>
            <div>
              <strong>Secure session</strong>
              <small>Your workspace is active</small>
            </div>
            <span className="online-dot" />
          </div>
          <button className="profile-row" type="button" onClick={logout}>
            <span className="avatar">
              {(currentUser.username || "U").slice(0, 1).toUpperCase()}
            </span>
            <span className="profile-text">
              <strong>{currentUser.username}</strong>
              <small>{currentUser.email}</small>
            </span>
            <span className="logout-icon">↗</span>
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="workspace-topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-separator">/</span>
            <strong>{activeTab}</strong>
          </div>
          <div className="topbar-right">
            <span className="status-dot" />
            <span>Secure Session</span>
            <button className="logout-button" onClick={logout} type="button">
              Sign out
            </button>
          </div>
        </header>

        <div className="workspace-content">
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                YOUR PRIVATE WORKSPACE
              </div>
              <h1>
                {activeTab === "Dashboard"
                  ? "Your Documents, Our Priority"
                  : activeTab}
              </h1>
              <p className="welcome-subtitle">
                Store, manage, and find your important documents in one secure place.
              </p>
            </div>
            <button
              className="primary-button header-upload"
              onClick={() => setActiveTab("Upload Document")}
              type="button"
            >
              <span>＋</span> Upload document
            </button>
          </div>

          {activeTab === "Dashboard" && (
            <>
              <section className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Total documents</span>
                    <span className="stat-icon green-icon">▤</span>
                  </div>
                  <div className="stat-number">{documents.length}</div>
                  <div className="stat-caption">Files in your vault</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Storage used</span>
                    <span className="stat-icon blue-icon">▧</span>
                  </div>
                  <div className="stat-number">
                    {(totalSize / (1024 * 1024)).toFixed(2)}
                    <span className="stat-unit"> MB</span>
                  </div>
                  <div className="stat-caption">Total uploaded file size</div>
                </div>
                <div className="stat-card">
                  <div className="stat-top">
                    <span>Categories</span>
                    <span className="stat-icon purple-icon">▦</span>
                  </div>
                  <div className="stat-number">
                    {new Set(documents.map((doc) => doc.category)).size}
                  </div>
                  <div className="stat-caption">Categories represented</div>
                </div>
              </section>

              <section className="dashboard-grid">
                <div className="panel upload-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Upload Document</h2>
                      <p>Add a document to your vault.</p>
                    </div>
                    <span className="panel-icon">↑</span>
                  </div>
                  <label className="drop-zone">
                    <span className="upload-symbol">↑</span>
                    <strong>Choose files to upload</strong>
                    <span>Click to browse files on your computer</span>
                    <small>Multiple files supported</small>
                    <input type="file" multiple onChange={uploadFiles} />
                  </label>
                </div>

                <div className="panel recent-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Recent Documents</h2>
                      <p>Your latest uploaded files.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActiveTab("My Documents")}
                      type="button"
                    >
                      View all →
                    </button>
                  </div>
                  <DocumentList
                    documents={documents.slice(0, 4)}
                    onDownload={downloadDocument}
                    onRemove={removeDocument}
                  />
                </div>
              </section>
            </>
          )}

          {activeTab === "Upload Document" && (
            <section className="panel page-panel">
              <div className="panel-heading">
                <div>
                  <h2>Upload your documents</h2>
                  <p>Select one or more files from your computer.</p>
                </div>
                <span className="panel-icon">↑</span>
              </div>
              <label className="drop-zone large-drop-zone">
                <span className="upload-symbol">↑</span>
                <strong>Choose files to upload</strong>
                <span>Browse and select the documents you want to add</span>
                <small>Files are handled locally in this demo.</small>
                <input type="file" multiple onChange={uploadFiles} />
              </label>
            </section>
          )}

          {(activeTab === "My Documents" ||
            activeTab === "Search Documents" ||
            activeTab === "Categories") && (
            <section className="panel document-panel">
              <div className="panel-heading">
                <div>
                  <h2>
                    {activeTab === "Categories" ? "Browse by category" : "My Documents"}
                  </h2>
                  <p>
                    {activeTab === "Categories"
                      ? "Choose a category to filter your files."
                      : "Manage and find your uploaded documents."}
                  </p>
                </div>
                <span className="document-count">{filteredDocuments.length} files</span>
              </div>

              {activeTab === "Categories" && (
                <div className="category-pills">
                  {categories.map((item) => (
                    <button
                      type="button"
                      key={item}
                      className={category === item ? "category-pill active" : "category-pill"}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}

              {activeTab !== "Categories" && (
                <div className="search-bar">
                  <span>⌕</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search documents by filename..."
                    aria-label="Search documents by filename"
                  />
                  {search && (
                    <button onClick={() => setSearch("")} type="button" aria-label="Clear search">
                      ×
                    </button>
                  )}
                </div>
              )}

              <DocumentList
                documents={filteredDocuments}
                onDownload={downloadDocument}
                onRemove={removeDocument}
              />
            </section>
          )}

          {activeTab === "Activity Logs" && (
            <section className="panel document-panel">
              <div className="panel-heading">
                <div>
                  <h2>Activity Logs</h2>
                  <p>Recent actions in your current workspace.</p>
                </div>
                <span className="panel-icon">◷</span>
              </div>
              {activities.length === 0 ? (
                <EmptyState
                  title="No activity yet"
                  message="Uploads, downloads, and deletions will appear here."
                />
              ) : (
                <div className="activity-list">
                  {activities.map((activity) => (
                    <div className="activity-row" key={activity.id}>
                      <span className="activity-symbol">↗</span>
                      <div className="activity-main">
                        <strong>{activity.action}</strong>
                        <span>{activity.detail}</span>
                      </div>
                      <time>{activity.time}</time>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "Dashboard" && (
            <section className="panel activity-preview">
              <div className="panel-heading">
                <div>
                  <h2>Recent Activity</h2>
                  <p>Keep track of your document actions.</p>
                </div>
                <button
                  className="text-button"
                  onClick={() => setActiveTab("Activity Logs")}
                  type="button"
                >
                  Activity logs →
                </button>
              </div>
              {activities.length === 0 ? (
                <p className="muted-message">Your recent activity will appear here.</p>
              ) : (
                <div className="activity-list">
                  {activities.slice(0, 3).map((activity) => (
                    <div className="activity-row" key={activity.id}>
                      <span className="activity-symbol">↗</span>
                      <div className="activity-main">
                        <strong>{activity.action}</strong>
                        <span>{activity.detail}</span>
                      </div>
                      <time>{activity.time}</time>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          <footer className="workspace-footer">
            <span>© 2026 TrustVault</span>
            <span>YOUR PERSONAL DOCUMENT SPACE</span>
          </footer>
        </div>
      </main>

      {notice && <div className="toast">{notice}</div>}
    </div>
  );
}

function DocumentList({ documents, onDownload, onRemove }) {
  if (documents.length === 0) {
    return (
      <EmptyState
        title="No documents found"
        message="Upload a file to get started. Your documents will appear here."
      />
    );
  }

  return (
    <div className="document-list">
      {documents.map((doc) => (
        <div className="document-row" key={doc.id}>
          <span className="file-icon">▤</span>
          <div className="document-info">
            <strong title={doc.name}>{doc.name}</strong>
            <span>
              {doc.category} · {formatSize(doc.size)} · {doc.uploadedAt}
            </span>
          </div>
          <div className="document-actions">
            <button type="button" className="icon-button" onClick={() => onDownload(doc)} title="Download">
              ↓
            </button>
            <button type="button" className="icon-button delete-button" onClick={() => onRemove(doc.id)} title="Delete">
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">▤</div>
      <strong>{title}</strong>
      <p>{message}</p>
    </div>
  );
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default App;