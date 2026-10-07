import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Chat() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [me, setMe] = useState(null)
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        navigate('/login')
        return
      }
      setMe(user)

      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at')
      setMessages(data || [])
      setLoading(false)
    }
    init()

    // Realtime subscription
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
      content
    })
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-navy text-white"><p>Loading chat...</p></div>
  }

  return (
    <div className="min-h-screen bg-navy text-white flex flex-col">
      <header className="py-4 px-4 flex justify-between items-center border-b border-gray-700">
        <Link to="/matches" className="text-sm text-coral">← Matches</Link>
        <span className="font-medium">Chat</span>
        <div className="w-12"></div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => (
          <div key={m.id} className={`max-w-[80%] p-3 rounded-2xl ${m.sender_id === me?.id ? 'ml-auto bg-coral' : 'bg-navy-light'}`}>
            <p>{m.content}</p>
            <p className="text-xs opacity-70 mt-1">{new Date(m.created_at).toLocaleTimeString()}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="p-4 border-t border-gray-700 flex gap-2">
        <input
          value={newMsg}
          onChange={e => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-3 rounded-full bg-navy-light border border-gray-600 focus:outline-none focus:border-coral"
        />
        <button type="submit" className="bg-coral px-5 rounded-full font-medium">Send</button>
      </form>
    </div>
  )
}

export default Chat
