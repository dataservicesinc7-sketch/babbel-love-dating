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
  const [other, setOther] = useState(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)
  const otherIdRef = useRef(null)

  const bumpLastSeen = async (userId) => {
    if (!userId) return
    await supabase.from('profiles').upsert({
      id: userId,
      last_seen: new Date().toISOString()
    }, { onConflict: 'id' })
  }

  const markMessagesAsRead = async (userId) => {
    // Mark every message sent by the other person as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('match_id', matchId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  }

  useEffect(() => {
    let statusInterval
    let myHeartbeat

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)
      await bumpLastSeen(user.id)

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
      otherIdRef.current = otherId

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

      // Load messages
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at')
      setMessages(data || [])

      // Mark as read immediately
      await markMessagesAsRead(user.id)

      setLoading(false)

      // Refresh the other person's status every 20 seconds
      statusInterval = setInterval(async () => {
        if (!otherIdRef.current) return
        const { data } = await supabase
          .from('profiles')
          .select('last_seen')
          .eq('id', otherIdRef.current)
          .maybeSingle()
        if (data) {
          setOther(prev => prev ? { ...prev, last_seen: data.last_seen } : prev)
        }
      }, 20000)

      // Keep MY last_seen alive every 30 seconds while chat is open
      myHeartbeat = setInterval(() => {
        bumpLastSeen(user.id)
      }, 30000)
    }

    init()

    // Realtime new messages
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, async (payload) => {
        setMessages(prev => [...prev, payload.new])
        // If the new message is from the other person, mark it read
        const { data: { user } } = await supabase.auth.getUser()
        if (user && payload.new.sender_id !== user.id) {
          await supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', payload.new.id)
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      if (statusInterval) clearInterval(statusInterval)
      if (myHeartbeat) clearInterval(myHeartbeat)
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
      content,
      is_read: false
    })
    // Immediately show as online when we send
    await bumpLastSeen(me.id)
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
