import mammoth from 'mammoth'
import pdfParse from 'pdf-parse'

// helper: stream -> buffer
async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

/**
 * Download file from Supabase storage and parse into paragraphs.
 * Returns { paragraphs: [{text, speaker?}, ...], mime, text }
 */
export async function parseFileToParagraphs({ supabaseAdmin, bucket, path }) {
  // download
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path)
  if (error) {
    throw new Error('Failed to download from storage: ' + error.message)
  }

  // data might be a ReadableStream or Buffer/Blob depending on environment
  let buffer
  if (typeof data.arrayBuffer === 'function') {
    const ab = await data.arrayBuffer()
    buffer = Buffer.from(ab)
  } else if (data instanceof Buffer) {
    buffer = data
  } else {
    buffer = await streamToBuffer(data)
  }

  const lower = path.toLowerCase()
  let text = ''

  if (lower.endsWith('.txt')) {
    text = buffer.toString('utf-8')
  } else if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    try {
      const result = await mammoth.extractRawText({ buffer })
      text = String(result.value || '')
    } catch (e) {
      console.error('mammoth parse error', e)
      text = buffer.toString('utf-8')
    }
  } else if (lower.endsWith('.pdf')) {
    try {
      const pdfRes = await pdfParse(buffer)
      text = pdfRes.text || ''
    } catch (e) {
      console.error('pdf-parse error', e)
      text = buffer.toString('utf-8')
    }
  } else {
    text = buffer.toString('utf-8')
  }

  // paragraph split:
  let paragraphs = []
  if (!text) text = ''
  const parts = text.split(/\r?\n\r?\n+/).map(s => s.trim()).filter(Boolean)
  if (parts.length === 0) {
    const lines = text.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    paragraphs = lines
  } else {
    paragraphs = parts
  }

  const paras = paragraphs.map(p => ({ text: p }))

  return { paragraphs: paras, text }
}