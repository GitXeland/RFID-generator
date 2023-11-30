const { v5 } = require('uuid')

const genUid = (seed) => v5(seed, v5.URL)

module.exports = (member) => {
  let id = member.id
  let firstname = member['Prénom']
  let lastname = member.Nom

  const fTocap = (text) => text[0].toUpperCase()

  let RFID = genUid(String(id) + fTocap(firstname) + fTocap(lastname))

  return 'FR' + RFID.toUpperCase().slice(0, 8)
}
