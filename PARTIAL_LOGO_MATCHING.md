# Robust Partial Logo Matching

## Problem

Wenn ein Master-Logo mehr Elemente enthält als ein Target-Bild (z.B. Master: "Luna" + Kreis mit Text, Target: nur "Luna"), führt das Standard-Feature-Matching zu:
- Weniger übereinstimmenden Keypoints
- Schlechterer Homographie-Schätzung
- Verzerrungen im ausgerichteten Bild

## Lösung: `performRobustAlignment`

### Kernverbesserungen

1. **Mehr Features extrahieren**
   ```typescript
   akaze = new cv.AKAZE(cv.AKAZE_DESCRIPTOR_MLDB, 0, 3, 0.0005);
   // Lower threshold (0.0005 vs default 0.001) = mehr Features
   ```

2. **Lenienter Matching-Thresholds**
   ```typescript
   MIN_MATCH_COUNT = 8 (statt 10)
   RATIO_TEST_THRESHOLD = 0.8 (statt 0.75)
   RANSAC_THRESHOLD = 5.0 (statt 3.0)
   ```

3. **Center-Weighted Matching** (NEU!)
   ```typescript
   // Bei >= 12 Matches: Bevorzuge Matches nahe der Bildmitte (frühere Aktivierung!)
   // Hilft bei Logo-Wänden oder mehreren Logo-Varianten im Bild
   if (goodMatches.length >= MIN_MATCH_COUNT * 1.5) {  // >= 12 Matches
       const imageCenterX = targetMat.cols / 2;
       const imageCenterY = targetMat.rows / 2;
       
       // Berechne Distanz jedes Matches zur Bildmitte
       const matchesWithCenterDistance = goodMatches.map(match => {
           const pt = keypointsTarget.get(match.queryIdx).pt;
           const distanceToCenter = Math.sqrt(
               Math.pow(pt.x - imageCenterX, 2) + 
               Math.pow(pt.y - imageCenterY, 2)
           );
           return { match, distanceToCenter, pt };
       });
       
       // Wähle die 40% zentralsten Matches (stärkere Zentrierung!)
       matchesWithCenterDistance.sort((a, b) => a.distanceToCenter - b.distanceToCenter);
       const centralMatchCount = Math.max(
           MIN_MATCH_COUNT,
           Math.floor(matchesWithCenterDistance.length * 0.4)
       );
       const centralMatches = matchesWithCenterDistance
           .slice(0, centralMatchCount)
           .map(item => item.match);
       
       // Berechne Cluster-Zentrum zur Verifikation
       const avgX = matchesWithCenterDistance.slice(0, centralMatchCount)
           .reduce((sum, item) => sum + item.pt.x, 0) / centralMatchCount;
       const avgY = matchesWithCenterDistance.slice(0, centralMatchCount)
           .reduce((sum, item) => sum + item.pt.y, 0) / centralMatchCount;
       
       // Sortiere diese nach Qualität
       centralMatches.sort((a, b) => a.distance - b.distance);
       goodMatches = centralMatches.slice(0, Math.min(centralMatches.length, 30));
   }
   ```

4. **Auto-Algorithm Selection** (NEU! 🎯)
   ```typescript
   // Testet BEIDE Algorithmen und wählt automatisch den besten
   // Bewertet Qualität basierend auf:
   // - Inlier-Ratio (wie viele Matches passen zur Transformation)
   // - Perspective Distortion (wie stark ist die Verzerrung)
   // - Scale Uniformity (wie gleichmäßig ist die Skalierung)
   
   if (usePerspectiveCorrection) {
       const homographyMatrix = cv.findHomography(...);
       const affineMatrix = cv.estimateAffine2D(...);
       
       // Homography Score: Inliers * (1 - Distortion)
       const perspectiveDistortion = Math.abs(h20) + Math.abs(h21);
       homographyScore = inlierRatio * (1.0 - Math.min(perspectiveDistortion * 10, 0.5));
       
       // Affine Score: Inliers * (0.8 + 0.2 * Uniformity)
       const scaleUniformity = 1.0 - Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY);
       affineScore = inlierRatio * (0.8 + 0.2 * scaleUniformity);
       
       // Wähle den besten
       if (homographyScore > affineScore && homographyScore > 0.3) {
           transformMatrix = homographyMatrix; // Perspective für frontale Logos
       } else if (affineScore > 0.2) {
           transformMatrix = affineMatrix; // Affine für Partial Logos
       }
   }
   ```

5. **Console Logging für Debugging**
   ```typescript
   console.log(`Features detected - Base: ${keypointsBase.size()}, Target: ${keypointsTarget.size()}`);
   console.log(`Good matches found: ${goodMatches.length}/${MIN_MATCH_COUNT} required`);
   console.log(`Homography inliers: ${inlierCount}/${goodMatches.length} (${(inlierRatio * 100).toFixed(1)}%)`);
   ```

## Integration in die Pipeline

### 1. Standard Alignment (`processImageLocally`)
```typescript
const alignResult = isSimpleMatchEnabled
    ? performSimpleAlignment(masterMat, targetMat, isGreedyMode, isRefinementEnabled)
    : performRobustAlignment(masterMat, targetMat, isGreedyMode, isRefinementEnabled, isPerspectiveCorrectionEnabled);
```

**Wann**: Bei jedem nicht-Master-Bild während der Haupt-Verarbeitung

### 2. Ensemble Correction (`refineWithGoldenTemplate`)
```typescript
const alignResult = performRobustAlignment(templateMat, targetMat, false, true, false);
```

**Wann**: Bei Level 3 ("Smooth AF!") nach der initialen Ausrichtung

## Algorithmus-Flow

```
┌─────────────────────────────────────────────────────────┐
│ 1. Feature Detection (AKAZE)                           │
│    → Standard AKAZE für Kompatibilität                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 2. Feature Matching (BFMatcher + Ratio Test 0.8)       │
│    → Lenienter Ratio Test                               │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Center-Weighted Selection (wenn >= 12 Matches)      │
│    → Bevorzuge Matches nahe Bildmitte (40% zentral)    │
│    → Hilft bei Logo-Wänden & mehreren Varianten        │
│    → Berechnet Cluster-Zentrum zur Verifikation        │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 4. Top-Match Selection                                  │
│    → Sortiere nach Qualität, behalte Top 30             │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Auto-Algorithm Selection (NEU! 🎯)                  │
│    → Teste BEIDE: Homography UND Affine                │
│    → Bewerte Qualität (Inliers + Distortion/Uniformity)│
│    → Wähle automatisch den besten Algorithmus          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Transform Estimation mit RANSAC (threshold 5.0)     │
│    → Perspective: Für frontale Logos (Score > 0.3)      │
│    → Affine: Für Partial Logos (Score > 0.2)           │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 7. Optional: Iterative Refinement                      │
│    → Warp → Re-detect → Re-match → Combine Transforms  │
└─────────────────────────────────────────────────────────┘
```

## Stability Level Integration

- **Level 1 (Rough)**: Iterative Refinement (I) aktiv, kein Perspective Correction
- **Level 2 (Medium)**: Perspective Correction (P) + I
- **Level 3 (Smooth AF!)**: P + I + Ensemble Correction (E)

Der robuste Algorithmus wird bei allen Levels verwendet, passt sich aber an:
- Bei Level 1: Nur Affine Transform (kein Perspective)
- Bei Level 2+: Homography mit Fallback zu Affine bei schlechten Matches

## Vorteile

✅ **Auto-Algorithm Selection**: Wählt automatisch zwischen Perspective & Affine  
✅ **Bessere Partial Matching**: Funktioniert auch wenn Master mehr Elemente hat  
✅ **Robustere Schätzung**: Höhere RANSAC-Toleranz für Outliers  
✅ **Center-Weighted**: Bevorzugt zentrale Logos bei Logo-Wänden  
✅ **Multi-Logo-Support**: Ignoriert periphere Logo-Varianten automatisch  
✅ **Quality-Based**: Bewertet beide Algorithmen und wählt den besten  
✅ **Debugging**: Console Logs zeigen Scores und ausgewählten Algorithmus  

## Testing

### Szenario 1: Partial Logo Matching
1. Master: Logo mit vielen Elementen (z.B. Luna + Kreis + Text)
2. Target: Logo mit weniger Elementen (z.B. nur Luna)
3. Erwartung: Keine Verzerrung, saubere Ausrichtung

### Szenario 2: Logo Wall / Multiple Logos
1. Master: Einzelnes Logo in der Mitte
2. Target: Mehrere Logo-Varianten (z.B. Logo-Wand mit verschiedenen Versionen)
3. Erwartung: Matcht das zentrale Logo, ignoriert periphere Logos

### Szenario 3: Auto-Algorithm Selection (NEU!)
1. Master: Luna + day + "The future of family health"
2. Target 1: Nur "Luna" → Sollte AFFINE wählen (Partial Logo)
3. Target 2: "Luna + day" → Sollte AFFINE wählen (Partial Logo)
4. Target 3: Frontales Logo → Sollte PERSPECTIVE wählen
5. Erwartung: Automatische Wahl des besten Algorithmus

Überprüfe Console für:
- Feature counts (sollten höher sein als vorher)
- Good matches (sollte >= 8 sein)
- "Center-weighted matching" Meldung bei Logo-Wänden (>=12 Matches)
- **Homography Score** und **Affine Score**
- **"✓ Auto-selected: AFFINE"** oder **"✓ Auto-selected: PERSPECTIVE"**
- Cluster center distance (sollte klein sein, nahe Bildmitte)

### Beispiel Console Output:
```
Features detected - Base: 342, Target: 287
Good matches found: 45/8 required
Center-weighted matching: Selected 30 matches from central region (cluster center: 89px from image center)
Homography: 28/30 inliers (93.3%), distortion: 0.0234, score: 0.816
Affine: 29/30 inliers (96.7%), scale uniformity: 0.987, score: 0.957
✓ Auto-selected: AFFINE (score: 0.957) - Better for partial logo matching
```
