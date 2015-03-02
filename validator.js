var request = require('request')

var validator = function (pubkey, email, cb) {
  var options = {
    url: 'https://api.mailgun.net/v2/address/validate',
    method: 'GET',
    qs: {address: email}, // syntax_only: true}
    auth: { username: 'api', password: pubkey}
  }

  request(options, function (err, result) {
    if (err) { cb(err) }
    // this body is not a real JSON object
    cb(err, JSON.parse(result.request.response.body))
  })
}

module.exports = validator
