// Vercel API endpoint for MQTT proxy
export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const data = {
    gateStatus: 'Brána zavřena',
    garageStatus: 'Garáž zavřena',
    isConnected: true,
    rawGateStatus: 'closed',
    rawGarageStatus: 'closed',
    timestamp: new Date().toISOString()
  };
  
  res.status(200).json(data);
}