
import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from './lib/supabase'
import './App.css'

const navItems = [
  { id: 'overview', label: 'Overview', icon: '▦' },
  { id: 'drives', label: 'Drive Management', icon: '♥' },
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
  roll_number: '',
  blood_group: '',
  phone: '',
  department: '',
  batch: '',
  check_in_at: '',
  check_out_at: '',
}

const emptyDriveForm = {
  name: '',
  description: '',
  location: '',
  start_date: getTodayDate(),
  end_date: '',
}

function getTodayDate() {
  const date = new Date()
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function toDateTimeLocal(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromDateTimeLocal(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function formatDateTime(value) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

function calculateDuration(checkInValue, checkOutValue) {
  if (!checkInValue || !checkOutValue) return '—'

  const checkIn = new Date(checkInValue)
  const checkOut = new Date(checkOutValue)

  if (
    Number.isNaN(checkIn.getTime()) ||
    Number.isNaN(checkOut.getTime()) ||
    checkOut < checkIn
  ) return '—'

  const minutes = Math.floor((checkOut - checkIn) / 60000)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function App() {
  // ---------------- AUTHENTICATION ----------------

  const [role, setRole] = useState('coordinator')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [userProfile, setUserProfile] = useState(null)
  const [activePage, setActivePage] = useState('overview')

  // ---------------- DRIVES ----------------

  const [drives, setDrives] = useState([])
  const [selectedDriveId, setSelectedDriveId] = useState('')
  const [drivesLoading, setDrivesLoading] = useState(false)
  const [driveError, setDriveError] = useState('')
  const [showDriveForm, setShowDriveForm] = useState(false)
  const [savingDrive, setSavingDrive] = useState(false)
  const [driveForm, setDriveForm] = useState(emptyDriveForm)

  // Permanent drive deletion confirmation
  const [pendingDriveDeletion, setPendingDriveDeletion] = useState(null)
  const [driveDeleteConfirmation, setDriveDeleteConfirmation] = useState('')
  const [driveDeletePassword, setDriveDeletePassword] = useState('')
  const [showDriveDeletePassword, setShowDriveDeletePassword] = useState(false)
  const [deletingDrive, setDeletingDrive] = useState(false)
  const [driveDeleteError, setDriveDeleteError] = useState('')

  // ---------------- DONORS ----------------

  const [donors, setDonors] = useState([])
  const [allDonors, setAllDonors] = useState([])
  const [donorsLoading, setDonorsLoading] = useState(false)
  const [donorError, setDonorError] = useState('')
  const [showDonorForm, setShowDonorForm] = useState(false)
  const [savingDonor, setSavingDonor] = useState(false)
  const [donorForm, setDonorForm] = useState(emptyDonorForm)
  const [editingDonorId, setEditingDonorId] = useState(null)
  const [existingDonorId, setExistingDonorId] = useState('')

  // Student removal popup
  const [removingDonorId, setRemovingDonorId] = useState(null)
  const [pendingDonorRemoval, setPendingDonorRemoval] = useState(null)
  const [removalError, setRemovalError] = useState('')

  // ---------------- CLASS-HOUR CREDITS ----------------

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

  // ---------------- REPORTS ----------------

  const [reportDriveFilter, setReportDriveFilter] = useState('all')
  const [reportParticipants, setReportParticipants] = useState([])
  const [reportCredits, setReportCredits] = useState([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')

  // ---------------- DERIVED VALUES ----------------

  const selectedDrive = drives.find(
    (drive) => String(drive.id) === String(selectedDriveId)
  )

  const isCoordinator = userProfile?.role === 'coordinator'
  const driveIsWritable = selectedDrive?.status === 'active'

  // ---------------- AUTHENTICATION FUNCTIONS ----------------

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

      if (error) throw error

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        await supabase.auth.signOut()
        throw new Error('Your login exists, but your profile could not be found.')
      }

      if (profile.role !== role) {
        await supabase.auth.signOut()
        throw new Error(
          `This account is registered as ${profile.role}. Select the correct role.`
        )
      }

      setUserProfile(profile)
      setActivePage('overview')
      setMessage('')
    } catch (error) {
      setMessage(error.message || 'Could not sign in.')
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

    setDrives([])
    setSelectedDriveId('')
    setDonors([])
    setAllDonors([])
    setClassLogs([])
    setReportParticipants([])
    setReportCredits([])

    setPendingDonorRemoval(null)
    setRemovalError('')
    setRemovingDonorId(null)

    setPendingDriveDeletion(null)
    setDriveDeleteConfirmation('')
    setDriveDeletePassword('')
    setShowDriveDeletePassword(false)
    setDriveDeleteError('')
    setDeletingDrive(false)

    resetDonorForm()
    resetClassLogForm()
  }

  // ---------------- DRIVE MANAGEMENT ----------------

  async function fetchDrives() {
    setDrivesLoading(true)
    setDriveError('')

    try {
      const { data, error } = await supabase
        .from('drives')
        .select('*')
        .order('start_date', { ascending: false })

      if (error) throw error

      const rows = data || []
      setDrives(rows)

      setSelectedDriveId((current) => {
        if (rows.some((drive) => String(drive.id) === String(current))) {
          return current
        }

        const activeDrive = rows.find((drive) => drive.status === 'active')
        return String(activeDrive?.id || rows[0]?.id || '')
      })
    } catch (error) {
      setDriveError(error.message || 'Could not load drives.')
    } finally {
      setDrivesLoading(false)
    }
  }

  async function fetchAllDonors() {
    try {
      const { data, error } = await supabase
        .from('donors')
        .select('id, full_name, roll_number, blood_group, phone, department, batch')
        .order('full_name')

      if (error) throw error
      setAllDonors(data || [])
    } catch (error) {
      setDonorError(error.message || 'Could not load student profiles.')
    }
  }

  async function handleCreateDrive(event) {
    event.preventDefault()

    if (!isCoordinator) return

    if (!driveForm.name.trim()) {
      setDriveError('Enter a drive name.')
      return
    }

    if (!driveForm.start_date) {
      setDriveError('Select a start date.')
      return
    }

    if (driveForm.end_date && driveForm.end_date < driveForm.start_date) {
      setDriveError('The end date cannot be before the start date.')
      return
    }

    setSavingDrive(true)
    setDriveError('')

    try {
      const { data, error } = await supabase
        .from('drives')
        .insert({
          name: driveForm.name.trim(),
          description: driveForm.description.trim() || null,
          location: driveForm.location.trim() || null,
          start_date: driveForm.start_date,
          end_date: driveForm.end_date || null,
          status: 'active',
          created_by: userProfile.id,
        })
        .select()
        .single()

      if (error) throw error

      setDriveForm(emptyDriveForm)
      setShowDriveForm(false)

      await fetchDrives()

      setSelectedDriveId(String(data.id))
      setActivePage('donors')
    } catch (error) {
      setDriveError(error.message || 'Could not create drive.')
    } finally {
      setSavingDrive(false)
    }
  }

  async function changeDriveStatus(drive, newStatus) {
    if (!isCoordinator) return

    const actionText =
      newStatus === 'completed' ? 'mark as completed' : 'archive'

    const confirmed = window.confirm(
      `Are you sure you want to ${actionText} "${drive.name}"?\n\nThis will not delete its records.`
    )

    if (!confirmed) return

    setDriveError('')

    try {
      const updates = { status: newStatus }

      if (newStatus === 'archived') {
        updates.archived_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('drives')
        .update(updates)
        .eq('id', drive.id)

      if (error) throw error

      await fetchDrives()
    } catch (error) {
      setDriveError(error.message || 'Could not update drive.')
    }
  }

  function requestDriveDeletion(drive) {
    if (!isCoordinator || !drive) return

    setDriveDeleteError('')
    setDriveDeleteConfirmation('')
    setDriveDeletePassword('')
    setShowDriveDeletePassword(false)
    setPendingDriveDeletion(drive)
  }

  function closeDriveDeletion() {
    if (deletingDrive) return

    setPendingDriveDeletion(null)
    setDriveDeleteConfirmation('')
    setDriveDeletePassword('')
    setShowDriveDeletePassword(false)
    setDriveDeleteError('')
  }

  async function confirmDriveDeletion(event) {
    event.preventDefault()

    const drive = pendingDriveDeletion

    if (!drive || !isCoordinator || deletingDrive) return

    if (driveDeleteConfirmation !== drive.name) {
      setDriveDeleteError('The drive name does not match. Enter it exactly as shown.')
      return
    }

    if (!driveDeletePassword) {
      setDriveDeleteError('Enter your current coordinator password.')
      return
    }

    setDeletingDrive(true)
    setDriveDeleteError('')

    try {
      // Get the currently authenticated account.
      const { data: userData, error: userError } = await supabase.auth.getUser()

      if (userError) throw userError

      const currentUser = userData?.user

      if (!currentUser?.email || currentUser.id !== userProfile?.id) {
        throw new Error('Your authenticated account could not be verified. Sign in again.')
      }

      // Re-verify the coordinator's password with Supabase Auth.
      const { data: authData, error: authError } =
        await supabase.auth.signInWithPassword({
          email: currentUser.email,
          password: driveDeletePassword,
        })

      if (authError) {
        throw new Error('Password verification failed. Check your password and try again.')
      }

      if (!authData?.user || authData.user.id !== userProfile.id) {
        throw new Error('The verified account does not match the signed-in coordinator.')
      }

      // The database function independently checks coordinator role,
      // recent authentication and the exact drive name.
      const { error: deleteError } = await supabase.rpc('delete_drive', {
        p_drive_id: drive.id,
        p_confirmation_name: driveDeleteConfirmation,
      })

      if (deleteError) throw deleteError

      // Clear the modal and refresh the drive list.
      setPendingDriveDeletion(null)
      setDriveDeleteConfirmation('')
      setDriveDeletePassword('')
      setShowDriveDeletePassword(false)
      setDriveDeleteError('')

      if (String(selectedDriveId) === String(drive.id)) {
        setActivePage('drives')
      }

      await fetchDrives()
      await fetchAllDonors()
    } catch (error) {
      setDriveDeleteError(error.message || 'Could not permanently delete this drive.')
    } finally {
      setDeletingDrive(false)
    }
  }

  // ---------------- DONOR REGISTRY ----------------

  async function fetchDonors() {
    if (!selectedDriveId) {
      setDonors([])
      return
    }

    setDonorsLoading(true)
    setDonorError('')

    try {
      const { data, error } = await supabase
        .from('drive_donors')
        .select(`
          id,
          drive_id,
          donor_id,
          check_in_at,
          check_out_at,
          donor:donors (
            id,
            full_name,
            roll_number,
            blood_group,
            phone,
            department,
            batch
          )
        `)
        .eq('drive_id', Number(selectedDriveId))
        .order('created_at', { ascending: false })

      if (error) throw error

      setDonors(
        (data || [])
          .filter((item) => item.donor)
          .map((item) => ({
            ...item.donor,
            participation_id: item.id,
            check_in_at: item.check_in_at,
            check_out_at: item.check_out_at,
          }))
      )
    } catch (error) {
      setDonorError(error.message || 'Could not load drive donors.')
    } finally {
      setDonorsLoading(false)
    }
  }

  // Open the custom removal confirmation popup.
  function removeDonorFromDrive(donor) {
    if (
      !isCoordinator ||
      !driveIsWritable ||
      !selectedDriveId ||
      !selectedDrive
    ) {
      return
    }

    setRemovalError('')
    setPendingDonorRemoval(donor)
  }

  // Perform the removal after confirmation.
  async function confirmDonorRemoval() {
    const donor = pendingDonorRemoval

    if (
      !donor ||
      !isCoordinator ||
      !driveIsWritable ||
      !selectedDriveId
    ) {
      return
    }

    setRemovingDonorId(donor.id)
    setRemovalError('')

    try {
      const { data, error } = await supabase
        .from('drive_donors')
        .delete()
        .eq('id', donor.participation_id)
        .eq('drive_id', Number(selectedDriveId))
        .select('id')

      if (error) throw error

      if (!data || data.length === 0) {
        throw new Error(
          'No participation record was removed. Check your permissions and try again.'
        )
      }

      await fetchDonors()

      setPendingDonorRemoval(null)
      setRemovalError('')
    } catch (error) {
      setRemovalError(
        error.message || 'Could not remove the student from this drive.'
      )
    } finally {
      setRemovingDonorId(null)
    }
  }

  function resetDonorForm() {
    setDonorForm(emptyDonorForm)
    setEditingDonorId(null)
    setExistingDonorId('')
    setShowDonorForm(false)
  }

  function openNewDonorForm() {
    setDonorForm(emptyDonorForm)
    setEditingDonorId(null)
    setExistingDonorId('')
    setDonorError('')
    setShowDonorForm(true)
  }

  function openExistingDonorForm() {
    setDonorForm(emptyDonorForm)
    setEditingDonorId(null)
    setExistingDonorId('')
    setDonorError('')
    setShowDonorForm(true)
  }

  function handleEditDonor(donor) {
    setDonorError('')
    setEditingDonorId(donor.id)
    setExistingDonorId('')

    setDonorForm({
      name: donor.full_name || '',
      roll_number: donor.roll_number || '',
      blood_group: donor.blood_group || '',
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

    if (!isCoordinator || !selectedDriveId || !driveIsWritable) return

    setSavingDonor(true)
    setDonorError('')

    try {
      // Editing an existing student profile.
      if (editingDonorId !== null) {
        const { error: profileError } = await supabase
          .from('donors')
          .update({
            full_name: donorForm.name.trim(),
            roll_number: donorForm.roll_number.trim().toUpperCase(),
            blood_group: donorForm.blood_group,
            phone: donorForm.phone.trim(),
            department: donorForm.department.trim(),
            batch: donorForm.batch.trim(),
          })
          .eq('id', editingDonorId)

        if (profileError) throw profileError

        const { error: participationError } = await supabase
          .from('drive_donors')
          .update({
            check_in_at: fromDateTimeLocal(donorForm.check_in_at),
            check_out_at: fromDateTimeLocal(donorForm.check_out_at),
          })
          .eq('drive_id', Number(selectedDriveId))
          .eq('donor_id', editingDonorId)

        if (participationError) throw participationError
      }

      // Register an existing student profile.
      else if (existingDonorId) {
        const { error } = await supabase
          .from('drive_donors')
          .insert({
            drive_id: Number(selectedDriveId),
            donor_id: Number(existingDonorId),
            check_in_at: fromDateTimeLocal(donorForm.check_in_at),
            check_out_at: fromDateTimeLocal(donorForm.check_out_at),
          })

        if (error) {
          if (error.code === '23505') {
            throw new Error(
              'This student is already registered for this drive.'
            )
          }

          throw error
        }
      }

      // Create a new permanent student profile.
      else {
        const { data: newDonor, error: insertError } = await supabase
          .from('donors')
          .insert({
            full_name: donorForm.name.trim(),
            roll_number: donorForm.roll_number.trim().toUpperCase(),
            blood_group: donorForm.blood_group,
            phone: donorForm.phone.trim(),
            department: donorForm.department.trim(),
            batch: donorForm.batch.trim(),
            created_by: userProfile.id,
          })
          .select('id')
          .single()

        if (insertError) throw insertError

        // Link the new profile to the selected drive.
        const { error: linkError } = await supabase
          .from('drive_donors')
          .insert({
            drive_id: Number(selectedDriveId),
            donor_id: newDonor.id,
            check_in_at: fromDateTimeLocal(donorForm.check_in_at),
            check_out_at: fromDateTimeLocal(donorForm.check_out_at),
          })

        if (linkError) {
          // Attempt to roll back the newly created profile.
          const { error: rollbackError } = await supabase
            .from('donors')
            .delete()
            .eq('id', newDonor.id)

          if (rollbackError) {
            throw new Error(
              `The profile was created, but drive registration failed. Profile ID: ${newDonor.id}. Please contact the administrator.`
            )
          }

          throw linkError
        }
      }

      resetDonorForm()
      await fetchDonors()
      await fetchAllDonors()
    } catch (error) {
      setDonorError(error.message || 'Could not save donor.')
    } finally {
      setSavingDonor(false)
    }
  }

  // ---------------- ATTENDANCE ----------------

  async function updateParticipationTime(donor, field) {
    if (!isCoordinator || !driveIsWritable) return

    const currentValue = donor[field]
    const nextValue = currentValue ? null : new Date().toISOString()

    const { error } = await supabase
      .from('drive_donors')
      .update({ [field]: nextValue })
      .eq('drive_id', Number(selectedDriveId))
      .eq('donor_id', donor.id)

    if (error) {
      setDonorError(error.message || 'Could not update attendance.')
      return
    }

    await fetchDonors()
  }

  // ---------------- CLASS-HOUR CREDITS ----------------

  async function fetchClassLogs() {
    if (!selectedDriveId) {
      setClassLogs([])
      return
    }

    setClassLogsLoading(true)
    setClassLogsError('')

    try {
      const { data, error } = await supabase
        .from('class_hour_credits')
        .select(`
          id,
          drive_id,
          donor_id,
          credit_date,
          hour_number,
          created_at,
          donor:donors (
            full_name,
            roll_number,
            department,
            batch
          )
        `)
        .eq('drive_id', Number(selectedDriveId))
        .order('credit_date', { ascending: false })
        .order('hour_number', { ascending: true })

      if (error) throw error

      setClassLogs(data || [])
    } catch (error) {
      setClassLogsError(error.message || 'Could not load class-hour credits.')
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

    if (!isCoordinator || !selectedDriveId || !driveIsWritable) return

    if (!classLogForm.donor_id) {
      setClassLogsError('Please select a student.')
      return
    }

    if (!classLogForm.credit_date || classLogForm.hours.length === 0) {
      setClassLogsError('Select a date and at least one class hour.')
      return
    }

    setSavingClassLog(true)
    setClassLogsError('')

    const records = classLogForm.hours.map((hourNumber) => ({
      drive_id: Number(selectedDriveId),
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
          'One or more selected class-hour credits already exist for this student, date and drive.'
        )
      } else {
        setClassLogsError(
          error.message || 'Could not save class-hour credits.'
        )
      }
    } finally {
      setSavingClassLog(false)
    }
  }

  // ---------------- REPORT DATA ----------------

  async function fetchReports() {
    setReportsLoading(true)
    setReportsError('')

    try {
      const [participantsResult, creditsResult] = await Promise.all([
        supabase
          .from('drive_donors')
          .select(`
            id,
            drive_id,
            donor_id,
            check_in_at,
            check_out_at,
            donor:donors (
              id,
              full_name,
              roll_number,
              blood_group,
              department,
              batch
            )
          `)
          .order('created_at', { ascending: false }),
        supabase
          .from('class_hour_credits')
          .select(`
            id,
            drive_id,
            donor_id,
            credit_date,
            hour_number,
            donor:donors (
              id,
              full_name,
              roll_number,
              department,
              batch
            )
          `)
          .order('credit_date', { ascending: false }),
      ])

      if (participantsResult.error) throw participantsResult.error
      if (creditsResult.error) throw creditsResult.error

      setReportParticipants(
        (participantsResult.data || []).filter((row) => row.donor)
      )
      setReportCredits(
        (creditsResult.data || []).filter((row) => row.donor)
      )
    } catch (error) {
      setReportsError(error.message || 'Could not load report data.')
    } finally {
      setReportsLoading(false)
    }
  }

  function downloadCsv(filename, rows) {
    if (!rows.length) {
      setReportsError('There are no records to export for this selection.')
      return
    }

    const headers = Object.keys(rows[0])
    const escapeCell = (value) => {
      const text = value === null || value === undefined ? '' : String(value)
      return `"${text.replace(/"/g, '""')}"`
    }
    const csv = [
      headers.map(escapeCell).join(','),
      ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(',')),
    ].join('\r\n')

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  function exportReportsToExcel(visibleReportDrives, visibleReportParticipants, visibleReportCredits) {
    const driveName = (id) => drives.find((drive) => String(drive.id) === String(id))?.name || `Drive ${id}`
    const participantRows = visibleReportParticipants.map((row) => ({
      Drive: driveName(row.drive_id),
      Student: row.donor.full_name || '',
      'Roll Number': row.donor.roll_number || '',
      'Blood Group': row.donor.blood_group || '',
      Department: row.donor.department || '',
      Batch: row.donor.batch || '',
      'Check In': formatDateTime(row.check_in_at),
      'Check Out': formatDateTime(row.check_out_at),
      Duration: calculateDuration(row.check_in_at, row.check_out_at),
    }))

    const creditRows = visibleReportCredits.map((row) => ({
      Drive: driveName(row.drive_id),
      Student: row.donor.full_name || '',
      'Roll Number': row.donor.roll_number || '',
      Department: row.donor.department || '',
      Batch: row.donor.batch || '',
      Date: row.credit_date,
      'Class Hour': classHours.find((hour) => hour.number === row.hour_number)?.label || `Hour ${row.hour_number}`,
      'Hour Number': row.hour_number,
    }))

    const driveRows = visibleReportDrives.map((drive) => {
      const registrations = reportParticipants.filter((row) => row.drive_id === drive.id)
      return {
        Drive: drive.name,
        Location: drive.location || '',
        Status: drive.status,
        'Start Date': drive.start_date,
        'End Date': drive.end_date || '',
        'Registered Participants': registrations.length,
        'Checked In': registrations.filter((row) => row.check_in_at).length,
        'Checked Out': registrations.filter((row) => row.check_out_at).length,
        'Class-Hour Credits': reportCredits.filter((row) => row.drive_id === drive.id).length,
      }
    })

    const studentCreditGroups = Object.values(visibleReportCredits.reduce((summary, row) => {
      const key = `${row.drive_id}-${row.donor_id}`
      if (!summary[key]) {
        summary[key] = {
          Drive: driveName(row.drive_id),
          Student: row.donor.full_name || '',
          'Roll Number': row.donor.roll_number || '',
          Department: row.donor.department || '',
          Batch: row.donor.batch || '',
          'Class Hours to Be Given': [],
          'Total Credits': 0,
        }
      }

      // Keep one entry for every saved credit record. If the same hour number
      // was credited on different dates, it correctly appears more than once.
      summary[key]['Class Hours to Be Given'].push(Number(row.hour_number))
      summary[key]['Total Credits'] += 1
      return summary
    }, {}))

    const studentCreditRows = studentCreditGroups.map((student) => ({
      ...student,
      'Class Hours to Be Given': student['Class Hours to Be Given']
        .sort((a, b) => a - b)
        .join(', '),
    }))

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(driveRows), 'Drive Summary')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(participantRows), 'Attendance')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(creditRows), 'Class Credit Details')
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(studentCreditRows), 'Credits per Student')
    XLSX.writeFile(workbook, `NSS-Reports-${getTodayDate()}.xlsx`)
  }

  // ---------------- DATA LOADING ----------------

  useEffect(() => {
    if (!userProfile) return

    fetchDrives()
    fetchAllDonors()
  }, [userProfile])

  useEffect(() => {
    if (!userProfile || !selectedDriveId) {
      setDonors([])
      setClassLogs([])
      return
    }

    fetchDonors()
    fetchClassLogs()
  }, [userProfile, selectedDriveId])

  useEffect(() => {
    if (userProfile && activePage === 'reports') {
      fetchReports()
    }
  }, [userProfile, activePage])

  // ---------------- DRIVE PAGE ----------------

  function renderDrivesPage() {
    return (
      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <h2>Drive Management</h2>
            <p>Create drives and preserve their individual records.</p>
          </div>

          {isCoordinator && (
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                setShowDriveForm((current) => !current)
                setDriveError('')
              }}
            >
              {showDriveForm ? 'Cancel' : '+ Create Drive'}
            </button>
          )}
        </div>

        {driveError && <p className="donor-error">{driveError}</p>}

        {showDriveForm && isCoordinator && (
          <form className="donor-form" onSubmit={handleCreateDrive}>
            <h3>Create a New Drive</h3>

            <div className="donor-form-grid">
              <input
                placeholder="Drive name"
                value={driveForm.name}
                onChange={(event) =>
                  setDriveForm({ ...driveForm, name: event.target.value })
                }
                required
              />

              <input
                placeholder="Location"
                value={driveForm.location}
                onChange={(event) =>
                  setDriveForm({ ...driveForm, location: event.target.value })
                }
              />

              <div className="donor-time-field">
                <label>Start date</label>
                <input
                  type="date"
                  value={driveForm.start_date}
                  onChange={(event) =>
                    setDriveForm({
                      ...driveForm,
                      start_date: event.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="donor-time-field">
                <label>End date</label>
                <input
                  type="date"
                  value={driveForm.end_date}
                  onChange={(event) =>
                    setDriveForm({
                      ...driveForm,
                      end_date: event.target.value,
                    })
                  }
                />
              </div>

              <textarea
                placeholder="Description (optional)"
                value={driveForm.description}
                onChange={(event) =>
                  setDriveForm({
                    ...driveForm,
                    description: event.target.value,
                  })
                }
              />
            </div>

            <div className="donor-form-actions">
              <button className="primary-action" disabled={savingDrive}>
                {savingDrive ? 'Creating...' : 'Create Drive'}
              </button>

              <button
                type="button"
                className="secondary-action"
                onClick={() => setShowDriveForm(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {drivesLoading ? (
          <div className="empty-state">
            <h3>Loading drives...</h3>
          </div>
        ) : drives.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">♥</span>
            <h3>No drives created yet</h3>
            <p>A coordinator can create the first drive.</p>
          </div>
        ) : (
          <div className="donor-table-wrapper">
            <table className="donor-table">
              <thead>
                <tr>
                  <th>Drive</th>
                  <th>Location</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {drives.map((drive) => (
                  <tr key={drive.id}>
                    <td>
                      <strong>{drive.name}</strong>
                      {drive.description && <small>{drive.description}</small>}
                    </td>

                    <td>{drive.location || '—'}</td>
                    <td>{drive.start_date}</td>
                    <td>{drive.end_date || '—'}</td>

                    <td>
                      <span className="blood-group-badge">
                        {drive.status}
                      </span>
                    </td>

                    <td>
                      <button
                        className="secondary-action"
                        type="button"
                        onClick={() =>
                          setSelectedDriveId(String(drive.id))
                        }
                      >
                        {String(selectedDriveId) === String(drive.id)
                          ? 'Selected'
                          : 'Select'}
                      </button>

                      {isCoordinator && drive.status === 'active' && (
                        <>
                          <button
                            className="secondary-action"
                            type="button"
                            onClick={() =>
                              changeDriveStatus(drive, 'completed')
                            }
                          >
                            Complete
                          </button>

                          <button
                            className="secondary-action"
                            type="button"
                            onClick={() =>
                              changeDriveStatus(drive, 'archived')
                            }
                          >
                            Archive
                          </button>
                        </>
                      )}

                      {isCoordinator && (
                        <button
                          className="remove-confirm-button"
                          type="button"
                          disabled={deletingDrive}
                          onClick={() => requestDriveDeletion(drive)}
                        >
                          Delete Drive
                        </button>
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
  }

  // ---------------- DONOR PAGE ----------------

  function renderDonorPage() {
    const linkedIds = new Set(donors.map((donor) => String(donor.id)))

    const availableDonors = allDonors.filter(
      (donor) => !linkedIds.has(String(donor.id))
    )

    return (
      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <h2>Donor Registry</h2>
            <p>
              {selectedDrive
                ? `Students registered for ${selectedDrive.name}.`
                : 'Select a drive to view its donors.'}
            </p>
          </div>

          {isCoordinator && driveIsWritable && selectedDrive && (
            <button
              className="primary-action"
              type="button"
              onClick={() => {
                if (showDonorForm) {
                  resetDonorForm()
                } else {
                  openNewDonorForm()
                }
              }}
            >
              {showDonorForm ? 'Cancel' : '+ Add Donor'}
            </button>
          )}
        </div>

        {!selectedDrive && (
          <div className="empty-state">
            <h3>Select a drive first</h3>
            <p>Open Drive Management and select a drive.</p>
          </div>
        )}

        {selectedDrive && !driveIsWritable && (
          <p className="donor-error">
            This drive is {selectedDrive.status}. Its records are read-only.
          </p>
        )}

        {showDonorForm && isCoordinator && driveIsWritable && (
          <form className="donor-form" onSubmit={handleSaveDonor}>
            <h3>
              {editingDonorId !== null
                ? 'Edit Student'
                : existingDonorId
                  ? 'Register Existing Student'
                  : 'Register New Student'}
            </h3>

            {editingDonorId === null && (
              <div className="donor-form-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    setExistingDonorId('')
                    setDonorForm(emptyDonorForm)
                  }}
                >
                  Create New Profile
                </button>

                <button
                  type="button"
                  className="secondary-action"
                  onClick={openExistingDonorForm}
                >
                  Register Existing Profile
                </button>
              </div>
            )}

            {editingDonorId === null && (
              <div className="donor-time-field">
                <label>Existing student profile</label>

                <select
                  value={existingDonorId}
                  onChange={(event) => {
                    setExistingDonorId(event.target.value)
                    setDonorForm(emptyDonorForm)
                  }}
                >
                  <option value="">Create a new student profile</option>

                  {availableDonors.map((donor) => (
                    <option key={donor.id} value={donor.id}>
                      {donor.full_name} — {donor.roll_number || 'No roll number'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!existingDonorId && (
              <div className="donor-form-grid">
                <input
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

                <input
                  placeholder="College roll number"
                  value={donorForm.roll_number}
                  onChange={(event) =>
                    setDonorForm({
                      ...donorForm,
                      roll_number: event.target.value.toUpperCase(),
                    })
                  }
                  required
                />

                <select
                  value={donorForm.blood_group}
                  onChange={(event) =>
                    setDonorForm({
                      ...donorForm,
                      blood_group: event.target.value,
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
            )}

            <div className="donor-form-grid">
              <div className="donor-time-field">
                <label>Drive check-in time</label>
                <input
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
                <label>Drive check-out time</label>
                <input
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
              <button className="primary-action" disabled={savingDonor}>
                {savingDonor ? 'Saving...' : 'Save Registration'}
              </button>

              <button
                type="button"
                className="secondary-action"
                onClick={resetDonorForm}
                disabled={savingDonor}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {donorError && <p className="donor-error">{donorError}</p>}

        {selectedDrive && (
          donorsLoading ? (
            <div className="empty-state">
              <h3>Loading donors...</h3>
            </div>
          ) : donors.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">♡</span>
              <h3>No students registered for this drive</h3>
              <p>Register a new student or add an existing student profile.</p>
            </div>
          ) : (
            <div className="donor-table-wrapper">
              <table className="donor-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Roll Number</th>
                    <th>Blood Group</th>
                    <th>Phone</th>
                    <th>Department</th>
                    <th>Batch</th>
                    {isCoordinator && <th>Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {donors.map((donor) => (
                    <tr key={donor.id}>
                      <td>{donor.full_name}</td>
                      <td>{donor.roll_number || '—'}</td>

                      <td>
                        <span className="blood-group-badge">
                          {donor.blood_group}
                        </span>
                      </td>

                      <td>{donor.phone || '—'}</td>
                      <td>{donor.department || '—'}</td>
                      <td>{donor.batch || '—'}</td>

                      {isCoordinator && (
                        <td>
                          {driveIsWritable && (
                            <>
                              <button
                                className="secondary-action"
                                type="button"
                                onClick={() => handleEditDonor(donor)}
                              >
                                Edit
                              </button>

                              <button
                                className="secondary-action"
                                type="button"
                                disabled={removingDonorId === donor.id}
                                onClick={() => removeDonorFromDrive(donor)}
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </section>
    )
  }

  // ---------------- ATTENDANCE PAGE ----------------

  function renderAttendancePage() {
    return (
      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <h2>Drive Attendance</h2>
            <p>Check-in and check-out records for the selected drive.</p>
          </div>
        </div>

        {!selectedDrive ? (
          <div className="empty-state">
            <h3>Select a drive first</h3>
          </div>
        ) : donorsLoading ? (
          <div className="empty-state">
            <h3>Loading attendance...</h3>
          </div>
        ) : donors.length === 0 ? (
          <div className="empty-state">
            <h3>No participants registered yet</h3>
          </div>
        ) : (
          <div className="donor-table-wrapper">
            <table className="donor-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Roll Number</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Duration</th>
                  {isCoordinator && <th>Actions</th>}
                </tr>
              </thead>

              <tbody>
                {donors.map((donor) => (
                  <tr key={donor.id}>
                    <td>{donor.full_name}</td>
                    <td>{donor.roll_number || '—'}</td>
                    <td>{formatDateTime(donor.check_in_at)}</td>
                    <td>{formatDateTime(donor.check_out_at)}</td>

                    <td>
                      {calculateDuration(
                        donor.check_in_at,
                        donor.check_out_at
                      )}
                    </td>

                    {isCoordinator && (
                      <td>
                        {driveIsWritable && (
                          <>
                            <button
                              type="button"
                              className="secondary-action"
                              onClick={() =>
                                updateParticipationTime(donor, 'check_in_at')
                              }
                            >
                              {donor.check_in_at ? 'Undo In' : 'Check In'}
                            </button>

                            <button
                              type="button"
                              className="secondary-action"
                              disabled={!donor.check_in_at}
                              onClick={() =>
                                updateParticipationTime(donor, 'check_out_at')
                              }
                            >
                              {donor.check_out_at ? 'Undo Out' : 'Check Out'}
                            </button>
                          </>
                        )}
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
  }

  // ---------------- CLASS LOG PAGE ----------------

  function renderLogsPage() {
    return (
      <section className="dashboard-panel">
        <div className="panel-heading">
          <div>
            <h2>Class-Time Logs</h2>
            <p>Class-hour credits for the selected drive.</p>
          </div>

          {isCoordinator && driveIsWritable && selectedDrive && (
            <button
              className="primary-action"
              type="button"
              onClick={() =>
                setShowClassLogForm((current) => !current)
              }
            >
              {showClassLogForm ? 'Cancel' : '+ New Credit'}
            </button>
          )}
        </div>

        {!selectedDrive ? (
          <div className="empty-state">
            <h3>Select a drive first</h3>
          </div>
        ) : (
          <>
            {!driveIsWritable && (
              <p className="donor-error">
                This drive is {selectedDrive.status}. Credits are read-only.
              </p>
            )}

            {showClassLogForm && isCoordinator && driveIsWritable && (
              <form className="donor-form" onSubmit={handleSaveClassLog}>
                <h3>Assign Class Attendance Credit</h3>

                <div className="donor-form-grid">
                  <div className="donor-time-field">
                    <label>Student</label>

                    <select
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
                          {donor.full_name} — {donor.roll_number || 'No roll number'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="donor-time-field">
                    <label>Attendance date</label>

                    <input
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
                    disabled={savingClassLog}
                  >
                    {savingClassLog ? 'Saving...' : 'Save Credits'}
                  </button>

                  <button
                    type="button"
                    className="secondary-action"
                    onClick={resetClassLogForm}
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
                <h3>Loading credits...</h3>
              </div>
            ) : classLogs.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">◷</span>
                <h3>No class credits for this drive</h3>
              </div>
            ) : (
              <div className="donor-table-wrapper">
                <table className="donor-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll Number</th>
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
                          <td>{log.donor?.full_name || 'Unknown'}</td>
                          <td>{log.donor?.roll_number || '—'}</td>
                          <td>{log.donor?.department || '—'}</td>
                          <td>{log.donor?.batch || '—'}</td>
                          <td>{log.credit_date}</td>
                          <td>{hour?.label || `Hour ${log.hour_number}`}</td>
                          <td>{hour?.time || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    )
  }

  // ---------------- REPORTS PAGE ----------------

  function renderReportsPage() {
    const visibleReportDrives = reportDriveFilter === 'all'
      ? drives
      : drives.filter((drive) => String(drive.id) === String(reportDriveFilter))

    const visibleReportParticipants = reportParticipants.filter((row) =>
      reportDriveFilter === 'all' || String(row.drive_id) === String(reportDriveFilter)
    )

    const visibleReportCredits = reportCredits.filter((row) =>
      reportDriveFilter === 'all' || String(row.drive_id) === String(reportDriveFilter)
    )

    const bloodGroupCounts = bloodGroups.map((group) => ({
      group,
      count: visibleReportParticipants.filter(
        (row) => row.donor?.blood_group === group
      ).length,
    }))

    const checkedInCount = visibleReportParticipants.filter((row) => row.check_in_at).length
    const checkedOutCount = visibleReportParticipants.filter((row) => row.check_out_at).length

    const creditsByStudent = Object.values(visibleReportCredits.reduce((summary, row) => {
      const key = `${row.drive_id}-${row.donor_id}`
      if (!summary[key]) {
        summary[key] = {
          drive_id: row.drive_id,
          donor_id: row.donor_id,
          donor: row.donor,
          totalCredits: 0,
          dates: new Set(),
        }
      }
      summary[key].totalCredits += 1
      summary[key].dates.add(row.credit_date)
      return summary
    }, {})).map((item) => ({ ...item, dates: [...item.dates].sort() }))

    const driveSummary = visibleReportDrives.map((drive) => {
      const registrations = reportParticipants.filter((row) => row.drive_id === drive.id)
      const credits = reportCredits.filter((row) => row.drive_id === drive.id)
      return {
        ...drive,
        participantCount: registrations.length,
        checkedInCount: registrations.filter((row) => row.check_in_at).length,
        checkedOutCount: registrations.filter((row) => row.check_out_at).length,
        creditCount: credits.length,
      }
    })

    return (
      <>
        <section className="dashboard-panel reports-header-panel">
          <div className="panel-heading">
            <div>
              <h2>Reports & Analytics</h2>
              <p>Drive-wise donor registrations, attendance and class-hour credits.</p>
            </div>
            <div className="report-export-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={() => downloadCsv('NSS-Attendance.csv', visibleReportParticipants.map((row) => ({
                  Drive: drives.find((drive) => drive.id === row.drive_id)?.name || `Drive ${row.drive_id}`,
                  Student: row.donor?.full_name || '',
                  'Roll Number': row.donor?.roll_number || '',
                  'Blood Group': row.donor?.blood_group || '',
                  Department: row.donor?.department || '',
                  Batch: row.donor?.batch || '',
                  'Check In': formatDateTime(row.check_in_at),
                  'Check Out': formatDateTime(row.check_out_at),
                  Duration: calculateDuration(row.check_in_at, row.check_out_at),
                })))}
              >
                Export Attendance CSV
              </button>
              <button
                className="secondary-action"
                type="button"
                onClick={() => downloadCsv('NSS-Class-Credits.csv', visibleReportCredits.map((row) => ({
                  Drive: drives.find((drive) => drive.id === row.drive_id)?.name || `Drive ${row.drive_id}`,
                  Student: row.donor?.full_name || '',
                  'Roll Number': row.donor?.roll_number || '',
                  Department: row.donor?.department || '',
                  Batch: row.donor?.batch || '',
                  Date: row.credit_date,
                  'Class Hour': classHours.find((hour) => hour.number === row.hour_number)?.label || `Hour ${row.hour_number}`,
                })))}
              >
                Export Credits CSV
              </button>
              <button className="primary-action" type="button" onClick={() => exportReportsToExcel(visibleReportDrives, visibleReportParticipants, visibleReportCredits)}>
                Download Excel (.xlsx)
              </button>
            </div>
          </div>

          <div className="report-filter-row">
            <label htmlFor="report-drive-filter">Filter reports by drive</label>
            <select
              id="report-drive-filter"
              value={reportDriveFilter}
              onChange={(event) => setReportDriveFilter(event.target.value)}
            >
              <option value="all">All drives</option>
              {drives.map((drive) => (
                <option key={drive.id} value={String(drive.id)}>{drive.name}</option>
              ))}
            </select>
            <button className="secondary-action" type="button" onClick={fetchReports} disabled={reportsLoading}>
              {reportsLoading ? 'Refreshing...' : 'Refresh reports'}
            </button>
          </div>
          {reportsError && <p className="donor-error">{reportsError}</p>}
          <p className="report-note">Counts represent drive registrations. A student registered in two drives is counted once in each drive.</p>
        </section>

        {reportsLoading ? (
          <section className="dashboard-panel"><div className="empty-state"><h3>Loading reports...</h3></div></section>
        ) : (
          <>
            <section className="stats-grid reports-stats-grid">
              <article className="stat-card">
                <div className="stat-icon red">♥</div>
                <p className="stat-label">Drive Registrations</p>
                <h3>{visibleReportParticipants.length}</h3>
                <span className="stat-note">Across selected drive scope</span>
              </article>
              <article className="stat-card">
                <div className="stat-icon green">✓</div>
                <p className="stat-label">Checked In</p>
                <h3>{checkedInCount}</h3>
                <span className="stat-note">Participants with check-in time</span>
              </article>
              <article className="stat-card">
                <div className="stat-icon orange">↗</div>
                <p className="stat-label">Checked Out</p>
                <h3>{checkedOutCount}</h3>
                <span className="stat-note">Participants with check-out time</span>
              </article>
              <article className="stat-card">
                <div className="stat-icon purple">◷</div>
                <p className="stat-label">Class-Hour Credits</p>
                <h3>{visibleReportCredits.length}</h3>
                <span className="stat-note">Individual credited hours</span>
              </article>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div><h2>Drive-wise Summary</h2><p>Participant and attendance totals for each drive.</p></div>
              </div>
              {driveSummary.length === 0 ? (
                <div className="empty-state"><h3>No drives found</h3></div>
              ) : (
                <div className="donor-table-wrapper">
                  <table className="donor-table">
                    <thead><tr><th>Drive</th><th>Status</th><th>Participants</th><th>Checked In</th><th>Checked Out</th><th>Class Credits</th></tr></thead>
                    <tbody>
                      {driveSummary.map((drive) => (
                        <tr key={drive.id}>
                          <td><strong>{drive.name}</strong></td>
                          <td><span className="blood-group-badge">{drive.status}</span></td>
                          <td>{drive.participantCount}</td>
                          <td>{drive.checkedInCount}</td>
                          <td>{drive.checkedOutCount}</td>
                          <td>{drive.creditCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div><h2>Blood-Group Distribution</h2><p>Number of drive registrations in each blood group.</p></div>
              </div>
              <div className="blood-report-grid">
                {bloodGroupCounts.map(({ group, count }) => {
                  const percentage = visibleReportParticipants.length
                    ? Math.round((count / visibleReportParticipants.length) * 100)
                    : 0
                  return (
                    <article className="blood-report-card" key={group}>
                      <div className="blood-report-top"><strong>{group}</strong><span>{count}</span></div>
                      <div className="report-progress-track"><div className="report-progress-fill" style={{ width: `${percentage}%` }} /></div>
                      <small>{percentage}% of registrations</small>
                    </article>
                  )
                })}
              </div>
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div><h2>Attendance Details</h2><p>Per-drive check-in and check-out timestamps.</p></div>
              </div>
              {visibleReportParticipants.length === 0 ? (
                <div className="empty-state"><h3>No participant records for this selection</h3></div>
              ) : (
                <div className="donor-table-wrapper">
                  <table className="donor-table">
                    <thead><tr><th>Student</th><th>Roll Number</th><th>Blood Group</th><th>Drive</th><th>Check-In</th><th>Check-Out</th><th>Duration</th></tr></thead>
                    <tbody>
                      {visibleReportParticipants.map((row) => (
                        <tr key={row.id}>
                          <td>{row.donor?.full_name || '—'}</td>
                          <td>{row.donor?.roll_number || '—'}</td>
                          <td><span className="blood-group-badge">{row.donor?.blood_group || '—'}</span></td>
                          <td>{drives.find((drive) => drive.id === row.drive_id)?.name || `Drive ${row.drive_id}`}</td>
                          <td>{formatDateTime(row.check_in_at)}</td>
                          <td>{formatDateTime(row.check_out_at)}</td>
                          <td>{calculateDuration(row.check_in_at, row.check_out_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div><h2>Class-Hour Credits per Student</h2><p>Total credited class hours for each student in each drive.</p></div>
              </div>
              {creditsByStudent.length === 0 ? (
                <div className="empty-state"><h3>No class-hour credits for this selection</h3></div>
              ) : (
                <div className="donor-table-wrapper">
                  <table className="donor-table">
                    <thead><tr><th>Student</th><th>Roll Number</th><th>Department</th><th>Batch</th><th>Drive</th><th>Total Credits</th><th>Dates Credited</th></tr></thead>
                    <tbody>
                      {creditsByStudent.map((item) => (
                        <tr key={`${item.drive_id}-${item.donor_id}`}>
                          <td>{item.donor?.full_name || '—'}</td>
                          <td>{item.donor?.roll_number || '—'}</td>
                          <td>{item.donor?.department || '—'}</td>
                          <td>{item.donor?.batch || '—'}</td>
                          <td>{drives.find((drive) => drive.id === item.drive_id)?.name || `Drive ${item.drive_id}`}</td>
                          <td><strong>{item.totalCredits}</strong></td>
                          <td>{item.dates.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="panel-heading">
                <div><h2>Class-Hour Credit Details</h2><p>Individual credited class-hour records.</p></div>
              </div>
              {visibleReportCredits.length === 0 ? (
                <div className="empty-state"><h3>No class-hour details for this selection</h3></div>
              ) : (
                <div className="donor-table-wrapper">
                  <table className="donor-table">
                    <thead><tr><th>Student</th><th>Roll Number</th><th>Department</th><th>Batch</th><th>Drive</th><th>Date</th><th>Class Hour</th></tr></thead>
                    <tbody>
                      {visibleReportCredits.map((row) => (
                        <tr key={row.id}>
                          <td>{row.donor?.full_name || '—'}</td>
                          <td>{row.donor?.roll_number || '—'}</td>
                          <td>{row.donor?.department || '—'}</td>
                          <td>{row.donor?.batch || '—'}</td>
                          <td>{drives.find((drive) => drive.id === row.drive_id)?.name || `Drive ${row.drive_id}`}</td>
                          <td>{row.credit_date}</td>
                          <td>{classHours.find((hour) => hour.number === row.hour_number)?.label || `Hour ${row.hour_number}`}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </>
    )
  }

  // ---------------- OVERVIEW PAGE ----------------

  function renderOverview() {
    return (
      <>
        <section className="stats-grid">
          <article className="stat-card">
            <div className="stat-icon red">♥</div>
            <p className="stat-label">Total Drives</p>
            <h3>{drives.length}</h3>
            <span className="stat-note">All created drives</span>
          </article>

          <article className="stat-card">
            <div className="stat-icon green">♡</div>
            <p className="stat-label">Drive Participants</p>
            <h3>{donors.length}</h3>
            <span className="stat-note">Selected drive</span>
          </article>

          <article className="stat-card">
            <div className="stat-icon orange">◷</div>
            <p className="stat-label">Class-Hour Credits</p>
            <h3>{classLogs.length}</h3>
            <span className="stat-note">Selected drive</span>
          </article>

          <article className="stat-card">
            <div className="stat-icon purple">✓</div>
            <p className="stat-label">Checked In</p>
            <h3>
              {donors.filter((donor) => donor.check_in_at).length}
            </h3>
            <span className="stat-note">Selected drive</span>
          </article>
        </section>

        <section className="dashboard-panel">
          <div className="panel-heading">
            <div>
              <h2>Welcome to your dashboard</h2>
              <p>Your NSS Blood Donation Cell records, organized by drive.</p>
            </div>
          </div>

          <div className="welcome-content">
            <div className="welcome-symbol">✦</div>

            <div>
              <h3>
                {selectedDrive ? selectedDrive.name : 'No drive selected'}
              </h3>

              <p>
                {selectedDrive
                  ? `Status: ${selectedDrive.status}. Use the menu to manage its donors, attendance and class-hour credits.`
                  : 'Open Drive Management to create or select a drive.'}
              </p>
            </div>
          </div>
        </section>
      </>
    )
  }

  // ---------------- DASHBOARD CONTENT ----------------

  function renderDashboardContent() {
    switch (activePage) {
      case 'drives':
        return renderDrivesPage()

      case 'donors':
        return renderDonorPage()

      case 'attendance':
        return renderAttendancePage()

      case 'logs':
        return renderLogsPage()

      case 'reports':
        return renderReportsPage()

      default:
        return renderOverview()
    }
  }

  // ---------------- DASHBOARD ----------------

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
                <span>{isCoordinator ? 'Coordinator' : 'Faculty'}</span>
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
                <span>{isCoordinator ? 'Coordinator' : 'Faculty'}</span>
              </div>

              <div className="user-avatar topbar-avatar">
                {userProfile.full_name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </header>

          <div className="dashboard-body">
            <section className="dashboard-panel">
              <div className="panel-heading">
                <div>
                  <h2>Current Drive</h2>

                  <p>
                    {selectedDrive
                      ? `${selectedDrive.name} · ${selectedDrive.status}`
                      : 'Choose a drive to view its records.'}
                  </p>
                </div>

                <select
                  value={selectedDriveId}
                  onChange={(event) =>
                    setSelectedDriveId(event.target.value)
                  }
                  disabled={drives.length === 0}
                  aria-label="Select current drive"
                >
                  <option value="">Select a drive</option>

                  {drives.map((drive) => (
                    <option key={drive.id} value={drive.id}>
                      {drive.name} ({drive.status})
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {renderDashboardContent()}

            {/* PERMANENT DRIVE DELETION POPUP */}
            {pendingDriveDeletion && (
              <div
                className="removal-modal-backdrop"
                onClick={closeDriveDeletion}
              >
                <form
                  className="removal-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="drive-deletion-title"
                  onSubmit={confirmDriveDeletion}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="removal-modal-icon">!</div>

                  <h2 id="drive-deletion-title">Permanently delete drive?</h2>

                  <p className="removal-modal-student">
                    {pendingDriveDeletion.name}
                  </p>

                  <div className="removal-modal-notice">
                    <p><strong>This action cannot be undone.</strong></p>
                    <ul>
                      <li>All registrations for this drive will be deleted.</li>
                      <li>Class-hour credits and attendance records linked to this drive will be deleted.</li>
                      <li>Class-time logs linked to this drive will be deleted.</li>
                      <li>Permanent donor profiles and records in other drives will remain.</li>
                    </ul>
                  </div>

                  <div className="donor-time-field">
                    <label htmlFor="drive-delete-name">
                      Type <strong>{pendingDriveDeletion.name}</strong> to confirm
                    </label>
                    <input
                      id="drive-delete-name"
                      type="text"
                      autoComplete="off"
                      value={driveDeleteConfirmation}
                      onChange={(event) => setDriveDeleteConfirmation(event.target.value)}
                      disabled={deletingDrive}
                      required
                    />
                  </div>

                  <div className="donor-time-field">
                    <label htmlFor="drive-delete-password">
                      Re-enter your coordinator password
                    </label>
                    <div className="label-row">
                      <span />
                      <button
                        type="button"
                        className="show-password"
                        onClick={() => setShowDriveDeletePassword((current) => !current)}
                        disabled={deletingDrive}
                      >
                        {showDriveDeletePassword ? 'Hide password' : 'Show password'}
                      </button>
                    </div>
                    <input
                      id="drive-delete-password"
                      type={showDriveDeletePassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={driveDeletePassword}
                      onChange={(event) => setDriveDeletePassword(event.target.value)}
                      disabled={deletingDrive}
                      required
                    />
                  </div>

                  {driveDeleteError && (
                    <p className="donor-error">{driveDeleteError}</p>
                  )}

                  <div className="removal-modal-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={deletingDrive}
                      onClick={closeDriveDeletion}
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      className="remove-confirm-button"
                      disabled={
                        deletingDrive ||
                        driveDeleteConfirmation !== pendingDriveDeletion.name ||
                        !driveDeletePassword
                      }
                    >
                      {deletingDrive ? 'Verifying & deleting...' : 'Permanently Delete'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* CUSTOM STUDENT REMOVAL POPUP */}
            {pendingDonorRemoval && (
              <div
                className="removal-modal-backdrop"
                onClick={() => {
                  if (removingDonorId === null) {
                    setPendingDonorRemoval(null)
                    setRemovalError('')
                  }
                }}
              >
                <div
                  className="removal-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="removal-modal-title"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="removal-modal-icon">!</div>

                  <h2 id="removal-modal-title">Remove student?</h2>

                  <p className="removal-modal-student">
                    {pendingDonorRemoval.full_name}
                  </p>

                  <p className="removal-modal-description">
                    Are you sure you want to remove this student from
                    <strong> {selectedDrive?.name}</strong>?
                  </p>

                  <div className="removal-modal-notice">
                    <p>
                      <strong>What happens next?</strong>
                    </p>

                    <ul>
                      <li>
                        The student will be removed from this drive only.
                      </li>
                      <li>Their permanent student profile will remain.</li>
                      <li>
                        Their participation in other drives will remain.
                      </li>
                      <li>
                        Class-hour credits for this drive will be deleted automatically.
                      </li>
                    </ul>
                  </div>

                  {removalError && (
                    <p className="donor-error">{removalError}</p>
                  )}

                  <div className="removal-modal-actions">
                    <button
                      type="button"
                      className="secondary-action"
                      disabled={removingDonorId !== null}
                      onClick={() => {
                        setPendingDonorRemoval(null)
                        setRemovalError('')
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="remove-confirm-button"
                      disabled={removingDonorId !== null}
                      onClick={confirmDonorRemoval}
                    >
                      {removingDonorId !== null
                        ? 'Removing...'
                        : 'Remove Student'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <footer className="dashboard-footer">
            NSS Blood Donation Cell · Authorized access only
          </footer>
        </main>
      </main>
    )
  }

  // ---------------- LOGIN PAGE ----------------

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
              Role-based portal for managing student blood donation drives,
              donor records and class-hour credits.
            </p>

            <div className="access-card">
              <h3>Coordinator Access</h3>
              <p>
                Create drives, manage donor registrations, attendance and
                class-time credits.
              </p>
            </div>

            <div className="access-card faculty-card">
              <h3>Faculty Access</h3>
              <p>
                View shared drive records and verify attendance information.
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
                  onClick={() =>
                    setShowPassword((current) => !current)
                  }
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

            {message && (
              <p className="auth-message">{message}</p>
            )}

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
