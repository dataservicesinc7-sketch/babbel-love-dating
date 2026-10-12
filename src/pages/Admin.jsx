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
  const [section, setSection] = useState('users')
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userPhotos, setUserPhotos] = useState([])
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [seedProfiles, setSeedProfiles] = useState([])
  const [stats, setStats] = useState({
    total: 0, today: 0, online: 0, males: 0, females: 0, other: 0
  })

  useEffect(() => {
    const init = async () => {
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
      await Promise.all([loadUsers(), loadStats(), loadSeeds()])
      setLoading(false)
    }
    init()
  }, [navigate])

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id, display_name, city, country, gender, relationship_goal,
        is_seed, created_at, last_seen, status, is_active, deleted_at,
        bio, date_of_birth, looking_for, admin_rank, avatar_url
      `)
      .order('admin_rank', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) {
      setMessage('Error loading users: ' + error.message)
      return
    }
    setUsers(data || [])
  }

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
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('last_seen', fiveMinAgo),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('gender', 'man'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).ilike('gender', 'woman'),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
        .not('gender', 'ilike', 'man')
        .not('gender', 'ilike', 'woman')
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

  const loadSeeds = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, city, country, gender, relationship_goal, is_seed, avatar_url, created_at')
      .eq('is_seed', true)
      .order('created_at', { ascending: false })
    setSeedProfiles(data || [])
  }

  // ========== VIEW FULL PROFILE ==========
  const viewUser = async (user) => {
    setSelectedUser(user)
    setSection('detail')
    setAvatarUrl(user.avatar_url || null)

    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .eq('profile_id', user.id)
      .order('sort_order')

    if (error) {
      console.error('Error loading photos:', error)
      setUserPhotos([])
    } else {
      setUserPhotos(photos || [])
    }
  }

  // ========== RANKING ==========
  const updateRank = async (id, newRank) => {
    const rank = parseInt(newRank) || 0
    const { error } = await supabase
      .from('profiles')
      .update({ admin_rank: rank })
      .eq('id', id)
    if (error) {
      setMessage('Error updating rank: ' + error.message)
    } else {
      setMessage(`Rank updated to ${rank}`)
      await loadUsers()
      if (selectedUser?.id === id) {
        setSelectedUser(prev => ({ ...prev, admin_rank: rank }))
      }
    }
  }

  // ========== DEACTIVATE / RESTORE / DELETE ==========
  const deactivateUser = async (id) => {
    if (!confirm('Deactivate this account?')) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, status: 'deactivated' })
      .eq('id', id)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Account deactivated')
      await loadUsers()
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
      setMessage('Account restored')
      await loadUsers()
      if (selectedUser?.id === id) setSelectedUser(prev => ({ ...prev, is_active: true, status: 'active', deleted_at: null }))
    }
  }

  const softDeleteUser = async (id) => {
    if (!confirm('Soft-delete this account?')) return
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: false, status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', id)
    if (error) setMessage('Error: ' + error.message)
    else {
      setMessage('Account soft-deleted')
      setSelectedUser(null)
      setSection('users')
      await loadUsers()
    }
  }

  const permanentDeleteUser = async (id, name) => {
    if (!confirm(`PERMANENTLY delete ${name || 'this user'}?`)) return
    if (!confirm('Final confirmation – irreversible.')) return

    try {
      const { data: photos } = await supabase.from('photos').select('storage_path').eq('profile_id', id)
      if (photos?.length) {
        const paths = photos.map(p => p.storage_path).filter(Boolean)
        if (paths.length) await supabase.storage.from('profile-photos').remove(paths)
      }

      await supabase.from('photos').delete().eq('profile_id', id)
      await supabase.from('likes').delete().or(`liker_id.eq.${id},liked_id.eq.${id}`)
      await supabase.from('blocks').delete().or(`blocker_id.eq.${id},blocked_id.eq.${id}`)
      await supabase.from('matches').delete().or(`profile_a.eq.${id},profile_b.eq.${id}`)

      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) throw error

      setMessage('User permanently deleted')
      setSelectedUser(null)
      setSection('users')
      await loadUsers()
      await loadStats()
      await loadSeeds()
    } catch (err) {
      setMessage('Error: ' + err.message)
    }
  }

  // ========== PHOTO MANAGEMENT – FIXED ==========
  const deletePhoto = async (photoId, storagePath) => {
    if (!confirm('Delete this photo?')) return
    try {
      if (storagePath) {
        await supabase.storage.from('profile-photos').remove([storagePath])
      }
      const { error } = await supabase.from('photos').delete().eq('id', photoId)
      if (error) throw error
      setMessage('Photo deleted')
      if (selectedUser) await viewUser(selectedUser)
    } catch (err) {
      setMessage('Delete failed: ' + err.message)
    }
  }

  const deleteAvatarUrl = async () => {
    if (!selectedUser) return
    if (!confirm('Remove the original seed photo?')) return
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', selectedUser.id)
    if (error) {
      setMessage('Failed to remove seed photo: ' + error.message)
    } else {
      setAvatarUrl(null)
      setMessage('Original seed photo removed')
      await loadUsers()
    }
  }

  const addNewPhoto = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !selectedUser) return

    if (userPhotos.length >= 6) {
      setMessage('Maximum 6 photos allowed')
      return
    }

    setUploadingPhoto(true)
    setMessage('Uploading photo...')

    try {
      // 1. Compress
      const compressed = await compressImage(file, 900, 0.8)

      // 2. Create unique path
      const ext = (compressed.name || file.name || 'photo').split('.').pop() || 'webp'
      const path = `${selectedUser.id}/${Date.now()}.${ext}`

      // 3. Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, compressed, {
          contentType: compressed.type || 'image/webp',
          upsert: true
        })

      if (uploadError) {
        throw new Error('Storage upload failed: ' + uploadError.message)
      }

      // 4. Insert into photos table
      const nextOrder = userPhotos.length === 0 ? 0 : Math.max(...userPhotos.map(p => p.sort_order || 0)) + 1

      const { error: insertError } = await supabase
        .from('photos')
        .insert({
          profile_id: selectedUser.id,
          storage_path: path,
          sort_order: nextOrder
        })

      if (insertError) {
        throw new Error('Database insert failed: ' + insertError.message)
      }

      // 5. Clear the old seed avatar_url so it never comes back
      await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', selectedUser.id)

      setMessage('Photo uploaded successfully!')
      setAvatarUrl(null)

      // 6. Force full refresh of the profile
      await viewUser({ ...selectedUser, avatar_url: null })
      await loadUsers()

    } catch (err) {
      console.error('Upload error:', err)
      setMessage('UPLOAD FAILED: ' + err.message)
    }

    setUploadingPhoto(false)
    e.target.value = ''
  }

  const replacePhoto = async (e, photoId, oldPath) => {
    const file = e.target.files?.[0]
    if (!file || !selectedUser) return

    setUploadingPhoto(true)
    setMessage('Replacing photo...')

    try {
      const compressed = await compressImage(file, 900, 0.8)
      const ext = (compressed.name || file.name || 'photo').split('.').pop() || 'webp'
      const newPath = `${selectedUser.id}/${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(newPath, compressed, { upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      if (oldPath) {
        await supabase.storage.from('profile-photos').remove([oldPath])
      }

      const { error: updateError } = await supabase
        .from('photos')
        .update({ storage_path: newPath })
        .eq('id', photoId)

      if (updateError) throw new Error(updateError.message)

      setMessage('Photo replaced successfully')
      await viewUser(selectedUser)
    } catch (err) {
      setMessage('Replace failed: ' + err.message)
    }

    setUploadingPhoto(false)
    e.target.value = ''
  }

  // ========== SEED ACTIONS ==========
  const deleteSeed = async (id) => {
    if (!confirm('Delete this seed profile?')) return
    await supabase.from('profiles').delete().eq('id', id)
    setSeedProfiles(prev => prev.filter(p => p.id !== id))
    setMessage('Seed deleted')
    loadStats()
    loadUsers()
  }

  const deleteAllSeeds = async () => {
    if (!confirm(`Delete ALL ${seedProfiles.length} seed profiles?`)) return
    await supabase.from('profiles').delete().eq('is_seed', true)
    setSeedProfiles([])
    setMessage('All seeds deleted')
    loadStats()
    loadUsers()
  }

  const filteredUsers = users.filter(u => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      (u.display_name || '').toLowerCase().includes(q) ||
      (u.city || '').toLowerCase().includes(q) ||
      (u.gender || '').toLowerCase().includes(q) ||
      (u.id || '').includes(q)
    )
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p className="text-xl">Loading Admin Panel...</p>
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-navy text-white gap-4">
        <h1 className="text-2xl font-semibold">Access Denied</h1>
        <p className="text-gray-400">Only the site owner can access this page.</p>
        <Link to="/dashboard" className="text-coral underline">Back to Dashboard</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white pb-20">
      <header className="sticky top-0 z-20 bg-navy border-b border-gray-700 py-4 px-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard" className="text-2xl font-bold">
            <span className="text-coral">Babbel</span> Admin
          </Link>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { setSection('users'); setSelectedUser(null) }}
              className={`px-4 py-1.5 rounded-full text-sm ${section === 'users' || section === 'detail' ? 'bg-coral' : 'bg-navy-light'}`}
            >
              All Users
            </button>
            <button
              onClick={() => { setSection('stats'); setSelectedUser(null) }}
              className={`px-4 py-1.5 rounded-full text-sm ${section === 'stats' ? 'bg-coral' : 'bg-navy-light'}`}
            >
              Statistics
            </button>
            <button
              onClick={() => { setSection('seeds'); setSelectedUser(null) }}
              className={`px-4 py-1.5 rounded-full text-sm ${section === 'seeds' ? 'bg-coral' : 'bg-navy-light'}`}
            >
              Seeds
            </button>
            <Link to="/dashboard" className="px-4 py-1.5 rounded-full text-sm bg-navy-light hover:bg-coral">
              ← Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {message && (
          <div className="mb-5 bg-coral/20 border border-coral text-coral px-4 py-3 rounded-xl flex justify-between items-center">
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="underline text-sm">Dismiss</button>
          </div>
        )}

        {/* STATISTICS */}
        {section === 'stats' && (
          <div>
            <h1 className="text-3xl font-semibold mb-6">Live Statistics</h1>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-navy-light rounded-2xl p-6 text-center">
                <p className="text-4xl font-bold text-coral">{stats.total}</p>
                <p className="text-gray-400 mt-1">Total Registered</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-6 text-center">
                <p className="text-4xl font-bold text-green-400">{stats.today}</p>
                <p className="text-gray-400 mt-1">Registered Today</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-6 text-center">
                <p className="text-4xl font-bold text-blue-400">{stats.online}</p>
                <p className="text-gray-400 mt-1">Online Now</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-6 text-center">
                <p className="text-4xl font-bold">{stats.females}</p>
                <p className="text-gray-400 mt-1">Females</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-6 text-center">
                <p className="text-4xl font-bold">{stats.males}</p>
                <p className="text-gray-400 mt-1">Males</p>
              </div>
              <div className="bg-navy-light rounded-2xl p-6 text-center">
                <p className="text-4xl font-bold">{stats.other}</p>
                <p className="text-gray-400 mt-1">Other</p>
              </div>
            </div>
          </div>
        )}

        {/* ALL USERS */}
        {section === 'users' && (
          <div>
            <h1 className="text-3xl font-semibold mb-2">All Registered Users</h1>
            <p className="text-gray-400 mb-5">{filteredUsers.length} users</p>

            <input
              type="text"
              placeholder="Search name, city, gender or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full max-w-md px-4 py-3 rounded-xl bg-navy border border-gray-600 mb-6 focus:outline-none focus:border-coral"
            />

            <div className="space-y-3">
              {filteredUsers.map(u => (
                <div key={u.id} className="bg-navy-light rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-lg">
                      {u.display_name || 'No name'}
                      {u.is_seed && <span className="ml-2 text-xs bg-yellow-600 px-2 py-0.5 rounded-full">SEED</span>}
                      {u.is_active === false && <span className="ml-2 text-xs bg-orange-700 px-2 py-0.5 rounded-full">INACTIVE</span>}
                    </p>
                    <p className="text-sm text-gray-400">
                      {u.gender} · {formatLocation(u.city, u.country)} · Rank: {u.admin_rank || 0}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewUser(u)}
                      className="px-4 py-2 bg-coral rounded-lg text-sm font-medium"
                    >
                      View Profile
                    </button>
                    <button
                      onClick={() => permanentDeleteUser(u.id, u.display_name)}
                      className="px-3 py-2 bg-red-800 rounded-lg text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PROFILE DETAIL */}
        {section === 'detail' && selectedUser && (
          <div>
            <button
              onClick={() => { setSelectedUser(null); setSection('users') }}
              className="text-coral mb-5 text-sm font-medium"
            >
              ← Back to All Users
            </button>

            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-semibold">
                  {selectedUser.display_name || 'No name'}
                  {selectedUser.is_seed && <span className="ml-3 text-sm bg-yellow-600 px-2 py-1 rounded-full">SEED</span>}
                </h1>
                <p className="text-gray-400 text-sm mt-1">ID: {selectedUser.id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedUser.is_active === false ? (
                  <button onClick={() => restoreUser(selectedUser.id)} className="px-4 py-2 bg-green-700 rounded-lg text-sm">Restore</button>
                ) : (
                  <button onClick={() => deactivateUser(selectedUser.id)} className="px-4 py-2 bg-orange-700 rounded-lg text-sm">Deactivate</button>
                )}
                <button onClick={() => softDeleteUser(selectedUser.id)} className="px-4 py-2 bg-yellow-700 rounded-lg text-sm">Soft Delete</button>
                <button onClick={() => permanentDeleteUser(selectedUser.id, selectedUser.display_name)} className="px-4 py-2 bg-red-800 rounded-lg text-sm">Permanent Delete</button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-navy-light rounded-2xl p-6 space-y-3">
                <h2 className="text-xl font-semibold mb-3">Profile Information</h2>
                <p><span className="text-gray-400">Gender:</span> {selectedUser.gender || '—'}</p>
                <p><span className="text-gray-400">Looking for:</span> {selectedUser.looking_for || '—'}</p>
                <p><span className="text-gray-400">Goal:</span> {selectedUser.relationship_goal || '—'}</p>
                <p><span className="text-gray-400">Location:</span> {formatLocation(selectedUser.city, selectedUser.country)}</p>
                <p><span className="text-gray-400">Date of Birth:</span> {selectedUser.date_of_birth || '—'}</p>
                <p><span className="text-gray-400">Status:</span> {selectedUser.status || 'active'}</p>
                <div className="pt-3">
                  <p className="text-gray-400 mb-1">Bio:</p>
                  <p className="bg-navy p-3 rounded-lg text-sm">{selectedUser.bio || 'No bio'}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-navy-light rounded-2xl p-6">
                  <h2 className="text-xl font-semibold mb-3">Admin Ranking</h2>
                  <p className="text-sm text-gray-400 mb-3">Higher number = appears first in Discover</p>
                  <input
                    type="number"
                    defaultValue={selectedUser.admin_rank || 0}
                    onBlur={(e) => updateRank(selectedUser.id, e.target.value)}
                    className="w-28 px-3 py-2 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
                  />
                </div>

                {/* PHOTOS SECTION */}
                <div className="bg-navy-light rounded-2xl p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">
                      Photos ({userPhotos.length + (avatarUrl ? 1 : 0)})
                    </h2>
                    <label className="px-4 py-2 bg-coral rounded-lg text-sm cursor-pointer">
                      {uploadingPhoto ? 'Uploading...' : '+ Add Photo'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={addNewPhoto}
                        disabled={uploadingPhoto}
                      />
                    </label>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {/* Old seed avatar */}
                    {avatarUrl && (
                      <div className="relative group">
                        <img src={avatarUrl} alt="Seed" className="w-full h-36 object-cover rounded-xl border-2 border-yellow-500" />
                        <div className="absolute top-1 left-1 bg-yellow-600 text-xs px-1.5 py-0.5 rounded">SEED</div>
                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-xl">
                          <button onClick={deleteAvatarUrl} className="px-3 py-1 bg-red-600 rounded text-sm">
                            Remove
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Real photos from storage */}
                    {userPhotos.map(ph => {
                      const url = supabase.storage.from('profile-photos').getPublicUrl(ph.storage_path).data.publicUrl
                      return (
                        <div key={ph.id} className="relative group">
                          <img src={url} alt="" className="w-full h-36 object-cover rounded-xl" />
                          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition flex flex-col items-center justify-center gap-2 rounded-xl">
                            <button
                              onClick={() => deletePhoto(ph.id, ph.storage_path)}
                              className="px-3 py-1 bg-red-600 rounded text-sm"
                            >
                              Delete
                            </button>
                            <label className="px-3 py-1 bg-coral rounded text-sm cursor-pointer">
                              Replace
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => replacePhoto(e, ph.id, ph.storage_path)}
                                disabled={uploadingPhoto}
                              />
                            </label>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {userPhotos.length === 0 && !avatarUrl && (
                    <p className="text-gray-400 mt-4 text-sm">No photos. Click “+ Add Photo” to upload one.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SEEDS TAB */}
        {section === 'seeds' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-semibold">Seed Profiles ({seedProfiles.length})</h1>
              {seedProfiles.length > 0 && (
                <button onClick={deleteAllSeeds} className="px-5 py-2 bg-red-700 rounded-full text-sm">
                  Delete All Seeds
                </button>
              )}
            </div>
            <div className="space-y-3">
              {seedProfiles.map(p => (
                <div key={p.id} className="bg-navy-light p-4 rounded-xl flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    {p.avatar_url && <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />}
                    <div>
                      <p className="font-medium">{p.display_name}</p>
                      <p className="text-sm text-gray-400">{p.gender} · {formatLocation(p.city, p.country)}</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => viewUser(p)} className="text-coral text-sm">View / Edit Photos</button>
                    <button onClick={() => deleteSeed(p.id)} className="text-red-400 text-sm">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Admin
