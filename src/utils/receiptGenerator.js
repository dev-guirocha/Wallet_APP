import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

const formatCurrency = (value) => {
  const numericValue = Number(value || 0);
  return numericValue.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const generateAndShareReceipt = async ({
  clientName,
  amount,
  date,
  professionalName,
  serviceDescription,
}) => {
  try {
    const formattedDate = new Date(date).toLocaleDateString('pt-BR');
    const formattedAmount = formatCurrency(amount);

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
            .container { border: 2px solid #ddd; padding: 30px; border-radius: 10px; }
            .header { text-align: center; margin-bottom: 40px; }
            .title { font-size: 28px; font-weight: bold; color: #2B6CB0; text-transform: uppercase; letter-spacing: 2px; }
            .subtitle { font-size: 14px; color: #666; margin-top: 5px; }
            .row { margin-bottom: 20px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
            .label { font-weight: bold; font-size: 14px; color: #888; text-transform: uppercase; margin-bottom: 5px; }
            .value { font-size: 18px; }
            .total-row { margin-top: 30px; text-align: right; }
            .total-value { font-size: 32px; font-weight: bold; color: #2B6CB0; }
            .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #999; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="title">Recibo de Pagamento</div>
              <div class="subtitle">Comprovante gerado digitalmente</div>
            </div>

            <div class="row">
              <div class="label">Pagador (Cliente)</div>
              <div class="value">${clientName}</div>
            </div>

            <div class="row">
              <div class="label">Beneficiario (Profissional)</div>
              <div class="value">${professionalName || 'Profissional Autonomo'}</div>
            </div>

            <div class="row">
              <div class="label">Data</div>
              <div class="value">${formattedDate}</div>
            </div>

            <div class="row">
              <div class="label">Referente a</div>
              <div class="value">${serviceDescription || 'Servicos prestados'}</div>
            </div>

            <div class="total-row">
              <div class="label">Valor Total</div>
              <div class="total-value">${formattedAmount}</div>
            </div>

            <div class="footer">
              Este recibo foi gerado automaticamente pelo aplicativo Flowdesk.
            </div>
          </div>
        </body>
      </html>
    `;

    const { uri } = await Print.printToFileAsync({ html: htmlContent });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } else {
      Alert.alert('Erro', 'O compartilhamento nao esta disponivel neste dispositivo.');
    }
  } catch (error) {
    console.error('Erro ao gerar recibo:', error);
    Alert.alert('Erro', 'Nao foi possivel gerar o recibo.');
  }
};
