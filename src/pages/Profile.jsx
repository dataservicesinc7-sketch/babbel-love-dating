import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'

const INTEREST_OPTIONS = [
  'Cooking', 'Street food', 'Coffee', 'Football', 'Running', 'Gym', 'Hiking', 'Dancing',
  'Yoga', 'Music', 'Movies', 'Reading', 'Travel', 'Beach', 'Pets', 'Family time',
  'Entrepreneurship', 'Languages', 'Volunteering', 'Board games', 'Quiet nights in'
]

function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)
  const [photos, setPhotos] = useState([])

  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [relationshipGoal, setRelationshipGoal] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')
  const [selectedInterests, setSelectedInterests] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      // Ensure a profiles row always exists (prevents the foreign-key error later)
      await supabase.from('profiles').upsert(
        { id: user.id, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )

      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (data) {
        setDisplayName(data.display_name || '')
        setDateOfBirth(data.date_of_birth || '')
        setGender(data.gender || '')
        setLookingFor(data.looking_for || '')
        setRelationshipGoal(data.relationship_goal || '')
        setCity(data.city || '')
        setBio(data.bio || '')
      }

      const { data: interestRows } = await supabase
        .from('profile_interests')
        .select('interest')
        .eq('profile_id', user.id)
      if (interestRows) setSelectedInterests(interestRows.map(r => r.interest))

      const { data: photoRows } = await supabase
        .from('photos')
        .select('*')
        .eq('profile_id', user.id)
        .order('sort_order')
      setPhotos(photoRows || [])
      setLoading(false)
    }
    load()
  }, [navigate])

  const toggleInterest = (item) => {
    setSelectedInterests(prev =>
      prev.includes(item) ? prev.filter(i => i !== item) : [...prev, item]
    )
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (photos.length >= 6) {
      setMessage('Maximum 6 photos')
      return
    }
    setMessage('Uploading...')
    try {
      // CRITICAL FIX for the foreign-key error:
      // Make sure the profiles row exists BEFORE inserting into photos
      const { error: profileError } = await supabase.from('profiles').upsert(
        {
          id: user.id,
          display_name: displayName || null,
          date_of_birth: dateOfBirth || null,
          gender: gender || null,
          looking_for: lookingFor || null,
          relationship_goal: relationshipGoal || null,
          city: city || null,
          bio: bio || null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'id' }
      )
      if (profileError) throw profileError

      const compressed = await compressImage(file)
      const path = `${user.id}/${Date.now()}.webp`
      const { error: upError } = await supabase.storage
        .from('profile-photos')
        .upload(path, compressed)
      if (upError) throw upError

      const { error: dbError } = await supabase.from('photos').insert({
        profile_id: user.id,
        storage_path: path,
        sort_order: photos.length
      })
      if (dbError) throw dbError

      const { data: photoRows } = await supabase
        .from('photos')
        .select('*')
        .eq('profile_id', user.id)
        .order('sort_order')
      setPhotos(photoRows || [])
      setMessage('Photo added successfully!')
    } catch (err) {
      setMessage('Error: ' + err.message)
    }
    // Reset file input so the same file can be chosen again if needed
    e.target.value = ''
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (selectedInterests.length < 3) {
      setMessage('Please select at least 3 interests')
      return
    }
    setSaving(true)
    setMessage('')

    const updates = {
      id: user.id,
      display_name: displayName,
      date_of_birth: dateOfBirth || null,
      gender,
      looking_for: lookingFor,
      relationship_goal: relationshipGoal,
      city,
      bio,
      updated_at: new Date().toISOString()
    }

    const { error } = await supabase.from('profiles').upsert(updates)
    if (error) {
      setMessage('Error: ' + error.message)
      setSaving(false)
      return
    }

    // Replace interests
    await supabase.from('profile_interests').delete().eq('profile_id', user.id)
    if (selectedInterests.length) {
      await supabase.from('profile_interests').insert(
        selectedInterests.map(i => ({ profile_id: user.id, interest: i }))
      )
    }

    setMessage('Profile saved successfully!')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white pb-12">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/" className="hover:text-coral">Home</Link>
          <Link to="/dashboard" className="hover:text-coral">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-semibold mb-6 text-center">Your Profile</h1>

        <form onSubmit={handleSave} className="space-y-5 bg-navy-light p-6 rounded-2xl">
          <div>
            <label className="block text-sm mb-1">Display name *</label>
            <input type="text" required value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral" />
          </div>

          <div>
            <label className="block text-sm mb-1">Date of birth *</label>
            <input type="date" required value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral" />
          </div>

          <div>
            <label className="block text-sm mb-1">I am *</label>
            <select required value={gender} onChange={e => setGender(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral">
              <option value="">Select...</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Prefer to self-describe</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Looking for *</label>
            <select required value={lookingFor} onChange={e => setLookingFor(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral">
              <option value="">Select...</option>
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Relationship goal *</label>
            <select required value={relationshipGoal} onChange={e => setRelationshipGoal(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral">
              <option value="">Select...</option>
              <option value="friendship">Friendship</option>
              <option value="casual">Casual dating</option>
              <option value="long-term">Long-term relationship</option>
              <option value="marriage">Marriage</option>
              <option value="companionship">Companionship</option>
              <option value="not-sure">Not sure yet</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">City *</label>
            <input type="text" required value={city} onChange={e => setCity(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
              placeholder="e.g. Douala, Buea" />
          </div>

          <div>
            <label className="block text-sm mb-1">Short bio</label>
            <textarea rows="3" value={bio} onChange={e => setBio(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral" />
          </div>

          <div>
            <label className="block text-sm mb-2">Interests (choose at least 3) *</label>
            <div className="flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map(item => (
                <button type="button" key={item} onClick={() => toggleInterest(item)}
                  className={`px-3 py-1 rounded-full text-sm border ${selectedInterests.includes(item) ? 'bg-coral border-coral' : 'border-gray-500'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-2">Photos (up to 6)</label>
            <div className="flex flex-wrap gap-3 mb-3">
              {photos.map(p => (
                <img key={p.id}
                  src={supabase.storage.from('profile-photos').getPublicUrl(p.storage_path).data.publicUrl}
                  alt="" className="w-20 h-20 object-cover rounded-lg" />
              ))}
            </div>
            {photos.length < 6 && (
              <input type="file" accept="image/*" onChange={handlePhotoUpload}
                className="text-sm" />
            )}
          </div>

          {message && (
            <p className={`text-sm ${message.includes('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
          )}

          <button type="submit" disabled={saving}
            className="w-full bg-coral hover:bg-coral-dark py-3 rounded-lg font-medium transition disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default Profile
