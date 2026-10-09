import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Chat() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [me, setMe] = useState(null)
  const [other, setOther] = useState(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [blockMessage, setBlockMessage] = useState('')
  const bottomRef = useRef(null)

  const markAsRead = async (userId) => {
    if (!userId || !matchId) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('match_id', matchId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  }

  // Group messages by date for clear date headers
  const groupMessagesByDate = (msgs) => {
    const groups = []
    let currentDate = null
    let currentGroup = null

    msgs.forEach((m) => {
      const d = new Date(m.created_at)
      const dateKey = d.toDateString()
      let label = dateKey
      const today = new Date().toDateString()
      const yesterday = new Date(Date.now() - 86400000).toDateString()
      if (dateKey === today) label = 'Today'
      else if (dateKey === yesterday) label = 'Yesterday'
      else {
        label = d.toLocaleDateString(undefined, {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        })
      }

      if (dateKey !== currentDate) {
        currentDate = dateKey
        currentGroup = { label, messages: [] }
        groups.push(currentGroup)
      }
      currentGroup.messages.push(m)
    })
    return groups
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)

      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle()

      if (!match) {
        setLoading(false)
        return
      }

      const otherId = match.profile_a === user.id ? match.profile_b : match.profile_a

      // Check blocks both ways
      const { data: blockCheck } = await supabase
        .from('blocks')
        .select('*')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${user.id})`)

      if (blockCheck && blockCheck.length > 0) {
        const iAmBlocker = blockCheck.some(b => b.blocker_id === user.id)
        setBlocked(true)
        setBlockMessage(
          iAmBlocker
            ? 'You blocked this person. You cannot send messages.'
            : 'You have been blocked by this person. You cannot send or receive messages.'
        )
      }

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select('id, display_name, city, date_of_birth, gender')
        .eq('id', otherId)
        .maybeSingle()

      let photoUrl = null
      const { data: photoRows } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('profile_id', otherId)
        .order('sort_order')
        .limit(1)

      if (photoRows && photoRows.length > 0) {
        photoUrl = supabase.storage
          .from('profile-photos')
          .getPublicUrl(photoRows[0].storage_path).data.publicUrl
      }

      setOther({
        id: otherId,
        display_name: otherProfile?.display_name || 'Someone',
        city: otherProfile?.city || '',
        gender: otherProfile?.gender || '',
        photoUrl
      })

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at')
      setMessages(data || [])
      setLoading(false)

      await markAsRead(user.id)
    }
    init()

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
        if (payload.new.sender_id !== me?.id) {
          markAsRead(me?.id)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [matchId, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!newMsg.trim() || !me || blocked) return
    const content = newMsg.trim()
    setNewMsg('')
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: me.id,
      content,
      is_read: false
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading chat...</p>
      </div>
    )
  }

  const otherName = other?.display_name || 'Someone'
  const grouped = groupMessagesByDate(messages)

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      <header className="py-3 px-4 flex items-center justify-between border-b border-gray-700 sticky top-0 bg-navy z-10">
        <div className="flex items-center gap-3">
          <Link to="/matches" className="text-coral text-sm font-medium">← Matches</Link>
          <Link to="/" className="text-sm text-gray-300 hover:text-coral">Home</Link>
        </div>

        <Link
          to={other?.id ? `/profile/${other.id}` : '#'}
          className="flex items-center gap-2 hover:opacity-90"
        >
          {other?.photoUrl ? (
            <img
              src={other.photoUrl}
              alt={otherName}
              className="w-9 h-9 rounded-full object-cover border-2 border-coral"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-navy-light flex items-center justify-center text-sm border border-gray-600">
              {otherName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <span className="font-medium text-base block">{otherName}</span>
            {other?.gender && (
              <span className="text-xs text-gray-400 capitalize">{other.gender}</span>
            )}
          </div>
        </Link>

        <div className="w-16"></div>
      </header>

      {blocked && (
        <div className="bg-red-900/40 border-b border-red-700 text-center py-3 px-4 text-sm">
          {blockMessage}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !blocked && (
          <p className="text-center text-gray-500 mt-10">Say hello to {otherName}!</p>
        )}

        {grouped.map((group) => (
          <div key={group.label}>
            <div className="flex justify-center my-4">
              <span className="bg-navy-light text-gray-400 text-xs px-3 py-1 rounded-full">
                {group.label}
              </span>
            </div>
            {group.messages.map((m) => {
              const isMe = m.sender_id === me?.id
              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] p-3 rounded-2xl mb-2 ${isMe ? 'ml-auto bg-coral' : 'bg-navy-light'}`}
                >
                  <p className="text-xs opacity-70 mb-1">
                    {isMe ? 'You' : otherName}
                  </p>
                  <p>{m.content}</p>
                  <p className="text-xs opacity-60 mt-1">
                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="p-4 border-t border-gray-700 flex gap-2">
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder={blocked ? 'Messaging is disabled' : `Message ${otherName}...`}
          disabled={blocked}
          className="flex-1 px-4 py-3 rounded-full bg-navy-light border border-gray-600 focus:outline-none focus:border-coral disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={blocked}
          className="bg-coral px-5 rounded-full font-medium disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  )
}

export default Chat
