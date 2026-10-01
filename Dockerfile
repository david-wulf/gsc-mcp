FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm install -g @modelcontextprotocol/supergateway
EXPOSE 8000
CMD ["supergateway", "--stdio", "node /app/dist/index.js", "--port", "8000"]
