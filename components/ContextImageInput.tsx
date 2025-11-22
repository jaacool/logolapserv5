import React, { useCallback } from 'react';
import { fileToImageElement } from '../utils/fileUtils';

interface ContextImageInputProps {
  selectedImage: File | null;
  onImageSelect: (file: File | null) => void;
  isDisabled?: boolean;
}

export const ContextImageInput: React.FC<ContextImageInputProps> = ({ selectedImage, onImageSelect, isDisabled = false }) => {
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (selectedImage) {
      const url = URL.createObjectURL(selectedImage);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
        onImageSelect(file);
      }
    }
  };

  const handleRemove = () => {
    onImageSelect(null);
  };

  return (
    <div className="w-full p-4 bg-gray-800/50 rounded-lg border border-gray-700 mt-4">
        <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">
                Context Reference Image (Optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
                Upload an image to guide the style, location, or vibe of the generated background.
            </p>
            
            {!selectedImage ? (
                 <label className={`flex flex-col items-center justify-center w-full h-32 border-2 border-gray-600 border-dashed rounded-lg cursor-pointer bg-gray-700/30 hover:bg-gray-700/50 transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <svg className="w-8 h-8 mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                        <p className="text-xs text-gray-400"><span className="font-semibold">Click to upload</span> style reference</p>
                    </div>
                    <input 
                        type="file" 
                        className="hidden" 
                        accept="image/png, image/jpeg, image/webp"
                        onChange={handleFileChange}
                        disabled={isDisabled}
                    />
                </label>
            ) : (
                <div className="relative w-full h-32 bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center border border-gray-600">
                     {previewUrl && (
                         <img src={previewUrl} alt="Context Reference" className="h-full object-contain" />
                     )}
                     <button
                        onClick={handleRemove}
                        disabled={isDisabled}
                        className="absolute top-2 right-2 bg-black/60 text-white p-1 rounded-full hover:bg-red-600 transition-colors"
                        title="Remove context image"
                     >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                     </button>
                     <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-1">
                        <p className="text-xs text-white truncate text-center">{selectedImage.name}</p>
                     </div>
                </div>
            )}
        </div>
    </div>
  );
};
