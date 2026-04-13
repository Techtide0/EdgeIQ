const { Schema, model } = require('mongoose')

const schema = new Schema({
  teamId:   { type: Number, unique: true, index: true },
  name:     String,
  logo:     String,   // CDN URL from API-Football
  leagueId: Number,
})

module.exports = model('TeamLogo', schema)
