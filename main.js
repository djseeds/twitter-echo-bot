var request = require('request').defaults({encoding: null})
var Twit = require('twit')

// Track last time we tweeted.
var last_tweet_time = null

// Twiter API object for reads.
// Allows you to echo tweets from an account that is blocked from seeing target's tweets
var twitter_reader = new Twit({
    consumer_key: process.env.TWITTER_READER_CONSUMER_KEY || process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_READER_CONSUMER_SECRET || process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_READER_ACCESS_TOKEN || process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_READER_ACCESS_TOKEN_SECRET || process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms:           10*1000,  // optional HTTP request timeout to apply to all requests.
    strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

// Twitter API object for writes. This is the account that actually tweets.
var twitter_writer = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms:           10*1000,  // optional HTTP request timeout to apply to all requests.
    strictSSL:            true,     // optional - requires SSL certificates to be valid.
})

// Get time of last tweet to know where to start.
twitter_writer.get('statuses/user_timeline', {count: 1, include_rts: 1}, function(err, data, response) {
    if(data.length == 1) {
        last_tweet_time = new Date(data[0].created_at)
    }
    else{
        console.log("Account has never tweeted. Starting fresh from now.")
    }
    console.log("Last tweet time: " + last_tweet_time)

    // Process tweets we've missed every minute.
    process_new_tweets()
    setInterval(process_new_tweets, 60*1000)
})



// Echo tweets that were created after our last tweet.
function process_new_tweets() {
    twitter_reader.get('statuses/user_timeline', {screen_name: process.env.TWITTER_ACCOUNT_TO_ECHO, count: 200, include_rts: true, exclude_replies: true, tweet_mode: 'extended'}, function(err, data, response) {
        if(err) {
            console.log(err)
            return
        }
        var sorted_tweets = data.sort(function(a,b) {
            return Date.parse(a.created_at) - Date.parse(b.created_at)
        })
        sorted_tweets.forEach(function(tweet) {
            var tweet_time = new Date(tweet.created_at)
            if(tweet_time > last_tweet_time) {
                console.log(tweet)
                console.log(tweet_time)
                console.log(last_tweet_time)
                //process_tweet(tweet)
            }
        })
        last_tweet_time = new Date()
    })
}


// Process a single status.
// Ignore replies,
// Retweet retweeted statuses,
// Echo contents of normal tweets.
function process_tweet(tweet) {
    if(tweet.in_reply_to_status_id) {
        console.log("Ignoring reply")
    }
    else if(tweet.retweeted_status) {
        retweet(tweet.retweeted_status);
    }
    else {
        echo_tweet(tweet)
    }
}

// Echo contents of a tweet as a tweet.
async function echo_tweet(tweet) {
    console.log(tweet)

    tweet = clean_tweet_text(tweet)

    var text = tweet.full_text
    var photo_ids = await post_photos(tweet)

    twitter_writer.post('statuses/update', {'status': text, media_ids: [photo_ids]}, function(err, data, response) {
        if(err) {
            console.log(err);
        }
        else {
            console.log("Successfully echoed tweet: " + text);
        }
    })
}

// Retweet the same status that a given tweet is retweeting.
function retweet(tweet) {
    twitter_writer.post('statuses/retweet/:id', { id: tweet.id_str}, function (err, data, response) {
        if(err) {
            console.log(err);
        }
        else {
            console.log("Successfully retweeted tweet: " + tweet);
        }
    })
}

// Cleans media URLs from tweet text.
function clean_tweet_text(tweet) {
    if(tweet.entities && tweet.entities.media) {
        tweet.entities.media.forEach(function(media) {
            // Remove URL
            tweet.full_text = tweet.full_text.replace(media.url, '')
        })
    }
    return tweet
}

// Post all photos in a given tweet for use in new status.
// Returns a list of photo IDs.
async function post_photos(tweet) {
    var photo_ids = []
    if(tweet.entities && tweet.entities.media) {
        tweet.entities.media.filter(media => media.type == 'photo');
        var promises = tweet.entities.media.map(function(media){
            return new Promise(function(resolve, reject) {
                post_photo(media.media_url, function(err, photo_id) {
                    if(err) {
                        reject(err)
                    }
                    else {
                        resolve(photo_id)
                    }
                })
            })
        })
        photo_ids = await Promise.all(promises)
    }
    return photo_ids
}

// Post a photo from given url.
// Downloads and then re-uploads photo, and calls back with new photo ID.
function post_photo(url, callback) {
    download_media(url, function(err, raw_data){
        twitter_writer.post('media/upload', {media_data: raw_data}, function(err, data, response) {
            if(err) {
                callback(err, null)
            }
            else {
                callback(null, data.media_id_string)
            }
        })
    })
}

// Download media and encode in base64.
// Calls back with raw data in base64 encoding.
function download_media(url, callback) {
    request.get(url, function(err, response, body) {
        if(err) {
            callback(err, null)
        }
        else {
            var image = new Buffer(body).toString('base64')
            callback(null, image)
        }
    })
}
