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

4. **Adaptive Fallback-Strategie**
   ```typescript
   // Bei Perspective Correction:
   // 1. Versuche Homography mit RANSAC
   // 2. Zähle Inliers
   // 3. Falls Inlier-Ratio < 30% → Fallback zu Affine Transform
   
   if (inlierRatio < 0.3) {
       console.warn("Low inlier ratio, falling back to affine transform.");
       transformMatrix = cv.estimateAffine2D(...);
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
│ 5. Transform Estimation mit RANSAC (threshold 5.0)     │
│    → Höhere Toleranz für Outliers                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 6. Inlier Check & Adaptive Fallback                    │
│    → Falls < 30% Inliers: Homography → Affine          │
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

✅ **Bessere Partial Matching**: Funktioniert auch wenn Master mehr Elemente hat  
✅ **Robustere Schätzung**: Höhere RANSAC-Toleranz für Outliers  
✅ **Adaptive Strategie**: Automatischer Fallback bei schlechten Matches  
✅ **Center-Weighted**: Bevorzugt zentrale Logos bei Logo-Wänden  
✅ **Multi-Logo-Support**: Ignoriert periphere Logo-Varianten automatisch  
✅ **Debugging**: Console Logs zeigen Feature-Counts und Inlier-Ratios  

## Testing

### Szenario 1: Partial Logo Matching
1. Master: Logo mit vielen Elementen (z.B. Luna + Kreis + Text)
2. Target: Logo mit weniger Elementen (z.B. nur Luna)
3. Erwartung: Keine Verzerrung, saubere Ausrichtung

### Szenario 2: Logo Wall / Multiple Logos
1. Master: Einzelnes Logo in der Mitte
2. Target: Mehrere Logo-Varianten (z.B. Logo-Wand mit verschiedenen Versionen)
3. Erwartung: Matcht das zentrale Logo, ignoriert periphere Logos

Überprüfe Console für:
- Feature counts (sollten höher sein als vorher)
- Good matches (sollte >= 8 sein)
- "Center-weighted matching" Meldung bei Logo-Wänden (>=12 Matches)
- Cluster center distance (sollte klein sein, nahe Bildmitte)
- Inlier ratios (sollte >= 30% sein für Homography)
