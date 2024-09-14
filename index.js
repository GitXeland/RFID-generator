const fs = require('fs').promises
const path = require('path')
const process = require('process')

const { generateIndivRFID } = require('./indiv')
const { generateClubRFID } = require('./clubs')

const TOKEN_HA = path.join(process.cwd(), 'helloassoAPI', 'token.json')
const TOKEN_GOOGLE = path.join(process.cwd(), 'googleAPI', 'token.json')

const main = async () => {
  await fs.writeFile(TOKEN_HA, JSON.stringify({}, null, 2))
  await fs.writeFile(TOKEN_GOOGLE, JSON.stringify({}, null, 2))
  await generateClubRFID()
  await generateIndivRFID()
}

main()
