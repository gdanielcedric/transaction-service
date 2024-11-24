FROM node:20
WORKDIR /app
COPY package*.json ./
COPY .env ./
RUN npm install
COPY . .
CMD ["npm", "run", "start:prod"]