import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'

const getMessages = () => api.get('/chat/messages').then(r => r.data)
const postMessage = (content) => api.post('/chat/messages', { content }).then(r => r.data)

function Avatar({ username, avatar }) {
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-700 shrink-0 flex items-center justify-center">
      {avatar
        ? <img src={avatar} className="w-full h-full object-cover" alt="" />
        : <span className="text-xs font-bold text-gray-400">{username.slice(0, 2).toUpperCase()}</span>
      }
    </div>
  )
}

export default function Chat() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const [text, setText] = useState('')
  const prevCountRef = useRef(0)

  const { data: messages = [] } = useQuery({
    queryKey: ['chat-messages'],
    queryFn: getMessages,
    refetchInterval: 5000,
    staleTime: 0,
  })

  useEffect(() => {
    if (messages.length > 0) {
      const lastId = messages[messages.length - 1].id
      localStorage.setItem('chat_last_read', String(lastId))
    }
  }, [messages])

  useEffect(() => {
    if (messages.length !== prevCountRef.current) {
      prevCountRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMut = useMutation({
    mutationFn: postMessage,
    onSuccess: (newMsg) => {
      qc.setQueryData(['chat-messages'], (old = []) => [...old, newMsg])
      localStorage.setItem('chat_last_read', String(newMsg.id))
      setText('')
      inputRef.current?.focus()
    },
  })

  const handleSend = (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sendMut.isPending) return
    sendMut.mutate(content)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div
      className="max-w-2xl mx-auto px-4 flex flex-col"
      style={{ height: 'calc(100svh - 8.5rem)' }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-500 text-center pt-12 text-sm">Brak wiadomości. Napisz coś!</p>
        )}
        {messages.map((msg) => {
          const isMe = msg.user_id === user?.id
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <Avatar username={msg.username} avatar={msg.avatar} />
              <div className={`flex flex-col max-w-[72%] ${isMe ? 'items-end' : 'items-start'}`}>
                {!isMe && <span className="text-xs text-gray-500 mb-0.5 ml-1">{msg.username}</span>}
                <div className={`px-3 py-2 text-sm break-words rounded-2xl ${
                  isMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-600 mt-0.5 mx-1">
                  {formatInTimeZone(new Date(msg.created_at + 'Z'), 'Europe/Warsaw', 'HH:mm')}
                </span>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="shrink-0 flex gap-2 py-3 border-t border-gray-800">
        <input
          ref={inputRef}
          className="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Napisz wiadomość..."
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={500}
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={!text.trim() || sendMut.isPending}
          className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-sm font-semibold transition"
        >
          {sendMut.isPending ? '...' : 'Wyślij'}
        </button>
      </form>
    </div>
  )
}
