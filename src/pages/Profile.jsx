import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'

const PROMPTS = [
  'A perfect Sunday for me is...',
  'The way to my heart is...',
  "I'm happiest when...",
  "Two things I can't live without are...",
  'What I am looking for in a partner is...',
  "We'll get along if...",
]

function Profile() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [user, setUser] = useState(null)

  const [displayName, setDisplayName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [gender, setGender] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [relationshipGoal, setRelationshipGoal] = useState('')
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')

  const [allInterests, setAllInterests] = useState([])
  const [selectedInterestIds, setSelectedInterestIds] = useState([])
  const [prompt1, setPrompt1] = useState(PROMPTS[0])
  const [answer1, setAnswer1] = useState('')

  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setUser(user)

      const [{ data: profile }, { data: interests }, { data: myInterests }, { data: myPhotos }] =
        await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
          supabase.from('interests').select('*').order('category').order('name'),
          supabase.from('profile_interests').select('interest_id').eq('profile_id', user.id),
          supabase.from('photos').select('*').eq('profile_id', user.id).order('sort_order'),
        ])

      if (profile) {
        setDisplayName(profile.display_name || '')
        setDateOfBirth(profile.date_of_birth || '')
        setGender(profile.gender || '')
        setLookingFor(profile.looking_for || '')
        setRelationshipGoal(profile.relationship_goal || '')
        setCity(profile.city || '')
        setBio(profile.bio || '')
      }

      setAllInterests(interests || [])
      setSelectedInterestIds((myInterests || []).map((x) => x.interest_id))
      setPhotos(myPhotos || [])
      setLoading(false)
    }

    load()
  }, [navigate])

  const toggleInterest = (id) => {
    setSelectedInterestIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (selectedInterestIds.length < 3) {
      setMessage('Error: Please choose at least 3 interests')
      return
    }

    // Age check 18+
    if (dateOfBirth) {
      const age = Math.floor(
        (Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)
      )
      if (age < 18) {
        setMessage('Error: You must be 18 or older')
        return
      }
    }

    setSaving(true)
    setMessage('')

    const updates = {
      id: user.id,
      display_name: displayName.trim(),
      date_of_birth: dateOfBirth || null,
      gender,
      looking_for: lookingFor,
      relationship_goal: relationshipGoal,
      city: city.trim(),
      bio: bio.trim(),
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase.from('profiles').upsert(updates)
    if (error) {
      setMessage('Error: ' + error.message)
      setSaving(false)
      return
    }

    // Refresh interests: delete old, insert new
    await supabase.from('profile_interests').delete().eq('profile_id', user.id)
    if (selectedInterestIds.length) {
      const rows = selectedInterestIds.map((interest_id) => ({
        profile_id: user.id,
        interest_id,
      }))
      const { error: interestError } = await supabase.from('profile_interests').insert(rows)
      if (interestError) {
        setMessage('Error saving interests: ' + interestError.message)
        setSaving(false)
        return
      }
    }

    setMessage('Profile saved successfully!')
    setSaving(false)
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (photos.length >= 6) {
      setMessage('Error: Maximum 6 photos')
      return
    }

    setUploading(true)
    setMessage('')

    try {
      const compressed = await compressImage(file)
      const path = `${user.id}/${Date.now()}.webp`

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(path, compressed, { contentType: 'image/webp', upsert: false })

      if (uploadError) throw uploadError

      const { error: dbError } = await supabase.from('photos').insert({
        profile_id: user.id,
        storage_path: path,
        sort_order: photos.length + 1,
        is_primary: photos.length === 0,
        moderation_status: 'approved',
      })

      if (dbError) throw dbError

      const { data: myPhotos } = await supabase
        .from('photos')
        .select('*')
        .eq('profile_id', user.id)
        .order('sort_order')

      setPhotos(myPhotos || [])
      setMessage('Photo uploaded!')
    } catch (err) {
      setMessage('Error: ' + (err.message || 'upload failed'))
    }

    setUploading(false)
    e.target.value = ''
  }

  const photoUrl = (path) =>
    supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl

  const removePhoto = async (photo) => {
    setMessage('')
    await supabase.storage.from('profile-photos').remove([photo.storage_path])
    await supabase.from('photos').delete().eq('id', photo.id)
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading profile...</p>
      </div>
    )
  }

  // Group interests by category
  const grouped = allInterests.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = []
    acc[item.category].push(item)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-navy text-white pb-16">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <Link to="/dashboard" className="text-sm hover:text-coral">
          Back to Dashboard
        </Link>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6">
        <h1 className="text-3xl font-semibold mb-6 text-center">Your Profile</h1>

        {/* Photos */}
        <section className="bg-navy-light p-6 rounded-2xl mb-6">
          <h2 className="text-xl font-medium mb-3">Photos (1–6)</h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square">
                <img
                  src={photoUrl(photo.storage_path)}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-lg"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(photo)}
                  className="absolute top-1 right-1 bg-black/70 text-xs px-2 py-1 rounded"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {photos.length < 6 && (
            <label className="inline-block bg-coral hover:bg-coral-dark px-4 py-2 rounded-full cursor-pointer text-sm">
              {uploading ? 'Uploading...' : 'Add photo'}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploading}
                onChange={handlePhotoUpload}
              />
            </label>
          )}
        </section>

        <form onSubmit={handleSave} className="space-y-5 bg-navy-light p-6 rounded-2xl">
          <div>
            <label className="block text-sm mb-1">Display name *</label>
            <input
              type="text"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Date of birth *</label>
            <input
              type="date"
              required
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">I am *</label>
            <select
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
            >
              <option value="">Select...</option>
              <option value="woman">Woman</option>
              <option value="man">Man</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Prefer to self-describe</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Looking for *</label>
            <select
              required
              value={lookingFor}
              onChange={(e) => setLookingFor(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
            >
              <option value="">Select...</option>
              <option value="women">Women</option>
              <option value="men">Men</option>
              <option value="everyone">Everyone</option>
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">Relationship goal *</label>
            <select
              required
              value={relationshipGoal}
              onChange={(e) => setRelationshipGoal(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
            >
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
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
              placeholder="e.g. Douala, Buea, Yaoundé"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Short bio</label>
            <textarea
              rows="4"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
              placeholder="Tell people a little about yourself..."
            />
          </div>

          <div>
            <label className="block text-sm mb-2">Interests * (pick at least 3)</label>
            <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
              {Object.entries(grouped).map(([category, items]) => (
                <div key={category}>
                  <p className="text-coral text-sm mb-2">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((item) => {
                      const active = selectedInterestIds.includes(item.id)
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => toggleInterest(item.id)}
                          className={`px-3 py-1 rounded-full text-sm border ${
                            active
                              ? 'bg-coral border-coral text-white'
                              : 'border-gray-600 text-gray-300'
                          }`}
                        >
                          {item.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Profile prompt</label>
            <select
              value={prompt1}
              onChange={(e) => setPrompt1(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral mb-2"
            >
              {PROMPTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <textarea
              rows="2"
              value={answer1}
              onChange={(e) => setAnswer1(e.target.value)}
              className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 focus:outline-none focus:border-coral"
              placeholder="Your answer (optional for now)"
            />
          </div>

          {message && (
            <p className={`text-sm ${message.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || uploading}
            className="w-full bg-coral hover:bg-coral-dark py-3 rounded-lg font-medium transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </main>
    </div>
  )
}

export default Profile
