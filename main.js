#!/usr/bin/env node

const Twit = require('twit');
const twitter_echo_bot = require('./lib/TwitterEchoBot.js');

// Twiter API object for reads.
// Allows you to echo tweets from an account that
// is blocked from seeing target's tweets
const twitterReader = new Twit({
  consumer_key: process.env.TWITTER_READER_CONSUMER_KEY ||
    process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_READER_CONSUMER_SECRET ||
    process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_READER_ACCESS_TOKEN ||
    process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_READER_ACCESS_TOKEN_SECRET ||
    process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms: 10 * 1000,
  strictSSL: true, // optional - requires SSL certificates to be valid.
});

// Twitter API object for writes. This is the account that actually tweets.
const twitterWriter = new Twit({
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
  timeout_ms: 10*1000,
  strictSSL: true, // optional - requires SSL certificates to be valid.
});

const echoBot = new TwitterEchoBot(process.env.TWITTER_ACCOUNT_TO_ECHO,
    twitterWriter, twitterReader);

setInterval(function() {
  echoBot.processNewTweets();
}, process.env.TWITTER_WAIT_MS || 60*1000);
