import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function TranscriptsList({ projectId, fileId }) {
  const [transcripts, setTranscripts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (fileId) fetchTranscripts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId])

  async function fetchTranscripts() {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select('id, speaker, content, start_time, end_time, created_at')
        .eq('file_id', fileId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setTranscripts(data || [])
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to load transcripts')
    } finally {
      setLoading(false)
    }
  }

  if (!fileId) return null

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Parsed transcripts</h3>
      {loading && <div>Loading transcripts...</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}
      <div style={{ marginTop: 8 }}>
        {transcripts.length === 0 ? (
          <div style={{ color: '#666' }}>No transcripts parsed yet for this file.</div>
        ) : (
          transcripts.map(t => <TranscriptItem key={t.id} t={t} />)
        )}
      </div>
    </div>
  )
}

function TranscriptItem({ t }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div
      style={{
        borderTop: '1px solid #f0f0f0',
        paddingTop: 8,
        paddingBottom: 8
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, color: '#333' }}>
            {t.speaker ? <strong>{t.speaker}</strong> : <strong>Excerpt</strong>}
            <span style={{ marginLeft: 8, color: '#888', fontSize: 12 }}>
              {t.start_time ? ` ${t.start_time}s` : ''} {t.end_time ? `- ${t.end_time}s` : ''}
            </span>
          </div>
          <div style={{ marginTop: 6, color: '#444' }}>
            {expanded ? t.content : truncate(t.content, 240)}
          </div>
        </div>
        <div>
          <button onClick={() => setExpanded(e => !e)} style={{ marginLeft: 8 }}>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </div>
      </div>
    </div>
  )
}

function truncate(s, n) {
  if (!s) return ''
  return s.length > n ? s.slice(0, n) + '…' : s
}