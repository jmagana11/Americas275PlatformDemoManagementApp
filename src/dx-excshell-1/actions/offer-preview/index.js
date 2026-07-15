/*
* <license header>
*/

const { Core } = require('@adobe/aio-sdk')
const fetch = require('node-fetch')
const { createBlobServiceClient } = require('../shared/blobStore')
const {
  DEFAULT_PERSONALIZATION_SCHEMAS,
  applyContextOverrides,
  buildEdgeInteractRequest,
  buildPropositionEventRequest,
  flattenXdmPaths,
  normalizeEdgeResponse
} = require('../shared/offerDecisioning')
const { getPublishedOfferConfig } = require('../shared/offerConfigStore')
const {
  escapeHtml,
  getRendererStyles,
  renderOfferExperience
} = require('../shared/offerRenderer')
const { mergeJsonBodyParams } = require('../utils')

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}

function htmlResponse(html) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html'
    },
    body: html
  }
}

function getQuery(params = {}) {
  return params.__ow_query || {}
}

function getPublicId(params = {}) {
  const query = getQuery(params)
  return params.publicId || query.publicId || ''
}

function createPreviewInteractInput(config = {}, params = {}) {
  const edge = config.edge || {}
  const allowedSurfaces = Array.isArray(edge.surfaces) ? edge.surfaces : []
  const requestedSurface = typeof params.surface === 'string' ? params.surface.trim() : ''
  // Public endpoint guardrail: only honor a caller-supplied surface if it is one
  // the saved config already allows; otherwise fall back to the full saved list.
  const surfaces = requestedSurface && allowedSurfaces.includes(requestedSurface)
    ? [requestedSurface]
    : allowedSurfaces
  // Public endpoint guardrail: only apply context overrides for fields the saved
  // config already defines; unknown paths are ignored (no arbitrary XDM injection).
  const allowedContextPaths = flattenXdmPaths(edge.xdmDefaults || {}).map((entry) => entry.path)
  const xdm = applyContextOverrides(edge.xdmDefaults || {}, params.context, allowedContextPaths)
  return {
    datastreamId: edge.datastreamId,
    identityNamespace: edge.identityNamespace,
    identityValue: params.identityValue,
    mode: edge.mode,
    decisionScopes: edge.decisionScopes,
    surfaces,
    schemas: [...DEFAULT_PERSONALIZATION_SCHEMAS],
    xdm,
    preserveState: edge.preserveState,
    stateEntries: edge.preserveState ? params.stateEntries : []
  }
}

async function callEdge(request, edgeFetch = fetch) {
  const response = await edgeFetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body)
  })
  const responseText = await response.text()
  let rawResponse

  try {
    rawResponse = responseText ? JSON.parse(responseText) : {}
  } catch (error) {
    rawResponse = {
      body: responseText
    }
  }

  if (!response.ok) {
    const error = new Error(`Experience Edge request failed with status ${response.status}`)
    error.statusCode = response.status
    error.rawResponse = rawResponse
    throw error
  }

  return rawResponse
}

async function renderPublishedOffer(config, params, options = {}) {
  const input = createPreviewInteractInput(config, params)
  const request = buildEdgeInteractRequest(input)
  const rawResponse = await callEdge(request, options.fetch)
  const normalized = normalizeEdgeResponse(rawResponse)
  const rendered = renderOfferExperience(normalized, config.template)

  return {
    success: true,
    renderedHtml: rendered.html,
    styles: rendered.styles,
    normalized,
    stateEntries: normalized.stateEntries,
    itemCount: rendered.itemCount,
    templateType: rendered.templateType
  }
}

async function trackPublishedOfferEvent(config, params, options = {}) {
  const edge = config.edge || {}
  const request = buildPropositionEventRequest({
    datastreamId: edge.datastreamId,
    identityNamespace: edge.identityNamespace,
    identityValue: params.identityValue,
    eventType: params.eventType,
    proposition: params.proposition,
    items: params.items,
    preserveState: edge.preserveState,
    stateEntries: edge.preserveState ? params.stateEntries : []
  })
  const rawResponse = await callEdge(request, options.fetch)

  return {
    success: true,
    eventType: params.eventType,
    requestId: request.requestId,
    stateEntries: normalizeEdgeResponse(rawResponse).stateEntries
  }
}

function getStandalonePage(publicId, options = {}) {
  const safePublicId = escapeHtml(publicId)
  const surfaces = Array.isArray(options.surfaces) ? options.surfaces : []
  const showSurface = options.mode === 'surfaces' && surfaces.length > 0
  const surfaceField = showSurface
    ? `
      <label>
        Surface
        <select id="surface-value" name="surface">
          ${surfaces.map((surface) => `<option value="${escapeHtml(surface)}">${escapeHtml(surface)}</option>`).join('')}
        </select>
      </label>`
    : ''
  const contextFields = Array.isArray(options.contextFields) ? options.contextFields : []
  const contextFieldsHtml = contextFields.length > 0
    ? `
      <div class="context-fields">
        <p class="context-title">Context</p>
        ${contextFields.map((field) => `
        <label>
          ${escapeHtml(field.label || field.path)}
          <input class="context-input" data-context-path="${escapeHtml(field.path)}" value="${escapeHtml(field.value === undefined || field.value === null ? '' : String(field.value))}" autocomplete="off" />
        </label>`).join('')}
      </div>`
    : ''
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Offer Preview</title>
  <style>
    body { background: #f8f8f8; color: #222; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; }
    main { margin: 0 auto; max-width: 1100px; padding: 28px 18px 42px; }
    form { align-items: end; display: grid; gap: 12px; grid-template-columns: minmax(220px, 1fr) auto; margin-bottom: 22px; }
    label { display: grid; gap: 6px; font-size: 14px; font-weight: 700; }
    input, select { border: 1px solid #b8b8b8; border-radius: 6px; font: inherit; padding: 10px 12px; background: #fff; }
    button { background: #1473e6; border: 0; border-radius: 6px; color: #fff; cursor: pointer; font: inherit; font-weight: 700; min-height: 40px; padding: 0 16px; }
    button:disabled { cursor: wait; opacity: .65; }
    .status { color: #666; margin-bottom: 14px; min-height: 20px; }
    .error { color: #b40000; }
    .context-fields { grid-column: 1 / -1; display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }
    .context-title { grid-column: 1 / -1; margin: 4px 0 0; font-size: 13px; font-weight: 700; color: #444; }
    ${getRendererStyles()}
    @media (max-width: 620px) { form { grid-template-columns: 1fr; } button { width: 100%; } }
  </style>
</head>
<body>
  <main>
    <form id="offer-form">
      <label>
        Test profile identity
        <input id="identity-value" name="identityValue" autocomplete="off" required />
      </label>${surfaceField}${contextFieldsHtml}
      <button id="submit-button" type="submit">Retrieve offer</button>
    </form>
    <div id="status" class="status"></div>
    <section id="offer-output"></section>
  </main>
  <script>
    const publicId = new URLSearchParams(window.location.search).get('publicId') || '${safePublicId}';
    const endpoint = window.location.href.split('?')[0];
    let stateEntries = [];
    let latestPropositions = [];

    function getSurface() {
      const surfaceEl = document.getElementById('surface-value');
      return surfaceEl ? surfaceEl.value : '';
    }

    function getContext() {
      const context = {};
      document.querySelectorAll('.context-input').forEach((el) => {
        const path = el.getAttribute('data-context-path');
        if (path) { context[path] = el.value; }
      });
      return context;
    }

    async function postPayload(payload) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId, ...payload })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Offer preview failed');
      }
      return data;
    }

    async function track(eventType, proposition, item) {
      if (!proposition || !document.getElementById('identity-value').value.trim()) return;
      try {
        await postPayload({
          eventType,
          identityValue: document.getElementById('identity-value').value.trim(),
          proposition,
          items: item ? [item] : proposition.items,
          stateEntries
        });
      } catch (error) {
        console.warn('Offer event tracking failed', error);
      }
    }

    document.getElementById('offer-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = document.getElementById('submit-button');
      const status = document.getElementById('status');
      const output = document.getElementById('offer-output');
      const identityValue = document.getElementById('identity-value').value.trim();
      if (!identityValue) return;

      button.disabled = true;
      status.className = 'status';
      status.textContent = 'Retrieving offer...';
      output.innerHTML = '';

      try {
        const data = await postPayload({ identityValue, surface: getSurface(), context: getContext(), stateEntries });
        stateEntries = data.stateEntries || [];
        latestPropositions = (data.normalized && data.normalized.propositions) || [];
        output.innerHTML = data.renderedHtml || '';
        status.textContent = data.itemCount ? 'Offer rendered.' : 'No offers returned.';
        if (latestPropositions.length > 0) {
          track('display', latestPropositions[0]);
        }
      } catch (error) {
        status.className = 'status error';
        status.textContent = error.message || 'Offer preview failed.';
      } finally {
        button.disabled = false;
      }
    });

    document.getElementById('offer-output').addEventListener('click', (event) => {
      const target = event.target.closest('[data-ods-interact="true"]');
      if (!target) return;
      const card = target.closest('[data-proposition-id]');
      const propositionId = card && card.getAttribute('data-proposition-id');
      const itemId = card && card.getAttribute('data-item-id');
      const proposition = latestPropositions.find((entry) => entry.id === propositionId) || latestPropositions[0];
      const item = proposition && (proposition.items || []).find((entry) => entry.id === itemId);
      track('interact', proposition, item);
    });
  </script>
</body>
</html>`
}

async function main(params) {
  const logger = Core.Logger('offer-preview', { level: params.LOG_LEVEL || 'info' })
  const method = String(params.__ow_method || 'get').toLowerCase()
  const mergedParams = mergeJsonBodyParams(params)

  try {
    if (method === 'get') {
      const pagePublicId = getPublicId(mergedParams)
      let pageOptions = {}
      if (pagePublicId) {
        try {
          const blobServiceClient = createBlobServiceClient(params)
          const pageConfig = await getPublishedOfferConfig(blobServiceClient, pagePublicId)
          if (pageConfig && pageConfig.publish && pageConfig.publish.enabled && pageConfig.edge) {
            const tenantPrefix = pageConfig.edge.contextTenantField
              ? `${pageConfig.edge.contextTenantField}.`
              : ''
            const contextFields = flattenXdmPaths(pageConfig.edge.xdmDefaults || {}).map((entry) => ({
              path: entry.path,
              // Show the tenant-stripped path as the label; keep the full path as the key.
              label: tenantPrefix && entry.path.startsWith(tenantPrefix)
                ? entry.path.slice(tenantPrefix.length)
                : entry.path,
              value: entry.value
            }))
            pageOptions = {
              mode: pageConfig.edge.mode,
              surfaces: Array.isArray(pageConfig.edge.surfaces) ? pageConfig.edge.surfaces : [],
              contextFields
            }
          }
        } catch (pageError) {
          logger.info(`Preview page rendered without saved config options: ${pageError.message}`)
        }
      }
      return htmlResponse(getStandalonePage(pagePublicId, pageOptions))
    }

    if (method !== 'post') {
      return jsonResponse(405, {
        success: false,
        error: 'Method not allowed'
      })
    }

    const publicId = getPublicId(mergedParams)
    if (!publicId) {
      return jsonResponse(400, {
        success: false,
        error: 'publicId is required'
      })
    }

    const blobServiceClient = createBlobServiceClient(params)
    const config = await getPublishedOfferConfig(blobServiceClient, publicId)
    if (!config || !config.publish || !config.publish.enabled) {
      return jsonResponse(404, {
        success: false,
        error: 'Published offer config not found'
      })
    }

    if (!mergedParams.identityValue) {
      return jsonResponse(400, {
        success: false,
        error: 'identityValue is required'
      })
    }

    const result = (mergedParams.eventType === 'display' || mergedParams.eventType === 'interact')
      ? await trackPublishedOfferEvent(config, mergedParams)
      : await renderPublishedOffer(config, mergedParams)

    return jsonResponse(200, result)
  } catch (error) {
    logger.error(error)
    return jsonResponse(error.statusCode || 500, {
      success: false,
      error: error.message || 'Offer preview failed'
    })
  }
}

exports.main = main
exports.createPreviewInteractInput = createPreviewInteractInput
exports.renderPublishedOffer = renderPublishedOffer
exports.trackPublishedOfferEvent = trackPublishedOfferEvent
