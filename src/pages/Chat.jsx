import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { formatLastSeen } from '../lib/status'

function Chat() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [me, setMe] = useState(null)
  const [other, setOther] = useState(null) // { id, display_name, photoUrl, last_seen }
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  // Keep our own last_seen fresh while chatting
  const bumpMyLastSeen = async (userId) => {
    await supabase.from('profiles').upsert({
      id: userId,
      last_seen: new Date().toISOString()
    }, { onConflict: 'id' })
  }

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)
      await bumpMyLastSeen(user.id)

      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle()

      if (match) {
        const otherId = match.profile_a === user.id ? match.profile_b : match.profile_a

        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('id, display_name, last_seen')
          .eq('id', otherId)
          .maybeSingle()

        let photoUrl = null
        const { data: photoRows } = await supabase
          .from('photos')
          .select('storage_path')
          .eq('profile_id', otherId)
          .order('sort_order')
          .limit(1)

        if (photoRows?.[0]) {
          photoUrl = supabase.storage
            .from('profile-photos')
            .getPublicUrl(photoRows[0].storage_path).data.publicUrl
        }

        setOther({
          id: otherId,
          display_name: otherProfile?.display_name || 'Someone',
          photoUrl,
          last_seen: otherProfile?.last_seen
        })
      }

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at')
      setMessages(data || [])
      setLoading(false)
    }
    init()

    // Realtime messages
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new])
      })
      .subscribe()

    // Refresh the other person's status every 45 seconds
    const statusInterval = setInterval(async () => {
      if (!other?.id) return
      const { data } = await supabase
        .from('profiles')
        .select('last_seen')
        .eq('id', other.id)
        .maybeSingle()
      if (data) {
        setOther(prev => prev ? { ...prev, last_seen: data.last_seen } : prev)
      }
    }, 45000)

    // Keep our own last_seen alive while the chat is open
    const myInterval = setInterval(() => {
      if (me?.id) bumpMyLastSeen(me.id)
    }, 60000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(statusInterval)
      clearInterval(myInterval)
    }
  }, [matchId, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async (e) => {
    e.preventDefault()
    if (!newMsg.trim() || !me) return
    const content = newMsg.trim()
    setNewMsg('')
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: me.id,
      content
    })
    // Also bump our last_seen when we send a message
    await bumpMyLastSeen(me.id)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-navy text-white">
        <p>Loading chat...</p>
      </div>
    )
  }

  const otherName = other?.display_name || 'Someone'
  const statusText = formatLastSeen(other?.last_seen)
  const isOnline = statusText === 'Online now'

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      {/* Header */}
      <header className="py-3 px-4 flex items-center justify-between border-b border-gray-700 sticky top-0 bg-navy z-10">
        <div className="flex items-center gap-3">
          <Link to="/matches" className="text-coral text-sm font-medium">← Matches</Link>
          <Link to="/" className="text-sm text-gray-300 hover:text-coral">Home</Link>
        </div>

        {/* Clickable photo + name → profile */}
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
            <span className="font-medium text-base block leading-tight">{otherName}</span>
            <span className={`text-xs ${isOnline ? 'text-green-400' : 'text-gray-500'}`}>
              {statusText}
            </span>
          </div>
        </Link>

        <div className="w-16"></div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-10">Say hello to {otherName}!</p>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === me?.id
          return (
            <div
              key={m.id}
              className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'ml-auto bg-coral' : 'bg-navy-light'}`}
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
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="p-4 border-t border-gray-700 flex gap-2">
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder={`Message ${otherName}...`}
          className="flex-1 px-4 py-3 rounded-full bg-navy-light border border-gray-600 focus:outline-none focus:border-coral"
        />
        <button type="submit" className="bg-coral px-5 rounded-full font-medium">
          Send
        </button>
      </form>
    </div>
  )
}

export default Chat
