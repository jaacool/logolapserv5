import { GoogleGenAI } from "@google/genai";
import { resizeImage } from '../utils/fileUtils';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const processWithNanobanana = async (
    imageUrl: string, 
    apiKey: string,
    resolution: number = 1024
): Promise<string> => {
    
    if (!apiKey) {
        throw new Error("API Key is required for AI Edge Fill.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Resize to specified resolution
    const resizedImageUrl = await resizeImage(imageUrl, resolution, resolution);
    const imageBase64 = dataUrlToBase64(resizedImageUrl);

    // Prompt designed to encourage outpainting/filling of black borders
    const prompt = "Refill any cropped out or cut off areas, especially black areas. Seamlessly extend the background texture and lighting into these black regions to complete the scene. Maintain the original central content exactly as is. Do not distort the logo or central object.";

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
        console.error("Nanobanana (Google AI) processing failed:", error);
        throw error;
    }
};
