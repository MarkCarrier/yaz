import AWS from 'aws-sdk'
import { DateTime } from 'luxon'

const awsRegion = process.env.AWS_REGION || 'us-east-1'
const skipAllTableChecks = !!process.env.SKIP_TABLE_CHECKS

const dynamo = new AWS.DynamoDB({
  apiVersion: '2021-08-10',
  region: awsRegion
})

let awsConfig = {
  region: awsRegion
}

if (process.env.LOCAL_DYNAMO_URL) {
  console.log(`Using local dynamo (${process.env.LOCAL_DYNAMO_URL})`)
  awsConfig.endpoint = process.env.LOCAL_DYNAMO_URL
}

AWS.config.update(awsConfig)

const KEY_ATTRIBUTE = 'key'
const PARTITION_ATTRIBUTE = 'keyBucket'
const TTL_ATTRIBUTE = 'expiresAt'
const MONTH_ATTRIBUTE = 'createdMonth'
const TIMESTAMP_ATTRIBUTE = 'createdAt'
const docClient = new AWS.DynamoDB.DocumentClient()

export async function getDynamoKeyValueStore(
  tableName,
  {
    defaultSecondsToLive = -1,
    skipTableCheck = false,
    partitionDataInBuckets = false
  } = {
    defaultSecondsToLive: -1,
    skipTableCheck: false,
    partitionDataInBuckets: false
  }
) {
  if (!skipTableCheck && !skipAllTableChecks) {
    try {
      await ensureTableLooksGood()
      console.log(`Table ${tableName} looks good`)
    } catch (tableCheckErr) {
      if (
        tableCheckErr.code &&
        tableCheckErr.code === 'ResourceNotFoundException'
      ) {
        console.log(`Table ${tableName} does't exist. Creating`)
        await createTable()
        await ensureTableLooksGood()
        console.log(`Table ${tableName} created successfully`)
      } else {
        console.log(
          `Could not initialize dynamo table store: ${tableCheckErr.message}`
        )
        throw tableCheckErr
      }
    }
  } else {
    console.log(`Skipping dynamo table check for ${tableName}`)
  }

  async function ensureTableLooksGood() {
    try {
      const tableInfo = await dynamo
        .describeTable({ TableName: tableName })
        .promise()

      // console.log(
      //   `Table ${tableName} desc: ${JSON.stringify(tableInfo, null, ' ')}`
      // )

      const numExpectedAttributes = partitionDataInBuckets ? 4 : 3
      if (
        tableInfo.Table.AttributeDefinitions.length != numExpectedAttributes
      ) {
        throw new Error(
          "Table does not have the correct number of attributes. Did you try to use buckets when you shouldn't?"
        )
      }

      const tablTtlInfo = await dynamo
        .describeTimeToLive({
          TableName: tableName
        })
        .promise()

      //console.log(`TTL Settings: ${JSON.stringify(tablTtlInfo, null, ' ')}`)
    } catch (err) {
      throw err
    }
  }

  async function createTable() {
    //Remember:
    //Global indices:
    //  * max 20
    //  * can use any key
    //  * cannot provide strongly consistent reads
    //Local indices
    //  * max 5
    //  * must use the same partition key
    //  * can provide strongly consistent reads
    //  * inherit the read/write capacity from base table

    let attributeDef = [
      { AttributeName: KEY_ATTRIBUTE, AttributeType: 'S' },
      { AttributeName: MONTH_ATTRIBUTE, AttributeType: 'S' },
      { AttributeName: TIMESTAMP_ATTRIBUTE, AttributeType: 'N' }
    ]
    let keySchema = []

    if (partitionDataInBuckets) {
      attributeDef.push({
        AttributeName: PARTITION_ATTRIBUTE,
        AttributeType: 'S'
      })
      keySchema = [
        { AttributeName: PARTITION_ATTRIBUTE, KeyType: 'HASH' },
        { AttributeName: KEY_ATTRIBUTE, KeyType: 'RANGE' }
      ]
    } else {
      keySchema = [{ AttributeName: KEY_ATTRIBUTE, KeyType: 'HASH' }]
    }

    await dynamo
      .createTable({
        TableName: tableName,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: attributeDef,
        KeySchema: keySchema,
        GlobalSecondaryIndexes: [
          {
            IndexName: 'Timestamp',
            KeySchema: [
              {
                AttributeName: MONTH_ATTRIBUTE,
                KeyType: 'HASH'
              },
              {
                AttributeName: TIMESTAMP_ATTRIBUTE,
                KeyType: 'RANGE'
              }
            ],
            Projection: { ProjectionType: 'ALL' }
          }
        ]
      })
      .promise()

    await dynamo.waitFor('tableExists', { TableName: tableName }).promise()
    await dynamo
      .updateTimeToLive({
        TableName: tableName,
        TimeToLiveSpecification: {
          AttributeName: TTL_ATTRIBUTE,
          Enabled: true
        }
      })
      .promise()
  }

  async function putUnpartitionedItem(
    key,
    value,
    secondsToLiveOverride = null
  ) {
    return putPartitionedItem(null, key, value, secondsToLiveOverride)
  }

  async function putPartitionedItem(
    bucket,
    key,
    value,
    secondsToLiveOverride = null
  ) {
    try {
      if (!key || (partitionDataInBuckets && !bucket) || !value) {
        throw new Error('Must supply key(s) and value')
      }

      const entry = {}
      entry[KEY_ATTRIBUTE] = key.toString()
      if (partitionDataInBuckets) {
        entry[PARTITION_ATTRIBUTE] = bucket
      }
      const seconds = secondsToLiveOverride || defaultSecondsToLive

      if (seconds && seconds > 157788000) {
        //Dynamo only auto-deletes records that are less than 5 years old
        throw new Error('Maximum expiration is 5 years (157788000 seconds).')
      }

      if (seconds && seconds >= 0) {
        const expiresAt = Math.ceil(
          DateTime.now().plus({ seconds: seconds }).setZone('utc').toSeconds()
        )
        entry[TTL_ATTRIBUTE] = expiresAt
      }

      entry.value = value
      entry[MONTH_ATTRIBUTE] = DateTime.now().setZone('utc').toISO().slice(0, 7)
      entry[TIMESTAMP_ATTRIBUTE] = Math.round(
        DateTime.now().setZone('utc').toSeconds()
      )

      await docClient.put({ TableName: tableName, Item: entry }).promise()
      //console.log('Item added')
    } catch (putErr) {
      console.error(`Failed to put item into dynamo: ${putErr.message}`)
      throw new Error('Key-Value Store putItem failed')
    }
  }

  async function getUnpartitionedItem(key) {
    return getPartitionedItem(null, key)
  }

  async function getPartitionedItem(bucket, key) {
    try {
      if (!key || (partitionDataInBuckets && !bucket)) {
        throw new Error('Invalid key(s)')
      }

      const awsKey = {}
      awsKey[KEY_ATTRIBUTE] = key
      if (partitionDataInBuckets) {
        awsKey[PARTITION_ATTRIBUTE] = bucket
      }
      //console.time(`get-${key}`)
      const doc = await docClient
        .get({ TableName: tableName, Key: awsKey })
        .promise()
      //console.timeEnd(`get-${key}`)

      if (isExpiredDoc(doc.Item)) {
        return null
      }

      return doc?.Item?.value
    } catch (getErr) {
      // if(getErr.code === 'ResourceNotFoundException') {
      //   return null
      // }
      console.error(`Failed to get item from dynamo: ${getErr.message}`)
      throw new Error('Key-Value Store getItem failed')
    }
  }

  async function getAllItemsInPartition(bucket, maxResults = 1000) {
    const allItems = await docClient
      .query({
        TableName: tableName,
        Limit: maxResults,
        KeyConditionExpression: `${PARTITION_ATTRIBUTE} = :partitionBucket`,
        ExpressionAttributeValues: {
          ':partitionBucket': bucket
        }
      })
      .promise()

    return allItems.Items.map((i) => i.value)
  }

  async function getRecentItems(lookbackSeconds, maxResults = 1000) {
    const start = Math.round(
      DateTime.now()
        .setZone('utc')
        .minus({ seconds: lookbackSeconds })
        .toSeconds()
    )
    return getAllItemsInDateRange(start, null, maxResults)
  }

  async function getAllItemsInDateRange(
    startTimeStampSeconds,
    endTimeStampSeconds,
    maxResults = 1000
  ) {
    if (!endTimeStampSeconds)
      endTimeStampSeconds = Math.ceil(DateTime.now().setZone('utc').toSeconds())

    if (
      !startTimeStampSeconds ||
      parseInt(startTimeStampSeconds) != startTimeStampSeconds ||
      startTimeStampSeconds < 0
    )
      throw new Error('Invalid start time')

    const startMonth = DateTime.fromSeconds(startTimeStampSeconds)
      .setZone('utc')
      .toISO()
      .slice(0, 7)
    const oneMonthAfterStart = DateTime.fromSeconds(startTimeStampSeconds)
      .setZone('utc')
      .plus({ months: 1 })
      .toISO()
      .slice(0, 7)
    const endMonth = DateTime.fromSeconds(endTimeStampSeconds)
      .setZone('utc')
      .toISO()
      .slice(0, 7)

    if (endMonth !== startMonth && endMonth !== oneMonthAfterStart) {
      throw new Error('The date range cannot span more than 2 months.')
    }

    const firstMonthResults = await docClient
      .query({
        TableName: tableName,
        IndexName: 'Timestamp',
        Limit: maxResults,
        KeyConditionExpression: `${MONTH_ATTRIBUTE} = :month AND createdAt BETWEEN :start AND :end`,
        ExpressionAttributeValues: {
          ':month': startMonth,
          ':start': startTimeStampSeconds,
          ':end': endTimeStampSeconds
        },
        ScanIndexForward: true
      })
      .promise()

    if (startMonth != endMonth)
      console.log(
        `Fetching all values in month ${endMonth} from ${startTimeStampSeconds} to ${endTimeStampSeconds}`
      )

    const secondMonthResults =
      startMonth === endMonth
        ? null
        : await docClient
            .query({
              TableName: tableName,
              IndexName: 'Timestamp',
              Limit: maxResults,
              KeyConditionExpression: `${MONTH_ATTRIBUTE} = :month AND createdAt BETWEEN :start AND :end`,
              ExpressionAttributeValues: {
                ':month': endMonth,
                ':start': startTimeStampSeconds,
                ':end': endTimeStampSeconds
              },
              ScanIndexForward: true
            })
            .promise()
    const results =
      secondMonthResults == null
        ? firstMonthResults.Items
        : [...firstMonthResults.Items, secondMonthResults.Items]

    return results
      .filter((doc) => {
        return !isExpiredDoc(doc)
      })
      .map((doc) => doc.value)
  }

  function isExpiredDoc(item) {
    const expired =
      item &&
      item[TTL_ATTRIBUTE] &&
      DateTime.fromSeconds(item[TTL_ATTRIBUTE]) < DateTime.now()
    //if(expired) console.log(`${item[KEY_ATTRIBUTE]} is expired`)

    return expired
  }

  async function removeUnpartitionedItem(key) {
    return removePartitionedItem(null, key)
  }

  async function removePartitionedItem(bucket, key) {
    try {
      const awsKey = {}
      awsKey[KEY_ATTRIBUTE] = key
      if (partitionDataInBuckets) {
        awsKey[PARTITION_ATTRIBUTE] = bucket
      }
      const doc = await docClient
        .delete({ TableName: tableName, Key: awsKey })
        .promise()
    } catch (deleteErr) {
      console.error(`Failed to delete item from dynamo: ${deleteErr.message}`)
      throw new Error('Key-Value Store removeItem failed')
    }
  }

  return {
    getItem: partitionDataInBuckets ? getPartitionedItem : getUnpartitionedItem,
    putItem: partitionDataInBuckets ? putPartitionedItem : putUnpartitionedItem,
    removeItem: partitionDataInBuckets
      ? removePartitionedItem
      : removeUnpartitionedItem,
    getRecentItems,
    getAllItemsInPartition: partitionDataInBuckets
      ? getAllItemsInPartition
      : null,
    getAllItemsInDateRange
  }
}

export async function deleteDynamoTableIfExists(tableName, safety) {
  if (safety !== `Yes permantently delete table ${tableName}`)
    throw new Error('Satefy!')

  try {
    console.log(`Deleting table ${tableName}`)
    await dynamo.deleteTable({ TableName: tableName }).promise()
    console.log(`Waiting for table to disappear.`)
    await dynamo.waitFor('tableNotExists', { TableName: tableName }).promise()
  } catch (deleteErr) {
    if (deleteErr.code !== 'ResourceNotFoundException') {
      throw deleteErr
    } else {
      console.log('Table was already deleted')
    }
  }
}

export async function waitABit(delay = 1500) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), delay)
  })
}
