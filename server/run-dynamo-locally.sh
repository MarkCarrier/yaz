#!/bin/bash

LOCAL_DATA_DIR="$(pwd)/data/dynamo"
docker run -p 8000:8000 -v $LOCAL_DATA_DIR:/home/dynamodblocal/data amazon/dynamodb-local -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb -dbPath ./data