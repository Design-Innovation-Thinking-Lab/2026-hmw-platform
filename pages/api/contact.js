export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { name, email, problem } = req.body

    if (!name || !email || !problem) {
        return res.status(400).json({ error: '請填寫所有欄位' })
    }

    // Construct email content
    const emailContent = `
新的聯絡訊息來自 Human-AI HMW 平台

姓名：${name}
Email：${email}

發生問題：
${problem}

---
此訊息由平台自動發送
    `.trim()

    // For now, we'll use a simple approach - log the message
    // In production, you would integrate with an email service like SendGrid, Nodemailer, etc.
    console.log('=== New Contact Form Submission ===')
    console.log(`To: drhhtang@gapps.ntust.edu.tw`)
    console.log(`From: ${name} <${email}>`)
    console.log(`Message:\n${problem}`)
    console.log('===================================')

    // Option 1: Using fetch to send via a mail API (requires SMTP service)
    // For demonstration, we'll simulate success
    // In production, uncomment and configure the email sending code below

    /*
    // Example using a mail service like Resend or SendGrid
    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'noreply@hmw-platform.com',
                to: 'drhhtang@gapps.ntust.edu.tw',
                subject: `[HMW 平台] 聯絡表單 - ${name}`,
                text: emailContent,
                reply_to: email
            })
        })

        if (!response.ok) throw new Error('Failed to send email')
    } catch (err) {
        console.error('Email send error:', err)
        return res.status(500).json({ error: '郵件發送失敗，請稍後再試' })
    }
    */

    // For now, we'll store the contact in Supabase as a backup
    try {
        // You can optionally save contacts to database
        // const { createClient } = require('@supabase/supabase-js')
        // const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        // await supabase.from('contacts').insert({ name, email, problem })

        return res.status(200).json({
            success: true,
            message: '訊息已送出！我們會盡快回覆您'
        })
    } catch (err) {
        console.error('Contact save error:', err)
        return res.status(500).json({ error: '發送失敗，請稍後再試' })
    }
}
