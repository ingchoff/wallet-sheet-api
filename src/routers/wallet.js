const express = require('express');
const crypto = require('crypto');
const axios = require('axios').default;
const router = new express.Router();
const auth = require('../middleware/googleauth');
const moment = require('moment');

router.get('/', async (req, res) => {
  res.render('index', {
    title: 'MY Bitkub-API',
    name: 'Ing',
  });
});

router.post('/api/mywallet', auth, async (req, res) => {
  const ts = await axios.get('https://api.bitkub.com/api/v3/servertime');
  const data = `${ts.data}POST/api/v3/market/wallet{}`;
  const hex = crypto
    .createHmac('sha256', req.body.secret)
    .update(data)
    .digest('hex');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-BTK-APIKEY': req.body.apiKey,
    'X-BTK-TIMESTAMP': ts.data,
    'X-BTK-SIGN': hex,
  };
  try {
    const wallet = await axios.post(
      'https://api.bitkub.com/api/v3/market/wallet',
      {},
      {
        headers: headers,
      }
    );
    const balance = wallet.data.result;
    let values = [['Currency', 'Amount', 'Mkt_price', 'Baht']];
    const spreadsheetId = req.body.spreadsheetId;
    const asArray = Object.entries(balance).sort();
    // const filtered = asArray.filter(([key, value]) => value !== 0);
    const ticker = await axios.get('https://api.bitkub.com/api/market/ticker');
    const tickerData = ticker.data;
    let newObjTicker = {};
    Object.keys(tickerData).forEach((key) => {
      const currency = key.split('_');
      newObjTicker[currency[1]] = tickerData[key];
    });
    asArray.forEach((data) => {
      if (!newObjTicker[data[0]]) {
        let rowData = [data[0], data[1], '', data[1]];
        values.push(rowData);
      } else {
        let rowData = [
          data[0],
          data[1],
          newObjTicker[data[0]].last,
          data[1] * newObjTicker[data[0]].last,
        ];
        values.push(rowData);
      }
    });
    try {
      const updatedRow = await req.googlesheet.spreadsheets.values.update({
        auth: req.auth,
        spreadsheetId,
        range: 'api!A:D',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values,
        },
      });
      const _sheetId = updatedRow.data.spreadsheetId;
      res.send({
        status: 'sheet updated!',
        description: `Your sheet url: https://docs.google.com/spreadsheets/d/${_sheetId}`,
      });
    } catch (e) {
      res.status(500).send({ error: 'Cannot updated' });
    }
  } catch (e) {
    res.status(400).send({
      error: 'Please, provide Apikey, Secret, Google Sheet ID',
      msg: e,
    });
  }
});

router.post('/api/mywallet/transaction', auth, async (req, res) => {
  const totalData = [];
  const date = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDay();
  let start = new Date(year, month - 1, day).getTime();
  const ts = await axios.get('https://api.bitkub.com/api/v3/servertime');
  let end = ts.data;
  if (req.body.start && req.body.end) {
    start = moment(req.body.start, 'YYYY/MM/DD').format('x');
    end = moment(req.body.end, 'YYYY/MM/DD').add(1, 'days').format('x');
  }
  const data = `${ts.data}POST/api/v3/market/wallet{}`;
  const hex = crypto
    .createHmac('sha256', req.body.secret)
    .update(data)
    .digest('hex');
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-BTK-APIKEY': req.body.apiKey,
    'X-BTK-TIMESTAMP': ts.data,
    'X-BTK-SIGN': hex,
  };
  const currentBalance = await axios.post(
    'https://api.bitkub.com/api/v3/market/wallet',
    {},
    {
      headers: headers,
    }
  );
  const spreadsheetId = req.body.spreadsheetId;
  const filtered = [];
  const dataBalance = currentBalance.data.result;
  Object.keys(dataBalance).forEach((currency) => {
    if (dataBalance[currency] !== 0 && currency !== 'THB') {
      filtered.push(currency);
    }
  });
  filtered.push('BTC', 'ETH', 'ADA', 'BCH', 'BNB', 'BAND', 'NEAR', 'XRP');
  try {
    await req.googlesheet.spreadsheets.values.clear({
      auth: req.auth,
      spreadsheetId,
      range: `api!A:G`,
    });
  } catch (e) {
    res.status(400).send({ error: 'spreadsheetId incorrect' });
  }
  try {
    await req.googlesheet.spreadsheets.values.update({
      auth: req.auth,
      spreadsheetId,
      range: `api!A:G`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [
          [
            'Date',
            'Amount',
            'Currency',
            'Ending Balance',
            'Type',
            'Description',
            'TXID',
          ],
        ],
      },
    });
  } catch (e) {
    res.status(400).send({ error: 'spreadsheetId incorrect' });
  }
  let sindex = 0;
  let eindex = 1;
  const sorted = filtered.sort();
  for (let i in sorted) {
    let values = [];
    const sym = `${sorted[i]}_THB`;
    const sig = `${ts.data}GET/api/v3/market/my-order-history?sym=${sym}&start=${start}&end=${end}`;
    const hexTrans = crypto
      .createHmac('sha256', req.body.secret)
      .update(sig)
      .digest('hex');
    const transaction = await axios.get(
      `https://api.bitkub.com/api/v3/market/my-order-history?sym=${sym}&start=${start}&end=${end}`,
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-BTK-APIKEY': req.body.apiKey,
          'X-BTK-TIMESTAMP': ts.data,
          'X-BTK-SIGN': hexTrans,
        },
      }
    );
    const arrayData = transaction.data.result;
    totalData.push(arrayData);
    for (let x in arrayData) {
      if (arrayData) {
        let description = `${arrayData[x].side} ${arrayData[x].amount} ${sorted[i]} @ ${arrayData[x].rate}`;
        if (arrayData[x].side === 'sell') {
          values.push([
            moment(arrayData[x].ts).format('D/MM/YYYY kk:mm:ss'),
            -arrayData[x].amount,
            sorted[i],
            0,
            arrayData[x].side,
            description,
            arrayData[x].txn_id,
          ]);
        } else {
          values.push([
            moment(arrayData[x].ts).format('D/MM/YYYY kk:mm:ss'),
            arrayData[x].amount,
            sorted[i],
            0,
            arrayData[x].side,
            description,
            arrayData[x].txn_id,
          ]);
        }
      }
    }
    // console.log(values.length);
    sindex = eindex + 1;
    eindex += values.length;
    // console.log(sindex + ' : ' + eindex);
    try {
      await req.googlesheet.spreadsheets.values.update({
        auth: req.auth,
        spreadsheetId,
        range: `api!A${sindex}:G${eindex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values,
        },
      });
    } catch (e) {
      res.status(400).send({ error: 'spreadsheetId incorrect' });
    }
  }
  const _sheetId = spreadsheetId;
  res.send({
    status: 'sheet updated!',
    description: `Your sheet url: https://docs.google.com/spreadsheets/d/${_sheetId}`,
    data: totalData,
  });
});

module.exports = router;
