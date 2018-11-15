var Twit = require('twit')

var T = new Twit({
    consumer_key: process.env.TWITTER_CONSUMER_KEY,
    consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
    access_token: process.env.TWITTER_ACCESS_TOKEN,
    access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
    timeout_ms:           10*1000,  // optional HTTP request timeout to apply to all requests.
    strictSSL:            true,     // optional - requires SSL certificates to be valid.
})


// Listen for tweets from account we would like to echo.
var stream = T.stream('statuses/filter', { follow: [process.env.TWITTER_ACCOUNT_TO_ECHO]})

stream.on('tweet', function (tweet) {
    // Stream also returns retweets from other people, so we want to ignore those.
    if(tweet.user.id_str == process.env.TWITTER_ACCOUNT_TO_ECHO){
        if(tweet.retweeted_status){
            retweet(tweet.retweeted_status);
        }
        else{
            echo_tweet(tweet)
        }
    }
})

stream.on('error', function(error) {
    console.log(error);
})

function echo_tweet(tweet) {
    var text = tweet.text
    if(tweet.truncated){
        text = tweet.extended_tweet.full_text
    }

    T.post('statuses/update', {status: text}, function(err, data, response){
        if(err) {
            console.log(err);
        }
        else {
            console.log("Successfully echoed tweet: " + text);
        }
    })
}

function retweet(tweet) {
    T.post('statuses/retweet/:id', { id: tweet.id_str}, function (err, data, response) {
        if(err) {
            console.log(err);
        }
        else {
            console.log("Successfully retweeted tweet: " + tweet.text);
        }
    })
}
