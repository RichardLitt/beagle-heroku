#!/usr/bin/env node
var _ = require('underscore')
var Mailgun = require('mailgun-js')

// setup mailgun
var api_key = process.env.MAILGUN_KEY
if (!api_key) throw new Error('no MAILGUN_KEY')
var domain = 'beaglelab.github.io'
var mailgun = new Mailgun({apiKey: api_key, domain: domain})
var newsletter = mailgun.lists('newsletter@beaglelab.github.io')

list(0)

function list (skip) {
  if (!skip) skip = 0

  var params = {limit: 100, skip: skip}
  newsletter.members().list(params, function (err, members) {
    if (err) console.log(err)
    var addrs = _.pluck(members.items, 'address')

    // print them out.
    var print = function (a) { console.log(a) }
    _.defer(_.map, addrs, print)

    // make more requests.
    if (addrs.length === params.limit) // continue
      _.defer(list, skip + params.limit)
  })
}
