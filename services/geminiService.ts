import type { ProcessedFile } from '../types';
import { resizeImage } from '../utils/fileUtils';
import { supabase } from './supabaseClient';
import { getCurrentUser } from './authService';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string,
    contextImageUrl?: string
): Promise<string> => {
    const user = getCurrentUser();
    if (!user) {
        throw new Error("Authentication required to use AI features.");
    }

    const token = await user.getIdToken();

    // Resize images to avoid payload limits (max 1024px)
    const resizedImages = await Promise.all(
        referenceImages.map(async (img) => ({
            ...img,
            processedUrl: await resizeImage(img.processedUrl, 1024, 1024)
        }))
    );

    const additionalImages = await Promise.all(resizedImages.slice(1).map(async image => ({
        base64: dataUrlToBase64(image.processedUrl),
        mimeType: 'image/png'
    })));

    const mainImageBase64 = dataUrlToBase64(resizedImages[0].processedUrl);

    let contextImageBase64: string | undefined;
    if (contextImageUrl) {
        const resizedContext = await resizeImage(contextImageUrl, 1024, 1024);
        contextImageBase64 = dataUrlToBase64(resizedContext);
    }

    try {
        console.log('[Gemini] 📡 Sending request to proxy...');
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: {
                action: 'generate-variation',
                imageBase64: mainImageBase64,
                prompt: prompt,
                additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
                contextImageBase64: contextImageBase64
            },
            headers: {
                'X-Firebase-Auth': token
            }
        });

        if (error) throw error;
        if (!data || !data.imageBase64) throw new Error("No image data in proxy response");

        return `data:${data.mimeType || 'image/png'};base64,${data.imageBase64}`;
    } catch (error) {
        console.error("AI Variation generation failed:", error);
        throw error;
    }
};