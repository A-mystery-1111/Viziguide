import { useEffect, useRef, useState, type FormEvent, type ChangeEvent, type DragEvent } from 'react'
import {
    ArrowRight, Bell, BookOpen, CalendarDays, Camera, Check, ChevronDown,
    CircleHelp, Clock3, FileText, History, Home, ImagePlus, LifeBuoy, MapPin,
    LogOut, MessageCircle, Plus, Search, Send, Settings2, Share2, ShieldCheck,
    Sparkles, Wrench, X,
} from 'lucide-react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { useAuth } from './auth/useAuth'
import { requireSupabase } from './lib/supabase'
import { analyzeImage, sendChatMessage, type DiagnosisResult } from './lib/api.js'

const navItems = [
    { name: 'Overview', path: '/app', Icon: Home },
    { name: 'Diagnose', path: '/app/diagnose', Icon: Camera },
    { name: 'Repair history', path: '/app/history', Icon: History },
    { name: 'AI assistant', path: '/app/chat', Icon: MessageCircle },
    { name: 'Professionals', path: '/app/professionals', Icon: LifeBuoy },
    { name: 'Reminders', path: '/app/reminders', Icon: CalendarDays },
]

const PUBLIC_SHARE_URL = 'https://manufactured-beats-jade-identical.trycloudflare.com'

function getShareUrl() {
    if (typeof window !== 'undefined') {
        const host = window.location.hostname
        if (host.includes('trycloudflare.com') || (!host.includes('localhost') && host !== '127.0.0.1')) {
            return window.location.origin
        }
    }
    return PUBLIC_SHARE_URL
}

function ShareButton() {
    const [copied, setCopied] = useState(false)
    const handleShare = () => {
        const shareUrl = getShareUrl()
        const text = `🔧 Check out ViziGuide – Multimodal AI Hardware & Appliance Diagnostics!\n\n${shareUrl}`
        if (navigator.share) {
            navigator.share({ title: 'ViziGuide', text, url: shareUrl }).catch(() => {})
        } else {
            navigator.clipboard.writeText(shareUrl)
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
    }

    return (
        <button
            type="button"
            className="button button-outline button-small share-nav-btn"
            onClick={handleShare}
            title="Share ViziGuide"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
            <Share2 size={14} />
            <span>{copied ? 'Link Copied!' : 'Share Website'}</span>
        </button>
    )
}

function Brand() {
    return <Link to="/" className="brand"><span className="brand-mark"><Sparkles size={16} /></span><span>Vizi<span>Guide</span></span></Link>
}

function getDisplayName(user: User | null) {
    const metadata = user?.user_metadata
    for (const candidate of [metadata?.full_name, metadata?.name]) {
        if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
    }
    return user?.email?.split('@')[0] || 'Your account'
}

function UserAvatar({ name, className = '' }: { name: string; className?: string }) {
    const { user } = useAuth()
    const [imageFailed, setImageFailed] = useState(false)
    const avatarUrl = [user?.user_metadata.avatar_url, user?.user_metadata.picture]
        .find((candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0) ?? ''
    const nameParts = name.trim().split(/\s+/).filter(Boolean)
    const initials = nameParts.length > 1
        ? nameParts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
        : (nameParts[0]?.[0] || 'U').toUpperCase()

    return <span className={`avatar ${className}`}>{avatarUrl && !imageFailed
        ? <img src={avatarUrl} alt={`${name}'s profile`} onError={() => setImageFailed(true)} />
        : initials}</span>
}

function UserMenu({ compact = false }: { compact?: boolean }) {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [error, setError] = useState('')
    if (!user) return null

    const displayName = getDisplayName(user)
    const logout = async () => {
        setError('')
        try {
            const { error: signOutError } = await signOut()
            if (signOutError) {
                setError(signOutError.message)
                return
            }
            navigate('/')
        } catch (signOutError) {
            setError(signOutError instanceof Error ? signOutError.message : 'Could not log out. Please try again.')
        }
    }

    return <details className={`user-menu ${compact ? 'compact' : ''}`}>
        <summary aria-label={`Account menu for ${displayName}`}>
            <UserAvatar name={displayName} />
            {!compact && <span>{displayName}</span>}
            <ChevronDown size={14} />
        </summary>
        <div className="user-menu-panel">
            <b>{displayName}</b>
            <Link to="/app">Dashboard</Link>
            <Link to="/app/profile">Profile</Link>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="button" onClick={logout}><LogOut size={14} /> Logout</button>
        </div>
    </details>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth()
    const location = useLocation()
    if (loading) return <div className="auth-loading" role="status">Checking your session…</div>
    if (!user) return <Navigate to="/login" replace state={{ from: location }} />
    return children
}

function Shell({ children }: { children: React.ReactNode }) {
    const { pathname } = useLocation()
    const { user } = useAuth()
    const title = navItems.find((item) => item.path === pathname)?.name ?? 'Profile'
    const displayName = getDisplayName(user)
    return <div className="app-shell">
        <aside className="sidebar">
            <Brand />
            <div className="workspace"><span className="workspace-mark">V</span><span><b>My home</b><small>Personal workspace</small></span><ChevronDown size={14} /></div>
            <div className="side-label">WORKSPACE</div>
            <nav className="side-nav" aria-label="Main navigation">{navItems.map(({ name, path, Icon }) =>             <NavLink key={path} to={path} end={path === '/app'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}><Icon size={17} /><span>{name}</span>{name === 'Reminders' && <i className="nav-count">2</i>}</NavLink>)}</nav>
            <div className="sidebar-spacer" />
            <div className="help-card"><BookOpen size={17} /><b>Need a hand?</b><p>Find answers in the help center.</p><button type="button" className="text-link">Visit help center <ArrowRight size={13} /></button></div>
            <NavLink to="/app/profile" className={({ isActive }) => `account-link ${isActive ? 'active' : ''}`}><UserAvatar name={displayName} /><span><b>{displayName}</b></span><Settings2 size={16} /></NavLink>
        </aside>
        <div className="main-column">
            <header className="topbar">
                <div className="breadcrumb"><span>My home</span><i>/</i><b>{title}</b></div>
                <div className="top-actions">
                    <label className="top-search"><Search size={15} /><input placeholder="Search your home" aria-label="Search your home" /><kbd>⌘ K</kbd></label>
                    <ShareButton />
                    <button className="icon-button notify" aria-label="Notifications" type="button"><Bell size={17} /></button>
                    <UserMenu compact />
                </div>
            </header>
            <main className="page-content">{children}</main>
        </div>
    </div>
}

function Heading({ tag, title, detail, action }: { tag: string; title: string; detail: string; action?: React.ReactNode }) {
    return <div className="page-heading"><div><span className="eyebrow">{tag}</span><h1>{title}</h1><p>{detail}</p></div>{action && <div className="heading-action">{action}</div>}</div>
}

function Landing() {
    const { user } = useAuth()
    return <div className="landing">
        <header className="landing-nav">
            <Brand />
            <nav><a href="#problem">Why ViziGuide</a><a href="#features">Features</a><a href="#how">How it works</a></nav>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShareButton />
                {user ? <UserMenu /> : <><Link to="/login" className="login-link">Log in</Link><Link to="/signup" className="button button-dark button-small">Sign up <ArrowRight size={14} /></Link></>}
            </div>
        </header>
        <section className="landing-hero">
            <div className="landing-hero-copy"><span className="hero-pill"><i /> YOUR PERSONAL VISUAL ASSISTANT</span><h1>Understand any<br />product in <em>seconds.</em></h1><p>Snap a photo and turn confusing manuals into clear, visual steps. Fix it yourself, or find a trusted pro nearby.</p><div className="hero-actions"><Link to="/app/diagnose" className="button button-dark">Identify a product <Camera size={16} /></Link><a className="quiet-link" href="#how">See how it works <ArrowRight size={14} /></a></div><div className="hero-note"><span className="mini-avatars"><i>J</i><i>M</i><i>A</i></span><span><b>Made for the things you already own</b><small>Practical help, without the manual hunt.</small></span></div></div>
            <div className="landing-hero-art"><div className="landing-orbit orbit-outer" /><div className="landing-orbit orbit-inner" /><div className="product-scan-card"><div className="scan-card-top"><span><small>PRODUCT IDENTIFIED</small><b>Front-load washer</b></span><span className="scan-match"><Check size={12} /> 98% match</span></div><div className="scan-product"><div className="scan-washer"><i /><b /></div><span className="scan-focus"><Wrench size={13} /> Drain filter</span><i className="scan-corner corner-tl" /><i className="scan-corner corner-br" /></div><div className="scan-issue"><span><Sparkles size={15} /></span><div><b>Water isn’t draining?</b><small>We found a likely cause and a safe guide.</small></div><ArrowRight size={15} /></div><div className="scan-progress"><i /><i /><i /><i /><span>Step-by-step guide ready</span></div></div><div className="scan-float scan-float-top"><ShieldCheck size={15} /><span><b>Safety checked</b><small>Clear next steps</small></span></div><div className="scan-float scan-float-bottom"><Sparkles size={15} /><span><b>Manual, simplified</b><small>For your exact model</small></span></div></div>
        </section>
        <section className="problem-section" id="problem"><div className="problem-visual"><div className="manual-sheet"><span>USER MANUAL · 84 PAGES</span><b>IMPORTANT SAFETY<br />INSTRUCTIONS</b><i /><i /><i /><i /><i /></div><span className="problem-stamp"><X size={15} /> STILL STUCK?</span></div><div className="problem-copy"><span className="eyebrow">THE PROBLEM ISN’T YOU</span><h2>Manuals weren’t made for the moment you need help.</h2><p>Finding the right model, decoding technical language, and figuring out which step applies can turn a small problem into a frustrating one.</p><p>ViziGuide translates product information into guidance you can actually use, right when you need it.</p><Link to="/app/diagnose" className="problem-link">Get a clearer answer <ArrowRight size={15} /></Link></div></section>
        <section className="features-section" id="features"><div className="section-heading"><span className="eyebrow">ONE PLACE TO FIGURE IT OUT</span><h2>Help for every kind of “hmm.”</h2><p>From the first photo to the final fix, you’ve got a guide.</p></div><div className="feature-cards"><article className="feature-card"><span className="feature-icon"><Camera size={20} /></span><span className="feature-index">01</span><h3>Image-based diagnosis</h3><p>Show us the product and the problem. AI helps identify what you own and what might be wrong.</p><Link to="/app/diagnose" aria-label="Try image diagnosis"><ArrowRight size={16} /></Link></article><article className="feature-card"><span className="feature-icon"><Wrench size={20} /></span><span className="feature-index">02</span><h3>Step-by-step visual guidance</h3><p>Turn manufacturer manuals into simple instructions with visuals for each repair step.</p><Link to="/app/diagnose" aria-label="Explore repair guidance"><ArrowRight size={16} /></Link></article><article className="feature-card"><span className="feature-icon"><LifeBuoy size={20} /></span><span className="feature-index">03</span><h3>Professional help nearby</h3><p>When a repair is not a DIY job, find verified professionals in your area.</p><Link to="/app/professionals" aria-label="Find professional help"><ArrowRight size={16} /></Link></article><article className="feature-card"><span className="feature-icon"><MessageCircle size={20} /></span><span className="feature-index">04</span><h3>Your personal AI chatbot</h3><p>Ask follow-up questions in plain language and get answers that fit your product and situation.</p><Link to="/app/chat" aria-label="Chat with ViziGuide"><ArrowRight size={16} /></Link></article></div></section>
        <section className="workflow-section" id="how"><div className="workflow-heading"><span className="eyebrow">FROM PHOTO TO PROGRESS</span><h2>Three steps.<br />A much clearer next move.</h2><p>No special tools or technical know-how required to get started.</p><Link to="/app/diagnose" className="button button-dark">Try ViziGuide <ArrowRight size={14} /></Link></div><div className="workflow-steps"><article><span className="workflow-number">01</span><i><ImagePlus size={18} /></i><div><h3>Take a photo</h3><p>Upload a picture and tell us what you’ve noticed.</p></div></article><article><span className="workflow-number">02</span><i><Sparkles size={18} /></i><div><h3>Get a clear diagnosis</h3><p>We identify your product and find relevant manual guidance.</p></div></article><article><span className="workflow-number">03</span><i><Check size={18} /></i><div><h3>Choose your next step</h3><p>Follow visual repair steps or connect with a verified pro.</p></div></article></div></section>
        <footer className="landing-footer"><Brand /><span>Helpful by design. Made for real life.</span><div><Link to="/login">Log in</Link><Link to="/signup">Create your account <ArrowRight size={14} /></Link></div></footer>
    </div>
}

function Dashboard() {
    const { user } = useAuth()
    const displayName = getDisplayName(user)
    return <><Heading tag="YOUR HOME AT A GLANCE" title={`Good morning, ${displayName}`} detail="Let’s get the little things at home sorted." action={<Link className="button button-dark" to="/app/diagnose"><Plus size={15} /> New diagnosis</Link>} />
        <section className="welcome-banner"><div><span className="banner-kicker"><Sparkles size={13} /> YOUR HOME, FIGURED OUT</span><h2>What needs a little attention?</h2><p>Take a photo and we’ll help you figure out what to do next.</p><Link to="/app/diagnose" className="button button-light">Diagnose with a photo <ArrowRight size={15} /></Link></div><div className="banner-art"><i /><i /><span><Wrench size={21} /></span><b><Camera size={18} /></b></div></section>
        <div className="dashboard-grid"><section className="panel"><div className="panel-heading"><div><span className="eyebrow">YOUR LATEST CHECK-INS</span><h2>Recent diagnoses</h2></div><Link to="/app/history" className="panel-link">View history <ArrowRight size={14} /></Link></div>{repairs.slice(0, 3).map((item) => <RepairRow key={item.name} type={item.type} name={item.name} model={item.model} status={item.status} detail={item.issue} />)}</section>
            <section className="panel"><div className="panel-heading"><div><span className="eyebrow">STAY ONE STEP AHEAD</span><h2>Upcoming reminders</h2></div><Link to="/app/reminders" className="icon-button" aria-label="View reminders"><ArrowRight size={16} /></Link></div><ReminderPreview day="12" title="Clean dishwasher filter" detail="Kitchen · Maintenance" /><ReminderPreview day="18" title="Replace water filter" detail="Fridge · Every 6 months" /><ReminderPreview day="02" title="Test smoke alarms" detail="Hallway · Safety check" /><Link to="/app/reminders" className="add-reminder"><Plus size={14} /> Add a reminder</Link></section></div>
        <div className="tip-strip"><span><CircleHelp size={17} /></span><div><b>Not sure where to start?</b><small>Tell our AI assistant what’s happening and get a little direction.</small></div><Link to="/app/chat" className="panel-link">Ask ViziGuide <ArrowRight size={14} /></Link></div>
    </>
}

function RepairRow({ type, name, model, status, detail }: { type: string; name: string; model: string; status: string; detail: string }) {
    return <article className="repair-row"><div className={`product-thumb ${type}`}><i /></div><div className="repair-info"><b>{name}</b><span>{model}</span><small>{detail}</small></div><span className={`status ${status === 'Resolved' ? 'resolved' : ''}`}>{status === 'Resolved' ? <Check size={11} /> : <i />}{status}</span><Link to={status === 'Resolved' ? '/app/history' : '/app/diagnose'} className="row-arrow" aria-label={`Open ${name} repair`}><ArrowRight size={16} /></Link></article>
}

function ReminderPreview({ day, title, detail }: { day: string; title: string; detail: string }) {
    return <div className="reminder-preview"><span><b>{day}</b><small>NOV</small></span><div><b>{title}</b><small>{detail}</small></div></div>
}

function Diagnose() {
    const browseInput = useRef<HTMLInputElement>(null)
    const cameraInput = useRef<HTMLInputElement>(null)
    const [image, setImage] = useState('')
    const [file, setFile] = useState<File | null>(null)
    const [result, setResult] = useState<DiagnosisResult | null>(null)
    const [issue, setIssue] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [dragging, setDragging] = useState(false)
    const [completedSteps, setCompletedSteps] = useState<number[]>([])

    useEffect(() => {
        if (!image) return
        return () => URL.revokeObjectURL(image)
    }, [image])

    const selectFile = (selected: File | undefined) => {
        if (!selected) return
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(selected.type)) {
            setError('Choose a JPG, PNG, or WebP image to continue.')
            return
        }
        if (selected.size > 8 * 1024 * 1024) {
            setError('That image is larger than 8 MB. Choose a smaller photo.')
            return
        }
        setError('')
        setFile(selected)
        setImage(URL.createObjectURL(selected))
        setResult(null)
        setCompletedSteps([])
    }

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => selectFile(event.target.files?.[0])
    const handleDrop = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        setDragging(false)
        selectFile(event.dataTransfer.files[0])
    }

    const submit = async () => {
        if (!file) return
        setBusy(true)
        setError('')
        try {
            setResult(await analyzeImage(file, issue))
            setCompletedSteps([])
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'We couldn’t create a diagnosis. Please try again.')
        } finally {
            setBusy(false)
        }
    }

    const toggleStep = (index: number) => {
        setCompletedSteps((current) => current.includes(index)
            ? current.filter((step) => step !== index)
            : [...current, index])
    }
    const progress = result ? Math.round((completedSteps.length / result.steps.length) * 100) : 0

    return <>
        <Heading tag="LET’S TAKE A LOOK" title="Diagnose a problem" detail="Add a photo and we’ll help you figure out a safe next step." />
        <div className="diagnose-grid">
            <section className="panel diagnose-form">
                <div className="form-step"><b>1</b><span><strong>Show us the product</strong><small>Drop a photo here, choose one from your device, or take a picture.</small></span></div>
                <div className={`upload-box ${image ? 'has-image' : ''} ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={handleDrop}>
                    {image ? <><img src={image} alt="Selected product" /><button type="button" aria-label="Remove photo" onClick={() => { setImage(''); setFile(null); setResult(null) }}><X size={15} /></button></> : <><i><ImagePlus size={22} /></i><b>Drop a photo here</b><small>JPG, PNG or WebP · Up to 8 MB</small><div className="upload-actions"><button type="button" onClick={() => browseInput.current?.click()}><ImagePlus size={15} /> Browse photos</button><button type="button" onClick={() => cameraInput.current?.click()}><Camera size={15} /> Use camera</button></div></>}
                </div>
                <input ref={browseInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
                <input ref={cameraInput} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFileChange} />
                <div className="form-step"><b>2</b><span><strong>What’s going on?</strong><small>Add a few details if you have them. This part is optional.</small></span></div>
                <textarea value={issue} onChange={(event) => setIssue(event.target.value)} placeholder="For example: It makes a humming sound but won’t drain…" rows={4} />
                {error && <p className="auth-error diagnosis-error" role="alert">{error}</p>}
                <button disabled={!file || busy} onClick={submit} className="button button-dark submit-diagnosis" type="button">{busy ? 'Looking at your photo…' : <><Sparkles size={15} /> Get my diagnosis <ArrowRight size={14} /></>}</button>
            </section>
            <aside className="diagnose-aside">
                <div className="panel safety-card"><ShieldCheck size={19} /><b>Your safety comes first</b><p>We’ll flag anything that’s best left to a qualified professional. Never work on a plugged-in appliance.</p></div>
                {result ? <section className="panel diagnosis-result">
                    <span className="result-check"><Check size={17} /></span><span className="eyebrow">YOUR DIAGNOSIS</span>
                    {result.clearerPhoto && <p className="api-notice" role="alert">Please upload a clearer, well-lit photo showing the whole product and the problem.</p>}
                    <h3>{result.productName}</h3><p className="diagnosis-issue">{result.issue}</p>
                    <div className="diagnosis-progress"><div><b>Repair progress</b><span>{completedSteps.length} of {result.steps.length} steps · {progress}%</span></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div>
                    <div className="warning-box"><b><ShieldCheck size={15} /> Before you begin</b><ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
                    <div className="repair-steps"><b>Step-by-step guide</b>{result.steps.map((step, index) => <button className={`repair-step ${completedSteps.includes(index) ? 'complete' : ''}`} type="button" key={step} onClick={() => toggleStep(index)}><span>{completedSteps.includes(index) ? <Check size={14} /> : index + 1}</span><small>{step}</small></button>)}</div>
                    <small className="mock-note">{result.disclaimer}</small>
                </section> : <div className="panel result-card"><div className="result-ornament"><Sparkles size={21} /></div><h3>Your diagnosis will appear here</h3><p>Choose an image to identify the product, likely issue, and safe repair steps.</p></div>}
                <Link to="/app/chat" className="ask-link"><MessageCircle size={15} /> Rather talk it through? <b>Ask ViziGuide</b></Link>
            </aside>
        </div>
    </>
}

const repairs = [
    { type: 'washer', name: 'Washing machine', model: 'Bosch Series 4 · WAN28281GB', issue: 'Not draining properly', date: 'Nov 8, 2026', status: 'In progress' },
    { type: 'lamp', name: 'Desk lamp', model: 'IKEA TERTIAL · Workroom', issue: 'Loose arm joint', date: 'Oct 28, 2026', status: 'Resolved' },
    { type: 'coffee', name: 'Coffee maker', model: 'De’Longhi Dedica · Kitchen', issue: 'Descaling and cleaning', date: 'Oct 16, 2026', status: 'Resolved' },
]

function HistoryPage() {
    const [filter, setFilter] = useState('All repairs')
    const filtered = repairs.filter((item) => filter === 'All repairs' || item.status === filter)
    return <><Heading tag="YOUR REPAIR JOURNAL" title="Repair history" detail="Every diagnosis and repair, all in one place." action={<Link className="button button-dark" to="/app/diagnose"><Plus size={15} /> New diagnosis</Link>} /><section className="panel history-panel"><div className="history-toolbar"><div>{['All repairs', 'In progress', 'Resolved'].map((tab) => <button key={tab} onClick={() => setFilter(tab)} className={filter === tab ? 'selected' : ''} type="button">{tab}</button>)}</div><span className="history-count">{filtered.length} {filtered.length === 1 ? 'result' : 'results'}</span></div>{filtered.length ? filtered.map((item) => <article className="history-row" key={item.name}><div className={`product-thumb ${item.type}`}><i /></div><div className="repair-info"><b>{item.name}</b><span>{item.model}</span><small>{item.issue}</small></div><span className={`status ${item.status === 'Resolved' ? 'resolved' : ''}`}>{item.status}</span><time>{item.date}</time><Link to="/app/diagnose" className="row-arrow" aria-label={`Start a diagnosis for ${item.name}`}><ArrowRight size={16} /></Link></article>) : <div className="empty-state"><History size={22} /><p>No {filter.toLowerCase()} items yet.</p><Link to="/app/diagnose">Start a diagnosis <ArrowRight size={14} /></Link></div>}</section><p className="privacy-note"><FileText size={13} /> Your repair notes are private and only visible to you.</p></>
}

function ChatPage() {
    const { user } = useAuth()
    const displayName = getDisplayName(user)
    const [draft, setDraft] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [messages, setMessages] = useState<{ role: 'assistant' | 'user'; text: string }[]>([{ role: 'assistant', text: `Hi ${displayName}! What’s happening with something at home? Tell me what you’ve noticed, and we’ll figure it out together.` }])
    const send = async (event: FormEvent) => {
        event.preventDefault()
        const text = draft.trim()
        if (!text || busy) return
        setError('')
        setDraft('')
        setMessages((current) => [...current, { role: 'user', text }])
        setBusy(true)
        try {
            const response = await sendChatMessage(text)
            setMessages((current) => [...current, { role: 'assistant', text: response.reply }])
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Your message could not be sent. Please try again.')
        } finally {
            setBusy(false)
        }
    }
    const prompts = ['My fridge is making a strange noise', 'How do I clean a dishwasher filter?', 'There is water under my washing machine']
    return <><Heading tag="HERE WHEN YOU NEED A HAND" title="Ask ViziGuide" detail="Your personal assistant for the things you own." /><div className="chat-grid"><section className="panel chat-panel"><div className="chat-head"><span><Sparkles size={17} /></span><div><b>ViziGuide assistant</b><small><i /> {busy ? 'Thinking…' : 'Ready to help'}</small></div></div><div className="chat-messages" aria-live="polite">{messages.map((message, index) => <article className={`message ${message.role}`} key={`${message.role}-${index}`}><i>{message.role === 'assistant' ? <Sparkles size={13} /> : 'YOU'}</i><div><small>{message.role === 'assistant' ? 'VIZIGUIDE' : 'YOU'}</small><p>{message.text}</p>{message.role === 'assistant' && index > 0 && <Link to="/app/diagnose" className="button button-dark"><Camera size={14} /> Start a diagnosis <ArrowRight size={13} /></Link>}</div></article>)}{busy && <p className="chat-loading" role="status">ViziGuide is preparing a reply…</p>}</div>{error && <p className="auth-error chat-request-error" role="alert">{error}</p>}<form className="chat-input" onSubmit={send}><input aria-label="Message ViziGuide" placeholder="Describe what’s happening…" value={draft} onChange={(event) => setDraft(event.target.value)} /><Link to="/app/diagnose" aria-label="Add a photo"><ImagePlus size={17} /></Link><button type="submit" aria-label="Send message" disabled={!draft.trim() || busy}><Send size={16} /></button></form><small className="chat-disclaimer">AI guidance · Always follow product safety instructions.</small></section><aside className="panel prompt-panel"><span className="eyebrow">NOT SURE WHAT TO ASK?</span><h3>Try one of these</h3>{prompts.map((prompt) => <button type="button" key={prompt} onClick={() => setDraft(prompt)}>{prompt}<ArrowRight size={13} /></button>)}</aside></div></>
}

function Professionals() {
    const pros = [
        { initials: 'MR', name: 'Marta Rivera', specialty: 'Appliance repair', type: 'Appliance', rating: '4.9', reviews: 128, distance: '0.8 mi away', style: 'mint' },
        { initials: 'JL', name: 'Jae Lee', specialty: 'Electrical & small appliances', type: 'Electrical', rating: '4.8', reviews: 96, distance: '1.4 mi away', style: 'coral' },
        { initials: 'TW', name: 'Theo Williams', specialty: 'Plumbing & fixtures', type: 'Plumbing', rating: '5.0', reviews: 74, distance: '2.1 mi away', style: 'blue' },
        { initials: 'AK', name: 'Ari Kim', specialty: 'General home repairs', type: 'General repair', rating: '4.9', reviews: 83, distance: '2.6 mi away', style: 'mint' },
    ]
    const [filter, setFilter] = useState('All types')
    const [requested, setRequested] = useState('')
    const filteredPros = pros.filter((pro) => filter === 'All types' || pro.type === filter)
    return <><Heading tag="TRUSTED HELP, CLOSE BY" title="Find a professional" detail="When a job needs an expert, find someone local you can trust." /><div className="location-bar"><span><i /> NEAR YOU</span><b><MapPin size={14} /> Brooklyn, NY 11211</b><small>Verified professionals familiar with your products</small></div><div className="pro-filters" role="group" aria-label="Filter professionals by service type">{['All types', 'Appliance', 'Electrical', 'Plumbing', 'General repair'].map((type) => <button type="button" className={filter === type ? 'selected' : ''} key={type} onClick={() => setFilter(type)}>{type}</button>)}</div><div className="pro-grid">{filteredPros.map((pro) => <article className="panel pro-card" key={pro.name}><div className={`pro-avatar ${pro.style}`}>{pro.initials}</div><span className="verified-badge"><ShieldCheck size={13} /> Verified</span><span className="rating">★ {pro.rating} <small>({pro.reviews} reviews)</small></span><h3>{pro.name}</h3><p>{pro.specialty}</p><div className="pro-meta"><span>{pro.distance}</span><b>Available this week</b></div><button className="button button-outline" type="button" onClick={() => setRequested(pro.name)}>{requested === pro.name ? 'Request sent' : 'Request a quote'} <ArrowRight size={13} /></button></article>)}</div>{requested && <p className="request-confirmation" role="status">Your mock request to {requested} is ready. A professional would follow up shortly.</p>}<p className="safety-note"><ShieldCheck size={15} /> Every professional is identity-verified. Always confirm pricing and scope before work begins.</p></>
}

function Reminders() {
    const [items, setItems] = useState([
        { id: 1, date: '2026-11-12', title: 'Clean dishwasher filter', detail: 'Kitchen · Bosch Series 4', type: 'Maintenance', done: false },
        { id: 2, date: '2026-11-18', title: 'Replace water filter', detail: 'Kitchen · Samsung fridge', type: 'Replacement', done: false },
        { id: 3, date: '2026-12-02', title: 'Check smoke detector batteries', detail: 'Hallway · First Alert', type: 'Safety', done: false },
    ])
    const [showForm, setShowForm] = useState(false)
    const [title, setTitle] = useState('')
    const [date, setDate] = useState('')
    const [detail, setDetail] = useState('')
    const [type, setType] = useState('Maintenance')
    const addReminder = (event: FormEvent) => {
        event.preventDefault()
        if (!title.trim() || !date) return
        setItems((current) => [...current, { id: Date.now(), title: title.trim(), date, detail: detail.trim() || 'Personal reminder', type, done: false }].sort((a, b) => a.date.localeCompare(b.date)))
        setTitle('')
        setDate('')
        setDetail('')
        setType('Maintenance')
        setShowForm(false)
    }
    const toggleReminder = (id: number) => setItems((current) => current.map((item) => item.id === id ? { ...item, done: !item.done } : item))
    const upcoming = items.filter((item) => !item.done)
    return <><Heading tag="A LITTLE NUDGE, RIGHT ON TIME" title="Reminders" detail="Keep up with the small things that help your home run smoothly." action={<button className="button button-dark" type="button" onClick={() => setShowForm((open) => !open)}><Plus size={15} /> {showForm ? 'Cancel' : 'Add reminder'}</button>} />
        {showForm && <form className="panel reminder-form" onSubmit={addReminder}><label>Reminder title<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Clean the air filter" required /></label><label>Due date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label><label>Details<input value={detail} onChange={(event) => setDetail(event.target.value)} placeholder="Room or product (optional)" /></label><label>Type<select value={type} onChange={(event) => setType(event.target.value)}><option>Maintenance</option><option>Replacement</option><option>Safety</option><option>Other</option></select></label><button className="button button-dark" type="submit"><Plus size={15} /> Save reminder</button></form>}
        <section className="panel reminder-list"><div className="list-label">UP NEXT <i>{upcoming.length}</i></div>{items.map((item) => { const formattedDate = new Date(`${item.date}T12:00:00`).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }).toUpperCase().split(' '); return <article className={`reminder-row ${item.done ? 'done' : ''}`} key={item.id}><button className="check-circle" type="button" aria-label={`${item.done ? 'Mark' : 'Complete'} ${item.title}`} onClick={() => toggleReminder(item.id)}>{item.done && <Check size={12} />}</button><span className="reminder-date">{formattedDate[1]}<small>{formattedDate[0]}</small></span><div><b>{item.title}</b><small>{item.detail}</small></div><i className="reminder-type">{item.type}</i></article>})}</section>
        <div className="reminder-tip"><Clock3 size={18} /><span><b>Small upkeep can prevent bigger repairs.</b><small>Mock reminders are saved for this session.</small></span><CalendarDays size={26} /></div></>
}

function Profile() {
    const { user, signOut } = useAuth()
    const navigate = useNavigate()
    const [signOutError, setSignOutError] = useState('')
    const name = getDisplayName(user)
    const handleSignOut = async () => {
        const { error } = await signOut()
        if (error) { setSignOutError(error.message); return }
        navigate('/login')
    }
    return <><Heading tag="YOUR ACCOUNT" title="Profile & settings" detail="Manage your personal details and preferences." /><section className="panel settings-panel"><div className="settings-section"><div><b>Personal information</b><small>Update how ViziGuide knows you.</small></div><div className="profile-fields"><div className="identity"><UserAvatar name={name} className="avatar-large" /><span><b>{name}</b></span><button className="button button-outline" type="button">Change photo</button></div><div className="fields"><label>First name<input value={name.split(' ')[0]} readOnly /></label><label>Last name<input value={name.split(' ').slice(1).join(' ')} readOnly /></label></div></div><button className="button button-outline edit-button" type="button">Edit details</button></div><div className="settings-section"><div><b>Preferences</b><small>Make ViziGuide work better for you.</small></div><div className="preference-list"><label><span><b>Repair reminders</b><small>Get a nudge about upcoming maintenance.</small></span><input type="checkbox" defaultChecked /></label><label><span><b>Product tips</b><small>Occasional advice for the things you own.</small></span><input type="checkbox" /></label></div></div><div className="settings-section account-section"><div><b>Account</b><small>Manage your ViziGuide account.</small></div><div>{signOutError && <p className="auth-error" role="alert">{signOutError}</p>}<button className="text-link logout" type="button" onClick={handleSignOut}><LogOut size={14} /> Log out</button></div></div></section></>
}

function Auth({ signup = false }: { signup?: boolean }) {
    const navigate = useNavigate()
    const location = useLocation()
    const { signIn, signUp, signInWithGoogle } = useAuth()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState(
        !signup && typeof location.state?.message === 'string' ? location.state.message : '',
    )
    const [busy, setBusy] = useState(false)
    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        setMessage('')
        setBusy(true)
        try {
            const result = signup ? await signUp(email, password, name) : await signIn(email, password)
            if (result.error) setError(result.error.message)
            else if (signup && !result.data.session) setMessage('Check your email to confirm your account, then log in.')
            else {
                const from = (location.state as { from?: { pathname?: string; search?: string; hash?: string } } | null)?.from
                const destination = from?.pathname?.startsWith('/')
                    ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}`
                    : '/app'
                navigate(destination, { replace: true })
            }
        } catch (authError) {
            setError(authError instanceof Error ? authError.message : 'Authentication failed.')
        } finally { setBusy(false) }
    }
    const googleSignIn = async () => {
        setError('')
        try { const { error: authError } = await signInWithGoogle(); if (authError) setError(authError.message) }
        catch (authError) { setError(authError instanceof Error ? authError.message : 'Google sign-in failed.') }
    }
    return <AuthLayout><div className="auth-card"><span className="auth-icon"><Sparkles size={18} /></span><span className="eyebrow">A CALMER WAY TO FIX IT</span><h1>{signup ? 'Let’s get you started.' : 'Welcome back.'}</h1><p>{signup ? 'Create your account and feel more at home with the things you own.' : 'Pick up right where you left off.'}</p><form onSubmit={submit}>{signup && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Jamie Davis" required /></label>}<label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></label>{!signup && <div className="auth-options"><label><input type="checkbox" /> Remember me</label><Link to="/forgot-password">Forgot password?</Link></div>}{error && <p className="auth-error" role="alert">{error}</p>}{message && <p className="auth-message" role="status">{message}</p>}<button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'} <ArrowRight size={15} /></button></form><div className="auth-divider"><span>OR</span></div><button className="button button-outline google-button" type="button" onClick={googleSignIn}><GoogleMark /> Continue with Google</button><div className="auth-switch">{signup ? 'Already have an account?' : 'New to ViziGuide?'} <Link to={signup ? '/login' : '/signup'}>{signup ? 'Log in' : 'Create an account'}</Link></div><div className="auth-privacy"><ShieldCheck size={13} /> Your information stays yours.</div></div></AuthLayout>
}

function AuthLayout({ children }: { children: React.ReactNode }) {
    return <div className="auth-page"><div className="auth-brand"><Brand /></div>{children}<footer>© 2026 ViziGuide <a href="#privacy">Privacy</a><a href="#terms">Terms</a><a href="#help">Help</a></footer><i className="auth-ring ring-left" /><i className="auth-ring ring-right" /></div>
}

function friendlyAuthError(error: unknown, fallback: string) {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('expired') || message.includes('invalid') || message.includes('token')) {
        return 'This link may have expired or already been used. Request a new password reset link to continue.'
    }
    if (message.includes('rate') || message.includes('too many')) {
        return 'Too many attempts. Please wait a moment, then try again.'
    }
    if (message.includes('password') && (message.includes('weak') || message.includes('short'))) {
        return 'Choose a stronger password with at least 8 characters.'
    }
    return fallback
}

function ForgotPassword() {
    const { resetPassword } = useAuth()
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [sent, setSent] = useState(false)
    const [busy, setBusy] = useState(false)

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        setSent(false)
        setBusy(true)
        try {
            const { error: authError } = await resetPassword(email)
            if (authError) setError(friendlyAuthError(authError, 'We couldn’t send your reset email right now. Please try again.'))
            else setSent(true)
        } catch (authError) {
            setError(friendlyAuthError(authError, 'We couldn’t send your reset email right now. Please try again.'))
        } finally {
            setBusy(false)
        }
    }

    return <AuthLayout><div className="auth-card"><span className="auth-icon"><Sparkles size={18} /></span><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Forgot password?</h1><p>Enter the email address linked to your account and we’ll send you a link to reset your password.</p><form onSubmit={submit}><label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /></label>{error && <p className="auth-error" role="alert">{error}</p>}{sent && <p className="auth-message" role="status"><strong>Check your email</strong> — if an account exists for that address, a password reset link is on its way.</p>}<button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Sending link…' : 'Send reset link'} <ArrowRight size={15} /></button></form><div className="auth-switch"><Link to="/login">Back to log in</Link></div></div></AuthLayout>
}

function ResetPassword() {
    const navigate = useNavigate()
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const submit = async (event: FormEvent) => {
        event.preventDefault()
        setError('')
        if (password !== confirmPassword) {
            setError('Those passwords don’t match. Please try again.')
            return
        }
        setBusy(true)
        try {
            const { error: authError } = await requireSupabase().auth.updateUser({ password })
            if (authError) {
                setError(friendlyAuthError(authError, 'We couldn’t update your password. Please try again or request a new reset link.'))
                return
            }
            navigate('/login', {
                replace: true,
                state: { message: 'Your password has been updated. You can now log in.' },
            })
        } catch (authError) {
            setError(friendlyAuthError(authError, 'We couldn’t update your password. Please try again or request a new reset link.'))
        } finally {
            setBusy(false)
        }
    }

    return <AuthLayout><div className="auth-card"><span className="auth-icon"><Sparkles size={18} /></span><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Choose a new password</h1><p>Make it strong and memorable. Your new password must be at least 8 characters.</p><form onSubmit={submit}><label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required /></label><label>Confirm new password<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your new password again" minLength={8} required /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="button button-dark" type="submit" disabled={busy}>{busy ? 'Saving password…' : 'Save new password'} <ArrowRight size={15} /></button></form><div className="auth-switch"><Link to="/login">Back to log in</Link></div></div></AuthLayout>
}

function GoogleMark() { return <svg aria-hidden="true" viewBox="0 0 18 18" width="15" height="15"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.17-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61Z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.19l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18Z" /><path fill="#FBBC05" d="M3.97 10.7A5.4 5.4 0 0 1 3.69 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.82.96 4.03l3.01-2.33Z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.43 1.35l2.57-2.57C13.46.9 11.42 0 9 0A9 9 0 0 0 .96 4.97L3.97 7.3C4.68 5.16 6.66 3.58 9 3.58Z" /></svg> }

function NotFound() { return <div className="not-found"><span className="eyebrow">404 · PAGE NOT FOUND</span><h1>Looks like we lost that page.</h1><Link to="/app" className="button button-dark">Back to your home <ArrowRight size={14} /></Link></div> }

export default function App() {
    return <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/signup" element={<Auth signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/app" element={<ProtectedRoute><Shell><Outlet /></Shell></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="diagnose" element={<Diagnose />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="chat" element={<ChatPage />} />
            <Route path="professionals" element={<Professionals />} />
            <Route path="reminders" element={<Reminders />} />
            <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="/dashboard" element={<Navigate to="/app" replace />} />
        <Route path="/diagnose" element={<Navigate to="/app/diagnose" replace />} />
        <Route path="/history" element={<Navigate to="/app/history" replace />} />
        <Route path="/chat" element={<Navigate to="/app/chat" replace />} />
        <Route path="/professionals" element={<Navigate to="/app/professionals" replace />} />
        <Route path="/reminders" element={<Navigate to="/app/reminders" replace />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        <Route path="*" element={<NotFound />} />
    </Routes>
}