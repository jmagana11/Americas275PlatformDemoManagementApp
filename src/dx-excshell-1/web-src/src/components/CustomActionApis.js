/*
* <license header>
*/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import {
  ActionButton,
  Badge,
  Button,
  ButtonGroup,
  Cell,
  Column,
  Content,
  Dialog,
  DialogTrigger,
  Divider,
  Flex,
  Form,
  Grid,
  Heading,
  Item,
  NumberField,
  Picker,
  ProgressCircle,
  Row,
  StatusLight,
  TableBody,
  TableHeader,
  TableView,
  TabList,
  TabPanels,
  Tabs,
  Text,
  TextArea,
  TextField,
  View,
  Well
} from '@adobe/react-spectrum'
import Copy from '@spectrum-icons/workflow/Copy'
import DataUpload from '@spectrum-icons/workflow/DataUpload'
import Delete from '@spectrum-icons/workflow/Delete'
import Globe from '@spectrum-icons/workflow/Globe'
import Play from '@spectrum-icons/workflow/Play'
import Refresh from '@spectrum-icons/workflow/Refresh'

import actionWebInvoke from '../utils'
import allActions from '../config.json'
import { getUserEmail } from '../utils/accessControl'

const FILTER_OPS = [
  { key: 'eq', label: 'Equals' },
  { key: 'ne', label: 'Not equal' },
  { key: 'contains', label: 'Contains' },
  { key: 'in', label: 'In list' },
  { key: 'gt', label: 'Greater than' },
  { key: 'gte', label: 'Greater or equal' },
  { key: 'lt', label: 'Less than' },
  { key: 'lte', label: 'Less or equal' }
]

const FORMAT_OPTIONS = [
  { key: 'object', label: 'Single object (first match)' },
  { key: 'array', label: 'Array of rows' }
]

const mono = { fontFamily: 'adobe-clean, Source Code Pro, Monaco, monospace', wordBreak: 'break-all' }

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

function csvToJson(csvContent) {
  const lines = csvContent.split('\n').map((line) => line.trim()).filter(Boolean)
  if (lines.length === 0) {
    return []
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^"|"$/g, ''))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length < headers.length) {
      continue
    }
    const row = {}
    headers.forEach((header, index) => {
      row[header] = values[index] || ''
    })
    rows.push(row)
  }

  return rows
}

function buildImsHeaders(ims) {
  if (!ims) {
    return {}
  }

  const headers = {}
  if (ims.token) {
    headers.authorization = `Bearer ${ims.token}`
  }
  if (ims.org) {
    headers['x-gw-ims-org-id'] = ims.org
  }
  const email = getUserEmail(ims)
  if (email) {
    headers['x-ims-email'] = email
  }
  return headers
}

function formatInvokeError(error, fallback) {
  const message = error?.message || fallback
  if (message.includes('fileData and fileType')) {
    return 'The upload-file action does not support dataset listing yet. Run aio app build, restart aio app run, or deploy the latest code to your Runtime namespace.'
  }
  if (message.includes('Azure Blob config') || message.includes('AZURE_BLOB')) {
    return 'Azure Blob Storage is not configured for Runtime. Set AZURE_BLOB_URL and AZURE_SAS_TOKEN in .env, then restart aio app run.'
  }
  return message
}

function buildAjoRequestBody(dataset, query) {
  const body = {
    datasetId: dataset.datasetId,
    datasetToken: dataset.datasetToken,
    limit: query.limit,
    format: query.format
  }

  if (query.where) {
    body.where = query.where
  }

  return body
}

async function copyText(value, onDone) {
  try {
    await navigator.clipboard.writeText(value)
    onDone('Copied to clipboard')
  } catch (error) {
    onDone('Copy failed — select the text and copy manually')
  }
}

function formatLogTime(timestamp) {
  if (!timestamp) {
    return '—'
  }
  return new Date(timestamp).toLocaleString()
}

function formatLogFilter(request = {}) {
  const where = request.where
  if (!where || !where.column) {
    return 'No filter'
  }
  const value = String(where.value || '')
  const shortValue = value.length > 24 ? `${value.slice(0, 24)}…` : value
  return `${where.column} ${where.op || 'eq'} ${shortValue}`
}

function logWasSuccessful(log) {
  const response = log.response || {}
  if (response.success === false) {
    return false
  }
  if (response.error) {
    return false
  }
  return true
}

function EndpointPanel({ dataApiUrl, onCopyMessage }) {
  if (!dataApiUrl) {
    return (
      <Well>
        <Text>data-api action URL is not available. Run aio app build and restart the dev server.</Text>
      </Well>
    )
  }

  return (
    <View>
      <Flex alignItems="center" gap="size-100" marginBottom="size-100">
        <Globe />
        <Heading level={3} margin={0}>Custom Action endpoint</Heading>
      </Flex>
      <Text>
        Configure your AJO Custom Action as an HTTP <strong>POST</strong> to this Adobe I/O Runtime URL.
        Send <code>Content-Type: application/json</code> with the request body shown below.
      </Text>
      <Well marginTop="size-200">
        <Flex direction="row" gap="size-200" alignItems="center" wrap>
          <Badge variant="positive">POST</Badge>
          <Text flex="1" UNSAFE_style={mono}>
            {dataApiUrl}
          </Text>
          <ActionButton isQuiet onPress={() => copyText(dataApiUrl, onCopyMessage)}>
            <Copy />
            <Text>Copy URL</Text>
          </ActionButton>
        </Flex>
      </Well>
    </View>
  )
}

function LogDetailDialog({ log }) {
  if (!log) {
    return null
  }

  return (
    <Dialog>
      <Heading>Request log</Heading>
      <Content>
        <Flex direction="column" gap="size-200">
          <Text>
            {formatLogTime(log.timestamp)}
            {' · '}
            {log.responseTime != null ? `${log.responseTime} ms` : '—'}
          </Text>
          <TextArea
            label="Request"
            value={JSON.stringify(log.request || {}, null, 2)}
            width="100%"
            isReadOnly
            rows={8}
          />
          <TextArea
            label="Response"
            value={JSON.stringify(log.response || {}, null, 2)}
            width="100%"
            isReadOnly
            rows={10}
          />
        </Flex>
      </Content>
    </Dialog>
  )
}

const CustomActionApis = ({ ims }) => {
  const fileInputRef = useRef(null)
  const dataApiUrl = allActions['data-api'] || ''
  const uploadUrl = allActions['upload-file'] || ''
  const logsUrl = allActions['data-api-logs'] || ''

  const [datasets, setDatasets] = useState([])
  const [loadingDatasets, setLoadingDatasets] = useState(false)
  const [selectedDatasetId, setSelectedDatasetId] = useState(null)
  const [selectedDataset, setSelectedDataset] = useState(null)
  const [workspaceTab, setWorkspaceTab] = useState('query')

  const [datasetName, setDatasetName] = useState('')
  const [primaryKey, setPrimaryKey] = useState('')
  const [parsedRows, setParsedRows] = useState(null)
  const [parsedColumns, setParsedColumns] = useState([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)

  const [filterColumn, setFilterColumn] = useState('')
  const [filterOp, setFilterOp] = useState('eq')
  const [filterValue, setFilterValue] = useState('')
  const [queryLimit, setQueryLimit] = useState(1)
  const [queryFormat, setQueryFormat] = useState('object')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [logs, setLogs] = useState([])
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const userEmail = useMemo(() => getUserEmail(ims), [ims])
  const imsToken = ims?.token
  const imsOrg = ims?.org
  const loadInFlightRef = useRef(false)

  const currentQuery = useMemo(() => ({
    where: filterColumn
      ? { column: filterColumn, op: filterOp, value: filterValue }
      : undefined,
    limit: queryLimit,
    format: queryFormat
  }), [filterColumn, filterOp, filterValue, queryLimit, queryFormat])

  const requestBodyJson = useMemo(() => {
    if (!selectedDataset) {
      return ''
    }
    return JSON.stringify(buildAjoRequestBody(selectedDataset, currentQuery), null, 2)
  }, [selectedDataset, currentQuery])

  const loadDatasets = useCallback(async () => {
    if (!uploadUrl || loadInFlightRef.current) {
      return
    }

    loadInFlightRef.current = true
    setLoadingDatasets(true)
    setLoadError(null)

    try {
      const response = await actionWebInvoke(
        uploadUrl,
        buildImsHeaders(ims),
        {
          operation: 'list',
          ownerEmail: userEmail,
          userEmail
        }
      )
      const body = response.body || response

      if (body.success === false) {
        throw new Error(body.error || 'Dataset list failed')
      }

      setDatasets(body.datasets || [])
    } catch (error) {
      setDatasets([])
      setLoadError(formatInvokeError(error, 'Could not load datasets'))
    } finally {
      setLoadingDatasets(false)
      loadInFlightRef.current = false
    }
  }, [uploadUrl, ims, imsToken, imsOrg, userEmail])

  const loadLogs = useCallback(async (datasetId) => {
    if (!logsUrl || !datasetId) {
      return
    }

    setLoadingLogs(true)
    try {
      const response = await actionWebInvoke(logsUrl, buildImsHeaders(ims), {
        datasetId,
        limit: 25,
        ownerEmail: userEmail,
        userEmail
      })
      const body = response.body || response
      setLogs(body.logs || [])
    } catch (error) {
      setLogs([])
    } finally {
      setLoadingLogs(false)
    }
  }, [logsUrl, ims, userEmail])

  useEffect(() => {
    loadDatasets()
  }, [loadDatasets])

  useEffect(() => {
    if (!selectedDatasetId) {
      setSelectedDataset(null)
      return
    }

    const dataset = datasets.find((item) => item.datasetId === selectedDatasetId)
    setSelectedDataset(dataset || null)

    if (dataset) {
      setFilterColumn(dataset.primaryKey || dataset.columns?.[0] || '')
      setQueryLimit(1)
      setQueryFormat('object')
      loadLogs(dataset.datasetId)
    }
  }, [selectedDatasetId, datasets, loadLogs])

  const handleFileSelection = (file) => {
    setUploadError(null)
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setUploadError('Please upload a CSV file')
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const rows = csvToJson(event.target.result)
        if (!rows.length) {
          setUploadError('No rows found in CSV')
          return
        }
        const columns = Object.keys(rows[0])
        setParsedRows(rows)
        setParsedColumns(columns)
        const existingKey = selectedDataset?.primaryKey
        if (existingKey && columns.includes(existingKey)) {
          setPrimaryKey(existingKey)
        } else {
          setPrimaryKey(columns[0] || '')
        }
        if (selectedDataset?.name) {
          setDatasetName(selectedDataset.name)
        } else if (!datasetName.trim()) {
          setDatasetName(file.name.replace(/\.csv$/i, ''))
        }
      } catch (error) {
        setUploadError(error.message)
      }
    }
    reader.readAsText(file)
  }

  const replaceDatasetData = async () => {
    if (!parsedRows?.length || !selectedDataset?.datasetId) {
      setUploadError('Select a dataset and upload a CSV file first')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const response = await actionWebInvoke(uploadUrl, buildImsHeaders(ims), {
        operation: 'replace',
        datasetId: selectedDataset.datasetId,
        name: datasetName.trim() || selectedDataset.name,
        primaryKey: primaryKey || undefined,
        ownerEmail: userEmail,
        userEmail,
        fileData: parsedRows
      })
      const body = response.body || response
      if (!body.success) {
        throw new Error(body.error || 'Replace failed')
      }

      setParsedRows(null)
      setParsedColumns([])
      await loadDatasets()
      if (body.dataset) {
        setSelectedDataset(body.dataset)
        setFilterColumn(body.dataset.primaryKey || body.dataset.columns?.[0] || '')
      }
      setCopyFeedback('Dataset data replaced. datasetId and token are unchanged for AJO.')
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const createDataset = async () => {
    if (!parsedRows?.length) {
      setUploadError('Upload a CSV file first')
      return
    }

    setUploading(true)
    setUploadError(null)

    try {
      const response = await actionWebInvoke(uploadUrl, buildImsHeaders(ims), {
        operation: 'create',
        name: datasetName.trim() || 'custom-action-dataset',
        primaryKey: primaryKey || undefined,
        ownerEmail: userEmail,
        userEmail,
        fileData: parsedRows
      })
      const body = response.body || response
      if (!body.success) {
        throw new Error(body.error || 'Upload failed')
      }

      setParsedRows(null)
      setParsedColumns([])
      setDatasetName('')
      await loadDatasets()
      if (body.dataset?.datasetId) {
        setSelectedDatasetId(body.dataset.datasetId)
        setSelectedDataset(body.dataset)
        setWorkspaceTab('query')
      }
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setUploading(false)
    }
  }

  const deleteDataset = async () => {
    if (!selectedDatasetId) {
      return
    }

    await actionWebInvoke(uploadUrl, buildImsHeaders(ims), {
      operation: 'delete',
      datasetId: selectedDatasetId,
      ownerEmail: userEmail,
      userEmail
    })
    setSelectedDatasetId(null)
    setSelectedDataset(null)
    setTestResult(null)
    setLogs([])
    await loadDatasets()
  }

  const runTest = async () => {
    if (!selectedDataset?.datasetId) {
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const params = buildAjoRequestBody(selectedDataset, currentQuery)
      const response = await actionWebInvoke(dataApiUrl, buildImsHeaders(ims), {
        ...params,
        ownerEmail: userEmail,
        userEmail
      })
      const body = response.body || response
      setTestResult(body)
      await loadLogs(selectedDataset.datasetId)
      setWorkspaceTab('query')
    } catch (error) {
      setTestResult({ success: false, error: error.message })
    } finally {
      setTesting(false)
    }
  }

  const setCopyFeedback = (message) => {
    setCopyMessage(message)
    setTimeout(() => setCopyMessage(''), 4000)
  }

  const columnOptions = selectedDataset?.columns || parsedColumns

  return (
    <View width="100%" maxWidth="size-7000">
      <Content>
        <Flex direction="column" gap="size-400">
          <View>
            <Heading level={1}>Custom Action APIs</Heading>
            <Text marginTop="size-100">
              Host CSV-backed HTTP endpoints for Adobe Journey Optimizer Custom Actions.
              Upload data, test filters, then copy the POST URL and JSON body into AJO.
            </Text>
          </View>

          {userEmail && (
            <Well>
              <Flex alignItems="center" gap="size-100">
                <StatusLight variant="positive" />
                <Text>Signed in as {userEmail}. Datasets are private to your account.</Text>
              </Flex>
            </Well>
          )}

          <EndpointPanel dataApiUrl={dataApiUrl} onCopyMessage={setCopyFeedback} />

          <Divider size="S" />

          <View>
            <Heading level={2}>Upload data</Heading>
            <Text marginTop="size-100" marginBottom="size-200">
              Create a new dataset for AJO, or replace the CSV for the active dataset to keep the same datasetId and token while testing.
            </Text>

            <Form maxWidth="100%">
              <Flex direction="column" gap="size-300">
                <View
                  borderWidth="thin"
                  borderColor="dark"
                  borderRadius="medium"
                  padding="size-300"
                  backgroundColor="gray-75"
                >
                  <Flex direction="column" gap="size-200" alignItems="start">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={(event) => {
                        const file = event.target.files?.[0]
                        if (file) {
                          handleFileSelection(file)
                        }
                      }}
                    />
                    <Button variant="primary" onPress={() => fileInputRef.current?.click()}>
                      <DataUpload />
                      <Text>Select CSV file</Text>
                    </Button>
                    {parsedRows && (
                      <Text size="S">
                        Ready to publish: {parsedRows.length} rows · {parsedColumns.length} columns
                      </Text>
                    )}
                  </Flex>
                </View>

                <Grid
                  columns={['1.2fr', '1fr']}
                  gap="size-300"
                  width="100%"
                >
                  <TextField
                    label="Dataset name"
                    value={datasetName}
                    onChange={setDatasetName}
                    width="100%"
                    placeholder="e.g. order_confirmations"
                  />
                  <Picker
                    label="Primary key column"
                    selectedKey={primaryKey || null}
                    onSelectionChange={setPrimaryKey}
                    isDisabled={parsedColumns.length === 0}
                    width="100%"
                  >
                    {parsedColumns.map((column) => (
                      <Item key={column}>{column}</Item>
                    ))}
                  </Picker>
                </Grid>

                {parsedColumns.length === 0 ? (
                  <Text size="S">Select a CSV file above to enable the primary key column.</Text>
                ) : (
                  <Text size="S">Primary key is the default filter column for AJO runtime calls.</Text>
                )}

                {selectedDataset && parsedRows && (
                  <Well>
                    <Text size="S">
                      Replacing <strong>{selectedDataset.name}</strong> keeps datasetId and datasetToken
                      unchanged so AJO Custom Actions do not need reconfiguration.
                    </Text>
                  </Well>
                )}

                <Flex marginTop="size-100" gap="size-200" wrap>
                  <ButtonGroup>
                    <Button
                      variant="cta"
                      onPress={createDataset}
                      isDisabled={!parsedRows?.length || uploading}
                    >
                      {uploading ? 'Saving…' : 'Create new dataset'}
                    </Button>
                    <Button
                      variant="primary"
                      onPress={replaceDatasetData}
                      isDisabled={!parsedRows?.length || !selectedDataset?.datasetId || uploading}
                    >
                      {uploading ? 'Saving…' : 'Replace active dataset'}
                    </Button>
                  </ButtonGroup>
                </Flex>

                {uploadError && (
                  <Flex alignItems="center" gap="size-100">
                    <StatusLight variant="negative" />
                    <Text>{uploadError}</Text>
                  </Flex>
                )}
              </Flex>
            </Form>
          </View>

          <Divider size="S" />

          <View>
            <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
              <Heading level={2} margin={0}>Your datasets</Heading>
              <ActionButton onPress={loadDatasets} isDisabled={loadingDatasets} isQuiet>
                <Refresh />
                <Text>Refresh</Text>
              </ActionButton>
            </Flex>

            {loadError && (
              <Well marginBottom="size-200">
                <Flex alignItems="center" gap="size-100">
                  <StatusLight variant="negative" />
                  <Text>{loadError}</Text>
                </Flex>
              </Well>
            )}

            {loadingDatasets && (
              <Flex alignItems="center" gap="size-200">
                <ProgressCircle isIndeterminate aria-label="Loading datasets" size="S" />
                <Text>Loading datasets…</Text>
              </Flex>
            )}

            {!loadingDatasets && !loadError && datasets.length === 0 && (
              <Well>
                <Text>No datasets yet. Upload a CSV above to create your first endpoint payload.</Text>
              </Well>
            )}

            {datasets.length > 0 && (
              <Picker
                label="Active dataset"
                selectedKey={selectedDatasetId}
                onSelectionChange={setSelectedDatasetId}
                width="100%"
                description="Choose a dataset to configure queries and copy AJO settings"
              >
                {datasets.map((dataset) => (
                  <Item key={dataset.datasetId}>
                    {`${dataset.name} · ${dataset.rowCount} rows`}
                  </Item>
                ))}
              </Picker>
            )}
          </View>

          {selectedDataset && (
            <View>
              <Well marginBottom="size-300">
                <Grid columns={['1fr', '1fr']} gap="size-200">
                  <View>
                    <Text UNSAFE_style={{ fontWeight: 600 }}>Dataset ID</Text>
                    <Text UNSAFE_style={mono}>{selectedDataset.datasetId}</Text>
                  </View>
                  <View>
                    <Text UNSAFE_style={{ fontWeight: 600 }}>Primary key</Text>
                    <Text>{selectedDataset.primaryKey || '—'}</Text>
                  </View>
                </Grid>
              </Well>

              <Tabs
                selectedKey={workspaceTab}
                onSelectionChange={setWorkspaceTab}
                aria-label="Dataset workspace"
              >
                <TabList>
                  <Item key="query">Query &amp; test</Item>
                  <Item key="ajo">AJO configuration</Item>
                  <Item key="activity">Activity ({logs.length})</Item>
                </TabList>
                <TabPanels>
                  <Item key="query">
                    <View paddingTop="size-300">
                      <Form maxWidth="100%">
                        <Flex direction="column" gap="size-200">
                          <Grid columns={['1fr', '1fr', '1fr']} gap="size-200" alignItems="end">
                            <Picker
                              label="Filter column"
                              selectedKey={filterColumn || null}
                              onSelectionChange={setFilterColumn}
                            >
                              {columnOptions.map((column) => (
                                <Item key={column}>{column}</Item>
                              ))}
                            </Picker>
                            <Picker
                              label="Operator"
                              selectedKey={filterOp}
                              onSelectionChange={setFilterOp}
                            >
                              {FILTER_OPS.map((op) => (
                                <Item key={op.key}>{op.label}</Item>
                              ))}
                            </Picker>
                            <TextField
                              label="Filter value"
                              value={filterValue}
                              onChange={setFilterValue}
                              description="Test with a literal; use AJO expressions in the copied body"
                            />
                          </Grid>
                          <Grid columns={['1fr', '2fr', 'auto']} gap="size-200" alignItems="end">
                            <NumberField
                              label="Limit"
                              value={queryLimit}
                              onChange={setQueryLimit}
                              minValue={1}
                              maxValue={100}
                            />
                            <Picker
                              label="Response format"
                              selectedKey={queryFormat}
                              onSelectionChange={setQueryFormat}
                            >
                              {FORMAT_OPTIONS.map((option) => (
                                <Item key={option.key}>{option.label}</Item>
                              ))}
                            </Picker>
                            <Flex gap="size-100" alignItems="end">
                              <Button variant="primary" onPress={runTest} isDisabled={testing}>
                                <Play />
                                <Text>{testing ? 'Running…' : 'Run test'}</Text>
                              </Button>
                              <Button variant="negative" onPress={deleteDataset}>
                                <Delete />
                                <Text>Delete</Text>
                              </Button>
                            </Flex>
                          </Grid>
                        </Flex>
                      </Form>

                      {testResult && (
                        <Well marginTop="size-300">
                          <Flex direction="column" gap="size-200">
                            <Flex alignItems="center" gap="size-100">
                              <StatusLight variant={testResult.success === false ? 'negative' : 'positive'} />
                              <Heading level={4} margin={0}>
                                {testResult.success === false ? 'Request failed' : 'Request succeeded'}
                              </Heading>
                              {testResult.meta?.totalMatches != null && (
                                <Badge variant="info">
                                  {`${testResult.meta.returned} of ${testResult.meta.totalMatches} matches`}
                                </Badge>
                              )}
                            </Flex>
                            <TextArea
                              label="Response JSON"
                              value={JSON.stringify(testResult, null, 2)}
                              width="100%"
                              isReadOnly
                              rows={10}
                            />
                          </Flex>
                        </Well>
                      )}
                    </View>
                  </Item>

                  <Item key="ajo">
                    <View paddingTop="size-300">
                      <Flex direction="column" gap="size-300">
                        <Text>
                          In AJO, create a Custom Action with <strong>POST</strong> and paste the endpoint URL.
                          Use the JSON body below — replace filter values with profile or event attributes.
                        </Text>

                        <View>
                          <Text UNSAFE_style={{ fontWeight: 600 }} marginBottom="size-100">
                            Endpoint URL
                          </Text>
                          <Well>
                            <Flex alignItems="center" gap="size-200">
                              <Badge variant="positive">POST</Badge>
                              <Text flex="1" UNSAFE_style={mono}>{dataApiUrl}</Text>
                              <ActionButton isQuiet onPress={() => copyText(dataApiUrl, setCopyFeedback)}>
                                <Copy />
                                <Text>Copy URL</Text>
                              </ActionButton>
                            </Flex>
                          </Well>
                        </View>

                        <TextArea
                          label="Request body (JSON)"
                          value={requestBodyJson}
                          width="100%"
                          isReadOnly
                          rows={12}
                          description="Include datasetToken for journey runtime calls from AJO."
                        />

                        <Flex alignItems="center" gap="size-200" wrap>
                          <ButtonGroup>
                            <Button
                              variant="primary"
                              onPress={() => copyText(requestBodyJson, setCopyFeedback)}
                            >
                              <Copy />
                              <Text>Copy body</Text>
                            </Button>
                            <Button
                              variant="secondary"
                              onPress={() => copyText(
                                JSON.stringify({
                                  method: 'POST',
                                  url: dataApiUrl,
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.parse(requestBodyJson)
                                }, null, 2),
                                setCopyFeedback
                              )}
                            >
                              <Copy />
                              <Text>Copy full HTTP spec</Text>
                            </Button>
                          </ButtonGroup>
                          {copyMessage && (
                            <Text size="S">{copyMessage}</Text>
                          )}
                        </Flex>
                      </Flex>
                    </View>
                  </Item>

                  <Item key="activity">
                    <View paddingTop="size-300">
                      <Flex justifyContent="space-between" alignItems="center" marginBottom="size-200">
                        <Text>Recent calls to this dataset from tests and AJO.</Text>
                        <Button
                          variant="secondary"
                          onPress={() => loadLogs(selectedDataset.datasetId)}
                          isDisabled={loadingLogs}
                        >
                          <Refresh />
                          <Text>Refresh</Text>
                        </Button>
                      </Flex>

                      {loadingLogs && (
                        <ProgressCircle isIndeterminate aria-label="Loading activity" size="S" />
                      )}

                      {!loadingLogs && logs.length === 0 && (
                        <Well>
                          <Text>No activity yet. Run a test query or invoke the endpoint from AJO.</Text>
                        </Well>
                      )}

                      {!loadingLogs && logs.length > 0 && (
                        <TableView
                          aria-label="Dataset activity"
                          maxHeight="size-3600"
                          selectionMode="none"
                        >
                          <TableHeader>
                            <Column key="time" width={160}>Time</Column>
                            <Column key="status" width={100}>Result</Column>
                            <Column key="filter">Filter</Column>
                            <Column key="duration" width={100}>Duration</Column>
                            <Column key="actions" width={80}>Details</Column>
                          </TableHeader>
                          <TableBody items={logs}>
                            {(log) => (
                              <Row key={log.id}>
                                <Cell>{formatLogTime(log.timestamp)}</Cell>
                                <Cell>
                                  <Badge variant={logWasSuccessful(log) ? 'positive' : 'negative'}>
                                    {logWasSuccessful(log) ? 'OK' : 'Error'}
                                  </Badge>
                                </Cell>
                                <Cell>
                                  <Text UNSAFE_style={mono}>{formatLogFilter(log.request)}</Text>
                                </Cell>
                                <Cell>
                                  {log.responseTime != null ? `${log.responseTime} ms` : '—'}
                                </Cell>
                                <Cell>
                                  <DialogTrigger type="popover">
                                    <ActionButton isQuiet aria-label="View log details">
                                      <Text>View</Text>
                                    </ActionButton>
                                    <LogDetailDialog log={log} />
                                  </DialogTrigger>
                                </Cell>
                              </Row>
                            )}
                          </TableBody>
                        </TableView>
                      )}

                    </View>
                  </Item>
                </TabPanels>
              </Tabs>
            </View>
          )}

          {copyMessage && !selectedDataset && (
            <Text size="S">{copyMessage}</Text>
          )}
        </Flex>
      </Content>
    </View>
  )
}

CustomActionApis.propTypes = {
  runtime: PropTypes.any,
  ims: PropTypes.any
}

export default CustomActionApis
