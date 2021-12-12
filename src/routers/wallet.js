const express = require('express')
const crypto = require('crypto')
const axios = require('axios').default
const { google } = require('googleapis')
const { GoogleAuth } = require('google-auth-library')
const router = new express.Router()

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

router.get('/', async (req, res) => {
    res.render('index', {
        title: 'MY Bitkub-API',
        name: 'Ing'
    })
})

router.post('/api/mywallet', async (req, res) => {
    const ts = Date.now()
    const data = {
        ts,
    }
    const dataEncode = JSON.stringify(data)
    const hex = crypto.createHmac('sha256', req.body.secret).update(dataEncode).digest('hex')
    
    try {
        const wallet = await axios.post('https://api.bitkub.com/api/market/wallet',
        {
            ts,
            sig: hex
        }
        , {
            headers: {
                "x-btk-apikey": req.body.apiKey
            }
        })
        const balance = wallet.data.result
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
            const _sheetId = updatedRow.data.spreadsheetId
            res.send({
                status: 'sheet updated!',
                description: `Your sheet url: https://docs.google.com/spreadsheets/d/${_sheetId}`
            })
        } catch (e) {
            res.status(500).send({ error: 'Cannot updated' })
        }
    } catch (e) {
        res.status(400).send({ error: 'Please, provide Apikey, Secret, Google Sheet ID' })
    }
})

router.post('/api/mywallet/transaction', async (req, res) => {
    const ts = Date.now()
    const date = new Date()
    const year = date.getFullYear()
    const month = date.getMonth()
    const day = date.getDay()
    const start = new Date(year, month-1, day).getTime()/1000
    const bodyBalance = {
        ts
    }
    const hexBalance = crypto.createHmac('sha256', req.body.secret).update(JSON.stringify(bodyBalance)).digest('hex')
    try {
        const currentBalance = await axios.post('https://api.bitkub.com/api/market/wallet', {
            ts,
            sig: hexBalance
        }
        , {
            headers: {
                "x-btk-apikey": req.body.apiKey
            }
        })
        const spreadsheetId = req.body.spreadsheetId
        const filtered = []
        const dataBalance = currentBalance.data.result
        Object.keys(dataBalance).forEach((currency) => {
            if (dataBalance[currency] !== 0 && currency !== 'THB') {
                filtered.push(currency)
            }
        })
        try {
            await googleSheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: `api!A:G`,
            valueInputOption: "USER_ENTERED",
            resource: {
                    values: [['Date', 'Amount', 'Currency', 'Ending Balance', 'Type', 'Description', 'TXID']]
                }
            })
        } catch (e) {
            res.status(400).send({ error: 'spreadsheetId incorrect' })
        }
        let sindex = 0
        let eindex = 1
        const sorted = filtered.sort()
        sorted.forEach(async (currency) => {
            let values = []
            const sym = `THB_${currency}`
            const bodyTrans = {
                ts,
                sym,
                start,
                end: ts
            }
            const hexTrans = crypto.createHmac('sha256', req.body.secret).update(JSON.stringify(bodyTrans)).digest('hex')
            const transaction = await axios.post('https://api.bitkub.com/api/market/my-order-history', {
                ts: ts,
                sym,
                start,
                end: ts,
                sig: hexTrans
            }
            , {
                headers: {
                    "x-btk-apikey": req.body.apiKey
                }
            })
            const arrayData = transaction.data.result
            arrayData.forEach((data) => {
                let description = `${data.side} ${data.amount} ${currency} @ ${data.rate}`
                values.push([data.date, data.amount, currency, 0, data.side, description, data.txn_id])
            })
            console.log(values.length)
            sindex = eindex + 1
            eindex += values.length
            console.log(sindex + ' : ' + eindex)
            try {
                await googleSheets.spreadsheets.values.update({
                auth,
                spreadsheetId,
                range: `api!A${sindex}:G${eindex}`,
                valueInputOption: "USER_ENTERED",
                resource: {
                        values
                    }
                })
            } catch (e) {
                res.status(400).send({ error: 'spreadsheetId incorrect' })
            }
        })
        const _sheetId = spreadsheetId
        res.send({
            status: 'sheet updated!',
            description: `Your sheet url: https://docs.google.com/spreadsheets/d/${_sheetId}`
        })
    } catch (e) {
        res.status(403).send({ error: 'apikey or secretkey  incorrect' })
    }
})

module.exports = router