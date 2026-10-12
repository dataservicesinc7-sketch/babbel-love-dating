import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLocation } from '../lib/locations'
import { compressImage } from '../lib/image'

// ========== CHANGE THIS TO YOUR OWNER EMAIL ==========
const OWNER_EMAIL = 'dataservicesinc7@gmail.com'
// ====================================================

function Admin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [message, setMessage] = useState('')
  const [activeTab, setActiveTab] = useState('stats')

  const [stats, setStats] = useState({
    totalMembers: 0, verifiedMembers: 0, totalMatches: 0, totalMessages: 0,
    openReports: 0, seedCount: 0, photosCount: 0, registeredToday: 0,
    onlineNow: 0, males: 0, females: 0, otherGender: 0
  })

  const [members, setMembers] = useState([])
  const [memberFilter, setMemberFilter] = useState('all')
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedMember, setSelectedMember] = useState(null)

  const [seedProfiles, setSeedProfiles] = useState([])
  const [reports, setReports] = useState([])
  const [photoModal, setPhotoModal] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        setAuthorized(false); setLoading(false); return
      }
      setAuthorized(true)
      await Promise.all([loadStats(), loadMembers(), loadSeeds(), loadReports()])
      setLoading(false)
    }
    load()
  }, [navigate])

  const loadStats = async () => {
    try {
      const todayStart = new Date(); todayStart.setHours(0,0,0,0)
      const fiveMinAgo = new Date(Date.now() - 5*60*1000).toISOString()
      const [
        { count: totalMembers }, { count: seedCount }, { count: totalMatches },
        { count: totalMessages }, { count: photosCount }, { count: registeredToday },
        { count: onlineNow }, { count: males }, { count: females }, { count: otherGender }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_seed', true),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('photos').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('gender', 'man'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('gender', 'woman'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).not('gender', 'ilike', 'man').not('gender', 'ilike', 'woman')
      ])
      let openReports = 0
      try {
        const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'open')
        openReports = count || 0
      } catch (_) {}
      setStats({
        totalMembers: totalMembers||0, verifiedMembers:0, totalMatches: totalMatches||0,
        totalMessages: totalMessages||0, openReports, seedCount: seedCount||0,
        photosCount: photosCount||0, registeredToday: registeredToday||0,
        onlineNow: onlineNow||0, males: males||0, females: females||0, otherGender: otherGender||0
      })
    } catch (err) { console.error(err) }
  }

  const loadMembers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, display_name, city, country, gender, relationship_goal, is_seed, created_at, last_seen, is_suspended, status, is_active, bio, date_of_birth, looking_for, avatar_url')
        .order('created_at', { ascending: false })
        .limit(300)

      if (memberFilter === 'seeds') query = query.eq('is_seed', true)
      if (memberFilter === 'real') query = query.or('is_seed.is.null,is_seed.eq.false')
      if (memberFilter === 'suspended') query = query.eq('is_suspended', true)
      if (memberFilter === 'deactivated') query = query.eq('is_active', false)

      const { data } = await query
      let list = data || []
      if (memberSearch.trim()) {
        const s = memberSearch.toLowerCase()
        list = list.filter(m =>
          (m.display_name||'').toLowerCase().includes(s) ||
          (m.city||'').toLowerCase().includes(s) ||
          (m.gender||'').toLowerCase().includes(s) ||
          (m.id||'').toLowerCase().includes(s)
        )
      }
      setMembers(list)
    } catch (err) { console.error(err) }
  }

  const loadSeeds = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, city, country, gender, relationship_goal, is_seed, avatar_url, created_at, last_seen, is_suspended, status, is_active, bio, date_of_birth, looking_for')
      .eq('is_seed', true)
      .order('created_at', { ascending: false })
    setSeedProfiles(data || [])
  }

  const loadReports = async () => {
    try {
      const { data } = await supabase.from('reports').select('*').order('created_at', { ascending: false }).limit(100)
      setReports(data || [])
    } catch (_) { setReports([]) }
  }

  // ===== Shared actions (used by both Users and Seeds) =====
  const suspendMember = async (id, currentlySuspended) => {
    const action = currentlySuspended ? 'unsuspend' : 'suspend'
    if (!confirm(`Really ${action} this account?`)) return
    const { error } = await supabase.from('profiles').update({ is_suspended: !currentlySuspended }).eq('id', id)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage(`Account ${action}ed.`)
    loadMembers(); loadSeeds(); loadStats()
    if (selectedMember?.id === id) setSelectedMember(prev => ({ ...prev, is_suspended: !currentlySuspended }))
  }

  const deactivateMember = async (id) => {
    if (!confirm('Deactivate this account? It will no longer appear in Discover.')) return
    const { error } = await supabase.from('profiles').update({ is_active: false, status: 'deactivated' }).eq('id', id)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('Account deactivated.')
    loadMembers(); loadSeeds(); loadStats()
    if (selectedMember?.id === id) setSelectedMember(prev => ({ ...prev, is_active: false, status: 'deactivated' }))
  }

  const restoreMember = async (id) => {
    if (!confirm('Restore this account?')) return
    const { error } = await supabase.from('profiles').update({ is_active: true, status: 'active', is_suspended: false }).eq('id', id)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('Account restored.')
    loadMembers(); loadSeeds(); loadStats()
    if (selectedMember?.id === id) setSelectedMember(prev => ({ ...prev, is_active: true, status: 'active', is_suspended: false }))
  }

  const permanentDeleteMember = async (id, name) => {
    if (!confirm(`PERMANENTLY delete ${name || 'this account'} and all photos? This cannot be undone.`)) return
    if (!confirm('Final confirmation – irreversible.')) return
    try {
      const { data: photos } = await supabase.from('photos').select('storage_path').eq('profile_id', id)
      if (photos?.length) {
        const paths = photos.map(p => p.storage_path).filter(Boolean)
        if (paths.length) await supabase.storage.from('profile-photos').remove(paths)
      }
      await supabase.from('photos').delete().eq('profile_id', id)
      await supabase.from('profiles').delete().eq('id', id)
      setMessage('Account permanently deleted.')
      setSelectedMember(null)
      loadMembers(); loadSeeds(); loadStats()
    } catch (err) { setMessage('Error: ' + err.message) }
  }

  const clearAvatarUrl = async (id) => {
    if (!confirm('Clear the external avatar for this account?')) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', id)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('Avatar cleared.')
    loadMembers(); loadSeeds()
  }

  const clearAllSeedAvatars = async () => {
    if (!confirm(`Clear avatar on ALL ${seedProfiles.length} seed profiles?`)) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('is_seed', true)
    if (error) { setMessage('Error: ' + error.message); return }
    setMessage('All seed avatars cleared.')
    loadSeeds(); loadMembers()
  }

  const deleteAllSeeds = async () => {
    if (!confirm(`Delete ALL ${seedProfiles.length} seed profiles? This cannot be undone.`)) return
    const { error } = await supabase.from('profiles').delete().eq('is_seed', true)
    if (error) { setMessage('Error: ' + error.message); return }
    setSeedProfiles([])
    setMessage('All seed profiles deleted.')
    loadStats(); loadMembers()
  }

  const openPhotoModal = async (profileId) => {
    const { data: photoRows } = await supabase.from('photos').select('*').eq('profile_id', profileId).order('sort_order')
    setPhotoModal({ profileId, photos: photoRows || [] })
  }

  const adminDeletePhoto = async (photoId, storagePath) => {
    if (!confirm('Delete this photo permanently?')) return
    try {
      if (storagePath) await supabase.storage.from('profile-photos').remove([storagePath])
      await supabase.from('photos').delete().eq('id', photoId)
      if (photoModal) openPhotoModal(photoModal.profileId)
      setMessage('Photo deleted.')
      loadStats()
    } catch (err) { setMessage('Error: ' + err.message) }
  }

  const adminUploadPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !photoModal) return
    if (photoModal.photos.length >= 6) { setMessage('Maximum 6 photos'); return }
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(file)
      const path = `${photoModal.profileId}/${Date.now()}.webp`
      const { error: upError } = await supabase.storage.from('profile-photos').upload(path, compressed)
      if (upError) throw upError
      const nextOrder = photoModal.photos.length === 0 ? 0 : Math.max(...photoModal.photos.map(p => p.sort_order || 0)) + 1
      await supabase.from('photos').insert({ profile_id: photoModal.profileId, storage_path: path, sort_order: nextOrder })
      openPhotoModal(photoModal.profileId)
      setMessage('Photo uploaded.')
      loadStats()
    } catch (err) { setMessage('Error: ' + err.message) }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const resolveReport = async (id) => {
    try {
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', id)
      setMessage('Report resolved.')
      loadReports(); loadStats()
    } catch (err) { setMessage('Error: ' + err.message) }
  }

  const viewFullProfile = (member) => {
    setSelectedMember(member)
    setActiveTab('profile')
  }

  // Helper to render the action buttons (used by both Users and Seeds)
  const renderActionButtons = (m) => (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => viewFullProfile(m)} className="px-3 py-1.5 bg-coral hover:bg-coral/90 rounded-lg text-sm">
        View Profile
      </button>
      <button onClick={() => openPhotoModal(m.id)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
        Photos
      </button>
      {m.avatar_url && (
        <button onClick={() => clearAvatarUrl(m.id)} className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 rounded-lg text-sm">
          Clear Avatar
        </button>
      )}
      <button onClick={() => suspendMember(m.id, m.is_suspended)} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded-lg text-sm">
        {m.is_suspended ? 'Unsuspend' : 'Suspend'}
      </button>
      {m.is_active === false ? (
        <button onClick={() => restoreMember(m.id)} className="px-3 py-1.5 bg-green-700 hover:bg-green-800 rounded-lg text-sm">
          Restore
        </button>
      ) : (
        <button onClick={() => deactivateMember(m.id)} className="px-3 py-1.5 bg-orange-700 hover:bg-orange-800 rounded-lg text-sm">
          Deactivate
        </button>
      )}
      <button onClick={() => permanentDeleteMember(m.id, m.display_name)} className="px-3 py-1.5 bg-red-700 hover:bg-red-800 rounded-lg text-sm">
        Permanent Delete
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading admin...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-navy text-white gap-4">
        <h1 className="text-2xl font-semibold">Access denied</h1>
        <p className="text-gray-400">This page is only for the site owner.</p>
        <Link to="/dashboard" className="text-coral underline">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white pb-16">
      <header className="py-6 px-4 flex justify-between items-center max-w-6xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Admin
        </Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">← Back to Dashboard</Link>
      </header>

      <main className="max-w-6xl mx-auto px-4">
        <h1 className="text-3xl font-semibold mb-2">Admin Control Panel</h1>
        <p className="text-gray-400 mb-6">Full control over every account.</p>

        {message && (
          <p className="mb-4 text-coral bg-navy-light px-4 py-2 rounded-lg flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="text-sm underline ml-4">Dismiss</button>
          </p>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-gray-700 pb-3">
          {['stats', 'members', 'reports', 'seeds', 'photos'].map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab)
                setSelectedMember(null)
                if (tab === 'members') loadMembers()
                if (tab === 'seeds') loadSeeds()
              }}
              className={`px-4 py-2 rounded-full text-sm capitalize ${
                activeTab === tab || (activeTab === 'profile' && tab === 'members')
                  ? 'bg-coral text-white'
                  : 'bg-navy-light hover:bg-gray-700'
              }`}
            >
              {tab === 'members' ? 'Users' : tab}
            </button>
          ))}
        </div>

        {/* STATS */}
        {activeTab === 'stats' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold text-coral">{stats.totalMembers}</p><p className="text-sm text-gray-400">Total Members</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold text-green-400">{stats.registeredToday}</p><p className="text-sm text-gray-400">Registered Today</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold text-blue-400">{stats.onlineNow}</p><p className="text-sm text-gray-400">Online Now</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.females}</p><p className="text-sm text-gray-400">Females</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.males}</p><p className="text-sm text-gray-400">Males</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.otherGender}</p><p className="text-sm text-gray-400">Other</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.seedCount}</p><p className="text-sm text-gray-400">Seed / Fake</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.totalMatches}</p><p className="text-sm text-gray-400">Matches</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.totalMessages}</p><p className="text-sm text-gray-400">Messages</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold">{stats.photosCount}</p><p className="text-sm text-gray-400">Photos</p></div>
            <div className="bg-navy-light p-5 rounded-2xl"><p className="text-3xl font-bold text-yellow-400">{stats.openReports}</p><p className="text-sm text-gray-400">Open Reports</p></div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'members' && !selectedMember && (
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <select value={memberFilter} onChange={e => { setMemberFilter(e.target.value); setTimeout(loadMembers, 50) }} className="px-3 py-2 rounded-lg bg-navy border border-gray-600">
                <option value="all">All users</option>
                <option value="real">Real only</option>
                <option value="seeds">Seeds only</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
              </select>
              <input type="text" placeholder="Search name, city or ID..." value={memberSearch} onChange={e => setMemberSearch(e.target.value)} onKeyUp={e => e.key === 'Enter' && loadMembers()} className="px-3 py-2 rounded-lg bg-navy border border-gray-600 flex-1 min-w-[180px]" />
              <button onClick={loadMembers} className="px-4 py-2 bg-coral rounded-lg text-sm">Search</button>
            </div>

            <div className="space-y-3">
              {members.map(m => (
                <div key={m.id} className="bg-navy-light p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {m.avatar_url && <img src={m.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />}
                    <div>
                      <p className="font-medium">
                        {m.display_name || 'No name'}
                        {m.is_seed && <span className="ml-2 text-xs bg-yellow-600 px-2 py-0.5 rounded-full">SEED</span>}
                        {m.is_suspended && <span className="ml-2 text-xs bg-red-700 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                        {m.is_active === false && <span className="ml-2 text-xs bg-orange-700 px-2 py-0.5 rounded-full">DEACTIVATED</span>}
                      </p>
                      <p className="text-sm text-gray-400">{m.gender} · {formatLocation(m.city, m.country)} · {m.relationship_goal}</p>
                      <p className="text-xs text-gray-500">Joined {m.created_at ? new Date(m.created_at).toLocaleDateString() : '—'}</p>
                    </div>
                  </div>
                  {renderActionButtons(m)}
                </div>
              ))}
              {members.length === 0 && <p className="text-gray-400">No users match this filter.</p>}
            </div>
          </div>
        )}

        {/* FULL PROFILE VIEW */}
        {activeTab === 'profile' && selectedMember && (
          <div>
            <button onClick={() => { setSelectedMember(null); setActiveTab('members') }} className="text-coral mb-4 text-sm">← Back to Users</button>
            <h2 className="text-2xl font-semibold mb-1">{selectedMember.display_name || 'No name'}</h2>
            <p className="text-gray-400 text-sm mb-6">ID: {selectedMember.id}</p>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-navy-light rounded-2xl p-5 space-y-2">
                {selectedMember.avatar_url && (
                  <div className="mb-3">
                    <img src={selectedMember.avatar_url} alt="" className="w-24 h-24 rounded-full object-cover" />
                    <button onClick={() => clearAvatarUrl(selectedMember.id)} className="mt-2 text-sm text-purple-400 underline">Clear Avatar</button>
                  </div>
                )}
                <p><span className="text-gray-400">Gender:</span> {selectedMember.gender || '—'}</p>
                <p><span className="text-gray-400">Looking for:</span> {selectedMember.looking_for || '—'}</p>
                <p><span className="text-gray-400">Goal:</span> {selectedMember.relationship_goal || '—'}</p>
                <p><span className="text-gray-400">Location:</span> {formatLocation(selectedMember.city, selectedMember.country)}</p>
                <p><span className="text-gray-400">DOB:</span> {selectedMember.date_of_birth || '—'}</p>
                <p><span className="text-gray-400">Status:</span> {selectedMember.status || (selectedMember.is_active === false ? 'deactivated' : 'active')}</p>
                <p><span className="text-gray-400">Suspended:</span> {selectedMember.is_suspended ? 'Yes' : 'No'}</p>
                <p><span className="text-gray-400">Seed:</span> {selectedMember.is_seed ? 'Yes' : 'No'}</p>
                <p><span className="text-gray-400">Joined:</span> {selectedMember.created_at ? new Date(selectedMember.created_at).toLocaleString() : '—'}</p>
                <p className="pt-3"><span className="text-gray-400">Bio:</span><br />{selectedMember.bio || '—'}</p>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">Quick Actions</h3>
                {renderActionButtons(selectedMember)}
              </div>
            </div>
          </div>
        )}

        {/* REPORTS */}
        {activeTab === 'reports' && (
          <div>
            <h2 className="text-xl font-semibold mb-4">Reports Queue</h2>
            {reports.length === 0 ? (
              <p className="text-gray-400">No reports yet.</p>
            ) : (
              <div className="space-y-3">
                {reports.map(r => (
                  <div key={r.id} className="bg-navy-light p-4 rounded-xl">
                    <p className="font-medium">{r.reason || 'Report'}</p>
                    <p className="text-sm text-gray-400">{r.details || ''}</p>
                    <p className="text-xs text-gray-500 mt-1">Status: {r.status || 'open'} · {r.created_at ? new Date(r.created_at).toLocaleString() : ''}</p>
                    {r.status !== 'resolved' && (
                      <button onClick={() => resolveReport(r.id)} className="mt-2 px-3 py-1 bg-green-600 rounded text-sm">Mark Resolved</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SEEDS TAB – now has THE SAME buttons as Users */}
        {activeTab === 'seeds' && (
          <div className="bg-navy-light rounded-2xl p-6">
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold">Seed / Fake Profiles ({seedProfiles.length})</h2>
              <div className="flex gap-2">
                {seedProfiles.some(p => p.avatar_url) && (
                  <button onClick={clearAllSeedAvatars} className="px-4 py-2 bg-purple-700 hover:bg-purple-800 rounded-full text-sm">
                    Clear All Seed Avatars
                  </button>
                )}
                {seedProfiles.length > 0 && (
                  <button onClick={deleteAllSeeds} className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded-full text-sm">
                    Delete All Seeds
                  </button>
                )}
              </div>
            </div>

            {seedProfiles.length === 0 ? (
              <p className="text-gray-400">No seed profiles left.</p>
            ) : (
              <div className="space-y-3">
                {seedProfiles.map(p => (
                  <div key={p.id} className="bg-navy p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center text-xs text-gray-400">No photo</div>
                      )}
                      <div>
                        <p className="font-medium">
                          {p.display_name}
                          <span className="ml-2 text-xs bg-yellow-600 px-2 py-0.5 rounded-full">SEED</span>
                          {p.is_suspended && <span className="ml-2 text-xs bg-red-700 px-2 py-0.5 rounded-full">SUSPENDED</span>}
                          {p.is_active === false && <span className="ml-2 text-xs bg-orange-700 px-2 py-0.5 rounded-full">DEACTIVATED</span>}
                        </p>
                        <p className="text-sm text-gray-400">{p.gender} · {formatLocation(p.city, p.country)} · {p.relationship_goal}</p>
                      </div>
                    </div>
                    {renderActionButtons(p)}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PHOTOS overview */}
        {activeTab === 'photos' && (
          <div>
            <p className="text-gray-400 mb-4">
              Total photos in storage: <strong className="text-white">{stats.photosCount}</strong>.  
              Use the Users or Seeds tab → “Photos” button to manage any account’s photos.
            </p>
          </div>
        )}
      </main>

      {/* Photo modal */}
      {photoModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModal(null)}>
          <div className="bg-navy-light rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Manage Photos</h3>
              <button onClick={() => setPhotoModal(null)} className="text-2xl leading-none">×</button>
            </div>
            <div className="flex flex-wrap gap-3 mb-4">
              {photoModal.photos.map(p => (
                <div key={p.id} className="relative">
                  <img src={supabase.storage.from('profile-photos').getPublicUrl(p.storage_path).data.publicUrl} alt="" className="w-24 h-24 object-cover rounded-lg" />
                  <button onClick={() => adminDeletePhoto(p.id, p.storage_path)} className="absolute -top-2 -right-2 bg-red-600 text-white w-6 h-6 rounded-full text-sm">×</button>
                </div>
              ))}
              {photoModal.photos.length === 0 && <p className="text-gray-400">No photos yet.</p>}
            </div>
            {photoModal.photos.length < 6 && (
              <div>
                <label className="block text-sm mb-1">Upload new photo</label>
                <input type="file" accept="image/*" onChange={adminUploadPhoto} disabled={uploadingPhoto} />
                {uploadingPhoto && <p className="text-sm text-coral mt-1">Uploading...</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default Admin
