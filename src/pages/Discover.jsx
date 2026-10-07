import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function ageFromDob(dob) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

function Discover() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [profiles, setProfiles] = useState([])
  const [message, setMessage] = useState('')
  const [me, setMe] = useState(null)
  const [reportTarget, setReportTarget] = useState(null)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle()

      if (!myProfile?.display_name) {
        setMessage('Please complete your profile first.')
        setMe(user)
        setLoading(false)
        return
      }

      setMe({ ...user, profile: myProfile })

      const { data: others, error } = await supabase
        .from('profiles')
        .select('id, display_name, date_of_birth, city, relationship_goal, bio, gender')
        .neq('id', user.id)
        .limit(30)

      if (error) {
        setMessage(error.message)
        setLoading(false)
        return
      }

      const withPhotos = []
      for (const p of others || []) {
        const { data: photoRows } = await supabase
          .from('photos')
          .select('storage_path')
          .eq('profile_id', p.id)
          .order('sort_order')
          .limit(1)

        const path = photoRows?.[0]?.storage_path
        const photo = path
          ? supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl
          : null
        withPhotos.push({ ...p, photo })
      }

      setProfiles(withPhotos)
      setLoading(false)
    }

    load()
  }, [navigate])

  const likeProfile = async (otherId) => {
    if (!me) return
    setMessage('')

    const { error } = await supabase.from('likes').insert({
      from_profile: me.id,
      to_profile: otherId,
    })

    if (error && !String(error.message).toLowerCase().includes('duplicate')) {
      setMessage('Error: ' + error.message)
      return
    }

    const { data: mutual } = await supabase
      .from('likes')
      .select('*')
      .eq('from_profile', otherId)
      .eq('to_profile', me.id)
      .maybeSingle()

    if (mutual) {
      await supabase.from('matches').upsert({
        profile_a: me.id < otherId ? me.id : otherId,
        profile_b: me.id < otherId ? otherId : me.id,
      })
      setMessage('It is a match! Go to Matches to start chatting.')
    } else {
      setMessage('Like sent')
    }

    setProfiles((prev) => prev.filter((p) => p.id !== otherId))
  }

  const passProfile = (otherId) => {
    setProfiles((prev) => prev.filter((p) => p.id !== otherId))
  }

  const blockProfile = async (otherId) => {
    if (!me) return
    await supabase.from('blocks').insert({
      blocker_id: me.id,
      blocked_id: otherId,
    })
    setMessage('User blocked')
    setProfiles((prev) => prev.filter((p) => p.id !== otherId))
  }

  const submitReport = async () => {
    if (!me || !reportTarget || !reportReason) return
    await supabase.from('reports').insert({
      reporter_id: me.id,
      reported_id: reportTarget,
      reason: reportReason,
      details: reportDetails || null,
    })
    setMessage('Report submitted. Thank you.')
    setReportTarget(null)
    setReportReason('')
    setReportDetails('')
    setProfiles((prev) => prev.filter((p) => p.id !== reportTarget))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading people...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-navy text-white pb-10">
      <header className="py-6 px-4 flex justify-between items-center max-w-5xl mx-auto w-full">
        <Link to="/dashboard" className="text-2xl font-bold">
          <span className="text-coral">Babbel</span> Love Dating
        </Link>
        <div className="flex gap-4 text-sm">
          <Link to="/matches" className="hover:text-coral">Matches</Link>
          <Link to="/dashboard" className="hover:text-coral">Dashboard</Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4">
        <h1 className="text-3xl font-semibold mb-4 text-center">Discover</h1>
        {message && (
          <p className="text-center text-sm text-coral mb-4">
            {message}
            {message.includes('match') && (
              <>
                {' '}
                <Link to="/matches" className="underline font-medium">
                  Open Matches
                </Link>
              </>
            )}
          </p>
        )}

        {profiles.length === 0 ? (
          <div className="text-center text-gray-400 mt-10">
            <p>No more profiles to show yet.</p>
            <p className="mt-2 text-sm">Invite friends so the room is not empty.</p>
            <Link to="/profile" className="inline-block mt-6 text-coral underline">
              Edit your profile
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {profiles.map((p) => (
              <article key={p.id} className="bg-navy-light rounded-2xl overflow-hidden">
                {p.photo ? (
                  <img src={p.photo} alt={p.display_name} className="w-full h-72 object-cover" />
                ) : (
                  <div className="w-full h-72 bg-navy flex items-center justify-center text-gray-500">
                    No photo
                  </div>
                )}
                <div className="p-5 text-left">
                  <h2 className="text-2xl font-semibold">
                    {p.display_name}
                    {ageFromDob(p.date_of_birth) ? `, ${ageFromDob(p.date_of_birth)}` : ''}
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    {p.city || '—'} · {p.relationship_goal || '—'}
                  </p>
                  {p.bio && <p className="mt-3 text-gray-200">{p.bio}</p>}

                  <div className="flex gap-3 mt-5">
                    <button
                      onClick={() => passProfile(p.id)}
                      className="flex-1 border border-gray-500 rounded-full py-3"
                    >
                      Pass
                    </button>
                    <button
                      onClick={() => likeProfile(p.id)}
                      className="flex-1 bg-coral hover:bg-coral-dark rounded-full py-3 font-medium"
                    >
                      Like
                    </button>
                  </div>

                  <div className="flex gap-3 mt-3 text-sm">
                    <button
                      onClick={() => blockProfile(p.id)}
                      className="flex-1 border border-gray-600 rounded-full py-2 text-gray-300"
                    >
                      Block
                    </button>
                    <button
                      onClick={() => setReportTarget(p.id)}
                      className="flex-1 border border-gray-600 rounded-full py-2 text-gray-300"
                    >
                      Report
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {/* Simple Report Modal */}
        {reportTarget && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-navy-light p-6 rounded-2xl max-w-md w-full">
              <h3 className="text-xl font-semibold mb-4">Report this profile</h3>
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 mb-3"
              >
                <option value="">Select a reason...</option>
                <option value="fake">Fake profile / stolen photos</option>
                <option value="scam">Romance scam / money request</option>
                <option value="harassment">Harassment</option>
                <option value="underage">Underage</option>
                <option value="nudity">Inappropriate photos</option>
                <option value="hate">Hate speech</option>
                <option value="other">Other</option>
              </select>
              <textarea
                rows="3"
                value={reportDetails}
                onChange={(e) => setReportDetails(e.target.value)}
                placeholder="Optional details..."
                className="w-full px-4 py-3 rounded-lg bg-navy border border-gray-600 mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setReportTarget(null)}
                  className="flex-1 border border-gray-500 rounded-full py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={submitReport}
                  disabled={!reportReason}
                  className="flex-1 bg-coral rounded-full py-2 font-medium disabled:opacity-50"
                >
                  Submit Report
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default Discover
