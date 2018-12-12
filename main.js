var Twit = require('twit')

// Track last time we tweeted
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
twitter_writer.get('statuses/user_timeline', {count: 1, include_rts: 1}, function(err, data, response){
    if(data.length == 1){
        last_tweet_time = new Date(data[0].created_at)
    }
    else{
        console.log("Account has never tweeted. Starting fresh from now.")
    }
    console.log("Last tweet time: " + last_tweet_time)
})

// Process tweets we've missed every minute.
process_new_tweets()
setInterval(process_new_tweets, 60*1000)


// Echo tweets that were created after our last tweet.
function process_new_tweets(){
    twitter_reader.get('statuses/user_timeline', {screen_name: process.env.TWITTER_ACCOUNT_TO_ECHO, count: 200, include_rts: true, exclude_replies: true, tweet_mode: 'extended'}, function(err, data, response){
        if(err){
            console.log(err)
            return
        }
        var sorted_tweets = data.sort(function(a,b){
            return Date.parse(a.created_at) - Date.parse(b.created_at)
        })
        sorted_tweets.forEach(function(tweet){
            var tweet_time = new Date(tweet.created_at)
            if(tweet_time > last_tweet_time){
                process_tweet(tweet)
            }
        })
        last_tweet_time = new Date()
    })
}


// Process a single status.
// Ignore replies,
// Retweet retweeted statuses,
// Echo contents of normal tweets.
function process_tweet(tweet){
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
function echo_tweet(tweet) {
    console.log(tweet)
    var text = tweet.full_text

    if(tweet.truncated){
        console.log(tweet)
        text = tweet.extended_tweet.full_text
    }

    twitter_writer.post('statuses/update', {'status': text}, function(err, data, response){
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
