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
    resolution: number = 1024
): Promise<string> => {
    
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Resize to specified resolution
    const resizedImageUrl = await resizeImage(imageUrl, resolution, resolution);
    const imageBase64 = dataUrlToBase64(resizedImageUrl);

    // Prompt designed for seamless edge fill while preserving logo structure
    const prompt = `TASK: Fill ALL black/empty/cropped border areas around the edges of this image with seamless background extension.

ABSOLUTE REQUIREMENTS - NO EXCEPTIONS:
1. ZERO BLACK EDGES: There must be NO black pixels, NO dark borders, NO empty areas remaining in the final image
2. COMPLETE FILL: Every single edge and corner must be filled with appropriate background content
3. NO CROPPING: Do not crop or cut off ANY part of the image - only ADD content to fill empty areas

LOGO PRESERVATION:
4. Do NOT resize, rotate, reposition, or structurally modify the central logo/object
5. The logo must stay the EXACT same size and position
6. You MAY enhance quality (sharpen, improve resolution, remove watermarks) but NOT change composition

SEAMLESS BLENDING:
7. Fill borders by SEAMLESSLY extending the background - NO visible edges or seams
8. The transition from original content to filled areas must be completely smooth and invisible
9. Match the lighting, texture, color, and style of the existing background perfectly
10. The final image must look like ONE cohesive image - no "picture in picture" effect

OUTPUT: A complete image with NO black edges, where all borders are filled with seamlessly blended background content.`;

    try {
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
            }
        });

        const candidate = response.candidates?.[0];
        if (!candidate) throw new Error("No candidates returned from AI.");

        for (const part of candidate.content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error("AI did not return an image in the response.");

    } catch (error) {
        console.error("Nanobanana (Edge Fill) processing failed:", error);
        throw error;
    }
};
