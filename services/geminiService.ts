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
        model: 'gemini-3-pro-image-preview',
        contents: contents,
        config: {
            // @ts-ignore - ImageConfig is available in newer SDK versions but might strict check here
            imageConfig: {
                aspectRatio: "9:16", // Default to vertical as per App.tsx default, or could pass it in. 
                                     // For now hardcoding to match typical use or omitting to let model decide.
                                     // Actually, let's omit specific aspect ratio here to let it follow the input image context 
                                     // or add it if strictly needed. Let's start with just the correct model name and minimal config.
            }
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