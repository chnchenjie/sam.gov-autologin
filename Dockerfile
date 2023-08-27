FROM mcr.microsoft.com/playwright:v1.34.0-jammy

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

RUN npm install && npm run build
EXPOSE 3300
CMD [ "npm", "run", "start" ]