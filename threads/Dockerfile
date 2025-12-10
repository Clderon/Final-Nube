FROM public.ecr.aws/docker/library/node:18-alpine

WORKDIR /srv
ADD . .
RUN npm install

EXPOSE 3000
CMD ["node", "server.js"]
