import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface GeminiRequest {
  action: 'edge-fill' | 'generate-variation';
  imageBase64: string;
  prompt: string;
  resolution?: number;
  additionalImages?: { base64: string; mimeType: string }[];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured on server' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: GeminiRequest = await req.json();
    const { action, imageBase64, prompt, additionalImages } = body;

    if (!action || !imageBase64 || !prompt) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: action, imageBase64, prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the parts array for Gemini
    const parts: any[] = [{ text: prompt }];

    // Add additional images first (for reference)
    if (additionalImages && additionalImages.length > 0) {
      for (const img of additionalImages) {
        parts.push({
          inline_data: {
            mime_type: img.mimeType || 'image/png',
            data: img.base64,
          },
        });
      }
    }

    // Add the main image
    parts.push({
      inline_data: {
        mime_type: 'image/png',
        data: imageBase64,
      },
    });

    // Call Gemini API directly via REST
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      }),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      console.error('Gemini API error:', errorText);
      return new Response(
        JSON.stringify({ error: `Gemini API error: ${geminiResponse.status}`, details: errorText }),
        { status: geminiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiResponse.json();

    // Extract image from response
    const candidate = geminiData.candidates?.[0];
    if (!candidate) {
      return new Response(
        JSON.stringify({ error: 'No candidates returned from Gemini' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for finish reason issues
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      const errorMessages: { [key: string]: string } = {
        'SAFETY': 'Image was blocked for safety reasons.',
        'RECITATION': 'Image may contain copyrighted material.',
        'MAX_TOKENS': 'Image is too complex.',
        'IMAGE_OTHER': 'Image could not be processed.',
      };
      const errorMessage = errorMessages[candidate.finishReason] || `Processing failed: ${candidate.finishReason}`;
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find the image part in the response
    const imagePart = candidate.content?.parts?.find((part: any) => part.inline_data);
    if (!imagePart || !imagePart.inline_data) {
      return new Response(
        JSON.stringify({ error: 'No image data in Gemini response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        imageBase64: imagePart.inline_data.data,
        mimeType: imagePart.inline_data.mime_type || 'image/png'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Gemini proxy error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
