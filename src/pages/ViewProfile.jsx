import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLastSeen } from '../lib/status'

function ageFromDob(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function ViewProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [photos, setPhotos] = useState([])
  const [interests, setInterests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      await supabase.from('profiles').upsert({
        id: user.id,
        last_seen: new Date().toISOString()
      }, { onConflict: 'id' })

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      setProfile(data)

      const { data: photoRows } = await supabase
        .from('photos')
        .select('*')
        .eq('profile_id', id)
        .order('sort_order')
      setPhotos(photoRows || [])

      const { data: interestRows } = await supabase
        .from('profile_interests')
        .select('interest')
        .eq('profile_id', id)
      setInterests((interestRows || []).map(r => r.interest))

      setLoading(false)
    }
    load()
  }, [id, navigate])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading profile...</p>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-navy text-white gap-4">
        <p>Profile not found.</p>
        <Link to="/matches" className="text-coral">Back to Messages</Link>
      </div>
    )
  }

  const statusText = formatLastSeen(profile.last_seen)
  const isOnline = statusText === 'Online now'

  return (
    <div className="min-h-screen bg-navy text-white pb-12">
      <header className="py-4 px-4 flex justify-between items-center max-w-3xl mx-auto">
        <Link to="/" className="text-sm hover:text-coral">Home</Link>
        <Link to="/matches" className="text-sm text-coral">← Messages</Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">Dashboard</Link>
      </header>

      <main className="max-w-xl mx-auto px-4">
        <div className="bg-navy-light rounded-2xl p-6">
          <div className="flex gap-3 overflow-x-auto mb-5 pb-2">
            {photos.length > 0 ? photos.map(p => (
              <img
                key={p.id}
                src={supabase.storage.from('profile-photos').getPublicUrl(p.storage_path).data.publicUrl}
                alt=""
                className={`w-40 h-52 object-cover rounded-xl flex-shrink-0 ${p.sort_order === 0 ? 'ring-2 ring-coral' : ''}`}
              />
            )) : (
              <div className="w-40 h-52 bg-navy rounded-xl flex items-center justify-center text-gray-500">
                No photo
              </div>
            )}
          </div>

          <h1 className="text-2xl font-semibold">
            {profile.display_name}
            {ageFromDob(profile.date_of_birth) ? `, ${ageFromDob(profile.date_of_birth)}` : ''}
          </h1>

          <p className={`text-sm mt-1 font-medium ${isOnline ? 'text-green-400' : 'text-gray-400'}`}>
            {statusText}
          </p>

          <p className="text-gray-400 mt-1 capitalize">
            {profile.gender || '—'} · {profile.city || '—'}
          </p>
          <p className="mt-2 capitalize text-coral">{profile.relationship_goal?.replace('-', ' ') || ''}</p>

          {profile.bio && (
            <p className="mt-4 text-gray-200 whitespace-pre-wrap">{profile.bio}</p>
          )}

          {interests.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm text-gray-400 mb-2">Interests</h3>
              <div className="flex flex-wrap gap-2">
                {interests.map(i => (
                  <span key={i} className="px-3 py-1 rounded-full bg-navy text-sm border border-gray-600">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default ViewProfile
