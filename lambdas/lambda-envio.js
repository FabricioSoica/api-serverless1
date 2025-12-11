const AWS = require("aws-sdk");
const https = require("https");

// Configuração AWS usando credenciais do .env (AWS Academy)
AWS.config.update({
  region: process.env.APP_REGION || "us-east-1",
  accessKeyId: process.env.APP_ACCESS_KEY_ID,
  secretAccessKey: process.env.APP_SECRET_ACCESS_KEY,
  sessionToken: process.env.APP_SESSION_TOKEN
});

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

