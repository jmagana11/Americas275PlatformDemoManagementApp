/* 
* <license header>
*/

jest.mock('@adobe/aio-sdk', () => ({
  Core: {
    Logger: jest.fn()
  }
}))

const { Core } = require('@adobe/aio-sdk')
const mockLoggerInstance = { info: jest.fn(), debug: jest.fn(), error: jest.fn() }
Core.Logger.mockReturnValue(mockLoggerInstance)

jest.mock('node-fetch')
const fetch = require('node-fetch')
const action = require('./../actions/refreshSegment/index.js')

beforeEach(() => {
  Core.Logger.mockClear()
  mockLoggerInstance.info.mockReset()
  mockLoggerInstance.debug.mockReset()
  mockLoggerInstance.error.mockReset()
})

const fakeParams = {
  apiKey: 'fake-api-key',
  orgId: 'fake-org',
  __ow_headers: {
    authorization: 'Bearer fake',
    sandboxname: 'fake-sandbox',
    segmentids: 'segment-1,segment-2'
  }
}
describe('refreshSegment', () => {
  test('main should be defined', () => {
    expect(action.main).toBeInstanceOf(Function)
  })
  test('should set logger to use LOG_LEVEL param', async () => {
    await action.main({ ...fakeParams, LOG_LEVEL: 'fakeLevel' })
    expect(Core.Logger).toHaveBeenCalledWith(expect.any(String), { level: 'fakeLevel' })
  })
  test('should return an http reponse with the fetched content', async () => {
    const mockFetchResponse = {
      ok: true,
      json: () => Promise.resolve({ content: 'fake' })
    }
    fetch.mockResolvedValue(mockFetchResponse)
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      statusCode: 200,
      body: { content: 'fake' }
    })
  })
  test('if there is an error should return a 500 and log the error', async () => {
    const fakeError = new Error('fake')
    fetch.mockRejectedValue(fakeError)
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: {
        statusCode: 500,
        body: { error: 'fake' }
      }
    })
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(fakeError)
  })
  test('if returned service status code is not ok should return a 500 and log the status', async () => {
    const mockFetchResponse = {
      ok: false,
      status: 404,
      text: () => Promise.resolve('fake status')
    }
    fetch.mockResolvedValue(mockFetchResponse)
    const response = await action.main(fakeParams)
    expect(response).toEqual({
      error: {
        statusCode: 500,
        body: { error: 'Adobe API request failed with status 404: fake status' }
      }
    })
    // error message should contain 404
    expect(mockLoggerInstance.error).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('404') }))
  })
  test('missing input request parameters, should return 400', async () => {
    const response = await action.main({})
    expect(response).toEqual({
      error: {
        statusCode: 400,
        body: { error: 'Missing required headers: segmentids or sandboxname' }
      }
    })
  })
})
