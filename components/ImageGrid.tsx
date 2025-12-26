import React from 'react';
import type { UploadedFile } from '../types';
import { SimpleMatchIcon, XIcon, InvertIcon } from './Icons';

interface ImageGridProps {
  files: UploadedFile[];
  masterFileId: string | null;
  onSelectMaster: (id: string) => void;
  onToggleSimpleMatch: (id: string) => void;
  onToggleLuminanceInversion: (id: string) => void;
  onDelete: (id: string) => void;
}

export const ImageGrid: React.FC<ImageGridProps> = ({ files, masterFileId, onSelectMaster, onToggleSimpleMatch, onToggleLuminanceInversion, onDelete }) => {
  
  const handleSimpleMatchClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent master selection when clicking the icon
    onToggleSimpleMatch(id);
  }

  const handleInversionClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent master selection when clicking the icon
    onToggleLuminanceInversion(id);
  }

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
  }
  
  return (
    <div className="w-full px-2 sm:px-4">
      <div className="mb-6 space-y-2">
        <p className="text-sm sm:text-base lg:text-lg text-gray-300 flex flex-wrap items-center gap-1 sm:gap-2">
          <span className="font-bold text-cyan-400">1.</span> 
          <span>Click on a picture to select it as</span>
          <span className="px-1.5 border-2 border-cyan-400 text-cyan-400 rounded font-bold text-xs sm:text-sm lg:text-base">MASTER</span>
        </p>
        <p className="text-sm sm:text-base lg:text-lg text-gray-300 flex flex-wrap items-center gap-1 sm:gap-2">
          <span className="font-bold text-cyan-400">2.</span> 
          <span>If the logo is inverted (compared to master) click on</span>
          <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-purple-500/90 rounded-full"><InvertIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white"/></span>
        </p>
        <p className="text-sm sm:text-base lg:text-lg text-gray-300 flex flex-wrap items-center gap-1 sm:gap-2">
          <span className="font-bold text-cyan-400">3.</span> 
          <span>If no perspective correction is needed click on</span>
          <span className="inline-flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 bg-black/50 rounded-full border border-gray-600"><SimpleMatchIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-300"/></span>
          <span>to avoid false alignment</span>
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {files.map((file) => {
          const isMaster = file.id === masterFileId;
          const needsSimpleMatch = file.needsSimpleMatch;
          const isInverted = file.isLuminanceInverted;

          return (
            <div
              key={file.id}
              onClick={() => onSelectMaster(file.id)}
              className={`relative rounded-lg overflow-hidden cursor-pointer group transition-all duration-200 transform hover:scale-105 aspect-square
                ${isMaster ? 'ring-4 ring-cyan-400 shadow-2xl shadow-cyan-500/30' : 'ring-2 ring-gray-700 hover:ring-cyan-500'}
                ${needsSimpleMatch && !isMaster ? 'ring-offset-2 ring-offset-gray-900 ring-2 ring-green-500' : ''}`}
            >
              <img src={file.previewUrl} alt={file.file.name} className="w-full h-full object-contain bg-gray-800" />
              
              {/* Delete button - ABOVE overlay */}
              <button
                onClick={(e) => handleDeleteClick(e, file.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200 z-20"
                title="Delete Image"
              >
                  <XIcon className="w-4 h-4" />
              </button>

              {/* Hover overlay for filename/action - BELOW buttons */}
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-0">
                <p className="text-white text-sm font-bold text-center p-1 truncate">
                  {!masterFileId ? "Select as Master" : file.file.name}
                </p>
              </div>

              {isMaster && (
                <>
                  <div className="absolute inset-0 bg-cyan-500 bg-opacity-30"></div>
                   <div className="absolute bottom-0 left-0 right-0 bg-cyan-400 text-gray-900 text-center text-xs font-bold py-0.5">
                    MASTER
                  </div>
                </>
              )}

              {/* Action Buttons - Bottom Right */}
              {!isMaster && (
                <div className="absolute bottom-1 right-1 flex gap-1 z-20">
                  {/* Invert Button - Always visible */}
                  <button
                    onClick={(e) => handleInversionClick(e, file.id)}
                    className={`p-1.5 rounded-full transition-colors duration-200
                      ${isInverted ? 'bg-purple-500/90 text-white' : 'bg-black/50 text-gray-300 hover:bg-purple-500/70 hover:text-white'}`}
                    title={isInverted ? "Inverted (Click to disable)" : "Normal (Click to invert)"}
                  >
                    <InvertIcon className="w-4 h-4" />
                  </button>

                  {/* Simple Match button */}
                  <button
                    onClick={(e) => handleSimpleMatchClick(e, file.id)}
                    className={`p-1.5 rounded-full transition-colors duration-200
                      ${needsSimpleMatch ? 'bg-green-500 text-white' : 'bg-black/50 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                    title={needsSimpleMatch ? "Simple Match Active (Click for Perspective)" : "Perspective Active (Click for Simple Match)"}
                  >
                    <SimpleMatchIcon className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};