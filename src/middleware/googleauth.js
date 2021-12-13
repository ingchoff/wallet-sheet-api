const { google } = require('googleapis')
const { GoogleAuth } = require('google-auth-library')

const sheet_auth = async (req, res, next) => {
    const auth = new GoogleAuth({
        // keyFile: 'credentials.json',
        credentials: {
            client_email: process.env.GOOGLE_EMAIL,
            private_key: process.env.GOOGLE_KEY.replace(/\\n/g, '\n')
        },
        scopes: 'https://www.googleapis.com/auth/spreadsheets'
    })
    const client = auth.getClient()
    const googleSheets = google.sheets({
        version: "v4",
        auth: client
    })
    req.auth = auth
    req.googlesheet = googleSheets
    next()
}

module.exports = sheet_auth