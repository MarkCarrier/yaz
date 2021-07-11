FROM node:14.17-buster-slim

# NodeGit dependencies
RUN apt-get update && apt-get install -y libgssapi-krb5-2

# Get NPM Dependencies (done in tmp directory to improve docker caching performance)
COPY package.json /tmp/package.json
COPY package-lock.json /tmp/package-lock.json
RUN cd /tmp && npm install
RUN mkdir -p /app && cp -a /tmp/node_modules /app/

WORKDIR /app
ADD . ./
RUN npm run build
CMD ["npm", "start"]
