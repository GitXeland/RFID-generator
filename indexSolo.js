require('colors')
const fs = require('fs').promises
const path = require('path')
const process = require('process')

const { getItemById, getFormByName, getFormOrders } = require('./helloAssoAPI')
const { getMembers, assignRFID, markPayments, getTreatedPayments, addMembers } = require('./googleAPI')
const generateRFID = require('./generateRFID')

let main = async () => {
  // const GOOGLE_PATH = path.join(process.cwd(), 'googleAPI', 'token.json')
  // await fs.writeFile(GOOGLE_PATH, '')
  const HELLOASSO_PATH = path.join(process.cwd(), 'helloassoAPI', 'token.json')
  await fs.writeFile(HELLOASSO_PATH, JSON.stringify({}))

  const RFIDS_PATH = path.join(process.cwd(), 'RFIDS.json')
  const content = await fs.readFile(RFIDS_PATH)
  let RFIDS = JSON.parse(content)
  let globalId = RFIDS.length + 1

  //* Get all untreated payments to date
  let form = await getFormByName('Saison 2024 - Licence individuelle sans club')
  let payments = await getFormOrders(form)
  let existingMembers = await getMembers('Fédération')
  existingMembers = existingMembers.filter((m) => m.Paiement).map((m) => m.Paiement)
  let Club_Id = existingMembers.length
  // console.log(treatedPayments)
  let notTreatedPayments = payments.filter((p) => !existingMembers.includes(String(p.id))).reverse()
  // let notTreatedPayments = [{ id: '12345678' }]

  if (notTreatedPayments.length == 0) console.log('No payments found')

  //* For each payement not treated yet
  let newMembers = []
  let newPayements = []
  for (let payment of notTreatedPayments) {
    //* Get payement info
    // console.log(payment)
    const paymentID = String(payment.id)
    const item = await getItemById(payment.id)
    const phone = item.customFields.find((cF) => cF.name == 'Tel / Phone').answer
    const gender = item.customFields.find((cF) => cF.name == 'Genre / Gender').answer
    const { firstName, lastName, country, email } = item.payer
    let member = {
      Id: globalId++,
      Club_id: Club_Id++,
      firstName,
      lastName,
      phone,
      email,
      gender,
      Club: 'Fédération',
      RFID: generateRFID(member),
      'Date RFID': new Date().toString(),
      paymentID,
      country,
    }
    newMembers.push(member)
    newPayements.push(payment)

    //* add member to file online
    assignRFID(member)
  }
  console.table(newMembers)

  //* mark new payments down as treated
  await markPayments(newPayements)

  //* save new members into local database
  RFIDS.push(...newMembers)
  await fs.writeFile(RFIDS_PATH, JSON.stringify(RFIDS, null, 2))

  //*save new member into online database
  await addMembers(newMembers)
}

main()
