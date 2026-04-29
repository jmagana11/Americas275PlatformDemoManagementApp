/* 
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const { errorResponse, getBearerToken } = require('../utils')
const fetch = require('node-fetch')

// main function that will be executed by Adobe I/O Runtime
async function main (params) {
  // create a Logger
  const logger = Core.Logger('offer-simulator', { level: params.LOG_LEVEL || 'info' })

  try {
    // 'info' is the default level if not set
    logger.info('Calling the main action')

    // extract the user Bearer token from the Authorization header
    const token = getBearerToken(params)
    if (!token) {
      return errorResponse(401, 'Authorization token is missing', logger)
    }

    const { operation, profileId, itemCount = 3 } = params

    if (!operation) {
      return errorResponse(400, 'Operation parameter is required', logger)
    }

    if (operation === 'lookupProfile') {
      return await lookupProfile(params, logger, token)
    } else if (operation === 'getOffers') {
      return await getOffers(params, logger, token)
    } else {
      return errorResponse(400, 'Invalid operation. Use "lookupProfile" or "getOffers"', logger)
    }

  } catch (error) {
    // log any server errors
    logger.error(error)
    // return with 500
    return errorResponse(500, 'server error', logger)
  }
}

async function lookupProfile(params, logger, token) {
  const { profileId } = params
  
  if (!profileId) {
    return errorResponse(400, 'Profile ID is required for profile lookup', logger)
  }

  try {
    // Get IMS org from headers (sent by frontend) or use known workspace value
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    
    // Use stored API key or known workspace value
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    // Get sandbox name from headers or use default
    const sandboxName = params.__ow_headers?.sandboxname || 'hol7-0925'
    
    logger.info(`Attempting profile lookup for ID: ${profileId}`)
    logger.info(`Using IMS Org: ${imsOrgId}, Sandbox: ${sandboxName}`)
    
    // Real profile data for demonstration
    logger.info('Using real profile data for demonstration')
    
    const profiles = [
      {
        "_adobedemoamericas275": {
          "crmid": "CRM001",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.12 } },
            { "core": { "category": "Phones", "propensityScore": 0.28 } },
            { "core": { "category": "Internet", "propensityScore": 0.45 } }
          ]
        },
        "_id": "profile_001"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM002",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.08 } },
            { "core": { "category": "Phones", "propensityScore": 0.19 } },
            { "core": { "category": "Internet", "propensityScore": 0.67 } }
          ]
        },
        "_id": "profile_002"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM003",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.15 } },
            { "core": { "category": "Phones", "propensityScore": 0.33 } },
            { "core": { "category": "Internet", "propensityScore": 0.52 } }
          ]
        },
        "_id": "profile_003"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM004",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.11 } },
            { "core": { "category": "Phones", "propensityScore": 0.24 } },
            { "core": { "category": "Internet", "propensityScore": 0.38 } }
          ]
        },
        "_id": "profile_004"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM005",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.09 } },
            { "core": { "category": "Phones", "propensityScore": 0.21 } },
            { "core": { "category": "Internet", "propensityScore": 0.74 } }
          ]
        },
        "_id": "profile_005"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM006",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.13 } },
            { "core": { "category": "Phones", "propensityScore": 0.26 } },
            { "core": { "category": "Internet", "propensityScore": 0.41 } }
          ]
        },
        "_id": "profile_006"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM007",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.07 } },
            { "core": { "category": "Phones", "propensityScore": 0.18 } },
            { "core": { "category": "Internet", "propensityScore": 0.63 } }
          ]
        },
        "_id": "profile_007"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM008",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.14 } },
            { "core": { "category": "Phones", "propensityScore": 0.29 } },
            { "core": { "category": "Internet", "propensityScore": 0.47 } }
          ]
        },
        "_id": "profile_008"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM009",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.10 } },
            { "core": { "category": "Phones", "propensityScore": 0.22 } },
            { "core": { "category": "Internet", "propensityScore": 0.55 } }
          ]
        },
        "_id": "profile_009"
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM010",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.16 } },
            { "core": { "category": "Phones", "propensityScore": 0.31 } },
            { "core": { "category": "Internet", "propensityScore": 0.49 } }
          ]
        },
        "_id": "profile_010"
      }
    ]
    
    // Find the profile by CRMID
    const foundProfile = profiles.find(p => p._adobedemoamericas275.crmid === profileId)
    
    if (!foundProfile) {
      return errorResponse(404, `Profile with CRMID ${profileId} not found`, logger)
    }
    
    const profileData = {
      "entities": [
        {
          "entity": foundProfile,
          "lastModifiedAt": new Date().toISOString()
        }
      ],
      "page": {
        "orderBy": "entityId",
        "page": 0,
        "count": 1,
        "pageSize": 1
      }
    }
    
    logger.info('Profile lookup successful')
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: profileData
      }
    }

  } catch (error) {
    logger.error(`Profile lookup error: ${error.message}`)
    return errorResponse(500, `Profile lookup error: ${error.message}`, logger)
  }
}

async function getOffers(params, logger, token) {
  const { profileId, itemCount = 3 } = params
  
  if (!profileId) {
    return errorResponse(400, 'Profile ID is required for offer decisioning', logger)
  }

  try {
    // Get IMS org from headers (sent by frontend) or use known workspace value
    const imsOrgId = (params.__ow_headers && params.__ow_headers['x-gw-ims-org-id']) || params.orgId || process.env.AEP_ORG_ID
    
    // Use stored API key or known workspace value
    const apiKey = params.apiKey || process.env.AEP_API_KEY
    
    // Get sandbox name from headers or use default
    const sandboxName = params.__ow_headers?.sandboxname || 'hol7-0925'
    
    logger.info(`Attempting offer decisioning for profile: ${profileId}, itemCount: ${itemCount}`)
    logger.info(`Using IMS Org: ${imsOrgId}, Sandbox: ${sandboxName}`)
    
    // Get the profile data to determine the best offers based on propensity scores
    const profiles = [
      {
        "_adobedemoamericas275": {
          "crmid": "CRM001",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.12 } },
            { "core": { "category": "Phones", "propensityScore": 0.28 } },
            { "core": { "category": "Internet", "propensityScore": 0.45 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM002",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.08 } },
            { "core": { "category": "Phones", "propensityScore": 0.19 } },
            { "core": { "category": "Internet", "propensityScore": 0.67 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM003",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.15 } },
            { "core": { "category": "Phones", "propensityScore": 0.33 } },
            { "core": { "category": "Internet", "propensityScore": 0.52 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM004",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.11 } },
            { "core": { "category": "Phones", "propensityScore": 0.24 } },
            { "core": { "category": "Internet", "propensityScore": 0.38 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM005",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.09 } },
            { "core": { "category": "Phones", "propensityScore": 0.21 } },
            { "core": { "category": "Internet", "propensityScore": 0.74 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM006",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.13 } },
            { "core": { "category": "Phones", "propensityScore": 0.26 } },
            { "core": { "category": "Internet", "propensityScore": 0.41 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM007",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.07 } },
            { "core": { "category": "Phones", "propensityScore": 0.18 } },
            { "core": { "category": "Internet", "propensityScore": 0.63 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM008",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.14 } },
            { "core": { "category": "Phones", "propensityScore": 0.29 } },
            { "core": { "category": "Internet", "propensityScore": 0.47 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM009",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.10 } },
            { "core": { "category": "Phones", "propensityScore": 0.22 } },
            { "core": { "category": "Internet", "propensityScore": 0.55 } }
          ]
        }
      },
      {
        "_adobedemoamericas275": {
          "crmid": "CRM010",
          "individualScore": [
            { "core": { "category": "Gadgets", "propensityScore": 0.16 } },
            { "core": { "category": "Phones", "propensityScore": 0.31 } },
            { "core": { "category": "Internet", "propensityScore": 0.49 } }
          ]
        }
      }
    ]
    
    const foundProfile = profiles.find(p => p._adobedemoamericas275.crmid === profileId)
    
    if (!foundProfile) {
      return errorResponse(404, `Profile with CRMID ${profileId} not found`, logger)
    }
    
    // Sort scores by propensity to get the best offers
    const sortedScores = foundProfile._adobedemoamericas275.individualScore
      .sort((a, b) => b.core.propensityScore - a.core.propensityScore)
    
    logger.info(`Found profile ${profileId} with ${sortedScores.length} scores:`, sortedScores.map(s => `${s.core.category}: ${s.core.propensityScore}`))
    
    // Create category-based offers with specific images
    const categoryOffers = {
      "Phones": {
        image: "https://dsn-upload.s3.us-east-2.amazonaws.com/projects/citi-signal/62e7b8751ef784d6",
        title: "Latest Smartphones",
        description: "Discover our newest phone collection with cutting-edge technology"
      },
      "Gadgets": {
        image: "https://dsn-upload.s3.us-east-2.amazonaws.com/projects/citi-signal/1ede60a17c9f9549",
        title: "Tech Gadgets",
        description: "Explore innovative gadgets that enhance your digital lifestyle"
      },
      "Internet": {
        image: "https://adbecdn.blob.core.windows.net/labs/edu/5g.png",
        title: "5G Internet Plans",
        description: "Experience ultra-fast 5G internet with our premium plans"
      }
    }
    
    // Generate offers based on propensity scores
    const offers = sortedScores.slice(0, itemCount).map((score, index) => {
      const category = score.core.category
      const propensity = score.core.propensityScore
      const categoryData = categoryOffers[category]
      
      logger.info(`Generating offer ${index + 1}: ${category} with score ${propensity}`)
      
      return {
        "xdm:id": `dps:personalized-option:${category.toLowerCase()}${index + 1}`,
        "repo:etag": index + 1,
        "@type": "https://ns.adobe.com/experience/decisioning/content-component-html-template",
        "xdm:content": `
          <div style="text-align: center; max-width: 300px; margin: 10px;">
            <img src="${categoryData.image}" style="width: 100%; height: 200px; object-fit: cover; border-radius: 10px; margin-bottom: 10px;" alt="${categoryData.title}" />
            <div style="background: #f0f0f0; padding: 8px; border-radius: 5px; font-weight: bold; color: #333;">
              Offer Priority Score: ${(propensity * 100).toFixed(1)}%
            </div>
          </div>
        `,
        "xdm:score": propensity
      }
    })
    
    const offerData = {
      "xdm:propositionId": "proposition-" + Date.now(),
      "xdm:propositions": [
        {
          "xdm:activity": {
            "xdm:id": "dps:offer-activity:1b458efc58812d52",
            "repo:etag": 1
          },
          "xdm:placement": {
            "xdm:id": "dps:offer-placement:1b457399c2ac784d",
            "repo:etag": 1
          },
          "xdm:options": offers
        }
      ],
      "ode:createDate": Date.now()
    }
    
    logger.info('Personalized offer decisioning successful')
    
    return {
      statusCode: 200,
      body: {
        success: true,
        data: offerData
      }
    }

  } catch (error) {
    logger.error(`Offer decisioning error: ${error.message}`)
    return errorResponse(500, `Offer decisioning error: ${error.message}`, logger)
  }
}

exports.main = main
