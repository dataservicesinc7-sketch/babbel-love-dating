import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLocation } from '../lib/locations'

// ========== CHANGE THIS TO YOUR OWNER EMAIL ==========
const OWNER_EMAIL = 'dataservicesinc7@gmail.com'   // ← put your real owner email here
// ====================================================

function Admin() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [seedProfiles, setSeedProfiles] = useState([])
  const [message, setMessage] = useState('')
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      // Only the owner email can access Admin
      if (user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        setAuthorized(false)
        setLoading(false)
        return
      }

      setAuthorized(true)

      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, city, country, gender, relationship_goal, is_seed, avatar_url, created_at')
        .eq('is_seed', true)
        .order('created_at', { ascending: false })

      setSeedProfiles(data || [])
      setLoading(false)
    }
    load()
  }, [navigate])

  const deleteSeed = async (id) => {
    if (!confirm('Delete this seed profile permanently?')) return
    const { error } = await supabase.from('profiles').delete().eq('id', id)
    if (error) {
      setMessage('Error: ' + error.message)
      return
    }
    setSeedProfiles(prev => prev.filter(p => p.id !== id))
    setMessage('Seed profile deleted.')
  }

  const deleteAllSeeds = async () => {
    if (!confirm(`Delete ALL ${seedProfiles.length} seed profiles? This cannot be undone.`)) return
    const { error } = await supabase.from('profiles').delete().eq('is_seed', true)
    if (error) {
      setMessage('Error: ' + error.message)
      return
    }
    setSeedProfiles([])
    setMessage('All seed profiles deleted.')
  }

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
    <div className="min-h-screen bg-navy text-white pb-12">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Admin
        </Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">← Back to Dashboard</Link>
      </header>

      <main className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-semibold mb-2">Admin Panel</h1>
        <p className="text-gray-400 mb-8">Manage seed / fake profiles. Delete them as soon as real members join.</p>

        {message && <p className="text-coral mb-4">{message}</p>}

        <div className="bg-navy-light rounded-2xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Seed / Fake Profiles ({seedProfiles.length})</h2>
            {seedProfiles.length > 0 && (
              <button
                onClick={deleteAllSeeds}
                className="px-4 py-2 bg-red-700 hover:bg-red-800 rounded-full text-sm"
              >
                Delete All Seeds
              </button>
            )}
          </div>

          {seedProfiles.length === 0 ? (
            <p className="text-gray-400">No seed profiles left. Good — the room is now real members only.</p>
          ) : (
            <div className="space-y-3">
              {seedProfiles.map(p => (
                <div key={p.id} className="flex justify-between items-center bg-navy p-3 rounded-lg gap-4">
                  <div className="flex items-center gap-3">
                    {p.avatar_url && (
                      <img src={p.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                      <p className="font-medium">{p.display_name}</p>
                      <p className="text-sm text-gray-400">
                        {p.gender} · {formatLocation(p.city, p.country)} · {p.relationship_goal}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteSeed(p.id)}
                    className="text-sm text-red-400 hover:text-red-300 whitespace-nowrap"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-sm text-gray-500">
          Tip: After you have 100+ real members, delete every seed. Never leave fakes in a live community.
        </p>
      </main>
    </div>
  )
}

export default Admin
