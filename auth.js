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

var request = require('request')
// TODO These could probably be the same package
var sha256 = require("crypto-js/sha256");
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
      clientcb('error ... ', err)
      return
    }

    // ok looks good. we can signup user.

    // the password is basically not used to authenticate at all.
    // we use it merely because couchdb forces us to. At this point
    // we've verified auth (with oauth) and have a valid token, so
    // we are good. We thus set the password to a user-specific
    // random string deterministically generated (so we can login
    // later, too). let's say this is:
    var salt = crypto.randomBytes(20).toString('hex')
    var pass = sha256( beagleUsername + authServerKey + salt )

    var user = {
      username: beagleUsername,
      password: pass,
      metadata: {
        salt: salt, // store salt in user somewhere
        oauthInfo: { // store the oauth data somwhere.
          provider: oauthInfo.provider,
          account: oauthInfo.account,
          token: oauthInfo.token
        }
      }
    }

    db.signup(user.username, user.password, user, function (err, response) {
      if (err != null) {
        // failed to sign up
        clientcb('error ... ', err)
        return
      }

      // ok we're signed up. return the session id to the client
      clientcb(null, response)
    })
  })
}

module.exports.login = exports.login = function login (beagleUsername, oauthInfo, clientcb) {
  // first, check beagleUsername matches oauthtoken
  verifyOAuthUser(beagleUsername, oauthInfo, function(err) {
    if (err != null) {
      // ok something went wrong
      clientcb('error ... ')
      return
    }

    // ok, beaglename checks out as matching oauthinfo.

    verifyOAuthToken(oauthInfo, function(err) {
      if (err != null) {
        // ok something went wrong
        clientcb('error ... ')
        return
      }

      // ok looks good. we can login user.
      var user = db.getUser(beagleuser, function (err, user) {
        var pass = sha256( user.name + authServerKey + user.salt )

        // or whatever
        couchdb.login(user.name, pass, function (err, response) {
          if (err != null) {
            // failed to log in
            clientcb('error ... ', err)
            return
          }
          // ok we're logged up, should send back sessionID
          clientcb(null, response)
        })
      })

    })
  })

// }


// check that beagleUser matches oauthInfo.
function verifyOAuthUser(beagleUser, oauthInfo, cb) {

  var user = db.users.get({username: beagleuser})

  // check the provider + accounts match
  var ok = (user.oauthInfo.provider == oauthInfo.provider) &&
       (user.oauthInfo.account == oauthInfo.account)

  // TODO what happens here? 
  if (!ok) {
    cb('error ...')
  } else {
    cb(null, ...)
  }
}

function verifyOAuthToken (beagleUser, oauthInfo, cb) {
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