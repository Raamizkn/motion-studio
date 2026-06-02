FROM node:20-bullseye-slim

# System deps: Chromium (for hyperframes/puppeteer) + FFmpeg
RUN apt-get update && apt-get install -y \
  chromium \
  ffmpeg \
  fonts-liberation \
  fonts-noto-color-emoji \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libgbm1 \
  libglib2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Create a chromium wrapper to enforce --no-sandbox for Docker (root user)
RUN echo '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox --disable-setuid-sandbox "$@"' > /usr/bin/chromium-wrapper && chmod +x /usr/bin/chromium-wrapper

# Tell puppeteer/hyperframes to use the wrapper
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-wrapper
ENV CHROME_PATH=/usr/bin/chromium-wrapper

WORKDIR /app

# Install deps
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm install --ignore-scripts

# Copy source and build frontend
COPY . .
RUN npm run build

# Create renders output dir
RUN mkdir -p .renders

EXPOSE 3000
CMD ["node", "server/prod.mjs"]
