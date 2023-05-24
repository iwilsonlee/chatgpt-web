export {}

// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'; // set environment variable to skip certificate validation

const https = require('https');
const yourApiKey = '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';
const options = { host: 'api.openai.com', path: '/v1/engines/davinci/completions',
method: 'POST',
headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${yourApiKey}`, }, };

const req = https.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log(JSON.parse(data))
  })
})

req.on('error', (error) => {
  console.error(error)
})

req.write('{"prompt": "Hello, world!"}')
req.end()
