import { resizeImage } from '../utils/fileUtils';
import { supabase } from './supabaseClient';
import { getCurrentUser } from './authService';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const processWithNanobanana = async (
    imageUrl: string, 
    resolution: number = 1024,
    aspectRatio: '9:16' | '1:1' | '16:9' = '9:16'
): Promise<string> => {
    const user = getCurrentUser();
    if (!user) {
        throw new Error("Authentication required to use AI features.");
    }

    const token = await user.getIdToken();
    console.log('[Nanobanana] 🚀 Starting processWithNanobanana via proxy');
    
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
    const resizedImageUrl = await resizeImage(imageUrl, width, height);
    const imageBase64 = dataUrlToBase64(resizedImageUrl);

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

    try {
        console.log('[Nanobanana] 📡 Sending request to Supabase proxy...');
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: {
                action: 'edge-fill',
                imageBase64: imageBase64,
                prompt: prompt,
                resolution: resolution,
                aspectRatio: aspectRatio
            },
            headers: {
                'X-Firebase-Auth': token
            }
        });

        if (error) throw error;
        if (!data || !data.imageBase64) throw new Error("No image data in proxy response");

        console.log('[Nanobanana] ✅ Image received from proxy!');
        return `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`;

    } catch (error) {
        console.error("Nanobanana (Edge Fill) processing failed:", error);
        throw error;
    }
};
