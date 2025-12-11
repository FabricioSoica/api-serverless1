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

