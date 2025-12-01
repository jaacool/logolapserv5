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
    const prompt = `TASK: Seamlessly fill the black/empty border areas around the edges of this image.

CRITICAL RULES:
1. Do NOT resize, rotate, reposition, or structurally modify the central logo/object
2. The logo must stay the EXACT same size and position
3. You MAY enhance quality (sharpen, improve resolution, remove watermarks) but NOT change composition
4. Fill borders by SEAMLESSLY extending the background - NO visible edges or seams between original and filled areas
5. The transition from original content to filled areas must be completely smooth and invisible
6. Match the lighting, texture, color, and style of the existing background perfectly
7. The final image must look like ONE cohesive image - no "picture in picture" effect

OUTPUT: A clean, seamless image where the filled borders are indistinguishable from the original background.`;

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
