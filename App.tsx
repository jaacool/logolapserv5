import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { FileDropzone } from './components/FileDropzone';
import { ImageGrid } from './components/ImageGrid';
import { Previewer } from './components/Previewer';
import { AuthModal } from './components/AuthModal';
import { UserMenu } from './components/UserMenu';
import { CreditShop } from './components/CreditShop';
import { InsufficientCreditsModal } from './components/InsufficientCreditsModal';
import { InvoiceModal } from './components/InvoiceModal';
import { processImageLocally, refineWithGoldenTemplate, detectPerspectiveDistortion, detectLuminanceInversion, invertImage, createInvertedMasterImage } from './services/imageProcessorService';
import { generateVariation } from './services/geminiService';
import { processWithNanobanana } from './services/nanobananaService';
import { onAuthChange } from './services/authService';
import { getCredits, deductCredits, hasEnoughCredits } from './services/creditService';
import { capturePayPalOrder } from './services/paymentService';
import { fileToImageElement, dataUrlToImageElement } from './utils/fileUtils';
import type { UploadedFile, ProcessedFile, AspectRatio } from './types';
import { calculateCreditsNeeded } from './types/credits';
import { JaaCoolMediaLogo, SquaresExcludeIcon, XIcon } from './components/Icons';
import { Spinner } from './components/Spinner';
import { DebugToggle } from './components/DebugToggle';
import { StabilitySlider } from './components/StabilitySlider';
import { EdgeFillSelector } from './components/EdgeFillSelector';
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
    if (rawMessage.includes('OpenCV internal error code')) {
        return `A low-level image alignment error occurred for "${context}". The perspective transform became unstable or invalid for this image. Try a cleaner scan, less extreme perspective, or disabling perspective correction for this file.`;
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
  const [elapsedTime, setElapsedTime] = useState(0); // Track actual elapsed time in seconds
  const [cvReady, setCvReady] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [stabilityLevel, setStabilityLevel] = useState<number>(3); // 1=I, 2=P+I, 3=P+I+E
  // Greedy mode is always disabled but kept for future use
  const isGreedyMode = false;
  // Derived states from stabilityLevel
  const isRefinementEnabled = stabilityLevel >= 1; // Refinement active from level 1
  // NEW LOGIC per User Request: Medium (2) = I + E (No P), High (3) = I + P + E
  const isPerspectiveCorrectionEnabled = stabilityLevel >= 3; // Perspective active only at level 3
  const isEnsembleCorrectionEnabled = stabilityLevel >= 2; // Ensemble active from level 2
  const [isAiEdgeFillEnabled, setIsAiEdgeFillEnabled] = useState(false);
  const [edgeFillResolution, setEdgeFillResolution] = useState<number>(1024);
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
  
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number>(0);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [creditShopOpen, setCreditShopOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [insufficientCreditsModal, setInsufficientCreditsModal] = useState<{
    isOpen: boolean;
    creditsNeeded: number;
  }>({ isOpen: false, creditsNeeded: 0 });
  
  const totalEstimatedTimeSecRef = useRef(0);
  
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
    
    // Auth listener
    const unsubscribe = onAuthChange(async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const userCredits = await getCredits();
        setCredits(userCredits);
      } else {
        setCredits(0);
      }
    });
    
    // Check for payment success/cancel from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    const paypalToken = urlParams.get('token'); // PayPal order ID
    
    if (paypalToken && paymentStatus === 'success') {
      // PayPal payment - need to capture the order
      (async () => {
        try {
          const result = await capturePayPalOrder(paypalToken);
          if ('error' in result) {
            alert('Payment failed: ' + result.error);
          } else {
            // Wait a moment for the database to update
            setTimeout(async () => {
              const userCredits = await getCredits();
              setCredits(userCredits);
              alert('🎉 PayPal payment successful! Your credits have been added.');
            }, 1000);
          }
        } catch (err) {
          console.error('PayPal capture error:', err);
          alert('Failed to complete PayPal payment. Please contact support.');
        }
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      })();
    } else if (paymentStatus === 'success') {
      // Stripe payment - webhook handles credits
      setTimeout(async () => {
        const userCredits = await getCredits();
        setCredits(userCredits);
        alert('🎉 Payment successful! Your credits have been added.');
      }, 2000);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (paymentStatus === 'cancelled') {
      alert('Payment was cancelled.');
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    return () => unsubscribe();
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

  const toggleMaster = useCallback(async (newMasterId: string | null) => {
    const newPreviousStates = new Map(previousFileStates);
    
    // Run luminance inversion detection when a new master is selected
    if (newMasterId && cvReady) {
      const masterFile = uploadedFiles.find(f => f.id === newMasterId);
      if (masterFile) {
        console.log('Running luminance inversion detection after master selection...');
        
        // Detect inversion for all non-master files
        const updatedFiles = await Promise.all(
          uploadedFiles.map(async (file) => {
            if (file.id === newMasterId) {
              // Master: save state and disable corrections
              newPreviousStates.set(file.id, {
                needsPerspectiveCorrection: file.needsPerspectiveCorrection || false,
                needsSimpleMatch: file.needsSimpleMatch || false
              });
              return { ...file, needsPerspectiveCorrection: false, needsSimpleMatch: false, isLuminanceInverted: false };
            }
            
            if (file.id === masterFileId) {
              // Old master: restore previous state
              const previousState = newPreviousStates.get(file.id);
              if (previousState && typeof previousState === 'object') {
                return { ...file, ...previousState };
              }
            }
            
            // Detect luminance inversion for other files
            try {
              const isInverted = detectLuminanceInversion(masterFile.imageElement, file.imageElement);
              console.log(`Luminance inversion for ${file.file.name}: ${isInverted ? 'INVERTED' : 'NORMAL'}`);
              return { ...file, isLuminanceInverted: isInverted };
            } catch (err) {
              console.warn(`Luminance inversion detection failed for ${file.file.name}:`, err);
              return file;
            }
          })
        );
        
        setUploadedFiles(updatedFiles);
      }
    } else {
      // No new master selected, just update states
      setUploadedFiles(prevFiles => {
        return prevFiles.map(file => {
          if (file.id === masterFileId) {
            // Old master: restore previous state
            const previousState = newPreviousStates.get(file.id);
            if (previousState && typeof previousState === 'object') {
              return { ...file, ...previousState };
            }
          }
          
          return file;
        });
      });
    }
    
    setPreviousFileStates(newPreviousStates);
    setMasterFileId(newMasterId);
  }, [masterFileId, previousFileStates, uploadedFiles, cvReady]);

  // Alias for ImageGrid component
  const handleSelectMaster = toggleMaster;

  const handleFilesDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null);
    const newFiles: UploadedFile[] = await Promise.all(
      acceptedFiles
        .filter(file => ['image/png', 'image/jpeg'].includes(file.type))
        .map(async (file) => {
          const imageElement = await fileToImageElement(file);
          
          // Automatic perspective detection
          let needsPerspective = true;
          let needsSimple = false;
          
          if (cvReady) {
            try {
              needsPerspective = detectPerspectiveDistortion(imageElement);
              needsSimple = !needsPerspective; // If no perspective needed, use simple match
              console.log(`Auto-detected ${file.name}: ${needsPerspective ? 'PERSPECTIVE' : 'FRONTAL/SIMPLE'}`);
            } catch (err) {
              console.warn('Auto-detection failed, defaulting to perspective:', err);
              needsPerspective = true;
              needsSimple = false;
            }
          }
          
          return {
            id: `${file.name}-${file.lastModified}`,
            file,
            previewUrl: imageElement.src,
            imageElement: imageElement,
            needsPerspectiveCorrection: needsPerspective,
            needsSimpleMatch: needsSimple,
          };
        })
    );
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, [cvReady]);

  const handleToggleSimpleMatch = useCallback((fileId: string) => {
    setUploadedFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              needsSimpleMatch: !file.needsSimpleMatch, 
              needsPerspectiveCorrection: file.needsSimpleMatch // If turning off simple match, turn on perspective
            } 
          : file
      )
    );
  }, []);

  const handleToggleLuminanceInversion = useCallback((fileId: string) => {
    setUploadedFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              isLuminanceInverted: !file.isLuminanceInverted
            } 
          : file
      )
    );
  }, []);

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
            let { processedUrl, debugUrl } = await processImageLocally(
                perspectiveMasterElement, 
                targetFile.imageElement, 
                isGreedyMode, 
                isRefinementEnabled,
                true, // Force perspective correction
                false, // Simple match disabled for perspective correction
                false, 
                aspectRatio,
                isAiEdgeFillEnabled,
                targetFile.isLuminanceInverted || false
            );

            if (isAiEdgeFillEnabled && apiKey) {
                try {
                    processedUrl = await processWithNanobanana(processedUrl, apiKey);
                } catch (fillErr) {
                     console.error("AI Edge Fill failed during fix:", fillErr);
                     setError(`Edge Fill failed: ${(fillErr as Error).message}`);
                }
            }

            setProcessedFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, processedUrl, debugUrl } : f
            ));
        } catch (err) {
            setError(getFriendlyErrorMessage(err, targetFile.file.name));
        } finally {
            setFixingImageId(null);
        }
    }, [masterFileId, uploadedFiles, processedFiles, isGreedyMode, isRefinementEnabled, aspectRatio, isAiEdgeFillEnabled, apiKey]);

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
            let { processedUrl, debugUrl } = await processImageLocally(
                masterFile.imageElement, 
                targetFile.imageElement, 
                isGreedyMode, 
                true, // Enable refinement for better results
                false, // No perspective correction
                true, // Force simple match
                false, 
                aspectRatio,
                isAiEdgeFillEnabled,
                targetFile.isLuminanceInverted || false
            );

            
            // Apply ensemble correction if enabled and we have other processed files
            if (isEnsembleCorrectionEnabled && processedFiles.length > 1) {
                const masterResult = processedFiles.find(f => f.id === masterFileId);
                if (masterResult) {
                    try {
                        const goldenTemplateElement = await dataUrlToImageElement(masterResult.processedUrl);
                        const refinedUrl = await refineWithGoldenTemplate(processedUrl, goldenTemplateElement, isAiEdgeFillEnabled);
                        processedUrl = refinedUrl; // Update processedUrl with refined version
                    } catch (err) {
                        console.error("Error during ensemble refinement for simple match:", err);
                        // Keep existing processedUrl
                    }
                }
            }

            if (isAiEdgeFillEnabled && apiKey) {
                try {
                    processedUrl = await processWithNanobanana(processedUrl, apiKey);
                } catch (fillErr) {
                     console.error("AI Edge Fill failed during fix:", fillErr);
                     setError(`Edge Fill failed: ${(fillErr as Error).message}`);
                }
            }

            setProcessedFiles(prev => prev.map(f => 
                f.id === fileId ? { ...f, processedUrl, debugUrl } : f
            ));
        } catch (err) {
            setError(getFriendlyErrorMessage(err, targetFile.file.name));
        } finally {
            setFixingImageId(null);
        }
    }, [uploadedFiles, masterFileId, isGreedyMode, isRefinementEnabled, isEnsembleCorrectionEnabled, processedFiles, aspectRatio, isAiEdgeFillEnabled, apiKey]);

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

  // Calculate estimated remaining time string
  const estimatedTimeRemaining = useMemo(() => {
      if (!isProcessing || processingProgress >= 100 || totalEstimatedTimeSecRef.current <= 0) return null;
      const remainingSec = Math.max(0, totalEstimatedTimeSecRef.current - elapsedTime);
      if (remainingSec <= 0) return "Almost done...";
      if (remainingSec < 60) return `${Math.ceil(remainingSec)}s remaining`;
      const mins = Math.ceil(remainingSec / 60);
      return `~${mins}m remaining`;
  }, [isProcessing, processingProgress, elapsedTime]);

  const handleProcessImages = useCallback(async () => {
        if (!masterFileId || uploadedFiles.length < 1) {
            setError("Please select a master image and upload at least one other image.");
            return;
        }
        if (isAiVariationsEnabled && !apiKey) {
            setError("Please enter your Google AI API key to generate variations.");
            return;
        }
        if (isAiEdgeFillEnabled && !apiKey) {
            setError("Please enter your Google AI API key (Nanobanana) to perform AI Edge Fill.");
            return;
        }

        // Calculate credits needed for this batch
        const imageCount = uploadedFiles.filter(f => f.id !== masterFileId).length;
        const edgeFillMode: 'none' | 'standard' | 'premium' | 'ultra' = !isAiEdgeFillEnabled 
          ? 'none' 
          : edgeFillResolution >= 4096 ? 'ultra' 
          : edgeFillResolution > 1024 ? 'premium' 
          : 'standard';
        const aiVariationCount = isAiVariationsEnabled ? numVariations : 0;
        const creditsNeeded = calculateCreditsNeeded(imageCount, edgeFillMode, aiVariationCount);
        
        // Check if user is logged in and has enough credits
        if (user) {
            const hasCredits = await hasEnoughCredits(creditsNeeded);
            if (!hasCredits) {
                setInsufficientCreditsModal({ isOpen: true, creditsNeeded });
                return;
            }
        }

        setIsProcessing(true);
        setError(null);
        setProcessedFiles([]);
        setProcessingProgress(0);
        setElapsedTime(0);
        setProcessingStatus('Initializing processor...');

        const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

        // Estimate total time for the whole pipeline (local + optional AI)
        const REAL_TIME_PER_LOCAL_ALIGNMENT = 1.2; // seconds per local image
        const REAL_TIME_PER_AI_FILL = 18.0; // Estimate for Nanobanana
        const REAL_TIME_PER_AI_GENERATION = 17.0;   // seconds per AI variation

        let totalEstimatedTimeSec = uploadedFiles.length * REAL_TIME_PER_LOCAL_ALIGNMENT;
        if (isAiEdgeFillEnabled) {
            totalEstimatedTimeSec += uploadedFiles.length * REAL_TIME_PER_AI_FILL;
        }
        if (isAiVariationsEnabled) {
            totalEstimatedTimeSec += numVariations * REAL_TIME_PER_AI_GENERATION;
        }
        if (totalEstimatedTimeSec <= 0) {
            totalEstimatedTimeSec = 1; // safety to avoid division by zero
        }
        totalEstimatedTimeSecRef.current = totalEstimatedTimeSec;

        // Start real-time timer that drives both countdown (1 fps) and a very smooth progress (~30 fps)
        const elapsedStartTime = performance.now();
        const progressTimer = setInterval(() => {
            const elapsedSeconds = (performance.now() - elapsedStartTime) / 1000;

            // 1) Update elapsedTime in echten Sekunden (1 fps)
            const wholeSeconds = Math.floor(elapsedSeconds);
            setElapsedTime(prev => (wholeSeconds > prev ? wholeSeconds : prev));

            // 2) Update Progress: direkt aus der Zeit (0 -> 100% linear über totalEstimatedTimeSec)
            const targetFraction = Math.min(1, elapsedSeconds / totalEstimatedTimeSec);
            const targetPercent = targetFraction * 100;
            setProcessingProgress(targetPercent);
        }, 33); // ~30 fps, sehr flüssige Animation

        setTimeout(async () => {
            const masterFile = uploadedFiles.find(f => f.id === masterFileId);
            if (!masterFile) {
                setError("Master file not found.");
                setIsProcessing(false);
                return;
            }

            // ========== DUAL PIPELINE: NORMAL vs INVERTED ==========
            // Split files into two groups:
            // 1. Normal files (not inverted) - use original master
            // 2. Inverted files (isLuminanceInverted=true) - use inverted master
            
            const normalFiles = uploadedFiles.filter(f => !f.isLuminanceInverted && f.id !== masterFileId);
            const invertedFiles = uploadedFiles.filter(f => f.isLuminanceInverted && f.id !== masterFileId);
            
            console.log(`DUAL PIPELINE: ${normalFiles.length} normal files, ${invertedFiles.length} inverted files`);
            
            // Create inverted master from ORIGINAL master image
            // This will be used for standard/simple match alignment of inverted files
            let invertedMasterElement: HTMLImageElement | null = null;
            if (invertedFiles.length > 0) {
                setProcessingStatus('Creating inverted master image...');
                await yieldToMain();
                try {
                    invertedMasterElement = await createInvertedMasterImage(masterFile.imageElement);
                    console.log('✅ Inverted master image created successfully (from original master)');
                } catch (err) {
                    console.error('Failed to create inverted master:', err);
                    setError('Failed to create inverted master image');
                }
            }

            // Filter files based on their flags and current stability level
            // At level 1 (Rough), perspective correction is disabled, so treat all files as standard
            const standardFiles = uploadedFiles.filter(f => 
                (!f.needsPerspectiveCorrection && !f.needsSimpleMatch) || 
                (f.needsPerspectiveCorrection && !isPerspectiveCorrectionEnabled && !f.needsSimpleMatch)
            );
            const simpleMatchFiles = uploadedFiles.filter(f => f.needsSimpleMatch && f.id !== masterFileId);
            const perspectiveFiles = isPerspectiveCorrectionEnabled 
                ? uploadedFiles.filter(f => f.needsPerspectiveCorrection && f.id !== masterFileId && !f.needsSimpleMatch)
                : [];
            
            // Calculate total stages dynamically based on enabled features and file counts
            const hasSimpleMatchFiles = simpleMatchFiles.length > 0;
            const hasPerspectiveFiles = perspectiveFiles.length > 0;
            const hasInvertedFiles = invertedFiles.length > 0;
            const willRunEnsemble = isEnsembleCorrectionEnabled && uploadedFiles.length > 1;
            const willRunEdgeFill = isAiEdgeFillEnabled && apiKey;
            const willRunAI = isAiVariationsEnabled && selectedSnippets.length > 0 && apiKey;

            let totalStages = 1; // Start with 1 for Standard
            if (hasSimpleMatchFiles) totalStages++;
            if (hasPerspectiveFiles) totalStages++;
            if (willRunEnsemble) totalStages++; // Now includes separate ensemble for normal AND inverted
            if (willRunEdgeFill) totalStages++;
            if (willRunAI) totalStages++;

            let currentStage = 1;

            setProcessingStatus(`Stage ${currentStage}/${totalStages}: Aligning standard images...`);
            await yieldToMain();

            // Helper to get the correct master for a file
            const getMasterForFile = (file: UploadedFile): HTMLImageElement => {
                if (file.isLuminanceInverted && invertedMasterElement) {
                    console.log(`📸 Using INVERTED master for: ${file.file.name}`);
                    return invertedMasterElement;
                }
                console.log(`📸 Using NORMAL master for: ${file.file.name}`);
                return masterFile.imageElement;
            };

            let stage1Results: ProcessedFile[] = [];
            for (const targetFile of standardFiles) {
                try {
                    const masterToUse = getMasterForFile(targetFile);
                    let { processedUrl, debugUrl } = await processImageLocally(
                        masterToUse, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                        false, isSimpleMatchEnabled, targetFile.id === masterFileId, aspectRatio, isAiEdgeFillEnabled,
                        false // No longer pass isLuminanceInverted - we use inverted master instead
                    );
                    
                    stage1Results.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                    setProcessedFiles([...stage1Results]);
                } catch (err) {
                    console.error("Error processing standard file:", targetFile.file.name, err);
                    setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                }
                await yieldToMain();
            }
            
            if (hasSimpleMatchFiles) {
                currentStage++;
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Processing simple match images...`);
                await yieldToMain();
            }

            // Process Simple Match files
            let stage2Results = stage1Results;
            if (simpleMatchFiles.length > 0) {
                let simpleMatchResults: ProcessedFile[] = [];
                for (const targetFile of simpleMatchFiles) {
                    try {
                        const masterToUse = getMasterForFile(targetFile);
                        let { processedUrl, debugUrl } = await processImageLocally(
                            masterToUse, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                            false, true, targetFile.id === masterFileId, aspectRatio, isAiEdgeFillEnabled,
                            false // No longer pass isLuminanceInverted
                        );

                        simpleMatchResults.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                        setProcessedFiles([...stage1Results, ...simpleMatchResults]);
                    } catch (err) {
                        console.error("Error processing simple match file:", targetFile.file.name, err);
                        setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                    }
                    await yieldToMain();
                }
                stage2Results = [...stage1Results, ...simpleMatchResults];
            }

            let stage3Results = stage2Results;
            if (perspectiveFiles.length > 0) {
                currentStage++;
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Aligning perspective images...`);
                await yieldToMain();
                
                const masterResult = stage2Results.find(f => f.id === masterFileId);
                if (masterResult) {
                    const perspectiveMasterElement = await dataUrlToImageElement(masterResult.processedUrl);
                    
                    // Create inverted perspective master by inverting the already-processed master
                    // This ensures same crop/pad as normal master
                    let invertedPerspectiveMasterElement: HTMLImageElement | null = null;
                    if (hasInvertedFiles) {
                        try {
                            const invertedMasterUrl = await invertImage(masterResult.processedUrl);
                            invertedPerspectiveMasterElement = await dataUrlToImageElement(invertedMasterUrl);
                            console.log('✅ Inverted perspective master created from processed master');
                        } catch (err) {
                            console.warn('Could not create inverted perspective master:', err);
                        }
                    }
                    
                    for (const targetFile of perspectiveFiles) {
                         try {
                            // Use inverted perspective master for inverted files
                            const perspectiveMasterToUse = targetFile.isLuminanceInverted && invertedPerspectiveMasterElement
                                ? invertedPerspectiveMasterElement
                                : perspectiveMasterElement;
                            
                            console.log(`📸 Perspective: Using ${targetFile.isLuminanceInverted ? 'INVERTED' : 'NORMAL'} master for: ${targetFile.file.name}`);
                            
                            let { processedUrl, debugUrl } = await processImageLocally(
                                perspectiveMasterToUse, targetFile.imageElement, isGreedyMode, isRefinementEnabled,
                                true, false, false, aspectRatio, isAiEdgeFillEnabled,
                                false // No longer pass isLuminanceInverted
                            );

                            stage3Results.push({ id: targetFile.id, originalName: targetFile.file.name, processedUrl, debugUrl });
                            setProcessedFiles([...stage3Results]);
                        } catch (err) {
                            console.error("Error processing perspective file:", targetFile.file.name, err);
                            setError(prev => (prev ? prev + ' | ' : '') + getFriendlyErrorMessage(err, targetFile.file.name));
                        }
                        await yieldToMain();
                    }
                }
            }

            // ========== SEPARATED ENSEMBLE CORRECTION ==========
            // Apply Ensemble Correction separately for normal and inverted images
            // Normal images are refined against normal master
            // Inverted images are refined against each other (using first inverted as golden template)
            let stage3_5Results = stage3Results;
            if (willRunEnsemble && stage3Results.length > 1) {
                currentStage++;
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Applying ensemble correction (separated pipelines)...`);
                await yieldToMain();
                
                const masterResult = stage3Results.find(f => f.id === masterFileId);
                if (masterResult) {
                    const goldenTemplateElement = await dataUrlToImageElement(masterResult.processedUrl);
                    
                    // Separate results into normal and inverted
                    const normalResults = stage3Results.filter(f => {
                        const originalFile = uploadedFiles.find(uf => uf.id === f.id);
                        return !originalFile?.isLuminanceInverted;
                    });
                    const invertedResults = stage3Results.filter(f => {
                        const originalFile = uploadedFiles.find(uf => uf.id === f.id);
                        return originalFile?.isLuminanceInverted;
                    });
                    
                    console.log(`Ensemble Correction: ${normalResults.length} normal, ${invertedResults.length} inverted`);
                    
                    let refinedResults: ProcessedFile[] = [];
                    
                    // 1. Ensemble correction for NORMAL images (against normal master)
                    for (const file of normalResults) {
                        if (file.id !== masterFileId) {
                            try {
                                console.log(`Applying ensemble correction (NORMAL) to ${file.originalName}...`);
                                const refinedUrl = await refineWithGoldenTemplate(file.processedUrl, goldenTemplateElement, isAiEdgeFillEnabled);
                                refinedResults.push({ ...file, processedUrl: refinedUrl });
                            } catch (err) {
                                console.error("Error during ensemble refinement (normal):", file.originalName, err);
                                refinedResults.push(file);
                            }
                        } else {
                            refinedResults.push(file); // Master stays as-is
                        }
                        setProcessedFiles([...refinedResults]);
                        await yieldToMain();
                    }
                    
                    // 2. Ensemble correction for INVERTED images (against each other)
                    if (invertedResults.length > 0) {
                        // Use the first inverted image as the golden template for inverted group
                        const invertedGoldenTemplate = invertedResults[0];
                        const invertedGoldenElement = await dataUrlToImageElement(invertedGoldenTemplate.processedUrl);
                        
                        console.log(`Using ${invertedGoldenTemplate.originalName} as golden template for inverted group`);
                        
                        // First inverted image is already the template, add it as-is
                        refinedResults.push(invertedGoldenTemplate);
                        
                        // Refine remaining inverted images against the inverted golden template
                        for (let i = 1; i < invertedResults.length; i++) {
                            const file = invertedResults[i];
                            try {
                                console.log(`Applying ensemble correction (INVERTED) to ${file.originalName}...`);
                                const refinedUrl = await refineWithGoldenTemplate(file.processedUrl, invertedGoldenElement, isAiEdgeFillEnabled);
                                refinedResults.push({ ...file, processedUrl: refinedUrl });
                            } catch (err) {
                                console.error("Error during ensemble refinement (inverted):", file.originalName, err);
                                refinedResults.push(file);
                            }
                            setProcessedFiles([...refinedResults]);
                            await yieldToMain();
                        }
                    }
                    
                    stage3_5Results = refinedResults;
                    setProcessedFiles(stage3_5Results);
                }
            }

            let stage4Results = stage3_5Results;
            if (willRunEdgeFill) {
                currentStage++;
                setProcessingStatus(`Stage ${currentStage}/${totalStages}: Performing AI Edge Fill...`);
                await yieldToMain();

                let filledResults: ProcessedFile[] = [];
                for (const file of stage4Results) {
                    // Don't fill master if it didn't need processing? 
                    // Actually processImageLocally processes master too (crops/pads).
                    // So we should fill everything.
                    try {
                         const filledUrl = await processWithNanobanana(file.processedUrl, apiKey, edgeFillResolution);
                         filledResults.push({ ...file, processedUrl: filledUrl });
                    } catch (fillErr) {
                        console.error("AI Edge Fill failed for", file.originalName, fillErr);
                        setError(prev => (prev ? prev + ' | ' : '') + `Edge Fill failed for ${file.originalName}: ${(fillErr as Error).message}`);
                        filledResults.push(file);
                    }
                    // Update UI progressively? Or just wait for batch?
                    // Let's update progressively so user sees progress
                    setProcessedFiles([...filledResults, ...stage4Results.slice(filledResults.length)]);
                    await yieldToMain();
                }
                stage4Results = filledResults;
                setProcessedFiles(stage4Results);
            }

            let finalResults = stage4Results;
            if (isAiVariationsEnabled && selectedSnippets.length > 0 && apiKey) {
                currentStage++;
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

                    try {
                        const variationDataUrl = await generateVariation(referenceImages, fullPrompt, apiKey, contextBase64);
                        const variationImageElement = await dataUrlToImageElement(variationDataUrl);

                        const masterResult = finalResults.find(f => f.id === masterFileId);
                        if (masterResult) {
                            const masterElementForAI = await dataUrlToImageElement(masterResult.processedUrl);
                            const { processedUrl, debugUrl } = await processImageLocally(
                                masterElementForAI, variationImageElement, true, true,
                                false, false, false, aspectRatio, isAiEdgeFillEnabled, false
                            );
                            const variationId = `ai-var-${Date.now()}-${i}`;
                            finalResults.push({ id: variationId, originalName: `AI: ${randomSnippet}`, processedUrl, debugUrl: variationDataUrl });
                        }
                    } catch (err) {
                        console.error("Error generating AI variation:", err);
                        const friendlyError = getFriendlyErrorMessage(err, `AI Variation ${i + 1}`);
                        setError(prev => (prev ? prev + ' | ' : '') + friendlyError);
                    } finally {
                        console.timeEnd(`Generate Variation ${i + 1}`);
                        const duration = (performance.now() - startTime) / 1000;
                        console.log(`Variation ${i + 1} took ${duration.toFixed(2)}s`);
                    }
                    
                    await yieldToMain();
                }
            }

            // Clear timers and snap to 100%
            clearInterval(progressTimer);
            setProcessingProgress(100);
            
            // Deduct credits after successful processing
            if (user && creditsNeeded > 0) {
                const deducted = await deductCredits(creditsNeeded);
                if (deducted) {
                    console.log(`✅ Deducted ${creditsNeeded} credits`);
                    // Refresh credits display
                    const newCredits = await getCredits();
                    setCredits(newCredits);
                }
            }
            
            setProcessedFiles(finalResults);
            setProcessingStatus('Processing complete!');
            setIsProcessing(false);

        }, 100);
    }, [
        uploadedFiles, masterFileId, isGreedyMode, isRefinementEnabled, 
        isEnsembleCorrectionEnabled, isPerspectiveCorrectionEnabled, isAiEdgeFillEnabled,
        isAiVariationsEnabled, numVariations, isSimpleMatchEnabled,
        aspectRatio, selectedSnippets, apiKey, contextImageFile, edgeFillResolution, projectContext, user
    ]);
    
  // Helper to format time nicely (e.g. "1m 30s" or "45s")
  const formatTime = (totalSeconds: number) => {
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  // Calculate total estimated time for the UI button display
  const totalEstimatedTime = useMemo(() => {
      if (!uploadedFiles.length) return 0;
      
      const REAL_TIME_PER_LOCAL_ALIGNMENT = 1.2;
      const REAL_TIME_PER_AI_FILL = 18.0; 
      const REAL_TIME_PER_AI_GENERATION = 17.0;

      let total = uploadedFiles.length * REAL_TIME_PER_LOCAL_ALIGNMENT;
      
      if (isAiEdgeFillEnabled) {
          total += uploadedFiles.length * REAL_TIME_PER_AI_FILL;
      }
      
      if (isAiVariationsEnabled) {
          total += numVariations * REAL_TIME_PER_AI_GENERATION;
      }
      
      return Math.ceil(total);
  }, [uploadedFiles.length, isAiEdgeFillEnabled, isAiVariationsEnabled, numVariations]);

  // Calculate credits needed for display
  const estimatedCreditsNeeded = useMemo(() => {
      const imageCount = uploadedFiles.filter(f => f.id !== masterFileId).length;
      const edgeFillMode: 'none' | 'standard' | 'premium' | 'ultra' = !isAiEdgeFillEnabled 
        ? 'none' 
        : edgeFillResolution >= 4096 ? 'ultra' 
        : edgeFillResolution > 1024 ? 'premium' 
        : 'standard';
      const aiVariationCount = isAiVariationsEnabled ? numVariations : 0;
      return calculateCreditsNeeded(imageCount, edgeFillMode, aiVariationCount);
  }, [uploadedFiles, masterFileId, isAiEdgeFillEnabled, edgeFillResolution, isAiVariationsEnabled, numVariations]);

  const formattedEstimatedTime = formatTime(totalEstimatedTime);

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
            <span className="text-xs text-gray-500 font-medium">v5.3</span>
            
            {/* Auth Buttons */}
            {user ? (
              <UserMenu 
                user={user} 
                credits={credits} 
                onBuyCredits={() => setCreditShopOpen(true)} 
                onShowInvoices={() => setInvoiceModalOpen(true)}
              />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setAuthModalMode('login'); setAuthModalOpen(true); }}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Log In
                </button>
                <button
                  onClick={() => { setAuthModalMode('signup'); setAuthModalOpen(true); }}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all"
                >
                  Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      
      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModalOpen} 
        onClose={() => setAuthModalOpen(false)} 
        initialMode={authModalMode}
      />
      
      {/* Credit Shop Modal */}
      <CreditShop
        isOpen={creditShopOpen}
        onClose={() => setCreditShopOpen(false)}
        onPurchase={(packageId) => {
          console.log('Purchase package:', packageId);
        }}
        userId={user?.uid}
      />
      
      {/* Insufficient Credits Modal */}
      <InsufficientCreditsModal
        isOpen={insufficientCreditsModal.isOpen}
        onClose={() => setInsufficientCreditsModal({ isOpen: false, creditsNeeded: 0 })}
        onBuyCredits={() => {
          setInsufficientCreditsModal({ isOpen: false, creditsNeeded: 0 });
          setCreditShopOpen(true);
        }}
        creditsNeeded={insufficientCreditsModal.creditsNeeded}
        creditsAvailable={credits}
      />
      
      {/* Invoice Modal */}
      {user && (
        <InvoiceModal
          isOpen={invoiceModalOpen}
          onClose={() => setInvoiceModalOpen(false)}
          userId={user.uid}
          userEmail={user.email}
        />
      )}

      <main className="w-full max-w-[1800px] mx-auto flex-grow flex flex-col items-center justify-center h-full">
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
        
        {/* MAIN CONTENT AREA */}
        {cvReady && !isProcessing && (
          <>
            {uploadedFiles.length === 0 ? (
              <div className="w-full max-w-4xl">
                <FileDropzone onDrop={handleFilesDrop} />
              </div>
            ) : (
                <div className="w-full flex flex-col lg:flex-row gap-8 items-start h-full">
                    {/* LEFT SIDEBAR - Settings (Always Visible) */}
                    <div className="w-full lg:w-[360px] flex-shrink-0 flex flex-col gap-6 p-6 bg-gray-800/40 rounded-xl border border-gray-700/50 sticky top-6 backdrop-blur-sm">
                        <h2 className="text-xl font-bold text-white mb-2">Settings</h2>
                        
                        {/* Settings Sections */}
                        <StabilitySlider value={stabilityLevel} onChange={setStabilityLevel} />
                        
                        <div className="h-px bg-gray-700/50" />
                        
                        <EdgeFillSelector 
                            value={isAiEdgeFillEnabled ? 'pro' : 'fast'} 
                            onChange={(val) => setIsAiEdgeFillEnabled(val === 'pro')}
                            resolution={edgeFillResolution}
                            onResolutionChange={setEdgeFillResolution}
                            imageCount={uploadedFiles.length}
                        />
                        
                        <div className="h-px bg-gray-700/50" />
                        
                        <AspectRatioSelector selectedRatio={aspectRatio} onSelectRatio={setAspectRatio} />
                        
                        {/* AI Variations Section */}
                        <div className="pt-2">
                            <AIVariationsToggle isChecked={isAiVariationsEnabled} onChange={setIsAiVariationsEnabled} />
                            
                            {isAiVariationsEnabled && (
                                <div className="mt-4 space-y-4 animate-fade-in">
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
                                    {/* API Key Input */}
                                    <div className="bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                                        <label htmlFor="api-key-input" className="text-xs text-gray-400 font-medium block mb-1.5">Google AI API Key</label>
                                        <input 
                                            id="api-key-input"
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => handleApiKeyChange(e.target.value)}
                                            placeholder="Paste API key..."
                                            className="w-full bg-gray-900 text-gray-200 border border-gray-600 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-cyan-500 outline-none"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* Main Action Button */}
                        {processedFiles.length > 0 ? (
                           <button
                              onClick={handleStartAllOver}
                              className="w-full mt-2 py-4 px-6 text-lg font-bold text-white bg-red-600 rounded-xl shadow-lg hover:shadow-red-500/20 hover:bg-red-700 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
                           >
                              Start All Over
                              <span className="block text-xs font-normal opacity-80 mt-1">
                                 Reset to upload new files
                              </span>
                           </button>
                        ) : (
                           <button
                              onClick={handleProcessImages}
                              disabled={!masterFileId || (isAiVariationsEnabled && !apiKey)}
                              className="w-full mt-2 py-4 px-6 text-lg font-bold text-white bg-gradient-to-r from-cyan-600 to-blue-600 rounded-xl shadow-lg hover:shadow-cyan-500/20 hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                           >
                              Align & Generate
                              <span className="block text-xs font-normal opacity-80 mt-1">
                                 Est. time: ~{formattedEstimatedTime}
                                 {user && estimatedCreditsNeeded > 0 && (
                                   <span className="ml-2 text-yellow-300">• ⚡{estimatedCreditsNeeded} credits</span>
                                 )}
                              </span>
                           </button>
                        )}
                    </div>

                    {/* RIGHT SIDE - Content */}
                    <div className="flex-1 w-full min-w-0 overflow-y-auto">
                        {processedFiles.length > 0 ? (
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
                        ) : (
                            <ImageGrid 
                                files={uploadedFiles} 
                                masterFileId={masterFileId} 
                                onSelectMaster={handleSelectMaster} 
                                onToggleSimpleMatch={handleToggleSimpleMatch}
                                onToggleLuminanceInversion={handleToggleLuminanceInversion}
                                onDelete={handleDeleteUploadedFile}
                            />
                        )}
                    </div>
                </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}