// web.js

// var validator = require('mailgun-validate-email');
// validator got screwed up. todo make out own module.
var validator = require('./validator') // for now this

var Mailgun = require('mailgun-js')
var express = require('express')
var logfmt = require('logfmt')
var cors = require('cors')
var app = express()

var bodyParser = require('body-parser')
app.use(bodyParser.json())       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded()) // to support URL-encoded bodies

var rate = require('express-rate')

var auth = require('./auth.js')

// setup mailgun
var api_key = process.env.MAILGUN_KEY
if (!api_key) throw new Error('no MAILGUN_KEY')
var pub_key = process.env.MAILGUN_PUBKEY
if (!pub_key) throw new Error('no MAILGUN_PUBKEY')
var domain = 'beaglelab.github.io'

var mailgun = new Mailgun({apiKey: api_key, domain: domain})
var newsletter = mailgun.lists('newsletter@sandboxc5e90e5fb9e84a9eb572c4e8c6720c67.mailgun.org'/*'newsletter@beaglelab.github.io'*/)

// rate limiting

var rateHandler = new rate.Memory.MemoryRateHandler()
var rateMiddleware = rate.middleware({handler: rateHandler,
  limit: 5,
  interval: 5,
  setHeadersHandler: function (req, res, rate, limit, resetTime) {
    var remaining = limit - rate

    if (remaining < 0) {
      remaining = 0
    }

    // follows Twitter's rate limiting scheme and header notation
    // https://dev.twitter.com/docs/rate-limiting/faq#info
    res.setHeader('X-RateLimit-Limit', limit)
    res.setHeader('X-RateLimit-Remaining', remaining)
    res.setHeader('X-RateLimit-Reset', resetTime)
  },

  onLimitReached: function (req, res, rate, limit, resetTime, next) {
    // HTTP code 420 from http://mehack.com/inventing-a-http-response-code-aka-seriously
    res.json({error: 'rate limit exceeded.'}, {status: 420})
  }
})

// ------------------

app.use(logfmt.requestLogger())
app.use(cors())

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.get('/signUp', rateMiddleware, function (req, res) {
  console.log(req, res)

  return
})

app.get('/login', rateMiddleware, function (req, res) {
  console.log('hello')

  return
})

// app.get('/email', rateMiddleware, function (req, res) {
//   var email = req.param('email')
//   if (typeof email == 'undefined') {
//     return res.send(405, 'No email')
//   }

//   return handleEmail(email, res)
// })

// app.post('/email', rateMiddleware, function (req, res) {
//   var email = req.body && req.body.email
//   if (typeof email == 'undefined') {
//     return res.send(405, 'No email')
//   }

//   return handleEmail(email, res)
// })

// function handleEmail (email, res) {
//   email = email.trim()
//   validator(pub_key, email, function (err, result) {
//     if (err || !result.is_valid) {
//       console.error('validator failed. error then result')
//       console.error(err)
//       console.error(result)
//       return res.send(405, 'Email validation failed: ' + email)
//     }

//     var user = { subscribed: true, address: email }
//     newsletter.members().create(user, function (err, data) {
//       if (err) {
//         var exists = 'Address already exists'
//         if (err.toString().search(exists) >= 0) {
//           return res.send('already subscribed ' + email)
//         }

//         console.log(err)
//         return res.send(405, 'Failed to subscribe: ' + email)
//       }

//       res.send('subscribed ' + data.member.address)
//     })
//   })
// }

var port = Number(process.env.PORT || 5000)
app.listen(port, function () {
  console.log('Listening on ' + port)
})
