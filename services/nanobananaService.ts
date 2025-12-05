import { GoogleGenAI } from "@google/genai";
import { resizeImage } from '../utils/fileUtils';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

// Get API key from environment (set in Vercel/hosting provider)
const getApiKey = (): string => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("API Key is not configured. Please set the GEMINI_API_KEY environment variable in your hosting provider.");
    }
    return apiKey;
};

export const processWithNanobanana = async (
    imageUrl: string, 
    resolution: number = 1024,
    aspectRatio: '9:16' | '1:1' | '16:9' = '9:16'
): Promise<string> => {
    console.log('[Nanobanana] 🚀 Starting processWithNanobanana');
    console.log('[Nanobanana] 📊 Input URL length:', imageUrl.length);
    console.log('[Nanobanana] 📊 Resolution:', resolution, 'Aspect Ratio:', aspectRatio);
    
    const apiKey = getApiKey();
    console.log('[Nanobanana] 🔑 API key obtained (length):', apiKey.length);
    const ai = new GoogleGenAI({ apiKey });

    // Calculate dimensions based on aspect ratio
    let width: number, height: number;
    if (aspectRatio === '9:16') {
        width = resolution;
        height = Math.round(resolution * 16 / 9);
    } else if (aspectRatio === '16:9') {
        width = resolution;
        height = Math.round(resolution * 9 / 16);
    } else {
        width = resolution;
        height = resolution;
    }

    // Resize to specified resolution with correct aspect ratio
    console.log('[Nanobanana] 🖼️ Resizing to:', width, 'x', height);
    const resizedImageUrl = await resizeImage(imageUrl, width, height);
    console.log('[Nanobanana] 🖼️ Resized URL length:', resizedImageUrl.length);
    const imageBase64 = dataUrlToBase64(resizedImageUrl);
    console.log('[Nanobanana] 🖼️ Base64 length:', imageBase64.length);

    // Prompt designed for seamless edge fill while preserving logo structure
    const prompt = `TASK: Create a complete ${aspectRatio} aspect ratio image by filling ALL empty/black/cropped areas with seamless background without altering the rest of the image.

CRITICAL OUTPUT REQUIREMENTS:
- Output MUST be ${aspectRatio} aspect ratio (${width}x${height} pixels)
- fill in the black areas
- ALL edges must be filled with organic, seamless background - NO black pixels left.

ABSOLUTE RULES:
1. PRESERVE THE COMPLETE LOGO: Every part of the logo must remain unchanged. Do NOT crop, cut, or hide any portion, that is visible in the original.

2. ZERO BLACK/EMPTY AREAS: Fill every pixel with appropriate content - no black borders, no empty spaces
3. SEAMLESS EXTENSION: Extend the background naturally in all directions to fill the ${aspectRatio} frame
4. ORGANIC RESULT: The final image must look like a natural, complete photograph / Graphic - not a composited image

LOGO HANDLING:
- Keep the logo at its EXACT current size and position
- Do NOT resize, rotate, or move or change the logo
- You MAY enhance quality (sharpen, improve resolution) but NOT alter composition. The main logo must stay the same in relation to the rest of the image. Only fill in the black areas.

BACKGROUND FILL:
- Analyze the existing background texture, color, and lighting
- Extend it seamlessly to fill all empty areas
- Ensure smooth, invisible transitions between original and generated content
- Create a cohesive, professional result, that looks natural and unedited.

OUTPUT: A complete ${aspectRatio} image where the logo remains unchanged and all surrounding areas are filled with seamlessly blended background.`;

    // Map resolution to imageSize
    const getImageSize = (res: number): string => {
        if (res >= 4096) return '4K';
        if (res >= 2048) return '2K';
        return '1K';
    };

    try {
        console.log('[Nanobanana] 📡 Sending request to Gemini API...');
        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview', 
            contents: {
                parts: [
                    { text: prompt },
                    { 
                        inlineData: {
                            mimeType: 'image/png',
                            data: imageBase64
                        }
                    }
                ]
            },
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: getImageSize(resolution),
                } as any, // imageSize is valid for gemini-3-pro-image-preview but not in TS types yet
            }
        });

        console.log('[Nanobanana] 📥 Response received from Gemini API');
        const candidate = response.candidates?.[0];
        console.log('[Nanobanana] 📊 Candidates count:', response.candidates?.length || 0);
        if (!candidate) throw new Error("No candidates returned from AI.");

        console.log('[Nanobanana] 📊 Parts count:', candidate.content.parts.length);
        for (const part of candidate.content.parts) {
            console.log('[Nanobanana] 📊 Part type:', part.text ? 'text' : part.inlineData ? 'inlineData' : 'unknown');
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                console.log('[Nanobanana] ✅ Image received! Base64 length:', base64ImageBytes.length);
                const resultUrl = `data:image/png;base64,${base64ImageBytes}`;
                console.log('[Nanobanana] ✅ Returning data URL, length:', resultUrl.length);
                return resultUrl;
            }
        }
        
        console.error('[Nanobanana] ❌ No image in response parts');
        throw new Error("AI did not return an image in the response.");

    } catch (error) {
        console.error("Nanobanana (Edge Fill) processing failed:", error);
        throw error;
    }
};
