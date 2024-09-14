// const fs = require('fs').promises
// const path = require('path')

// const { getMembers, assignRFID, markPayments, getTreatedPayments, addMembers } = require('./googleAPI')
// function delay(time) {
//   return new Promise((resolve) => setTimeout(resolve, time))
// }

// let replaceRFIDs = async () => {
//   //OFFLINE
//   const RFIDS_PATH = path.join(process.cwd(), 'RFIDS.json')
//   const content = await fs.readFile(RFIDS_PATH)
//   let members = JSON.parse(content)
  // let newMembers = []
  // let newRFIDS = []
  // for (let member of RFIDS) {
  //   let newMember = member
  //   newMember.RFID = generateRFID(member)
  //   newRFIDS.push(newMember)
  //   newMembers.push(newMember)
  // }
  // await fs.writeFile(RFIDS_PATH, JSON.stringify(RFIDS, null, 2))

  //ONLINE
  //replace in the main file
  // for (let member of members) {
  //   await delay(3000)
  //   assignRFID(member)
  //   console.log(member.Id, member.Club)
  }
  // await addMembers(members)
}

// replaceRFIDs()
