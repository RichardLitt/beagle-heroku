#!/usr/bin/env node

// get test email
var email = (process.argv.length > 2) ? process.argv[2] : 'richard@beaglelab.github.io'
email = email.trim()
console.log('testing email: ' + email)

var request = require('request')
request.debug = true

// var url = "http://beagle-mailinglist.herokuapp.com/email"
var url = 'http://localhost:5000/email'

var data = {email: email}
var req = request.post(url, {form: data}, function (err, res, body) {
  if (err != null) {
    console.error(err)
    process.exit(-1)
  }

  console.log(body)
})
