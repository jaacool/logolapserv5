
import React, { useCallback, useState } from 'react';
import { UploadIcon } from './Icons';

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({ onDrop }) => {
  const [isDragActive, setIsDragActive] = useState(false);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onDrop(Array.from(e.dataTransfer.files));
    }
  }, [onDrop]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onDrop(Array.from(e.target.files));
    }
  };

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300 ease-in-out
        ${isDragActive ? 'border-cyan-400 bg-gray-800' : 'border-gray-600 hover:border-cyan-500 hover:bg-gray-800/50'}`}
    >
      <input
        type="file"
        multiple
        accept="image/png, image/jpeg"
        onChange={handleFileChange}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center w-full h-full cursor-pointer">
        <UploadIcon className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-300">Drag & Drop Your Images Here</h2>
        <p className="text-gray-500">or click to browse</p>
        <p className="text-sm text-gray-600 mt-2">Supports: PNG, JPG</p>
      </label>
    </div>
  );
};
