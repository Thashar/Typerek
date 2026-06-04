import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { formatInTimeZone } from 'date-fns-tz'
import { useAuth } from '../context/AuthContext'
import api from '../api/client'
import { getSettings } from '../api/settings'
import { usePageTitle } from '../hooks/usePageTitle'
import UserAvatar from '../components/UserAvatar'

const lastReadKey = (leagueId) => leagueId != null ? `chat_last_read_${leagueId}` : 'chat_last_read'

const updateLastRead = (leagueId, msgId) => {
  localStorage.setItem(lastReadKey(leagueId), String(msgId))
  localStorage.setItem('chat_last_read', String(msgId))
}

export default function Chat() {
  usePageTitle('Chat')
  const { user } = useAuth()
  const scrollRef = useRef(null)
  const bottomRef = useRef(null)
  const separatorRef = useRef(null)
  const inputRef = useRef(null)
  const [text, setText] = useState('')
  const [selectedLeagueId] = useState(() => {
    const saved = localStorage.getItem('chat_last_league')
    return saved ? parseInt(saved) : null
  })
  const lastTypingSentRef = useRef(0)

  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const oldestIdRef = useRef(null)
  const latestIdRef = useRef(0)
  const prevScrollHeightRef = useRef(0)
  const preserveScrollRef = useRef(false)
  const initialScrollDoneRef = useRef(false)
  const initialLastReadId = useRef(0)

  const { data: settings } = useQuery({ queryKey: ['game-settings'], queryFn: getSettings })

  const { data: myLeagues = [] } = useQuery({
    queryKey: ['my-leagues'],
    queryFn: () => api.get('/leagues/me').then(r => r.data),
    enabled: !user?.is_admin,
  })

  const effectiveLeagueId = user?.is_admin ? selectedLeagueId : (myLeagues[0]?.id ?? null)

  const leagueParams = (extra = {}) => {
    const p = { limit: 10, ...extra }
    if (effectiveLeagueId !== null) p.league_id = effectiveLeagueId
    return p
  }

  const loadInitial = useCallback(async () => {
    initialLastReadId.current = parseInt(localStorage.getItem(lastReadKey(effectiveLeagueId)) || '0')
    initialScrollDoneRef.current = false
    oldestIdRef.current = null
    latestIdRef.current = 0
    setHasMore(true)
    setMessages([])
    try {
      const res = await api.get('/chat/messages', { params: leagueParams() })
      const msgs = res.data
      setMessages(msgs)
      setHasMore(msgs.length === 10)
      if (msgs.length > 0) {
        oldestIdRef.current = msgs[0].id
        latestIdRef.current = msgs[msgs.length - 1].id
        updateLastRead(effectiveLeagueId, msgs[msgs.length - 1].id)
      }
    } catch {}
  }, [effectiveLeagueId])

  useEffect(() => { loadInitial() }, [loadInitial])

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || oldestIdRef.current === null) return
    setLoadingMore(true)
    preserveScrollRef.current = true
    prevScrollHeightRef.current = scrollRef.current?.scrollHeight ?? 0
    try {
      const res = await api.get('/chat/messages', { params: leagueParams({ before_id: oldestIdRef.current }) })
      const older = res.data
      setMessages(prev => [...older, ...prev])
      setHasMore(older.length === 10)
      if (older.length > 0) oldestIdRef.current = older[0].id
    } catch {}
    setLoadingMore(false)
  }, [hasMore, loadingMore, effectiveLeagueId])

  useLayoutEffect(() => {
    if (preserveScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevScrollHeightRef.current
      preserveScrollRef.current = false
    }
  }, [messages])

  useEffect(() => {
    if (messages.length === 0 || initialScrollDoneRef.current || preserveScrollRef.current) return
    initialScrollDoneRef.current = true
    if (separatorRef.current) {
      separatorRef.current.scrollIntoView({ behavior: 'instant' })
    } else {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' })
    }
  }, [messages])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      if (container.scrollTop < 80 && !loadingMore) loadMore()
    }
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [loadMore])

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
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          latestIdRef.current = Math.max(latestIdRef.current, msg.id)
          updateLastRead(effectiveLeagueId, msg.id)
          return [...prev, msg]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      }
      ws.onclose = () => { if (!closed) setTimeout(connect, 3000) }
      ws.onerror = () => ws.close()
    }
    connect()
    return () => { closed = true; ws?.close() }
  }, [effectiveLeagueId])

  useEffect(() => {
    const poll = async () => {
      if (!latestIdRef.current) return
      try {
        const res = await api.get('/chat/messages', { params: leagueParams({ after_id: latestIdRef.current, limit: 50 }) })
        const newMsgs = res.data
        if (!newMsgs.length) return
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id))
          const toAdd = newMsgs.filter(m => !ids.has(m.id))
          if (!toAdd.length) return prev
          latestIdRef.current = Math.max(latestIdRef.current, ...toAdd.map(m => m.id))
          return [...prev, ...toAdd]
        })
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      } catch {}
    }
    let id = null
    const start = () => { id = setInterval(poll, 30000) }
    const stop = () => { clearInterval(id); id = null }
    const onVisibility = () => { if (document.hidden) stop(); else { poll(); start() } }
    start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
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

  const sendMut = useMutation({
    mutationFn: (content) => api.post('/chat/messages', {
      content,
      ...(user?.is_admin && effectiveLeagueId !== null ? { league_id: effectiveLeagueId } : {}),
    }).then(r => r.data),
    onSuccess: (newMsg) => {
      setMessages(prev =>
        prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]
      )
      latestIdRef.current = Math.max(latestIdRef.current, newMsg.id)
      updateLastRead(effectiveLeagueId, newMsg.id)
      setText('')
      inputRef.current?.focus()
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    },
  })

  const handleSend = (e) => {
    e.preventDefault()
    const content = text.trim()
    if (!content || sendMut.isPending) return
    sendMut.mutate(content)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e) }
  }

  const firstUnreadIdx = initialLastReadId.current > 0
    ? messages.findIndex(m => m.id > initialLastReadId.current && m.user_id !== user?.id)
    : -1

  const chatDisabled = settings?.chat_enabled === false

  return (
    <div className="max-w-2xl mx-auto px-4 flex flex-col h-full">
      {chatDisabled && !user?.is_admin ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">Czat jest wyłączony</div>
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto py-4 space-y-3 scrollbar-hide">
            {loadingMore && (
              <p className="text-center text-xs text-gray-600 py-2">Ładowanie...</p>
            )}
            {!hasMore && messages.length > 0 && (
              <p className="text-center text-xs text-gray-700 py-2">Początek historii</p>
            )}
            {messages.length === 0 && !loadingMore && (
              <p className="text-gray-500 text-center pt-12 text-sm">
                {user?.is_admin && selectedLeagueId === null ? 'Wybierz ligę w panelu admina' : 'Brak wiadomości. Napisz coś!'}
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
              placeholder={user?.is_admin && selectedLeagueId === null ? 'Wybierz ligę w panelu admina...' : 'Napisz wiadomość...'}
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
