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
  const [showVideo, setShowVideo] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const bottomRef = useRef(null)
  const jitsiContainerRef = useRef(null)

  // Mark all messages from the other person as read
  const markAsRead = async (userId) => {
    if (!userId || !matchId) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('match_id', matchId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  }

  // Delete a message (only own messages)
  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message permanently?')) return
    setDeletingId(messageId)
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', me.id) // extra safety
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    }
    setDeletingId(null)
  }

  // Start / stop video call (Jitsi – completely free)
  const startVideoCall = () => {
    setShowVideo(true)
  }

  const endVideoCall = () => {
    setShowVideo(false)
    // Clean up any existing Jitsi instance
    if (window.jitsiApi) {
      window.jitsiApi.dispose()
      window.jitsiApi = null
    }
  }

  useEffect(() => {
    if (!showVideo || !jitsiContainerRef.current || !other) return

    // Load Jitsi external API if not already loaded
    const loadJitsi = () => {
      const domain = 'meet.jit.si'
      const roomName = `BabbelLove-${matchId}`.replace(/[^a-zA-Z0-9-_]/g, '')
      const options = {
        roomName,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          disableModeratorIndicator: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'chat', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'tileview'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
        },
        userInfo: {
          displayName: me?.user_metadata?.display_name || me?.email?.split('@')[0] || 'Babbel User',
        },
      }

      window.jitsiApi = new window.JitsiMeetExternalAPI(domain, options)

      window.jitsiApi.addEventListener('readyToClose', () => {
        endVideoCall()
      })
    }

    if (window.JitsiMeetExternalAPI) {
      loadJitsi()
    } else {
      const script = document.createElement('script')
      script.src = 'https://meet.jit.si/external_api.js'
      script.async = true
      script.onload = loadJitsi
      document.body.appendChild(script)
    }

    return () => {
      if (window.jitsiApi) {
        window.jitsiApi.dispose()
        window.jitsiApi = null
      }
    }
  }, [showVideo, matchId, other, me])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)

      // Get the match
      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .maybeSingle()

      if (match) {
        const otherId = match.profile_a === user.id ? match.profile_b : match.profile_a

        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('id, display_name, city, date_of_birth')
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
          photoUrl
        })
      }

      // Only load messages from the last 30 days (auto-cleanup + display filter)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at')

      setMessages(data || [])
      setLoading(false)

      await markAsRead(user.id)
    }
    init()

    // Realtime: INSERT + DELETE
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        // Only keep messages from last 30 days
        const msgDate = new Date(payload.new.created_at)
        const thirtyDaysAgo = new Date()
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        if (msgDate >= thirtyDaysAgo) {
          setMessages(prev => [...prev, payload.new])
        }
        if (payload.new.sender_id !== me?.id) {
          markAsRead(me?.id)
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id))
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
    if (!newMsg.trim() || !me) return
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

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      {/* Header */}
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
          <span className="font-medium text-base">{otherName}</span>
        </Link>

        {/* Video Call Button */}
        <button
          onClick={startVideoCall}
          className="bg-coral hover:bg-coral/90 text-white text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-1"
          title="Start free video call"
        >
          📹 Video
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-500 mt-10">
            Say hello to {otherName}!<br />
            <span className="text-xs">Messages older than 30 days are automatically removed.</span>
          </p>
        )}
        {messages.map(m => {
          const isMe = m.sender_id === me?.id
          return (
            <div
              key={m.id}
              className={`max-w-[80%] p-3 rounded-2xl relative group ${isMe ? 'ml-auto bg-coral' : 'bg-navy-light'}`}
            >
              <p className="text-xs opacity-70 mb-1">
                {isMe ? 'You' : otherName}
              </p>
              <p>{m.content}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs opacity-60">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
                {isMe && (
                  <button
                    onClick={() => deleteMessage(m.id)}
                    disabled={deletingId === m.id}
                    className="text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-white/80 hover:text-white underline"
                    title="Delete this message"
                  >
                    {deletingId === m.id ? '…' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
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

      {/* Full-screen Video Call Modal (Jitsi) */}
      {showVideo && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-3 bg-navy border-b border-gray-700">
            <span className="font-medium">Video call with {otherName}</span>
            <button
              onClick={endVideoCall}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-sm font-medium"
            >
              End Call
            </button>
          </div>
          <div ref={jitsiContainerRef} className="flex-1 w-full h-full" />
        </div>
      )}
    </div>
  )
}

export default Chat
