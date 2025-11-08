// Vercel API endpoint for MQTT proxy
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Mock MQTT data for testing
    const mockData = {
      gateStatus: 'Brána zavřena',
      garageStatus: 'Garáž zavřena',
      isConnected: true,
      rawGateStatus: 'closed',
      rawGarageStatus: 'closed',
      timestamp: new Date().toISOString(),
      lastUpdate: new Date().toISOString()
    };

    console.log('🔗 MQTT Proxy API called');
    console.log('📊 Returning mock data:', mockData);

    return res.status(200).json(mockData);
  } catch (error) {
    console.error('❌ MQTT Proxy API error:', error);
    
    return res.status(500).json({
      error: 'MQTT Proxy Error',
      message: 'Unable to connect to MQTT broker',
      timestamp: new Date().toISOString(),
      gateStatus: 'Neznámý stav',
      garageStatus: 'Neznámý stav',
      isConnected: false,
      rawGateStatus: null,
      rawGarageStatus: null
    });
  }
}