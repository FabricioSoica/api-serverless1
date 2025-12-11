const AWS = require("aws-sdk");

// Configuração AWS usando credenciais do .env (AWS Academy)
AWS.config.update({
  region: process.env.APP_REGION || "us-east-1",
  accessKeyId: process.env.APP_ACCESS_KEY_ID,
  secretAccessKey: process.env.APP_SECRET_ACCESS_KEY,
  sessionToken: process.env.APP_SESSION_TOKEN
});

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

