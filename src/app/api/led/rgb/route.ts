// app/api/led/rgb/route.ts
import { NextResponse } from 'next/server';
import { LED_DEVICE_IP, LED_DEVICE_TIMEOUT } from '../config';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const r = searchParams.get('r');
  const g = searchParams.get('g');
  const b = searchParams.get('b');

  const ledUrl = `http://${LED_DEVICE_IP}/rgb?r=${r}&g=${g}&b=${b}`;
  
  try {
    console.log(`Attempting to connect to LED device at: ${ledUrl}`);
    
    const response = await fetch(ledUrl, {
      // Add timeout to avoid hanging
      signal: AbortSignal.timeout(5000)
    });
    
    console.log('LED device response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`LED device responded with status: ${response.status}`);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LED device error:', error);
    
    // More detailed error response
    return NextResponse.json({
      error: 'Failed to communicate with LED device',
      details: error instanceof Error ? error.message : 'Unknown error',
      deviceUrl: ledUrl
    }, { status: 500 });
  }
}
