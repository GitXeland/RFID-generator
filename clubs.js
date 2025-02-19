require('colors')
const fs = require('fs').promises
const path = require('path')
const process = require('process')
require('dotenv').config()

const { CLUBFORM } = process.env
const RFIDS_PATH = path.join(process.cwd(), 'RFIDs.json')

const { getItemById, getItems, getFormByName, getFormPayments } = require('./helloAssoAPI')
const { getMembers, assignRFID, markPayments, getTreatedPayments, addMembers, getFileByName } = require('./googleAPI')
const { createContact, sendMail } = require('./brevoAPI')
const generateRFID = require('./generateRFID')

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time))
}

async function getRFIDs() {
  const content = await fs.readFile(RFIDS_PATH)
  let RFIDS = JSON.parse(content)
  return RFIDS
}

async function getUntreatedPayments() {
  //* Get all untreated payments to date
  let form = await getFormByName(CLUBFORM)
  let payments = await getFormPayments(form)
  let treatedPayments = await getTreatedPayments()
  treatedPayments = treatedPayments.map((tp) => tp.Paiement)
  // console.log(treatedPayments)
  let notTreatedPayments = payments.filter((p) => !treatedPayments.includes(String(p.order.id))).reverse()
  // console.table(notTreatedPayments, ['date', 'amount'])
  // let notTreatedPayments = [{ id: '12345678' }]
  if (notTreatedPayments.length == 0) console.log('No club payments found')
  return notTreatedPayments
}

let generateClubRFID = async () => {
  // const GOOGLE_PATH = path.join(process.cwd(), 'googleAPI', 'token.json')
  // await fs.writeFile(GOOGLE_PATH, '')
  const HELLOASSO_PATH = path.join(process.cwd(), 'helloassoAPI', 'token.json')
  await fs.writeFile(HELLOASSO_PATH, JSON.stringify({}))

  let RFIDS = await getRFIDs()
  let globalId = RFIDS.length + 1

  let notTreatedPayments = await getUntreatedPayments()
  if (notTreatedPayments.length == 0) return

  //* For each payement not treated yet
  let newMembers = []
  let activatedMembers = []
  let newPayements = []
  let membersToAssign = []
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
    members = members.filter((m) => m.Mail) //! il faut avoir un mail pour avoir une licence (RFID)
    let membersToRFID = members?.filter((m) => m.Paiement == paymentID)
    // console.table(membersToRFID)

    //* Check that all members have a unique mail : else pass the club
    let duplicateMails = membersToRFID.filter((m) => membersToRFID.filter((m2) => m2.Mail == m.Mail).length > 1)
    if (duplicateMails.length > 0) {
      console.log(`Members from ${club} have duplicate mails :`)
      console.table(duplicateMails, ['Prénom', 'Nom', 'Mail'])
      console.log(`Contact ${club} to fix the mistake.\n`)
      continue
    }

    //* Check that all members have a mail, correct format : else pass the club
    let wrongMails = membersToRFID.filter((m) => !m.Mail || !m.Mail.includes('@') || !m.Mail.includes('.'))
    if (wrongMails.length > 0) {
      console.log(`Members from ${club} have wrong mails :`)
      console.table(wrongMails, ['Prénom', 'Nom', 'Mail'])
      console.log(`Contact ${club} to fix the mistake.\n`)
      continue
    }

    //* Check that all members have a firstname and a name : else pass the club
    let wrongNames = membersToRFID.filter((m) => !m.Nom || !m.Prénom)
    if (wrongNames.length > 0) {
      console.log(`Members from ${club} have no name or firstname :`)
      console.table(wrongNames, ['Id', 'Prénom', 'Nom'])
      console.log(`Contact ${club} to fix the mistake.\n`)
      continue
    }

    //* Check that all members have a gender equal to M or F : else pass the club
    let wrongGenders = membersToRFID.filter((m) => !['M', 'F'].includes(m.Genre))
    if (wrongGenders.length > 0) {
      console.log(`Members from ${club} have something else than M or F as gender :`)
      console.table(wrongGenders, ['Id', 'Prénom', 'Nom', 'Genre'])
      console.log(`Contact ${club} to fix the mistake.\n`)
      continue
    }

    //* If amount payed equals the number of RFID asked
    if (membersToRFID.length === nbRFID) {
      let errorMembers = []
      for (let member of membersToRFID) {
        //* update member if already in database
        let mail = member.Mail
        let oldMember = RFIDS.find((m) => m.Mail == mail)
        if (oldMember && !oldMember.actif) {
          RFIDS.find((m) => m.Mail == mail).actif = true
          RFIDS.find((m) => m.Mail == mail).Prénom = member.Prénom
          RFIDS.find((m) => m.Mail == mail).Nom = member.Nom
          RFIDS.find((m) => m.Mail == mail).Genre = member.Genre
          RFIDS.find((m) => m.Mail == mail).Paiement = member.Paiement
          RFIDS.find((m) => m.Mail == mail).Club_Id = member.Id
          RFIDS.find((m) => m.Mail == mail).Club = club
          RFIDS.find((m) => m.Mail == mail).Tel = member.Tel
          member = RFIDS.find((m) => m.Mail == mail)
          activatedMembers.push(member)
        } else if (oldMember && oldMember.actif) {
          console.log(`Member ${member.Prénom} ${member.Nom} already active in 2025, contact ${club} to warn the player.`)
          errorMembers.push(member)
          continue
        } else {
          //* create new member
          member.Club_Id = member.Id
          member.Club = club
          member.Id = globalId++
          member.RFID = generateRFID(member)
          member.actif = true
          member['Date RFID'] = new Date().toString()
          newMembers.push(member)
          activatedMembers.push(member)

          //* create contact in the email list
          await createContact(member)
        }

        membersToAssign.push(member)
      }

      if (errorMembers.length > 0) {
        console.log(`\nMembers from ${club} already active in 2025 :`)
        console.table(errorMembers, ['Prénom', 'Nom', 'Mail'])
        console.log(`Contact ${club} to fix the mistake.\n`)
      } else {
        let assignments = []

        //* write RFID in the google sheet
        for (let member of membersToAssign) {
          await delay(3000)
          assignments.push(assignRFID(member))
        }

        await Promise.all(assignments)

        payment.time = new Date().toString()
        payment.nbRFID = nbRFID
        payment.club = club
        newPayements.push(payment)
        console.log(`The payment ${paymentID.green} from ${club.green} has been used to generate ${String(nbRFID).green} RFIDs\n`)
      }
    } else {
      console.log(
        `The payment ${paymentID.red} from ${club.red} is too ${membersToRFID.length < nbRFID ? 'big' : 'small'} compared to the number of RFID requested.`
      )
      console.log(`${String(membersToRFID.length).red} asked and ${String(nbRFID).red} payed. Contact ${club.red} to fix the mistake.\n`)
    }
  }
  console.table(activatedMembers, ['Prénom', 'Nom', 'RFID', 'Club'])

  //* mark new payments down as treated
  await markPayments(newPayements)

  //* save new members into local database
  RFIDS.push(...newMembers)
  await fs.writeFile(RFIDS_PATH, JSON.stringify(RFIDS, null, 2))

  //*save new member into online database
  await addMembers(activatedMembers)
}

module.exports = {
  generateClubRFID,
}
