import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileDropzone } from './components/FileDropzone';
import { ImageGrid } from './components/ImageGrid';
import { Previewer } from './components/Previewer';
import { processImageLocally, refineWithGoldenTemplate } from './services/imageProcessorService';
import { generateVariation } from './services/geminiService';
import { fileToImageElement, dataUrlToImageElement } from './utils/fileUtils';
import type { UploadedFile, ProcessedFile, AspectRatio } from './types';
import { JaaCoolMediaLogo, SquaresExcludeIcon, XIcon } from './components/Icons';
import { Spinner } from './components/Spinner';
import { DebugToggle } from './components/DebugToggle';
import { GreedyModeToggle } from './components/GreedyModeToggle';
import { RefinementToggle } from './components/RefinementToggle';
import { EnsembleCorrectionToggle } from './components/EnsembleCorrectionToggle';
import { PerspectiveCorrectionToggle } from './components/PerspectiveCorrectionToggle';
import { SimpleMatchToggle } from './components/SimpleMatchToggle';
import { AspectRatioSelector } from './components/AspectRatioSelector';
import { AIVariationsToggle } from './components/AIVariationsToggle';
import { VariationSelector } from './components/VariationSelector';
import { PromptCustomizer } from './components/PromptCustomizer';
import { ContextInput } from './components/ContextInput';
import { ContextImageInput } from './components/ContextImageInput';
import { fileToBase64 } from './utils/fileUtils';

declare var JSZip: any;

const AI_PROMPT_BASE = "Generate a hyper-realistic image where the logo is PHYSICALLY EMBEDDED into the surface material. CRITICAL PRIORITY 1: GEOMETRY PRESERVATION. The logo's shape, text, and outlines must be preserved 100% perfectly. Do NOT distort, warp, skew, or melt the logo characters. They must remain sharp, legible, and true to the original geometry. CRITICAL PRIORITY 2: HIGH CONTRAST. Ensure a STRONG brightness contrast between the logo and the background material. If the logo is light, the background must be dark/mid-tone. If the logo is dark, the background must be light. The logo must stand out clearly. MATERIALITY: The logo must inherit the surface texture (grain, weave) and lighting to look embedded, but without losing its shape. PHOTOGRAPHY STYLE: 150mm telephoto lens, super close-up macro. Authentic, raw, with realistic texture details. Avoid extreme angles that would distort the logo readability.";

const DEFAULT_PROMPT_SNIPPETS: string[] = [
    'a storefront',
    'a product',
    'clothing',
    'a digital screen',
    'graffiti on a wall',
    'a hand written post it',
    'a flyer in a hand',
    'a mug print',
    'an embroidered logo on a baseball cap',
    'an embroidered logo on a T-shirt',
    'a trade show display'
];


const getFriendlyErrorMessage = (err: any, context: string) => {
    const rawMessage = err.message || 'An unknown error occurred.';
    if (rawMessage.includes('Not enough good matches')) {
        return `Alignment failed for "${context}". The image may be too blurry, low-contrast, or different from the master. Tip: Try enabling "Greedy Mode" for difficult images.`;
    }
    if (rawMessage.includes('API key expired')) {
        return 'Your API key has expired. Please enter a new, valid key and try again.';
    }
    if (rawMessage.includes('API key not valid') || rawMessage.includes('API_KEY_INVALID')) {
        return 'Your API key is not valid. Please enter a valid key and try again.';
    }
    return `An error occurred with "${context}": ${rawMessage}`;
};

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [masterFileId, setMasterFileId] = useState<string | null>(null);
  const [previousFileStates, setPreviousFileStates] = useState<Map<string, { needsPerspectiveCorrection: boolean; needsSimpleMatch: boolean }>>(new Map());
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [cvReady, setCvReady] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [isGreedyMode, setIsGreedyMode] = useState(false);
  const [isRefinementEnabled, setIsRefinementEnabled] = useState(true);
  const [isEnsembleCorrectionEnabled, setIsEnsembleCorrectionEnabled] = useState(true);
  const [isAiVariationsEnabled, setIsAiVariationsEnabled] = useState(false);
  const [isSimpleMatchEnabled, setIsSimpleMatchEnabled] = useState(false);
  const [numVariations, setNumVariations] = useState<number>(1);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [fixingImageId, setFixingImageId] = useState<string | null>(null);
  const [promptSnippets, setPromptSnippets] = useState<string[]>(DEFAULT_PROMPT_SNIPPETS);
  const [selectedSnippets, setSelectedSnippets] = useState<string[]>(DEFAULT_PROMPT_SNIPPETS);
  const [apiKey, setApiKey] = useState<string>('');
  const [projectContext, setProjectContext] = useState<string>('');
  const [contextImageFile, setContextImageFile] = useState<File | null>(null);
  
  useEffect(() => {
    const checkCv = () => {
      if (window.cv && window.cv.getBuildInformation) {
        console.log("OpenCV is ready.");
        setCvReady(true);
      } else {
        setTimeout(checkCv, 100);
      }
    };
    checkCv();

    const storedApiKey = localStorage.getItem('logoLapserApiKey');
    if (storedApiKey) {
        setApiKey(storedApiKey);
    }

    const storedSnippets = localStorage.getItem('logoLapserPromptSnippets');
    if (storedSnippets) {
        try {
            const parsedSnippets = JSON.parse(storedSnippets);
            if (Array.isArray(parsedSnippets) && parsedSnippets.every(s => typeof s === 'string')) {
                setPromptSnippets(parsedSnippets);
                if (parsedSnippets.length > 0) {
                    setSelectedSnippets(parsedSnippets);
                }
            }
        } catch (e) {
            console.error("Failed to parse stored prompt snippets:", e);
        }
    }
  }, []);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem('logoLapserApiKey', key);
  };

  const handleAddSnippet = (newSnippet: string) => {
    const trimmedSnippet = newSnippet.trim();
    if (trimmedSnippet && !promptSnippets.includes(trimmedSnippet)) {
        const updatedSnippets = [...promptSnippets, trimmedSnippet];
        setPromptSnippets(updatedSnippets);
        setSelectedSnippets(prev => [...prev, trimmedSnippet]);
        localStorage.setItem('logoLapserPromptSnippets', JSON.stringify(updatedSnippets));
    }
  };

  const handleSnippetSelectionChange = (updatedSelection: string[]) => {
      setSelectedSnippets(updatedSelection);
  };

  const handleSelectMaster = useCallback((newMasterId: string) => {
    const newPreviousStates = new Map(previousFileStates);
    
    setUploadedFiles(prevFiles => {
      return prevFiles.map(file => {
        if (file.id === newMasterId) {
          // Neuen Master: Zustand speichern und deaktivieren
          newPreviousStates.set(file.id, {
            needsPerspectiveCorrection: file.needsPerspectiveCorrection || false,
            needsSimpleMatch: file.needsSimpleMatch || false
          });
          return { ...file, needsPerspectiveCorrection: false, needsSimpleMatch: false };
        }
        
        if (file.id === masterFileId) {
          // Alter Master: Vorherigen Zustand wiederherstellen
          const previousState = newPreviousStates.get(file.id);
          if (previousState) {
            return { ...file, ...previousState };
          }
        }
        
        return file;
      });
    });
    
    setPreviousFileStates(newPreviousStates);
    setMasterFileId(newMasterId);
  }, [masterFileId, previousFileStates]);


  const handleFilesDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    const newFiles: UploadedFile[] = await Promise.all(
      acceptedFiles
        .filter(file => ['image/png', 'image/jpeg'].includes(file.type))
        .map(async (file) => {
          const imageElement = await fileToImageElement(file);
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            previewUrl: imageElement.src,
            imageElement: imageElement,
            needsPerspectiveCorrection: true,
            needsSimpleMatch: false,
          };
        })
    );
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const handleTogglePerspective = useCallback((fileId: string) => {
    setUploadedFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { ...file, needsPerspectiveCorrection: !file.needsPerspectiveCorrection, needsSimpleMatch: false } 
          : file
      )
    );
  }, []);

  const handleToggleSimpleMatch = useCallback((fileId: string) => {
    setUploadedFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { ...file, needsSimpleMatch: !file.needsSimpleMatch, needsPerspectiveCorrection: false } 
          : file
      )
    );
  }, []);

  const allNonMasterFilesNeedPerspective = useMemo(() => {
    const nonMasterFiles = uploadedFiles.filter(f => f.id !== masterFileId);
    if (nonMasterFiles.length === 0) {
        return false;
    }
    return nonMasterFiles.every(f => f.needsPerspectiveCorrection);
  }, [uploadedFiles, masterFileId]);

  const allNonMasterFilesNeedSimpleMatch = useMemo(() => {
    const nonMasterFiles = uploadedFiles.filter(f => f.id !== masterFileId);
    if (nonMasterFiles.length === 0) {
        return false;
    }
    return nonMasterFiles.every(f => f.needsSimpleMatch);
  }, [uploadedFiles, masterFileId]);

  const handleToggleAllPerspective = useCallback((newValue: boolean) => {
      setUploadedFiles(prevFiles =>
          prevFiles.map(file =>
              file.id !== masterFileId
                  ? { ...file, needsPerspectiveCorrection: newValue, needsSimpleMatch: false }
                  : file
          )
      );
  }, [masterFileId]);

  const handleToggleAllSimpleMatch = useCallback((newValue: boolean) => {
      setUploadedFiles(prevFiles =>
          prevFiles.map(file =>
              file.id !== masterFileId
                  ? { ...file, needsSimpleMatch: newValue, needsPerspectiveCorrection: false }
                  : file
          )
      );
  }, [masterFileId]);

  const handleBackToSelection = useCallback(() => {
    setProcessedFiles([]);
    setProcessingStatus('');
    setError(null);
  }, []);

  const handleStartAllOver = useCallback(() => {
    setUploadedFiles([]);
    setMasterFileId(null);
    setProcessedFiles([]);
    setProcessingStatus('');
    setError(null);
    setProcessingProgress(0);
    setIsProcessing(false);
    setIsExporting(false);
    setPreviousFileStates(new Map());
  }, []);

  const handleDeleteUploadedFile = useCallback((idToDelete: string) => {
    setUploadedFiles(prev => {
        const fileToDelete = prev.find(f => f.id === idToDelete);
        if (fileToDelete) {
            URL.revokeObjectURL(fileToDelete.previewUrl);
        }
        return prev.filter(f => f.id !== idToDelete);
    });
    if (masterFileId === idToDelete) {
        setMasterFileId(null);
    }
  }, [masterFileId]);

  const handleDeleteProcessedFile = useCallback((idToDelete: string) => {
    const newProcessed = processedFiles.filter(f => f.id !== idToDelete);
    setUploadedFiles(prev => {
        const fileToDelete = prev.find(f => f.id === idToDelete);
        if (fileToDelete && !idToDelete.startsWith('ai-var-')) {
            return prev.filter(f => f.id !== idToDelete);
        }
        return prev;
    });
    setProcessedFiles(newProcessed);
    if (masterFileId === idToDelete) {
        setMasterFileId(null);
    }
    if (newProcessed.length === 0) {
        handleBackToSelection();
    }
  }, [processedFiles, masterFileId, handleBackToSelection]);

    const handleFixPerspective = useCallback(async (fileId: string) => {
        const targetFile = uploadedFiles.find(f => f.id === fileId);
        const alignedMasterResult = processedFiles.find(f => f.id === masterFileId);

        if (!targetFile || !alignedMasterResult) {
            setError(`Could not find necessary files to fix perspective for ${fileId}.`);
            return;
        }

        setFixingImageId(fileId);
        setError(null);

        try {
            const perspectiveMasterElement = await dataUrlToImageElement(alignedMasterResult.processedUrl);
            const { processedUrl, debugUrl } = await processImageLocally(
                perspectiveMasterElement, 
                targetFile.imageElement, 
                isGreedyMode, 
                isRefinementEnabled,
                true, // Force perspective correction
                false, // Simple match disabled for perspective correction
                false, 
                aspectRatio
            );
            setProcessedFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, processedUrl, debugUrl } : f
            ));
        } catch (err) {
            setError(getFriendlyErrorMessage(err, targetFile.file.name));
        } finally {
            setFixingImageId(null);
        }
    }, [masterFileId, uploadedFiles, processedFiles, isGreedyMode, isRefinementEnabled, aspectRatio]);

    const handleSimpleMatchFix = useCallback(async (fileId: string) => {
        const targetFile = uploadedFiles.find(f => f.id === fileId);
        const masterFile = uploadedFiles.find(f => f.id === masterFileId);

        if (!targetFile || !masterFile) {
            setError(`Could not find necessary files to fix simple match for ${fileId}.`);
            return;
        }

        setFixingImageId(fileId);
        setError(null);

        try {
            const { processedUrl, debugUrl } = await processImageLocally(
                masterFile.imageElement, 
                targetFile.imageElement, 
                isGreedyMode, 
                true, // Enable refinement for better results
                false, // No perspective correction
                true, // Force simple match
                false, 
                aspectRatio
            );
            
            // Apply ensemble correction if enabled and we have other processed files
            if (isEnsembleCorrectionEnabled && processedFiles.length > 1) {
                const masterResult = processedFiles.find(f => f.id === masterFileId);
                if (masterResult) {
                    try {
                        const goldenTemplateElement = await dataUrlToImageElement(masterResult.processedUrl);
                        const refinedUrl = await refineWithGoldenTemplate(processedUrl, goldenTemplateElement);
                        setProcessedFiles(prev => prev.map(f => 
                            f.id === fileId ? { ...f, processedUrl: refinedUrl, debugUrl } : f
                        ));
                    } catch (err) {
                        console.error("Error during ensemble refinement for simple match:", err);
                        // Fall back to simple match result without refinement
                        setProcessedFiles(prev => prev.map(f => 
                            f.id === fileId ? { ...f, processedUrl, debugUrl } : f
                        ));
                    }
                } else {
                    // No master result found, use simple match result
                    setProcessedFiles(prev => prev.map(f => 
                        f.id === fileId ? { ...f, processedUrl, debugUrl } : f
                    ));
                }
            } else {
                // No ensemble correction, use simple match result directly
                setProcessedFiles(prev => prev.map(f => 
                    f.id === fileId ? { ...f, processedUrl, debugUrl } : f
                ));
            }
        } catch (err) {
            setError(getFriendlyErrorMessage(err, targetFile.file.name));
        } finally {
            setFixingImageId(null);
        }
    }, [uploadedFiles, masterFileId, isGreedyMode, isRefinementEnabled, isEnsembleCorrectionEnabled, processedFiles, aspectRatio]);

    const handleExport = useCallback(async () => {
        if (processedFiles.length === 0) return;
        setIsExporting(true);
        setError(null);
    
        try {
          const zip = new JSZip();
          
          const sortedFiles = [...processedFiles].sort((a, b) => {
              if (a.id === masterFileId) return -1;
              if (b.id === masterFileId) return 1;
              const aNum = parseInt(a.id.split('-').pop() || '0');
              const bNum = parseInt(b.id.split('-').pop() || '0');
              return a.originalName.localeCompare(b.originalName) || aNum - bNum;
          });
    
          const pad = (num: number, size: number) => ('000' + num).slice(size * -1);
          const numDigits = String(sortedFiles.length).length > 3 ? String(sortedFiles.length).length : 3;
    
          for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            const base64Data = file.processedUrl.split(',')[1];
            const fileName = `frame_${pad(i + 1, numDigits)}.png`;
            zip.file(fileName, base64Data, { base64: true });
          }
    
          const content = await zip.generateAsync({ type: 'blob' });
          
          const link = document.createElement('a');
          link.href = URL.createObjectURL(content);
          link.download = 'logo-lapser-export.zip';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
    
        } catch (err) {
          console.error("Error exporting zip:", err);
          setError("Failed to create the ZIP file. Please try again.");
        } finally {
          setIsExporting(false);
        }
      }, [processedFiles, masterFileId]);

    const handleProcessImages = useCallback(async () => {
        if (!masterFileId || uploadedFiles.length < 1) {
            setError("Please select a master image and upload at least one other image.");
            return;
        }
        if (isAiVariationsEnabled && !apiKey) {
            setError("Please enter your Google AI API key to generate variations.");
            return;
        }

        setIsProcessing(true);
        setError(null);
        setProcessedFiles([]);
        setProcessingProgress(0);
        setProcessingStatus('Initializing processor...');

        const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

        setTimeout(async () => {
            const masterFile = uploadedFiles.find(f => f.id === masterFileId);
            if (!masterFile) {
                setError("Master file not found.");
                setIsProcessing(false);
                return;
            }

            const standardFiles = uploadedFiles.filter(f => !f.needsPerspectiveCorrection && !f.needsSimpleMatch);
            const simpleMatchFiles = uploadedFiles.filter(f => f.needsSimpleMatch && f.id !== masterFileId);
            const perspectiveFiles = uploadedFiles.filter(f => f.needsPerspectiveCorrection && f.id !== masterFileId);
            const totalAlignmentFiles = standardFiles.length + simpleMatchFiles.length + perspectiveFiles.length;
            const totalSteps = totalAlignmentFiles + (isAiVariationsEnabled ? numVariations : 0);
            let stepsCompleted = 0;

            const alignmentStages = 2 + (perspectiveFiles.length > 0 ? 1 : 0);
            const generationStages = (isAiVariationsEnabled ? 1 : 0);
            const totalStages = alignmentStages + generationStages;
            let currentStage = 1;

            setProcessingStatus(`Stage ${currentStage}/${totalStages}: Aligning standard images...`);
            await yieldToMain();

            let stage1Results: ProcessedFile[] = [];
            for (const targetFile of standardFiles) {
                try {
                    const { processedUrl, debugUrl } = await processImageLocally(
                        masterFile.imageElement, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                        false, isSimpleMatchEnabled, targetFile.id === masterFileId, aspectRatio
                    );
                    stage1Results.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                    setProcessedFiles([...stage1Results]);
                } catch (err) {
                    console.error("Error processing standard file:", targetFile.file.name, err);
                    setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                }
                stepsCompleted++;
                setProcessingProgress((stepsCompleted / totalSteps) * 100);
                await yieldToMain();
            }
            currentStage++;

            // Process Simple Match files
            let stage2Results = stage1Results;
            if (simpleMatchFiles.length > 0) {
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Processing simple match images...`);
                await yieldToMain();
                
                let simpleMatchResults: ProcessedFile[] = [];
                for (const targetFile of simpleMatchFiles) {
                    try {
                        const { processedUrl, debugUrl } = await processImageLocally(
                            masterFile.imageElement, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                            false, true, targetFile.id === masterFileId, aspectRatio
                        );
                        simpleMatchResults.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                        setProcessedFiles([...stage1Results, ...simpleMatchResults]);
                    } catch (err) {
                        console.error("Error processing simple match file:", targetFile.file.name, err);
                        setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                    }
                    stepsCompleted++;
                    setProcessingProgress((stepsCompleted / totalSteps) * 100);
                    await yieldToMain();
                }
                stage2Results = [...stage1Results, ...simpleMatchResults];
            }
            currentStage++;

            if (isEnsembleCorrectionEnabled && stage2Results.length > 1) {
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Applying ensemble correction...`);
                await yieldToMain();

                const masterResult = stage2Results.find(f => f.id === masterFileId);
                if (masterResult) {
                    const goldenTemplateElement = await dataUrlToImageElement(masterResult.processedUrl);
                    let refinedResults: ProcessedFile[] = [];
                    for (const file of stage2Results) {
                        if (file.id !== masterFileId) {
                            try {
                                const refinedUrl = await refineWithGoldenTemplate(file.processedUrl, goldenTemplateElement);
                                refinedResults.push({ ...file, processedUrl: refinedUrl });
                            } catch (err) {
                                console.error("Error during ensemble refinement:", file.originalName, err);
                                refinedResults.push(file);
                            }
                        } else {
                            refinedResults.push(file);
                        }
                    }
                    stage2Results = refinedResults;
                    setProcessedFiles(stage2Results);
                }
            }
            currentStage++;

            let stage3Results = stage2Results;
            if (perspectiveFiles.length > 0) {
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Aligning perspective images...`);
                await yieldToMain();
                
                const masterResult = stage2Results.find(f => f.id === masterFileId);
                if (masterResult) {
                    const perspectiveMasterElement = await dataUrlToImageElement(masterResult.processedUrl);
                    for (const targetFile of perspectiveFiles) {
                         try {
                            const { processedUrl, debugUrl } = await processImageLocally(
                                perspectiveMasterElement, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                                true, false, false, aspectRatio
                            );
                            stage3Results.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                            setProcessedFiles([...stage3Results]);
                        } catch (err) {
                            console.error("Error processing perspective file:", targetFile.file.name, err);
                            setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                        }
                        stepsCompleted++;
                        setProcessingProgress((stepsCompleted / totalSteps) * 100);
                        await yieldToMain();
                    }
                }
                currentStage++;
            }

            let finalResults = stage3Results;
            if (isAiVariationsEnabled && selectedSnippets.length > 0 && apiKey) {
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Generating AI variations...`);
                await yieldToMain();

                let referenceImages: ProcessedFile[] = [];
                const masterRef = finalResults.find(f => f.id === masterFileId);
                if (masterRef) {
                    referenceImages = [masterRef];
                } else if (finalResults.length > 0) {
                    referenceImages = [finalResults[0]];
                }
                
                for (let i = 0; i < numVariations; i++) {
                    setProcessingStatus(`Stage ${currentStage}/${totalStages}: Generating AI variation ${i + 1}/${numVariations}...`);
                    const startTime = performance.now();
                    console.time(`Generate Variation ${i + 1}`);
                    
                    const randomSnippet = selectedSnippets[Math.floor(Math.random() * selectedSnippets.length)];
                    let fullPrompt = `${AI_PROMPT_BASE} The new scene should be: ${randomSnippet}.`;
                    
                    let contextBase64: string | undefined;
                    if (contextImageFile) {
                            try {
                            contextBase64 = await fileToBase64(contextImageFile);
                            fullPrompt += ` REFERENCE IMAGE: Use the attached context image as a strong reference for the lighting, color palette, and environment style.`;
                            } catch (e) {
                                console.error("Failed to process context image:", e);
                            }
                    }

                    if (projectContext.trim()) {
                        fullPrompt += ` CONTEXT/THEME: ${projectContext.trim()}. Ensure the generated background fits this context perfectly.`;
                    }
                    
                    // Smooth Progress Simulation
                    // We want to bridge the gap from current progress to the target progress for this step
                    // over the expected duration (17s).
                    const analysisProgress = 20;
                    const aiProgressChunk = 80 / numVariations;
                    const startStepProgress = analysisProgress + (i * aiProgressChunk);
                    const targetStepProgress = analysisProgress + ((i + 1) * aiProgressChunk);
                    
                    // Start simulation
                    let currentSimulatedProgress = startStepProgress;
                    const progressInterval = setInterval(() => {
                        setProcessingProgress(prev => {
                            // Increment by ~0.5% every 100ms, aiming to fill the chunk in ~16s
                            // chunk=20% (for 4 vars). 16s = 160 steps. 20/160 = 0.125 per step.
                            // chunk=80% (for 1 var). 16s = 160 steps. 80/160 = 0.5 per step.
                            const increment = aiProgressChunk / (170); // 17s * 10 steps/s
                            const next = prev + increment;
                            return next >= targetStepProgress ? targetStepProgress : next;
                        });
                    }, 100);

                    try {
                        const variationDataUrl = await generateVariation(referenceImages, fullPrompt, apiKey, contextBase64);
                        clearInterval(progressInterval);
                        // Snap to target progress
                        setProcessingProgress(targetStepProgress);
                        
                        const variationImageElement = await dataUrlToImageElement(variationDataUrl);

                        const masterResult = finalResults.find(f => f.id === masterFileId);
                        if (masterResult) {
                            const masterElementForAI = await dataUrlToImageElement(masterResult.processedUrl);
                            const { processedUrl, debugUrl } = await processImageLocally(
                                masterElementForAI, variationImageElement, true, true,
                                false, false, false, aspectRatio
                            );
                            const variationId = `ai-var-${Date.now()}-${i}`;
                            finalResults.push({ id: variationId, originalName: `AI: ${randomSnippet}`, processedUrl, debugUrl: variationDataUrl });
                        }
                    } catch (err) {
                        clearInterval(progressInterval);
                        console.error("Error generating AI variation:", err);
                        const friendlyError = getFriendlyErrorMessage(err, `AI Variation ${i + 1}`);
                        setError(prev => (prev ? prev + ' | ' : '') + friendlyError);
                    } finally {
                        clearInterval(progressInterval); // Safety clear
                        console.timeEnd(`Generate Variation ${i + 1}`);
                        const duration = (performance.now() - startTime) / 1000;
                        console.log(`Variation ${i + 1} took ${duration.toFixed(2)}s`);
                    }
                    
                    await yieldToMain();
                }
            }

            setProcessedFiles(finalResults);
            setProcessingStatus('Processing complete!');
            setIsProcessing(false);

        }, 100);
    }, [
        uploadedFiles, masterFileId, isGreedyMode, isRefinementEnabled, 
        isEnsembleCorrectionEnabled, isAiVariationsEnabled, numVariations, 
        aspectRatio, selectedSnippets, apiKey, contextImageFile
    ]);
    
    // Calculate estimated time based on remaining steps
    const estimatedTimeRemaining = useMemo(() => {
        if (!isProcessing) return null;
        
        // Heuristics (in seconds)
        const TIME_PER_LOCAL_ALIGNMENT = 0.5;
        const TIME_PER_AI_GENERATION = 17.0;

        // Determine total estimated time
        let totalTime = 0;
        
        // Add local alignment time if we have user uploaded files to process
        // (Rough estimate: if not AI mode, or if mixed mode)
        const nonAiFilesCount = uploadedFiles.length;
        totalTime += nonAiFilesCount * TIME_PER_LOCAL_ALIGNMENT;

        // Add AI generation time
        if (isAiVariationsEnabled) {
            totalTime += numVariations * TIME_PER_AI_GENERATION;
        }

        // Calculate remaining time based on current progress percentage
        const percentageRemaining = Math.max(0, (100 - processingProgress) / 100);
        const secondsRemaining = Math.max(1, Math.ceil(totalTime * percentageRemaining));

        if (secondsRemaining <= 2) return "Finishing up...";
        return `~${secondsRemaining}s remaining`;
    }, [isProcessing, isAiVariationsEnabled, processingProgress, numVariations, uploadedFiles.length]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col items-center p-4 sm:p-6 md:p-8">
      <header className="w-full max-w-7xl mx-auto flex flex-col items-center mb-6">
        <div className="w-full flex items-center">
          <div className="flex items-center gap-4">
            <SquaresExcludeIcon className="w-10 h-10 text-cyan-400" />
            <div className="flex flex-col">
              <JaaCoolMediaLogo className="h-7" />
              <h1 className="text-3xl font-bold text-white tracking-tight">Logo-Lapser</h1>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={handleStartAllOver}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
              title="Start all over - reset everything"
            >
              Start All Over
            </button>
            <span className="text-xs text-gray-500 font-medium">v5.2</span>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col items-center justify-center">
        {error && (
          <div className="w-full bg-red-800/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" title="Dismiss">
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        )}

        {!cvReady && (
            <div className="text-center">
                <Spinner />
                <p className="mt-4 text-lg text-gray-400">Loading Image Processor...</p>
            </div>
        )}

        {cvReady && isProcessing && (
          <div className="flex flex-col items-center justify-center text-center p-8 animate-fade-in">
            <Spinner />
            <p className="text-xl font-semibold mt-4 text-cyan-300">{processingStatus}</p>
            
            {/* Progress Bar */}
            <div className="w-64 mt-4 bg-gray-700 rounded-full h-2.5 overflow-hidden shadow-inner">
              <div 
                className="bg-cyan-400 h-2.5 rounded-full transition-all duration-300 ease-out" 
                style={{ width: `${processingProgress}%` }}
              ></div>
            </div>

            {/* Stats & Time Estimate */}
            <div className="flex flex-col items-center mt-3 gap-1">
                <p className="text-sm text-gray-400 font-mono">{Math.round(processingProgress)}%</p>
                {estimatedTimeRemaining && (
                    <p className="text-xs text-cyan-400/80 font-medium animate-pulse">
                        {estimatedTimeRemaining}
                    </p>
                )}
            </div>
          </div>
        )}
        
        {cvReady && !isProcessing && processedFiles.length > 0 && (
            <Previewer 
                files={processedFiles}
                originalFiles={uploadedFiles}
                masterFileId={masterFileId}
                isDebugMode={isDebugMode}
                onSetDebugMode={setIsDebugMode}
                onBackToSelection={handleBackToSelection}
                aspectRatio={aspectRatio}
                onDelete={handleDeleteProcessedFile}
                onPerspectiveFix={handleFixPerspective}
                onSimpleMatchFix={handleSimpleMatchFix}
                fixingImageId={fixingImageId}
                onExport={handleExport}
                isExporting={isExporting}
            />
        )}
        
        {cvReady && !isProcessing && processedFiles.length === 0 && (
          <div className="w-full flex flex-col items-center gap-8">
            {uploadedFiles.length === 0 ? (
              <FileDropzone onDrop={handleFilesDrop} />
            ) : (
                <ImageGrid 
                    files={uploadedFiles} 
                    masterFileId={masterFileId} 
                    onSelectMaster={handleSelectMaster} 
                    onTogglePerspective={handleTogglePerspective}
                    onToggleSimpleMatch={handleToggleSimpleMatch}
                    onDelete={handleDeleteUploadedFile}
                />
            )}

            {uploadedFiles.length > 0 && (
              <>
                <div className="w-full border-t border-gray-700 my-4"></div>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                    
                    <div className="flex flex-col items-start gap-4 p-4 bg-gray-800/50 rounded-lg h-full">
                         <p className="text-left text-lg text-gray-300 mb-2">2. Configure alignment settings.</p>
                         <GreedyModeToggle isChecked={isGreedyMode} onChange={setIsGreedyMode} />
                         <RefinementToggle isChecked={isRefinementEnabled} onChange={setIsRefinementEnabled} />
                         <EnsembleCorrectionToggle isChecked={isEnsembleCorrectionEnabled} onChange={setIsEnsembleCorrectionEnabled} />
                         <PerspectiveCorrectionToggle 
                            isChecked={allNonMasterFilesNeedPerspective} 
                            onChange={handleToggleAllPerspective} 
                         />
                         <SimpleMatchToggle 
                            isChecked={allNonMasterFilesNeedSimpleMatch} 
                            onChange={handleToggleAllSimpleMatch} 
                         />
                    </div>

                    <div className="flex flex-col items-center gap-4 p-4 bg-gray-800/50 rounded-lg h-full">
                        <AspectRatioSelector selectedRatio={aspectRatio} onSelectRatio={setAspectRatio} />
                    </div>

                    <div className="flex flex-col items-center gap-4 p-4 bg-gray-800/50 rounded-lg h-full">
                        <p className="text-center text-lg text-gray-300 mb-2">4. (Optional) Generate AI variations.</p>
                        <AIVariationsToggle isChecked={isAiVariationsEnabled} onChange={setIsAiVariationsEnabled} />
                        {isAiVariationsEnabled && (
                            <div className="w-full flex flex-col items-center gap-4 animate-fade-in">
                                <VariationSelector selectedValue={numVariations} onSelectValue={setNumVariations} max={12}/>
                                <PromptCustomizer 
                                    snippets={promptSnippets}
                                    selectedSnippets={selectedSnippets}
                                    onSelectionChange={handleSnippetSelectionChange}
                                    onAddSnippet={handleAddSnippet}
                                />
                                <ContextImageInput 
                                    selectedImage={contextImageFile} 
                                    onImageSelect={setContextImageFile} 
                                    isDisabled={!isAiVariationsEnabled}
                                />
                                <ContextInput 
                                    value={projectContext} 
                                    onChange={setProjectContext} 
                                    isDisabled={!isAiVariationsEnabled}
                                />
                                <div className="text-center p-3 rounded-md bg-gray-700/50 border border-gray-600 w-full max-w-xs flex flex-col gap-2">
                                    <label htmlFor="api-key-input" className="text-sm text-gray-300 font-medium">Google AI API Key</label>
                                    <input 
                                        id="api-key-input"
                                        type="password"
                                        value={apiKey}
                                        onChange={(e) => handleApiKeyChange(e.target.value)}
                                        placeholder="Paste your API key here"
                                        className="bg-gray-900 text-gray-200 border border-gray-500 rounded-md px-3 py-2 text-sm focus:ring-cyan-500 focus:border-cyan-500 w-full"
                                    />
                                    <p className="text-xs text-gray-400 mt-1">
                                        <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-300">Get your key here</a>. Your key is stored locally.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-full border-t border-gray-700 my-4"></div>
                
                <button
                  onClick={handleProcessImages}
                  disabled={!masterFileId || (isAiVariationsEnabled && !apiKey)}
                  className="px-8 py-4 text-xl font-bold text-white bg-cyan-600 rounded-lg shadow-lg hover:bg-cyan-500 transition-all duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:shadow-none focus:outline-none focus:ring-4 focus:ring-cyan-400/50"
                >
                  Align & Generate
                </button>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}