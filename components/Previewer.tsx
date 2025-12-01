import React, { useState, useEffect, useCallback } from 'react';
import type { ProcessedFile, UploadedFile, AspectRatio } from '../types';
import { ChevronLeftIcon, ChevronRightIcon, GridIcon, SingleViewIcon, PlayIcon, PauseIcon, XIcon, PerspectiveIcon, SimpleMatchIcon, DownloadIcon, RefreshIcon } from './Icons';
import { DebugToggle } from './DebugToggle';
import { Spinner } from './Spinner';

interface PreviewerProps {
  files: ProcessedFile[];
  originalFiles: UploadedFile[];
  masterFileId: string | null;
  isDebugMode: boolean;
  onSetDebugMode: (value: boolean) => void;
  onBackToSelection: () => void;
  aspectRatio: AspectRatio;
  onDelete: (id: string) => void;
  onPerspectiveFix: (id: string) => void;
  onSimpleMatchFix: (id: string) => void;
  fixingImageId: string | null;
  onExport: () => void;
  isExporting: boolean;
  isProcessing?: boolean;
  processingStatus?: string;
  processingProgress?: number;
  onRetryEdgeFill?: (id: string) => void;
  retryingEdgeFillIds?: Set<string>;
  edgeFillCreditCost?: number;
}

export const Previewer: React.FC<PreviewerProps> = ({ 
    files, 
    originalFiles,
    masterFileId,
    isDebugMode, 
    onSetDebugMode,
    onBackToSelection,
    aspectRatio,
    onDelete,
    onPerspectiveFix,
    onSimpleMatchFix,
    fixingImageId,
    onExport,
    isExporting,
    isProcessing,
    processingStatus,
    processingProgress,
    onRetryEdgeFill,
    retryingEdgeFillIds = new Set(),
    edgeFillCreditCost = 6
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('single');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    if (files.length > 0) {
        const masterIndex = files.findIndex(f => f.id === masterFileId);
        const newIndex = masterIndex !== -1 ? masterIndex : 0;
        // Ensure newIndex is within bounds
        setCurrentIndex(Math.min(newIndex, files.length - 1));
    }
  }, [files, masterFileId]);

  useEffect(() => {
    if (!isPlaying || files.length === 0) {
      return;
    }

    const intervalId = setInterval(() => {
      setCurrentIndex(prevIndex => (prevIndex + 1) % files.length);
    }, 1000 / 8); // 8 fps

    return () => clearInterval(intervalId);
  }, [isPlaying, files.length]);

  const handleNext = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % files.length);
  }, [files.length]);

  const handlePrev = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex((prevIndex) => (prevIndex - 1 + files.length) % files.length);
  }, [files.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewMode === 'single' && !isPlaying && files.length > 1) {
        if (e.key === 'ArrowRight') {
          handleNext();
        } else if (e.key === 'ArrowLeft') {
          handlePrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMode, isPlaying, files.length, handleNext, handlePrev]);


  const handleViewModeChange = (mode: 'grid' | 'single') => {
    setIsPlaying(false);
    setViewMode(mode);
  };

  const handlePlayToggle = () => {
    if (!isPlaying) {
      setViewMode('single');
    }
    setIsPlaying(prev => !prev);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onDelete(id);
  }
  
  if (files.length === 0) {
    return null;
  }
  
  const currentFile = files[currentIndex];
  if (!currentFile) return null;

  const originalUploadedFile = originalFiles.find(f => f && f.id === currentFile.id);
  const isCurrentFileMaster = currentFile.id === masterFileId;

  // For user-uploaded files, the original is their preview.
  // For AI variations, their "original" is the unaligned version stored in debugUrl.
  const originalPreviewUrl = originalUploadedFile 
    ? originalUploadedFile.previewUrl 
    : (currentFile.id.startsWith('ai-var-') ? currentFile.debugUrl : null);
  
  const originalPreviewName = originalUploadedFile ? originalUploadedFile.file.name : currentFile.originalName;

  const getAspectRatioStyle = (ratio: AspectRatio): React.CSSProperties => {
    switch (ratio) {
      case '9:16':
        return { aspectRatio: '9 / 16' };
      case '1:1':
        return { aspectRatio: '1 / 1' };
      case '16:9':
        return { aspectRatio: '16 / 9' };
      default:
        return { aspectRatio: '9 / 16' };
    }
  };


  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
      <div className="w-full flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 p-2 bg-gray-800/50 rounded-lg relative overflow-hidden">
        {isProcessing && (
             <div className="absolute bottom-0 left-0 h-1 bg-cyan-500 transition-all duration-300 ease-out z-10" style={{ width: `${processingProgress || 0}%` }}></div>
        )}
        <div className="flex items-center gap-4 flex-wrap z-20">
            <div className="text-left">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    {isProcessing ? (
                        <>
                           <Spinner className="w-5 h-5" />
                           <span className="text-cyan-300 animate-pulse">Generating Variations...</span>
                        </>
                    ) : (
                        "Processing Complete"
                    )}
                </h2>
                <p className="text-sm text-gray-400">
                    {isProcessing ? (processingStatus || "Please wait...") : "Review the final aligned results below."}
                </p>
            </div>
             <button 
                onClick={onBackToSelection}
                disabled={isProcessing}
                className="px-3 py-2 text-sm font-semibold text-white bg-gray-600 rounded-md hover:bg-gray-500 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Go back to change master or other settings"
            >
                <ChevronLeftIcon className="w-5 h-5" />
                <span>Change Selection</span>
            </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
            <button
                onClick={onExport}
                disabled={isExporting}
                className="px-3 py-2 text-sm font-semibold text-white bg-cyan-600 rounded-md hover:bg-cyan-500 transition-colors flex items-center gap-2 disabled:bg-gray-500 disabled:cursor-wait"
                title="Download all processed images as a ZIP file"
            >
                {isExporting ? (
                    <>
                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Exporting...</span>
                    </>
                ) : (
                    <>
                        <DownloadIcon className="w-5 h-5" />
                        <span>Download ZIP</span>
                    </>
                )}
            </button>
            <div className="flex items-center bg-gray-700 rounded-md p-1">
              <button onClick={() => handleViewModeChange('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`} aria-label="Grid View">
                  <GridIcon className="w-5 h-5" />
              </button>
              <button onClick={() => handleViewModeChange('single')} className={`p-1.5 rounded ${viewMode === 'single' && !isPlaying ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`} aria-label="Single View">
                  <SingleViewIcon className="w-5 h-5" />
              </button>
              <button onClick={handlePlayToggle} className={`p-1.5 rounded ${isPlaying ? 'bg-cyan-500 text-white' : 'text-gray-400 hover:bg-gray-600'}`} aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
              </button>
            </div>
            {/* <DebugToggle isChecked={isDebugMode} onChange={onSetDebugMode} /> */}
        </div>
      </div>

       {viewMode === 'single' && currentFile && (
        <div className="w-full flex flex-col items-center mb-4">
            <div className="relative w-full max-w-2xl group">
                 <div className="grid grid-cols-2 gap-4">
                    {/* Original Image */}
                    <div className="flex flex-col items-center">
                        <h3 className="text-lg font-semibold text-gray-400 mb-2">Original</h3>
                        <div 
                            className="w-full bg-gray-900 rounded-lg overflow-hidden"
                            style={getAspectRatioStyle(aspectRatio)}
                        >
                            {originalPreviewUrl ? (
                                <img 
                                    src={originalPreviewUrl} 
                                    alt={`Original - ${originalPreviewName}`}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-500 p-4 text-center">
                                    <span>Original preview not available.</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Processed Image */}
                    <div className="flex flex-col items-center">
                         <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-semibold text-cyan-400">Processed</h3>
                         </div>
                        <div 
                            className="relative w-full bg-gray-900 rounded-lg overflow-hidden"
                            style={getAspectRatioStyle(aspectRatio)}
                        >
                             {fixingImageId === currentFile.id && (
                                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
                                    <Spinner />
                                </div>
                            )}
                            <img 
                                src={(isDebugMode ? currentFile.debugUrl : currentFile.processedUrl) || currentFile.processedUrl} 
                                alt={currentFile.originalName} 
                                className="w-full h-full object-contain"
                            />
                        </div>
                    </div>
                </div>
                {!isPlaying && (
                  <>
                    <button onClick={handlePrev} className="absolute -left-12 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full opacity-20 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-20" aria-label="Previous image">
                        <ChevronLeftIcon className="w-6 h-6" />
                    </button>
                    <button onClick={handleNext} className="absolute -right-12 top-1/2 -translate-y-1/2 bg-black/40 text-white p-2 rounded-full opacity-20 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-20" aria-label="Next image">
                        <ChevronRightIcon className="w-6 h-6" />
                    </button>
                  </>
                )}
            </div>
            <div className="text-center mt-3 p-2 rounded-md bg-gray-800 w-full max-w-2xl">
                <p className="text-sm text-gray-300 truncate font-mono" title={currentFile.originalName}>
                    {`[${currentIndex + 1}/${files.length}] `}{currentFile.originalName}
                </p>
                 {isCurrentFileMaster && (
                     <p className="text-xs font-bold text-cyan-400 mt-1">MASTER IMAGE</p>
                 )}
            </div>
        </div>
      )}

      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 w-full">
            {files.map((file) => {
            if (!file) return null;
            const isMaster = file.id === masterFileId;
            const imageUrl = (isDebugMode ? file.debugUrl : file.processedUrl) || file.processedUrl;
            
            return (
                <div
                key={file.id}
                style={getAspectRatioStyle(aspectRatio)}
                className={`relative rounded-lg overflow-hidden group transition-all duration-200 transform hover:scale-105
                    ${isMaster 
                        ? 'ring-4 ring-cyan-400 shadow-2xl shadow-cyan-500/30' 
                        : 'ring-2 ring-gray-700'}
                `}
                >
                {fixingImageId === file.id && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20">
                        <Spinner />
                    </div>
                )}
                <button
                    onClick={(e) => handleDeleteClick(e, file.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-600 transition-all duration-200 z-10"
                    title="Delete Image"
                >
                    <XIcon className="w-4 h-4" />
                </button>
                {!isMaster && (
                    <>
                        <button
                            onClick={() => onPerspectiveFix(file.id)}
                            disabled={!!fixingImageId}
                            className="absolute bottom-1 left-1 p-1.5 rounded-full bg-black/50 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-blue-600 hover:text-white transition-all duration-200 z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Re-run with Perspective Fix"
                        >
                            <PerspectiveIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => onSimpleMatchFix(file.id)}
                            disabled={!!fixingImageId}
                            className="absolute bottom-1 left-12 p-1.5 rounded-full bg-black/50 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-green-600 hover:text-white transition-all duration-200 z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Re-run with Simple Match (Rotation/Scale Only)"
                        >
                            <SimpleMatchIcon className="w-5 h-5" />
                        </button>
                    </>
                )}
                {onRetryEdgeFill && (
                    <button
                        onClick={() => onRetryEdgeFill(file.id)}
                        disabled={!!fixingImageId || retryingEdgeFillIds.has(file.id)}
                        className={`absolute bottom-1 right-1 p-1.5 rounded-full bg-black/50 text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-purple-600 hover:text-white transition-all duration-200 z-10 disabled:opacity-50 disabled:cursor-not-allowed ${retryingEdgeFillIds.has(file.id) ? 'opacity-100 bg-purple-600 animate-pulse' : ''}`}
                        title={`Retry AI Edge Fill (⚡${edgeFillCreditCost} credits)`}
                    >
                        {retryingEdgeFillIds.has(file.id) ? (
                            <Spinner className="w-5 h-5" />
                        ) : (
                            <RefreshIcon className="w-5 h-5" />
                        )}
                    </button>
                )}
                <img src={imageUrl} alt={file.originalName} className="w-full h-full object-contain bg-gray-800" />
                
                {isMaster && (
                    <>
                        <div className="absolute inset-0 bg-cyan-500/30"></div>
                        <div className="absolute bottom-0 left-0 right-0 bg-cyan-400 text-gray-900 text-center text-xs font-bold py-0.5">
                        MASTER
                        </div>
                    </>
                )}

                <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs text-center truncate">{file.originalName}</p>
                </div>
                </div>
            );
            })}
        </div>
      )}
    </div>
  );
};