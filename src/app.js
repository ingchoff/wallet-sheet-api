const path = require('path')
const express = require('express')
const hbs = require('hbs')
const walletRouter = require('./routers/wallet')
const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.listen(port, () => {
    console.log('Server is up on port ' + port)
})

// Define paths for Express config
const publicDirPath = path.join(__dirname, '../public')
const viewsPath = path.join(__dirname, '../templates/views')
const partialsPath = path.join(__dirname, '../templates/partials')

// Setup handlebars engine and views location
app.set('view engine', 'hbs')
app.set('views', viewsPath)
hbs.registerPartials(partialsPath)

// Setup static dir to serve
app.use(express.static(publicDirPath))

app.use(walletRouter)