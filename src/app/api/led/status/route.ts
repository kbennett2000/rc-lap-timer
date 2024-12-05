
// app/api/led/status/route.ts
import { NextResponse } from 'next/server';
import { LED_DEVICE_IP, LED_DEVICE_TIMEOUT } from '../config';

export async function GET() {
  try {
    console.log(`Checking LED device at http://${LED_DEVICE_IP}`);
    
    const response = await fetch(`http://${LED_DEVICE_IP}/`, {
      signal: AbortSignal.timeout(5000)
    });
    
    console.log('Status check response:', response.status);
    
    if (response.ok) {
      return NextResponse.json({ status: 'connected' });
    }
    throw new Error(`Device responded with status: ${response.status}`);
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json({ 
      status: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}