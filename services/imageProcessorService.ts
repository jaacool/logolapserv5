// This service requires OpenCV.js to be loaded in the main HTML file.
// <script async src="https://docs.opencv.org/4.9.0/opencv.js"></script>

import { dataUrlToImageElement } from "../utils/fileUtils";

declare const cv: any; // Using 'any' for simplicity with OpenCV.js

// Utility to load an image element into a cv.Mat
const loadImageToMat = (image: HTMLImageElement): any => {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');
    ctx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
    const imageData = ctx.getImageData(0, 0, image.naturalWidth, image.naturalHeight);
    return cv.matFromImageData(imageData);
};

interface ProcessResult {
    processedUrl: string;
    debugUrl: string;
}

// Simple Match Algorithm - only rotation, position and uniform scaling (no perspective distortion)
const performSimpleAlignment = (
    baseMat: any,
    targetMat: any,
    isGreedy: boolean,
    useRefinement: boolean,
) => {
    const mats: any[] = [];
    let akaze: any;
    let clahe: any;
    
    const keypointsBase = new cv.KeyPointVector();
    const keypointsTarget = new cv.KeyPointVector();
    
    try {
        const MIN_MATCH_COUNT = isGreedy ? 4 : 10;
        const RATIO_TEST_THRESHOLD = isGreedy ? 0.85 : 0.75;
    
        const baseGray = new cv.Mat(); mats.push(baseGray);
        const targetGray = new cv.Mat(); mats.push(targetGray);
        cv.cvtColor(baseMat, baseGray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(targetMat, targetGray, cv.COLOR_RGBA2GRAY);

        clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(baseGray, baseGray);
        clahe.apply(targetGray, targetGray);

        akaze = new cv.AKAZE();
        const descriptorsBase = new cv.Mat(); mats.push(descriptorsBase);
        const descriptorsTarget = new cv.Mat(); mats.push(descriptorsTarget);
        akaze.detectAndCompute(baseGray, new cv.Mat(), keypointsBase, descriptorsBase);
        akaze.detectAndCompute(targetGray, new cv.Mat(), keypointsTarget, descriptorsTarget);

        if (descriptorsBase.empty() || descriptorsTarget.empty()) {
            throw new Error("Could not extract features from one or both images.");
        }

        const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);
        const matches = new cv.DMatchVectorVector(); mats.push(matches);
        bf.knnMatch(descriptorsTarget, descriptorsBase, matches, 2);

        const goodMatches = [];
        for (let i = 0; i < matches.size(); ++i) {
            const match = matches.get(i);
            if (match.size() > 1) {
               if (match.get(0).distance < RATIO_TEST_THRESHOLD * match.get(1).distance) {
                  goodMatches.push(match.get(0));
               }
            }
        }

        if (goodMatches.length < MIN_MATCH_COUNT) {
            throw new Error(`Not enough good matches found (${goodMatches.length}/${MIN_MATCH_COUNT}).`);
        }

        const basePts = [], targetPts = [];
        for(const match of goodMatches) {
            targetPts.push(keypointsTarget.get(match.queryIdx).pt.x);
            targetPts.push(keypointsTarget.get(match.queryIdx).pt.y);
            basePts.push(keypointsBase.get(match.trainIdx).pt.x);
            basePts.push(keypointsBase.get(match.trainIdx).pt.y);
        }
        const matTargetPts = cv.matFromArray(targetPts.length / 2, 1, cv.CV_32FC2, targetPts); mats.push(matTargetPts);
        const matBasePts = cv.matFromArray(basePts.length / 2, 1, cv.CV_32FC2, basePts); mats.push(matBasePts);

        // Use only affine transformation (no perspective)
        let transformMatrix = cv.estimateAffine2D(matTargetPts, matBasePts, new cv.Mat(), cv.RANSAC);
        if (transformMatrix.empty()) {
            throw new Error("Could not compute the simple affine transformation matrix.");
        }

        // Ensure uniform scaling by averaging scale factors
        const a = transformMatrix.doubleAt(0, 0);
        const b = transformMatrix.doubleAt(0, 1);
        const d = transformMatrix.doubleAt(1, 0);
        const e = transformMatrix.doubleAt(1, 1);
        
        // Calculate uniform scale as average of current scales
        const scaleX = Math.sqrt(a * a + b * b);
        const scaleY = Math.sqrt(d * d + e * e);
        const uniformScale = (scaleX + scaleY) / 2;
        
        // Calculate rotation angle
        const rotation = Math.atan2(b, a);
        
        // Create uniform scaling + rotation matrix
        const cos_r = Math.cos(rotation);
        const sin_r = Math.sin(rotation);
        
        const uniformTransformMatrix = cv.matFromArray(2, 3, cv.CV_64FC1, [
            uniformScale * cos_r, -uniformScale * sin_r, transformMatrix.doubleAt(0, 2),
            uniformScale * sin_r, uniformScale * cos_r, transformMatrix.doubleAt(1, 2)
        ]);
        mats.push(transformMatrix); // Clean up old matrix
        transformMatrix = uniformTransformMatrix;

        return { transformMatrix, keypointsBase, keypointsTarget, goodMatches };

    } catch (e) {
        if (keypointsBase && !keypointsBase.isDeleted()) keypointsBase.delete();
        if (keypointsTarget && !keypointsTarget.isDeleted()) keypointsTarget.delete();
        throw e;
    } finally {
         mats.forEach(mat => { if (mat && mat.delete && !mat.isDeleted()) mat.delete(); });
         if (akaze && akaze.delete) akaze.delete();
         if (clahe && clahe.delete) clahe.delete();
    }
};

// Robust alignment for partial logo matching
// Handles cases where master has more logo elements than target
const performRobustAlignment = (
    baseMat: any,
    targetMat: any,
    isGreedy: boolean,
    useRefinement: boolean,
    usePerspectiveCorrection: boolean,
) => {
    const mats: any[] = [];
    let akaze: any;
    let clahe: any;
    
    const keypointsBase = new cv.KeyPointVector();
    const keypointsTarget = new cv.KeyPointVector();
    
    try {
        // More lenient thresholds for partial matching
        const MIN_MATCH_COUNT = isGreedy ? 4 : 8; // Reduced from 10
        const RATIO_TEST_THRESHOLD = isGreedy ? 0.85 : 0.8; // More lenient
        const RANSAC_THRESHOLD = 5.0; // Increased tolerance for outliers
    
        const baseGray = new cv.Mat(); mats.push(baseGray);
        const targetGray = new cv.Mat(); mats.push(targetGray);
        cv.cvtColor(baseMat, baseGray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(targetMat, targetGray, cv.COLOR_RGBA2GRAY);

        clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(baseGray, baseGray);
        clahe.apply(targetGray, targetGray);
        
        // Use AKAZE with default parameters (OpenCV.js 4.9.0 compatibility)
        akaze = new cv.AKAZE();
        const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);

        const descriptorsBase = new cv.Mat(); mats.push(descriptorsBase);
        akaze.detectAndCompute(baseGray, new cv.Mat(), keypointsBase, descriptorsBase);

        const descriptorsTarget = new cv.Mat(); mats.push(descriptorsTarget);
        akaze.detectAndCompute(targetGray, new cv.Mat(), keypointsTarget, descriptorsTarget);

        if (descriptorsBase.rows === 0 || descriptorsTarget.rows === 0) {
            throw new Error("Could not find features in one or both images for alignment.");
        }

        console.log(`Features detected - Base: ${keypointsBase.size()}, Target: ${keypointsTarget.size()}`);

        const matches = new cv.DMatchVectorVector(); mats.push(matches);
        bf.knnMatch(descriptorsTarget, descriptorsBase, matches, 2);

        let goodMatches = [];
        for (let i = 0; i < matches.size(); ++i) {
            const match = matches.get(i);
            if (match.size() > 1) {
                const m = match.get(0);
                const n = match.get(1);
                if (m.distance < RATIO_TEST_THRESHOLD * n.distance) {
                    goodMatches.push(m);
                }
            }
        }

        console.log(`Good matches found: ${goodMatches.length}/${MIN_MATCH_COUNT} required`);

        if (goodMatches.length < MIN_MATCH_COUNT) {
            throw new Error(`Not enough good matches found for alignment - ${goodMatches.length}/${MIN_MATCH_COUNT}.`);
        }

        // Sort matches by distance and keep only the best ones for more robust estimation
        goodMatches.sort((a, b) => a.distance - b.distance);
        const topMatchCount = Math.min(goodMatches.length, Math.max(MIN_MATCH_COUNT * 2, 30));
        goodMatches = goodMatches.slice(0, topMatchCount);

        let basePts = [];
        let targetPts = [];
        for (let i = 0; i < goodMatches.length; i++) {
            basePts.push(keypointsBase.get(goodMatches[i].trainIdx).pt.x);
            basePts.push(keypointsBase.get(goodMatches[i].trainIdx).pt.y);
            targetPts.push(keypointsTarget.get(goodMatches[i].queryIdx).pt.x);
            targetPts.push(keypointsTarget.get(goodMatches[i].queryIdx).pt.y);
        }
        const matBasePts = cv.matFromArray(basePts.length / 2, 1, cv.CV_32FC2, basePts); mats.push(matBasePts);
        const matTargetPts = cv.matFromArray(targetPts.length / 2, 1, cv.CV_32FC2, targetPts); mats.push(matTargetPts);

        let transformMatrix: any;
        if (usePerspectiveCorrection) {
            // Robust perspective estimation with adaptive RANSAC
            const mask = new cv.Mat(); mats.push(mask);
            transformMatrix = cv.findHomography(matTargetPts, matBasePts, cv.RANSAC, RANSAC_THRESHOLD, mask);
            
            if (transformMatrix.empty()) {
                console.warn("Homography failed, falling back to affine transform.");
                transformMatrix = cv.estimateAffine2D(matTargetPts, matBasePts, new cv.Mat(), cv.RANSAC, RANSAC_THRESHOLD);
            } else {
                // Count inliers
                let inlierCount = 0;
                for (let i = 0; i < mask.rows; i++) {
                    if (mask.ucharAt(i, 0) > 0) inlierCount++;
                }
                const inlierRatio = inlierCount / goodMatches.length;
                console.log(`Homography inliers: ${inlierCount}/${goodMatches.length} (${(inlierRatio * 100).toFixed(1)}%)`);
                
                // If too few inliers, fallback to affine
                if (inlierRatio < 0.3) {
                    console.warn("Low inlier ratio, falling back to affine transform.");
                    transformMatrix.delete();
                    transformMatrix = cv.estimateAffine2D(matTargetPts, matBasePts, new cv.Mat(), cv.RANSAC, RANSAC_THRESHOLD);
                }
            }
        } else {
            // Affine transform with robust RANSAC
            const mask = new cv.Mat(); mats.push(mask);
            transformMatrix = cv.estimateAffine2D(matTargetPts, matBasePts, mask, cv.RANSAC, RANSAC_THRESHOLD);
            
            if (!transformMatrix.empty()) {
                let inlierCount = 0;
                for (let i = 0; i < mask.rows; i++) {
                    if (mask.ucharAt(i, 0) > 0) inlierCount++;
                }
                console.log(`Affine inliers: ${inlierCount}/${goodMatches.length}`);
            }
        }
        
        if (transformMatrix.empty()) {
            throw new Error("Could not compute the transformation.");
        }

        // Apply refinement if enabled
        if (useRefinement && !transformMatrix.empty()) {
            const isHomography = transformMatrix.rows === 3;
            const warpedForRefine = new cv.Mat(); mats.push(warpedForRefine);
            const dsize = new cv.Size(baseMat.cols, baseMat.rows);
            
            if (isHomography) {
                cv.warpPerspective(targetMat, warpedForRefine, transformMatrix, dsize);
            } else {
                cv.warpAffine(targetMat, warpedForRefine, transformMatrix, dsize);
            }

            const warpedGray = new cv.Mat(); mats.push(warpedGray);
            cv.cvtColor(warpedForRefine, warpedGray, cv.COLOR_RGBA2GRAY);
            clahe.apply(warpedGray, warpedGray);

            const keypointsRefined = new cv.KeyPointVector();
            const descriptorsRefined = new cv.Mat(); mats.push(descriptorsRefined);
            akaze.detectAndCompute(warpedGray, new cv.Mat(), keypointsRefined, descriptorsRefined);

            if (descriptorsRefined.rows > 0) {
                const matchesRefined = new cv.DMatchVectorVector(); mats.push(matchesRefined);
                bf.knnMatch(descriptorsRefined, descriptorsBase, matchesRefined, 2);

                const goodMatchesRefined = [];
                for (let i = 0; i < matchesRefined.size(); ++i) {
                    const match = matchesRefined.get(i);
                    if (match.size() > 1) {
                        const m = match.get(0);
                        const n = match.get(1);
                        if (m.distance < RATIO_TEST_THRESHOLD * n.distance) {
                            goodMatchesRefined.push(m);
                        }
                    }
                }

                if (goodMatchesRefined.length >= MIN_MATCH_COUNT) {
                    const basePtsRefined = [], targetPtsRefined = [];
                    for (let i = 0; i < goodMatchesRefined.length; i++) {
                        basePtsRefined.push(keypointsBase.get(goodMatchesRefined[i].trainIdx).pt.x);
                        basePtsRefined.push(keypointsBase.get(goodMatchesRefined[i].trainIdx).pt.y);
                        targetPtsRefined.push(keypointsRefined.get(goodMatchesRefined[i].queryIdx).pt.x);
                        targetPtsRefined.push(keypointsRefined.get(goodMatchesRefined[i].queryIdx).pt.y);
                    }

                    const matBasePtsRefined = cv.matFromArray(basePtsRefined.length / 2, 1, cv.CV_32FC2, basePtsRefined); mats.push(matBasePtsRefined);
                    const matTargetPtsRefined = cv.matFromArray(targetPtsRefined.length / 2, 1, cv.CV_32FC2, targetPtsRefined); mats.push(matTargetPtsRefined);

                    const refinementTransform = isHomography
                        ? cv.findHomography(matTargetPtsRefined, matBasePtsRefined, cv.RANSAC, RANSAC_THRESHOLD)
                        : cv.estimateAffine2D(matTargetPtsRefined, matBasePtsRefined, new cv.Mat(), cv.RANSAC, RANSAC_THRESHOLD);

                    if (!refinementTransform.empty()) {
                        // Combine transforms
                        if (isHomography) {
                            const combinedH = new cv.Mat();
                            cv.gemm(refinementTransform, transformMatrix, 1, new cv.Mat(), 0, combinedH, 0);
                            transformMatrix.delete();
                            transformMatrix = combinedH;
                        } else {
                            const h1 = new cv.Mat(3, 3, cv.CV_64FC1); mats.push(h1);
                            const h2 = new cv.Mat(3, 3, cv.CV_64FC1); mats.push(h2);
                            
                            for(let i=0; i<2; i++) for(let j=0; j<3; j++) h1.doublePtr(i,j)[0] = refinementTransform.doubleAt(i, j);
                            h1.doublePtr(2,0)[0] = 0; h1.doublePtr(2,1)[0] = 0; h1.doublePtr(2,2)[0] = 1;
                            
                            for(let i=0; i<2; i++) for(let j=0; j<3; j++) h2.doublePtr(i,j)[0] = transformMatrix.doubleAt(i, j);
                            h2.doublePtr(2,0)[0] = 0; h2.doublePtr(2,1)[0] = 0; h2.doublePtr(2,2)[0] = 1;

                            const combinedH = new cv.Mat(); mats.push(combinedH);
                            cv.gemm(h1, h2, 1, new cv.Mat(), 0, combinedH, 0);

                            const finalAffine = new cv.Mat(2, 3, cv.CV_64FC1);
                            for(let i=0; i<2; i++) for(let j=0; j<3; j++) finalAffine.doublePtr(i,j)[0] = combinedH.doubleAt(i, j);
                            
                            transformMatrix.delete();
                            transformMatrix = finalAffine;
                        }
                        refinementTransform.delete();
                    }
                }
            }
            if (keypointsRefined) keypointsRefined.delete();
        }

        return { transformMatrix, keypointsBase, keypointsTarget, goodMatches };

    } catch (e) {
        if (keypointsBase && !keypointsBase.isDeleted()) keypointsBase.delete();
        if (keypointsTarget && !keypointsTarget.isDeleted()) keypointsTarget.delete();
        throw e;
    } finally {
         mats.forEach(mat => { if (mat && mat.delete && !mat.isDeleted()) mat.delete(); });
         if (akaze && akaze.delete) akaze.delete();
         if (clahe && clahe.delete) clahe.delete();
    }
};

const performAlignment = (
    baseMat: any,
    targetMat: any,
    isGreedy: boolean,
    useRefinement: boolean,
    usePerspectiveCorrection: boolean,
) => {
    const mats: any[] = [];
    let akaze: any;
    let clahe: any;
    
    const keypointsBase = new cv.KeyPointVector();
    const keypointsTarget = new cv.KeyPointVector();
    
    try {
        const MIN_MATCH_COUNT = isGreedy ? 4 : 10;
        const RATIO_TEST_THRESHOLD = isGreedy ? 0.85 : 0.75;
    
        const baseGray = new cv.Mat(); mats.push(baseGray);
        const targetGray = new cv.Mat(); mats.push(targetGray);
        cv.cvtColor(baseMat, baseGray, cv.COLOR_RGBA2GRAY);
        cv.cvtColor(targetMat, targetGray, cv.COLOR_RGBA2GRAY);

        clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(baseGray, baseGray);
        clahe.apply(targetGray, targetGray);
        
        akaze = new cv.AKAZE();
        const bf = new cv.BFMatcher(cv.NORM_HAMMING, false);

        const descriptorsBase = new cv.Mat(); mats.push(descriptorsBase);
        akaze.detectAndCompute(baseGray, new cv.Mat(), keypointsBase, descriptorsBase);

        const descriptorsTarget = new cv.Mat(); mats.push(descriptorsTarget);
        akaze.detectAndCompute(targetGray, new cv.Mat(), keypointsTarget, descriptorsTarget);

        if (descriptorsBase.rows === 0 || descriptorsTarget.rows === 0) {
            throw new Error("Could not find features in one or both images for alignment.");
        }

        const matches = new cv.DMatchVectorVector(); mats.push(matches);
        bf.knnMatch(descriptorsTarget, descriptorsBase, matches, 2);

        let goodMatches = [];
        for (let i = 0; i < matches.size(); ++i) {
            const match = matches.get(i);
            if (match.size() > 1) {
                const m = match.get(0);
                const n = match.get(1);
                if (m.distance < RATIO_TEST_THRESHOLD * n.distance) {
                    goodMatches.push(m);
                }
            }
        }

        if (goodMatches.length < MIN_MATCH_COUNT) {
            throw new Error(`Not enough good matches found for alignment - ${goodMatches.length}/${MIN_MATCH_COUNT}.`);
        }

        let basePts = [];
        let targetPts = [];
        for (let i = 0; i < goodMatches.length; i++) {
            basePts.push(keypointsBase.get(goodMatches[i].trainIdx).pt.x);
            basePts.push(keypointsBase.get(goodMatches[i].trainIdx).pt.y);
            targetPts.push(keypointsTarget.get(goodMatches[i].queryIdx).pt.x);
            targetPts.push(keypointsTarget.get(goodMatches[i].queryIdx).pt.y);
        }
        const matBasePts = cv.matFromArray(basePts.length / 2, 1, cv.CV_32FC2, basePts); mats.push(matBasePts);
        const matTargetPts = cv.matFromArray(targetPts.length / 2, 1, cv.CV_32FC2, targetPts); mats.push(matTargetPts);

        let transformMatrix: any;
        if (usePerspectiveCorrection) {
            // "Smarter" perspective correction: coarse-to-fine approach
            // Step 1: Compute a robust affine transform first (coarse alignment)
            const affineMatrix = cv.estimateAffine2D(matTargetPts, matBasePts, new cv.Mat(), cv.RANSAC);
            if (affineMatrix.empty()) {
                 console.warn("Coarse affine failed, falling back to direct homography.");
                 transformMatrix = cv.findHomography(matTargetPts, matBasePts, cv.RANSAC);
            } else {
                mats.push(affineMatrix);
                
                // Step 2: Warp the image using the affine transform
                const warpedAffine = new cv.Mat(); mats.push(warpedAffine);
                const dsize = new cv.Size(baseMat.cols, baseMat.rows);
                cv.warpAffine(targetMat, warpedAffine, affineMatrix, dsize);

                // Step 3: Re-run feature detection on the pre-aligned image for fine-tuning
                const warpedGray = new cv.Mat(); mats.push(warpedGray);
                cv.cvtColor(warpedAffine, warpedGray, cv.COLOR_RGBA2GRAY);
                clahe.apply(warpedGray, warpedGray);
                
                const keypointsWarped = new cv.KeyPointVector(); // Manually delete
                const descriptorsWarped = new cv.Mat(); mats.push(descriptorsWarped);
                akaze.detectAndCompute(warpedGray, new cv.Mat(), keypointsWarped, descriptorsWarped);

                const matchesRefined = new cv.DMatchVectorVector(); mats.push(matchesRefined);
                bf.knnMatch(descriptorsWarped, descriptorsBase, matchesRefined, 2);

                const goodMatchesRefined = [];
                for (let i = 0; i < matchesRefined.size(); ++i) {
                    const match = matchesRefined.get(i);
                    if (match.size() > 1) {
                       if (match.get(0).distance < RATIO_TEST_THRESHOLD * match.get(1).distance) {
                          goodMatchesRefined.push(match.get(0));
                       }
                    }
                }
                
                if (goodMatchesRefined.length < MIN_MATCH_COUNT) {
                    console.warn("Not enough matches in fine-tuning, falling back to direct homography.");
                    keypointsWarped.delete();
                    transformMatrix = cv.findHomography(matTargetPts, matBasePts, cv.RANSAC);
                } else {
                    // Step 4: Compute homography on the pre-aligned points (fine correction)
                    const basePtsRefined = [], warpedPts = [];
                    for(const match of goodMatchesRefined) {
                        warpedPts.push(keypointsWarped.get(match.queryIdx).pt.x);
                        warpedPts.push(keypointsWarped.get(match.queryIdx).pt.y);
                        basePtsRefined.push(keypointsBase.get(match.trainIdx).pt.x);
                        basePtsRefined.push(keypointsBase.get(match.trainIdx).pt.y);
                    }
                    const matWarpedPts = cv.matFromArray(warpedPts.length / 2, 1, cv.CV_32FC2, warpedPts); mats.push(matWarpedPts);
                    const matBasePtsRefined = cv.matFromArray(basePtsRefined.length / 2, 1, cv.CV_32FC2, basePtsRefined); mats.push(matBasePtsRefined);
                    
                    const homographyRefinement = cv.findHomography(matWarpedPts, matBasePtsRefined, cv.RANSAC);
                    keypointsWarped.delete();
                    
                    if (homographyRefinement.empty()) {
                         console.warn("Fine-tuning homography failed, falling back to direct homography.");
                         transformMatrix = cv.findHomography(matTargetPts, matBasePts, cv.RANSAC);
                    } else {
                        // Step 5: Combine the affine and homography transformations
                        mats.push(homographyRefinement);
                        const affine3x3 = cv.matFromArray(3, 3, cv.CV_64FC1, [
                            affineMatrix.doubleAt(0, 0), affineMatrix.doubleAt(0, 1), affineMatrix.doubleAt(0, 2),
                            affineMatrix.doubleAt(1, 0), affineMatrix.doubleAt(1, 1), affineMatrix.doubleAt(1, 2),
                            0, 0, 1
                        ]);
                        mats.push(affine3x3);

                        const combinedHomography = new cv.Mat(); // DO NOT push to local `mats` array for cleanup
                        cv.gemm(homographyRefinement, affine3x3, 1, new cv.Mat(), 0, combinedHomography, 0); // H_final = H_refine * H_affine
                        transformMatrix = combinedHomography; // The caller is now responsible for deleting this matrix
                    }
                }
            }
        } else {
            transformMatrix = cv.estimateAffine2D(matTargetPts, matBasePts, new cv.Mat(), cv.RANSAC);
             if (transformMatrix.empty()) {
                throw new Error("Could not compute the transformation.");
            }
            if (useRefinement) {
                const affineTransform = transformMatrix;
                const warpedForRefine = new cv.Mat(); mats.push(warpedForRefine);
                const dsize = new cv.Size(baseMat.cols, baseMat.rows);
                cv.warpAffine(targetMat, warpedForRefine, affineTransform, dsize);

                const warpedGray = new cv.Mat(); mats.push(warpedGray);
                cv.cvtColor(warpedForRefine, warpedGray, cv.COLOR_RGBA2GRAY);
                
                clahe.apply(warpedGray, warpedGray); 

                const keypointsRefined = new cv.KeyPointVector(); 
                const descriptorsRefined = new cv.Mat(); mats.push(descriptorsRefined);
                akaze.detectAndCompute(warpedGray, new cv.Mat(), keypointsRefined, descriptorsRefined);

                if (descriptorsRefined.rows > 0) {
                    const matchesRefined = new cv.DMatchVectorVector(); mats.push(matchesRefined);
                    bf.knnMatch(descriptorsRefined, descriptorsBase, matchesRefined, 2);

                    const goodMatchesRefined = [];
                    for (let i = 0; i < matchesRefined.size(); ++i) {
                        const match = matchesRefined.get(i);
                        if (match.size() > 1) {
                            const m = match.get(0);
                            const n = match.get(1);
                            if (m.distance < RATIO_TEST_THRESHOLD * n.distance) {
                                goodMatchesRefined.push(m);
                            }
                        }
                    }

                    if (goodMatchesRefined.length >= MIN_MATCH_COUNT) {
                        const basePtsRefined = [], targetPtsRefined = [];
                        for (let i = 0; i < goodMatchesRefined.length; i++) {
                            basePtsRefined.push(keypointsBase.get(goodMatchesRefined[i].trainIdx).pt.x);
                            basePtsRefined.push(keypointsBase.get(goodMatchesRefined[i].trainIdx).pt.y);
                            targetPtsRefined.push(keypointsRefined.get(goodMatchesRefined[i].queryIdx).pt.x);
                            targetPtsRefined.push(keypointsRefined.get(goodMatchesRefined[i].queryIdx).pt.y);
                        }

                        const matBasePtsRefined = cv.matFromArray(basePtsRefined.length / 2, 1, cv.CV_32FC2, basePtsRefined); mats.push(matBasePtsRefined);
                        const matTargetPtsRefined = cv.matFromArray(targetPtsRefined.length / 2, 1, cv.CV_32FC2, targetPtsRefined); mats.push(matTargetPtsRefined);

                        const affineRefinement = cv.estimateAffine2D(matTargetPtsRefined, matBasePtsRefined, new cv.Mat(), cv.RANSAC);
                        mats.push(affineRefinement);

                        if (!affineRefinement.empty()) {
                            const h1 = new cv.Mat(3, 3, cv.CV_64FC1); mats.push(h1);
                            const h2 = new cv.Mat(3, 3, cv.CV_64FC1); mats.push(h2);
                            
                            for(let i=0; i<2; i++) for(let j=0; j<3; j++) h1.doublePtr(i,j)[0] = affineRefinement.doubleAt(i, j);
                            h1.doublePtr(2,0)[0] = 0; h1.doublePtr(2,1)[0] = 0; h1.doublePtr(2,2)[0] = 1;
                            
                            for(let i=0; i<2; i++) for(let j=0; j<3; j++) h2.doublePtr(i,j)[0] = affineTransform.doubleAt(i, j);
                            h2.doublePtr(2,0)[0] = 0; h2.doublePtr(2,1)[0] = 0; h2.doublePtr(2,2)[0] = 1;

                            const combinedH = new cv.Mat(); mats.push(combinedH);
                            cv.gemm(h1, h2, 1, new cv.Mat(), 0, combinedH, 0);

                            const finalAffine = new cv.Mat(2, 3, cv.CV_64FC1);
                            for(let i=0; i<2; i++) for(let j=0; j<3; j++) finalAffine.doublePtr(i,j)[0] = combinedH.doubleAt(i, j);
                            
                            affineTransform.delete(); 
                            transformMatrix = finalAffine; 
                        }
                    }
                }
                if (keypointsRefined) keypointsRefined.delete();
            }
        }
        
        if (transformMatrix.empty()) {
            throw new Error("Could not compute the final transformation.");
        }

        return { transformMatrix, keypointsBase, keypointsTarget, goodMatches };

    } catch (e) {
        if (keypointsBase && !keypointsBase.isDeleted()) keypointsBase.delete();
        if (keypointsTarget && !keypointsTarget.isDeleted()) keypointsTarget.delete();
        throw e;
    } finally {
         mats.forEach(mat => { if (mat && mat.delete && !mat.isDeleted()) mat.delete(); });
         if (akaze && akaze.delete) akaze.delete();
         if (clahe && clahe.delete) clahe.delete();
    }
};

export const processImageLocally = (
    masterImage: HTMLImageElement, 
    targetImage: HTMLImageElement, 
    isGreedyMode: boolean,
    isRefinementEnabled: boolean,
    isPerspectiveCorrectionEnabled: boolean,
    isSimpleMatchEnabled: boolean,
    isMaster: boolean,
    aspectRatio: string,
    useBlackBorder: boolean = false
): Promise<ProcessResult> => {
    return new Promise((resolve, reject) => {
        const mats: any[] = [];
        let goodMatchesVec: any;
        
        try {
            if (!window.cv || !window.cv.getBuildInformation) {
                throw new Error("OpenCV.js is not loaded yet.");
            }

            const masterMat = loadImageToMat(masterImage); mats.push(masterMat);
            const targetMat = loadImageToMat(targetImage); mats.push(targetMat);

            if (masterMat.empty() || targetMat.empty()) {
                throw new Error("Could not load images into OpenCV format.");
            }

            let transformMatrix: any;
            let debugUrl: string;

            if(isMaster) {
                transformMatrix = isPerspectiveCorrectionEnabled 
                    ? cv.matFromArray(3, 3, cv.CV_64FC1, [1, 0, 0, 0, 1, 0, 0, 0, 1])
                    : cv.matFromArray(2, 3, cv.CV_64FC1, [1, 0, 0, 0, 1, 0]);
                mats.push(transformMatrix);

                const dummyCanvas = document.createElement('canvas');
                dummyCanvas.width = 1; dummyCanvas.height = 1;
                debugUrl = dummyCanvas.toDataURL();
            } else {
                // Choose algorithm based on simple match setting
                // Use robust alignment for better partial logo matching
                const alignResult = isSimpleMatchEnabled
                    ? performSimpleAlignment(masterMat, targetMat, isGreedyMode, isRefinementEnabled)
                    : performRobustAlignment(masterMat, targetMat, isGreedyMode, isRefinementEnabled, isPerspectiveCorrectionEnabled);
                 
                 transformMatrix = alignResult.transformMatrix;
                 mats.push(transformMatrix);

                 const debugCanvas = document.createElement('canvas');
                 const debugMat = new cv.Mat(); mats.push(debugMat);
                 goodMatchesVec = new cv.DMatchVector();
                 alignResult.goodMatches.forEach(m => goodMatchesVec.push_back(m));
                 cv.drawMatches(targetMat, alignResult.keypointsTarget, masterMat, alignResult.keypointsBase, goodMatchesVec, debugMat);
                 cv.imshow(debugCanvas, debugMat);
                 debugUrl = debugCanvas.toDataURL('image/png');
                 
                 alignResult.keypointsBase.delete();
                 alignResult.keypointsTarget.delete();
            }

            // --- Final Warp and Pad ---
            const warpedTarget = new cv.Mat(); mats.push(warpedTarget);
            const dsize = new cv.Size(masterMat.cols, masterMat.rows);
            
            // Determine border mode and color
            // useBlackBorder ? Constant (Black) : Reflect101 (Mirror)
            const borderMode = useBlackBorder ? cv.BORDER_CONSTANT : cv.BORDER_REFLECT_101;
            const borderValue = useBlackBorder ? new cv.Scalar(0, 0, 0, 255) : new cv.Scalar(0, 0, 0, 0);

            // Create a mask to track valid content (White = Content, Black = Border)
            // We need this to distinguish between "original content" and "extrapolated border" 
            // especially when using Reflect/Replicate which fills the border with pixels.
            const mask = new cv.Mat(targetMat.rows, targetMat.cols, cv.CV_8UC1, new cv.Scalar(255)); mats.push(mask);
            const warpedMask = new cv.Mat(); mats.push(warpedMask);

            if(isPerspectiveCorrectionEnabled) {
                cv.warpPerspective(targetMat, warpedTarget, transformMatrix, dsize, cv.INTER_LINEAR, borderMode, borderValue);
                // Warp mask with CONSTANT (Black) border to mark extrapolated areas
                cv.warpPerspective(mask, warpedMask, transformMatrix, dsize, cv.INTER_NEAREST, cv.BORDER_CONSTANT, new cv.Scalar(0));
            } else {
                cv.warpAffine(targetMat, warpedTarget, transformMatrix, dsize, cv.INTER_LINEAR, borderMode, borderValue);
                cv.warpAffine(mask, warpedMask, transformMatrix, dsize, cv.INTER_NEAREST, cv.BORDER_CONSTANT, new cv.Scalar(0));
            }

            const warpedWidth = warpedTarget.cols;
            const warpedHeight = warpedTarget.rows;
            
            let targetAspectRatio;
            const [w, h] = aspectRatio.split(':').map(Number);
            if (h > w) { // Portrait (e.g., 9:16)
                targetAspectRatio = w / h;
            } else { // Landscape or Square (e.g., 16:9, 1:1)
                targetAspectRatio = w / h;
            }

            let finalWidth, finalHeight;
            if ((warpedWidth / warpedHeight) > targetAspectRatio) {
                finalWidth = warpedWidth;
                finalHeight = Math.round(warpedWidth / targetAspectRatio);
            } else {
                finalHeight = warpedHeight;
                finalWidth = Math.round(warpedHeight * targetAspectRatio);
            }

            const padX = finalWidth - warpedWidth;
            const padY = finalHeight - warpedHeight;
            const leftPad = Math.floor(padX / 2);
            const topPad = Math.floor(padY / 2);

            const paddedMat = new cv.Mat(); mats.push(paddedMat);
            
            if (useBlackBorder) {
                // Opaque black border for AI Edge Fill
                const padColor = new cv.Scalar(0, 0, 0, 255);
                cv.copyMakeBorder(warpedTarget, paddedMat, topPad, padY - topPad, leftPad, padX - leftPad, cv.BORDER_CONSTANT, padColor);
            } else {
                // Standard mode: Mirror/Reflect + Blur
                // 1. Pad the image with Reflection
                cv.copyMakeBorder(warpedTarget, paddedMat, topPad, padY - topPad, leftPad, padX - leftPad, cv.BORDER_REFLECT_101);
                
                // 2. Pad the mask with Constant Black (marking the new padding as border)
                const paddedMask = new cv.Mat(); mats.push(paddedMask);
                cv.copyMakeBorder(warpedMask, paddedMask, topPad, padY - topPad, leftPad, padX - leftPad, cv.BORDER_CONSTANT, new cv.Scalar(0));

                // 3. Blur the entire padded image (this blurs content + borders)
                const blurredMat = new cv.Mat(); mats.push(blurredMat);
                const ksize = new cv.Size(35, 35); // Slight blur
                cv.GaussianBlur(paddedMat, blurredMat, ksize, 0, 0, cv.BORDER_DEFAULT);
                
                // 4. Composite: Use sharp pixels where mask is White, blurred where mask is Black
                // We copy blurredMat onto paddedMat only where paddedMask is 0
                const invertedMask = new cv.Mat(); mats.push(invertedMask);
                cv.bitwise_not(paddedMask, invertedMask);
                
                blurredMat.copyTo(paddedMat, invertedMask);
            }
            
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = finalWidth;
            finalCanvas.height = finalHeight;
            cv.imshow(finalCanvas, paddedMat);
            const processedUrl = finalCanvas.toDataURL('image/png');
            
            resolve({ processedUrl, debugUrl });

        } catch (error) {
            reject(error);
        } finally {
            if (goodMatchesVec) goodMatchesVec.delete();
            mats.forEach(mat => { if (mat && mat.delete && !mat.isDeleted()) mat.delete(); });
        }
    });
};


export const refineWithGoldenTemplate = async (
    processedImageUrl: string,
    goldenTemplateElement: HTMLImageElement,
    useBlackBorder: boolean = false
): Promise<string> => {
     const mats: any[] = [];
    try {
        const targetImageElement = await dataUrlToImageElement(processedImageUrl);

        const templateMat = loadImageToMat(goldenTemplateElement); mats.push(templateMat);
        const targetMat = loadImageToMat(targetImageElement); mats.push(targetMat);
        
        if (templateMat.empty() || targetMat.empty()) {
            throw new Error("Could not load images for refinement.");
        }

        // Refinement uses affine transform with robust matching
        const alignResult = performRobustAlignment(templateMat, targetMat, false, true, false);
        const affineTransform = alignResult.transformMatrix; mats.push(affineTransform);

        const warpedMat = new cv.Mat(); mats.push(warpedMat);
        const dsize = new cv.Size(templateMat.cols, templateMat.rows);
        
        if (useBlackBorder) {
            // Opaque black borders
            cv.warpAffine(targetMat, warpedMat, affineTransform, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0, 0, 0, 255));
        } else {
            // Standard Mode: Mirror/Reflect + Blur
            
            // 1. Warp with Reflection
            cv.warpAffine(targetMat, warpedMat, affineTransform, dsize, cv.INTER_LINEAR, cv.BORDER_REFLECT_101);
            
            // 2. Create a mask to identify the valid content area
            const mask = new cv.Mat(targetMat.rows, targetMat.cols, cv.CV_8UC1, new cv.Scalar(255)); mats.push(mask);
            const warpedMask = new cv.Mat(); mats.push(warpedMask);
            cv.warpAffine(mask, warpedMask, affineTransform, dsize, cv.INTER_NEAREST, cv.BORDER_CONSTANT, new cv.Scalar(0));
            
            // 3. Blur the whole image (to get blurred borders)
            const blurredMat = new cv.Mat(); mats.push(blurredMat);
            const ksize = new cv.Size(35, 35);
            cv.GaussianBlur(warpedMat, blurredMat, ksize, 0, 0, cv.BORDER_DEFAULT);
            
            // 4. Composite: Copy blurred pixels ONLY where warpedMask is 0 (border)
            // We can use mask inversion
            const invertedMask = new cv.Mat(); mats.push(invertedMask);
            cv.bitwise_not(warpedMask, invertedMask);
            
            // Copy blurred pixels to warpedMat using the inverted mask
            blurredMat.copyTo(warpedMat, invertedMask);
        }

        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = templateMat.cols;
        finalCanvas.height = templateMat.rows;
        cv.imshow(finalCanvas, warpedMat);
        
        alignResult.keypointsBase.delete();
        alignResult.keypointsTarget.delete();

        return finalCanvas.toDataURL('image/png');
    } catch(error) {
        console.error("Refinement with golden template failed, returning original.", error);
        return processedImageUrl; // Fallback to the original URL on error
    } finally {
        mats.forEach(mat => { if (mat && mat.delete && !mat.isDeleted()) mat.delete(); });
    }
};