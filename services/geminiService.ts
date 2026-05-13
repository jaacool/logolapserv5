import type { ProcessedFile } from '../types';
import { resizeImage } from '../utils/fileUtils';
import { supabase } from './supabaseClient';
import { auth as firebaseAuth } from '../config/firebase';

// Helper to convert data URL to base64
const dataUrlToBase64 = (dataUrl: string): string => dataUrl.split(',')[1];

export const generateVariation = async (
    referenceImages: ProcessedFile[], 
    prompt: string,
    contextImageUrl?: string
): Promise<string> => {
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
        
        // Get the current user's token from Firebase to authenticate the proxy request
        if (!firebaseAuth?.currentUser) {
            throw new Error('Login required to use AI Variation');
        }
        const token = await firebaseAuth.currentUser.getIdToken();
        const headers = { 'x-firebase-auth': token };
        
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            headers,
            body: {
                action: 'generate-variation',
                imageBase64: mainImageBase64,
                prompt: prompt,
                additionalImages: additionalImages.length > 0 ? additionalImages : undefined,
                contextImageBase64: contextImageBase64
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