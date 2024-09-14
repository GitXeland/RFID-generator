const fs = require('fs').promises
const path = require('path')
const process = require('process')
const { default: axios } = require('axios')

const CREDENTIALS_PATH = path.join(process.cwd(), 'helloassoAPI', 'credentials.json')
const TOKEN_PATH = path.join(process.cwd(), 'helloassoAPI', 'token.json')

let getToken = async () => {
  let content = await fs.readFile(CREDENTIALS_PATH)
  let credentials = JSON.parse(content)

  const { data } = await axios.post(
    'https://api.helloasso.com/oauth2/token',
    {
      client_id: credentials.client_id,
      client_secret: credentials.client_secret,
      grant_type: 'client_credentials',
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
  // console.log('got token')
  return data
}

let refreshToken = async (refresh_token) => {
  let content = await fs.readFile(CREDENTIALS_PATH)
  let credentials = JSON.parse(content)

  const { data } = await axios.post(
    'https://api.helloasso.com/oauth2/token',
    {
      client_id: credentials.client_id,
      grant_type: 'refresh_token',
      refresh_token,
    },
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
  // console.log('refreshed token')
  return data
}

let authorize = async () => {
  let content = await fs.readFile(TOKEN_PATH)
  let token = JSON.parse(content)
  if (!token.refresh_token) {
    let data = await getToken()
    let refreshData = await refreshToken(data.refresh_token)
    token = {
      access_token: refreshData.access_token,
      refresh_token: refreshData.refresh_token,
      date: new Date(),
    }
    await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2))
  }

  return { access_token: token.access_token }
}

let getPayments = async () => {
  let maxIndex
  let payments = []
  let index = 1
  let { access_token } = await authorize()
  do {
    let { data } = await axios.get(`https://api.helloasso.com/v5/organizations/roundnet-france/payments?pageIndex=${index}&pageSize=100`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })
    maxIndex = data.pagination.totalPages
    index++
    payments = [...payments, ...data.data]
  } while (index <= maxIndex)

  return payments
}

let getForms = async () => {
  let maxIndex
  let forms = []
  let index = 1
  let { access_token } = await authorize()
  do {
    let { data } = await axios.get(`https://api.helloasso.com/v5/organizations/roundnet-france/forms?pageIndex=${index}&pageSize=100`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })
    maxIndex = data.pagination.totalPages
    index++
    forms = [...forms, ...data.data]
  } while (index <= maxIndex)

  return forms
}

let getFormByName = async (name) => {
  let forms = await getForms()
  let form = forms.find((f) => f.title === name)

  return form || `There is no form named "${name}"`
}

let getPaymentByOrderId = async (orderId) => {
  let payments = getPayments()
  let payment = payments.find((p) => p.order.id === Number(orderId))

  return payment || `The payment order ${orderId} has not been found.`
}

const getItemById = async (itemId) => {
  let { access_token } = await authorize()

  // console.log(`/items/${itemId}?withDetails=true`)

  let { data } = await axios.get(`https://api.helloasso.com/v5/items/${itemId}?withDetails=true`, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  })

  let item = data

  return item || `The iten ${itemId} has not been found.`
}

const getItems = async (items) => {
  let { access_token } = await authorize()

  // console.log(`/items/${itemId}?withDetails=true`)
  let returnItems = []
  for (let item of items) {
    let { data } = await axios.get(`https://api.helloasso.com/v5/items/${item.id}?withDetails=true`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    returnItems.push(data)
  }

  return returnItems
}

const getFormPayments = async (form) => {
  let { access_token } = await authorize()

  let { formType, formSlug } = form
  let maxIndex
  let payments = []
  let index = 1

  do {
    // console.log(`/forms/${formType}/${formSlug}/payments?pageIndex=${index}&pageSize=100`)
    let { data } = await axios.get(
      `https://api.helloasso.com/v5/organizations/roundnet-france/forms/${formType}/${formSlug}/payments?pageIndex=${index}&pageSize=100`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    )
    maxIndex = data.pagination.totalPages
    index++
    payments = [...payments, ...data.data]
  } while (index <= maxIndex)

  return payments
}

const getFormOrders = async (form) => {
  let { access_token } = await authorize()

  let { formType, formSlug } = form
  let maxIndex
  let payments = []
  let index = 1

  do {
    // console.log(`/forms/${formType}/${formSlug}/orders?pageIndex=${index}&pageSize=100`)
    let { data } = await axios.get(
      `https://api.helloasso.com/v5/organizations/roundnet-france/forms/${formType}/${formSlug}/orders?pageIndex=${index}&pageSize=100`,
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    )
    maxIndex = data.pagination.totalPages
    index++
    payments = [...payments, ...data.data]
  } while (index <= maxIndex)

  return payments
}

module.exports = {
  getPayments,
  getFormByName,
  getPaymentByOrderId,
  getItemById,
  getItems,
  getFormPayments,
  getFormOrders,
}
