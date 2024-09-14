require('colors')
const fs = require('fs').promises
const path = require('path')
const process = require('process')

const { getItemById, getItems, getFormByName, getFormPayments } = require('./helloAssoAPI')
const { getMembers, assignRFID, markPayments, getTreatedPayments, addMembers } = require('./googleAPI')
const { createContact, sendMail } = require('./emailAPI')
const generateRFID = require('./generateRFID')

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

let generateClubRFID = async () => {
  // const GOOGLE_PATH = path.join(process.cwd(), 'googleAPI', 'token.json')
  // await fs.writeFile(GOOGLE_PATH, '')
  const HELLOASSO_PATH = path.join(process.cwd(), 'helloassoAPI', 'token.json')
  await fs.writeFile(HELLOASSO_PATH, JSON.stringify({}))

  const RFIDS_PATH = path.join(process.cwd(), 'RFIDS.json')
  const content = await fs.readFile(RFIDS_PATH)
  let RFIDS = JSON.parse(content)
  let globalId = RFIDS.length + 1

  //* Get all untreated payments to date
  let form = await getFormByName('Saison 2024 - Licences individuelles Roundnet France')
  let payments = await getFormPayments(form)
  let treatedPayments = await getTreatedPayments()
  treatedPayments = treatedPayments.map((tp) => tp.Paiement)
  // console.log(treatedPayments)
  let notTreatedPayments = payments.filter((p) => !treatedPayments.includes(String(p.order.id))).reverse()
  // console.table(notTreatedPayments, ['date', 'amount'])
  // let notTreatedPayments = [{ id: '12345678' }]
  if (notTreatedPayments.length == 0) console.log('No club payments found')

  //* For each payement not treated yet
  let newMembers = []
  let newPayements = []
  for (let payment of notTreatedPayments) {
    //* Get payement info
    // console.log(payment)
    const paymentID = String(payment.order.id)
    const items = await getItems(payment.items)
    // find item with customFields
    const item = items.find((i) => i.customFields)
    // discard event with no customFields attribute
    if (!item) {
      console.log(`\nPayment ${paymentID.red} from ${payment.payer.firstName} ${payment.payer.lastName} has no customFields attribute.\n`)
      continue
    }
    const club = item.customFields.find((cF) => cF.name == 'Club').answer
    const nbRFID = payment.amount / 1000
    // console.log({ club })
    // console.log({ nbRFID })
    // const club = 'Roundnet Lyon'
    // const nbRFID = 10
    console.log(`\nTreating payment ${paymentID.blue} for ${club.blue}\n`)

    //todo message d'erreur si la feuille n'a pas le bon nom

    //* Find list of members getting a RFID
    let members = await getMembers(club)
    members = members.filter((m) => m.Nom)
    let membersToRFID = members?.filter((m) => m.Paiement == paymentID)
    // console.table(membersToRFID)
    //* If amount payed equals the number of RFID asked
    if (membersToRFID.length === nbRFID) {
      let assignments = []
      for (let member of membersToRFID) {
        //* update member
        member.Club_Id = member.Id
        member.Club = club
        member.Id = globalId++
        member.RFID = generateRFID(member)
        member['Date RFID'] = new Date().toString()
        newMembers.push(member)

        //* write RFID in the google sheet
        await delay(3000)
        assignments.push(assignRFID(member))

        //* send mail
        await createContact(member)
        // sendMail(member)
      }
      await Promise.all(assignments)

      payment.time = new Date().toString()
      payment.nbRFID = nbRFID
      payment.club = club
      newPayements.push(payment)
      console.log(`The payment ${paymentID.green} from ${club.green} has been used to generate ${String(nbRFID).green} RFIDs\n`)
    } else {
      console.log(
        `The payment ${paymentID.red} from ${club.red} is too ${
          membersToRFID.length < nbRFID ? 'big' : 'small'
        } compared to the number of RFID requested.`
      )
      console.log(`${String(membersToRFID.length).red} asked and ${String(nbRFID).red} payed. Contact ${club.red} to fix the mistake.\n`)
    }
  }
  console.table(newMembers, ['Prénom', 'Nom', 'RFID', 'Club'])

  //* mark new payments down as treated
  await markPayments(newPayements)

  //* save new members into local database
  RFIDS.push(...newMembers)
  await fs.writeFile(RFIDS_PATH, JSON.stringify(RFIDS, null, 2))

  //*save new member into online database
  await addMembers(newMembers)
}

module.exports = {
  generateClubRFID,
}
