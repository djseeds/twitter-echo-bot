/* eslint-disable require-jsdoc */
const request = require('request').defaults({encoding: null});

class TwitterEchoBot {
  constructor(twitterWriter, twitterReader=null) {
    this.twitterWriter = twitterWriter;
    this.twitterReader = twitterReader || twitterWriter;
    // Track last time we tweeted.
    this.lastTweetTime = null;
    this.initialized = false;

    // Initialize bot
    this.init();
  }

  init() {
    const self = this;
    // Get time of last tweet to know where to start.
    const options = {count: 1, include_rts: 1};
    this.twitterWriter.get('statuses/user_timeline', options,
        function(err, data, response) {
          if (err) {
            console.log('Failed to initialize.');
            throw (err);
          }
          if (data.length == 1) {
            self.lastTweetTime = new Date(data[0].created_at);
          } else {
            console.log('Account has never tweeted. Starting fresh from now.');
          }
          console.log('Last tweet time: ' + self.lastTweetTime);
          self.initialized = true;
        });
  }

  // Echo tweets that were created after our last tweet.
  processNewTweets() {
    const self = this;
    if (this.initialized) {
      const options = {
        screen_name: process.env.TWITTER_ACCOUNT_TO_ECHO,
        count: 200,
        include_rts: true,
        exclude_replies: true,
        tweet_mode: 'extended',
      };
      this.twitterReader.get('statuses/user_timeline', options,
          function(err, data, response) {
            if (err) {
              console.log(err);
              return;
            }
            const sortedTweets = data.sort(function(a, b) {
              return Date.parse(a.created_at) - Date.parse(b.created_at);
            });
            sortedTweets.forEach(function(tweet) {
              const tweetTime = new Date(tweet.created_at);
              if (tweetTime > self.lastTweetTime) {
                self.processTweet(tweet);
              }
            });
            self.lastTweetTime = new Date();
          });
    }
  }

  // Process a single status.
  // Ignore replies,;
  // Retweet retweeted statuses,;
  // Echo contents of normal tweets.
  processTweet(tweet) {
    if (tweet.in_reply_to_status_id) {
      console.log('Ignoring reply');
    } else if (tweet.retweeted_status) {
      this.retweet(tweet.retweeted_status);
    } else {
      this.echoTweet(tweet);
    }
  }

  // Echo contents of a tweet as a tweet.
  // TODO: Return a promise from post.
  async echoTweet(tweet) {
    tweet = cleanTweetText(tweet);

    const text = tweet.full_text;
    const photoIds = await this.postPhotos(tweet);

    const options = {'status': text, 'media_ids': [photoIds]};
    this.twitterWriter.post('statuses/update', options,
        function(err, data, response) {
          if (err) {
            console.log(err);
          } else {
            console.log('Successfully echoed tweet: ' + text);
          }
        });
  }

  // Retweet the same status that a given tweet is retweeting.
  retweet(tweet) {
    this.twitterWriter.post('statuses/retweet/:id', {id: tweet.id_str},
        function(err, data, response) {
          if (err) {
            console.log(err);
          } else {
            console.log('Successfully retweeted tweet: ' + tweet);
          }
        });
  }

  // Post all photos in a given tweet for use in new status.
  // Returns a list of photo IDs.
  async postPhotos(tweet) {
    const self = this;
    let photoIds = [];
    if (tweet.entities && tweet.entities.media) {
      tweet.entities.media.filter((media) => media.type == 'photo');
      const promises = tweet.entities.media.map(function(media) {
        return new Promise(function(resolve, reject) {
          self.postPhoto(media.media_url, function(err, photoId) {
            if (err) {
              reject(err);
            } else {
              resolve(photoId);
            }
          });
        });
      });
      photoIds = await Promise.all(promises);
    }
    return photoIds;
  }

  // Post a photo from given url.
  // Downloads and then re-uploads photo, and calls back with new photo ID.
  postPhoto(url, callback) {
    const self = this;
    downloadMedia(url, function(err, rawData) {
      const options = {media_data: rawData};
      self.twitterWriter.post('media/upload', options,
          function(err, data, response) {
            if (err) {
              callback(err, null);
            } else {
              callback(null, data.media_id_string);
            }
          });
    });
  }
}


// Cleans media URLs from tweet text.
function cleanTweetText(tweet) {
  if (tweet.entities && tweet.entities.media) {
    tweet.entities.media.forEach(function(media) {
      // Remove URL;
      tweet.full_text = tweet.full_text.replace(media.url, '');
    });
  }
  return tweet;
}

// Download media and encode in base64.
// Calls back with raw data in base64 encoding.
function downloadMedia(url, callback) {
  request.get(url, function(err, response, body) {
    if (err) {
      callback(err, null);
    } else {
      const image = new Buffer(body).toString('base64');
      callback(null, image);
    }
  });
}

module.exports = TwitterEchoBot;
