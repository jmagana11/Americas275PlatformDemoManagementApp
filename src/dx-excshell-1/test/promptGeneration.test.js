jest.mock('node-fetch')

const fetch = require('node-fetch')
const action = require('../actions/prompt-generation/index.js')

const AZURE_ENV_KEYS = [
  'AZURE_OPENAI_ENDPOINT',
  'AZURE_OPENAI_KEY'
]

let originalEnv

beforeEach(() => {
  fetch.mockReset()
  originalEnv = {}
  for (const key of AZURE_ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of AZURE_ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  }
})

describe('prompt-generation', () => {
  test('returns the existing missing-config response when Azure OpenAI config is absent', async () => {
    const response = await action.main({
      imageName: 'sample.png',
      selectedTags: ['blue', 'chair']
    })

    expect(fetch).not.toHaveBeenCalled()
    expect(response).toEqual({
      statusCode: 500,
      body: { error: 'Azure OpenAI configuration is missing' }
    })
  })

  test('uses Azure OpenAI config from env fallback and preserves success response shape', async () => {
    process.env.AZURE_OPENAI_ENDPOINT = 'https://openai.example.test/chat'
    process.env.AZURE_OPENAI_KEY = 'fake-openai-key'
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'request-1',
        choices: [
          {
            message: {
              content: ' Generated prompt text '
            }
          }
        ],
        usage: {
          prompt_tokens: 1
        }
      })
    })

    const response = await action.main({
      imageName: 'sample.png',
      selectedTags: ['blue', { name: 'chair' }],
      promptType: 'marketing SMS'
    })

    expect(fetch).toHaveBeenCalledWith('https://openai.example.test/chat', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'Content-Type': 'application/json',
        'api-key': 'fake-openai-key'
      })
    }))
    expect(response).toEqual({
      statusCode: 200,
      body: {
        imageName: 'sample.png',
        selectedTags: ['blue', { name: 'chair' }],
        promptType: 'marketing SMS',
        generatedPrompt: 'Generated prompt text',
        usage: {
          prompt_tokens: 1
        },
        requestId: 'request-1'
      }
    })
  })
})
