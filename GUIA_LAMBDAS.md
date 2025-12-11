# 🚀 Guia Completo - Configuração das Lambdas AWS

Este guia detalha passo a passo como criar e configurar todas as Lambdas necessárias para a atividade final.

---

## 📋 Pré-requisitos

- ✅ Tabela DynamoDB `pedidos` criada
- ✅ Bucket S3 configurado
- ✅ API Node.js rodando na EC2
- ✅ Credenciais AWS configuradas
- ✅ Região: `us-east-1`

---

## 🔵 PASSO 1: Criar Tópico SNS

### 1.1 Criar o Tópico

1. Acesse o console AWS → **SNS** (Simple Notification Service)
2. Clique em **Topics** no menu lateral
3. Clique em **Create topic**
4. Configure:
   - **Type**: Standard
   - **Name**: `notificacoesPedidos`
5. Clique em **Create topic**

### 1.2 Criar Subscription (Assinatura de E-mail)

1. Clique no tópico `notificacoesPedidos` que você acabou de criar
2. Clique em **Create subscription**
3. Configure:
   - **Protocol**: Email
   - **Endpoint**: Seu e-mail (ex: `seuemail@gmail.com`)
4. Clique em **Create subscription**
5. **IMPORTANTE**: Você receberá um e-mail de confirmação. Clique no link para confirmar a assinatura.

### 1.3 Copiar o ARN do Tópico

1. Na página do tópico, copie o **Topic ARN** (exemplo: `arn:aws:sns:us-east-1:123456789012:notificacoesPedidos`)
2. Adicione no seu `.env` na EC2:
   ```
   SNS_TOPIC_ARN=arn:aws:sns:us-east-1:SEU_ACCOUNT_ID:notificacoesPedidos
   ```

---

## 🔵 PASSO 2: Ativar DynamoDB Streams

### 2.1 Habilitar Stream na Tabela

1. Acesse **DynamoDB** → **Tables**
2. Clique na tabela `pedidos`
3. Vá na aba **Exports and streams**
4. Em **DynamoDB stream details**, clique em **Enable**
5. Configure:
   - **View type**: **New image** (recomendado) ou **New and old images**
6. Clique em **Save**

**O que isso faz?** Toda vez que um item for inserido ou modificado na tabela, o DynamoDB enviará um evento para o Stream, que acionará a Lambda.

---

## 🔵 PASSO 3: Configurar Credenciais AWS (AWS Academy)

⚠️ **IMPORTANTE**: Como você está no AWS Academy, não pode criar IAM Roles. Você usará as credenciais do `.env` diretamente nas Lambdas.

### 3.1 Obter Credenciais do AWS Academy

1. No painel do AWS Academy, vá em **AWS Details** ou **AWS CLI Credentials**
2. Copie as seguintes credenciais:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_SESSION_TOKEN` (se disponível)
   - `AWS_REGION`

### 3.2 Usar Role Existente do Lab

Ao criar as Lambdas, você pode:
- Usar o role padrão do lab (ex: `LabRole` ou `LabInstanceProfile`)
- OU usar "Create a new role with basic Lambda permissions" (o console cria automaticamente)

**Nota**: As credenciais serão configuradas via variáveis de ambiente nas Lambdas, então o role básico é suficiente para logs no CloudWatch.

---

## 🔵 PASSO 4: Criar Lambda `lambda-execucao`

### 4.1 Criar a Função

1. Acesse **Lambda** → **Functions**
2. Clique em **Create function**
3. Configure:
   - **Function name**: `lambda-execucao`
   - **Runtime**: Node.js 18.x
   - **Architecture**: x86_64
   - **Execution role**: 
     - Se tiver role do lab disponível: **Use existing role** → Selecione (ex: `LabRole`)
     - Se não tiver: **Create a new role with basic Lambda permissions** (aceite o nome padrão)
4. Clique em **Create function**

### 4.2 Adicionar Código

1. Na aba **Code**, cole este código no arquivo `index.js`:

```javascript
const AWS = require("aws-sdk");
AWS.config.update({ region: "us-east-1" });

const sns = new AWS.SNS();
const TOPIC_ARN = process.env.SNS_TOPIC_ARN;

exports.handler = async (event) => {
  console.log("Evento DynamoDB recebido:", JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      try {
        if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") {
          continue;
        }

        const novo = AWS.DynamoDB.Converter.unmarshall(record.dynamodb.NewImage);

        const { emailCliente, nomeCliente, status, idPedido, valor, data } = novo;

        if (!emailCliente || !status) {
          console.log("Pedido sem email ou status, ignorado");
          continue;
        }

        let mensagem = "";

        if (status === "RECEBIDO") {
          mensagem = `
===== NOVO PEDIDO RECEBIDO =====

Olá, ${nomeCliente}!

Seu pedido foi RECEBIDO com sucesso.

ID do Pedido: ${idPedido}
Valor: R$ ${valor}
Data: ${data}

Em breve ele entrará em preparação.

Obrigado pela preferência!
=================================
`;
        } else if (status === "PREPARACAO") {
          mensagem = `
===== PEDIDO EM PREPARAÇÃO =====

Olá, ${nomeCliente}!

Seu pedido está em PREPARAÇÃO.

ID do Pedido: ${idPedido}
Valor: R$ ${valor}

Em breve será enviado!

Obrigado pela preferência!
=================================
`;
        } else if (status === "ENVIADO") {
          mensagem = `
===== PEDIDO ENVIADO =====

Olá, ${nomeCliente}!

Seu pedido foi ENVIADO!

ID do Pedido: ${idPedido}
Valor: R$ ${valor}
Referência NF: ${novo.referenciaNota || 'N/A'}
Data de Envio: ${novo.dataEnvio || 'N/A'}

Obrigado por comprar conosco!
=================================
`;
        }

        await sns.publish({
          TopicArn: TOPIC_ARN,
          Subject: `Atualização de Pedido: ${status}`,
          Message: mensagem
        }).promise();

        console.log("Notificação SNS enviada para:", emailCliente);
      } catch (err) {
        console.error("Erro ao processar record:", err);
      }
    }

    return { statusCode: 200, body: "Processado com sucesso" };
  } catch (err) {
    console.error("Erro no lambda-execucao:", err);
    return { statusCode: 500, body: "Erro ao processar" };
  }
};
```

2. Clique em **Deploy**

### 4.3 Configurar Variáveis de Ambiente

1. Vá em **Configuration** → **Environment variables**
2. Clique em **Edit**
3. Adicione as seguintes variáveis (use as mesmas credenciais do seu `.env`).
   > Importante: a Lambda não aceita variáveis que comecem com `AWS_`, por isso usamos nomes próprios.
   - **Key**: `SNS_TOPIC_ARN` → **Value**: `arn:aws:sns:us-east-1:SEU_ACCOUNT_ID:notificacoesPedidos`
   - **Key**: `APP_ACCESS_KEY_ID` → **Value**: (sua access key do AWS Academy)
   - **Key**: `APP_SECRET_ACCESS_KEY` → **Value**: (sua secret key do AWS Academy)
   - **Key**: `APP_SESSION_TOKEN` → **Value**: (seu session token do AWS Academy, se tiver)
   - **Key**: `APP_REGION` → **Value**: `us-east-1`
4. Clique em **Save**

### 4.4 Adicionar Trigger do DynamoDB Stream

1. Na página da Lambda, vá em **Configuration** → **Triggers**
2. Clique em **Add trigger**
3. Configure:
   - **Source**: DynamoDB
   - **DynamoDB table**: `pedidos`
   - **Batch size**: 1 (para testes)
   - **Starting position**: Latest
4. Clique em **Add**

**O que isso faz?** Toda vez que um pedido for criado ou atualizado no DynamoDB, esta Lambda será acionada e enviará notificação via SNS.

---

## 🔵 PASSO 5: Criar Lambda `lambda-envio`

### 5.1 Criar a Função

1. **Lambda** → **Functions** → **Create function**
2. Configure:
   - **Function name**: `lambda-envio`
   - **Runtime**: Node.js 18.x
   - **Execution role**: Use o mesmo role do Passo 4.1 (role do lab ou role básico criado automaticamente)
3. Clique em **Create function**

### 5.2 Adicionar Código

Cole este código:

```javascript
const AWS = require("aws-sdk");
const https = require("https");

AWS.config.update({ region: "us-east-1" });

const dynamo = new AWS.DynamoDB.DocumentClient();
const EC2_HOST = process.env.EC2_HOST;
const EC2_PORT = process.env.EC2_PORT || 3000;

exports.handler = async () => {
  try {
    console.log("Lambda-envio executada - buscando pedidos pendentes...");

    const result = await dynamo.scan({ TableName: "pedidos" }).promise();
    const now = Date.now();

    const pendentes = (result.Items || []).filter(p => {
      if (p.status !== "RECEBIDO") return false;
      
      const dataPedido = new Date(p.data).getTime();
      const diffMinutos = (now - dataPedido) / (1000 * 60);
      
      return diffMinutos >= 4; // Pedidos com mais de 4 minutos
    });

    console.log(`Pedidos pendentes encontrados: ${pendentes.length}`);

    for (const pedido of pendentes) {
      try {
        await chamarAPI(pedido.idPedido);
        console.log(`API chamada para idPedido: ${pedido.idPedido}`);
      } catch (err) {
        console.error(`Erro ao chamar API para ${pedido.idPedido}:`, err);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: `Processados ${pendentes.length} pedidos`,
        pedidos: pendentes.map(p => p.idPedido)
      })
    };
  } catch (e) {
    console.error("Erro lambda-envio:", e);
    return { statusCode: 500, body: "Erro" };
  }
};

function chamarAPI(idPedido) {
  const postData = JSON.stringify({ idPedido });

  const options = {
    hostname: EC2_HOST,
    port: EC2_PORT,
    path: "/lambda/preparacao",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData)
    },
    timeout: 10000
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", chunk => body += chunk.toString());
      res.on("end", () => {
        console.log(`API response status: ${res.statusCode}, body: ${body}`);
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });

    req.write(postData);
    req.end();
  });
}
```

### 5.3 Configurar Variáveis de Ambiente

1. **Configuration** → **Environment variables** → **Edit**
2. Adicione:
   - **Key**: `EC2_HOST` → **Value**: `44.220.51.60` (seu IP público da EC2)
   - **Key**: `EC2_PORT` → **Value**: `3000`
   - **Key**: `APP_ACCESS_KEY_ID` → **Value**: (sua access key do AWS Academy)
   - **Key**: `APP_SECRET_ACCESS_KEY` → **Value**: (sua secret key do AWS Academy)
   - **Key**: `APP_SESSION_TOKEN` → **Value**: (seu session token do AWS Academy, se tiver)
   - **Key**: `APP_REGION` → **Value**: `us-east-1`
3. Clique em **Save**

### 5.4 Criar EventBridge Rule (Agendamento)

1. Acesse **EventBridge** → **Rules**
2. Clique em **Create rule**
3. Configure:
   - **Name**: `every-5-min`
   - **Description**: Executa lambda-envio a cada 5 minutos
   - **Rule type**: Schedule
   - **Schedule pattern**: **Rate-based schedule**
   - **Rate expression**: `rate(5 minutes)`
4. Clique em **Next**
5. Em **Targets**, configure:
   - **Target type**: AWS service
   - **Select a target**: Lambda function
   - **Function**: `lambda-envio`
6. Clique em **Next** → **Next** → **Create rule**

**O que isso faz?** A cada 5 minutos, o EventBridge executa a `lambda-envio`, que busca pedidos com status RECEBIDO há mais de 4 minutos e chama sua API para atualizar o status para PREPARACAO.

---

## 🔵 PASSO 6: Criar Lambda `lambda-confirmacao`

### 6.1 Criar a Função

1. **Lambda** → **Functions** → **Create function**
2. Configure:
   - **Function name**: `lambda-confirmacao`
   - **Runtime**: Node.js 18.x
   - **Execution role**: Use o mesmo role do Passo 4.1 (role do lab ou role básico criado automaticamente)
3. Clique em **Create function**

### 6.2 Configurar Variáveis de Ambiente

1. **Configuration** → **Environment variables** → **Edit**
2. Adicione:
   - **Key**: `APP_ACCESS_KEY_ID` → **Value**: (sua access key do AWS Academy)
   - **Key**: `APP_SECRET_ACCESS_KEY` → **Value**: (sua secret key do AWS Academy)
   - **Key**: `APP_SESSION_TOKEN` → **Value**: (seu session token do AWS Academy, se tiver)
   - **Key**: `APP_REGION` → **Value**: `us-east-1`
3. Clique em **Save**

### 6.3 Adicionar Código

Cole este código:

```javascript
const AWS = require("aws-sdk");

// Configuração AWS usando credenciais do .env (AWS Academy)
AWS.config.update({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN
});

const s3 = new AWS.S3();
const dynamo = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
  console.log("Evento S3 recebido:", JSON.stringify(event, null, 2));

  try {
    for (const record of event.Records) {
      try {
        const bucket = record.s3.bucket.name;
        const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
        
        console.log(`Processando arquivo: ${bucket}/${key}`);

        const head = await s3.headObject({ 
          Bucket: bucket, 
          Key: key 
        }).promise();

        const idPedido = head.Metadata ? head.Metadata.idpedido : null;

        if (!idPedido) {
          console.log("Arquivo sem metadado idPedido. Ignorando.");
          continue;
        }

        console.log(`Atualizando pedido ${idPedido} para ENVIADO`);

        await dynamo.update({
          TableName: "pedidos",
          Key: { idPedido },
          UpdateExpression: "SET #s = :s, dataEnvio = :d, referenciaNota = :r",
          ExpressionAttributeNames: { "#s": "status" },
          ExpressionAttributeValues: {
            ":s": "ENVIADO",
            ":d": new Date().toISOString(),
            ":r": key
          }
        }).promise();

        console.log(`Pedido ${idPedido} atualizado para ENVIADO com sucesso`);
      } catch (err) {
        console.error("Erro ao processar record:", err);
      }
    }

    return { statusCode: 200, body: "Processado com sucesso" };
  } catch (err) {
    console.error("Erro lambda-confirmacao:", err);
    return { statusCode: 500, body: "Erro ao processar" };
  }
};
```

### 6.4 Adicionar Trigger do S3

1. Acesse **S3** → Seu bucket
2. Vá em **Properties** → **Event notifications**
3. Clique em **Create event notification**
4. Configure:
   - **Event name**: `onPdfUpload`
   - **Event types**: Marque **All object create events** (ou apenas **PUT**)
   - **Prefix**: (deixe vazio ou coloque um prefixo se quiser filtrar)
   - **Suffix**: `.pdf` (opcional - apenas arquivos PDF)
5. Em **Destination**, configure:
   - **Destination type**: Lambda function
   - **Lambda function**: `lambda-confirmacao`
6. Clique em **Save changes**

**IMPORTANTE**: O S3 pedirá permissão para invocar a Lambda. Clique em **Allow** quando aparecer a mensagem.

**O que isso faz?** Quando um arquivo for enviado ao S3, esta Lambda será acionada, lerá o metadado `idPedido` do arquivo e atualizará o pedido no DynamoDB para status ENVIADO.

---

## 🧪 TESTES PASSO A PASSO

### Teste 1: Verificar SNS

1. No console SNS, vá no tópico `notificacoesPedidos`
2. Clique em **Publish message**
3. Cole uma mensagem de teste
4. Clique em **Publish message**
5. Verifique se você recebeu o e-mail

### Teste 2: Testar lambda-execucao

1. Crie um pedido via sua API (POST `/pedidos`)
2. Vá em **CloudWatch** → **Log groups** → `/aws/lambda/lambda-execucao`
3. Verifique os logs - deve aparecer "Notificação SNS enviada"
4. Verifique seu e-mail - deve receber a notificação

### Teste 3: Testar lambda-envio

1. Crie um pedido com status RECEBIDO
2. Aguarde 5 minutos OU execute manualmente a Lambda:
   - Vá na Lambda `lambda-envio`
   - Clique em **Test**
   - Crie um evento de teste vazio `{}`
   - Clique em **Test**
3. Verifique os logs no CloudWatch
4. Verifique se o pedido foi atualizado para PREPARACAO no DynamoDB

### Teste 4: Testar lambda-confirmacao

1. Faça upload de um arquivo via sua API (POST `/pedidos/:idPedido/upload`)
2. Verifique os logs da `lambda-confirmacao` no CloudWatch
3. Verifique se o pedido foi atualizado para ENVIADO no DynamoDB
4. Verifique se você recebeu e-mail de notificação

---

## 📊 Verificar Logs no CloudWatch

1. Acesse **CloudWatch** → **Log groups**
2. Procure por:
   - `/aws/lambda/lambda-execucao`
   - `/aws/lambda/lambda-envio`
   - `/aws/lambda/lambda-confirmacao`
3. Clique em cada um para ver os logs de execução

---

## ✅ Checklist Final

- [ ] Tópico SNS criado e subscription confirmada
- [ ] DynamoDB Streams ativado na tabela `pedidos`
- [ ] Variáveis de ambiente com credenciais AWS configuradas em todas as Lambdas
- [ ] Lambda `lambda-execucao` criada com trigger do DynamoDB Stream
- [ ] Lambda `lambda-envio` criada com EventBridge rule (5 minutos)
- [ ] Lambda `lambda-confirmacao` criada com trigger do S3
- [ ] Variáveis de ambiente configuradas em todas as Lambdas
- [ ] Rota `/lambda/preparacao` adicionada na API
- [ ] Testes realizados e funcionando
- [ ] Logs aparecendo no CloudWatch
- [ ] E-mails sendo recebidos via SNS

---

## 🆘 Problemas Comuns

### Lambda não recebe eventos do DynamoDB Stream
- Verifique se o Stream está ativado na tabela
- Verifique se o trigger está habilitado na Lambda
- Verifique se as credenciais AWS estão configuradas nas variáveis de ambiente

### Lambda não consegue publicar no SNS
- Verifique se a variável `SNS_TOPIC_ARN` está configurada
- Verifique se as credenciais AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`) estão configuradas
- Verifique se o ARN do tópico está correto
- Verifique se as credenciais do AWS Academy ainda estão válidas (podem expirar)

### Lambda-envio não consegue chamar a API
- Verifique se o IP da EC2 está correto nas variáveis de ambiente
- Verifique se a porta 3000 está aberta no Security Group
- Verifique se a rota `/lambda/preparacao` existe na API

### Lambda-confirmacao não encontra metadado
- Verifique se o upload está salvando o metadado `idPedido` corretamente
- Verifique se o nome do metadado está em minúsculas (`idpedido`)

### Erro de credenciais nas Lambdas
- Verifique se todas as variáveis de ambiente estão configuradas (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, `AWS_REGION`)
- Se o `AWS_SESSION_TOKEN` expirar, você precisará atualizar nas variáveis de ambiente das Lambdas
- As credenciais do AWS Academy podem expirar - verifique no painel do Academy se precisa renovar

---

**Pronto! Agora você tem todas as Lambdas configuradas e funcionando! 🎉**

