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

  /**
   * Process a single tweet, ignoring replies and echoing retweets and tweets.
   * @param {Object} tweet - Tweet object from Twitter API response.
   */
  processTweet(tweet) {
    if (tweet.in_reply_to_status_id) {
      console.log('Ignoring reply');
    } else if (tweet.retweeted_status) {
      this.retweet(tweet.retweeted_status);
    } else {
      this.echoTweet(tweet);
    }
  }

  /**
   * Echo contents of a tweet as a tweet.
   * @param {Object} tweet - Tweet object from Twitter API response.
   * @todo Return a promise from post.
   */
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

  /**
   * Retweet the same status that a given tweet is retweeting.
   * @param {Object} tweet - Tweet object from Twitter API response
   */
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

  /**
   * Post all photos in a given tweet for use in new status.
   * @param {Object} tweet - Tweet object from Twitter API response.
   */
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

  /**
   * Post a photo from given url.
   * Downloads and then re-uploads photo, and calls back with new photo ID.
   * @param {string} url - The photo's URL.
   * @param {callback} callback - Callback function.
   */
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
 * @param {string} url URL to download media from.
 * @param {callback} callback - Callback function.
 *     Called with media in base64 format.
 */
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
