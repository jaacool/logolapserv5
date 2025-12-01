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

    // Prompt designed to encourage outpainting/filling of black borders
    const prompt = "Refill any cropped out or cut off areas, especially black areas. Seamlessly extend the background texture and lighting into these black regions to complete the scene. Maintain the original central content exactly as is. Do not distort the logo or central object.";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-05-20', 
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
