/*
* <license header>
*/

jest.mock('axios', () => ({
  get: jest.fn()
}))

const axios = require('axios')
const action = require('./../actions/generic/index.js')

beforeEach(() => {
  axios.get.mockReset()
})

const fakeParams = { __ow_headers: { authorization: 'Bearer fake' } }

describe('generic', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })

  test('should return an http response with the fetched content', async () => {
    axios.get.mockResolvedValue({ data: { content: 'fake' } })

    const response = await action.main(fakeParams)

    expect(axios.get).toHaveBeenCalledWith('https://adobeioruntime.net/api/v1', {
      headers: {
        Authorization: 'Bearer fake',
        'Content-Type': 'application/json',
        Accept: 'application/json'
      }
    })
    expect(response).toEqual({
      statusCode: 200,
      body: { content: 'fake' }
    })
  })

  test('if axios returns a service error should return that status and details', async () => {
    axios.get.mockRejectedValue({
      message: 'request failed',
      response: {
        status: 404,
        data: { error: 'not found' }
      }
    })

    const response = await action.main(fakeParams)

    expect(response).toEqual({
      statusCode: 404,
      body: {
        error: 'Generic API failed with status: 404',
        details: { error: 'not found' }
      }
    })
  })

  test('if axios throws should return a 500 with details', async () => {
    axios.get.mockRejectedValue(new Error('fake'))

    const response = await action.main(fakeParams)

    expect(response).toEqual({
      statusCode: 500,
      body: { error: 'Internal server error', details: 'fake' }
    })
  })

  test('missing authorization should return 400', async () => {
    const response = await action.main({})

    expect(response).toEqual({
      statusCode: 400,
      body: { error: 'Missing or invalid Authorization header' }
    })
  })
})
