import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/image'

function Chat() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [me, setMe] = useState(null)
  const [other, setOther] = useState(null)
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [iAmBlocker, setIAmBlocker] = useState(false)
  const [blockMessage, setBlockMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [showVideo, setShowVideo] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const jitsiContainerRef = useRef(null)

  const markAsRead = async (userId) => {
    if (!userId || !matchId) return
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('match_id', matchId)
      .neq('sender_id', userId)
      .eq('is_read', false)
  }

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
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
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

  // Delete own message
  const deleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message permanently?')) return
    setDeletingId(messageId)
    const { error } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .eq('sender_id', me.id)
    if (!error) {
      setMessages(prev => prev.filter(m => m.id !== messageId))
    }
    setDeletingId(null)
  }

  // Video call
  const startVideoCall = () => setShowVideo(true)
  const endVideoCall = () => {
    setShowVideo(false)
    if (window.jitsiApi) {
      window.jitsiApi.dispose()
      window.jitsiApi = null
    }
  }

  useEffect(() => {
    if (!showVideo || !jitsiContainerRef.current || !other || !me) return

    const loadJitsi = () => {
      const domain = 'meet.jit.si'
      const roomName = `BabbelPrivate-${matchId}`.replace(/[^a-zA-Z0-9-_]/g, '')
      const options = {
        roomName,
        parentNode: jitsiContainerRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,          // skip the big conference pre-join screen
          disableModeratorIndicator: true,
          enableWelcomePage: false,
          enableClosePage: false,
          disableDeepLinking: true,
        },
        interfaceConfigOverwrite: {
          TOOLBAR_BUTTONS: [
            'microphone', 'camera', 'desktop', 'fullscreen',
            'hangup', 'settings', 'raisehand', 'videoquality', 'filmstrip'
          ],
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          SHOW_BRAND_WATERMARK: false,
          DEFAULT_BACKGROUND: '#1F2A44',
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        },
        userInfo: {
          displayName: other?.display_name ? `Chat with ${other.display_name}` : 'Babbel User',
        },
      }

      window.jitsiApi = new window.JitsiMeetExternalAPI(domain, options)
      window.jitsiApi.addEventListener('readyToClose', endVideoCall)
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

      // Bidirectional block check
      const { data: blockCheck } = await supabase
        .from('blocks')
        .select('*')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${user.id})`)

      if (blockCheck && blockCheck.length > 0) {
        const amIBlocker = blockCheck.some(b => b.blocker_id === user.id)
        setBlocked(true)
        setIAmBlocker(amIBlocker)
        setBlockMessage(
          amIBlocker
            ? 'You blocked this person. Unblock them to chat again.'
            : 'You have been blocked by this person. You cannot send messages.'
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

      if (photoRows?.[0]) {
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

      // Only show messages from last 30 days
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

    const channel = supabase
      .channel(`chat-${matchId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `match_id=eq.${matchId}`
      }, (payload) => {
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
        setMessages(prev => prev.filter(m => m.id !== payload.old?.id))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [matchId, navigate])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendText = async (e) => {
    e.preventDefault()
    if (!newMsg.trim() || !me || blocked) return
    const content = newMsg.trim()
    setNewMsg('')
    await supabase.from('messages').insert({
      match_id: matchId,
      sender_id: me.id,
      content,
      message_type: 'text',
      is_read: false
    })
  }

  const uploadAndSendMedia = async (file, type, fileName) => {
    if (!me || blocked || !file) return
    setUploading(true)
    try {
      let finalFile = file
      if (type === 'image') {
        finalFile = await compressImage(file, 800, 0.7)
      }

      if (finalFile.size > 4 * 1024 * 1024) {
        alert('File too large (max ~4 MB). Please choose a smaller file.')
        setUploading(false)
        return
      }

      const ext = finalFile.name.split('.').pop() || (type === 'audio' ? 'webm' : 'bin')
      const path = `${matchId}/${me.id}/${Date.now()}.${ext}`

      const { error: upError } = await supabase.storage
        .from('chat-media')
        .upload(path, finalFile, { contentType: finalFile.type })

      if (upError) throw upError

      await supabase.from('messages').insert({
        match_id: matchId,
        sender_id: me.id,
        content: type === 'image' ? '📷 Photo' : type === 'audio' ? '🎤 Voice note' : `📎 ${fileName || 'File'}`,
        message_type: type,
        media_path: path,
        file_name: fileName || finalFile.name,
        mime_type: finalFile.type,
        is_read: false
      })
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    let type = 'file'
    if (file.type.startsWith('image/')) type = 'image'
    else if (file.type.startsWith('audio/')) type = 'audio'

    uploadAndSendMedia(file, type, file.name)
    e.target.value = ''
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks = []

      recorder.ondataavailable = (e) => chunks.push(e.data)
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' })
        uploadAndSendMedia(file, 'audio', 'Voice note')
        stream.getTracks().forEach(t => t.stop())
      }

      recorder.start()
      setMediaRecorder(recorder)
      setRecording(true)
    } catch (err) {
      alert('Microphone access denied or not available.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop()
      setRecording(false)
      setMediaRecorder(null)
    }
  }

  const unblockHere = async () => {
    if (!me || !other) return
    const { error } = await supabase
      .from('blocks')
      .delete()
      .eq('blocker_id', me.id)
      .eq('blocked_id', other.id)
    if (error) {
      alert('Error unblocking: ' + error.message)
      return
    }
    setBlocked(false)
    setIAmBlocker(false)
    setBlockMessage('')
    alert('Unblocked. You can now message again.')
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
            <img src={other.photoUrl} alt={otherName} className="w-9 h-9 rounded-full object-cover border-2 border-coral" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-navy-light flex items-center justify-center text-sm border border-gray-600">
              {otherName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="text-left">
            <span className="font-medium text-base block">{otherName}</span>
            {other?.gender && <span className="text-xs text-gray-400 capitalize">{other.gender}</span>}
          </div>
        </Link>

        {/* Video Call Button */}
        <button
          onClick={startVideoCall}
          disabled={blocked}
          className="bg-coral hover:bg-coral/90 disabled:opacity-40 text-white text-sm font-medium px-3 py-1.5 rounded-full flex items-center gap-1"
          title="Start private video call"
        >
          📹 Video
        </button>
      </header>

      {blocked && (
        <div className="bg-red-900/40 border-b border-red-700 text-center py-3 px-4 text-sm">
          {blockMessage}
          {iAmBlocker && (
            <button onClick={unblockHere} className="ml-3 underline text-coral">
              Unblock now
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !blocked && (
          <p className="text-center text-gray-500 mt-10">
            Say hello to {otherName}!<br />
            <span className="text-xs">Messages older than 30 days are hidden automatically.</span>
          </p>
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
              const mediaUrl = m.media_path
                ? supabase.storage.from('chat-media').getPublicUrl(m.media_path).data.publicUrl
                : null

              return (
                <div
                  key={m.id}
                  className={`max-w-[80%] p-3 rounded-2xl mb-2 relative group ${isMe ? 'ml-auto bg-coral' : 'bg-navy-light'}`}
                >
                  <p className="text-xs opacity-70 mb-1">{isMe ? 'You' : otherName}</p>

                  {m.message_type === 'image' && mediaUrl && (
                    <img src={mediaUrl} alt="Shared photo" className="rounded-lg max-w-full max-h-64 object-contain mb-1" />
                  )}

                  {m.message_type === 'audio' && mediaUrl && (
                    <audio controls src={mediaUrl} className="w-full max-w-xs" />
                  )}

                  {m.message_type === 'file' && mediaUrl && (
                    <a
                      href={mediaUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline text-sm break-all"
                    >
                      📎 {m.file_name || 'Download file'}
                    </a>
                  )}

                  {(m.message_type === 'text' || !m.message_type) && <p>{m.content}</p>}

                  <div className="flex items-center justify-between mt-1">
                    <p className="text-xs opacity-60">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMe && (
                      <button
                        onClick={() => deleteMessage(m.id)}
                        disabled={deletingId === m.id}
                        className="text-xs opacity-0 group-hover:opacity-100 transition-opacity ml-2 underline"
                        title="Delete this message"
                      >
                        {deletingId === m.id ? '…' : 'Delete'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input area – FULL ORIGINAL FEATURES RESTORED */}
      <div className="p-3 border-t border-gray-700">
        {uploading && <p className="text-center text-xs text-coral mb-2">Uploading...</p>}
        {recording && (
          <p className="text-center text-xs text-red-400 mb-2 animate-pulse">Recording... tap stop when finished</p>
        )}

        <form onSubmit={sendText} className="flex gap-2 items-center">
          {/* Attachment button */}
          <button
            type="button"
            disabled={blocked || uploading}
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-full border border-gray-600 disabled:opacity-40"
            title="Send photo or document"
          >
            📎
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*,.pdf,.doc,.docx,.txt"
            className="hidden"
            onChange={handleFileSelect}
          />

          {/* Voice note button */}
          {!recording ? (
            <button
              type="button"
              disabled={blocked || uploading}
              onClick={startRecording}
              className="p-2 rounded-full border border-gray-600 disabled:opacity-40"
              title="Record voice note"
            >
              🎤
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="p-2 rounded-full bg-red-600 text-white"
              title="Stop recording"
            >
              ⏹
            </button>
          )}

          <input
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder={blocked ? 'Messaging disabled' : `Message ${otherName}...`}
            disabled={blocked || uploading}
            className="flex-1 px-4 py-3 rounded-full bg-navy-light border border-gray-600 focus:outline-none focus:border-coral disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={blocked || uploading}
            className="bg-coral px-5 py-3 rounded-full font-medium disabled:opacity-50"
          >
            Send
          </button>
        </form>
      </div>

      {/* Video Call Full Screen */}
      {showVideo && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between p-3 bg-navy border-b border-gray-700">
            <span className="font-medium">Private video with {otherName}</span>
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
