import { GoogleGenAI } from "@google/genai";
import type { ProcessedFile } from '../types';
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

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string,
    contextImageUrl?: string
): Promise<string> => {
    const apiKey = getApiKey();
    const ai = new GoogleGenAI({ apiKey });

    // Resize images to avoid payload limits (max 1024px)
    const resizedImages = await Promise.all(
        referenceImages.map(async (img) => ({
            ...img,
            processedUrl: await resizeImage(img.processedUrl, 1024, 1024)
        }))
    );

    const imageParts = resizedImages.map(image => ({
        inlineData: {
            mimeType: 'image/png',
            data: dataUrlToBase64(image.processedUrl),
        },
    }));

    if (contextImageUrl) {
        const resizedContext = await resizeImage(contextImageUrl, 1024, 1024);
        imageParts.push({
            inlineData: {
                mimeType: 'image/png',
                data: dataUrlToBase64(resizedContext),
            }
        });
    }

    const textPart = {
        text: prompt,
    };

    const contents = { parts: [textPart, ...imageParts] };

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-exp-image-generation',
            contents: contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
            }
        });

        // Extract the image data
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                const base64ImageBytes: string = part.inlineData.data;
                return `data:image/png;base64,${base64ImageBytes}`;
            }
        }
        
        throw new Error("AI did not return an image.");
    } catch (error) {
        console.error("AI Variation generation failed:", error);
        throw error;
    }
};