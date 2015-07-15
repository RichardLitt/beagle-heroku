// So the deal is that the client will run OAuth against some server
// and will acquire a token. This token will be sent to our auth-server.
// Our auth-server will then have to do two things:
// - verify the token is good (make a request to the OAuth provider)
// - run the desired auth operation on couchdb
// So it should look something like this:

// client -- the client webapp or extension
// auth-server -- the authentication server
// couchdb -- well, couchdb.

var PouchDB = require('pouchdb')
PouchDB.plugin(require('pouchdb-authentication'))
var db = new PouchDB(process.env.POUCH_DEV_DB, {skipSetup: true})
var btoa = require('btoa')

var request = require('request')
var crypto = require('crypto')
var moment = require('moment')

var authServerKey = process.env.AUTHSERVERKEY
var githubClientID = process.env.GITHUB_CLIENT_ID

// get this from the client's request
// var oauthInfo = {
//   provider: 'twitter.com',
//   account: '@juanbenet',
//   token: 'some-oauth-token'
// }

// {
//   provider: 'google',
//   token: process.env.GOOGLE_ACCESS_TOKEN
// }

// var oauthInfo = {
//   provider: 'github',
//   user: 'RichardLitt',
//   token: process.env.GITHUB_ACCESS_TOKEN
// }

module.exports.signup = exports.signup = function signup (beagleUsername, oauthInfo, clientcb) {
  verifyOAuthToken(oauthInfo, function (err, res) {
    if (err != null) {
      return clientcb('Failed to verify OAuth token: ' + err)
    }

    // the password is basically not used to authenticate at all.
    // we use it merely because couchdb forces us to. At this point
    // we've verified auth (with oauth) and have a valid token, so
    // we are good. We thus set the password to a user-specific
    // random string deterministically generated (so we can login
    // later, too). let's say this is:
    var salt2 = crypto.randomBytes(10).toString('hex')
    var key = beagleUsername + authServerKey + salt2
    var pass = crypto.createHash('sha256').update(key).digest('hex')

    var user = {
      username: beagleUsername,
      password: pass,
      metadata: {
        salt2: salt2,
        email: oauthInfo.email,
        avatar: oauthInfo.avatar,
        created: moment(),
        oauthInfo: {
          provider: oauthInfo.provider,
          account: oauthInfo.account,
          token: oauthInfo.token
        }
      }
    }

    db.signup(user.username, user.password, { metadata: user.metadata }, function (err, response) {
      if (err) {
        if (err.name === 'conflict') {
          return clientcb('User already exists, choose another username', err)
        } else if (err.name === 'forbidden') {
          return clientcb('Invalid username', err)
        } else {
          return clientcb(err, 'Act of god caused not to work')
          // HTTP error, cosmic rays, etc.
        }
      } else {
        // ok we're signed up. return the session id to the client
        return clientcb(null, response)
      }
    })
  })
}

module.exports.signUp = exports.signUp = exports.signup

module.exports.login = exports.login = function login (beagleUsername, oauthInfo, clientcb) {
  // first, check beagleUsername matches oauthtoken
  verifyOAuthUser(beagleUsername, oauthInfo, function (err) {
    if (err != null) {
      return clientcb('Failed to verify OAauth User: ' + err)
    }

    // ok, beaglename checks out as matching oauthinfo.

    verifyOAuthToken(oauthInfo, function (err) {
      if (err != null) {
        return clientcb('Failed to verify OAuth token ' + err)
      }

      return db.getUser(beagleUsername, function (err, user) {
        if (err) {
          clientcb('Unable to get User: ' + err)
        }

        var key = user.name + authServerKey + user.salt2
        var password = crypto.createHash('sha256').update(key).digest('hex')

        var ajaxOpts = {
          ajax: {
            headers: {
              Authorization: 'Basic ' + btoa(user.name + ':' + password)
            }
          }
        }

        // or whatever
        db.login(user.name, password, ajaxOpts, function (err, response) {
          if (err != null) {
            // failed to log in
            return clientcb('Failed to login user: ' + err)
          }
          // ok we're logged up, should send back sessionID
          clientcb(null, response)
        })
      })

    })
  })
}

module.exports.logIn = exports.logIn = exports.logIn

// check that beagleUser matches oauthInfo.
function verifyOAuthUser (beagleUser, oauthInfo, cb) {
  db.getUser(beagleUser, function (err, response) {
    if (err) {
      if (err.name === 'not_found') {
        cb(err)
        // console.log('User name not found.')
        // TODO Sign up user then?
        // typo or lacking privs
      } else {
        console.log('There was some error with getting the user', err)
        cb(err)
      }
    } else {
      // check the provider + accounts match
      var ok = (response.oauthInfo.provider === oauthInfo.provider) &&
           (response.oauthInfo.account === oauthInfo.account)

      if (!ok) {
        cb('Error: Unable to verify Oauth user.')
      } else {
        cb(null)
      }
    }
  })

}

function verifyOAuthToken (oauthInfo, cb) {
  if (oauthInfo.provider === 'github') {
    request({
        method: 'GET',
        uri: 'https://' + oauthInfo.account + ':' + oauthInfo.token + '@api.github.com/user',
        headers: { 'User-Agent': githubClientID}
      },
      function (error, response, body) {
        if (error) {
          return cb('Error: Unable to access GitHub Oauth provider')
        } else if (response.statusCode !== 200) {
          return cb('Error: GitHub token is invalid')
        } else {
          return cb(null, body)
        }
      }
    )
  } else if (oauthInfo.provider === 'google') {
    request.get('https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + oauthInfo.token,
      function (error, response, body) {
        if (error) {
          return cb('Error: Unable to access Google OAuth')
        } else if (response.statusCode !== 200) {
          return cb('Error: Google token is invalid')
        } else if (JSON.parse(body).user_id !== oauthInfo.account) {
          return cb('Error: That token is not associated with that account')
        } else {
          return cb(null, body)
        }
      }
    )
  } else {
    return cb('Error: OAuth provider not provided')
  }
}
