const fs = require('fs').promises
const path = require('path')
const process = require('process')
const { authenticate } = require('@google-cloud/local-auth')
const { google } = require('googleapis')

const mainFileId = '1pw4bhUJ9dkkiAz05S01DyYM9sevfQbckSsVF5b4P0jM' //! This is the id for the 2025 file

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/gmail.send']
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'googleAPI', 'token.json')
const CREDENTIALS_PATH = path.join(process.cwd(), 'googleAPI', 'credentials.json')

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH)
    const credentials = JSON.parse(content)
    return google.auth.fromJSON(credentials)
  } catch (err) {
    return null
  }
}

/**
 * Serializes credentials to a file comptible with GoogleAUth.fromJSON.
 *
 * @param {OAuth2Client} client
 * @return {Promise<void>}
 */
async function saveCredentials(client) {
  const content = await fs.readFile(CREDENTIALS_PATH)
  const keys = JSON.parse(content)
  const key = keys.installed || keys.web
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  })
  await fs.writeFile(TOKEN_PATH, payload)
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  let client = await loadSavedCredentialsIfExist()
  if (client) {
    return client
  }
  client = await authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  })
  if (client.credentials) {
    await saveCredentials(client)
  }
  return client
}

/**
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */
async function getSpreadsheetData(spreadsheetId, range) {
  let auth = await authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })
    const rows = res.data.values
    if (!rows || rows.length === 0) {
      console.log('No data found.')
      return
    }
    return rows
  } catch (e) {
    console.log(e)
    return undefined
  }
}

async function writeCell(spreadsheetId, range, text) {
  let auth = await authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  try {
    sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values: [[text]] },
    })
  } catch (e) {
    console.log('Error while writing in a spreadsheet')
    console.log(e.errors)
  }
}

async function appendRows(spreadsheetId, range, rows) {
  let auth = await authorize()
  const sheets = google.sheets({ version: 'v4', auth })
  try {
    sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      resource: { values: rows },
    })
  } catch (e) {
    console.log('Error while writing in a spreadsheet')
    console.log(e.errors)
  }
}

/**
 * Get the name of the folder containing a given file.
 * @param {string} fileId - The ID of the file.
 * @param {string} auth - The authenticated OAuth2 client.
 * @returns {Promise<string>} - The name of the folder or a message if not found.
 */
async function getFolderName(fileId, auth) {
  const drive = google.drive({ version: 'v3', auth })

  try {
    // Step 1: Get the file's metadata to retrieve its parents
    const fileResponse = await drive.files.get({
      fileId: fileId,
      fields: 'parents',
    })

    const parentFolderId = fileResponse.data.parents?.[0]

    if (!parentFolderId) {
      return 'The file is in the root directory or has no parent folder.'
    }

    // Step 2: Get the parent folder's name using its ID
    const folderResponse = await drive.files.get({
      fileId: parentFolderId,
      fields: 'name',
    })

    return folderResponse.data.name
  } catch (error) {
    console.error('Error fetching folder name:', error.message)
    throw new Error('Failed to retrieve folder name. Ensure the file ID is correct and permissions are granted.')
  }
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {OAuth2Client} authClient An authorized OAuth2 client.
 */
async function getFileByName(name) {
  try {
    let auth = await authorize()
    const drive = google.drive({ version: 'v3', auth: auth })
    const res = await drive.files.list({
      q: `name = "${name}"`,
      pageSize: 10,
      fields: 'nextPageToken, files(id, name)',
    })
    const files = res.data.files
    if (files.length === 0) {
      console.log(`File not found : ${name}`)
      return
    }
    for (let file of files) {
      let parent = await getFolderName(file.id, auth)
      if (parent === 'Licenciés par clubs - 2025') {
        return file
      }
    }
  } catch (e) {
    console.log(e)
  }
}

async function getMembers(club) {
  // find file containting the data
  let file
  if (club) {
    file = await getFileByName(`licencié.e.s ${club}`)
  } else {
    file = await getFileByName(`2025 - Liste licencié.e.s`)
  }

  // retrieve data from spreadsheet
  if (file) {
    let data = await getSpreadsheetData(file.id, 'licencié.e.s!A1:K')
    if (data) {
      const headers = data.shift()
      let formatedData = data.map((d) => {
        let member = {}
        let index = 0
        for (let header of headers) {
          member[header] = d[index]
          index++
        }
        return member
      })
      return formatedData
    }
  } else return []
}

async function assignRFID(member) {
  // get spreadsheet and verify that RFID is in the correct column
  file = await getFileByName(`licencié.e.s ${member.Club}`)
  if (file) {
    let data = await getSpreadsheetData(file.id, 'licencié.e.s!A1:K')
    if (data) {
      const headers = data.shift()
      if (headers[6] !== 'RFID') {
        console.log(`The RFID column has been moved in the gsheet licencié.e.s ${member.Club}`)
        return
      }
      // write the RFID in the corresponding cell
      await writeCell(file.id, `Licencié.e.s!G${Number(member.Club_Id) + 1}`, member.RFID)
      await writeCell(file.id, `Licencié.e.s!H${Number(member.Club_Id) + 1}`, member['Date RFID'])
    }
  }
}

async function assignMember(member) {
  // get spreadsheet and verify that RFID is in the correct column
  file = await getFileByName(`licencié.e.s ${member.Club}`)
  if (file) {
    let data = await getSpreadsheetData(file.id, 'licencié.e.s!A1:K')
    if (data) {
      const headers = data.shift()
      if (headers[6] !== 'RFID') {
        console.log(`The RFID column has been moved in the gsheet licencié.e.s ${member.Club}`)
        return
      }
      // write the RFID in the corresponding cell

      await writeCell(file.id, `Licencié.e.s!B${Number(member.Club_Id) + 1}`, member.Prénom)
      await writeCell(file.id, `Licencié.e.s!C${Number(member.Club_Id) + 1}`, member.Nom)
      await writeCell(file.id, `Licencié.e.s!D${Number(member.Club_Id) + 1}`, member.Tel)
      await writeCell(file.id, `Licencié.e.s!E${Number(member.Club_Id) + 1}`, member.Mail)
      await writeCell(file.id, `Licencié.e.s!F${Number(member.Club_Id) + 1}`, member.Sexe)
      await writeCell(file.id, `Licencié.e.s!G${Number(member.Club_Id) + 1}`, member.RFID)
      await writeCell(file.id, `Licencié.e.s!H${Number(member.Club_Id) + 1}`, member['Date RFID'])
      await writeCell(file.id, `Licencié.e.s!I${Number(member.Club_Id) + 1}`, member.Paiement)
      await writeCell(file.id, `Licencié.e.s!J${Number(member.Club_Id) + 1}`, member.Pays)
    }
  }
}

async function markPayments(payments) {
  // add a line for the payment
  let rows = payments.map((p) => {
    if (p.nbRFID) return [p.time, p.order.id, p.club, p.nbRFID * 10 + '€', p.nbRFID]
    else return [p.date, p.order.id, 'Fédération', '10€', 1]
  })
  await appendRows(mainFileId, `suivi des paiements!A1`, rows)
}

async function getTreatedPayments() {
  let data = await getSpreadsheetData(mainFileId, 'suivi des paiements!A:E')
  if (data) {
    const headers = data.shift()
    let formatedData = data.map((d) => {
      let member = {}
      let index = 0
      for (let header of headers) {
        member[header] = d[index]
        index++
      }
      return member
    })
    return formatedData
  } else {
    return []
  }
}

async function addMembers(members) {
  let rows = members.map((m) => [m.Id, m.Club_Id, m.Prénom, m.Nom, m.Tel, m.Mail, m.Sexe, m.Club, m.RFID, m['Date RFID'], m.Paiement])
  await appendRows(mainFileId, `licencié.e.s!A1`, rows)
}

module.exports = {
  getMembers,
  addMembers,
  assignRFID,
  assignMember,
  getTreatedPayments,
  markPayments,
  getFileByName,
}
