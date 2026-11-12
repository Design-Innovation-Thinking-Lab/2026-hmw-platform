import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false }
})

// Generate random 8-digit room code
function generateRoomCode() {
    return Math.random().toString().slice(2, 10).padEnd(8, '0')
}

export default async function handler(req, res) {
    const { method } = req

    // GET: Get room by code or list user's rooms
    if (method === 'GET') {
        const { code, userId } = req.query

        try {
            if (code) {
                // Get single room by code
                const { data, error } = await supabaseAdmin
                    .from('research_rooms')
                    .select('*, users(name)')
                    .eq('room_code', code)
                    .single()

                if (error) throw error
                return res.status(200).json({ room: data })
            }

            if (userId) {
                // Get rooms user is a member of
                const { data: memberRooms, error: memberError } = await supabaseAdmin
                    .from('room_members')
                    .select(`
                        role,
                        research_rooms(*, users(name))
                    `)
                    .eq('user_id', userId)

                if (memberError) throw memberError

                // Get member counts for each room
                const roomIds = memberRooms.map(m => m.research_rooms?.id).filter(Boolean)
                const { data: memberCounts } = await supabaseAdmin
                    .from('room_members')
                    .select('room_id')
                    .in('room_id', roomIds)

                // Count members per room
                const countMap = {}
                memberCounts?.forEach(m => {
                    countMap[m.room_id] = (countMap[m.room_id] || 0) + 1
                })

                const rooms = memberRooms.map(m => ({
                    ...m.research_rooms,
                    userRole: m.role,
                    member_count: countMap[m.research_rooms?.id] || 1
                }))

                return res.status(200).json({ rooms })
            }

            return res.status(400).json({ error: 'Missing code or userId' })
        } catch (err) {
            console.error('Error fetching room:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    // POST: Create room or join room
    if (method === 'POST') {
        const { action, ...data } = req.body

        try {
            // Create new room
            if (action === 'create') {
                const {
                    name,
                    research_topic,
                    research_purpose,
                    team_size,
                    min_votes,
                    max_votes,
                    creator_id,
                    project_id
                } = data

                if (!name || !research_topic || !research_purpose || !creator_id) {
                    return res.status(400).json({ error: '請填寫所有必填欄位' })
                }

                // Generate unique room code
                let roomCode = generateRoomCode()
                let attempts = 0
                while (attempts < 10) {
                    const { data: existing } = await supabaseAdmin
                        .from('research_rooms')
                        .select('id')
                        .eq('room_code', roomCode)
                        .single()

                    if (!existing) break
                    roomCode = generateRoomCode()
                    attempts++
                }

                // Create the room
                // If no project_id provided, try to get the default project
                let finalProjectId = project_id || null
                if (!finalProjectId) {
                    const { data: defaultProjects } = await supabaseAdmin
                        .from('projects')
                        .select('id')
                        .eq('is_default', true)
                        .limit(1)

                    if (defaultProjects && defaultProjects.length > 0) {
                        finalProjectId = defaultProjects[0].id
                    }
                }

                const { data: room, error: roomError } = await supabaseAdmin
                    .from('research_rooms')
                    .insert({
                        room_code: roomCode,
                        project_id: finalProjectId,
                        creator_id,
                        name,
                        research_topic,
                        research_purpose,
                        team_size: team_size || 1,
                        min_votes: min_votes || 1,
                        max_votes: max_votes || 3,
                        status: 'active'
                    })
                    .select()
                    .single()

                if (roomError) throw roomError

                // Add creator as member
                const { error: memberError } = await supabaseAdmin
                    .from('room_members')
                    .insert({
                        room_id: room.id,
                        user_id: creator_id,
                        role: 'creator'
                    })

                if (memberError) throw memberError

                return res.status(200).json({ success: true, room })
            }

            // Join existing room
            if (action === 'join') {
                const { room_code, user_id } = data

                if (!room_code || !user_id) {
                    return res.status(400).json({ error: '請輸入房間代碼' })
                }

                // Find room
                const { data: room, error: roomError } = await supabaseAdmin
                    .from('research_rooms')
                    .select('id, name, room_code, research_topic, research_purpose, team_size, status, analysis_status, created_at')
                    .eq('room_code', room_code)
                    .single()

                if (roomError || !room) {
                    return res.status(404).json({ error: '找不到此房間代碼' })
                }

                // Check if already a member
                const { data: existing } = await supabaseAdmin
                    .from('room_members')
                    .select('id')
                    .eq('room_id', room.id)
                    .eq('user_id', user_id)
                    .single()

                if (existing) {
                    return res.status(200).json({ success: true, room, message: '已加入房間' })
                }

                // Add as member
                const { error: joinError } = await supabaseAdmin
                    .from('room_members')
                    .insert({
                        room_id: room.id,
                        user_id,
                        role: 'member'
                    })

                if (joinError) throw joinError

                return res.status(200).json({ success: true, room })
            }

            return res.status(400).json({ error: 'Invalid action' })
        } catch (err) {
            console.error('Room operation error:', err)
            return res.status(500).json({ error: err.message })
        }
    }

    return res.status(405).json({ error: 'Method not allowed' })
}
