import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import TranscriptsList from '../components/TranscriptsList'

export default function FilesPage() {
  const [projectId, setProjectId] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const bucket = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'uploads'

  async function fetchFiles() {
    setError(null)
    if (!projectId) {
      setError('Please enter a projectId')
      return
    }
    setLoading(true)
    try {
      const { data, error: fetchErr } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })

      if (fetchErr) throw fetchErr
      // enrich each file with a publicUrl if bucket and storage_path exist
      const enriched = (data || []).map(f => {
        let publicUrl = null
        try {
          const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(f.storage_path)
          publicUrl = urlData?.publicUrl ?? null
        } catch (e) {
          publicUrl = null
        }
        return { ...f, publicUrl }
      })
      setFiles(enriched)
    } catch (err) {
      console.error(err)
      setError(err.message || 'Failed to fetch files')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ padding: 20, fontFamily: 'system-ui, Arial' }}>
      <h1>Uploaded files & parsed transcripts</h1>

      <div style={{ marginBottom: 12 }}>
        <label>
          Project ID:{' '}
          <input
            value={projectId}
            onChange={e => setProjectId(e.target.value)}
            placeholder="paste project id here"
            style={{ width: 420 }}
          />
        </label>
        <button onClick={fetchFiles} style={{ marginLeft: 12 }}>
          Load files
        </button>
      </div>

      {loading && <div>Loading...</div>}
      {error && <div style={{ color: 'crimson' }}>{error}</div>}

      <div style={{ marginTop: 16 }}>
        {files.length === 0 && !loading ? (
          <div>No files found for this project.</div>
        ) : (
          files.map(f => (
            <FileCard key={f.id} file={f} projectId={projectId} />
          ))
        )}
      </div>
    </main>
  )
}

function FileCard({ file, projectId }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        border: '1px solid #e2e2e2',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        background: '#fff'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 600 }}>{file.filename}</div>
          <div style={{ color: '#666', fontSize: 13 }}>
            uploaded: {new Date(file.created_at).toLocaleString()}
          </div>
          <div style={{ marginTop: 6 }}>
            Storage path: <code style={{ background: '#f7f7f7', padding: 4 }}>{file.storage_path}</code>
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          {file.publicUrl ? (
            <a href={file.publicUrl} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>
              Open file
            </a>
          ) : (
            <span style={{ color: '#999', marginRight: 8 }}>No public URL</span>
          )}
          <button onClick={() => setOpen(prev => !prev)}>{open ? 'Hide transcripts' : 'Show transcripts'}</button>
        </div>
      </div>

      {open && (
        <div style={{ marginTop: 12 }}>
          <TranscriptsList projectId={projectId} fileId={file.id} />
        </div>
      )}
    </div>
  )
}