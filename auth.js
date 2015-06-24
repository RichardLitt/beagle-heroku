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
var db = new PouchDB(process.env.POUCH_DEV_DB)
var btoa = require('btoa')

var request = require('request')
// TODO These could probably be the same package
var crypto = require('crypto')

// authServerKey SHOULD NOT be leaked.
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
      // ok something went wrong
      clientcb('Failed to verify OAuth token', err)
      return
    }
    // ok looks good. we can signup user.

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
        salt2: salt2, // store salt2 in user somewhere
        oauthInfo: { // store the oauth data somwhere.
          provider: oauthInfo.provider,
          account: oauthInfo.account,
          token: oauthInfo.token
        }
      }
    }

    db.signup(user.username, user.password, { metadata: user.metadata }, function (err, response) {
      if (err) {
        if (err.name === 'conflict') {
          // "batman" already exists, choose another username
          return clientcb('User already exists, choose another username', err)
        } else if (err.name === 'forbidden') {
          return clientcb('invalid username', err)
          // invalid username
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

module.exports.login = exports.login = function login (beagleUsername, oauthInfo, clientcb) {
  // first, check beagleUsername matches oauthtoken
  verifyOAuthUser(beagleUsername, oauthInfo, function (err) {
    if (err != null) {
      // ok something went wrong
      clientcb('Failed to verify OAauth User')
      return
    }

    // ok, beaglename checks out as matching oauthinfo.

    verifyOAuthToken(oauthInfo, function (err) {
      if (err != null) {
        // ok something went wrong
        clientcb('Failed to verify OAuth token')
        return
      }

      // ok looks good. we can login user.
      return db.getUser(beagleUsername, function (err, user) {
        if (err) {
          throw new Error('Unable to get User')
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

        console.log('password', btoa(user.name + ':' + password))

        // or whatever
        db.login(user.name, password, ajaxOpts, function (err, response) {
          console.log(err)
          if (err != null) {
            // failed to log in
            clientcb(err, 'Failed to login user', err)
            return
          }
          // ok we're logged up, should send back sessionID
          clientcb(null, response)
        })
      })

    })
  })

}

// check that beagleUser matches oauthInfo.
function verifyOAuthUser (beagleUser, oauthInfo, cb) {
  db.getUser(beagleUser, function (err, response) {
    if (err) {
      if (err.name === 'not_found') {
        console.log('User name not found.')
        // TODO Sign up user then?
        // typo or lacking privs
      } else {
        console.log('There was some error with getting the user', err)
        // Some other error
      }
    } else {
      // check the provider + accounts match
      var ok = (response.oauthInfo.provider === oauthInfo.provider) &&
           (response.oauthInfo.account === oauthInfo.account)

      if (!ok) {
        cb('Unable to verify Oauth user.')
      } else {
        cb(null)
      }
    }
  })

}

function verifyOAuthToken (oauthInfo, cb) {
  if (oauthInfo.provider === 'github') {
    return request({
        method: 'GET',
        uri: 'https://' + oauthInfo.account + ':' + oauthInfo.token + '@api.github.com/user',
        headers: { 'User-Agent': githubClientID}
      },
      function (err, res, body) {
        if (err != null) {
          return cb('Error: GitHub token is invalid')
        } else {
          return cb(null, body)
        }
      }
    )
  } else if (oauthInfo.provider === 'google') {
    request({
        method: 'GET',
        uri: 'https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=' + oauthInfo.token
      },
      function (err, res, body) {
        if (err != null) {
          return cb('Error: Google token is invalid')
        } else {
          if (body.user_id === oauthInfo.account) {
            return cb(null, body)
          } else {
            return cb('Error: That token is not associated with that account')
          }
        }
      }
    )
  } else {
    throw new Error('OAuth provider not provided')
  }
}
