import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { getSettings } from '../api/settings'
import { usePageTitle } from '../hooks/usePageTitle'
import UserAvatar from '../components/UserAvatar'

export default function Chat() {
  usePageTitle('Chat')
  const { user } = useAuth()
  const qc = useQueryClient()
  const bottomRef = useRef(null)
  const separatorRef = useRef(null)
  const inputRef = useRef(null)
  const [text, setText] = useState('')
  const [selectedLeagueId, setSelectedLeagueId] = useState(null)
  const prevCountRef = useRef(0)
  const hasScrolledInitially = useRef(false)
  const lastTypingSentRef = useRef(0)

  const initialLastReadId = useRef(
    parseInt(localStorage.getItem('chat_last_read') || '0')
  )

  const { data: settings } = useQuery({
    queryKey: ['game-settings'],
    queryFn: getSettings,
  })

  const { data: allLeagues = [] } = useQuery({
    queryKey: ['admin-leagues'],
    queryFn: () => api.get('/admin/leagues').then(r => r.data),
    enabled: !!user?.is_admin,
  })

  const { data: myLeagues = [] } = useQuery({
    queryKey: ['my-leagues'],
    queryFn: () => api.get('/leagues/me').then(r => r.data),
    enabled: !user?.is_admin,
  })

  const effectiveLeagueId = user?.is_admin ? selectedLeagueId : (myLeagues[0]?.id ?? null)

  const messagesKey = ['chat-messages', effectiveLeagueId ?? 'null']

  const { data: messages = [] } = useQuery({
    queryKey: messagesKey,
    queryFn: () => {
      const params = effectiveLeagueId !== null ? `?league_id=${effectiveLeagueId}` : ''
      return api.get(`/chat/messages${params}`).then(r => r.data)
    },
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: 0,
  })

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const base = import.meta.env.VITE_WS_URL || 'ws://localhost:8000'
    const leagueParam = effectiveLeagueId !== null ? `&league_id=${effectiveLeagueId}` : ''
    const url = `${base}/api/chat/ws?token=${token}${leagueParam}`

    let ws
    let closed = false

    const connect = () => {
      ws = new WebSocket(url)

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data)
        qc.setQueryData(messagesKey, (old = []) =>
          old.some(m => m.id === msg.id) ? old : [...old, msg]
        )
      }

      ws.onclose = () => {
        if (!closed) setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()
    return () => {
      closed = true
      ws?.close()
    }
  }, [effectiveLeagueId])

  const typingParams = effectiveLeagueId !== null ? `?league_id=${effectiveLeagueId}` : ''
  const { data: typingUsers = [] } = useQuery({
    queryKey: ['chat-typing', effectiveLeagueId ?? 'null'],
    queryFn: () => api.get(`/chat/typing${typingParams}`).then(r => r.data),
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  })

  const sendTyping = useCallback(() => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 3000) return
    lastTypingSentRef.current = now
    api.post(`/chat/typing${typingParams}`).catch(() => {})
  }, [typingParams])

  useEffect(() => {
    hasScrolledInitially.current = false
    prevCountRef.current = 0
  }, [effectiveLeagueId])

  useEffect(() => {
    if (messages.length > 0) {
      const lastId = messages[messages.length - 1].id
      localStorage.setItem('chat_last_read', String(lastId))
    }
  }, [messages])

  useEffect(() => {
    if (messages.length === 0) return
    if (!hasScrolledInitially.current) {
      hasScrolledInitially.current = true
      prevCountRef.current = messages.length
      if (separatorRef.current) {
        separatorRef.current.scrollIntoView({ behavior: 'instant' })
      } else {
        bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      }
      return
    }
    if (messages.length !== prevCountRef.current) {
      prevCountRef.current = messages.length
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMut = useMutation({
    mutationFn: (content) => api.post('/chat/messages', {
      content,
      ...(user?.is_admin && effectiveLeagueId !== null ? { league_id: effectiveLeagueId } : {}),
    }).then(r => r.data),
    onSuccess: (newMsg) => {
      qc.setQueryData(messagesKey, (old = []) =>
        old.some(m => m.id === newMsg.id) ? old : [...old, newMsg]
      )
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

  const firstUnreadIdx = initialLastReadId.current > 0
    ? messages.findIndex(m => m.id > initialLastReadId.current && m.user_id !== user?.id)
    : -1

  const chatDisabled = settings?.chat_enabled === false

  return (
    <div className="max-w-2xl mx-auto px-4 flex flex-col h-full">

      {user?.is_admin && allLeagues.length > 0 && (
        <div className="shrink-0 flex gap-2 overflow-x-auto py-2 border-b border-gray-800">
          {allLeagues.map(l => (
            <button
              key={l.id}
              onClick={() => setSelectedLeagueId(l.id)}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-mono font-medium transition ${selectedLeagueId === l.id ? 'bg-brand-500 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
            >
              {l.invite_code}
            </button>
          ))}
        </div>
      )}

      {chatDisabled && !user?.is_admin ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Czat jest wyłączony</div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3 scrollbar-hide">
            {messages.length === 0 && (
              <p className="text-gray-500 text-center pt-12 text-sm">
                {user?.is_admin && selectedLeagueId === null ? 'Wybierz ligę powyżej' : 'Brak wiadomości. Napisz coś!'}
              </p>
            )}
            {messages.map((msg, idx) => {
              const isMe = msg.user_id === user?.id
              return (
                <React.Fragment key={msg.id}>
                  {idx === firstUnreadIdx && (
                    <div ref={separatorRef} className="flex items-center gap-3 py-1">
                      <div className="flex-1 h-px bg-gray-700" />
                      <span className="text-xs text-gray-600 shrink-0 px-1">Nowe wiadomości</span>
                      <div className="flex-1 h-px bg-gray-700" />
                    </div>
                  )}
                  <div className={`flex items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                    <UserAvatar username={msg.username} avatar={msg.avatar} className="w-7 h-7" />
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
                </React.Fragment>
              )
            })}
            <div ref={bottomRef} />
          </div>

          {typingUsers.length > 0 && (
            <p className="shrink-0 text-xs text-gray-500 pb-1">
              {typingUsers.length === 1
                ? `${typingUsers[0]} pisze...`
                : `${typingUsers.slice(0, -1).join(', ')} i ${typingUsers.at(-1)} piszą...`}
            </p>
          )}

          <form onSubmit={handleSend} className="shrink-0 flex gap-2 py-3 border-t border-gray-800">
            <input
              ref={inputRef}
              className="flex-1 bg-gray-800 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand-500"
              placeholder={user?.is_admin && selectedLeagueId === null ? 'Wybierz ligę...' : 'Napisz wiadomość...'}
              value={text}
              onChange={e => { setText(e.target.value); sendTyping() }}
              onKeyDown={handleKeyDown}
              maxLength={500}
              autoComplete="off"
              disabled={user?.is_admin && selectedLeagueId === null}
            />
            <button
              type="submit"
              disabled={!text.trim() || sendMut.isPending || (user?.is_admin && selectedLeagueId === null)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 disabled:opacity-40 rounded-xl text-sm font-semibold transition"
            >
              {sendMut.isPending ? '...' : 'Wyślij'}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
