const fs = require('fs').promises
const path = require('path')
const process = require('process')
require('dotenv').config()
const { default: axios } = require('axios')

const { BREVO_API_KEY } = process.env

let updateContactwithRFID = async (mail, RFID) => {
  try {
    const { data } = await axios.put(
      `https://api.brevo.com/v3/contacts/${mail}`,
      {
        attributes: { RFID: RFID },
      },
      {
        headers: {
          Accept: 'application/json',
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log(`${mail} updated with correct RFID : ${RFID}`)
  } catch (e) {
    console.log(e)
  }
}

// updateContactwithRFID('Gabriel.chamoulaud@gmail.com', 'FR29F02472')

let createContact = async (player) => {
  if (!player.Mail) {
    console.log(`Pas de mail pour le membre ${player.Prénom} ${player.Nom}`)
    return null
  }
  try {
    const { data } = await axios.post(
      'https://api.brevo.com/v3/contacts',
      {
        email: player.Mail,
        attributes: { CLUB: player.Club, PRENOM: player.Prénom, NOM: player.Nom, RFID: player.RFID },
      },
      {
        headers: {
          Accept: 'application/json',
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )
  } catch (e) {
    if (e.response.data.message == 'Unable to create contact, email is already associated with another Contact') {
      console.log('Contact already existing, updating RFID')
      updateContactwithRFID(player.Mail, player.RFID)
    } else {
      {
        console.log('Brevo API error (not treated) :')
        console.log(e.response.data.message)
        console.log(player.Mail)
      }
    }
  }
}

let sendMail = async (player) => {
  try {
    const { data } = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          name: 'Alex',
          email: 'roundnetfrance@gmail.com',
        },
        to: [
          {
            email: player.Mail,
          },
        ],
        templateId: 4,
      },
      {
        headers: {
          Accept: 'application/json',
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )
    console.log(`Mail envoyé pour à ${player.Prénom} ${player.Nom} à l'adresse ${player.Mail}`)
  } catch (e) {
    console.log(e)
    console.log(e.message)
    console.log(e.response.data.message)
  }
}

let createAndSend = async (Id) => {
  const RFIDS_PATH = path.join(process.cwd(), 'RFIDS.json')
  const content = await fs.readFile(RFIDS_PATH)
  let RFIDS = JSON.parse(content)
  // let account = await createContact(RFIDS.find((e) => e.Id == Id))
  // if (account) {
  sendMail(RFIDS.find((e) => e.Id == Id))
  console.log(`created account and sent mail for ${RFIDS[Id - 1].Prénom} ${RFIDS[Id - 1].Nom}`)
  // }
}

// for (let i = 769; i < 770; i++) {
// createAndSend(i)
// }

// createAndSend(739)

module.exports = {
  createContact,
  sendMail,
}
