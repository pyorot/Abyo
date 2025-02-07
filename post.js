const request = require('superagent')
const error = require('./error.js')
require('./date.js')

module.exports.post = post
module.exports.discord = discord

function post(pokemon, channel) {       // constructs full notification, then sends message
    let embed = {
        image: {
            url: 'https://maps.googleapis.com/maps/api/staticmap?markers='
               + pokemon.point[0]
               + ','
               + pokemon.point[1]
               + '&zoom=15&size=400x400&sensor=false&key='
               + process.env.KEY_GOOGLE
        },
        footer: {}
    }

    let nowTime = new Date(); let now = nowTime.number()                // calculate time remaining just before sending
    let timeRemaining = pokemon.despawn - now
    if (timeRemaining <= 2*60) {return Promise.reject('expired')}       // throw expired Pokemon exception
    embed.footer.text = 'sent at ' + nowTime.hhmmss()
    return discord(channel, {content: pokemon.text.replace("#TIME", timeRemaining.date().mmss()), embed: embed})
}

function discord(channel, message) {    // Discord send-message wrapper
    return new Promise((resolve,reject) => {
        request
            .post('https://discordapp.com/api/channels/'+channel+'/messages')
            .timeout({
                response: 5*1000,       // to start receiving
                deadline: 10*1000,      // to finish receiving
            })
            .set('Authorization', 'Bot ' + process.env.KEY_BOT)
            .set('User-Agent', 'Abyo')
            .type('application/json')
            .send(JSON.stringify(message))
            .then(resolve)
            .catch(err => {
                if (err.response && err.response.text) {
                    let errInfo = JSON.parse(err.response.text)
                    error(`x DISCORD: ${err.response.status}-${errInfo.code}: ${errInfo.message}.`)
                    reject('http-' + err.response.status)
                } else if (err.errno == 'ETIMEDOUT') {
                    reject('timeout-auto')
                } else {
                    error('x DISCORD [unknown dump]:', JSON.stringify(err))
                    reject('unknown')
                }
            })
        setTimeout(() => reject('timeout-manual'), 10*1000)    // manual rejection after 10s (to prevent hanging awaiting reply)
    })
}

// A litany of errors:
// http-xxx: Discord responded with an error (more info is logged).
// timeout-auto: Discord didn't respond, and superagent called a timeout.
// timeout-manual: Discord didn't respond, and superagent missed a timeout.