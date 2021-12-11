const express = require('express')
const crypto = require('crypto')
const axios = require('axios').default
const { google } = require('googleapis')
const { GoogleAuth } = require('google-auth-library')
const router = new express.Router()

const auth = new GoogleAuth({
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

router.get('/', async (req, res) => {
    res.render('index', {
        title: 'MY Bitkub-API',
        name: 'Ing'
    })
})

router.post('/mywallet', async (req, res) => {
    const ts = Date.now()
    const data = {
        ts,
    }
    const dataEncode = JSON.stringify(data)
    const hex = crypto.createHmac('sha256', req.body.secret).update(dataEncode).digest('hex')
    
    try {
        const wallet = await axios.post('https://api.bitkub.com/api/market/wallet',
        {
            ts: ts,
            sig: hex
        }
        , {
            headers: {
                "x-btk-apikey": req.body.apiKey
            }
        })
        const balance = wallet.data.result
        // const rowData = await googleSheets.spreadsheets.values.get({
        //     auth,
        //     spreadsheetId,
        //     range: 'Sheet1!A:D'
        // })
        let values = [['Currency', 'Amount', 'Mkt_price', 'Baht']]
        const spreadsheetId = req.body.spreadsheetId
        const asArray = Object.entries(balance)
        const filtered = asArray.filter(([key, value]) => value !== 0)
        const ticker = await axios.get('https://api.bitkub.com/api/market/ticker')
        const tickerData = ticker.data
        let newObjTicker = {}
        Object.keys(tickerData).forEach((key) => {
            const currency = key.split('_')
            newObjTicker[currency[1]] = tickerData[key]
        })
        // console.log(filtered)
        filtered.forEach((data) => {
            if (data[0] === 'THB') {
                let rowData = [data[0], data[1], '', data[1]]
                values.push(rowData)
            } else {
                let rowData = [data[0], data[1], newObjTicker[data[0]].last, data[1]*newObjTicker[data[0]].last]
                values.push(rowData)
            }
            
        })
        try {
            const updatedRow = await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: "api!A:D",
            valueInputOption: "USER_ENTERED",
            resource: {
                    values
                }
            })
            res.send(updatedRow.data)
        } catch (e) {
            res.status(500).send({ error: 'Cannot updated' })
        }
    } catch (e) {
        res.status(400).send({ error: 'Please, provide Apikey, Secret, Google Sheet ID' })
    }
})

// router.post('/mywallet/history', async (req, res) => {
//     const ts = Date.now()
//     const data = {
//         ts,
//     }
//     const dataEncode = JSON.stringify(data)
//     const hex = crypto.createHmac('sha256', req.body.sec).update(dataEncode).digest('hex')
//     console.log(hex)
//     const wallet = await axios.post('https://api.bitkub.com/api/market/my-order-history',
//     {
//         ts: ts,
//         sig: hex
//     }
//     , {
//         headers: {
//             "x-btk-apikey": req.body.apiKey
//         }
//     })
//     res.send(wallet.data)
// })

// router.post('/mywallet/history/:currency', async (req, res) => {
//     const ts = Date.now()
//     const _currency = req.params.currency
//     const data = {
//         ts,
//         sym: _currency
//     }
//     const dataEncode = JSON.stringify(data)
//     const hex = crypto.createHmac('sha256', req.body.sec).update(dataEncode).digest('hex')
//     console.log(hex)
//     const wallet = await axios.post('https://api.bitkub.com/api/market/my-order-history',
//     {
//         ts: ts,
//         sym: _currency,
//         sig: hex
//     }
//     , {
//         headers: {
//             "x-btk-apikey": req.body.apiKey
//         }
//     })
//     res.send(wallet.data)
// })

module.exports = router