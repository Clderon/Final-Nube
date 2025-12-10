FROM public.ecr.aws/docker/library/node:20-alpine

WORKDIR /srv

# 1️⃣ Copiar solo package.json para aprovechar cache
COPY package*.json ./

# 2️⃣ Instalar dependencias
RUN npm install

# 3️⃣ Copiar el resto del código
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
