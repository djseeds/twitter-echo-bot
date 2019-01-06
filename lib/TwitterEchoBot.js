const request = require('request').defaults({encoding: null});

/**
 * Class that echos tweets from a given account.
 */
class TwitterEchoBot {
  /**
   * Construct and intitialize echo bot.
   * @param {string} accountToEcho - The Twitter account to echo.
   * @param {Twit} twitterWriter - The Twit account object to write tweets to.
   * @param {Twit} [twitterReader] - The Twit account object to read using.
   *     This allows writer to echo tweets of a private account without needing
   *     to be a follower of the target account.
   */
  constructor(accountToEcho, twitterWriter, twitterReader=null) {
    this.accountToEcho = accountToEcho;
    this.twitterWriter = twitterWriter;
    this.twitterReader = twitterReader || twitterWriter;
    // Track last time we tweeted.
    this.lastTweetTime = null;
    this.initialized = false;

    // Initialize bot
    this.init();
  }

  /**
   * Initialize Echo Bot, getting the last time twitterWriter tweeted.
   */
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

  /**
   * Echo tweets that were created after last tweet.
   */
  processNewTweets() {
    const self = this;
    if (this.initialized) {
      const options = {
        screen_name: this.accountToEcho,
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
            // Sort tweets in order of tweet time. (Oldest first).
            const sortedTweets = data.sort(function(a, b) {
              return Date.parse(a.created_at) - Date.parse(b.created_at);
            });
            // Process tweets in order.
            let p = Promise.resolve();
            sortedTweets.forEach(function(tweet) {
              const tweetTime = new Date(tweet.created_at);
              if (tweetTime > self.lastTweetTime) {
                // Chain promises in order.
                p = p.then(self.processTweet(tweet));
              }
            });
            self.lastTweetTime = new Date();
          });
    }
  }

  /**
   * Process a single tweet, ignoring replies and echoing retweets and tweets.
   * @param {Object} tweet - Tweet object from Twitter API response.
   * @return {Promise} - A promise to process tweet.
   */
  processTweet(tweet) {
    const self = this;
    return new Promise(function(resolve, reject) {
      if (tweet.in_reply_to_status_id) {
        console.log('Ignoring reply');
        resolve();
      } else if (tweet.retweeted_status) {
        self.retweet(tweet.retweeted_status).then(function() {
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      } else {
        self.echoTweet(tweet).then(function() {
          resolve();
        }).catch(function(err) {
          reject(err);
        });
      }
    });
  }

  /**
   * Echo contents of a tweet as a tweet.
   * @param {Object} tweet - Tweet object from Twitter API response.
   * @return {Promise} - A promise to echo tweet.
   */
  echoTweet(tweet) {
    const self = this;
    return new Promise(function(resolve, reject) {
      tweet = cleanTweetText(tweet);
      const text = tweet.full_text;

      self.postPhotos(tweet).then(function(photoIds) {
        const options = {'status': text, 'media_ids': [photoIds]};
        self.twitterWriter.post('statuses/update', options,
            function(err, data, response) {
              if (err) {
                reject(err);
              } else {
                console.log('Successfully echoed tweet: ' + text);
                resolve();
              }
            });
      });
    });
  }

  /**
   * Retweet the same status that a given tweet is retweeting.
   * @param {Object} tweet - Tweet object from Twitter API response
   * @return {Promise} - A promise to retweet the tweet.
   */
  retweet(tweet) {
    const self = this;
    return new Promise(function(resolve, reject) {
      self.twitterWriter.post('statuses/retweet/:id', {id: tweet.id_str},
          function(err, data, response) {
            if (err) {
              console.log(err);
              reject(err);
            } else {
              console.log('Successfully retweeted tweet: ' + tweet);
              resolve();
            }
          });
    });
  }

  /**
   * Post all photos in a given tweet for use in new status.
   * @param {Object} tweet - Tweet object from Twitter API response.
   * @return {Promise} - Promise to post photos.
   *     Resolves with list of photo IDs.
   */
  postPhotos(tweet) {
    const self = this;
    return new Promise(function(resolve, reject) {
      let promises = [];
      if (tweet.entities && tweet.entities.media) {
        tweet.entities.media.filter((media) => media.type == 'photo');
        promises = tweet.entities.media.map(function(media) {
          return self.postPhoto(media.media_url);
        });
      }
      Promise.all(promises).then(function(photoIds) {
        resolve(photoIds);
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  /**
   * Post a photo from given url.
   * Downloads and then re-uploads photo, and calls back with new photo ID.
   * @param {string} url - The photo's URL.
   * @return {Promise} - A promise to post the photo.
   *     Resolves with photo media ID.
   */
  postPhoto(url) {
    const self = this;
    return new Promise(function(resolve, reject) {
      downloadMedia(url).then(function(rawData) {
        const options = {media_data: rawData};
        self.twitterWriter.post('media/upload', options,
            function(err, data, response) {
              if (err) {
                reject(err);
              } else {
                resolve(data.media_id_string);
              }
            });
      }).catch(function(err) {
        reject(err);
      });
    });
  }
}


/**
 * Cleans media URLs from tweet text.
 * @param {Object} tweet - Tweet object from Twitter API response.
 * @return {Object} tweet with cleaned text.
 */
function cleanTweetText(tweet) {
  if (tweet.entities && tweet.entities.media) {
    tweet.entities.media.forEach(function(media) {
      // Remove URL;
      tweet.full_text = tweet.full_text.replace(media.url, '');
    });
  }
  return tweet;
}

/**
 * Download media and encode in base64.
 * @param {string} url - URL to download media from.
 * @return {Promise} - A promise to download media.
 *     Resolves with media in base64 format.
 */
function downloadMedia(url) {
  return new Promise(function(resolve, reject) {
    request.get(url, function(err, response, body) {
      if (err) {
        reject(err);
      } else {
        const image = new Buffer(body).toString('base64');
        resolve(image);
      }
    });
  });
}

module.exports = TwitterEchoBot;
