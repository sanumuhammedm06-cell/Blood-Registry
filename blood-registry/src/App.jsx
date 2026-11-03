
import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import './App.css'

const navItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'donors', label: 'Donor Registry', icon: '♡' },
  { id: 'attendance', label: 'Attendance', icon: '✓' },
  { id: 'logs', label: 'Class-Time Logs', icon: '◷' },
  { id: 'reports', label: 'Reports', icon: '▤' },
]

const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const emptyDonorForm = {
  name: '',
  bloodgroup: '',
  phone: '',
  department: '',
  batch: '',
}

function App() {
  const [role, setRole] = useState('coordinator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [activePage, setActivePage] = useState('overview')

  const [donors, setDonors] = useState([])
  const [donorsLoading, setDonorsLoading] = useState(false)
  const [donorError, setDonorError] = useState('')
  const [showDonorForm, setShowDonorForm] = useState(false)
  const [savingDonor, setSavingDonor] = useState(false)
  const [donorForm, setDonorForm] = useState(emptyDonorForm)

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setUserProfile(null)

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setMessage(error.message)
        return
      }

      const userId = data.user.id

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', userId)
        .single()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        setMessage(
          'Your login exists, but your profile could not be found. Please contact the administrator.'
        )
        return
      }

      if (profile.role !== role) {
        await supabase.auth.signOut()
        setMessage(
          `This account is registered as ${profile.role}. Please select the correct login role.`
        )
        return
      }

      setUserProfile(profile)
      setActivePage('overview')
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setUserProfile(null)
    setEmail('')
    setPassword('')
    setMessage('')
    setActivePage('overview')
    setDonors([])
    setDonorError('')
    setShowDonorForm(false)
  }

  async function fetchDonors() {
    setDonorsLoading(true)
    setDonorError('')

    try {
      const { data, error } = await supabase
        .from('donors')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setDonors(data || [])
    } catch (error) {
      setDonorError(error.message || 'Could not load donors.')
    } finally {
      setDonorsLoading(false)
    }
  }

  async function handleAddDonor(event) {
    event.preventDefault()

    if (!userProfile) return

    setSavingDonor(true)
    setDonorError('')

    try {
      const { error } = await supabase.from('donors').insert({
        full_name: donorForm.name.trim(),
        blood_group: donorForm.bloodgroup,
        phone: donorForm.phone.trim(),
        department: donorForm.department.trim(),
        batch: donorForm.batch.trim(),
        created_by: userProfile.id,
      })

      if (error) throw error

      setDonorForm(emptyDonorForm)
      setShowDonorForm(false)

      await fetchDonors()
    } catch (error) {
      setDonorError(error.message || 'Could not save donor.')
    } finally {
      setSavingDonor(false)
    }
  }

  useEffect(() => {
    if (userProfile && activePage === 'donors') {
      fetchDonors()
    }
  }, [userProfile, activePage])

  function renderDashboardContent() {
    switch (activePage) {
      case 'donors':
        return (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Donor Registry</h2>
                <p>Manage and view registered blood donors.</p>
              </div>

              {userProfile.role === 'coordinator' && (
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => {
                    setDonorError('')
                    setShowDonorForm((current) => !current)
                  }}
                >
                  {showDonorForm ? 'Cancel' : '+ Add Donor'}
                </button>
              )}
            </div>

            {showDonorForm && userProfile.role === 'coordinator' && (
              <form className="donor-form" onSubmit={handleAddDonor}>
                <h3>Register New Donor</h3>

                <div className="donor-form-grid">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={donorForm.name}
                    onChange={(event) =>
                      setDonorForm({
                        ...donorForm,
                        name: event.target.value,
                      })
                    }
                    required
                  />

                  <select
                    value={donorForm.bloodgroup}
                    onChange={(event) =>
                      setDonorForm({
                        ...donorForm,
                        bloodgroup: event.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Select blood group</option>
                    {bloodGroups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>

                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={donorForm.phone}
                    onChange={(event) =>
                      setDonorForm({
                        ...donorForm,
                        phone: event.target.value,
                      })
                    }
                    required
                  />

                  <input
                    type="text"
                    placeholder="Department"
                    value={donorForm.department}
                    onChange={(event) =>
                      setDonorForm({
                        ...donorForm,
                        department: event.target.value,
                      })
                    }
                    required
                  />

                  <input
                    type="text"
                    placeholder="Batch / Year"
                    value={donorForm.batch}
                    onChange={(event) =>
                      setDonorForm({
                        ...donorForm,
                        batch: event.target.value,
                      })
                    }
                    required
                  />
                </div>

                <button
                  className="primary-action"
                  type="submit"
                  disabled={savingDonor}
                >
                  {savingDonor ? 'Saving...' : 'Save Donor'}
                </button>
              </form>
            )}

            {donorError && (
              <p className="donor-error">{donorError}</p>
            )}

            {donorsLoading ? (
              <div className="empty-state">
                <h3>Loading donors...</h3>
              </div>
            ) : donors.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">♡</span>
                <h3>No donors registered yet</h3>
                <p>
                  Click “Add Donor” to register the first blood donor.
                </p>
              </div>
            ) : (
              <div className="donor-table-wrapper">
                <table className="donor-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Blood Group</th>
                      <th>Phone</th>
                      <th>Department</th>
                      <th>Batch</th>
                    </tr>
                  </thead>

                  <tbody>
                    {donors.map((donor) => (
                      <tr key={donor.id}>
                        <td>{donor.full_name}</td>
                        <td>
                          <span className="blood-group-badge">
                            {donor.blood_group}
                          </span>
                        </td>
                        <td>{donor.phone}</td>
                        <td>{donor.department}</td>
                        <td>{donor.batch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )

      case 'attendance':
        return (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Attendance</h2>
                <p>View and verify attendance records.</p>
              </div>
            </div>

            <div className="empty-state">
              <span className="empty-icon">✓</span>
              <h3>Attendance records will appear here</h3>
              <p>
                We’ll connect this section to your attendance table next.
              </p>
            </div>
          </section>
        )

      case 'logs':
        return (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Class-Time Logs</h2>
                <p>Track students leaving class and returning.</p>
              </div>

              {userProfile.role === 'coordinator' && (
                <button className="primary-action" type="button">
                  + New Log
                </button>
              )}
            </div>

            <div className="empty-state">
              <span className="empty-icon">◷</span>
              <h3>Class-time logs will appear here</h3>
              <p>
                We’ll connect this section to your class_time_logs table.
              </p>
            </div>
          </section>
        )

      case 'reports':
        return (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Reports</h2>
                <p>Generate official attendance sheets and summaries.</p>
              </div>
            </div>

            <div className="empty-state">
              <span className="empty-icon">▤</span>
              <h3>Reports will appear here</h3>
              <p>
                We’ll build printable reports after connecting the records.
              </p>
            </div>
          </section>
        )

      default:
        return (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <div className="stat-icon red">♡</div>
                <p className="stat-label">Registered Donors</p>
                <h3>{donors.length}</h3>
                <span className="stat-note">Registered donors</span>
              </article>

              <article className="stat-card">
                <div className="stat-icon green">✓</div>
                <p className="stat-label">Attendance Records</p>
                <h3>—</h3>
                <span className="stat-note">Live count coming soon</span>
              </article>

              <article className="stat-card">
                <div className="stat-icon orange">◷</div>
                <p className="stat-label">Class-Time Logs</p>
                <h3>—</h3>
                <span className="stat-note">Live count coming soon</span>
              </article>

              <article className="stat-card">
                <div className="stat-icon purple">▤</div>
                <p className="stat-label">Reports Generated</p>
                <h3>—</h3>
                <span className="stat-note">Report feature coming soon</span>
              </article>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <h2>Welcome to your dashboard</h2>
                  <p>
                    Your NSS Blood Donation Cell records, all in one place.
                  </p>
                </div>
              </div>

              <div className="welcome-content">
                <div className="welcome-symbol">✦</div>
                <div>
                  <h3>Let's get your registry started</h3>
                  <p>
                    Use the navigation menu to explore the donor registry,
                    attendance, class-time logs, and reports. We’ll connect
                    each section to your Supabase database.
                  </p>
                </div>
              </div>
            </section>
          </>
        )
    }
  }

  if (userProfile) {
    return (
      <main className="dashboard-layout">
        <aside className="dashboard-sidebar">
          <div className="dashboard-brand">
            <div className="brand-mark">✦</div>
            <div>
              <strong>NSS Blood Cell</strong>
              <span>Management Portal</span>
            </div>
          </div>

          <div className="sidebar-section-label">MENU</div>

          <nav className="dashboard-nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${activePage === item.id ? 'active' : ''
                  }`}
                onClick={() => setActivePage(item.id)}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <div className="user-avatar">
                {userProfile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <strong>{userProfile.full_name}</strong>
                <span>
                  {userProfile.role === 'coordinator'
                    ? 'Coordinator'
                    : 'Faculty'}
                </span>
              </div>
            </div>

            <button
              type="button"
              className="sidebar-signout"
              onClick={handleSignOut}
            >
              ↪ Sign Out
            </button>
          </div>
        </aside>

        <main className="dashboard-main">
          <header className="dashboard-topbar">
            <div>
              <span className="topbar-eyebrow">
                NSS BLOOD DONATION CELL
              </span>
              <h1>
                {navItems.find((item) => item.id === activePage)?.label ||
                  'Overview'}
              </h1>
            </div>

            <div className="topbar-user">
              <div className="topbar-user-text">
                <strong>{userProfile.full_name}</strong>
                <span>
                  {userProfile.role === 'coordinator'
                    ? 'Coordinator'
                    : 'Faculty'}
                </span>
              </div>

              <div className="user-avatar topbar-avatar">
                {userProfile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </header>

          <div className="dashboard-body">
            {renderDashboardContent()}
          </div>

          <footer className="dashboard-footer">
            NSS Blood Donation Cell · Authorized access only
          </footer>
        </main>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <aside className="auth-banner">
          <div>
            <div className="brand-pill">
              <span className="droplet">✦</span>
              NSS Blood Donation Cell
            </div>

            <h1>Blood Donor Registry &amp; Class-Time Log</h1>

            <p className="banner-description">
              Role-based portal for logging student blood donors and
              bystanders leaving class, tracking time away, and generating
              official attendance sheets.
            </p>

            <div className="access-card">
              <h3>Coordinator Access (Read &amp; Write)</h3>
              <p>
                Manage donor records, attendance, class-time logs, and
                official print sheets.
              </p>
            </div>

            <div className="access-card faculty-card">
              <h3>Faculty Access</h3>
              <p>
                View shared records, verify attendance, and access
                official attendance sheets.
              </p>
            </div>
          </div>

          <div className="banner-footer">
            <span>♙</span>
            Authorized portal for NSS Camp Coordinators and Faculty Advisors.
          </div>
        </aside>

        <section className="auth-form-panel">
          <div className="form-heading">
            <div>
              <h2>Sign in to Portal</h2>
              <p>Select your role and enter your access credentials.</p>
            </div>
          </div>

          <div className="role-tabs">
            <button
              type="button"
              className={role === 'coordinator' ? 'active' : ''}
              onClick={() => setRole('coordinator')}
            >
              ✎ Coordinator Login
            </button>

            <button
              type="button"
              className={role === 'faculty' ? 'active' : ''}
              onClick={() => setRole('faculty')}
            >
              ♧ Faculty Login
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-field">
              <label htmlFor="email">EMAIL ADDRESS *</label>
              <div className="input-wrap">
                <span className="field-icon">♙</span>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter your registered email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <div className="label-row">
                <label htmlFor="password">ACCESS PASSWORD *</label>
                <button
                  type="button"
                  className="show-password"
                  onClick={() => setShowPassword((current) => !current)}
                >
                  {showPassword ? 'Hide password' : 'Show password'}
                </button>
              </div>

              <div className="input-wrap">
                <span className="field-icon">⚿</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>
            </div>

            {message && <p className="auth-message">{message}</p>}

            <button
              className="signin-button"
              type="submit"
              disabled={loading}
            >
              {loading
                ? 'Signing in...'
                : `Sign In as ${role === 'coordinator' ? 'Coordinator' : 'Faculty'
                } →`}
            </button>
          </form>

          <div className="form-bottom">
            <span>🔒</span>
            Access restricted to authorized users.
          </div>
        </section>
      </section>
    </main>
  )
}

export default App
