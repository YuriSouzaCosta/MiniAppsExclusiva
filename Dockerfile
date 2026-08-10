# Use Node.js 18 on Debian Bullseye (slim version for smaller size)
FROM node:18-bullseye-slim

# Install necessary libraries for Oracle Instant Client and native modules (sqlite3)
RUN apt-get update && apt-get install -y \
    libaio1 \
    unzip \
    wget \
    python3 \
    python3-pip \
    tesseract-ocr \
    tesseract-ocr-por \
    libgl1 \
    libgomp1 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Download and install Oracle Instant Client
WORKDIR /opt/oracle
RUN wget https://download.oracle.com/otn_software/linux/instantclient/1919000/instantclient-basic-linux.x64-19.19.0.0.0dbru.zip && \
    unzip instantclient-basic-linux.x64-19.19.0.0.0dbru.zip && \
    rm instantclient-basic-linux.x64-19.19.0.0.0dbru.zip && \
    sh -c "echo /opt/oracle/instantclient_19_19 > /etc/ld.so.conf.d/oracle-instantclient.conf" && \
    ldconfig

# Set environment variables for Oracle
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient_19_19

# Return to app directory
WORKDIR /usr/src/app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Dependências Python do OCR e do processamento de PDFs/imagens.
RUN python3 -m pip install --no-cache-dir -r python/requirements.txt

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD [ "node", "app.js" ]
