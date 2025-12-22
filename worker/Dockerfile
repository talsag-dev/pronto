FROM node:20-alpine

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Remove development dependencies
RUN npm prune --production

ENV NODE_ENV production
ENV PORT 4000

EXPOSE 4000

CMD ["npm", "start"]
