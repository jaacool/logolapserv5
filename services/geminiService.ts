import { GoogleGenAI, Modality } from "@google/genai";
import type { ProcessedFile } from '../types';
import { resizeImage } from '../utils/fileUtils';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string,
    apiKey: string
): Promise<string> => {
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

    const textPart = {
        text: prompt,
    };

    const contents = { parts: [textPart, ...imageParts] };

    const response = await ai.models.generateContent({
        model: 'gemini-3.0-pro-image-preview',
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