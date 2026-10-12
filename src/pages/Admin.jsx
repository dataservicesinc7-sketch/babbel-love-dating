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
  const [section, setSection] = useState('stats') // stats | users | seeds | photos
  const [message, setMessage] = useState('')
  const [search, setSearch] = useState('')

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    online: 0,
    males: 0,
    females: 0,
    other: 0
  })

  // Users
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPhotos, setUserPhotos] = useState([])
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Seeds (kept from previous version)
  const [seedProfiles, setSeedProfiles] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        setAuthorized(false)
        setLoading(false)
        return
      }
      setAuthorized(true)
      await loadStats()
      await loadUsers()
      await loadSeeds()
      setLoading(false)
    }
    load()
  }, [navigate])

  const loadStats = async () => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

    const [
      { count: total },
      { count: today },
      { count: online },
      { count: males },
      { count: females },
      { count: other }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }).neq('status', 'permanently_deleted'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo).eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('gender', 'man').eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('gender', 'woman').eq('is_active', true),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .not('gender', 'ilike', 'man')
        .not('gender', 'ilike', 'woman')
        .eq('is_active', true)
    ])

    setStats({
      total: total || 0,
      today: today || 0,
      online: online || 0,
      males: males || 0,
      females: females || 0,
      other: other || 0
    })
  }

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, city, country, gender, relationship_goal, is_seed, created_at, last_seen, status, is_active, deleted_at, bio, date_of_birth')
      .neq('status', 'permanently_deleted')
      .order('created_at', { ascending: false })
      .limit(200)

    setUsers(data || [])
  }

  const loadSeeds = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, city, country, gender, relationship_goal, is_seed, avatar_url, created_at')
      .eq('is_seed', true)
      .order('created_at', { ascending: false })
    setSeedProfiles(data || [])
  }

  const viewUser = async (user) => {
    setSelectedUser(user)
    const { data: photos } = await supabase
      .from('photos')
      .select('*')
      .eq('profile_id', user.id)
      .order('sort_order')
    setUserPhotos(photos || [])
    setSection('userdetail')
  }

  const deactivateUser = async (id) => {
    if (!confirm('Deactivate this account? User will not appear in Discover.')) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, status: 'deactivated' })
      .eq('id', id)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Account deactivated.')
      await loadUsers()
      await loadStats()
      if (selectedUser?.id === id) setSelectedUser(prev => ({ ...prev, is_active: false, status: 'deactivated' }))
    }
  }

  const restoreUser = async (id) => {
    if (!confirm('Restore this account?')) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: true, status: 'active', deleted_at: null })
      .eq('id', id)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Account restored.')
      await loadUsers()
      await loadStats()
      if (selectedUser?.id === id) setSelectedUser(prev => ({ ...prev, is_active: true, status: 'active', deleted_at: null }))
    }
  }

  const softDeleteUser = async (id) => {
    if (!confirm('Soft-delete this account? Can be restored later.')) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Account soft-deleted.')
      await loadUsers()
      await loadStats()
      setSelectedUser(null)
      setSection('users')
    }
  }

  const permanentDeleteUser = async (id) => {
    if (!confirm('PERMANENTLY delete this account and all related data? This cannot be undone.')) return
    if (!confirm('Final confirmation: permanently delete?')) return

    // Delete photos from storage
    const { data: photos } = await supabase.from('photos').select('storage_path').eq('profile_id', id)
    if (photos?.length) {
      const paths = photos.map(p => p.storage_path)
      await supabase.storage.from('profile-photos').remove(paths)
    }

    // Delete related records
    await supabase.from('photos').delete().eq('profile_id', id)
    await supabase.from('likes').delete().or(`liker_id.eq.${id},liked_id.eq.${id}`)
    await supabase.from('blocks').delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`)
    await supabase.from('matches').delete().or(`profile_a.eq.${id},profile_b.eq.${id}`)
    // Messages will cascade or stay orphaned – safe for now

    const { error } = await supabase
      .from('profiles')
      .update({ status: 'permanently_deleted', is_active: false })
      .eq('id', id)

    // Optional hard delete of profile row (comment out if you prefer soft)
    // await supabase.from('profiles').delete().eq('id', id)

    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Account permanently deleted.')
      await loadUsers()
      await loadStats()
      setSelectedUser(null)
      setSection('users')
    }
  }

  const deletePhoto = async (photoId, storagePath) => {
    if (!confirm('Delete this photo?')) return
    await supabase.storage.from('profile-photos').remove([storagePath])
    await supabase.from('photos').delete().eq('id', photoId)
    setMessage('Photo deleted.')
    if (selectedUser) viewUser(selectedUser)
  }

  const replacePhoto = async (e, photoId, oldPath) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    try {
      const compressed = await compressImage(file, 800, 0.75)
      const ext = compressed.name.split('.').pop() || 'jpg'
      const newPath = `${selectedUser.id}/${Date.now()}.${ext}`

      await supabase.storage.from('profile-photos').upload(newPath, compressed)
      await supabase.storage.from('profile-photos').remove([oldPath])
      await supabase.from('photos').update({ storage_path: newPath }).eq('id', photoId)

      setMessage('Photo replaced.')
      viewUser(selectedUser)
    } catch (err) {
      setMessage('Upload failed: ' + err.message)
    }
    setUploadingPhoto(false)
    e.target.value = ''
  }

  const deleteSeed = async (id) => {
    if (!confirm('Delete this seed profile permanently?')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) setMessage('Error: ' + error.message)
    else {
      setSeedProfiles(prev => prev.filter(p => p.id !== id))
      setMessage('Seed profile deleted.')
      await loadStats()
    }
  }

  const deleteAllSeeds = async () => {
    if (!confirm(`Delete ALL ${seedProfiles.length} seed profiles?`)) return
    const { error } = await supabase.from('profiles').delete().eq('is_seed', true)
    if (error) setMessage('Error: ' + error.message)
    else {
      setSeedProfiles([])
      setMessage('All seed profiles deleted.')
      await loadStats()
    }
  }

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q) ||
      (u.gender || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading admin panel...</p>
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
      <header className="py-4 px-4 flex flex-wrap justify-between items-center max-w-6xl mx-auto w-full border-b border-gray-700 gap-3">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Admin
        </Link>
        <div className="flex flex-wrap gap-2 text-sm">
          <button onClick={() => { setSection('stats'); setSelectedUser(null) }} className={`px-3 py-1 rounded-full ${section === 'stats' ? 'bg-coral' : 'bg-navy-light'}`}>Statistics</button>
          <button onClick={() => { setSection('users'); setSelectedUser(null) }} className={`px-3 py-1 rounded-full ${section === 'users' || section === 'userdetail' ? 'bg-coral' : 'bg-navy-light'}`}>All Users</button>
          <button onClick={() => { setSection('seeds'); setSelectedUser(null) }} className={`px-3 py-1 rounded-full ${section === 'seeds' ? 'bg-coral' : 'bg-navy-light'}`}>Seed Profiles</button>
          <Link to="/dashboard" className="px-3 py-1 rounded-full bg-navy-light hover:bg-coral">← Dashboard</Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {message && (
          <div className="bg-coral/20 border border-coral text-coral px-4 py-2 rounded-lg mb-4 flex justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="underline text-sm">Dismiss</button>
          </div>
        )}

        {/* ========== STATISTICS ========== */}
        {section === 'stats' && (
          <div>
            <h1 className="text-3xl font-semibold mb-6">Live Statistics</h1>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-navy-light rounded-2xl p-5 text-center">
                <p className="text-4xl font-bold text-coral">{stats.total}</p>
                <p className="text-gray-400 mt-1">Total Registered</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-5 text-center">
                <p className="text-4xl font-bold text-green-400">{stats.today}</p>
                <p className="text-gray-400 mt-1">Registered Today</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-5 text-center">
                <p className="text-4xl font-bold text-blue-400">{stats.online}</p>
                <p className="text-gray-400 mt-1">Online Now (5 min)</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-5 text-center">
                <p className="text-4xl font-bold">{stats.females}</p>
                <p className="text-gray-400 mt-1">Females</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-5 text-center">
                <p className="text-4xl font-bold">{stats.males}</p>
                <p className="text-gray-400 mt-1">Males</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-5 text-center">
                <p className="text-4xl font-bold">{stats.other}</p>
                <p className="text-gray-400 mt-1">Other / Non-binary</p>
              </div>
            </div>
            <button onClick={loadStats} className="mt-6 px-5 py-2 bg-coral rounded-full text-sm">Refresh Stats</button>
          </div>
        )}

        {/* ========== ALL USERS ========== */}
        {(section === 'users' || section === 'userdetail') && !selectedUser && (
          <div>
            <h1 className="text-3xl font-semibold mb-4">All Registered Accounts ({filteredUsers.length})</h1>
            <input
              type="text"
              placeholder="Search by name, city, gender or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-4 py-2 rounded-lg bg-navy border border-gray-600 mb-6 focus:outline-none focus:border-coral"
            />
            <div className="space-y-3">
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-navy-light rounded-xl p-4 flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <p className="font-medium text-lg">{u.display_name || 'No name'} <span className="text-xs text-gray-500">({u.id.slice(0, 8)}…)</span></p>
                    <p className="text-sm text-gray-400">
                      {u.gender} · {formatLocation(u.city, u.country)} · {u.relationship_goal}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Status: <span className={u.is_active ? 'text-green-400' : 'text-red-400'}>{u.status || (u.is_active ? 'active' : 'inactive')}</span>
                      {' · '}Joined {new Date(u.created_at).toLocaleDateString()}
                      {u.last_seen && ` · Last seen ${new Date(u.last_seen).toLocaleString()}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => viewUser(u)} className="px-3 py-1 bg-coral rounded-full text-sm">View Profile</button>
                    {u.is_active ? (
                      <button onClick={() => deactivateUser(u.id)} className="px-3 py-1 bg-yellow-700 rounded-full text-sm">Deactivate</button>
                    ) : (
                      <button onClick={() => restoreUser(u.id)} className="px-3 py-1 bg-green-700 rounded-full text-sm">Restore</button>
                    )}
                    <button onClick={() => softDeleteUser(u.id)} className="px-3 py-1 bg-orange-700 rounded-full text-sm">Soft Delete</button>
                    <button onClick={() => permanentDeleteUser(u.id)} className="px-3 py-1 bg-red-800 rounded-full text-sm">Permanent Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== USER DETAIL + PHOTOS ========== */}
        {section === 'userdetail' && selectedUser && (
          <div>
            <button onClick={() => { setSelectedUser(null); setSection('users') }} className="text-coral mb-4">← Back to all users</button>
            <h1 className="text-3xl font-semibold mb-2">{selectedUser.display_name || 'User'}</h1>
            <p className="text-gray-400 mb-6">ID: {selectedUser.id}</p>

            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-navy-light rounded-2xl p-5 space-y-2">
                <p><span className="text-gray-400">Gender:</span> {selectedUser.gender}</p>
                <p><span className="text-gray-400">Looking for / Goal:</span> {selectedUser.relationship_goal}</p>
                <p><span className="text-gray-400">Location:</span> {formatLocation(selectedUser.city, selectedUser.country)}</p>
                <p><span className="text-gray-400">DOB:</span> {selectedUser.date_of_birth || '—'}</p>
                <p><span className="text-gray-400">Status:</span> {selectedUser.status} / Active: {selectedUser.is_active ? 'Yes' : 'No'}</p>
                <p><span className="text-gray-400">Joined:</span> {new Date(selectedUser.created_at).toLocaleString()}</p>
                <p><span className="text-gray-400">Last seen:</span> {selectedUser.last_seen ? new Date(selectedUser.last_seen).toLocaleString() : '—'}</p>
                <p className="pt-2"><span className="text-gray-400">Bio:</span><br />{selectedUser.bio || '—'}</p>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-3">Photos ({userPhotos.length})</h3>
                <div className="grid grid-cols-2 gap-3">
                  {userPhotos.map(ph => {
                    const url = supabase.storage.from('profile-photos').getPublicUrl(ph.storage_path).data.publicUrl
                    return (
                      <div key={ph.id} className="relative group">
                        <img src={url} alt="" className="w-full h-40 object-cover rounded-xl" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2">
                          <button onClick={() => deletePhoto(ph.id, ph.storage_path)} className="px-3 py-1 bg-red-700 rounded text-sm">Delete</button>
                          <label className="px-3 py-1 bg-coral rounded text-sm cursor-pointer">
                            {uploadingPhoto ? '…' : 'Replace'}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => replacePhoto(e, ph.id, ph.storage_path)} disabled={uploadingPhoto} />
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </div>
                {userPhotos.length === 0 && <p className="text-gray-500">No photos</p>}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {selectedUser.is_active ? (
                <button onClick={() => deactivateUser(selectedUser.id)} className="px-5 py-2 bg-yellow-700 rounded-full">Deactivate Account</button>
              ) : (
                <button onClick={() => restoreUser(selectedUser.id)} className="px-5 py-2 bg-green-700 rounded-full">Restore Account</button>
              )}
              <button onClick={() => softDeleteUser(selectedUser.id)} className="px-5 py-2 bg-orange-700 rounded-full">Soft Delete</button>
              <button onClick={() => permanentDeleteUser(selectedUser.id)} className="px-5 py-2 bg-red-800 rounded-full">Permanently Delete</button>
            </div>
          </div>
        )}

        {/* ========== SEED PROFILES (kept from previous) ========== */}
        {section === 'seeds' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-3xl font-semibold">Seed / Fake Profiles ({seedProfiles.length})</h1>
              {seedProfiles.length > 0 && (
                <button onClick={deleteAllSeeds} className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded-full text-sm">
                  Delete All Seeds
                </button>
              )}
            </div>
            {seedProfiles.length === 0 ? (
              <p className="text-gray-400">No seed profiles left. Good.</p>
            ) : (
              <div className="space-y-3">
                {seedProfiles.map(p => (
                  <div key={p.id} className="flex justify-between items-center bg-navy-light p-3 rounded-lg gap-4">
                    <div className="flex items-center gap-3">
                      {p.avatar_url && <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />}
                      <div>
                        <p className="font-medium">{p.display_name}</p>
                        <p className="text-sm text-gray-400">{p.gender} · {formatLocation(p.city, p.country)} · {p.relationship_goal}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteSeed(p.id)} className="text-sm text-red-400 hover:text-red-300">Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default Admin
