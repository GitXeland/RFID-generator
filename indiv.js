require('colors')
const fs = require('fs').promises
const path = require('path')
const process = require('process')

const { getItemById, getItems, getFormByName, getFormPayments } = require('./helloAssoAPI')
const { getMembers, assignMember, markPayments, getTreatedPayments, addMembers } = require('./googleAPI')
const { createContact, sendMail } = require('./brevoAPI')
const generateRFID = require('./generateRFID')

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

let generateIndivRFID = async () => {
  // const GOOGLE_PATH = path.join(process.cwd(), 'googleAPI', 'token.json')
  // await fs.writeFile(GOOGLE_PATH, '')
  const HELLOASSO_PATH = path.join(process.cwd(), 'helloassoAPI', 'token.json')
  await fs.writeFile(HELLOASSO_PATH, JSON.stringify({}))

  const RFIDS_PATH = path.join(process.cwd(), 'RFIDS.json')
  const content = await fs.readFile(RFIDS_PATH)
  let RFIDS = JSON.parse(content)
  let globalId = RFIDS.length + 1
  let nb_RF_RFIDs = RFIDS.filter((member) => member.Club == 'Fédération').length + 1

  //* Get all untreated payments to date
  let form = await getFormByName('Saison 2025 - Licence individuelle sans club')
  let payments = await getFormPayments(form)
  let treatedPayments = await getTreatedPayments()
  treatedPayments = treatedPayments.map((tp) => tp.Paiement)
  // console.log(treatedPayments)
  let notTreatedPayments = payments.filter((p) => !treatedPayments.includes(String(p.order.id))).reverse()
  // console.table(notTreatedPayments, ['date', 'amount'])
  // let notTreatedPayments = [{ id: '12345678' }]
  if (notTreatedPayments.length == 0) return console.log('No individual payments found')

  //* For each payement not treated yet
  let newMembers = []
  let newPayements = []
  let activatedMembers = []
  let assignments = []

  for (let payment of notTreatedPayments) {
    //* Get payement info
    // console.log(payment)
    const items = await getItems(payment.items)
    const { payer, customFields, order } = items[0]

    const { firstName, lastName, email, country } = payer
    const phone = customFields?.find((cF) => cF.name == 'Tel / Phone')?.answer
    const gender = customFields?.find((cF) => cF.name == 'Genre / Gender')?.answer
    const orderId = order.id

    //* update member if already in database
    let oldMember = RFIDS.find((m) => m.Mail == email)

    let member
    if (oldMember && !oldMember.actif) {
      RFIDS.find((m) => m.Mail == email).actif = true
      RFIDS.find((m) => m.Mail == email).Prénom = firstName
      RFIDS.find((m) => m.Mail == email).Nom = lastName
      RFIDS.find((m) => m.Mail == email).Genre = gender
      RFIDS.find((m) => m.Mail == email).Paiement = String(orderId)
      RFIDS.find((m) => m.Mail == email).Club = 'Fédération'
      RFIDS.find((m) => m.Mail == email).Tel = phone
      member = oldMember
    } else if (oldMember && oldMember.actif) {
      console.log(`The member ${firstName.red} ${lastName.red} is already active for the current year. Contact them & refund payment ${orderId.red}\n`)
      continue
    } else {
      member = {
        Id: globalId++,
        Club_Id: nb_RF_RFIDs++,
        Prénom: firstName,
        Nom: lastName,
        Tel: phone,
        Mail: email,
        Genre: gender,
        Club: 'Fédération',
        'Date RFID': new Date().toString(),
        Paiement: String(orderId),
        Pays: country,
      }

      member.RFID = generateRFID(member)
      await createContact(member)
      newMembers.push(member)
    }
    sendMail(member)
    activatedMembers.push(member)
    newPayements.push(payment)

    console.log(`The payment ${member.Paiement.green} has been used to generate a RFID for ${firstName.blue} ${lastName.blue}\n`)
  }
  await Promise.all(assignments)

  console.table(activatedMembers, ['Prénom', 'Nom', 'RFID', 'Pays'])

  //* mark new payments down as treated
  await markPayments(newPayements)

  //* save new members into local database
  RFIDS.push(...newMembers)
  await fs.writeFile(RFIDS_PATH, JSON.stringify(RFIDS, null, 2))

  //*save new member into online database
  await addMembers(activatedMembers)
}

module.exports = {
  generateIndivRFID,
}
