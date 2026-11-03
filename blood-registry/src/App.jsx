
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

const classHours = [
  { number: 1, label: '1st Hour', time: '9:00–10:00 AM' },
  { number: 2, label: '2nd Hour', time: '10:05–11:05 AM' },
  { number: 3, label: '3rd Hour', time: '11:10 AM–12:10 PM' },
  { number: 4, label: '4th Hour', time: '12:10–1:05 PM' },
  { number: 5, label: '5th Hour', time: '2:05–3:05 PM' },
  { number: 6, label: '6th Hour', time: '3:15–4:15 PM' },
]

const emptyDonorForm = {
  name: '',
  bloodgroup: '',
  phone: '',
  department: '',
  batch: '',
  check_in_at: '',
  check_out_at: '',
}

function getTodayDate() {
  const date = new Date()
  const pad = (number) => String(number).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}`
}

// Convert a database timestamp into the value expected by datetime-local.
function toDateTimeLocal(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  const pad = (number) => String(number).padStart(2, '0')

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// Convert a datetime-local value into an ISO timestamp for Supabase.
function fromDateTimeLocal(value) {
  if (!value) return null

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return null

  return date.toISOString()
}

// Display a database timestamp in the user's local date and time.
function formatDateTime(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return '—'

  return date.toLocaleString()
}

// Calculate the time between check-in and check-out.
function calculateDuration(checkInValue, checkOutValue) {
  if (!checkInValue || !checkOutValue) return '—'

  const checkIn = new Date(checkInValue)
  const checkOut = new Date(checkOutValue)

  if (
    Number.isNaN(checkIn.getTime()) ||
    Number.isNaN(checkOut.getTime()) ||
    checkOut < checkIn
  ) {
    return '—'
  }

  const totalMinutes = Math.floor((checkOut - checkIn) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return `${hours}h ${minutes}m`
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

  // Donor registry state
  const [donors, setDonors] = useState([])
  const [donorsLoading, setDonorsLoading] = useState(false)
  const [donorError, setDonorError] = useState('')
  const [showDonorForm, setShowDonorForm] = useState(false)
  const [savingDonor, setSavingDonor] = useState(false)
  const [donorForm, setDonorForm] = useState(emptyDonorForm)
  const [editingDonorId, setEditingDonorId] = useState(null)

  // Class-time log state
  const [classLogs, setClassLogs] = useState([])
  const [classLogsLoading, setClassLogsLoading] = useState(false)
  const [classLogsError, setClassLogsError] = useState('')
  const [showClassLogForm, setShowClassLogForm] = useState(false)
  const [savingClassLog, setSavingClassLog] = useState(false)

  const [classLogForm, setClassLogForm] = useState({
    donor_id: '',
    credit_date: getTodayDate(),
    hours: [],
  })

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
    setDonorForm(emptyDonorForm)
    setEditingDonorId(null)

    setClassLogs([])
    setClassLogsError('')
    setShowClassLogForm(false)
    setClassLogForm({
      donor_id: '',
      credit_date: getTodayDate(),
      hours: [],
    })
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

  function resetDonorForm() {
    setDonorForm(emptyDonorForm)
    setEditingDonorId(null)
    setShowDonorForm(false)
    setDonorError('')
  }

  function handleOpenAddDonor() {
    setDonorForm(emptyDonorForm)
    setEditingDonorId(null)
    setDonorError('')
    setShowDonorForm(true)
  }

  function handleEditDonor(donor) {
    setDonorError('')
    setEditingDonorId(donor.id)

    setDonorForm({
      name: donor.full_name || '',
      bloodgroup: donor.blood_group || '',
      phone: donor.phone || '',
      department: donor.department || '',
      batch: donor.batch || '',
      check_in_at: toDateTimeLocal(donor.check_in_at),
      check_out_at: toDateTimeLocal(donor.check_out_at),
    })

    setShowDonorForm(true)
  }

  async function handleSaveDonor(event) {
    event.preventDefault()

    if (!userProfile || userProfile.role !== 'coordinator') return

    setSavingDonor(true)
    setDonorError('')

    const donorData = {
      full_name: donorForm.name.trim(),
      blood_group: donorForm.bloodgroup,
      phone: donorForm.phone.trim(),
      department: donorForm.department.trim(),
      batch: donorForm.batch.trim(),
      check_in_at: fromDateTimeLocal(donorForm.check_in_at),
      check_out_at: fromDateTimeLocal(donorForm.check_out_at),
    }

    try {
      let error

      if (editingDonorId !== null) {
        const result = await supabase
          .from('donors')
          .update(donorData)
          .eq('id', editingDonorId)

        error = result.error
      } else {
        const result = await supabase.from('donors').insert({
          ...donorData,
          created_by: userProfile.id,
        })

        error = result.error
      }

      if (error) throw error

      resetDonorForm()
      await fetchDonors()
    } catch (error) {
      setDonorError(error.message || 'Could not save donor.')
    } finally {
      setSavingDonor(false)
    }
  }

  // Fetch saved class-time credits and the related donor information.
  async function fetchClassLogs() {
    setClassLogsLoading(true)
    setClassLogsError('')

    try {
      const { data, error } = await supabase
        .from('class_hour_credits')
        .select(`
          id,
          donor_id,
          credit_date,
          hour_number,
          created_at,
          donor:donors (
            full_name,
            department,
            batch
          )
        `)
        .order('credit_date', { ascending: false })
        .order('hour_number', { ascending: true })

      if (error) throw error

      setClassLogs(data || [])
    } catch (error) {
      setClassLogsError(error.message || 'Could not load class-time logs.')
    } finally {
      setClassLogsLoading(false)
    }
  }

  function resetClassLogForm() {
    setClassLogForm({
      donor_id: '',
      credit_date: getTodayDate(),
      hours: [],
    })

    setShowClassLogForm(false)
    setClassLogsError('')
  }

  function toggleClassHour(hourNumber) {
    setClassLogForm((current) => ({
      ...current,
      hours: current.hours.includes(hourNumber)
        ? current.hours.filter((hour) => hour !== hourNumber)
        : [...current.hours, hourNumber].sort((a, b) => a - b),
    }))
  }

  async function handleSaveClassLog(event) {
    event.preventDefault()

    if (!userProfile || userProfile.role !== 'coordinator') return

    if (!classLogForm.donor_id) {
      setClassLogsError('Please select a student.')
      return
    }

    if (!classLogForm.credit_date) {
      setClassLogsError('Please select a date.')
      return
    }

    if (classLogForm.hours.length === 0) {
      setClassLogsError('Please select at least one class hour.')
      return
    }

    setSavingClassLog(true)
    setClassLogsError('')

    const records = classLogForm.hours.map((hourNumber) => ({
      donor_id: Number(classLogForm.donor_id),
      credit_date: classLogForm.credit_date,
      hour_number: hourNumber,
      created_by: userProfile.id,
    }))

    try {
      const { error } = await supabase
        .from('class_hour_credits')
        .insert(records)

      if (error) throw error

      resetClassLogForm()
      await fetchClassLogs()
    } catch (error) {
      if (error.code === '23505') {
        setClassLogsError(
          'A credit already exists for this student, date, and hour. Check the saved records.'
        )
      } else {
        setClassLogsError(
          error.message || 'Could not save class-time credits.'
        )
      }
    } finally {
      setSavingClassLog(false)
    }
  }

  // Load records when the user opens the relevant page.
  useEffect(() => {
    if (!userProfile) return

    if (activePage === 'donors' || activePage === 'attendance') {
      fetchDonors()
    }

    if (activePage === 'logs') {
      fetchDonors()
      fetchClassLogs()
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
                    if (showDonorForm) {
                      resetDonorForm()
                    } else {
                      handleOpenAddDonor()
                    }
                  }}
                >
                  {showDonorForm ? 'Cancel' : '+ Add Donor'}
                </button>
              )}
            </div>

            {showDonorForm && userProfile.role === 'coordinator' && (
              <form className="donor-form" onSubmit={handleSaveDonor}>
                <h3>
                  {editingDonorId !== null
                    ? 'Edit Donor'
                    : 'Register New Donor'}
                </h3>

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

                  <div className="donor-time-field">
                    <label htmlFor="donor-check-in">Check-in time</label>
                    <input
                      id="donor-check-in"
                      type="datetime-local"
                      value={donorForm.check_in_at}
                      onChange={(event) =>
                        setDonorForm({
                          ...donorForm,
                          check_in_at: event.target.value,
                        })
                      }
                    />
                  </div>

                  <div className="donor-time-field">
                    <label htmlFor="donor-check-out">Check-out time</label>
                    <input
                      id="donor-check-out"
                      type="datetime-local"
                      value={donorForm.check_out_at}
                      onChange={(event) =>
                        setDonorForm({
                          ...donorForm,
                          check_out_at: event.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                <div className="donor-form-actions">
                  <button
                    className="primary-action"
                    type="submit"
                    disabled={savingDonor}
                  >
                    {savingDonor
                      ? 'Saving...'
                      : editingDonorId !== null
                        ? 'Save Changes'
                        : 'Save Donor'}
                  </button>

                  <button
                    className="secondary-action"
                    type="button"
                    onClick={resetDonorForm}
                    disabled={savingDonor}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {donorError && <p className="donor-error">{donorError}</p>}

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
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      {userProfile.role === 'coordinator' && (
                        <th>Actions</th>
                      )}
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

                        <td>{donor.phone || '—'}</td>
                        <td>{donor.department || '—'}</td>
                        <td>{donor.batch || '—'}</td>
                        <td>{formatDateTime(donor.check_in_at)}</td>
                        <td>{formatDateTime(donor.check_out_at)}</td>

                        {userProfile.role === 'coordinator' && (
                          <td>
                            <button
                              className="secondary-action"
                              type="button"
                              onClick={() => handleEditDonor(donor)}
                            >
                              Edit
                            </button>
                          </td>
                        )}
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
                <h2>Donor Attendance</h2>
                <p>
                  View donor camp attendance and time spent at the camp.
                </p>
              </div>
            </div>

            {donorError ? (
              <p className="donor-error">{donorError}</p>
            ) : donorsLoading ? (
              <div className="empty-state">
                <h3>Loading attendance records...</h3>
              </div>
            ) : donors.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">✓</span>
                <h3>No attendance records yet</h3>
                <p>
                  Donor attendance will appear here after donors are registered.
                </p>
              </div>
            ) : (
              <div className="donor-table-wrapper">
                <table className="donor-table">
                  <thead>
                    <tr>
                      <th>Student Name</th>
                      <th>Department</th>
                      <th>Batch</th>
                      <th>Check-In</th>
                      <th>Check-Out</th>
                      <th>Duration</th>
                    </tr>
                  </thead>

                  <tbody>
                    {donors.map((donor) => (
                      <tr key={donor.id}>
                        <td>{donor.full_name}</td>
                        <td>{donor.department || '—'}</td>
                        <td>{donor.batch || '—'}</td>
                        <td>{formatDateTime(donor.check_in_at)}</td>
                        <td>{formatDateTime(donor.check_out_at)}</td>
                        <td>
                          {calculateDuration(
                            donor.check_in_at,
                            donor.check_out_at
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )

      case 'logs':
        return (
          <section className="dashboard-panel">
            <div className="panel-heading">
              <div>
                <h2>Class-Time Logs</h2>
                <p>
                  Assign class-hour attendance credit to students who donated
                  blood.
                </p>
              </div>

              {userProfile.role === 'coordinator' && (
                <button
                  className="primary-action"
                  type="button"
                  onClick={() => {
                    if (showClassLogForm) {
                      resetClassLogForm()
                    } else {
                      setClassLogsError('')
                      setShowClassLogForm(true)
                    }
                  }}
                >
                  {showClassLogForm ? 'Cancel' : '+ New Credit'}
                </button>
              )}
            </div>

            {showClassLogForm && userProfile.role === 'coordinator' && (
              <form className="donor-form" onSubmit={handleSaveClassLog}>
                <h3>Assign Class Attendance Credit</h3>

                <div className="donor-form-grid">
                  <div className="donor-time-field">
                    <label htmlFor="class-credit-student">Student</label>

                    <select
                      id="class-credit-student"
                      value={classLogForm.donor_id}
                      onChange={(event) =>
                        setClassLogForm({
                          ...classLogForm,
                          donor_id: event.target.value,
                        })
                      }
                      required
                    >
                      <option value="">Select student</option>

                      {donors.map((donor) => (
                        <option key={donor.id} value={donor.id}>
                          {donor.full_name} —{' '}
                          {donor.department || 'No department'}
                          {donor.batch ? ` (${donor.batch})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="donor-time-field">
                    <label htmlFor="class-credit-date">
                      Attendance date
                    </label>

                    <input
                      id="class-credit-date"
                      type="date"
                      value={classLogForm.credit_date}
                      onChange={(event) =>
                        setClassLogForm({
                          ...classLogForm,
                          credit_date: event.target.value,
                        })
                      }
                      required
                    />
                  </div>
                </div>

                <h3>Select class hours</h3>

                <div className="class-hours-grid">
                  {classHours.map((hour) => (
                    <label
                      key={hour.number}
                      className={`class-hour-option ${classLogForm.hours.includes(hour.number)
                        ? 'selected'
                        : ''
                        }`}
                    >
                      <input
                        type="checkbox"
                        checked={classLogForm.hours.includes(hour.number)}
                        onChange={() => toggleClassHour(hour.number)}
                      />

                      <span>
                        <strong>{hour.label}</strong>
                        <small>{hour.time}</small>
                      </span>
                    </label>
                  ))}
                </div>

                <div className="donor-form-actions">
                  <button
                    className="primary-action"
                    type="submit"
                    disabled={savingClassLog}
                  >
                    {savingClassLog ? 'Saving...' : 'Save Credits'}
                  </button>

                  <button
                    className="secondary-action"
                    type="button"
                    onClick={resetClassLogForm}
                    disabled={savingClassLog}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {classLogsError && (
              <p className="donor-error">{classLogsError}</p>
            )}

            {classLogsLoading ? (
              <div className="empty-state">
                <h3>Loading class-time logs...</h3>
              </div>
            ) : classLogs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">◷</span>
                <h3>No class credits recorded yet</h3>
                <p>
                  Use “New Credit” to assign attendance credit to a student.
                </p>
              </div>
            ) : (
              <div className="donor-table-wrapper">
                <table className="donor-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Department</th>
                      <th>Batch</th>
                      <th>Date</th>
                      <th>Class Hour</th>
                      <th>Time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {classLogs.map((log) => {
                      const hour = classHours.find(
                        (item) => item.number === log.hour_number
                      )

                      return (
                        <tr key={log.id}>
                          <td>
                            {log.donor?.full_name || 'Unknown student'}
                          </td>
                          <td>{log.donor?.department || '—'}</td>
                          <td>{log.donor?.batch || '—'}</td>
                          <td>{log.credit_date}</td>
                          <td>
                            {hour?.label || `Hour ${log.hour_number}`}
                          </td>
                          <td>{hour?.time || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                <h3>{classLogs.length}</h3>
                <span className="stat-note">Saved class-hour credits</span>
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
              assigning class-hour attendance credits.
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
