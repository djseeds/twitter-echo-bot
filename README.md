# twitter-echo-bot
Twitter bot that echos another account's tweets and retweets in real time.

Blocked by an account but would still like to follow that account's tweets? This bot will let you do that.

## Prerequisites
1. Install [Node.js and npm](https://www.npmjs.com/get-npm)
2. Create a [Twitter developer account](https://developer.twitter.com)
    - This is the account the bot will tweet from. If you want to tweet from a new account, you should create a new Twitter account and use that account to create a developer account.
3. Create a new [Twitter application](https://developer.twitter.com/en/apps)
    - This will allow you generate the API keys that allow the bot to tweet.
4. Generate Access Token in the `Keys and tokens` section of your app configuration.

## Installation
1. Clone this repository
```
git clone https://github.com/djseeds/twitter-echo-bot
```
```
cd twitter-echo-bot
```

2. Install dependencies
```
npm install
```

## Configuration
### Set Required Environmental Variables

There are several required environmental variables that allow the application to work. These are the API keys and access tokens as well as the account you would like to echo. Run the following commands to set these variables. I suggest setting these variables in your shell startup script (e.g. `~/.bashrc`).

```
export TWITTER_CONSUMER_KEY='API key here'
export TWITTER_CONSUMER_SECRET='API secret key here'
export TWITTER_ACCESS_TOKEN='Access token here'
export TWITTER_ACCESS_TOKEN_SECRET='Access token secret here'
export TWITTER_ACCOUNT_TO_ECHO='twitter_handle_here'
```

The consumer key and access tokens are available on the `Keys and tokens` page of the application you created above.

The account should be the twitter username of the account you would like to echo. For the account `@username`, you would enter `username` for `TWITTER_ACCOUNT_TO_ECHO`.

### Set Optional Environmental Variables

This bot also supports reading tweets from a different account than the one it tweets to. This can be helpful if the account you are echoing has blocked your main bot account or is set to private.

If the account you would like to echo is private, then you will have to become a follower to see their tweets (sorry, I don't make the rules). This would be difficult if your bot account had to be the one that followed the target account, because the target account would probably not want you to follow them. Instead, you can create a second account and request to follow from that account.

To do this, create another account and application as you did for the main bot account, and export the following environmental variables.

```
export TWITTER_READER_CONSUMER_KEY='API key here'
export TWITTER_READER_CONSUMER_SECRET='API secret key here'
export TWITTER_READER_ACCESS_TOKEN='Access token here'
export TWITTER_READER_ACCESS_TOKEN_SECRET='Access token secret here'
```

## Running
To run the bot, simply run the following command:
```
npm run twitter_echo_bot
```
