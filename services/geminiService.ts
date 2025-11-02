import { GoogleGenAI, Modality } from "@google/genai";
import type { ProcessedFile } from '../types';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string,
    apiKey: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey });

    const imageParts = referenceImages.map(image => ({
        inlineData: {
            mimeType: 'image/png',
            data: dataUrlToBase64(image.processedUrl),
        },
    }));

    const textPart = {
        text: prompt,
    };

    const contents = { parts: [textPart, ...imageParts] };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
            responseModalities: [Modality.IMAGE],
        },
    });

    // Extract the image data
    for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            // Return as a data URL to be consistent
            return `data:image/png;base64,${base64ImageBytes}`;
        }
    }
    
    throw new Error("AI did not return an image.");
};