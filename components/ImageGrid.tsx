import React from 'react';
import type { UploadedFile } from '../types';
import { SimpleMatchIcon, XIcon } from './Icons';

interface ImageGridProps {
  files: UploadedFile[];
  masterFileId: string | null;
  onSelectMaster: (id: string) => void;
  onToggleSimpleMatch: (id: string) => void;
  onDelete: (id: string) => void;
  onAutoSelectMaster?: () => void;
  isAutoSelecting?: boolean;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ files, masterFileId, onSelectMaster, onToggleSimpleMatch, onDelete, onAutoSelectMaster, isAutoSelecting }) => {
  
  const handleSimpleMatchClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent master selection when clicking the icon
    onToggleSimpleMatch(id);
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
  }
  
  return (
    <div className="w-full">
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-lg text-gray-300">
            <span className="font-bold text-cyan-400">1.</span> Select a master
          </p>
          {onAutoSelectMaster && files.length > 1 && (
            <button
              onClick={onAutoSelectMaster}
              disabled={isAutoSelecting}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl disabled:cursor-not-allowed"
              title="Automatically select the best master based on centering and similarity"
            >
              {isAutoSelecting ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span>Auto Master</span>
                </>
              )}
            </button>
          )}
        </div>
        <p className="text-sm text-gray-400 flex items-center gap-2">
          <span className="font-bold text-cyan-400">2.</span> 
          If the picture is taken frontal (without perspective shift) please click on the 
          <span className="inline-flex items-center justify-center w-6 h-6 bg-black/50 rounded-full border border-gray-600"><SimpleMatchIcon className="w-4 h-4 text-gray-300"/></span>
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {files.map((file) => {
          const isMaster = file.id === masterFileId;
          const needsSimpleMatch = file.needsSimpleMatch;

          return (
            <div
              key={file.id}
              onClick={() => onSelectMaster(file.id)}
              className={`relative rounded-lg overflow-hidden cursor-pointer group transition-all duration-200 transform hover:scale-105 aspect-square
                ${isMaster ? 'ring-4 ring-cyan-400 shadow-2xl shadow-cyan-500/30' : 'ring-2 ring-gray-700 hover:ring-cyan-500'}
                ${needsSimpleMatch && !isMaster ? 'ring-offset-2 ring-offset-gray-900 ring-2 ring-green-500' : ''}`}
            >
              <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-contain bg-gray-800" />
              
              <button
                onClick={(e) => handleDeleteClick(e, file.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200 z-10"
                title="Delete Image"
              >
                  <XIcon className="w-4 h-4" />
              </button>

              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <p className="text-white text-xs text-center p-1 truncate">{file.file.name}</p>
              </div>

              {isMaster && (
                <>
                  <div className="absolute inset-0 bg-cyan-500 bg-opacity-30"></div>
                   <div className="absolute bottom-0 left-0 right-0 bg-cyan-400 text-gray-900 text-center text-xs font-bold py-0.5">
                    MASTER
                  </div>
                </>
              )}

              {!isMaster && (
                <button
                  onClick={(e) => handleSimpleMatchClick(e, file.id)}
                  className={`absolute bottom-1 right-1 p-1.5 rounded-full transition-colors duration-200
                    ${needsSimpleMatch ? 'bg-green-500 text-white' : 'bg-black/50 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  title={needsSimpleMatch ? "Simple Match Active (Click for Perspective)" : "Perspective Active (Click for Simple Match)"}
                >
                  <SimpleMatchIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};