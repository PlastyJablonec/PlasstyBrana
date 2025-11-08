// Vercel API endpoint for MQTT proxy
module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  const data = {
    gateStatus: 'Brána zavřena',
    garageStatus: 'Garáž zavřena',
    isConnected: true,
    rawGateStatus: 'closed',
    rawGarageStatus: 'closed',
    timestamp: new Date().toISOString()
  };
  
  res.status(200).json(data);
};