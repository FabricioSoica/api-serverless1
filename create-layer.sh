#!/bin/bash

# Script para criar Layer com aws-sdk v2 para Lambda Node.js 20

echo "Criando Layer com aws-sdk v2..."

# Criar diretório temporário
mkdir -p layer/nodejs
cd layer/nodejs

# Instalar aws-sdk v2
npm init -y
npm install aws-sdk@2

# Voltar para raiz e criar ZIP
cd ../..
zip -r aws-sdk-layer.zip nodejs/

echo "Layer criada: aws-sdk-layer.zip"
echo "Agora você pode fazer upload desta Layer no console da Lambda!"

