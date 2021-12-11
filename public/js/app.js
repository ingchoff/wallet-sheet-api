console.log('Client side js file is loaded!')

const weatherForm = document.querySelector('form')
const messageOne = document.querySelector('#message-1')
const messageTwo = document.querySelector('#message-2')
const _apikey = document.querySelector('#input-1')
const _secret = document.querySelector('#input-2')
const _sheetid = document.querySelector('#input-3')

weatherForm.addEventListener('submit', (e) => {
    e.preventDefault()
    messageOne.textContent = 'Loading...'
    messageTwo.textContent = ''

    fetch('/api/mywallet', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
             apiKey: _apikey.value,
            secret: _secret.value,
            spreadsheetId: _sheetid.value
        })
    }).then((res) => {
        res.json().then((data) => {
            if (data.error) {
                messageOne.textContent = data.error
            } else {
                messageOne.textContent = data.status
                messageTwo.textContent = data.description
            }
        })
    })
})