import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bell, BookOpen, Building2, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardList,
  Clock3, Download, Filter, Flag, Globe2, GraduationCap, ImagePlus,
  FileUp, MapPin, Printer,
  LayoutDashboard, LifeBuoy, LogOut, Menu, MessageSquare, MoreHorizontal, Plus,
  Search, Send, ShieldCheck, Sparkles, Sun, Moon,
  UserRound, Users, Wifi, X, Zap, AlertTriangle, Star,
} from 'lucide-react'
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase, isSupabaseConfigured } from './lib/supabase'

const categories = ['Computer Laboratory', 'Library', 'Dormitory', 'Cafeteria', 'Registrar Office', 'Classroom', 'Internet & Wi-Fi', 'Electricity & Water', 'Campus Security', 'Other Campus Issues']
const statusNames = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Resolved', 'Rejected']
const translations = {
  om: {
    Overview: 'Cuunfaa', Complaints: 'Komii', Notifications: 'Beeksisa', Announcements: 'Oduu',
    'My profile': 'Piroofaayila koo', 'Admin overview': 'Cuunfaa bulchiinsaa', Departments: 'Kutaa hojii',
    'Students & departments': 'Barattootaa fi kutaa hojii', 'New report': 'Komii haaraa',
    'My reports': 'Komiiwwan koo', 'All complaints': 'Komiiwwan hunda', 'Report details': 'Odeeffannoo komii',
    'Mark all as read': 'Hunda akka dubbifametti mallatteessi', 'Submit report': 'Komii galchi',
    'Emergency report': 'Komii ariifachiisaa', Resolved: 'Furame', Submitted: 'Galmaaʼe',
    'Under Review': 'Qoratamaa jira', Assigned: 'Ramadame', 'In Progress': 'Hojjetamaa jira', Rejected: 'Kufame',
  },
  am: {
    Overview: 'አጠቃላይ እይታ', Complaints: 'ቅሬታዎች', Notifications: 'ማሳወቂያዎች', Announcements: 'ማስታወቂያዎች',
    'My profile': 'የእኔ መገለጫ', 'Admin overview': 'የአስተዳዳሪ አጠቃላይ እይታ', Departments: 'ክፍሎች',
    'Students & departments': 'ተማሪዎች እና ክፍሎች', 'New report': 'አዲስ ቅሬታ',
    'My reports': 'የእኔ ሪፖርቶች', 'All complaints': 'ሁሉም ቅሬታዎች', 'Report details': 'የቅሬታ ዝርዝር',
    'Mark all as read': 'ሁሉንም እንደተነበበ ምልክት አድርግ', 'Submit report': 'ቅሬታ አስገባ',
    'Emergency report': 'አስቸኳይ ቅሬታ', Resolved: 'ተፈትቷል', Submitted: 'ገብቷል',
    'Under Review': 'በግምገማ ላይ', Assigned: 'ተመድቧል', 'In Progress': 'በሂደት ላይ', Rejected: 'ውድቅ ተደርጓል',
  },
}
const translate = (text, language) => translations[language]?.[text] || text
const statusClass = (status) => `status status-${status.toLowerCase().replaceAll(' ', '-')}`
function mapNotification(row) {
  const created = new Date(row.created_at)
  const day = new Date().toDateString() === created.toDateString() ? 'TODAY' : new Date(Date.now() - 86400000).toDateString() === created.toDateString() ? 'YESTERDAY' : created.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase()
  const color = row.type?.includes('resolved') ? 'green' : row.type?.includes('assigned') ? 'violet' : row.type?.includes('submitted') ? 'orange' : 'blue'
  return { id: row.id, title: row.title, text: row.message, time: created.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }), date: day, color, read: row.is_read }
}
function mapComplaint(row, user) {
  return {
    ...row,
    uuid: row.id,
    id: row.public_id,
    owner: row.is_anonymous ? 'Anonymous student' : row.profiles?.full_name || user.name,
    department: row.departments?.name || '—',
    response: row.admin_response,
    anonymous: row.is_anonymous,
    date: new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    updated: new Date(row.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    attachments: row.complaint_attachments || [],
    emergency: row.is_emergency || false,
    updates: (row.complaint_updates || [])
      .filter((entry) => user.role === 'admin' || !entry.is_internal)
      .map((entry) => ({
        ...entry,
        note: entry.message,
        date: new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      })),
  }
}
const Context = createContext(null)
const useCampus = () => useContext(Context)
const makeId = () => `CC-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`

function CampusMark({ small = false }) {
  return <span className={`brand-mark${small ? ' brand-mark-small' : ''}`} aria-hidden="true"><span>c</span><i /></span>
}
function Brand({ compact = false }) {
  return <Link className="brand" to="/"><CampusMark small={compact} /><span>Campus<span>Care</span><small>AMBO UNIVERSITY</small></span></Link>
}
function AppLink({ to, icon: Icon, children, end, badge }) {
  const { language } = useCampus()
  return <NavLink end={end} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><Icon size={18} strokeWidth={1.8} /><span>{translate(children, language)}</span>{badge && <b>{badge}</b>}</NavLink>
}
function Sidebar({ mobileOpen, close }) {
  const { user, signOut, notifications } = useCampus()
  const location = useLocation()
  useEffect(() => close(), [location.pathname, close])
  const isAdmin = user?.role === 'admin'
  return <>
    {mobileOpen && <button className="scrim" onClick={close} aria-label="Close navigation" />}
    <aside className={`sidebar${mobileOpen ? ' sidebar-open' : ''}`}>
      <div className="sidebar-top"><Brand /><button className="icon-btn mobile-close" onClick={close} aria-label="Close menu"><X size={20} /></button></div>
      <div className="campus-switch"><span className="campus-icon"><Building2 size={17} /></span><span><b>Woliso Campus</b><small>Ambo University</small></span><ChevronDown size={15} /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">
        <AppLink end to="/dashboard" icon={LayoutDashboard}>Overview</AppLink>
        <AppLink to={isAdmin ? '/admin/complaints' : '/my-complaints'} icon={ClipboardList}>Complaints</AppLink>
        {isAdmin && <AppLink to="/admin/people" icon={Users}>Students & departments</AppLink>}
        {!isAdmin && <AppLink to="/notifications" icon={Bell} badge={notifications.filter((notice) => !notice.read).length || undefined}>Notifications</AppLink>}
        <AppLink to="/announcements" icon={BookOpen}>Announcements</AppLink>
      </nav>
      <div className="nav-label nav-label-spaced">YOUR ACCOUNT</div>
      <nav className="main-nav">
        <AppLink to="/profile" icon={UserRound}>My profile</AppLink>
        <button className="nav-item nav-button" onClick={() => document.dispatchEvent(new Event('campuscare:help'))}><CircleHelp size={18} />Help & support</button>
      </nav>
      <div className="sidebar-bottom">
        <div className="help-card"><span className="help-icon"><LifeBuoy size={17} /></span><b>Need a hand?</b><p>Our campus team is here to help.</p><button onClick={() => document.dispatchEvent(new Event('campuscare:help'))}>Get support <ArrowRight size={14} /></button></div>
        <button className="profile-mini" onClick={() => { window.location.href = '/profile' }}><span className="avatar">{user?.name?.split(' ').map((x) => x[0]).slice(0, 2).join('') || 'U'}</span><span><b>{user?.name || 'Account'}</b><small>{isAdmin ? 'Administrator' : 'Student'}</small></span><MoreHorizontal size={19} /></button>
        <button className="logout-btn" onClick={signOut}><LogOut size={15} />Sign out</button>
      </div>
    </aside>
  </>
}
function Modal({ title, close, children }) {
  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') close() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close])
  return <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}><section className="support-modal" role="dialog" aria-modal="true" aria-labelledby="modal-heading"><div className="modal-heading"><h2 id="modal-heading">{title}</h2><button className="icon-btn" onClick={close} aria-label="Close dialog"><X size={18} /></button></div>{children}</section></div>
}
function Header({ title, mobileNav }) {
  const { user, theme, toggleTheme, notifications, language, setLanguage } = useCampus()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const navigate = useNavigate()
  useEffect(() => {
    const handler = () => setHelp(true)
    document.addEventListener('campuscare:help', handler)
    return () => document.removeEventListener('campuscare:help', handler)
  }, [])
  const search = (event) => {
    event.preventDefault()
    if (query.trim()) navigate(`/my-complaints?search=${encodeURIComponent(query.trim())}`)
  }
  return <>
    <header className="topbar">
      <div className="topbar-left"><button className="icon-btn menu-toggle" onClick={mobileNav} aria-label="Open navigation"><Menu size={21} /></button><div className="breadcrumbs"><span>CampusCare</span><ChevronRight size={14} /><b>{translate(title, language)}</b></div></div>
      <div className="topbar-actions"><form className="searchbox" onSubmit={search}><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anything..." aria-label="Search complaints" /><kbd>⌘ K</kbd></form>
        <label className="language-picker" title="Choose language"><Globe2 size={15} /><select aria-label="Choose language" value={language} onChange={(event) => setLanguage(event.target.value)}><option value="en">EN</option><option value="om">OM</option><option value="am">አማ</option></select></label>
        <button className="icon-btn theme-toggle" title="Toggle color theme" onClick={toggleTheme}>{theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</button>
        <div className="notification-wrap"><button className="icon-btn notification-btn" aria-label="Notifications" onClick={() => setOpen(!open)}><Bell size={18} /><i /></button>
          {open && <div className="notification-pop"><div className="pop-title"><b>Notifications</b><Link to="/notifications" onClick={() => setOpen(false)}>View all</Link></div>{notifications.slice(0, 2).map((notice) => <div className="pop-notice" key={notice.id}><span className={`notice-dot ${notice.color}`}><MessageSquare size={14} /></span><span><b>{notice.title}</b><small>{notice.text} · {notice.time}</small></span></div>)}</div>}
        </div><button className="top-avatar" title={`${user?.name || 'Account'} profile`} onClick={() => navigate('/profile')}>{user?.name?.split(' ').map((x) => x[0]).slice(0, 2).join('') || 'U'}</button>
      </div>
    </header>
    {help && <Modal title="CampusCare support" close={() => setHelp(false)}><p className="modal-copy">Our Woliso Campus support team is ready to help you with reporting or tracking a campus issue.</p><div className="support-detail"><LifeBuoy size={18} /><div><b>Student support desk</b><span>support@ambo.edu.et · Mon–Fri, 8:00–17:00</span></div></div><button className="btn btn-primary btn-full" onClick={() => { setHelp(false); navigate('/report') }}>Report a campus issue <ArrowRight size={16} /></button></Modal>}
  </>
}
function PageFrame({ title, children, className = '' }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMenu = useCallback(() => setMobileOpen(false), [])
  return <div className="app-shell"><Sidebar mobileOpen={mobileOpen} close={closeMenu} /><div className="content-area"><Header title={title} mobileNav={() => setMobileOpen(true)} /><main className={`page-content ${className}`}>{children}</main><footer className="footer"><span>© 2025 Ambo University · Woliso Campus</span><span><span className="footer-status" /> Built for a better campus <Sparkles size={13} /></span></footer></div></div>
}
function StatCard({ label, value, note, icon: Icon, color, trend }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={17} /></span></div><div className="stat-number">{value}</div><div className="stat-note">{trend && <span className="trend"><ArrowUpRight size={13} />{trend}</span>}{note}</div></div>
}
function SectionHeading({ title, action, to, children }) {
  return <div className="section-heading"><div><h2>{title}</h2>{children && <p>{children}</p>}</div>{to && <Link className="text-link" to={to}>{action || 'View all'} <ArrowRight size={15} /></Link>}</div>
}
function StatusBadge({ status }) { const { language } = useCampus(); return <span className={statusClass(status)}><i />{translate(status, language)}</span> }
function PriorityBadge({ priority }) { return <span className={`priority priority-${priority.toLowerCase()}`}><i />{priority}</span> }
function ComplaintRow({ item, onClick }) {
  return <button className={`complaint-row${item.emergency ? ' emergency-report' : ''}`} onClick={onClick}><span className={`row-category-icon ${item.category?.includes('Wi-Fi') ? 'row-wifi' : item.category?.includes('Library') ? 'row-library' : 'row-building'}`}>{item.emergency ? <AlertTriangle size={17} /> : item.category?.includes('Wi-Fi') ? <Wifi size={17} /> : item.category?.includes('Library') ? <BookOpen size={17} /> : <Building2 size={17} />}</span><span className="row-info"><b>{item.emergency && <span className="emergency-label">EMERGENCY · </span>}{item.title}</b><small>{item.id} <i>·</i> {item.category}</small></span><span className="row-priority"><PriorityBadge priority={item.priority} /></span><span className="row-status"><StatusBadge status={item.status} /></span><span className="row-date">{item.updated}</span><ChevronRight className="row-chevron" size={16} /></button>
}
function Dashboard() {
  const { complaints, user } = useCampus()
  const navigate = useNavigate()
  if (user.role === 'admin') return <AdminPage />
  const mine = complaints.filter((item) => item.owner === user.name)
  const chartMonths = Array.from({ length: 6 }, (_, index) => {
    const month = new Date()
    month.setDate(1)
    month.setMonth(month.getMonth() - 5 + index)
    return month
  })
  const chartData = chartMonths.map((month) => ({
    name: month.toLocaleDateString('en-US', { month: 'short' }),
    reports: mine.filter((item) => {
      const created = new Date(item.created_at)
      return created.getFullYear() === month.getFullYear() && created.getMonth() === month.getMonth()
    }).length,
  }))
  const semesterReports = chartData.reduce((total, month) => total + month.reports, 0)
  const chartRange = `${chartMonths[0].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} – ${chartMonths[5].toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`
  return <PageFrame title="Overview">
    <div className="welcome-row"><div><div className="eyebrow"><span className="live-dot" />YOUR CAMPUS, YOUR VOICE</div><h1>Good morning, {user.name?.split(' ')[0] || 'there'} <span className="wave">✦</span></h1><p>Here’s what’s happening with your campus reports today.</p></div><Link to="/report" className="btn btn-primary"><Plus size={17} /> New report <span className="button-shortcut">⌘ N</span></Link></div>
    <div className="stats-grid"><StatCard label="Total reports" value={mine.length.toString().padStart(2, '0')} note="All time" icon={ClipboardList} color="blue" /><StatCard label="In progress" value={mine.filter((x) => ['In Progress', 'Assigned'].includes(x.status)).length.toString().padStart(2, '0')} note="Being worked on" icon={Clock3} color="orange" /><StatCard label="Awaiting review" value={mine.filter((x) => ['Submitted', 'Under Review'].includes(x.status)).length.toString().padStart(2, '0')} note="We’ll update you soon" icon={MessageSquare} color="violet" /><StatCard label="Resolved" value={mine.filter((x) => x.status === 'Resolved').length.toString().padStart(2, '0')} note="Campus improvements" icon={CheckCircle2} color="green" /></div>
    <div className="dashboard-grid"><section className="panel recent-panel"><SectionHeading title="Recent reports" to="/my-complaints" action="All reports">Keep track of issues you’ve raised.</SectionHeading><div className="complaint-list">{mine.slice(0, 4).map((item) => <ComplaintRow key={item.id} item={item} onClick={() => navigate(`/complaint/${item.id}`)} />)}</div><Link className="all-reports-link" to="/my-complaints">View all reports <ArrowRight size={15} /></Link></section>
      <section className="panel progress-panel"><SectionHeading title="Your impact">A little voice makes a big difference.</SectionHeading><div className="chart-summary"><span><i /> Reports in the last six months</span><b>{semesterReports}</b></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 3, left: -24, bottom: 0 }}><defs><linearGradient id="reportGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f71ec" stopOpacity={0.17} /><stop offset="95%" stopColor="#2f71ec" stopOpacity={0.005} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 4" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3b2' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#9aa3b2' }} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="reports" stroke="#3678ec" strokeWidth={2.2} fill="url(#reportGradient)" /></AreaChart></ResponsiveContainer></div><div className="chart-caption"><span><i /> Your campus reports</span><span>{chartRange}</span></div></section></div>
    <div className="bottom-grid"><section className="panel tip-panel"><div className="tip-icon"><ShieldCheck size={19} /></div><div><span className="eyebrow">A QUICK TIP</span><h3>Good reports make a real difference.</h3><p>Add a specific location and a photo to help our campus team resolve issues faster.</p></div><Link to="/report" className="tip-action" aria-label="Write a report"><ArrowRight size={16} /></Link></section><section className="campus-card"><span className="campus-card-mark"><Globe2 size={17} /></span><div><b>One community. A better campus.</b><p>Ambo University · Woliso Campus</p></div><span className="green-pill"><span /> Campus active</span></section></div>
  </PageFrame>
}
function ComplaintTable({ items, clickable = true }) {
  const navigate = useNavigate()
  return <div className="complaint-list">{items.map((item) => <ComplaintRow key={item.id} item={item} onClick={() => clickable && navigate(`/complaint/${item.id}`)} />)}{!items.length && <div className="empty-state"><ClipboardList size={25} /><b>No reports found</b><span>Try adjusting your filters or report a new campus issue.</span></div>}</div>
}
function downloadCsv(items) {
  const rows = [['ID', 'Title', 'Category', 'Status', 'Priority', 'Emergency', 'Location', 'Date'], ...items.map((item) => [item.id, item.title, item.category, item.status, item.priority, item.emergency ? 'Yes' : 'No', item.location, item.date])]
  const csv = rows.map((row) => row.map((cell) => {
    const value = String(cell ?? '')
    const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
    return `"${safeValue.replaceAll('"', '""')}"`
  }).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'campuscare-reports.csv'
  link.click()
  URL.revokeObjectURL(url)
}
function ComplaintsPage({ admin = false }) {
  const { complaints, user } = useCampus()
  const [filter, setFilter] = useState('All reports')
  const [search, setSearch] = useState(new URLSearchParams(useLocation().search).get('search') || '')
  const [category, setCategory] = useState('All categories')
  const [priority, setPriority] = useState('All priorities')
  const [exportMessage, setExportMessage] = useState('')
  const mine = complaints.filter((x) => user.role === 'admin' || x.owner === user.name)
  const items = mine.filter((item) => (filter === 'All reports' || item.status === filter) && (category === 'All categories' || item.category === category) && (priority === 'All priorities' || item.priority === priority) && `${item.title} ${item.category} ${item.id}`.toLowerCase().includes(search.toLowerCase()))
  const heading = admin ? 'All complaints' : 'My reports'
  return <PageFrame title={admin ? 'Complaints' : 'My reports'}>
    <div className="page-heading"><div><div className="eyebrow">YOUR VOICE MATTERS</div><h1>{heading}</h1><p>{admin ? 'Review, assign, and follow up on campus-wide issues.' : 'Every report helps make Woliso Campus a better place.'}</p></div><div className="page-heading-actions">{admin && <button className="btn btn-outline" onClick={() => { downloadCsv(items); setExportMessage('Your report has been downloaded.') }}><Download size={16} /> Export CSV</button>}{!admin && <Link to="/report" className="btn btn-primary"><Plus size={16} /> New report</Link>}</div></div>
    <section className="panel reports-panel"><div className="reports-toolbar"><div className="filter-tabs">{['All reports', 'Submitted', 'Under Review', 'In Progress', 'Resolved'].map((tab) => <button key={tab} onClick={() => setFilter(tab)} className={filter === tab ? 'selected' : ''}>{tab}{tab === 'All reports' && <span>{mine.length}</span>}</button>)}</div><div className="filter-actions"><label className="table-search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports" /></label><label className="select-filter"><Filter size={15} /><select value={category} onChange={(e) => setCategory(e.target.value)}><option>All categories</option>{categories.map((x) => <option key={x}>{x}</option>)}</select><ChevronDown size={13} /></label><label className="select-filter"><Flag size={14} /><select value={priority} onChange={(e) => setPriority(e.target.value)}><option>All priorities</option>{['Low', 'Medium', 'High', 'Urgent'].map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={13} /></label></div></div><div className="table-head"><span>REPORT</span><span>PRIORITY</span><span>STATUS</span><span>UPDATED</span><span /></div><ComplaintTable items={items} /></section>
    {exportMessage && <div className="inline-success"><CheckCircle2 size={15} />{exportMessage}<button onClick={() => setExportMessage('')} aria-label="Dismiss"><X size={14} /></button></div>}
    <div className="results-caption">Showing <b>{items.length}</b> of <b>{mine.length}</b> reports <span>·</span> Last updated just now</div>
  </PageFrame>
}
function ReportForm() {
  const { addComplaint, complaints, user } = useCampus()
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', category: '', location: '', description: '', priority: 'Medium', anonymous: false })
  const [image, setImage] = useState(null)
  const [attachments, setAttachments] = useState([])
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (form.title.trim().length < 5 || form.description.trim().length < 15) { setError('Add a clear title and at least 15 characters describing the issue.'); return }
    if (!form.category || !form.location.trim()) { setError('Please choose a category and add a specific location.'); return }
    const duplicate = complaints.find((item) => (user.id ? item.student_id === user.id : item.owner === user.name) && item.category === form.category && item.title.trim().toLocaleLowerCase() === form.title.trim().toLocaleLowerCase() && !['Resolved', 'Rejected'].includes(item.status))
    if (duplicate) { setError(`You already have an active report (${duplicate.id}) with this title and category. Review your reports before submitting another.`); return }
    setSubmitting(true)
    try { const item = await addComplaint({ ...form, files: [image, ...attachments].filter(Boolean) }); navigate(`/complaint/${item.id}`, { state: { created: true } }) }
    catch (err) { setError(err.message || 'We could not submit your report. Please try again.') }
    finally { setSubmitting(false) }
  }
  const selectImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('Choose a PNG, JPG, or WebP image.')
      event.target.value = ''
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Images must be 5 MB or smaller.')
      event.target.value = ''
      return
    }
    setError('')
    setImage(file)
  }
  return <PageFrame title="New report" className="form-page"><Link to="/dashboard" className="back-link"><ArrowLeft size={15} /> Back to overview</Link><div className="form-intro"><div className="eyebrow"><span className="live-dot" /> CAMPUSCARE · ISSUE REPORT</div><h1>Let’s make it better.</h1><p>Tell us what’s happening. The right team will take it from here.</p></div><div className="form-layout"><form className="panel report-form" onSubmit={submit}><div className="form-section-title"><span>01</span><div><b>Tell us about the issue</b><small>Share a few details so we can help.</small></div></div><label className="field-label">Report title <span>*</span><input required maxLength={100} value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="e.g. Wi-Fi keeps disconnecting in the library" /></label><div className="form-two-col"><label className="field-label">Issue category <span>*</span><div className="select-wrap"><select required value={form.category} onChange={(e) => update('category', e.target.value)}><option value="" disabled>Select a category</option>{categories.map((x) => <option key={x}>{x}</option>)}</select><ChevronDown size={15} /></div></label><label className="field-label">Specific location <span>*</span><div className="input-icon"><Building2 size={16} /><input required value={form.location} onChange={(e) => update('location', e.target.value)} placeholder="Building, room, or area" /></div></label></div><label className="field-label">What’s going on? <span>*</span><textarea required minLength={15} rows={5} value={form.description} onChange={(e) => update('description', e.target.value)} placeholder="Describe the issue, when it started, and how it affects you..." /><span className="field-hint">A clear description helps us get this to the right team.</span></label><div className="form-section-title form-section-spaced"><span>02</span><div><b>A little more context</b><small>Help us prioritize and understand the situation.</small></div></div><div className="priority-field"><span className="field-label-plain">How urgent is this?</span><div className="priority-choices">{['Low', 'Medium', 'High', 'Urgent'].map((p) => <button type="button" key={p} className={`priority-choice${form.priority === p ? ` chosen p-${p.toLowerCase()}` : ''}`} onClick={() => update('priority', p)}><i className={`priority-dot dot-${p.toLowerCase()}`} />{p}</button>)}</div></div><label className="anonymous-option emergency-option"><input type="checkbox" checked={form.emergency || false} onChange={(e) => update('emergency', e.target.checked)} /><span className="checkbox-custom"><AlertTriangle size={12} /></span><span><b>Emergency report</b><small>Flag an immediate safety or facilities issue for urgent administrator attention.</small></span><AlertTriangle size={17} /></label><label className={`upload-zone${image ? ' has-image' : ''}`}>{image ? <><CheckCircle2 size={19} /><span><b>{image.name}</b><small>Ready to upload</small></span><button type="button" className="remove-image" onClick={(e) => { e.preventDefault(); setImage(null) }} aria-label="Remove image"><X size={16} /></button></> : <><span className="upload-icon"><ImagePlus size={19} /></span><span><b>Add a photo <small>(optional)</small></b><small>Drop an image here or <strong>browse files</strong><br />PNG, JPG up to 5 MB</small></span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={selectImage} /></>}</label><label className="field-label">Supporting documents <small>(optional, up to 4 files; 10 MB each)</small><input type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf,text/plain" onChange={(event) => { const selected = Array.from(event.target.files || []); const allowed = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'text/plain']; if (selected.length > 4 || selected.some((file) => !allowed.includes(file.type) || file.size > 10 * 1024 * 1024)) { setError('Choose up to 4 supported files (PNG, JPG, WebP, PDF, or TXT), each 10 MB or smaller.'); event.target.value = ''; return } setError(''); setAttachments(selected) }} />{attachments.map((file) => <small key={`${file.name}-${file.lastModified}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</small>)}</label><label className="anonymous-option"><input type="checkbox" checked={form.anonymous} onChange={(e) => update('anonymous', e.target.checked)} /><span className="checkbox-custom"><Check size={12} /></span><span><b>Submit anonymously</b><small>Your identity will be hidden from the complaint, but administrators can still follow up if needed.</small></span><ShieldCheck size={17} /></label>{error && <div className="form-error"><AlertTriangle size={16} />{error}</div>}<div className="form-footer"><span><ShieldCheck size={15} /> Your report is handled with care.</span><button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Submit report'} {!submitting && <ArrowRight size={16} />}</button></div></form><aside className="form-aside"><div className="aside-card"><div className="aside-icon"><Sparkles size={17} /></div><b>Small details, big impact.</b><p>A specific location and clear description help our campus team respond much faster.</p><div className="aside-divider" /><div className="aside-fact"><span><Clock3 size={15} /></span><p><b>What happens next?</b><small>We’ll send your report to the right campus team and keep you updated.</small></p></div><div className="aside-fact"><span><ShieldCheck size={15} /></span><p><b>Your privacy matters</b><small>Your information is only shared with staff handling this issue.</small></p></div></div><div className="duplicate-note"><Sparkles size={16} /><p><b>Already reported?</b><br />Check <Link to="/my-complaints">your reports</Link> before submitting a duplicate.</p></div></aside></div></PageFrame>
}
function ComplaintDetail() {
  const { id } = useParams()
  const { complaints, updateComplaint, user } = useCampus()
  const [reply, setReply] = useState('')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [feedbackSaved, setFeedbackSaved] = useState(false)
  const item = complaints.find((x) => x.id === id)
  const [signedFiles, setSignedFiles] = useState(null)
  useEffect(() => {
    let active = true
    if (!item?.attachments?.length || !isSupabaseConfigured) return undefined
    Promise.all(item.attachments.map(async (file) => {
      const { data, error } = await supabase.storage.from('complaint-files').createSignedUrl(file.storage_path, 3600)
      if (error) throw error
      return { ...file, url: data.signedUrl }
    })).then((files) => { if (active) setSignedFiles({ complaintId: item.uuid, files }) })
      .catch((error) => console.error('Unable to load complaint attachments:', error.message))
    return () => { active = false }
  }, [item?.uuid, item?.attachments])
  const detailFiles = signedFiles?.complaintId === item?.uuid ? signedFiles.files : []
  if (!item) return <PageFrame title="Report not found"><div className="empty-state page-empty"><ClipboardList size={30} /><h2>We couldn’t find that report.</h2><Link to="/my-complaints" className="btn btn-primary">Back to reports</Link></div></PageFrame>
  const isAdmin = user.role === 'admin'
  const sendReply = async () => {
    if (!reply.trim()) return
    try {
      await updateComplaint(item.id, { response: reply.trim(), updates: [...(item.updates || []), { status: item.status, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), note: reply.trim() }] })
      setReply('')
      setMessage('Your response was added to the report.')
    } catch (error) { setMessage(error.message) }
  }
  const submitFeedback = async () => {
    if (!rating) { setMessage('Choose a rating before submitting feedback.'); return }
    try {
      if (isSupabaseConfigured && item.uuid) {
        const { error } = await supabase.from('feedback').insert({ complaint_id: item.uuid, student_id: user.id, rating, comment: feedback.trim() || null })
        if (error) throw error
      }
      setFeedbackSaved(true)
    } catch (error) {
      setMessage(error.message)
    }
  }
  const progress = item.status === 'Rejected' ? 100 : Math.min(100, ((statusNames.indexOf(item.status) + 1) / 5) * 100)
  return (
    <PageFrame title="Report details">
      <Link to="/my-complaints" className="back-link"><ArrowLeft size={15} /> Back to reports</Link>
      <div className="detail-title-row">
        <div>
          <div className="eyebrow">{item.id} <span>·</span> {item.date}</div>
          <h1>{item.title}</h1>
          <div className="detail-badges"><StatusBadge status={item.status} /><PriorityBadge priority={item.priority} /><span className="category-chip">{item.category}</span></div>
        </div>
        {isAdmin && <div className="detail-admin-actions">
          <label>Update status<select value={item.status} onChange={(event) => updateComplaint(item.id, { status: event.target.value, updated: 'Just now', updates: [...(item.updates || []), { status: event.target.value, date: 'Just now', note: `Status changed to ${event.target.value}.` }] }).catch((error) => setMessage(error.message))}>{statusNames.map((status) => <option key={status}>{status}</option>)}</select></label>
          {user.role === 'admin' && <label>Assign department<select value={item.department === '—' ? '' : item.department} onChange={(event) => updateComplaint(item.id, { department: event.target.value, updated: 'Just now' }).catch((error) => setMessage(error.message))}><option value="">Unassigned</option>{['ICT Services', 'Facilities', 'Library Services', 'Student Affairs', 'Campus Security'].map((team) => <option key={team}>{team}</option>)}</select></label>}
        </div>}
      </div>
      {message && <div className="inline-success"><CheckCircle2 size={15} />{message}</div>}
      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-card">
            <SectionHeading title="About this report" />
            <div className="detail-meta"><span><Building2 size={15} />{item.location}</span><span><UserRound size={15} />{item.anonymous ? 'Submitted anonymously' : item.owner}</span><span><Flag size={15} />{item.department === '—' ? 'Awaiting assignment' : item.department}</span></div>
            <p className="detail-description">{item.description}</p>
            {item.attachmentError && <div className="form-error"><AlertTriangle size={15} />{item.attachmentError}</div>}
            {detailFiles.filter((file) => file.mime_type.startsWith('image/')).map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" style={{ display: 'block', maxWidth: 460, marginTop: 16 }}><img src={file.url} alt={`Photo attached to ${item.title}`} style={{ display: 'block', width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 10 }} /><span>{file.file_name}</span></a>)}
            {detailFiles.filter((file) => !file.mime_type.startsWith('image/')).map((file) => <a key={file.id} href={file.url} target="_blank" rel="noreferrer" style={{ display: 'flex', gap: 7, alignItems: 'center', marginTop: 12 }}><FileUp size={15} />{file.file_name}</a>)}
            {item.response && <div className="response-note"><span className="response-icon"><MessageSquare size={16} /></span><div><b>CampusCare team response</b><p>{item.response}</p><small>Ambo University · Campus team</small></div></div>}
          </section>
          <section className="panel history-card">
            <SectionHeading title="Report history"><span className="history-count">{item.updates?.length || 1} updates</span></SectionHeading>
            <div className="timeline">{(item.updates || [{ status: item.status, date: item.date, note: 'Your report was received.' }]).slice().reverse().map((entry, index) => <div className={`timeline-item${index === 0 ? ' current' : ''}`} key={`${entry.status}-${entry.date}-${index}`}><span className="timeline-dot">{index === 0 ? <Check size={12} /> : null}</span><div><div className="timeline-heading"><b>{entry.is_internal ? 'Internal note' : entry.status}</b><time>{entry.date}</time></div><p>{entry.note}</p></div></div>)}</div>
          </section>
          {isAdmin && <>
            <section className="panel response-card">
              <SectionHeading title="Send a response" />
              <textarea rows={3} value={reply} onChange={(event) => setReply(event.target.value)} placeholder="Write an update for the student..." />
              <div className="response-footer"><small>Visible to the student</small><button className="btn btn-primary btn-small" onClick={sendReply}><Send size={14} /> Send response</button></div>
            </section>
          </>}
          {item.status === 'Resolved' && user.role === 'student' && <section className="panel response-card">
            <SectionHeading title={feedbackSaved ? 'Thank you for your feedback!' : 'How did we do?'} />
            <p className="feedback-prompt">Your feedback helps us keep improving the campus.</p>
            {feedbackSaved ? <div className="inline-success"><CheckCircle2 size={15} />Feedback submitted. Thank you!</div> : <>
              <div className="rating-buttons" role="group" aria-label="Rate your resolution">{[1, 2, 3, 4, 5].map((value) => <button key={value} aria-label={`${value} star${value > 1 ? 's' : ''}`} onClick={() => setRating(value)}><Star size={19} fill={rating >= value ? '#e5a84e' : 'none'} color={rating >= value ? '#e5a84e' : '#b5bdc9'} /></button>)}</div>
              <textarea rows={2} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Anything else you'd like to share? (optional)" />
              <button className="btn btn-primary btn-small feedback-submit" onClick={submitFeedback}>Submit feedback <ArrowRight size={14} /></button>
            </>}
          </section>}
        </div>
        <aside className="detail-aside">
          <div className="panel progress-card"><span className="eyebrow">REPORT PROGRESS</span><div className="progress-big"><span>{Math.round(progress)}%</span><small>of the way there</small></div><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><p>We’ll notify you as soon as there’s an update.</p><div className="progress-foot"><span className="live-dot" /> Last updated {item.updated}</div></div>
          <div className="panel assigned-card"><span className="eyebrow">ASSIGNED TEAM</span><div className="assigned-team"><span><Building2 size={17} /></span><div><b>{item.department === '—' ? 'Awaiting assignment' : item.department}</b><small>Ambo University · Woliso</small></div></div><div className="team-contact"><span><Clock3 size={14} />Response time</span><b>Usually within 2 days</b></div></div>
          <div className="detail-help"><CircleHelp size={17} /><span>Have more to add?<small>Contact the team handling this report.</small></span><button onClick={() => document.dispatchEvent(new Event('campuscare:help'))}><ArrowRight size={16} /></button></div>
        </aside>
      </div>
    </PageFrame>
  )
}
function Notifications() {
  const { notifications, markNotificationsRead } = useCampus()
  const [error, setError] = useState('')
  const icons = { blue: MessageSquare, violet: UserRound, green: CheckCircle2, orange: Bell }
  const grouped = notifications.reduce((groups, notice) => {
    groups[notice.date] ||= []
    groups[notice.date].push(notice)
    return groups
  }, {})
  return <PageFrame title="Notifications"><div className="page-heading"><div><div className="eyebrow">STAY IN THE LOOP</div><h1>Notifications</h1><p>Updates on your reports and what’s happening at Woliso.</p></div><button className="btn btn-outline" onClick={() => markNotificationsRead().catch((readError) => setError(readError.message))}><Check size={15} /> Mark all as read</button></div>{error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}<div className="panel notification-list">{Object.entries(grouped).map(([date, notices]) => <div key={date}><div className="notice-date">{date}</div>{notices.map((notice) => { const Icon = icons[notice.color] || Bell; return <div className={`notification-item${notice.read ? '' : ' unread'}`} key={notice.id}><span className={`notice-icon ${notice.color}`}><Icon size={17} /></span><div><b>{notice.title}</b><p>{notice.text}</p><small>{notice.time}</small></div>{!notice.read && <span className="unread-dot" />}</div> })}</div>)}</div></PageFrame>
}
function AnnouncementCard({ announcement }) {
  const [expanded, setExpanded] = useState(false)
  const Icon = announcement.icon
  return <article className={`panel announcement-card${expanded ? ' expanded' : ''}`}><span className={`announcement-card-icon ${announcement.accent}`}><Icon size={19} /></span><div className="announcement-meta">{announcement.label} <span>·</span> {announcement.date}</div><h2>{announcement.title}</h2><p>{announcement.text}</p><button className="text-link" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show less' : 'Read more'} <ArrowRight size={14} /></button></article>
}
function Announcements() {
  const { user } = useCampus()
  const [announcements, setAnnouncements] = useState([])
  const [form, setForm] = useState({ title: '', body: '', category: 'Campus news' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let active = true
    supabase.from('announcements').select('*').order('published_at', { ascending: false }).then(({ data, error: resultError }) => {
      if (resultError) { setError(resultError.message); return }
      if (active && data) setAnnouncements(data.map((row) => ({ id: row.id, label: row.category.toUpperCase(), date: new Date(row.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), title: row.title, text: row.body, icon: Sparkles, accent: 'blue' })))
    })
    return () => { active = false }
  }, [])
  const publish = async (event) => {
    event.preventDefault()
    setError('')
    try {
      if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to publish announcements.')
      const row = { title: form.title.trim(), body: form.body.trim(), category: form.category, author_id: user.id || null }
      const { data, error: insertError } = await supabase.from('announcements').insert(row).select().single()
      if (insertError) throw insertError
      setAnnouncements((old) => [{ id: data.id, label: data.category.toUpperCase(), date: new Date(data.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase(), title: data.title, text: data.body, icon: Sparkles, accent: 'blue' }, ...old])
      setForm({ title: '', body: '', category: 'Campus news' })
      setNotice('Announcement published. Students have been notified.')
    } catch (publishError) { setError(publishError.message) }
  }
  return <PageFrame title="Announcements"><div className="page-heading"><div><div className="eyebrow">FROM YOUR CAMPUS COMMUNITY</div><h1>Campus announcements</h1><p>News, updates, and improvements from Ambo University · Woliso Campus.</p></div></div>{user.role === 'admin' && <form className="panel report-form" onSubmit={publish}><SectionHeading title="Publish an announcement" /><label className="field-label">Title<input required maxLength={150} value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></label><label className="field-label">Message<textarea required minLength={10} rows={3} value={form.body} onChange={(event) => setForm((old) => ({ ...old, body: event.target.value }))} /></label><div className="form-two-col"><label className="field-label">Category<input required value={form.category} onChange={(event) => setForm((old) => ({ ...old, category: event.target.value }))} /></label><button className="btn btn-primary" type="submit"><Send size={15} /> Publish & notify students</button></div></form>}{error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}{notice && <div className="inline-success"><CheckCircle2 size={15} />{notice}</div>}<div className="announcements-grid">{announcements.map((announcement) => <AnnouncementCard key={announcement.id || announcement.title} announcement={announcement} />)}</div></PageFrame>
}
function Profile() {
  const { user, updateUser, theme, toggleTheme, signOut } = useCampus()
  const [name, setName] = useState(user.name || '')
  const [studentId, setStudentId] = useState(user.studentId || '')
  const [department, setDepartment] = useState(user.department || 'Computer Science')
  const [academicYear, setAcademicYear] = useState(user.academicYear || '1st year')
  const [phone, setPhone] = useState(user.phone || '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const save = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await updateUser({ name, studentId, department, academicYear, phone })
      setSaved(true)
      setTimeout(() => setSaved(false), 3500)
    } catch (saveError) { setError(saveError.message || 'Your profile could not be saved.') }
  }
  return <PageFrame title="My profile">
    <div className="page-heading"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>My profile</h1><p>Manage your personal information and preferences.</p></div></div>
    {!studentId && <div className="profile-completion"><GraduationCap size={17} /><span><b>Complete your student profile</b><small>Add your student ID and academic details so campus teams can follow up on your reports.</small></span></div>}
    <div className="profile-layout"><div className="panel profile-card"><div className="profile-banner"><span className="profile-avatar-large">{name.split(' ').map((x) => x[0]).slice(0, 2).join('') || 'U'}</span><span className="profile-edit-chip"><UserRound size={14} /> {user.role === 'admin' ? 'Administrator profile' : 'Student profile'}</span></div>
      <form className="profile-form" onSubmit={save}>
        <div className="form-two-col"><label className="field-label">Full name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label className="field-label">Student ID<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="e.g. AU-WSC-2025-001" /></label></div>
        <div className="form-two-col"><label className="field-label">Email address<input type="email" value={user.email || ''} disabled /><span className="field-hint">Your university email is verified.</span></label><label className="field-label">Department<div className="select-wrap"><select value={department} onChange={(event) => setDepartment(event.target.value)}>{['Computer Science', 'Information Technology', 'Electrical Engineering', 'Civil Engineering', 'Business Administration', 'Health Sciences', 'ICT Services', 'Facilities', 'Library Services', 'Student Affairs'].map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={15} /></div></label></div>
        <div className="form-two-col"><label className="field-label">Academic year<div className="select-wrap"><select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>{['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Graduate'].map((value) => <option key={value}>{value}</option>)}</select><ChevronDown size={15} /></div></label><label className="field-label">Phone number <small>(optional)</small><input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+251 9..." /></label></div>
        {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}
        <div className="profile-form-footer"><button className="btn btn-primary" type="submit">Save changes <Check size={15} /></button>{saved && <span className="inline-success"><CheckCircle2 size={15} />Profile saved</span>}</div>
      </form>
    </div><aside className="profile-side"><div className="panel settings-card"><span className="eyebrow">PREFERENCES</span><div className="setting-row"><span><Sun size={17} /><span><b>Appearance</b><small>Choose your preferred theme</small></span></span><button className="theme-select" onClick={toggleTheme}>{theme === 'dark' ? 'Dark' : 'Light'} <ChevronDown size={14} /></button></div><div className="setting-row"><span><Bell size={17} /><span><b>Email notifications</b><small>Get updates when reports change</small></span></span><button className="toggle-switch enabled" aria-label="Toggle email notifications" onClick={(event) => event.currentTarget.classList.toggle('enabled')}><i /></button></div></div><div className="panel security-card"><div className="security-icon"><ShieldCheck size={18} /></div><b>Your information is safe</b><p>Your profile is only visible to authorized Ambo University staff.</p><button className="text-link" onClick={() => alert('Contact support@ambo.edu.et to manage your account security.')}>Privacy & security <ArrowRight size={14} /></button></div><button className="btn btn-outline btn-full signout-profile" onClick={signOut}><LogOut size={16} />Sign out of CampusCare</button></aside></div>
  </PageFrame>
}
function AdminPage() {
  const { complaints } = useCampus()
  const navigate = useNavigate()
  const [now] = useState(() => new Date())
  const resolvedThisMonth = complaints.filter((item) => {
    if (item.status !== 'Resolved' || !item.resolved_at) return false
    const resolvedAt = new Date(item.resolved_at)
    return resolvedAt.getFullYear() === now.getFullYear() && resolvedAt.getMonth() === now.getMonth()
  }).length
  const resolutionTimes = complaints
    .filter((item) => item.status === 'Resolved' && item.created_at && item.resolved_at)
    .map((item) => (new Date(item.resolved_at) - new Date(item.created_at)) / 86400000)
    .filter((days) => Number.isFinite(days) && days >= 0)
  const averageResolutionTime = resolutionTimes.length
    ? `${(resolutionTimes.reduce((total, days) => total + days, 0) / resolutionTimes.length).toFixed(1)}d`
    : '—'
  const categoryTotals = Object.entries(complaints.reduce((totals, item) => {
    totals[item.category] = (totals[item.category] || 0) + 1
    return totals
  }, {})).sort((a, b) => b[1] - a[1])
  const categoryStats = categoryTotals.slice(0, 4).map(([name, count], index) => ({
    name,
    value: complaints.length ? Math.round(count / complaints.length * 100) : 0,
    color: ['blue', 'violet', 'teal', 'orange'][index],
  }))
  const departmentStats = Object.entries(complaints.reduce((totals, item) => {
    if (item.department && item.department !== '—') totals[item.department] = (totals[item.department] || 0) + 1
    return totals
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const busiestCategory = categoryTotals[0]
  const data = Array.from({ length: 6 }, (_, index) => {
    const month = new Date()
    month.setDate(1)
    month.setMonth(month.getMonth() - 5 + index)
    const reports = complaints.filter((item) => {
      const date = new Date(item.created_at || item.date)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth()
    }).length
    return { name: month.toLocaleDateString('en-US', { month: 'short' }), reports }
  })
  return <PageFrame title="Admin overview"><div className="welcome-row admin-welcome"><div><div className="eyebrow"><span className="live-dot" />CAMPUS OPERATIONS</div><h1>CampusCare administration</h1><p>Live complaint activity for Woliso Campus.</p></div><div className="page-heading-actions"><button className="btn btn-outline" onClick={() => downloadCsv(complaints)}><Download size={16} /> Export CSV</button><button className="btn btn-outline" onClick={() => window.print()}><Printer size={16} /> Export PDF</button><Link className="btn btn-outline" to="/admin/departments"><Building2 size={16} /> Departments</Link></div></div><div className="stats-grid"><StatCard label="Total complaints" value={String(complaints.length).padStart(2, '0')} note="All recorded reports" icon={ClipboardList} color="blue" /><StatCard label="Needs attention" value={String(complaints.filter((item) => !['Resolved', 'Rejected'].includes(item.status)).length).padStart(2, '0')} note="Awaiting resolution" icon={AlertTriangle} color="orange" /><StatCard label="Resolved this month" value={String(resolvedThisMonth).padStart(2, '0')} note="Resolved this calendar month" icon={CheckCircle2} color="green" /><StatCard label="Avg. resolution time" value={averageResolutionTime} note={resolutionTimes.length ? `Across ${resolutionTimes.length} resolved reports` : 'No resolved report data yet'} icon={Zap} color="violet" /></div><div className="dashboard-grid admin-grid"><section className="panel admin-chart-panel"><SectionHeading title="Complaint activity">Reports submitted over the last 6 months.</SectionHeading><div className="admin-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 12, right: 8, left: -15, bottom: 0 }}><defs><linearGradient id="adminGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2f71ec" stopOpacity={0.15} /><stop offset="100%" stopColor="#2f71ec" stopOpacity={0.005} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#edf0f5" strokeDasharray="3 4" /><XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9aa3b2' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#9aa3b2' }} axisLine={false} tickLine={false} /><Tooltip /><Area type="monotone" dataKey="reports" stroke="#3678ec" strokeWidth={2.2} fill="url(#adminGradient)" /></AreaChart></ResponsiveContainer></div></section><section className="panel categories-panel"><SectionHeading title="Reports by category" /><div className="category-stats">{categoryStats.map(({ name, value, color }) => <div className="category-stat" key={name}><span><i className={`cat-dot ${color}`} />{name}</span><b>{value}%</b><div className="mini-bar"><i className={color} style={{ width: `${value}%` }} /></div></div>)}{!categoryStats.length && <div className="empty-state">No complaint data yet.</div>}</div></section></div><section className="panel admin-table-panel"><SectionHeading title="Latest complaints" to="/admin/complaints" action="View all complaints">Stay on top of the latest campus concerns.</SectionHeading><div className="table-head"><span>REPORT</span><span>PRIORITY</span><span>STATUS</span><span>UPDATED</span><span /></div><ComplaintTable items={complaints.slice(0, 4)} /></section><div className="admin-bottom"><div className="panel team-card"><div><span className="eyebrow">DEPARTMENTS</span><h3>Complaint assignments</h3></div><button className="text-link" onClick={() => navigate('/admin/departments')}>Manage departments <ArrowRight size={14} /></button><div className="team-list">{departmentStats.map(([name, count], index) => <div className="team-row" key={name}><span className={`team-avatar ${['blue', 'orange', 'violet'][index]}`}><Building2 size={16} /></span><b>{name}</b><small>{count} assigned</small><ArrowUpRight size={14} /></div>)}{!departmentStats.length && <span>No departments assigned yet.</span>}</div></div><div className="admin-insight"><span className="insight-icon"><Sparkles size={18} /></span><span className="eyebrow">CAMPUS INSIGHT</span><h3>{busiestCategory?.[0] || 'No complaints yet'}</h3><p>{busiestCategory ? `${busiestCategory[1]} complaint${busiestCategory[1] === 1 ? '' : 's'} recorded in this category.` : 'Complaint statistics will appear here as reports arrive.'}</p><Link to="/admin/complaints">Review complaints <ArrowRight size={14} /></Link></div></div></PageFrame>
}
function PeoplePage() {
  const [people, setPeople] = useState([])
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase.from('profiles').select('id, full_name, email, role, department').order('full_name').then(({ data, error: resultError }) => {
      if (resultError) { setError(resultError.message); return }
      if (data) setPeople(data.map((person) => ({ id: person.id, name: person.full_name, email: person.email, role: person.role, department: person.department || '—' })))
    })
  }, [])
  const updatePerson = async (id, patch) => {
    setError('')
    try {
      if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to manage accounts.')
      const { error: updateError } = await supabase.from('profiles').update(patch).eq('id', id)
      if (updateError) throw updateError
      setPeople((old) => old.map((person) => person.id === id ? { ...person, ...patch } : person))
    } catch (updateError) { setError(updateError.message) }
  }
  const filtered = people.filter((person) => `${person.name} ${person.email} ${person.department}`.toLowerCase().includes(query.toLowerCase()))
  return <PageFrame title="Students & departments"><div className="page-heading"><div><div className="eyebrow">CAMPUS DIRECTORY</div><h1>Students & administrators</h1><p>Review student accounts and manage administrator access.</p></div><Link className="btn btn-outline" to="/admin/departments"><Building2 size={15} /> Manage departments</Link><span className="people-count"><Users size={15} />{people.length} members</span></div>{error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}<section className="panel people-panel"><div className="people-toolbar"><label className="table-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search students" /></label><span className="people-help"><ShieldCheck size={14} />Only administrators can change roles.</span></div><div className="people-head"><span>MEMBER</span><span>ROLE</span><span>DEPARTMENT</span></div><div>{filtered.map((person) => <div className="person-row" key={person.id}><span className="person-identity"><span className="avatar">{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><span><b>{person.name}</b><small>{person.email}</small></span></span><label className="person-role"><span className={`role-pill role-${person.role}`}>{person.role}</span><select aria-label={`Change ${person.name}'s role`} value={person.role} onChange={(e) => updatePerson(person.id, { role: e.target.value })}><option value="student">Student</option><option value="admin">Administrator</option></select><ChevronDown size={13} /></label><label className="person-department"><select aria-label={`Change ${person.name}'s department`} value={person.department || ''} onChange={(e) => updatePerson(person.id, { department: e.target.value })}>{['', 'Computer Science', 'Information Technology', 'Electrical Engineering', 'Civil Engineering', 'Business Administration', 'Health Sciences'].map((department) => <option key={department} value={department}>{department || 'No department'}</option>)}</select><ChevronDown size={13} /></label></div>)}{!filtered.length && <div className="empty-state"><Users size={25} /><b>No people found</b><span>Try a different search.</span></div>}</div><div className="people-foot"><span>Account roles update immediately.</span><span><span className="footer-status" /> Directory synced</span></div></section><div className="people-note"><ShieldCheck size={16} /><span><b>Role-based access is enforced by Supabase RLS.</b> Students can access only their own complaints; administrators manage campus-wide records.</span></div></PageFrame>
}
function DepartmentManager() {
  const [departments, setDepartments] = useState([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let active = true
    supabase.from('departments').select('id, name, description').order('name').then(({ data, error: resultError }) => {
      if (resultError) { setError(resultError.message); return }
      if (active && data) setDepartments(data)
    })
    return () => { active = false }
  }, [])
  const saveDepartment = async (event) => {
    event.preventDefault()
    setError('')
    const trimmedName = name.trim()
    if (!trimmedName) return
    try {
      if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to manage departments.')
      const { data, error: insertError } = await supabase.from('departments').insert({ name: trimmedName, description: description.trim() || null }).select('id, name, description').single()
      if (insertError) throw insertError
      setDepartments((old) => [...old, data].sort((a, b) => a.name.localeCompare(b.name)))
      setName('')
      setDescription('')
      setNotice('Department added.')
    } catch (saveError) { setError(saveError.message) }
  }
  const removeDepartment = async (department) => {
    if (!window.confirm(`Remove ${department.name}? Existing complaints will become unassigned.`)) return
    setError('')
    try {
      if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to manage departments.')
      const { error: deleteError } = await supabase.from('departments').delete().eq('id', department.id)
      if (deleteError) throw deleteError
      const next = departments.filter((item) => item.id !== department.id)
      setDepartments(next)
      setNotice('Department removed.')
    } catch (deleteError) { setError(deleteError.message) }
  }
  return <PageFrame title="Departments">
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>Departments</h1><p>Manage campus teams available for complaint assignment.</p></div><Link to="/admin/people" className="btn btn-outline"><ArrowLeft size={15} /> Students & administrators</Link></div>
    <form className="panel report-form" onSubmit={saveDepartment}>
      <SectionHeading title="Add a department" />
      <div className="form-two-col"><label className="field-label">Department name<input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Registrar Office" /></label><label className="field-label">Description<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this department handles" /></label></div>
      <button className="btn btn-primary" type="submit"><Plus size={15} /> Add department</button>
    </form>
    {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}
    {notice && <div className="inline-success"><CheckCircle2 size={15} />{notice}</div>}
    <section className="panel people-panel" style={{ marginTop: 18 }}>
      <div className="people-head"><span>DEPARTMENT</span><span>DESCRIPTION</span><span>ACTION</span></div>
      {departments.map((department) => <div className="person-row" key={department.id}><span className="person-identity"><span className="team-avatar blue"><Building2 size={16} /></span><b>{department.name}</b></span><span>{department.description || '—'}</span><button className="btn btn-outline btn-small" onClick={() => removeDepartment(department)}><X size={14} /> Remove</button></div>)}
      {!departments.length && <div className="empty-state"><Building2 size={25} /><b>No departments yet</b><span>Add one to enable complaint assignment.</span></div>}
    </section>
  </PageFrame>
}
function AuthPage({ signup = false }) {
  const { signIn, signUp, signInGoogle } = useCampus()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', studentId: '', email: '', password: '', confirm: '', department: '', year: '1st year', phone: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const update = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const submit = async (e) => {
    e.preventDefault(); setError('')
    if (signup && form.password !== form.confirm) { setError('Your passwords don’t match. Please try again.'); return }
    setLoading(true)
    try { if (signup) await signUp(form); else await signIn(form.email, form.password); navigate('/dashboard') } catch (err) { setError(err.message || 'Something went wrong. Please try again.') } finally { setLoading(false) }
  }
  return <div className="auth-page">
    <div className="auth-left">
      <div className="auth-brand"><Brand /></div>
      <div className="auth-content">
        <div className="eyebrow"><span className="live-dot" /> AMBO UNIVERSITY · WOLISO CAMPUS</div>
        <h1>Your campus.<br /><span>Your voice.</span><br />Better together.</h1>
        <p>Every report brings us one step closer to a campus that works better for everyone.</p>
      </div>
      <div className="auth-left-footer"><span>© 2025 Ambo University</span><span><ShieldCheck size={14} /> Secure & student-first</span></div>
      <div className="auth-decoration decoration-one" /><div className="auth-decoration decoration-two" />
    </div>
    <div className="auth-right">
      <div className="auth-mobile-brand"><Brand /></div>
      <div className="auth-form-wrap">
        <Link to="/" className="back-link auth-back"><ArrowLeft size={15} /> Back to CampusCare</Link>
        <div className="auth-heading">
          <span className="eyebrow">{signup ? 'JOIN YOUR CAMPUS COMMUNITY' : 'WELCOME BACK'}</span>
          <h2>{signup ? 'Create your account' : 'Good to have you back.'}</h2>
          <p>{signup ? 'A better campus starts with your voice.' : 'Sign in to see what’s happening on your campus.'}</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {signup && <>
            <label className="field-label">Full name<input autoComplete="name" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your full name" /></label>
            <div className="form-two-col">
              <label className="field-label">Student ID<input required value={form.studentId} onChange={(e) => update('studentId', e.target.value)} placeholder="e.g. AU-WSC-2025-001" /></label>
              <label className="field-label">Department<div className="select-wrap"><select required value={form.department} onChange={(e) => update('department', e.target.value)}><option value="" disabled>Select department</option>{['Computer Science', 'Information Technology', 'Electrical Engineering', 'Civil Engineering', 'Business Administration', 'Health Sciences'].map((x) => <option key={x}>{x}</option>)}</select><ChevronDown size={14} /></div></label>
            </div>
          </>}
          <label className="field-label">University email<input type="email" required autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@ambo.edu.et" /></label>
          {signup && <div className="form-two-col">
            <label className="field-label">Academic year<div className="select-wrap"><select value={form.year} onChange={(e) => update('year', e.target.value)}>{['1st year', '2nd year', '3rd year', '4th year', '5th year', 'Graduate'].map((x) => <option key={x}>{x}</option>)}</select><ChevronDown size={14} /></div></label>
            <label className="field-label">Phone <small>(optional)</small><input type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+251 9..." /></label>
          </div>}
          <label className="field-label">Password<input type="password" required minLength={8} autoComplete={signup ? 'new-password' : 'current-password'} value={form.password} onChange={(e) => update('password', e.target.value)} placeholder={signup ? 'At least 8 characters' : 'Enter your password'} /></label>
          {signup
            ? <label className="field-label">Confirm password<input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} placeholder="Enter your password again" /></label>
            : <div className="remember-row">
              <label><input type="checkbox" defaultChecked /> Remember me</label>
              <button type="button" className="text-link" onClick={() => {
                const email = form.email
                if (!email) { setError('Enter your university email first, then select Forgot password.'); return }
                supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` })
                  .then(({ error: resetError }) => setError(resetError ? resetError.message : 'Password reset link sent. Check your email.'))
              }}>Forgot password?</button>
            </div>}
          {!isSupabaseConfigured && <p className="field-hint">Connect your Supabase project to sign in or create an account.</p>}
          {error && <div className="form-error"><AlertTriangle size={15} />{error}</div>}
          <button disabled={loading} className="btn btn-primary btn-full auth-submit">{loading ? 'Please wait…' : signup ? 'Create account' : 'Sign in'} {!loading && <ArrowRight size={16} />}</button>
        </form>
        {!signup && <>
          <div className="auth-divider"><span />or continue with<span /></div>
          <button className="google-btn" onClick={() => signInGoogle().catch((e) => setError(e.message))}><GoogleIcon /> Continue with Google</button>
        </>}
        <p className="auth-switch">{signup ? 'Already part of CampusCare?' : 'New to CampusCare?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'} <ArrowRight size={14} /></Link></p>
        <p className="auth-terms">By continuing, you agree to CampusCare’s <button onClick={() => setError('CampusCare uses your student account details only to manage campus reports. Contact support@ambo.edu.et for privacy questions.')}>Privacy Policy</button> and <button onClick={() => setError('CampusCare is provided for Ambo University students and staff to report campus issues responsibly.')}>Terms of Service</button>.</p>
      </div>
      <div className="auth-right-footer"><span>Ambo University · Woliso Campus</span><span><span className="footer-status" /> All systems operational</span></div>
    </div>
  </div>
}
function LandingPage() {
  const { user } = useCampus()
  const [year] = useState(() => new Date().getFullYear())
  const startPath = user ? '/dashboard' : '/signup'
  const signInPath = user ? '/dashboard' : '/login'
  return <div className="landing-page">
    <header className="landing-header">
      <div className="landing-nav">
        <Brand />
        <nav className="landing-links" aria-label="Landing page navigation">
          <a href="#features">What you can do</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="landing-actions">
          <Link className="landing-signin" to={signInPath}>{user ? 'My workspace' : 'Sign in'}</Link>
          <Link className="btn btn-primary landing-cta" to={startPath}>{user ? 'Open dashboard' : 'Get started'} <ArrowRight size={15} /></Link>
        </div>
      </div>
    </header>
    <main>
      <section className="landing-hero">
        <div className="landing-hero-inner">
          <div className="landing-hero-copy">
            <span className="landing-eyebrow"><span className="live-dot" /> AMBO UNIVERSITY · WOLISO CAMPUS</span>
            <h1>Your campus.<br /><span>Your voice.</span><br />Better together.</h1>
            <p>See something on campus that needs attention? Tell us about it, follow its progress, and help make Woliso Campus better for everyone.</p>
            <div className="landing-hero-actions">
              <Link className="btn btn-primary landing-main-cta" to={startPath}>Report an issue <ArrowRight size={16} /></Link>
              <a className="landing-secondary-cta" href="#how-it-works"><span><ArrowRight size={14} /></span> See how it works</a>
            </div>
            <div className="landing-trust"><ShieldCheck size={16} /><span>Private, student-first reporting</span><i /> <span>Updates you can follow</span></div>
          </div>
          <div className="landing-visual" aria-label="Example of a campus issue report and its progress">
            <div className="landing-orbit landing-orbit-one" /><div className="landing-orbit landing-orbit-two" />
            <div className="landing-visual-label"><span className="landing-visual-dot" /> A CAMPUS THAT WORKS BETTER</div>
            <div className="landing-report-card">
              <div className="landing-report-top"><span className="landing-report-icon"><Wifi size={18} /></span><span className="landing-report-id">SAMPLE REPORT <b>· CC-2026-0142</b></span><MoreHorizontal size={17} /></div>
              <h2>Wi-Fi connection in the library</h2>
              <p>Library study hall <span>·</span> Submitted just now</p>
              <div className="landing-report-divider" />
              <div className="landing-progress-heading"><span>Report progress</span><span className="landing-review-badge"><i /> Under review</span></div>
              <div className="landing-progress-track"><i /></div>
              <div className="landing-progress-steps"><span className="complete">Submitted</span><span className="current">Under review</span><span>Resolved</span></div>
              <div className="landing-update"><span className="landing-update-icon"><MessageSquare size={15} /></span><span><b>Your campus team is on it</b><small>We’ll let you know when there’s an update.</small></span><ArrowUpRight size={15} /></div>
            </div>
            <div className="landing-float-card"><span><CheckCircle2 size={17} /></span><div><b>Your voice matters</b><small>Every report helps.</small></div></div>
            <div className="landing-location"><MapPin size={14} /> WOLISO CAMPUS</div>
          </div>
        </div>
      </section>
      <section className="landing-features" id="features">
        <div className="landing-section-heading"><span className="landing-section-kicker">CAMPUSCARE, MADE FOR YOU</span><h2>Turn campus concerns into progress.</h2><p>One place to speak up, stay informed, and help improve the campus you call home.</p></div>
        <div className="landing-feature-grid">
          <article className="landing-feature-card"><span className="landing-feature-icon feature-blue"><ClipboardList size={20} /></span><h3>Report what needs attention</h3><p>Share campus issues with a location, details, and a photo so the right team knows where to start.</p><Link to={startPath}>Make a report <ArrowRight size={14} /></Link></article>
          <article className="landing-feature-card"><span className="landing-feature-icon feature-green"><Clock3 size={20} /></span><h3>Follow every update</h3><p>Check your report’s status and read responses from the campus team, all in one place.</p><Link to={signInPath}>Track a report <ArrowRight size={14} /></Link></article>
          <article className="landing-feature-card"><span className="landing-feature-icon feature-violet"><ShieldCheck size={20} /></span><h3>Speak up with confidence</h3><p>Your reports stay within the CampusCare system, with anonymous reporting available when needed.</p><a href="#how-it-works">Learn how it works <ArrowRight size={14} /></a></article>
        </div>
      </section>
      <section className="landing-how" id="how-it-works">
        <div className="landing-how-inner">
          <div className="landing-how-copy"><span className="landing-section-kicker">SIMPLE FROM START TO FINISH</span><h2>A better campus starts with one report.</h2><p>No complicated process. Tell us what’s happening and let the campus team take it from there.</p><Link className="landing-how-link" to={startPath}>Get started today <ArrowRight size={15} /></Link></div>
          <div className="landing-steps">
            <article><span className="landing-step-number">01</span><div><h3>Tell us what’s wrong</h3><p>Choose a category and describe the issue. Add a location or photo to help explain.</p></div></article>
            <article><span className="landing-step-number">02</span><div><h3>We get it to the right team</h3><p>Your report is reviewed and directed to the campus department that can help.</p></div></article>
            <article><span className="landing-step-number">03</span><div><h3>Stay in the loop</h3><p>Follow the status and see updates as the team works toward a resolution.</p></div></article>
          </div>
        </div>
      </section>
      <section className="landing-bottom-cta"><div><span className="landing-section-kicker">YOUR CAMPUS. YOUR VOICE.</span><h2>Let’s make Woliso Campus better, together.</h2><p>Your experience matters. Start with the issue you want to see fixed.</p></div><Link className="btn landing-bottom-button" to={startPath}>Share a campus concern <ArrowRight size={16} /></Link></section>
    </main>
    <footer className="landing-footer"><Brand compact /><span>© {year} Ambo University · Woliso Campus</span><a href="mailto:support@ambo.edu.et">Need help? Contact support <ArrowUpRight size={13} /></a></footer>
  </div>
}
function GoogleIcon() { return <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94a11.05 11.05 0 0 1-4.8 7.24l7.73 5.99c4.52-4.18 7.11-10.33 7.11-17.7Z" /><path fill="#FBBC05" d="M10.53 28.59a14.4 14.4 0 0 1 0-9.18l-7.98-6.2a23.95 23.95 0 0 0 0 21.58l7.98-6.2Z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.8l-7.73-5.99c-2.14 1.43-4.89 2.28-8.17 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.2C6.51 42.62 14.62 48 24 48Z" /></svg> }
function ProtectedRoute({ roles }) {
  const { user, authLoading } = useCampus()
  const location = useLocation()
  if (authLoading) return <div className="loading-screen"><CampusMark /><span>Loading your campus workspace…</span></div>
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />
  return <OutletRoutes />
}
function OutletRoutes() {
  const { user } = useCampus()
  return <Routes>
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/my-complaints" element={<ComplaintsPage />} />
    <Route path="/report" element={<ReportForm />} />
    <Route path="/complaint/:id" element={<ComplaintDetail />} />
    <Route path="/notifications" element={<Notifications />} />
    <Route path="/announcements" element={<Announcements />} />
    <Route path="/profile" element={<Profile />} />
    <Route path="/admin" element={user.role === 'admin' ? <AdminPage /> : <Navigate to="/dashboard" replace />} />
    <Route path="/admin/complaints" element={user.role === 'admin' ? <ComplaintsPage admin /> : <Navigate to="/dashboard" replace />} />
    <Route path="/admin/people" element={user.role === 'admin' ? <PeoplePage /> : <Navigate to="/dashboard" replace />} />
    <Route path="/admin/departments" element={user.role === 'admin' ? <DepartmentManager /> : <Navigate to="/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>
}
function App() {
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured)
  const [complaints, setComplaints] = useState([])
  const [notifications, setNotifications] = useState([])
  const [theme, setTheme] = useState(() => localStorage.getItem('campuscare-theme') || 'light')
  const [language, setLanguageState] = useState(() => localStorage.getItem('campuscare-language') || 'en')
  async function loadProfile(authUser) {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle()
    if (error) console.error('Unable to load CampusCare profile:', error.message)
    const profile = { id: authUser.id, name: data?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student', email: authUser.email, role: data?.role === 'admin' ? 'admin' : 'student', studentId: data?.student_id, department: data?.department, academicYear: data?.academic_year, phone: data?.phone }
    setUser(profile)
  }
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('campuscare-theme', theme)
  }, [theme])
  const setLanguage = (value) => {
    setLanguageState(value)
    localStorage.setItem('campuscare-language', value)
  }
  useEffect(() => {
    if (!isSupabaseConfigured) return undefined
    let active = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      if (data.session?.user) await loadProfile(data.session.user)
      setAuthLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user)
      else setUser(null)
    })
    return () => { active = false; subscription.subscription.unsubscribe() }
  }, [])
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return undefined
    let active = true
    supabase.from('complaints').select('*, complaint_updates(*), complaint_attachments(*), departments(name), profiles(full_name)').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) { console.error('Unable to load complaints:', error.message); return }
      if (active && data) setComplaints(data.map((complaint) => mapComplaint(complaint, user)))
    })
    supabase.from('notifications').select('*').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) { console.error('Unable to load notifications:', error.message); return }
      if (active && data) setNotifications(data.map(mapNotification))
    })
    const channel = supabase.channel(`campuscare-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, (event) => {
        if (event.eventType === 'DELETE') {
          setComplaints((old) => old.filter((item) => item.uuid !== event.old.id))
          return
        }
        supabase.from('complaints').select('*, complaint_updates(*), complaint_attachments(*), departments(name), profiles(full_name)').eq('id', event.new.id).single().then(({ data, error }) => {
          if (error) { console.error('Unable to refresh complaint:', error.message); return }
          if (!active || !data) return
          const mapped = mapComplaint(data, user)
          setComplaints((old) => {
            const exists = old.some((item) => item.uuid === data.id)
            return exists
              ? old.map((item) => item.uuid === data.id ? mapped : item)
              : [mapped, ...old]
          })
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'complaint_updates' }, (event) => {
        supabase.from('complaints').select('*, complaint_updates(*), complaint_attachments(*), departments(name), profiles(full_name)').eq('id', event.new.complaint_id).single().then(({ data, error }) => {
          if (error) { console.error('Unable to refresh complaint history:', error.message); return }
          if (data) setComplaints((old) => old.map((item) => item.uuid === data.id ? mapComplaint(data, user) : item))
        })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (event) => setNotifications((old) => [mapNotification(event.new), ...old]))
      .subscribe()
    return () => { active = false; supabase.removeChannel(channel) }
  }, [user])
  const signIn = async (email, password) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add your project URL and anon key to .env before signing in.')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }
  const signUp = async (form) => {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured. Add your project URL and anon key to .env before creating an account.')
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.name, student_id: form.studentId, department: form.department, academic_year: form.year, phone: form.phone } } })
    if (error) throw error
    if (!data.session) throw new Error('Account created. Check your university email to confirm your account, then sign in.')
    await loadProfile(data.user)
  }
  const signInGoogle = async () => {
    if (!isSupabaseConfigured) throw new Error('Add your Supabase URL and anon key to .env to enable Google sign in.')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/dashboard` } })
    if (error) throw error
  }
  const markNotificationsRead = async () => {
    if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to update notifications.')
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    if (error) throw error
    setNotifications((old) => old.map((notice) => ({ ...notice, read: true })))
  }
  const signOut = async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    setUser(null)
    window.location.href = '/login'
  }
  const addComplaint = async (form) => {
    if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to submit reports.')
    const id = makeId()
    const newItem = { id, public_id: id, title: form.title.trim(), category: form.category, location: form.location.trim(), description: form.description.trim(), status: 'Submitted', priority: form.priority, emergency: Boolean(form.emergency), date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), updated: 'Just now', owner: form.anonymous ? 'Anonymous student' : user.name, anonymous: form.anonymous, department: '—', attachments: [], updates: [{ status: 'Submitted', date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), note: 'Your report was received and will be reviewed by our campus team.' }] }
    const { data, error } = await supabase.from('complaints').insert({
        public_id: id,
        student_id: form.anonymous ? null : (user?.id || null),
        academic_year: form.anonymous ? null : (user?.academicYear || '1st year'),
        title: newItem.title,
        category: newItem.category,
        location: newItem.location,
        description: newItem.description,
        status: 'Submitted',
        priority: form.priority,
        is_emergency: newItem.emergency,
        is_anonymous: form.anonymous
    }).select().single()
    if (error) throw error
    newItem.uuid = data.id
    newItem.student_id = data.student_id
    newItem.created_at = data.created_at
    const uploadedPaths = []
    try {
      const records = []
      for (const file of form.files || []) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
        const path = `${user.id}/${id}/${crypto.randomUUID()}-${safeName}`
        const { error: uploadError } = await supabase.storage.from('complaint-files').upload(path, file, { upsert: false, contentType: file.type })
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
        records.push({ complaint_id: data.id, uploaded_by: user.id, storage_path: path, file_name: file.name, mime_type: file.type, file_size: file.size })
      }
      if (records.length) {
        const { data: savedAttachments, error: attachmentError } = await supabase.from('complaint_attachments').insert(records).select()
        if (attachmentError) throw attachmentError
        newItem.attachments = savedAttachments
      }
    } catch (attachmentError) {
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from('complaint-files').remove(uploadedPaths)
        if (cleanupError) console.error('Unable to clean up failed complaint upload:', cleanupError.message)
    }
      newItem.attachmentError = `Report submitted, but its files could not be uploaded: ${attachmentError.message}`
    }
    setComplaints((old) => [newItem, ...old])
    return newItem
  }
  const updateComplaint = async (id, patch) => {
    if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to update reports.')
    const item = complaints.find((current) => current.id === id)
    if (!item?.uuid) throw new Error('That report could not be found.')
    const dbPatch = {}
    if (patch.status) dbPatch.status = patch.status
    if (patch.response) dbPatch.admin_response = patch.response
    if (Object.hasOwn(patch, 'department')) {
      if (!patch.department) dbPatch.department_id = null
      else {
        const { data: department, error: departmentError } = await supabase.from('departments').select('id').eq('name', patch.department).single()
        if (departmentError) throw departmentError
        dbPatch.department_id = department.id
      }
    }
    if (!Object.keys(dbPatch).length) return
    const { data, error } = await supabase.from('complaints').update(dbPatch).eq('id', item.uuid).select('*, complaint_updates(*), complaint_attachments(*), departments(name), profiles(full_name)').single()
    if (error) throw error
    const mapped = mapComplaint(data, user)
    setComplaints((old) => old.map((current) => current.id === id ? mapped : current))
  }
  const updateUser = async (patch) => {
    if (!isSupabaseConfigured) throw new Error('Connect a Supabase project to update your profile.')
    const { error } = await supabase.from('profiles').update({
      full_name: patch.name,
      student_id: patch.studentId,
      department: patch.department,
      academic_year: patch.academicYear,
      phone: patch.phone,
    }).eq('id', user.id)
    if (error) throw error
    const next = { ...user, ...patch }
    setUser(next)
  }
  const context = { user, setUser, authLoading, complaints, notifications, markNotificationsRead, addComplaint, updateComplaint, signIn, signUp, signInGoogle, signOut, theme, toggleTheme: () => setTheme((x) => x === 'light' ? 'dark' : 'light'), language, setLanguage, updateUser }
  return <Context.Provider value={context}><Routes><Route path="/" element={<LandingPage />} /><Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage />} /><Route path="/signup" element={user ? <Navigate to="/dashboard" replace /> : <AuthPage signup />} /><Route path="/*" element={<ProtectedRoute />} /></Routes></Context.Provider>
}

export default App
