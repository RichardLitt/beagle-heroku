#!/usr/bin/env node

// get test email
// var email = (process.argv.length > 2) ? process.argv[2] : 'richard@beaglelab.github.io'
// email = email.trim()
// console.log('testing email: ' + email)

// var request = require('request')
// request.debug = true

// var url = "http://beagle-mailinglist.herokuapp.com/email"
// // var url = 'http://localhost:5000/email'

// var data = {email: email}
// var req = request.post(url, {form: data}, function (err, res, body) {
//   if (err != null) {
//     console.error(err)
//     process.exit(-1)
//   }

//   console.log(body)
// })

var auth = require('./auth.js')
var argv = require('minimist')(process.argv.slice(2))
var oauthInfo = {
  provider: 'github',
  user: 'RichardLitt',
  token: process.env.GITHUB_ACCESS_TOKEN
}

switch (argv.r) {
  case 'signup':
    signup(oauthInfo)
    break
  case 'login':
    login(oauthInfo)
    break
}


function signup (oauthInfo) {
  auth.signup(oauthInfo.user, oauthInfo, function (err, res) {
    if (err) {
      console.log(err)
    } else {
      console.log('Signed Up User', res)
    }
  })
}

function login (oauthInfo) {
  auth.login(oauthInfo.user, oauthInfo, function (err, res) {
    if (err) {
      console.log(err)
    } else {
      console.log('Logged In', res)
    }
  })
}
